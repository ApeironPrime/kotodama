import { readConfig } from '../server/config.mjs'
import { createDatabasePool } from '../server/db/pool.mjs'
import { createAuthStore } from '../server/auth-store.mjs'
import { LocalMediaStorage } from '../server/media-storage.mjs'
import { createDictionaryService } from '../server/dictionary-service.mjs'
import {
  extractAudioChunks,
  normalizeDiarizedTranscript,
  transcribeJapaneseAudioChunk,
  removeExtractedAudio,
} from '../server/transcription-provider.mjs'

const config = readConfig(process.env)
const pool = createDatabasePool()
const store = createAuthStore(pool)
const storage = new LocalMediaStorage({
  rootPath: config.media.storagePath,
  maxUploadBytes: config.media.maxUploadBytes,
})

console.log('Connecting to dictionary...')
const dictPath =
  process.env.VNJPDICT_DB_PATH || 'D:/VKU/data/drive-download-20260828T102340Z-1-002/vnjpdict_scraper/vnjpdict.db'
const dictionary = createDictionaryService(dictPath)

const targetAssetIds = [
  '6e348355-ff80-4684-90c2-d46b86091715',
  '840683e4-d3bf-4808-8ae4-546c8f170583',
  'bbbe3367-3bd9-4114-a4a9-5261a2c33cc8',
]

for (const assetId of targetAssetIds) {
  const asset = await store.findMediaAssetForProcessing(assetId)
  if (!asset?.storageKey) {
    console.log(`Asset ${assetId} not found or missing storageKey, skipping.`)
    continue
  }

  const absPath = storage.absolutePath(asset.storageKey)
  console.log(`\n========================================`)
  console.log(`Processing Asset: "${asset.title}" (${asset.id})`)
  console.log(`File: ${absPath}`)

  // 1. Extract audio chunks
  console.log('Extracting audio...')
  const { directory, chunks, durationSeconds } = await extractAudioChunks({
    sourcePath: absPath,
    ffmpegPath: config.transcription.ffmpegPath,
    chunkSeconds: 180,
  })

  try {
    const rawSegments = []
    const localAsrConfig = {
      ...config.transcription,
      provider: 'local_whisper',
      model: 'large-v3',
      localAsrUrl: process.env.LOCAL_ASR_URL || 'http://127.0.0.1:8788',
    }

    console.log(`Transcribing with Local GPU ASR (${chunks.length} chunk(s))...`)
    for (const chunk of chunks) {
      console.log(` - Chunk: ${chunk.name} (offset: ${chunk.offsetSeconds}s)`)
      const payload = await transcribeJapaneseAudioChunk({
        filePath: chunk.path,
        fileName: chunk.name,
        config: localAsrConfig,
      })
      const norm = normalizeDiarizedTranscript(payload, chunk.offsetSeconds)
      console.log(`   -> Got ${norm.length} segments from ASR`)
      rawSegments.push(...norm)
    }

    const maximumTimeMs = Math.round(durationSeconds * 1_000)
    const timelineSegments = rawSegments
      .filter((s) => s.startMs < maximumTimeMs)
      .map((s) => ({ ...s, endMs: Math.min(s.endMs, maximumTimeMs) }))
      .filter((s) => s.endMs > s.startMs)
      .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)

    console.log(`Total valid timeline segments: ${timelineSegments.length}`)

    // 2. Enrich with Furigana, Bunsetsu chunks, Romaji, and Vietnamese translations
    console.log('Enriching segments with Furigana & Bunsetsu Chunks...')
    await dictionary.enrichSegments(timelineSegments)

    // 3. Save new Machine Transcript version
    console.log('Saving to database...')
    const transcript = await store.saveMachineTranscript({
      mediaAssetId: asset.id,
      provider: 'local_whisper:large-v3-pure-audio',
      segments: timelineSegments,
    })

    await pool.query(
      "update media_assets set processing_status = 'ready', error_code = null, error_message = null, updated_at = now() where id = $1",
      [asset.id]
    )

    console.log(
      `✅ SUCCESS! Saved transcript version ${transcript?.id} with ${transcript?.segments?.length} segments for "${asset.title}".`
    )
    if (transcript?.segments?.length) {
      console.log('\nSample output (first 4 segments):')
      for (const seg of transcript.segments.slice(0, 4)) {
        console.log(` [${(seg.startMs / 1000).toFixed(2)}s - ${(seg.endMs / 1000).toFixed(2)}s] "${seg.textJa}"`)
        console.log(`   Tokens:`, (seg.tokens || []).map((t) => `${t.surface}(${t.startMs}-${t.endMs}ms)`).join(', '))
        if (seg.chunks) {
          console.log(
            `   Chunks:`,
            seg.chunks.map((c) => `${c.text}[${c.romaji}](${c.startMs}-${c.endMs}ms)`).join(' | ')
          )
        }
      }
    }
  } finally {
    await removeExtractedAudio(directory)
  }
}

await pool.end()
console.log('\nAll done!')
process.exit(0)
