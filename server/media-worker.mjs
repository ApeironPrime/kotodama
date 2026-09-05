import { createAuthStore } from './auth-store.mjs'
import { readConfig } from './config.mjs'
import { createDatabasePool } from './db/pool.mjs'
import { createDictionaryService } from './dictionary-service.mjs'
import { log, logError } from './logger.mjs'
import { createMediaStorage, MediaStorageError } from './media-storage.mjs'
import {
  extractAudioChunks,
  normalizeDiarizedTranscript,
  removeExtractedAudio,
  TranscriptionProviderError,
  transcribeJapaneseAudioChunk,
} from './transcription-provider.mjs'
import { downloadYouTubeVideo, removeDownloadedYouTubeVideo, YouTubeProviderError } from './youtube-provider.mjs'

async function verifyUpload({ job, store, storage, transcription }) {
  const asset = await store.findMediaAssetForProcessing(job.mediaAssetId)
  if (!asset?.storageKey)
    throw new MediaStorageError('MEDIA_OBJECT_MISSING', 'The uploaded media object is unavailable.')
  const inspection = await storage.inspect(asset.storageKey)
  if (inspection.byteSize !== asset.byteSize || inspection.mimeType !== asset.mimeType)
    throw new MediaStorageError(
      'MEDIA_INTEGRITY_FAILED',
      'The stored media object no longer matches its upload metadata.'
    )
  await store.completeMediaProcessingJob(job.id, {
    verifiedAt: new Date().toISOString(),
    mimeType: inspection.mimeType,
    byteSize: inspection.byteSize,
  })
  if (transcription?.enabled)
    await store.enqueueMediaProcessingJob(asset.id, 'transcribe', {
      input: { language: 'ja' },
      provider: transcription.provider,
    })
}

async function transcribeAsset({ job, store, storage, transcription, dictionary }) {
  if (!transcription?.enabled)
    throw new TranscriptionProviderError(
      'TRANSCRIPTION_PROVIDER_UNAVAILABLE',
      'The transcription provider is not configured.'
    )
  const asset = await store.findMediaAssetForProcessing(job.mediaAssetId)
  if (!asset?.storageKey)
    throw new MediaStorageError('MEDIA_OBJECT_MISSING', 'The uploaded media object is unavailable.')
  const { directory, chunks, durationSeconds } = await extractAudioChunks({
    sourcePath: storage.absolutePath(asset.storageKey),
    ffmpegPath: transcription.ffmpegPath,
    chunkSeconds: transcription.chunkSeconds,
  })
  try {
    const segments = []
    let emptyChunkCount = 0
    for (const chunk of chunks) {
      const payload = await transcribeJapaneseAudioChunk({
        filePath: chunk.path,
        fileName: chunk.name,
        config: transcription,
      })
      try {
        segments.push(...normalizeDiarizedTranscript(payload, chunk.offsetSeconds))
      } catch (error) {
        if (error instanceof TranscriptionProviderError && error.code === 'TRANSCRIPT_EMPTY') {
          emptyChunkCount += 1
          continue
        }
        throw error
      }
    }
    if (!segments.length)
      throw new TranscriptionProviderError(
        'TRANSCRIPT_EMPTY',
        'The video did not produce any usable transcript segments.'
      )
    const maximumTimeMs = Math.round(durationSeconds * 1_000)
    const timelineSegments = segments
      .filter((segment) => segment.startMs < maximumTimeMs)
      .map((segment) => ({ ...segment, endMs: Math.min(segment.endMs, maximumTimeMs) }))
      .filter((segment) => segment.endMs > segment.startMs)
      .sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs)
    if (!timelineSegments.length)
      throw new TranscriptionProviderError(
        'TRANSCRIPT_OUT_OF_RANGE',
        'The transcription provider returned timestamps outside the video duration.'
      )
    if (dictionary?.enrichSegments) {
      await dictionary.enrichSegments(timelineSegments)
    }
    const transcript = await store.saveMachineTranscript({
      mediaAssetId: asset.id,
      provider: `${transcription.provider}:${transcription.model}`,
      segments: timelineSegments,
    })
    if (!transcript)
      throw new TranscriptionProviderError('TRANSCRIPT_SAVE_FAILED', 'Cannot save the generated transcript.')
    await store.completeMediaProcessingJob(job.id, {
      transcriptVersionId: transcript.id,
      segmentCount: transcript.segments.length,
      chunkCount: chunks.length,
      emptyChunkCount,
    })
  } finally {
    await removeExtractedAudio(directory)
  }
}

