import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  Play,
  Pause,
  Headphones,
  FileText,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Volume2,
} from 'lucide-react'
import { nhaikanjiApi } from './nhaikanjiApi'
import type { JlptSubmissionResult, JlptQuestion, JlptOption, JlptPart } from './nhaikanjiTypes'
import { Button, Badge } from '../../components/ui'

interface JlptExamTakingPageProps {
  examId: string
  onBack: () => void
}

// Dedicated Standalone Audio Player Component for Mondai & Question
function QuestionAudioPlayer({ url, label = 'Nghe âm thanh' }: { url: string; label?: string }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1.0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((e) => console.warn('Audio playback error:', e))
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const handleRate = (rate: number) => {
    setPlaybackRate(rate)
    if (audioRef.current) {
      audioRef.current.playbackRate = rate
    }
  }

  const formatTime = (sec?: number | null) => {
    if (sec === undefined || sec === null || isNaN(sec)) return '00:00'
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.5rem',
        background: isPlaying ? '#eef2ff' : '#f8fafc',
        border: `1.5px solid ${isPlaying ? '#6366f1' : '#cbd5e1'}`,
        borderRadius: '0.875rem',
        padding: '0.4rem 0.875rem',
        boxShadow: isPlaying ? '0 2px 8px rgba(99, 102, 241, 0.15)' : 'none',
        transition: 'all 0.15s ease',
        maxWidth: '100%',
      }}
    >
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={() => {
          if (audioRef.current) setCurrentTime(audioRef.current.currentTime)
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) setDuration(audioRef.current.duration)
        }}
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
      />

      <button
        type="button"
        onClick={togglePlay}
        style={{
          border: 'none',
          background: isPlaying ? '#4f46e5' : '#ffffff',
          color: isPlaying ? '#ffffff' : '#4f46e5',
          borderRadius: '50%',
          width: '2rem',
          height: '2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          flexShrink: 0,
        }}
        title={isPlaying ? 'Tạm dừng' : 'Bấm để nghe audio'}
      >
        {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
        <Volume2 size={15} color={isPlaying ? '#4f46e5' : '#64748b'} />
        <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: isPlaying ? '#3730a3' : '#1e293b' }}>
          {label}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flex: 1, minWidth: '120px' }}>
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          style={{ width: '100%', height: '4px', cursor: 'pointer', accentColor: '#4f46e5' }}
        />
        <span
          style={{ fontSize: '0.6875rem', color: '#64748b', fontFamily: 'var(--font-mono, monospace)', flexShrink: 0 }}
        >
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
        {[0.8, 1.0, 1.2].map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => handleRate(r)}
            style={{
              border: `1px solid ${playbackRate === r ? '#4f46e5' : '#cbd5e1'}`,
              background: playbackRate === r ? '#4f46e5' : '#ffffff',
              color: playbackRate === r ? '#ffffff' : '#475569',
              borderRadius: '0.375rem',
              padding: '0.15rem 0.4rem',
              fontSize: '0.6875rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {r}x
          </button>
        ))}
      </div>
    </div>
  )
}

