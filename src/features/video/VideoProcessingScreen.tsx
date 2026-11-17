import { useEffect, useState } from 'react'
import { Button, Card, PageShell } from '../../components/ui'
import { getMediaAsset, getMediaJobs, getTranscript, retryMediaProcessing } from './videoApi'
import type { MediaAsset, MediaProcessingJob, TranscriptVersion } from './videoTypes'
import { ArrowLeft, CircleAlert, CircleCheck, LoaderCircle, Play, RotateCcw } from 'lucide-react'

export default function VideoProcessingScreen({
  video,
  onCancel,
  onReady,
}: {
  video: MediaAsset
  onCancel: () => void
  onReady: (asset: MediaAsset, transcript: TranscriptVersion) => void
}) {
  const [asset, setAsset] = useState(video)
  const [jobs, setJobs] = useState<MediaProcessingJob[]>([])
  const [transcript, setTranscript] = useState<TranscriptVersion | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [pollVersion, setPollVersion] = useState(0)

  useEffect(() => {
    let mounted = true
    let timer: number | undefined
    const refresh = async () => {
      let terminal = false
      try {
        const [nextAsset, nextJobs] = await Promise.all([getMediaAsset(video.id), getMediaJobs(video.id)])
        if (!mounted) return
        setAsset(nextAsset)
        setJobs(nextJobs.items)
        setRefreshError(null)
        terminal = nextAsset.processingStatus === 'failed' || nextAsset.processingStatus === 'cancelled'
        if (
          nextAsset.processingStatus === 'ready' ||
          nextJobs.items.some((job) => job.jobType === 'transcribe' && job.status === 'succeeded')
        ) {
          const nextTranscript = await getTranscript(video.id)
          if (mounted) setTranscript(nextTranscript)
          terminal = true
        }
      } catch {
        if (mounted) setRefreshError('Mất kết nối khi cập nhật tiến độ. Đang thử kết nối lại…')
      } finally {
        if (mounted && !terminal) timer = window.setTimeout(() => void refresh(), 2_000)
      }
    }
    void refresh()
    return () => {
      mounted = false
      window.clearTimeout(timer)
    }
  }, [video.id, pollVersion])

  const verification = jobs.find((job) => job.jobType === 'upload_verify')
  const transcription = jobs.find((job) => job.jobType === 'transcribe')
  const verified = verification?.status === 'succeeded' || asset.processingStatus === 'ready'
  const transcriptReady =
    Boolean(transcript) && (asset.processingStatus === 'ready' || transcription?.status === 'succeeded')
  const failedJob = asset.processingStatus === 'failed' ? jobs.find((job) => job.status === 'failed') : undefined
  const activeJob = jobs.find((job) => job.status === 'running') ?? jobs.find((job) => job.status === 'queued')
  const processingFailed = asset.processingStatus === 'failed' || Boolean(failedJob)
  const transcriptUnavailable = verified && !transcription && !processingFailed && !transcriptReady
  const jobLabel =
    activeJob?.jobType === 'youtube_download'
      ? 'Đang tải video YouTube'
      : activeJob?.jobType === 'upload_verify'
        ? 'Đang xác minh video'
        : activeJob?.jobType === 'transcribe'
          ? 'Đang tạo transcript'
          : 'Đang chuẩn bị video'
  const statusLabel = transcriptReady
    ? 'Transcript đã sẵn sàng'
    : processingFailed
      ? 'Xử lý thất bại'
      : transcriptUnavailable
        ? 'Đã xác minh — chờ cấu hình transcript'
        : jobLabel
  const description = transcriptReady
    ? 'Transcript tiếng Nhật với mốc thời gian và nhãn người nói đã sẵn sàng.'
    : processingFailed
      ? failedJob?.errorMessage || asset.errorMessage || 'Tác vụ xử lý video đã gặp lỗi.'
      : transcriptUnavailable
        ? 'Video đã xác minh xong. Transcript sẽ bắt đầu khi dịch vụ nhận diện giọng nói được cấu hình.'
        : activeJob?.jobType === 'youtube_download'
          ? 'Worker đang tải video từ YouTube và kiểm tra tệp trước khi chuẩn bị transcript.'
          : activeJob?.jobType === 'transcribe'
            ? 'Worker đang trích audio và tạo transcript tiếng Nhật. Bạn có thể để trang này mở hoặc quay lại sau.'
            : 'Worker đang xác minh định dạng và tính toàn vẹn của tệp video.'

  const retry = async () => {
    setRetrying(true)
    setRetryError(null)
    try {
      const result = await retryMediaProcessing(asset.id)
      setAsset(result.asset)
      setJobs((current) => [result.job, ...current.filter((job) => job.id !== result.job.id)])
      setPollVersion((value) => value + 1)
    } catch (error) {
      setRetryError(error instanceof Error ? error.message : 'Không thể thử lại tác vụ này.')
    } finally {
      setRetrying(false)
    }
  }

  return (
    <PageShell width="reading" className="video-processing-page">
      <Card padding="lg" className="video-processing-card">
        <span>VIDEO AI · CHUẨN BỊ PHIÊN HỌC</span>
        <h1>{asset.title}</h1>
        <p>{description}</p>
        {refreshError && <p role="status">{refreshError}</p>}
        {transcriptReady ? (
          <CircleCheck aria-hidden="true" size={32} />
        ) : processingFailed ? (
          <CircleAlert aria-hidden="true" size={32} />
        ) : (
          <LoaderCircle aria-hidden="true" className="video-processing-spinner" size={32} />
        )}
        <p aria-live="polite">Trạng thái: {statusLabel}</p>
        {transcriptUnavailable ? (
          <p className="video-processing-note">Video không bị đứng. Máy chủ chưa có khóa dịch vụ tạo transcript.</p>
        ) : null}
        {retryError ? (
          <p className="video-processing-error" role="alert">
            {retryError}
          </p>
        ) : null}
        {transcriptReady && transcript ? (
          <Button fullWidth onClick={() => onReady(asset, transcript)}>
            <Play aria-hidden="true" size={16} /> Bắt đầu học với video
          </Button>
        ) : null}
        {processingFailed ? (
          <Button fullWidth variant="secondary" disabled={retrying} onClick={() => void retry()}>
            <RotateCcw aria-hidden="true" size={16} /> {retrying ? 'Đang thử lại…' : 'Thử lại'}
          </Button>
        ) : null}
        <Button variant="ghost" fullWidth onClick={onCancel}>
          <ArrowLeft aria-hidden="true" size={16} /> Chọn video khác
        </Button>
      </Card>
    </PageShell>
  )
}
