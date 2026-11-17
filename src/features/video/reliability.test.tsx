// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import VideoProcessingScreen from './VideoProcessingScreen'
import VideoStudyPlayer from './VideoStudyPlayer'
import ShadowingPracticePanel from './ShadowingPracticePanel'
import { createPlaybackSession, createShadowingSession, getMediaAsset, getMediaJobs, getTranscript } from './videoApi'
import type { MediaAsset, TranscriptVersion } from './videoTypes'

vi.mock('./videoApi', () => ({
  getMediaAsset: vi.fn(),
  getMediaJobs: vi.fn(),
  getTranscript: vi.fn(),
  retryMediaProcessing: vi.fn(),
  createPlaybackSession: vi.fn(),
  createShadowingSession: vi.fn(),
  submitShadowingAttempt: vi.fn(),
  advanceShadowingSession: vi.fn(),
}))
const asset: MediaAsset = {
  id: 'audit-video',
  title: 'Lời chào',
  sourceType: 'user_upload',
  language: 'ja',
  rightsBasis: 'owned',
  sourceReference: null,
  originalFilename: 'hello.mp4',
  mimeType: 'video/mp4',
  byteSize: 10,
  durationMs: 1000,
  processingStatus: 'ready',
  errorCode: null,
  errorMessage: null,
  createdAt: '2026-11-17T00:00:00Z',
  updatedAt: '2026-11-17T00:00:00Z',
}
const transcript: TranscriptVersion = {
  id: 'audit-transcript',
  mediaAssetId: asset.id,
  version: 1,
  language: 'ja',
  source: 'machine',
  provider: 'test',
  status: 'ready',
  qualityScore: null,
  createdAt: asset.createdAt,
  updatedAt: asset.updatedAt,
  segments: [
    {
      id: 'hello',
      sequenceNo: 1,
      speakerLabel: null,
      speakerConfidence: null,
      startMs: 0,
      endMs: 1000,
      textJa: 'こんにちは',
      textVi: 'Xin chào',
      textFurigana: null,
      confidence: null,
      tokens: [],
    },
  ],
}

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})
describe('video audit regressions', () => {
  it.each(['ready', 'failed'] as const)('stops polling once the asset is %s', async (status) => {
    vi.useFakeTimers()
    vi.mocked(getMediaAsset).mockResolvedValue({ ...asset, processingStatus: status })
    vi.mocked(getMediaJobs).mockResolvedValue({ items: [] })
    vi.mocked(getTranscript).mockResolvedValue(transcript)
    render(<VideoProcessingScreen video={asset} onCancel={vi.fn()} onReady={vi.fn()} />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })
    expect(getMediaAsset).toHaveBeenCalledTimes(1)
    expect(getTranscript).toHaveBeenCalledTimes(status === 'ready' ? 1 : 0)
  })
  it('persists real notes and sentence bookmarks without invented AI or vocabulary', async () => {
    vi.mocked(createPlaybackSession).mockResolvedValue({ contentUrl: '/media', expiresInSeconds: 300 })
    const view = render(<VideoStudyPlayer video={asset} transcript={transcript} onBack={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /Tóm tắt AI/ })).toBeNull()
    expect(screen.queryByText('学校')).toBeNull()
    fireEvent.click(screen.getByTitle('Đánh dấu câu trên thiết bị này'))
    fireEvent.click(screen.getByRole('button', { name: 'Ghi chú' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Ghi chú thật của tôi' } })
    view.unmount()
    render(<VideoStudyPlayer video={asset} transcript={transcript} onBack={vi.fn()} />)
    expect(screen.getByTitle('Đã lưu câu')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ghi chú' }))
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Ghi chú thật của tôi')
  })
  it('does not intercept Tab or Enter on a focused button and releases microphone tracks on unmount', async () => {
    vi.mocked(createShadowingSession).mockResolvedValue({ session: { id: 'session' } } as Awaited<
      ReturnType<typeof createShadowingSession>
    >)
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', { value: vi.fn(), configurable: true })
    const stopTrack = vi.fn()
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] })
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
    class Recorder {
      state = 'inactive'
      onstop: null | (() => void) = null
      ondataavailable = null
      start() {
        this.state = 'recording'
      }
      stop() {
        this.state = 'inactive'
        this.onstop?.()
      }
    }
    vi.stubGlobal('MediaRecorder', Recorder)
    const jump = vi.fn()
    const view = render(
      <ShadowingPracticePanel
        video={asset}
        transcript={transcript}
        activeSegment={
          transcript.segments[0] ??
          (() => {
            throw new Error('Missing test sentence')
          })()
        }
        onPlayNativeSnippet={vi.fn()}
        onJumpToSegment={jump}
        onClose={vi.fn()}
      />
    )
    const replay = screen.getByRole('button', { name: /Phát lại/ })
    const tab = new KeyboardEvent('keydown', { code: 'Tab', key: 'Tab', bubbles: true, cancelable: true })
    replay.dispatchEvent(tab)
    expect(tab.defaultPrevented).toBe(false)
    fireEvent.keyDown(replay, { code: 'Enter', key: 'Enter' })
    expect(getUserMedia).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Kiểm tra phát âm/ }))
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce())
    view.unmount()
    expect(stopTrack).toHaveBeenCalledOnce()
    expect(jump).not.toHaveBeenCalled()
  })
})