// Certificate Component matching the user screenshot
function JlptCertificate({
  result,
  examTitle,
  userName = 'THÍ SINH ẨN DANH',
  onRetake,
  onBack,
}: {
  result: JlptSubmissionResult
  examTitle?: string | undefined
  userName?: string | undefined
  onRetake: () => void
  onBack: () => void
}) {
  const isPassed = result.passed
  const level = result.level || 'N3'
  const today = new Date().toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  const sec1 = result.sectionBreakdown?.section1 || {
    name: '言語知識(文字・語彙・文法)',
    nameVi: 'Từ vựng & Ngữ pháp',
    score: result.sectionalScores?.[0]?.scaledScore ?? 0,
    max: 60,
    minPass: 19,
    isFailed: result.sectionalScores?.[0]?.isBelowThreshold ?? false,
  }

  const sec2 = result.sectionBreakdown?.section2 || {
    name: '読解',
    nameVi: 'Đọc hiểu',
    score: result.sectionalScores?.[1]?.scaledScore ?? 0,
    max: 60,
    minPass: 19,
    isFailed: result.sectionalScores?.[1]?.isBelowThreshold ?? false,
  }

  const sec3 = result.sectionBreakdown?.section3 || {
    name: '聴解',
    nameVi: 'Nghe hiểu',
    score: result.sectionalScores?.[2]?.scaledScore ?? 0,
    max: 60,
    minPass: 19,
    isFailed: result.sectionalScores?.[2]?.isBelowThreshold ?? false,
  }

  const totalScore = result.scaledTotalScore ?? sec1.score + sec2.score + sec3.score
  const passScore = result.passScore180 ?? 95
  const cefr = result.cefrLevel || (isPassed ? 'B1' : 'Chưa đạt')

  const correctCount = result.correctCount
  const wrongCount = result.totalQuestions - correctCount

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        width: '100%',
        maxWidth: '900px',
        margin: '0 auto',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '1.5rem',
          border: `2px solid ${isPassed ? '#10b981' : '#f43f5e'}`,
          boxShadow: isPassed
            ? '0 10px 25px -5px rgba(16, 185, 129, 0.15)'
            : '0 10px 25px -5px rgba(244, 63, 94, 0.15)',
          padding: '2rem',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f1f5f9',
            paddingBottom: '1.25rem',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: '1rem',
              }}
            >
              言
            </div>
            <div>
              <span style={{ fontWeight: 900, fontSize: '1.25rem', letterSpacing: '0.05em', color: '#0f172a' }}>
                KOTODAMA
              </span>
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', fontWeight: 600 }}>
                {examTitle || '日本語能力試験 JLPT MOCK TEST'}
              </span>
            </div>
          </div>

          <div
            style={{
              textAlign: 'right',
              padding: '0.5rem 1rem',
              borderRadius: '0.875rem',
              border: `1px solid ${isPassed ? '#a7f3d0' : '#fecdd3'}`,
              background: isPassed ? '#ecfdf5' : '#fff1f2',
              color: isPassed ? '#065f46' : '#9f1239',
            }}
          >
            <div style={{ fontSize: '0.6875rem', fontWeight: 800, letterSpacing: '0.1em' }}>試験結果発表</div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700 }}>Kết quả bài thi</div>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '120px 1fr',
            gap: '1rem',
            alignItems: 'center',
            marginBottom: '1.5rem',
          }}
        >
          <div>
            <div style={{ fontSize: '0.625rem', color: '#64748b' }}>しめい</div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>氏名</div>
            <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>Họ tên</div>
          </div>
          <div
            style={{
              border: '1.5px solid #334155',
              borderRadius: '9999px',
              padding: '0.625rem 1.5rem',
              textAlign: 'center',
              fontWeight: 800,
              fontSize: '1.125rem',
              color: '#0f172a',
              letterSpacing: '0.05em',
            }}
          >
            {userName.toUpperCase()}
          </div>

          <div>
            <div style={{ fontSize: '0.625rem', color: '#64748b' }}>レベル</div>
            <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>Cấp độ</div>
          </div>
          <div
            style={{
              border: '1.5px solid #334155',
              borderRadius: '9999px',
              padding: '0.625rem 1.5rem',
              textAlign: 'center',
              fontWeight: 900,
              fontSize: '1.125rem',
              color: '#0f172a',
            }}
          >
            {level}
          </div>

          <div>
            <div style={{ fontSize: '0.625rem', color: '#64748b' }}>しけんけっか</div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>試験結果</div>
            <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>Kết quả thi</div>
          </div>
          <div
            style={{
              border: `1.5px solid ${isPassed ? '#15803d' : '#b91c1c'}`,
              borderRadius: '9999px',
              padding: '0.625rem 1.5rem',
              textAlign: 'center',
              fontWeight: 900,
              fontSize: '1.375rem',
              background: isPassed ? '#15803d' : '#fff1f2',
              color: isPassed ? '#ffffff' : '#b91c1c',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
            }}
          >
            <span>{isPassed ? '合格 Đỗ' : '不合格 Trượt'}</span>
            {isPassed && <span>🏆</span>}
          </div>
        </div>

        <div
          style={{
            border: '1px solid #cbd5e1',
            borderRadius: '1rem',
            overflow: 'hidden',
            display: 'grid',
            gridTemplateColumns: '1.5fr 1fr',
            background: '#ffffff',
          }}
        >
          <div style={{ borderRight: '1px solid #cbd5e1' }}>
            <div
              style={{
                padding: '0.75rem',
                textAlign: 'center',
                background: '#f8fafc',
                borderBottom: '1px solid #cbd5e1',
              }}
            >
              <div style={{ fontSize: '0.625rem', color: '#64748b' }}>とくてんくぶんべつとくてん</div>
              <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0f172a' }}>得点区分別得点</div>
              <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>Điểm đạt được từng phần</div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.875rem 1.25rem',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <div>
                <div style={{ fontSize: '0.625rem', color: '#64748b' }}>げんごちしき（もじ・ごい・ぶんぽう）</div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0f172a' }}>
                  言語知識(文字・語彙・文法)
                </div>
                <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>Từ vựng & Ngữ pháp</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: sec1.isFailed ? '#dc2626' : '#ea580c' }}>
                  {sec1.score}
                  <span style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 700 }}>/60</span>
                </div>
                <Badge
                  variant="outline"
                  style={{
                    fontSize: '0.625rem',
                    color: sec1.isFailed ? '#dc2626' : '#d97706',
                    borderColor: sec1.isFailed ? '#f87171' : '#fde68a',
                  }}
                >
                  {sec1.isFailed ? '⚠️ Liệt < 19' : '• Liệt < 19'}
                </Badge>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.875rem 1.25rem',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <div>
                <div style={{ fontSize: '0.625rem', color: '#64748b' }}>どっかい</div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0f172a' }}>読解</div>
                <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>Đọc hiểu</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: sec2.isFailed ? '#dc2626' : '#ea580c' }}>
                  {sec2.score}
                  <span style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 700 }}>/60</span>
                </div>
                <Badge
                  variant="outline"
                  style={{
                    fontSize: '0.625rem',
                    color: sec2.isFailed ? '#dc2626' : '#d97706',
                    borderColor: sec2.isFailed ? '#f87171' : '#fde68a',
                  }}
                >
                  {sec2.isFailed ? '⚠️ Liệt < 19' : '• Liệt < 19'}
                </Badge>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.875rem 1.25rem',
              }}
            >
              <div>
                <div style={{ fontSize: '0.625rem', color: '#64748b' }}>ちょうかい</div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0f172a' }}>聴解</div>
                <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>Nghe hiểu</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: sec3.isFailed ? '#dc2626' : '#ea580c' }}>
                  {sec3.score}
                  <span style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 700 }}>/60</span>
                </div>
                <Badge
                  variant="outline"
                  style={{
                    fontSize: '0.625rem',
                    color: sec3.isFailed ? '#dc2626' : '#d97706',
                    borderColor: sec3.isFailed ? '#f87171' : '#fde68a',
                  }}
                >
                  {sec3.isFailed ? '⚠️ Liệt < 19' : '• Liệt < 19'}
                </Badge>
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              background: '#fffdfa',
            }}
          >
            <div
              style={{
                padding: '0.75rem',
                textAlign: 'center',
                background: '#f8fafc',
                borderBottom: '1px solid #cbd5e1',
              }}
            >
              <div style={{ fontSize: '0.625rem', color: '#64748b' }}>そうごうとくてん</div>
              <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0f172a' }}>総合得点</div>
              <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>Tổng điểm</div>
            </div>

            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1.5rem 1rem',
                gap: '0.5rem',
              }}
            >
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#dc2626', lineHeight: 1 }}>{totalScore}</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#64748b' }}>180</div>
              <div style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 600, marginTop: '0.5rem' }}>
                • Điểm đỗ: {passScore}/180
              </div>
              <div style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                <span style={{ color: '#64748b' }}>Mức CEFR: </span>
                <span style={{ fontWeight: 800, color: isPassed ? '#4f46e5' : '#94a3b8' }}>{cefr}</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>{today}</div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '1rem',
        }}
      >
        <div
          style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '1rem',
            padding: '1rem',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534' }}>CÂU ĐÚNG</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#15803d', marginTop: '0.25rem' }}>
            {correctCount} / {result.totalQuestions}
          </div>
        </div>

        <div
          style={{
            background: '#fff1f2',
            border: '1px solid #fecdd3',
            borderRadius: '1rem',
            padding: '1rem',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9f1239' }}>CÂU SAI / CHƯA LÀM</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#e11d48', marginTop: '0.25rem' }}>
            {wrongCount}
          </div>
        </div>

        <div
          style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '1rem',
            padding: '1rem',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e40af' }}>TỶ LỆ CHÍNH XÁC</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#2563eb', marginTop: '0.25rem' }}>
            {result.scorePercentage}%
          </div>
        </div>
      </div>

      <div
        style={{
          padding: '1rem 1.5rem',
          borderRadius: '1rem',
          background: isPassed ? '#f0fdf4' : '#fff1f2',
          border: `1px solid ${isPassed ? '#86efac' : '#fecdd3'}`,
          color: isPassed ? '#166534' : '#9f1239',
          fontWeight: 800,
          textAlign: 'center',
          fontSize: '1rem',
        }}
      >
        {result.resultMessage || (isPassed ? 'CHÚC MỪNG! BẠN ĐÃ ĐỖ KỲ THI' : 'CHƯA ĐẠT! HÃY CỐ GẮNG HƠN')}
      </div>

      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginTop: '0.5rem' }}
      >
        <Button variant="secondary" onClick={onRetake}>
          <RotateCcw size={16} /> Làm lại bài thi
        </Button>
        <Button variant="primary" onClick={onBack}>
          <ArrowLeft size={16} /> Quay lại danh sách đề
        </Button>
      </div>
    </div>
  )
}

