import { apiClient, apiPaths, requestApi, unwrapApiData } from '../../lib/apiClient'
import type {
  MediaAsset,
  MediaProcessingJob,
  ShadowingAttempt,
  ShadowingEvaluationResult,
  ShadowingSession,
  TranscriptVersion,
  UploadProgress,
} from './videoTypes'

type UploadSession = {
  uploadUrl: string
  method: 'PUT'
  maxUploadBytes: number
  acceptedMimeTypes: string[]
}

type UploadResult = { asset: MediaAsset; job: MediaProcessingJob }
export type PlaybackSession = { contentUrl: string; expiresInSeconds: number }

export function importYouTubeVideo(sourceUrl: string) {
  return requestApi<UploadResult>({ method: 'POST', url: apiPaths.video.youtubeImports, data: { sourceUrl } })
}

function titleFromFilename(name: string) {
  return name.replace(/\.[^.]+$/, '').trim() || 'Video tiếng Nhật'
}

export async function uploadLocalVideo(
  file: File,
  onProgress: (progress: UploadProgress) => void
): Promise<UploadResult> {
  const asset = await requestApi<MediaAsset>({
    method: 'POST',
    url: apiPaths.video.assets,
    data: {
      sourceType: 'user_upload',
      title: titleFromFilename(file.name),
      language: 'ja',
      rightsBasis: 'owned',
      originalFilename: file.name,
    },
  })
  const session = await requestApi<UploadSession>({ method: 'POST', url: apiPaths.video.uploadSession(asset.id) })
  if (file.size > session.maxUploadBytes) throw new Error('Video vượt quá dung lượng cho phép.')
  const response = await apiClient.put(session.uploadUrl, file, {
    timeout: 15 * 60 * 1000,
    headers: { 'content-type': file.type || 'application/octet-stream' },
    onUploadProgress: (event) => {
      const total = event.total || file.size
      onProgress({ loaded: event.loaded, total, percent: total ? Math.round((event.loaded / total) * 100) : 0 })
    },
  })
  return unwrapApiData<UploadResult>(response.data)
}

export function listMediaAssets() {
  return requestApi<{ items: MediaAsset[] }>({ method: 'GET', url: apiPaths.video.assets })
}

export function getMediaAsset(assetId: string) {
  return requestApi<MediaAsset>({ method: 'GET', url: apiPaths.video.asset(assetId) })
}

export function getMediaJobs(assetId: string) {
  return requestApi<{ items: MediaProcessingJob[] }>({ method: 'GET', url: apiPaths.video.jobs(assetId) })
}

export function retryMediaProcessing(assetId: string) {
  return requestApi<UploadResult>({ method: 'POST', url: apiPaths.video.retry(assetId) })
}

export function getTranscript(assetId: string) {
  return requestApi<TranscriptVersion>({ method: 'GET', url: apiPaths.video.transcript(assetId) })
}

export function createPlaybackSession(assetId: string) {
  return requestApi<PlaybackSession>({ method: 'POST', url: apiPaths.video.playbackSession(assetId) })
}

export function createShadowingSession(payload: {
  mediaAssetId: string
  transcriptVersionId?: string | null
  mode?: 'sequential' | 'random' | 'roleplay'
  selectedSpeakerLabel?: string | null
}) {
  return requestApi<{ session: ShadowingSession }>({
    method: 'POST',
    url: apiPaths.shadowing.sessions,
    data: payload,
  })
}

export function getShadowingSession(sessionId: string) {
  return requestApi<{ session: ShadowingSession; attempts: ShadowingAttempt[] }>({
    method: 'GET',
    url: apiPaths.shadowing.session(sessionId),
  })
}

export function advanceShadowingSession(sessionId: string, payload: { nextSequenceNo: number; isCompleted?: boolean }) {
  return requestApi<{ session: ShadowingSession }>({
    method: 'POST',
    url: apiPaths.shadowing.next(sessionId),
    data: payload,
  })
}

export function submitShadowingAttempt(
  sessionId: string,
  payload: {
    transcriptSegmentId: string
    referenceText: string
    referenceDurationMs: number
    durationMs: number
    attemptNo: number
    audioBase64: string
  }
) {
  return requestApi<ShadowingEvaluationResult>({
    method: 'POST',
    url: apiPaths.shadowing.attempts(sessionId),
    data: payload,
    timeout: 60_000, // Whisper ASR + DSP pitch analysis needs up to 30s on first load
  })
}

export function getShadowingAttempt(attemptId: string) {
  return requestApi<{ attempt: ShadowingAttempt }>({
    method: 'GET',
    url: apiPaths.shadowing.attempt(attemptId),
  })
}
