import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Headphones,
  HelpCircle,
  Loader2,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Square,
  Volume2,
  X,
} from 'lucide-react'
import { Button, Card, IconButton } from '../../components/ui'
import { advanceShadowingSession, createShadowingSession, submitShadowingAttempt } from './videoApi'
import type {
  MediaAsset,
  ShadowingEvaluationResult,
  ShadowingSession,
  TranscriptSegment,
  TranscriptVersion,
} from './videoTypes'
import PitchContourVisualizer from './PitchContourVisualizer'

function formatSeconds(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}

export default function ShadowingPracticePanel({
  video,
  transcript,
  activeSegment,
  onPlayNativeSnippet,
  onJumpToSegment,
  onClose,
}: {
  video: MediaAsset
  transcript: TranscriptVersion
  activeSegment: TranscriptSegment
  onPlayNativeSnippet: (segment: TranscriptSegment) => void
  onJumpToSegment: (segment: TranscriptSegment) => void
  onClose: () => void
}) {
  const [session, setSession] = useState<ShadowingSession | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [evaluationResult, setEvaluationResult] = useState<ShadowingEvaluationResult | null>(null)
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null)
  const [audioBySegmentId, setAudioBySegmentId] = useState<Record<string, string>>({})
  const [isPlayingUserAudio, setIsPlayingUserAudio] = useState(false)
  const [attemptCount, setAttemptCount] = useState(1)
  const [micError, setMicError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<number | null>(null)
  const userAudioPlayerRef = useRef<HTMLAudioElement | null>(null)

  const currentIndex = transcript.segments.findIndex((s) => s.id === activeSegment.id)
  const totalSegments = transcript.segments.length
  const isFirstSegment = currentIndex <= 0
  const isLastSegment = currentIndex >= totalSegments - 1
  const progressPercent = totalSegments > 0 ? Math.round(((currentIndex + 1) / totalSegments) * 100) : 0

  const [historyBySegmentId, setHistoryBySegmentId] = useState<Record<string, ShadowingEvaluationResult>>({})
  const [visitedSegmentIds, setVisitedSegmentIds] = useState<Set<string>>(() => new Set([activeSegment.id]))
  const [showFurigana, setShowFurigana] = useState(true)
  const [showTranslation, setShowTranslation] = useState(true)
  const numberBarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let mounted = true
    createShadowingSession({
      mediaAssetId: video.id,
      transcriptVersionId: transcript.id,
      mode: 'sequential',
    })
      .then((res) => {
        if (mounted) setSession(res.session)
      })
      .catch(() => {
        if (mounted) setMicError('Không thể tạo phiên luyện tập Shadowing.')
      })
    return () => {
      mounted = false
    }
  }, [video.id, transcript.id])

  useEffect(() => {
    const existing = historyBySegmentId[activeSegment.id]
    const existingAudio = audioBySegmentId[activeSegment.id] ?? null
    setEvaluationResult(existing ?? null)
    setRecordedAudioUrl(existingAudio)
    setIsPlayingUserAudio(false)
    setAttemptCount(existing ? 2 : 1)
    setMicError(null)
    setIsRecording(false)
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    setRecordingSeconds(0)

    // Mark this segment as visited
    setVisitedSegmentIds((prev) => {
      if (prev.has(activeSegment.id)) return prev
      const next = new Set(prev)
      next.add(activeSegment.id)
      return next
    })

    const activeBtn = numberBarRef.current?.querySelector<HTMLElement>(`.sentence-num-btn.is-active`)
    if (activeBtn && numberBarRef.current) {
      const bar = numberBarRef.current
      // Use getBoundingClientRect for reliable scroll-to-center positioning
      const barRect = bar.getBoundingClientRect()
      const btnRect = activeBtn.getBoundingClientRect()
      const targetLeft = bar.scrollLeft + (btnRect.left - barRect.left) - barRect.width / 2 + btnRect.width / 2
      bar.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' })
    }
  }, [activeSegment.id, historyBySegmentId, audioBySegmentId])

  const actionsRef = useRef({
    onPlayNativeSnippet,
    startRecording,
    stopRecording,
    handleNext,
    handlePrev,
    isRecording,
    isEvaluating,
    isLastSegment,
    isFirstSegment,
    activeSegment,
  })

  actionsRef.current = {
    onPlayNativeSnippet,
    startRecording,
    stopRecording,
    handleNext,
    handlePrev,
    isRecording,
    isEvaluating,
    isLastSegment,
    isFirstSegment,
    activeSegment,
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return

      const {
        onPlayNativeSnippet: playNative,
        startRecording: startRec,
        stopRecording: stopRec,
        handleNext: goNext,
        handlePrev: goPrev,
        isRecording: rec,
        isEvaluating: evalState,
        isLastSegment: last,
        isFirstSegment: first,
        activeSegment: seg,
      } = actionsRef.current

      if (e.code === 'Space') {
        e.preventDefault()
        playNative(seg)
      } else if (e.code === 'Enter') {
        e.preventDefault()
        if (rec) {
          stopRec()
        } else if (!evalState) {
          void startRec()
        }
      } else if ((e.code === 'ArrowRight' && e.shiftKey) || e.code === 'Tab') {
        e.preventDefault()
        if (!last) void goNext()
      } else if (e.code === 'ArrowLeft' && e.shiftKey) {
        e.preventDefault()
        if (!first) goPrev()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  async function startRecording() {
    setMicError(null)
    setEvaluationResult(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        const audioUrl = URL.createObjectURL(audioBlob)
        setRecordedAudioUrl(audioUrl)
        setAudioBySegmentId((prev) => ({ ...prev, [activeSegment.id]: audioUrl }))
        setIsPlayingUserAudio(false)
        stream.getTracks().forEach((track) => track.stop())
        await handleEvaluateAttempt(audioBlob)
      }

      recorder.start(100)
      setIsRecording(true)
      setRecordingSeconds(0)
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1)
      }, 1000)
    } catch {
      setMicError('Không thể truy cập microphone. Vui lòng cấp quyền micro cho trình duyệt.')
      setIsRecording(false)
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    }
  }

  async function handleEvaluateAttempt(blob: Blob) {
    if (!session) return
    setIsEvaluating(true)
    try {
      const reader = new FileReader()
      reader.readAsDataURL(blob)
      reader.onloadend = async () => {
        const base64Audio = reader.result as string
        const durationMs = recordingSeconds * 1000 || activeSegment.endMs - activeSegment.startMs
        try {
          const result = await submitShadowingAttempt(session.id, {
            transcriptSegmentId: activeSegment.id,
            referenceText: activeSegment.textJa,
            referenceDurationMs: activeSegment.endMs - activeSegment.startMs,
            durationMs,
            attemptNo: attemptCount,
            audioBase64: base64Audio,
          })
          setEvaluationResult(result)
          setHistoryBySegmentId((prev) => ({ ...prev, [activeSegment.id]: result }))
        } catch {
          setMicError('Không thể gửi bài thu âm lên máy chủ chấm điểm.')
        } finally {
          setIsEvaluating(false)
        }
      }
    } catch {
      setIsEvaluating(false)
    }
  }

  function togglePlayUserAudio() {
    if (!userAudioPlayerRef.current || !recordedAudioUrl) return
    if (isPlayingUserAudio) {
      userAudioPlayerRef.current.pause()
      setIsPlayingUserAudio(false)
    } else {
      userAudioPlayerRef.current.currentTime = 0
      void userAudioPlayerRef.current.play().catch(() => undefined)
      setIsPlayingUserAudio(true)
    }
  }

  function handleRetry() {
    setAttemptCount((prev) => prev + 1)
    setEvaluationResult(null)
    setIsPlayingUserAudio(false)
    setRecordingSeconds(0)
    onPlayNativeSnippet(activeSegment)
  }

  async function handleNext() {
    if (currentIndex >= 0 && currentIndex < transcript.segments.length - 1) {
      const nextSeg = transcript.segments[currentIndex + 1]
      if (nextSeg) {
        onJumpToSegment(nextSeg)
        if (session) {
          await advanceShadowingSession(session.id, {
            nextSequenceNo: nextSeg.sequenceNo,
            isCompleted: currentIndex + 1 === transcript.segments.length - 1,
          }).catch(() => undefined)
        }
      }
    }
  }

  function handlePrev() {
    if (currentIndex > 0) {
      const prevSeg = transcript.segments[currentIndex - 1]
      if (prevSeg) onJumpToSegment(prevSeg)
    }
  }

  const overallScore = evaluationResult?.evaluation?.overallScore ?? 0
  return (
    <Card
      padding="md"
      className="shadowing-practice-card"
      style={{
        border: '1px solid var(--color-border, #e2e8f0)',
        background: 'var(--color-surface, #ffffff)',
        boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.06)',
        color: 'var(--color-text, #0f172a)',
        borderRadius: '16px',
      }}
    >
      {/* ── Top Progress & Action Bar ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
              Đã hoàn thành {currentIndex + 1} / {totalSegments} ({progressPercent}%)
            </div>
            <div
              style={{
                width: '200px',
                height: '6px',
                background: 'var(--color-border, #e2e8f0)',
                borderRadius: '3px',
                marginTop: '6px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  background: '#10b981',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onPlayNativeSnippet(activeSegment)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontWeight: 600,
                color: 'var(--color-text, #0f172a)',
              }}
              title="Phím tắt: Space"
            >
              <Volume2 size={15} /> Phát lại <small style={{ opacity: 0.7, marginLeft: '2px' }}>Space</small>
            </Button>

            {!isRecording && !isEvaluating && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => void startRecording()}
                style={{
                  background: '#10b981',
                  color: '#ffffff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontWeight: 700,
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                }}
                title="Phím tắt: Enter"
              >
                <Mic size={15} /> Kiểm tra phát âm <small style={{ opacity: 0.85, marginLeft: '2px' }}>Enter</small>
              </Button>
            )}

            {isRecording && (
              <Button
                variant="danger"
                size="sm"
                onClick={stopRecording}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700 }}
              >
                <Square size={14} /> Dừng ({formatSeconds(recordingSeconds)}){' '}
                <small style={{ marginLeft: '2px' }}>Enter</small>
              </Button>
            )}

            {isEvaluating && (
              <Button
                variant="secondary"
                size="sm"
                disabled
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Loader2 size={15} className="animate-spin" /> Đang chấm điểm…
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrev}
              disabled={isFirstSegment}
              style={{ padding: '0 8px', color: 'var(--color-text, #0f172a)' }}
              title="Phím tắt: Shift + Left"
            >
              <ChevronLeft size={16} /> Trước
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleNext}
              disabled={isLastSegment}
              style={{ padding: '0 8px', fontWeight: 600, color: 'var(--color-text, #0f172a)' }}
              title="Phím tắt: Tab hoặc Shift + Right"
            >
              Tiếp <ChevronRight size={16} />
            </Button>

            <IconButton label="Đóng panel" onClick={onClose}>
              <X size={17} />
            </IconButton>
          </div>
        </div>

        {/* ── Sentence Number Bar Carousel (Corodomo Style) ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            marginTop: '0.25rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--color-border, #e2e8f0)',
          }}
        >
          <span
            style={{
              fontSize: '0.8rem',
              fontWeight: 800,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              flexShrink: 0,
            }}
          >
            CÂU:
          </span>
          <div
            ref={numberBarRef}
            style={{
              display: 'flex',
              gap: '0.4rem',
              overflowX: 'auto',
              padding: '4px 2px',
              scrollbarWidth: 'thin',
              flex: 1,
            }}
          >
            {transcript.segments.map((seg, idx) => {
              const isActive = seg.id === activeSegment.id
              const res = historyBySegmentId[seg.id]
              const score = res?.evaluation?.overallScore
              const passed = score !== undefined && score >= 70
              const isVisited = visitedSegmentIds.has(seg.id)

              let bg = 'var(--color-bg-subtle, #f1f5f9)'
              let color = 'var(--color-text, #334155)'
              let border = '1px solid var(--color-border, #e2e8f0)'
              let shadow = 'none'

              if (isActive) {
                bg = '#10b981'
                color = '#ffffff'
                border = '1px solid #10b981'
                shadow = '0 2px 8px rgba(16, 185, 129, 0.35)'
              } else if (res) {
                if (passed) {
                  bg = '#dcfce7'
                  color = '#15803d'
                  border = '1px solid #86efac'
                } else {
                  bg = '#fef9c3'
                  color = '#a16207'
                  border = '1px solid #fde047'
                }
              } else if (isVisited) {
                // Visited but not yet scored — subtle blue tint
                bg = '#eff6ff'
                color = '#2563eb'
                border = '1px solid #bfdbfe'
              }

              return (
                <button
                  key={seg.id}
                  type="button"
                  className={`sentence-num-btn ${isActive ? 'is-active' : ''}`}
                  onClick={() => onJumpToSegment(seg)}
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    background: bg,
                    color: color,
                    border,
                    boxShadow: shadow,
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}
                  title={`Câu ${idx + 1}${score !== undefined ? ` (Điểm: ${score}%)` : ''}`}
                >
                  {idx + 1}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {micError && (
        <div
          style={{
            padding: '0.75rem 1rem',
            background: '#fee2e2',
            color: '#b91c1c',
            border: '1px solid #fca5a5',
            borderRadius: '8px',
            marginBottom: '1rem',
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'center',
            fontWeight: 500,
            fontSize: '0.9rem',
          }}
        >
          <AlertCircle size={18} />
          <span>{micError}</span>
        </div>
      )}

      {/* ── Target Sentence Header with Toggles ── */}
      <div
        style={{
          background: 'var(--color-bg-subtle, #f8fafc)',
          padding: '1.25rem 1.5rem',
          borderRadius: '14px',
          border: '1.5px solid var(--color-border, #e2e8f0)',
          marginBottom: '1.25rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.65rem',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 800,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            CÂU HIỆN TẠI
          </span>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onPlayNativeSnippet(activeSegment)}
              style={{ fontSize: '0.75rem', padding: '3px 10px', fontWeight: 600 }}
            >
              <Volume2 size={13} /> Audio
            </Button>
            <Button
              variant={showFurigana ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setShowFurigana((prev) => !prev)}
              style={{
                fontSize: '0.75rem',
                padding: '3px 10px',
                fontWeight: 600,
                background: showFurigana ? '#10b981' : undefined,
                color: showFurigana ? '#ffffff' : undefined,
              }}
            >
              あ Furigana
            </Button>
            <Button
              variant={showTranslation ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setShowTranslation((prev) => !prev)}
              style={{
                fontSize: '0.75rem',
                padding: '3px 10px',
                fontWeight: 600,
                background: showTranslation ? '#10b981' : undefined,
                color: showTranslation ? '#ffffff' : undefined,
              }}
            >
              Dịch
            </Button>
          </div>
        </div>

        {/* Japanese Furigana Text */}
        <div
          style={{
            fontSize: '1.9rem',
            fontWeight: 700,
            fontFamily: 'var(--font-jp, "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif)',
            color: 'var(--color-text, #0f172a)',
            lineHeight: 1.85,
          }}
        >
          {showFurigana && activeSegment.textFurigana && activeSegment.textFurigana.includes('<ruby>') ? (
            <span
              dangerouslySetInnerHTML={{
                __html: activeSegment.textFurigana.replaceAll(
                  '<rt>',
                  '<rt style="font-size: 0.85rem; font-weight: 600; color: #059669; letter-spacing: 0.02em;">'
                ),
              }}
            />
          ) : (
            <span>{activeSegment.textJa}</span>
          )}
        </div>

        {/* Vietnamese Translation Line */}
        {showTranslation && activeSegment.textVi && (
          <div
            style={{
              color: '#334155',
              fontSize: '1.1rem',
              marginTop: '0.5rem',
              lineHeight: 1.4,
              fontWeight: 500,
              borderTop: '1px solid var(--color-border, #e2e8f0)',
              paddingTop: '0.5rem',
            }}
          >
            {activeSegment.textVi}
          </div>
        )}
      </div>

      {!evaluationResult ? (
        <div
          style={{
            textAlign: 'center',
            padding: '1.75rem 1rem',
            color: '#64748b',
            fontSize: '0.95rem',
            background: 'var(--color-bg-subtle, #f8fafc)',
            borderRadius: '12px',
            border: '1px dashed var(--color-border, #cbd5e1)',
          }}
        >
          Bấm <strong style={{ color: '#059669' }}>Enter</strong> (hoặc nút "Kiểm tra phát âm") để thu âm, bấm{' '}
          <strong style={{ color: 'var(--color-text, #0f172a)' }}>Space</strong> để nghe câu thoại mẫu.
        </div>
      ) : (
        <div
          style={{
            background: 'var(--color-bg-subtle, #f8fafc)',
            padding: '1.25rem 1.5rem',
            borderRadius: '16px',
            border: '1.5px solid var(--color-border, #e2e8f0)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.15rem',
          }}
        >
          {/* Top Score Summary Banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--color-surface, #ffffff)',
              padding: '1.1rem 1.35rem',
              borderRadius: '14px',
              border: '1px solid var(--color-border, #e2e8f0)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
            }}
          >
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text, #0f172a)' }}>
                Điểm trung bình
              </div>
              <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>
                Trung bình của tất cả các tiêu chí
              </div>
            </div>
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <div
                style={{
                  fontSize: '2.75rem',
                  fontWeight: 900,
                  color: overallScore >= 80 ? '#16a34a' : overallScore >= 50 ? '#d97706' : '#dc2626',
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                }}
              >
                {overallScore}
              </div>
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  marginTop: '4px',
                  color:
                    overallScore >= 90
                      ? '#16a34a'
                      : overallScore >= 70
                        ? '#15803d'
                        : overallScore >= 50
                          ? '#d97706'
                          : '#dc2626',
                }}
              >
                {overallScore >= 90 ? 'Xuất sắc' : overallScore >= 70 ? 'Tốt' : 'Cần cố gắng'}
              </span>
            </div>
          </div>

          {/* 4 Score Metrics Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '0.75rem',
            }}
          >
            <div
              style={{
                background: '#eff6ff',
                padding: '0.85rem 1rem',
                borderRadius: '12px',
                border: '1px solid #bfdbfe',
              }}
            >
              <div style={{ fontSize: '0.8rem', color: '#1e40af', fontWeight: 700 }}>Điểm phát âm</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#2563eb', marginTop: '4px' }}>
                {evaluationResult.evaluation.pronunciationScore ?? evaluationResult.evaluation.contentScore ?? 0}
              </div>
            </div>

            <div
              style={{
                background: '#f0fdf4',
                padding: '0.85rem 1rem',
                borderRadius: '12px',
                border: '1px solid #bbf7d0',
              }}
            >
              <div style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 700 }}>Độ chính xác</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#16a34a', marginTop: '4px' }}>
                {evaluationResult.evaluation.accuracyScore ?? evaluationResult.evaluation.contentScore ?? 0}
              </div>
            </div>

            <div
              style={{
                background: '#faf5ff',
                padding: '0.85rem 1rem',
                borderRadius: '12px',
                border: '1px solid #e9d5ff',
              }}
            >
              <div style={{ fontSize: '0.8rem', color: '#6b21a8', fontWeight: 700 }}>Độ trôi chảy</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#7c3aed', marginTop: '4px' }}>
                {evaluationResult.evaluation.fluencyScore ?? evaluationResult.evaluation.timingScore ?? 0}
              </div>
            </div>

            <div
              style={{
                background: '#fffbeb',
                padding: '0.85rem 1rem',
                borderRadius: '12px',
                border: '1px solid #fde68a',
              }}
            >
              <div style={{ fontSize: '0.8rem', color: '#92400e', fontWeight: 700 }}>Độ hoàn thiện</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#d97706', marginTop: '4px' }}>
                {evaluationResult.evaluation.completenessScore ?? 100}
              </div>
            </div>
          </div>

          {/* Section: Văn bản & So sánh âm thanh (Matches Image 2) */}
          <div
            style={{
              background: 'var(--color-surface, #ffffff)',
              padding: '1.1rem 1.25rem',
              borderRadius: '14px',
              border: '1px solid var(--color-border, #e2e8f0)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.75rem',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <span
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Văn bản nhận diện & So sánh giọng đọc
              </span>

              {/* Audio Listen Buttons */}
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onPlayNativeSnippet(activeSegment)}
                  style={{
                    fontSize: '0.78rem',
                    padding: '4px 10px',
                    fontWeight: 700,
                    borderRadius: '8px',
                  }}
                  title="Nghe lại câu thoại mẫu của nhân vật (Phím Space)"
                >
                  <Volume2 size={14} style={{ color: '#059669' }} /> Mẫu
                </Button>

                {recordedAudioUrl && (
                  <Button
                    variant={isPlayingUserAudio ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={togglePlayUserAudio}
                    style={{
                      fontSize: '0.78rem',
                      padding: '4px 12px',
                      fontWeight: 700,
                      borderRadius: '8px',
                      background: isPlayingUserAudio ? '#2563eb' : '#eff6ff',
                      color: isPlayingUserAudio ? '#ffffff' : '#1d4ed8',
                      borderColor: '#bfdbfe',
                    }}
                    title="Bấm để nghe lại giọng đọc của chính bạn"
                  >
                    {isPlayingUserAudio ? <Pause size={14} /> : <Play size={14} />}
                    {isPlayingUserAudio ? 'Đang phát...' : 'Nghe giọng bạn'}
                  </Button>
                )}
              </div>
            </div>

            {/* Playable sentence line */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                padding: '0.85rem 1rem',
                background: 'var(--color-bg-subtle, #f8fafc)',
                borderRadius: '12px',
                border: '1px solid var(--color-border, #e2e8f0)',
              }}
            >
              {recordedAudioUrl ? (
                <button
                  type="button"
                  onClick={togglePlayUserAudio}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: isPlayingUserAudio ? '#2563eb' : '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
                    transition: 'all 0.15s ease',
                  }}
                  title="Bấm để nghe lại giọng của bạn"
                >
                  {isPlayingUserAudio ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: '2px' }} />}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onPlayNativeSnippet(activeSegment)}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'var(--color-bg-subtle, #e2e8f0)',
                    color: '#475569',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                  title="Nghe câu mẫu"
                >
                  <Volume2 size={18} />
                </button>
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '1.4rem',
                    fontWeight: 700,
                    fontFamily: 'var(--font-jp)',
                    lineHeight: 1.6,
                    color: 'var(--color-text, #0f172a)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '4px 6px',
                    alignItems: 'center',
                  }}
                >
                  {evaluationResult.evaluation.alignment && evaluationResult.evaluation.alignment.length > 0 ? (
                    evaluationResult.evaluation.alignment.map((token, idx) => {
                      const score =
                        token.score ?? (token.status === 'correct' ? 100 : token.status === 'mispronounced' ? 70 : 0)
                      const color = score >= 80 ? '#15803d' : score >= 60 ? '#d97706' : '#dc2626'
                      const bg = score >= 80 ? '#f0fdf4' : score >= 60 ? '#fefce8' : '#fef2f2'
                      const border = score >= 80 ? '#bbf7d0' : score >= 60 ? '#fde68a' : '#fecaca'

                      return (
                        <span
                          key={idx}
                          style={{
                            color,
                            background: bg,
                            borderBottom: `2px solid ${border}`,
                            padding: '1px 5px',
                            borderRadius: '4px',
                          }}
                          title={`Từ: ${token.surface || token.recognized} - Điểm: ${score}%`}
                        >
                          {token.surface || token.recognized}
                        </span>
                      )
                    })
                  ) : (
                    <span>{evaluationResult.attempt.recognizedText || activeSegment.textJa}</span>
                  )}
                </div>

                {activeSegment.textVi && (
                  <div style={{ fontSize: '0.92rem', color: '#64748b', marginTop: '4px' }}>{activeSegment.textVi}</div>
                )}
              </div>
            </div>
          </div>

          {/* Section: Chi tiết từng từ (Matches Image 2 chip badges) */}
          <div
            style={{
              background: 'var(--color-surface, #ffffff)',
              padding: '1.1rem 1.25rem',
              borderRadius: '14px',
              border: '1px solid var(--color-border, #e2e8f0)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.82rem',
                fontWeight: 800,
                color: '#64748b',
                marginBottom: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              <span>Chi tiết từng từ</span>
              <HelpCircle size={14} style={{ color: '#94a3b8' }} />
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              {evaluationResult.evaluation.alignment && evaluationResult.evaluation.alignment.length > 0 ? (
                evaluationResult.evaluation.alignment.map((token, idx) => {
                  const score =
                    token.score ?? (token.status === 'correct' ? 100 : token.status === 'mispronounced' ? 70 : 0)
                  const color = score >= 80 ? '#15803d' : score >= 60 ? '#d97706' : '#dc2626'
                  const bg = score >= 80 ? '#f0fdf4' : score >= 60 ? '#fffbeb' : '#fef2f2'
                  const border = score >= 80 ? '#86efac' : score >= 60 ? '#fde047' : '#fca5a5'

                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '10px',
                        background: bg,
                        border: `1.5px solid ${border}`,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                        transition: 'transform 0.15s ease',
                      }}
                      title={`Độ chính xác: ${score}% (${token.status})`}
                    >
                      <span
                        style={{
                          fontSize: '1.05rem',
                          fontWeight: 700,
                          fontFamily: 'var(--font-jp)',
                          color: '#0f172a',
                        }}
                      >
                        {token.surface || token.recognized}
                      </span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color }}>{score}</span>
                    </div>
                  )
                })
              ) : (
                <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Không có dữ liệu căn chỉnh từ.</div>
              )}
            </div>
          </div>

          {/* Section: Biểu đồ Pitch Contour */}
          {evaluationResult.evaluation.pitchContour && (
            <PitchContourVisualizer
              pitchContour={evaluationResult.evaluation.pitchContour}
              referenceText={activeSegment.textJa}
            />
          )}

          {/* Section: Gợi ý (AI Feedback - Matches Image 2) */}
          {evaluationResult.evaluation.feedback && (
            <div
              style={{
                background: '#f0f9ff',
                padding: '1rem 1.25rem',
                borderRadius: '14px',
                border: '1.5px solid #bae6fd',
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: '#0284c7',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: '1.1rem',
                }}
              >
                🤖
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0369a1', marginBottom: '4px' }}>
                  Gợi ý cải thiện
                </div>
                <div style={{ fontSize: '0.88rem', color: '#0c4a6e', lineHeight: 1.5 }}>
                  {evaluationResult.evaluation.feedback.summary ||
                    'Phát âm khá chuẩn xác! Hãy tiếp tục duy trì độ trôi chảy và ngữ điệu tự nhiên.'}
                </div>
                {evaluationResult.evaluation.feedback.tips && evaluationResult.evaluation.feedback.tips.length > 0 && (
                  <ul
                    style={{
                      margin: '6px 0 0 0',
                      paddingLeft: '1.2rem',
                      fontSize: '0.84rem',
                      color: '#0369a1',
                    }}
                  >
                    {evaluationResult.evaluation.feedback.tips.map((tip, idx) => (
                      <li key={idx} style={{ marginTop: '2px' }}>
                        {tip}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Bottom Actions Bar */}
          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'flex-end',
              flexWrap: 'wrap',
              borderTop: '1px solid var(--color-border, #e2e8f0)',
              paddingTop: '0.75rem',
            }}
          >
            <Button variant="secondary" size="sm" onClick={handleRetry} style={{ fontWeight: 700 }}>
              <RotateCcw size={14} /> Luyện tập lại câu này
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onPlayNativeSnippet(activeSegment)}
              style={{ fontWeight: 700 }}
            >
              <Volume2 size={14} /> Nghe mẫu (Space)
            </Button>
            {recordedAudioUrl && (
              <Button
                variant={isPlayingUserAudio ? 'primary' : 'secondary'}
                size="sm"
                onClick={togglePlayUserAudio}
                style={{ fontWeight: 700 }}
              >
                <Headphones size={14} /> {isPlayingUserAudio ? 'Dừng' : 'Nghe giọng bạn'}
              </Button>
            )}
            {!isLastSegment && (
              <Button variant="primary" size="sm" onClick={() => void handleNext()} style={{ fontWeight: 700 }}>
                Tiếp theo <ChevronRight size={14} />
              </Button>
            )}
          </div>
        </div>
      )}

      {recordedAudioUrl && (
        <audio
          ref={userAudioPlayerRef}
          src={recordedAudioUrl}
          onPlay={() => setIsPlayingUserAudio(true)}
          onPause={() => setIsPlayingUserAudio(false)}
          onEnded={() => setIsPlayingUserAudio(false)}
          style={{ display: 'none' }}
        />
      )}
    </Card>
  )
}