// 3 Standard JLPT Sections Interface
interface ExamSectionGroup {
  id: string
  title: string
  titleJP: string
  parts: JlptPart[]
  questionCount: number
}

export function JlptExamTakingPage({ examId, onBack }: JlptExamTakingPageProps) {
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [result, setResult] = useState<JlptSubmissionResult | null>(null)
  const [activeSectionIdx, setActiveSectionIdx] = useState(0)
  const [expandedScripts, setExpandedScripts] = useState<Record<string, boolean>>({})

  // Audio Player State for Main Exam Audio
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1.0)

  const { data: exam, isLoading } = useQuery({
    queryKey: ['nhaikanji', 'jlptExam', examId],
    queryFn: () => nhaikanjiApi.fetchJlptExamDetail(examId),
  })

  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = useCallback(async () => {
    if (isSubmitted || isSubmitting) return
    setIsSubmitting(true)
    try {
      const res = await nhaikanjiApi.submitJlptExam({
        examId,
        answers,
      })
      setResult(res)
      setIsSubmitted(true)
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause()
        setIsPlaying(false)
      }
      if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    } catch (err) {
      console.error('Submit error:', err)
    } finally {
      setIsSubmitting(false)
    }
  }, [answers, examId, isSubmitted, isSubmitting])

  const submitRef = useRef(handleSubmit)
  submitRef.current = handleSubmit

  // Initialize timer
  useEffect(() => {
    if (exam?.timeLimit && !isSubmitted && timeLeft === 0) {
      setTimeLeft(exam.timeLimit * 60)
    }
  }, [exam, isSubmitted, timeLeft])

  // Countdown interval
  useEffect(() => {
    if (timeLeft <= 0 || isSubmitted) return
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          void submitRef.current()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [timeLeft, isSubmitted])

  const handleSelectOption = (qKey: string, optIdx: number) => {
    if (isSubmitted) return
    setAnswers((prev) => ({ ...prev, [qKey]: optIdx }))
  }

  const handleRetake = () => {
    setAnswers({})
    setIsSubmitted(false)
    setResult(null)
    setExpandedScripts({})
    if (exam?.timeLimit) {
      setTimeLeft(exam.timeLimit * 60)
    }
    setActiveSectionIdx(0)
    if (audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.pause()
      setIsPlaying(false)
    }
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Audio Controls
  const togglePlayAudio = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((e) => console.warn('Audio play blocked:', e))
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate)
    if (audioRef.current) {
      audioRef.current.playbackRate = rate
    }
  }

  const seekTo = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds
      setCurrentTime(seconds)
      if (!isPlaying) {
        audioRef.current
          .play()
          .then(() => setIsPlaying(true))
          .catch((e) => console.warn('Audio play blocked:', e))
      }
    }
  }

  // Jump to a specific question
  const jumpToQuestion = (qNumber: number) => {
    const el = document.getElementById(`question-${qNumber}`)
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  // Group exam parts into 3 standard JLPT Sections
  const sections: ExamSectionGroup[] = useMemo(() => {
    if (!exam?.parts) return []

    if (!exam.isFullMock) {
      const count = exam.parts.reduce((acc, p) => acc + (p.questions?.length || 0), 0)
      return [
        {
          id: 'single_section',
          title: exam.sectionLabel || 'Phần thi',
          titleJP: exam.sectionLabelJP || '試験',
          parts: exam.parts,
          questionCount: count,
        },
      ]
    }

    const sec1Parts = exam.parts.filter(
      (p) => p.sectionType === 1 || p.title?.includes('Từ vựng') || p.titleJP?.includes('文字・語彙')
    )
    const sec2Parts = exam.parts.filter(
      (p) =>
        p.sectionType === 2 ||
        p.sectionType === 3 ||
        p.title?.includes('Ngữ pháp') ||
        p.title?.includes('Đọc hiểu') ||
        p.titleJP?.includes('文法') ||
        p.titleJP?.includes('読解')
    )
    const sec3Parts = exam.parts.filter(
      (p) => p.sectionType === 4 || p.title?.includes('Nghe hiểu') || p.titleJP?.includes('聴解')
    )

    const sec1Count = sec1Parts.reduce((acc, p) => acc + (p.questions?.length || 0), 0)
    const sec2Count = sec2Parts.reduce((acc, p) => acc + (p.questions?.length || 0), 0)
    const sec3Count = sec3Parts.reduce((acc, p) => acc + (p.questions?.length || 0), 0)

    return [
      {
        id: 'sec_vocab',
        title: '1. Từ vựng (文字・語彙)',
        titleJP: '言語知識（文字・語彙）',
        parts: sec1Parts.length > 0 ? sec1Parts : exam.parts.slice(0, 5),
        questionCount: sec1Count || 35,
      },
      {
        id: 'sec_grammar_reading',
        title: '2. Ngữ pháp & Đọc hiểu (文法・読解)',
        titleJP: '文法・読解',
        parts: sec2Parts.length > 0 ? sec2Parts : exam.parts.slice(5, 12),
        questionCount: sec2Count || 38,
      },
      {
        id: 'sec_listening',
        title: '3. Nghe hiểu (聴解)',
        titleJP: '聴解',
        parts: sec3Parts.length > 0 ? sec3Parts : exam.parts.slice(12),
        questionCount: sec3Count || 28,
      },
    ]
  }, [exam])

  const currentSection = sections[activeSectionIdx] || sections[0]

  if (isLoading || !exam) {
    return (
      <div className="nhaikanji-container" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <div style={{ color: '#64748b', fontWeight: 600 }}>Đang tải nội dung đề thi...</div>
      </div>
    )
  }

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  const formatAudioTime = (sec?: number | null) => {
    if (sec === undefined || sec === null || isNaN(sec)) return '00:00'
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const currentSectionQuestionsCount = currentSection?.parts
    ? currentSection.parts.reduce((acc, p) => acc + (p.questions?.length || 0), 0)
    : 0

  const currentSectionAnsweredCount = currentSection?.parts
    ? currentSection.parts.reduce((acc, p) => {
        return (
          acc +
          p.questions.filter((q: JlptQuestion, qIdx: number) => {
            const key = q.id || `p_${qIdx}`
            return answers[key] !== undefined
          }).length
        )
      }, 0)
    : 0

  return (
    <div className="nhaikanji-container">
      {/* Top Header & Sticky Status */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          background: 'var(--color-bg-surface, #ffffff)',
          border: '1px solid var(--color-border, #e2e8f0)',
          borderRadius: '1rem',
          padding: '1rem 1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft size={16} /> Quay lại
          </Button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Badge variant="primary" className="font-bold text-xs">
                {exam.level}
              </Badge>
              {exam.isFullMock && (
                <Badge variant="secondary" style={{ background: '#e0e7ff', color: '#4338ca', fontWeight: 800 }}>
                  180 ĐIỂM
                </Badge>
              )}
              <h1 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800, color: 'var(--color-text, #0f172a)' }}>
                {exam.title || `${exam.level} - ${exam.sectionLabel || 'Đề thi'}`}
              </h1>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.125rem' }}>
              {exam.sectionLabelJP} • {exam.sectionLabel}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {!isSubmitted && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                background: timeLeft < 300 ? '#fee2e2' : 'var(--color-bg-subtle, #f8fafc)',
                border: `1px solid ${timeLeft < 300 ? '#f87171' : 'var(--color-border, #cbd5e1)'}`,
                color: timeLeft < 300 ? '#dc2626' : 'var(--color-text, #334155)',
                fontWeight: 700,
                fontSize: '0.9375rem',
                fontFamily: 'var(--font-mono, monospace)',
              }}
            >
              <Clock size={16} />
              <span>{formattedTime}</span>
            </div>
          )}

          {!isSubmitted && (
            <Button variant="primary" size="sm" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Đang chấm điểm...' : 'Nộp bài thi'}
            </Button>
          )}

          {isSubmitted && (
            <Button variant="secondary" size="sm" onClick={handleRetake}>
              <RotateCcw size={16} /> Làm lại
            </Button>
          )}
        </div>
      </div>

      {/* 3 JLPT Standard Section Stepper / Tabs (Full Mock Mode) */}
      {sections.length > 1 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${sections.length}, 1fr)`,
            gap: '0.75rem',
            marginTop: '1rem',
          }}
        >
          {sections.map((sec, secIdx) => {
            const isActive = activeSectionIdx === secIdx
            const secQuestions = sec.parts.reduce((acc, p) => acc + (p.questions?.length || 0), 0)
            const secAnswered = sec.parts.reduce((acc, p) => {
              return (
                acc +
                p.questions.filter((q: JlptQuestion, qIdx: number) => {
                  const key = q.id || `p_${qIdx}`
                  return answers[key] !== undefined
                }).length
              )
            }, 0)
            const isDone = secAnswered === secQuestions && secQuestions > 0

            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => {
                  setActiveSectionIdx(secIdx)
                  if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
                    window.scrollTo({ top: 120, behavior: 'smooth' })
                  }
                }}
                style={{
                  padding: '0.875rem 1rem',
                  borderRadius: '0.875rem',
                  border: `2px solid ${isActive ? '#4f46e5' : isDone ? '#86efac' : '#e2e8f0'}`,
                  background: isActive ? '#eef2ff' : '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: isActive ? '0 4px 6px -1px rgba(79, 70, 229, 0.1)' : '0 1px 2px rgba(0,0,0,0.03)',
                  transition: 'all 0.15s ease',
                  textAlign: 'left',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 800, color: isActive ? '#3730a3' : '#1e293b' }}>
                    {sec.title}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: '#64748b', marginTop: '0.125rem' }}>{sec.titleJP}</div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <Badge
                    variant={isDone ? 'secondary' : isActive ? 'primary' : 'outline'}
                    style={{ fontSize: '0.6875rem', fontWeight: 700 }}
                  >
                    {isDone ? '✓ Đã xong' : `${secAnswered}/${secQuestions}`}
                  </Badge>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Global Sticky Audio Player for Exam Level Audio if provided */}
      {exam.audioUrl && (
        <div className="jlpt-audio-player" style={{ marginTop: '1rem' }}>
          <audio
            ref={audioRef}
            src={exam.audioUrl}
            onTimeUpdate={() => {
              if (audioRef.current) setCurrentTime(audioRef.current.currentTime)
            }}
            onLoadedMetadata={() => {
              if (audioRef.current) setDuration(audioRef.current.duration)
            }}
            onEnded={() => setIsPlaying(false)}
          />

          <div className="jlpt-audio-controls">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                className="jlpt-audio-seek-step-btn"
                onClick={() => seekTo(Math.max(0, currentTime - 10))}
                title="Tua lùi 10 giây"
              >
                -10s
              </button>

              <button
                type="button"
                className="jlpt-audio-play-btn"
                onClick={togglePlayAudio}
                title={isPlaying ? 'Tạm dừng' : 'Phát âm thanh'}
              >
                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
              </button>

              <button
                type="button"
                className="jlpt-audio-seek-step-btn"
                onClick={() => seekTo(Math.min(duration || 9999, currentTime + 10))}
                title="Tua tới 10 giây"
              >
                +10s
              </button>

              <div style={{ marginLeft: '0.25rem' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    color: 'var(--color-text, #0f172a)',
                  }}
                >
                  <Headphones size={15} className="text-indigo-600" />
                  <span>Âm thanh bài thi ({exam.level})</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'var(--font-mono, monospace)' }}>
                  {formatAudioTime(currentTime)} / {formatAudioTime(duration)}
                </div>
              </div>
            </div>

            <div className="jlpt-audio-progress-row">
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="jlpt-audio-slider"
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              {[0.8, 1.0, 1.2].map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`jlpt-audio-speed-btn${playbackRate === r ? ' is-active' : ''}`}
                  onClick={() => handleRateChange(r)}
                >
                  {r}x
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Official Certificate Result View on Submission */}
      {isSubmitted && result && (
        <div style={{ marginTop: '1.5rem' }}>
          <JlptCertificate result={result} examTitle={exam.title} onRetake={handleRetake} onBack={onBack} />
        </div>
      )}

      {/* Main Exam Section Layout with Question Palette */}
      <div
        className="jlpt-exam-taking-layout"
        style={{
          marginTop: isSubmitted ? '2rem' : '1.5rem',
        }}
      >
        {/* Left Column: Parts & Questions of the CURRENT Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {currentSection && currentSection.parts && currentSection.parts.length > 0 ? (
            currentSection.parts.map((part: JlptPart, pIdx: number) => {
              const partAudio = part.audioUrl || (part.questions && part.questions[0]?.audio)

              return (
                <div
                  key={part.id || pIdx}
                  style={{
                    background: 'var(--color-bg-surface, #ffffff)',
                    borderRadius: '1rem',
                    padding: '1.5rem',
                    border: '1px solid var(--color-border, #e2e8f0)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.25rem',
                  }}
                >
                  {/* Part Header */}
                  <div
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      paddingBottom: '0.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span
                          style={{
                            background: '#4f46e5',
                            color: '#ffffff',
                            fontWeight: 800,
                            fontSize: '0.75rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '0.375rem',
                          }}
                        >
                          Mondai {pIdx + 1}
                        </span>
                        <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 800, color: '#0f172a' }}>
                          {part.title || part.titleJP || `Phần ${pIdx + 1}`}
                        </h2>
                      </div>

                      {/* Mondai Audio Player if part has audio */}
                      {partAudio && (
                        <div style={{ minWidth: '260px' }}>
                          <QuestionAudioPlayer url={partAudio} label={`Audio Mondai ${pIdx + 1}`} />
                        </div>
                      )}
                    </div>

                    {part.instruction && (
                      <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748b', lineHeight: 1.5 }}>
                        {part.instruction}
                      </p>
                    )}
                  </div>

                  {/* Reading Comprehension Passage at Part level */}
                  {part.passage && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          color: '#4338ca',
                          background: '#e0e7ff',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '0.375rem',
                          width: 'fit-content',
                        }}
                      >
                        <span>📄 ĐOẠN VĂN / BÀI ĐỌC</span>
                      </div>
                      <div className="jlpt-reading-passage" dangerouslySetInnerHTML={{ __html: part.passage }} />
                    </div>
                  )}

                  {/* Questions List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {part.questions?.map((q: JlptQuestion, qIdx: number) => {
                      const qKey = q.id || `p${pIdx}_q${qIdx}`
                      const selectedOpt = answers[qKey]
                      const qResult = result?.questionResults?.find((r) => r.id === qKey || r.number === q.number)
                      const questionText = q.sentence || q.text || q.question || `Câu hỏi số ${q.number || qIdx + 1}`
                      const qAudio = q.audio || q.audioUrl || partAudio

                      const isLongOptions = (q.options || []).some((opt) => {
                        const text = typeof opt === 'string' ? opt : opt.text || String(opt.id)
                        return text.length > 12
                      })

                      const isListeningPart =
                        part.sectionType === 4 || activeSectionIdx === 2 || part.title?.includes('Nghe')

                      return (
                        <div
                          key={qKey}
                          id={`question-${q.number || qIdx + 1}`}
                          className={isListeningPart ? 'jlpt-question-card--listening' : ''}
                          style={{
                            padding: '1.25rem',
                            borderRadius: '0.875rem',
                            border: '1px solid',
                            borderColor: isSubmitted
                              ? qResult?.isCorrect
                                ? '#86efac'
                                : '#fda4af'
                              : 'var(--color-border, #e2e8f0)',
                            background: isSubmitted
                              ? qResult?.isCorrect
                                ? '#f0fdf4'
                                : '#fff1f2'
                              : 'var(--color-bg-subtle, #f8fafc)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem',
                          }}
                        >
                          {/* Reading Passage attached to Question */}
                          {q.passage && (
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem',
                                marginBottom: '0.5rem',
                              }}
                            >
                              <div
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.375rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  color: '#4338ca',
                                  background: '#e0e7ff',
                                  padding: '0.2rem 0.6rem',
                                  borderRadius: '0.375rem',
                                  width: 'fit-content',
                                }}
                              >
                                <span>📄 ĐOẠN VĂN / BÀI ĐỌC</span>
                              </div>
                              <div className="jlpt-reading-passage" dangerouslySetInnerHTML={{ __html: q.passage }} />
                            </div>
                          )}

                          {/* Question Header */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              justifyContent: 'space-between',
                              gap: '0.75rem',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                              <span
                                style={{
                                  width: '1.75rem',
                                  height: '1.75rem',
                                  borderRadius: '0.5rem',
                                  background: '#4f46e5',
                                  color: '#ffffff',
                                  fontWeight: 700,
                                  fontSize: '0.75rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                {q.number || qIdx + 1}
                              </span>
                              <div
                                className="jlpt-question-body"
                                style={{
                                  fontSize: '1rem',
                                  fontWeight: 500,
                                  fontFamily: 'var(--font-serif, "Fraunces", serif)',
                                  lineHeight: 1.6,
                                }}
                                dangerouslySetInnerHTML={{ __html: questionText }}
                              />
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              {/* Individual Question Audio Button (Always available in exam & result mode) */}
                              {qAudio ? <QuestionAudioPlayer url={qAudio} label="Nghe audio" /> : null}

                              {/* Global Audio Seek Button */}
                              {typeof q.audioStart === 'number' &&
                                exam.audioUrl &&
                                (() => {
                                  const isPlayingThisQ =
                                    isPlaying &&
                                    currentTime >= q.audioStart &&
                                    (typeof q.audioEnd === 'number'
                                      ? currentTime < q.audioEnd
                                      : currentTime < q.audioStart + 120)

                                  return (
                                    <button
                                      type="button"
                                      onClick={() => seekTo(q.audioStart ?? 0)}
                                      className={`jlpt-seek-btn${isPlayingThisQ ? ' is-playing' : ''}`}
                                      title="Nhảy trình phát audio đến câu này"
                                    >
                                      {isPlayingThisQ ? (
                                        <Headphones size={13} />
                                      ) : (
                                        <Play size={12} fill="currentColor" />
                                      )}
                                      <span>
                                        {isPlayingThisQ ? 'Đang phát' : 'Nghe câu này'} ({formatAudioTime(q.audioStart)}
                                        )
                                      </span>
                                    </button>
                                  )
                                })()}

                              {isSubmitted && qResult && (
                                <div>
                                  {qResult.isCorrect ? (
                                    <Badge variant="outline" className="text-emerald-600 border-emerald-300 font-bold">
                                      <CheckCircle2 size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />{' '}
                                      Đúng
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-rose-600 border-rose-300 font-bold">
                                      <XCircle size={14} style={{ display: 'inline', marginRight: '0.25rem' }} /> Sai
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Question Image (Constrained & Clean Frame) */}
                          {q.image && (
                            <div
                              style={{
                                maxWidth: '440px',
                                maxHeight: '240px',
                                margin: '0.5rem auto',
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: '0.75rem',
                                padding: '0.5rem',
                                textAlign: 'center',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                              }}
                            >
                              <img
                                src={q.image}
                                alt={`Minh họa câu ${q.number || qIdx + 1}`}
                                loading="lazy"
                                style={{
                                  maxHeight: '220px',
                                  maxWidth: '100%',
                                  objectFit: 'contain',
                                  display: 'block',
                                  margin: '0 auto',
                                  borderRadius: '0.5rem',
                                }}
                              />
                            </div>
                          )}

                          {/* Dynamic Options Grid / Vertical Stack */}
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: isLongOptions ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
                              gap: '0.75rem',
                            }}
                          >
                            {q.options?.map((opt: JlptOption | string, optIdx: number) => {
                              const optNumber = optIdx + 1
                              const optText = typeof opt === 'string' ? opt : opt.text || String(opt.id)
                              const isSelected = selectedOpt === optNumber
                              const isCorrectOption =
                                isSubmitted && String(q.correctAnswer ?? q.answer ?? 1) === String(optNumber)

                              return (
                                <div
                                  key={optIdx}
                                  role="button"
                                  tabIndex={isSubmitted ? -1 : 0}
                                  aria-pressed={isSelected}
                                  className={`jlpt-option-card${isSelected ? ' is-selected' : ''}${isCorrectOption ? ' is-correct' : ''}`}
                                  onClick={() => {
                                    if (isSubmitted) return
                                    const selection = window.getSelection()?.toString()
                                    if (selection && selection.trim().length > 0) return
                                    handleSelectOption(qKey, optNumber)
                                  }}
                                  onKeyDown={(e) => {
                                    if (!isSubmitted && (e.key === 'Enter' || e.key === ' ')) {
                                      e.preventDefault()
                                      handleSelectOption(qKey, optNumber)
                                    }
                                  }}
                                  style={{
                                    padding: isLongOptions ? '0.875rem 1.25rem' : '0.75rem 1rem',
                                    borderRadius: '0.75rem',
                                    textAlign: 'left',
                                    fontSize: isLongOptions ? '1rem' : '0.9375rem',
                                    lineHeight: 1.7,
                                    fontWeight: isSelected || isCorrectOption ? 700 : 500,
                                    cursor: isSubmitted ? 'text' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1rem',
                                    border: '1px solid',
                                    userSelect: 'text',
                                    WebkitUserSelect: 'text',
                                    borderColor: isCorrectOption
                                      ? '#4ade80'
                                      : isSelected
                                        ? '#4f46e5'
                                        : 'var(--color-border, #cbd5e1)',
                                    background: isCorrectOption
                                      ? '#dcfce7'
                                      : isSelected
                                        ? '#4f46e5'
                                        : 'var(--color-bg-surface, #ffffff)',
                                    color: isCorrectOption
                                      ? '#14532d'
                                      : isSelected
                                        ? '#ffffff'
                                        : 'var(--color-text, #334155)',
                                    boxShadow: isSelected ? '0 2px 4px rgba(79, 70, 229, 0.2)' : 'none',
                                    transition: 'all 0.15s ease',
                                  }}
                                >
                                  <span
                                    className="jlpt-option-number"
                                    style={{
                                      width: '1.75rem',
                                      height: '1.75rem',
                                      borderRadius: '50%',
                                      fontSize: '0.8125rem',
                                      fontWeight: 700,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexShrink: 0,
                                      userSelect: 'none',
                                      WebkitUserSelect: 'none',
                                      background: isSelected ? '#ffffff' : 'var(--color-bg-subtle, #f1f5f9)',
                                      color: isSelected ? '#4f46e5' : '#64748b',
                                      border: isSelected ? 'none' : '1px solid var(--color-border, #cbd5e1)',
                                    }}
                                  >
                                    {optNumber}
                                  </span>
                                  <span
                                    className="jlpt-option-text"
                                    style={{
                                      fontFamily: 'var(--font-serif, "Fraunces", serif)',
                                      flex: 1,
                                      userSelect: 'text',
                                      WebkitUserSelect: 'text',
                                      cursor: isSubmitted ? 'text' : 'pointer',
                                    }}
                                  >
                                    {optText}
                                  </span>
                                </div>
                              )
                            })}
                          </div>

                          {/* Detailed Explanation if available & submitted */}
                          {isSubmitted && q.explanation && (
                            <div
                              style={{
                                marginTop: '0.75rem',
                                padding: '1rem 1.25rem',
                                borderRadius: '0.75rem',
                                background: '#fffbeb',
                                border: '1px solid #fde68a',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.375rem',
                                  color: '#b45309',
                                  fontWeight: 800,
                                  fontSize: '0.875rem',
                                }}
                              >
                                <Lightbulb size={16} />
                                <span>Giải thích chi tiết & Dịch nghĩa</span>
                              </div>
                              <div
                                style={{
                                  fontSize: '0.875rem',
                                  color: '#78350f',
                                  lineHeight: 1.7,
                                  whiteSpace: 'pre-wrap',
                                }}
                              >
                                {q.explanation}
                              </div>
                            </div>
                          )}

                          {/* Listening Script & Situation Breakdown if submitted */}
                          {isSubmitted &&
                            (q.script || qResult?.script) &&
                            (() => {
                              const scriptContent = q.script || qResult?.script || ''
                              const scriptViContent = q.scriptVi || qResult?.scriptVi || ''
                              const isExpanded = expandedScripts[qKey] ?? true
                              const toggleExpand = () => {
                                setExpandedScripts((prev) => ({
                                  ...prev,
                                  [qKey]: !isExpanded,
                                }))
                              }

                              return (
                                <div
                                  style={{
                                    marginTop: '0.75rem',
                                    border: '1px solid #bfdbfe',
                                    background: '#eff6ff',
                                    borderRadius: '0.75rem',
                                    overflow: 'hidden',
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={toggleExpand}
                                    style={{
                                      width: '100%',
                                      padding: '0.625rem 1rem',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      background: '#dbeafe',
                                      border: 'none',
                                      cursor: 'pointer',
                                      color: '#1e40af',
                                      fontWeight: 700,
                                      fontSize: '0.875rem',
                                      textAlign: 'left',
                                    }}
                                  >
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <FileText size={16} />
                                      <span>Lời thoại bài nghe (Script)</span>
                                    </span>
                                    <span
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.25rem',
                                        fontSize: '0.75rem',
                                        color: '#2563eb',
                                      }}
                                    >
                                      {isExpanded ? 'Thu gọn' : 'Xem chi tiết'}
                                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </span>
                                  </button>

                                  {isExpanded && (
                                    <div
                                      style={{
                                        padding: '0.875rem 1rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.75rem',
                                      }}
                                    >
                                      <div>
                                        <div
                                          style={{
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            color: '#1e3a8a',
                                            marginBottom: '0.375rem',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                          }}
                                        >
                                          Tiếng Nhật
                                        </div>
                                        <div
                                          style={{
                                            fontFamily: 'var(--font-serif, "Fraunces", serif)',
                                            fontSize: '0.9375rem',
                                            lineHeight: 1.8,
                                            color: '#0f172a',
                                            whiteSpace: 'pre-wrap',
                                            background: '#ffffff',
                                            padding: '0.75rem 1rem',
                                            borderRadius: '0.5rem',
                                            border: '1px solid #bfdbfe',
                                          }}
                                        >
                                          {scriptContent}
                                        </div>
                                      </div>

                                      {scriptViContent && (
                                        <div>
                                          <div
                                            style={{
                                              fontSize: '0.75rem',
                                              fontWeight: 700,
                                              color: '#166534',
                                              marginBottom: '0.375rem',
                                              textTransform: 'uppercase',
                                              letterSpacing: '0.05em',
                                            }}
                                          >
                                            Dịch nghĩa tiếng Việt
                                          </div>
                                          <div
                                            style={{
                                              fontSize: '0.875rem',
                                              lineHeight: 1.7,
                                              color: '#166534',
                                              whiteSpace: 'pre-wrap',
                                              background: '#f0fdf4',
                                              padding: '0.75rem 1rem',
                                              borderRadius: '0.5rem',
                                              border: '1px solid #bbf7d0',
                                            }}
                                          >
                                            {scriptViContent}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )
                            })()}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          ) : (
            <div
              style={{
                background: 'var(--color-bg-surface, #ffffff)',
                borderRadius: '1rem',
                padding: '3rem 1rem',
                textAlign: 'center',
                color: '#64748b',
              }}
            >
              Chưa có câu hỏi nào trong phần thi này.
            </div>
          )}

          {/* Bottom Section Stepper Controls */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#ffffff',
              padding: '1rem 1.5rem',
              borderRadius: '1rem',
              border: '1px solid #e2e8f0',
              marginTop: '0.5rem',
            }}
          >
            <Button
              variant="secondary"
              size="sm"
              disabled={activeSectionIdx === 0}
              onClick={() => {
                setActiveSectionIdx((prev) => Math.max(0, prev - 1))
                if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
                  window.scrollTo({ top: 120, behavior: 'smooth' })
                }
              }}
            >
              <ChevronLeft size={16} /> Phần trước
            </Button>

            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#475569' }}>
              Phần {activeSectionIdx + 1}/{sections.length} • {currentSectionAnsweredCount}/
              {currentSectionQuestionsCount} câu
            </div>

            {activeSectionIdx < sections.length - 1 ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setActiveSectionIdx((prev) => Math.min(sections.length - 1, prev + 1))
                  if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
                    window.scrollTo({ top: 120, behavior: 'smooth' })
                  }
                }}
              >
                Sang {sections[activeSectionIdx + 1]?.title} <ChevronRight size={16} />
              </Button>
            ) : (
              !isSubmitted && (
                <Button variant="primary" size="sm" onClick={handleSubmit}>
                  Nộp bài thi (180 Điểm)
                </Button>
              )
            )}
          </div>
        </div>

        {/* Right Column: Question Navigation Palette (Styled matching Image 1) */}
        <div className="jlpt-exam-sidebar">
          {/* Header Banner matching Image 1 */}
          <div
            style={{
              background: '#778da9',
              color: '#ffffff',
              padding: '0.875rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '0.9375rem' }}
            >
              <span
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  width: '1.5rem',
                  height: '1.5rem',
                  borderRadius: '0.375rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.8125rem',
                }}
              >
                {activeSectionIdx + 1}
              </span>
              <span>
                {(currentSection?.title || 'Phần thi')
                  .replace(/^\d+\.\s*/, '')
                  .split('(')[0]
                  ?.trim() || 'Phần thi'}
              </span>
            </div>

            <span style={{ fontSize: '0.75rem', fontWeight: 600, opacity: 0.9 }}>
              {currentSectionAnsweredCount === currentSectionQuestionsCount
                ? 'Xong'
                : `${currentSectionAnsweredCount}/${currentSectionQuestionsCount}`}
            </span>
          </div>

          {/* Body: Grouped by Mondai (Matching Image 1) */}
          <div
            style={{
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              overflowY: 'auto',
            }}
          >
            {currentSection?.parts?.map((part: JlptPart, pIdx: number) => {
              const mondaiTitle = part.instruction || part.titleJP || part.title || `問題 ${pIdx + 1}`

              return (
                <div key={part.id || pIdx} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {/* Mondai Header Line */}
                  <div
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      color: '#475569',
                      lineHeight: 1.4,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                    title={mondaiTitle}
                  >
                    {mondaiTitle}
                  </div>

                  {/* Question Bubbles Grid (Matching Image 1 pills) */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(36px, 1fr))',
                      gap: '0.375rem',
                    }}
                  >
                    {part.questions?.map((q: JlptQuestion, qIdx: number) => {
                      const qKey = q.id || `p${pIdx}_q${qIdx}`
                      const isAnswered = answers[qKey] !== undefined
                      const qResult = result?.questionResults?.find((r) => r.id === qKey || r.number === q.number)

                      let bg = '#f0f4f9'
                      let color = '#334155'
                      let borderColor = '#dce3ec'

                      if (isSubmitted && qResult) {
                        if (qResult.isCorrect) {
                          bg = '#dcfce7'
                          color = '#15803d'
                          borderColor = '#86efac'
                        } else {
                          bg = '#ffe4e6'
                          color = '#e11d48'
                          borderColor = '#fda4af'
                        }
                      } else if (isAnswered) {
                        bg = '#4f46e5'
                        color = '#ffffff'
                        borderColor = '#4338ca'
                      }

                      return (
                        <button
                          key={qKey}
                          type="button"
                          onClick={() => jumpToQuestion(q.number)}
                          style={{
                            height: '2.25rem',
                            borderRadius: '0.625rem',
                            fontSize: '0.8125rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: `1.5px solid ${borderColor}`,
                            background: bg,
                            color: color,
                            transition: 'all 0.1s ease',
                          }}
                          title={`Câu ${q.number}`}
                        >
                          {q.number}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer legend */}
          <div
            style={{
              borderTop: '1px solid #f1f5f9',
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.6875rem',
              color: '#64748b',
              background: '#fafafa',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span style={{ width: '0.625rem', height: '0.625rem', borderRadius: '0.2rem', background: '#4f46e5' }} />
              <span>Đã chọn</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span
                style={{
                  width: '0.625rem',
                  height: '0.625rem',
                  borderRadius: '0.2rem',
                  background: '#f0f4f9',
                  border: '1px solid #cbd5e1',
                }}
              />
              <span>Chưa làm</span>
            </div>
            {isSubmitted && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <span
                  style={{ width: '0.625rem', height: '0.625rem', borderRadius: '0.2rem', background: '#dcfce7' }}
                />
                <span>Đúng</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default JlptExamTakingPage
