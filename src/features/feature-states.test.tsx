// @vitest-environment jsdom

import { fireEvent, render as rtlRender, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CoursesPage } from './learning/CoursesPage'
import { CourseLearningPage } from './learning/CourseLearningPage'
import { CourseAdminPage } from './learning/CourseAdminPage'
import ReviewPage from './srs/ReviewPage'
import VideoLearningPage from './video/VideoLearningPage'
import {
  createPlaybackSession,
  getMediaAsset,
  getMediaJobs,
  getTranscript,
  importYouTubeVideo,
  uploadLocalVideo,
} from './video/videoApi'

vi.mock('./video/videoApi', () => ({
  listMediaAssets: vi.fn().mockResolvedValue({ items: [] }),
  uploadLocalVideo: vi.fn(),
  getMediaAsset: vi.fn(),
  getMediaJobs: vi.fn().mockResolvedValue({ items: [] }),
  getTranscript: vi.fn(),
  createPlaybackSession: vi.fn(),
  importYouTubeVideo: vi.fn(),
}))

function render(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return rtlRender(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('API waiting states', () => {
  it('renders the SRS review page with KPI cards and category tabs', () => {
    render(<ReviewPage onDictionary={vi.fn()} />)

    expect(screen.getByText('Đã thành thạo')).toBeTruthy()
    expect(screen.getByText('Cần ôn hôm nay')).toBeTruthy()
    expect(screen.getByText('Trung bình thành thạo')).toBeTruthy()
  })

  it('shows the course catalog and management as API-backed empty states', () => {
    const { rerender } = render(<CoursesPage canManageCourses={false} onManage={vi.fn()} />)

    expect(screen.getByText('Chưa có khóa học')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Quản lý khóa học' })).toBeNull()

    rerender(<CoursesPage canManageCourses onManage={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Quản lý khóa học' })).toBeTruthy()

    render(<CourseLearningPage onBack={vi.fn()} />)
    expect(screen.getByText('Bài học đang chờ dữ liệu')).toBeTruthy()

    render(<CourseAdminPage onBack={vi.fn()} />)
    expect(screen.getByText('Quản lý khóa học đang chờ dữ liệu')).toBeTruthy()
  })

  it('rejects non-YouTube URLs without fabricating a Video AI lesson', () => {
    render(<VideoLearningPage />)

    expect(screen.getByRole('heading', { name: /Nhập video để bắt đầu/i })).toBeTruthy()
    expect(screen.queryByText(/dữ liệu học mẫu/i)).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'YouTube / URL' }))

    fireEvent.click(screen.getByRole('button', { name: 'Nhập YouTube' }))
    expect(screen.getByRole('alert').textContent).toContain('Đường dẫn video chưa hợp lệ.')

    fireEvent.change(screen.getByLabelText('Đường dẫn video'), {
      target: { value: 'https://cdn.example.test/lesson.mp4' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Nhập YouTube' }))

    expect(screen.getByRole('alert').textContent).toContain('Hiện chỉ hỗ trợ URL YouTube')
    expect(screen.queryByRole('heading', { name: 'cdn.example.test' })).toBeNull()
  })

  it('sends a supported YouTube URL to the local backend without fabricating a lesson', async () => {
    const asset = {
      id: 'youtube-asset',
      title: 'Đang nhập video YouTube',
      sourceType: 'youtube' as const,
      language: 'ja' as const,
      rightsBasis: 'owned' as const,
      sourceReference: 'https://www.youtube.com/watch?v=AbCdEF_1234',
      originalFilename: null,
      mimeType: null,
      byteSize: null,
      durationMs: null,
      processingStatus: 'processing' as const,
      errorCode: null,
      errorMessage: null,
      createdAt: '2026-08-22T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z',
    }
    vi.mocked(importYouTubeVideo).mockResolvedValue({
      asset,
      job: {} as never,
    })
    vi.mocked(getMediaAsset).mockResolvedValue(asset)
    render(<VideoLearningPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'YouTube / URL' }))
    fireEvent.change(screen.getByLabelText('Đường dẫn video'), {
      target: { value: 'https://youtu.be/AbCdEF_1234' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Nhập YouTube' }))

    expect(await screen.findByText(/Worker đang xác minh|Worker đang trích audio/i)).toBeTruthy()
    expect(importYouTubeVideo).toHaveBeenCalledWith('https://youtu.be/AbCdEF_1234')
  })

  it('moves to the real upload processing state after an owned video is accepted', async () => {
    const asset = {
      id: 'asset-1',
      title: 'lesson.mp4',
      sourceType: 'user_upload' as const,
      language: 'ja' as const,
      rightsBasis: 'owned' as const,
      sourceReference: null,
      originalFilename: 'lesson.mp4',
      mimeType: 'video/mp4',
      byteSize: 12,
      durationMs: null,
      processingStatus: 'queued' as const,
      errorCode: null,
      errorMessage: null,
      createdAt: '2026-08-22T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z',
    }
    vi.mocked(uploadLocalVideo).mockResolvedValue({
      asset,
      job: {
        id: 'job-1',
        mediaAssetId: asset.id,
        jobType: 'upload_verify',
        status: 'queued',
        attemptCount: 0,
        provider: null,
        input: {},
        output: {},
        errorCode: null,
        errorMessage: null,
        startedAt: null,
        finishedAt: null,
        createdAt: asset.createdAt,
        updatedAt: asset.updatedAt,
      },
    })
    vi.mocked(getMediaAsset).mockResolvedValue(asset)

    const { container } = render(<VideoLearningPage />)
    fireEvent.click(screen.getByRole('tab', { name: /Tệp cục bộ/i }))
    const input = container.querySelector('input[type="file"]')
    if (!(input instanceof HTMLInputElement)) throw new Error('Video file input is unavailable')
    fireEvent.change(input, {
      target: { files: [new File(['video-bytes'], 'lesson.mp4', { type: 'video/mp4' })] },
    })

    expect(await screen.findByRole('heading', { name: 'lesson.mp4' })).toBeTruthy()
    expect(screen.getByText(/Worker đang xác minh/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Chọn video khác' }))
    expect(screen.getByRole('heading', { name: /Nhập video để bắt đầu/i })).toBeTruthy()
  })

  it('opens the study player only after a persisted transcript is ready', async () => {
    const asset = {
      id: 'asset-ready',
      title: 'Hội thoại Nhật',
      sourceType: 'user_upload' as const,
      language: 'ja' as const,
      rightsBasis: 'owned' as const,
      sourceReference: null,
      originalFilename: 'dialogue.mp4',
      mimeType: 'video/mp4',
      byteSize: 12,
      durationMs: null,
      processingStatus: 'ready' as const,
      errorCode: null,
      errorMessage: null,
      createdAt: '2026-08-22T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z',
    }
    const transcript = {
      id: 'transcript-1',
      mediaAssetId: asset.id,
      version: 1,
      language: 'ja' as const,
      source: 'machine' as const,
      provider: 'openai',
      status: 'ready' as const,
      qualityScore: null,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
      segments: [
        {
          id: 'segment-1',
          sequenceNo: 1,
          speakerLabel: 'SPEAKER_00',
          speakerConfidence: 1,
          startMs: 0,
          endMs: 1_000,
          textJa: 'こんにちは',
          textFurigana: null,
          textVi: null,
          confidence: 1,
          tokens: [],
        },
      ],
    }
    vi.mocked(uploadLocalVideo).mockResolvedValue({ asset, job: {} as never })
    vi.mocked(getMediaAsset).mockResolvedValue(asset)
    vi.mocked(getTranscript).mockResolvedValue(transcript)
    vi.mocked(createPlaybackSession).mockResolvedValue({ contentUrl: '/signed-media-url', expiresInSeconds: 300 })
    vi.mocked(getMediaJobs).mockResolvedValue({
      items: [{ jobType: 'transcribe', status: 'succeeded' }] as never,
    })
    const { container } = render(<VideoLearningPage />)
    fireEvent.click(screen.getByRole('tab', { name: /Tệp cục bộ/i }))
    const input = container.querySelector('input[type="file"]')
    if (!(input instanceof HTMLInputElement)) throw new Error('Video file input is unavailable')
    fireEvent.change(input, { target: { files: [new File(['video-bytes'], 'dialogue.mp4', { type: 'video/mp4' })] } })

    expect(await screen.findByRole('button', { name: 'Bắt đầu học với video' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu học với video' }))
    expect(await screen.findByRole('heading', { name: 'Hội thoại Nhật' })).toBeTruthy()
    expect(screen.getAllByText('こんにちは').length).toBeGreaterThan(0)
  })
})