async function downloadYouTubeAsset({ job, store, storage, config }) {
  if (!config.youtube.enabled)
    throw new YouTubeProviderError('YOUTUBE_IMPORT_DISABLED', 'Nhập YouTube chỉ được bật trong môi trường local.')
  const asset = await store.findMediaAssetForProcessing(job.mediaAssetId)
  if (!asset?.sourceReference)
    throw new YouTubeProviderError('YOUTUBE_SOURCE_MISSING', 'Video YouTube không có URL nguồn.')
  const downloaded = await downloadYouTubeVideo({ sourceUrl: asset.sourceReference, config })
  try {
    const upload = await storage.importDownloadedVideo(asset.id, downloaded.filePath)
    const completed = await store.completeDownloadedMediaAsset(asset.id, upload, downloaded.title)
    if (!completed) throw new MediaStorageError('YOUTUBE_IMPORT_SAVE_FAILED', 'Không thể lưu video YouTube.')
    await store.completeMediaProcessingJob(job.id, {
      sourceUrl: downloaded.sourceUrl,
      title: downloaded.title,
      byteSize: upload.byteSize,
      mimeType: upload.mimeType,
    })
  } finally {
    await removeDownloadedYouTubeVideo(downloaded.directory)
  }
}

export async function processNextMediaJob({ store, storage, config, transcription, dictionary }) {
  const resolvedConfig = config ?? { transcription: transcription ?? { enabled: false }, youtube: { enabled: false } }
  const job = await store.claimNextMediaProcessingJob()
  if (!job) return false

  try {
    if (job.jobType === 'upload_verify')
      await verifyUpload({ job, store, storage, transcription: resolvedConfig.transcription })
    else if (job.jobType === 'youtube_download')
      await downloadYouTubeAsset({ job, store, storage, config: resolvedConfig })
    else if (job.jobType === 'transcribe')
      await transcribeAsset({ job, store, storage, transcription: resolvedConfig.transcription, dictionary })
    else throw new MediaStorageError('MEDIA_JOB_UNSUPPORTED', `Unsupported media job: ${job.jobType}`)
    log('info', 'media.job-succeeded', { jobId: job.id, mediaAssetId: job.mediaAssetId, jobType: job.jobType })
  } catch (error) {
    const code =
      error instanceof MediaStorageError ||
      error instanceof TranscriptionProviderError ||
      error instanceof YouTubeProviderError
        ? error.code
        : 'MEDIA_PROCESSING_FAILED'
    const message =
      error instanceof YouTubeProviderError
        ? error.message
        : job.jobType === 'transcribe'
          ? 'Không thể tạo transcript cho video.'
          : 'Không thể xác minh video đã tải lên.'
    await store.failMediaProcessingJob(job.id, code, message)
    logError('media.job-failed', error, { jobId: job.id, mediaAssetId: job.mediaAssetId, jobType: job.jobType })
  }
  return true
}

async function run() {
  const config = readConfig()
  const database = createDatabasePool(config.databaseUrl)
  if (!database) throw new Error('DATABASE_URL is required for the media worker.')
  const store = createAuthStore(database)
  const storage = createMediaStorage(config)
  const dictionary = createDictionaryService(config.dictionary?.dbPath)
  let stopping = false
  const stop = () => {
    stopping = true
  }
  process.once('SIGTERM', stop)
  process.once('SIGINT', stop)
  log('info', 'media-worker.started', { storagePath: config.media.storagePath })
  try {
    while (!stopping) {
      const worked = await processNextMediaJob({ store, storage, config, dictionary })
      if (!worked) await new Promise((resolve) => setTimeout(resolve, config.media.workerPollMs))
    }
  } finally {
    await database.end()
    log('info', 'media-worker.stopped')
  }
}

if (process.argv[1]?.endsWith('media-worker.mjs')) await run()
