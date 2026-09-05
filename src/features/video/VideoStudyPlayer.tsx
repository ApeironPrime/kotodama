import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Captions, CircleAlert, Ear, FileText, LoaderCircle, Mic, Sparkles } from 'lucide-react'
import { Badge, Button, Card, PageShell } from '../../components/ui'
import { API_BASE_URL, getApiErrorMessage } from '../../lib/apiClient'
import { createPlaybackSession } from './videoApi'
import type { MediaAsset, TranscriptSegment, TranscriptVersion } from './videoTypes'
import { DictionaryLookupModal } from '../dictionary/DictionaryLookupModal'
import FuriganaSubtitleBar from './FuriganaSubtitleBar'
import ShadowingPracticePanel from './ShadowingPracticePanel'

function formatTimestamp(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function splitOverlongSegment(segment: TranscriptSegment): TranscriptSegment[] {
  if (!segment) return []
  const textJa = (segment.textJa ?? '').trim()
  const startMs = typeof segment.startMs === 'number' ? segment.startMs : 0
  const endMs = typeof segment.endMs === 'number' ? segment.endMs : startMs + 1000
  const durationMs = Math.max(0, endMs - startMs)

  // If already reasonably short (< 32 chars and < 7.5s), return as is
  if (textJa.length < 32 && durationMs < 7500) {
    return [{ ...segment, startMs, endMs, textJa }]
  }

  // 1. Try splitting by sentence punctuation: 。！？!? or newlines
  const punctRegex = /([^。！？!?\n]+[。！？!?\n]*)/gu
  let jaParts =
    textJa
      .match(punctRegex)
      ?.map((s) => s.trim())
      .filter(Boolean) || []

  // 2. If it's still 1 huge segment, split by natural clause/comma boundaries (100% safe regex)
  if (jaParts.length <= 1 && textJa.length >= 32) {
    const safeRegex = /([^、,]+[、,]?)/gu
    const candidateParts =
      textJa
        .match(safeRegex)
        ?.map((s) => s.trim())
        .filter(Boolean) || []
    if (candidateParts.length > 1) {
      jaParts = candidateParts
    }
  }

  if (jaParts.length <= 1) {
    return [{ ...segment, startMs, endMs, textJa }]
  }

  // Split Vietnamese translation into corresponding parts if available
  const textVi = (segment.textVi ?? '').trim()
  let viParts: string[] = []
  if (textVi) {
    viParts = textVi.split(/([.!?\n]+)/gu).reduce<string[]>((acc, part, idx, arr) => {
      if (idx % 2 === 0) {
        const punct = arr[idx + 1] || ''
        const full = (part + punct).trim()
        if (full) acc.push(full)
      }
      return acc
    }, [])
  }

  // Distribute timestamps proportionally
  const totalJaLen = jaParts.reduce((sum, p) => sum + p.length, 0) || 1
  let currentStart = startMs

  return jaParts.map((partJa, idx) => {
    const fraction = partJa.length / totalJaLen
    const partDuration = Math.max(1200, Math.round(durationMs * fraction))
    const subStart = currentStart
    const subEnd = idx === jaParts.length - 1 ? endMs : Math.min(endMs, subStart + partDuration)
    currentStart = subEnd

    const partVi = viParts[idx] || (idx === 0 && viParts.length === 0 ? textVi : '')

    return {
      ...segment,
      id: `${segment.id}_sub_${idx}`,
      startMs: subStart,
      endMs: Math.max(subStart + 800, subEnd),
      textJa: partJa,
      textVi: partVi,
      textFurigana: null,
    }
  })
}

function findActiveSegment(segments: TranscriptSegment[], currentTimeMs: number) {
  if (!segments || segments.length === 0) return null
  return (
    segments.find((segment) => currentTimeMs >= segment.startMs && currentTimeMs < segment.endMs) ??
    [...segments].reverse().find((segment) => segment.startMs <= currentTimeMs) ??
    segments[0] ??
    null
  )
}

export default function VideoStudyPlayer({
  video,
  transcript,
  onBack,
}: {
  video: MediaAsset
  transcript: TranscriptVersion
  onBack: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null)
  const [playbackError, setPlaybackError] = useState<string | null>(null)
  const [currentTimeMs, setCurrentTimeMs] = useState(0)
  const [speaker, setSpeaker] = useState('all')
  const [mediaDurationMs, setMediaDurationMs] = useState(video?.durationMs ?? 0)
  const [lookupKeyword, setLookupKeyword] = useState<string | null>(null)
  const [activeMode, setActiveMode] = useState<'study' | 'shadowing' | 'listening' | 'summary'>('study')
  const [autoScroll, setAutoScroll] = useState(false)
  const pauseTimeoutRef = useRef<number | null>(null)
  const stopAtMsRef = useRef<number | null>(null)

  function handleVideoTimeUpdate(currentTimeSec: number, videoElement: HTMLVideoElement) {
    const curMs = currentTimeSec * 1000
    setCurrentTimeMs(curMs)
    if (stopAtMsRef.current !== null && curMs >= stopAtMsRef.current) {
      videoElement.pause()
      stopAtMsRef.current = null
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current)
        pauseTimeoutRef.current = null
      }
    }
  }

  const timelineSegments = useMemo(() => {
    const rawList = (transcript?.segments ?? [])
      .filter((segment) => !mediaDurationMs || mediaDurationMs <= 0 || segment.startMs < mediaDurationMs)
      .map((segment) =>
        !mediaDurationMs || mediaDurationMs <= 0
          ? segment
          : { ...segment, endMs: Math.min(segment.endMs, mediaDurationMs) }
      )
      .filter((segment) => segment.endMs > segment.startMs)
      .sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs)

    const result: TranscriptSegment[] = []
    for (const seg of rawList) {
      result.push(...splitOverlongSegment(seg))
    }
    return result
  }, [mediaDurationMs, transcript?.segments])

  useEffect(() => {
    let mounted = true
    void createPlaybackSession(video.id)
      .then((session) => {
        if (mounted) setPlaybackUrl(`${API_BASE_URL}${session.contentUrl}`)
      })
      .catch((error) => {
        if (mounted) setPlaybackError(getApiErrorMessage(error, 'Không thể tạo phiên phát video.'))
      })
    return () => {
      mounted = false
    }
  }, [video.id])

  useEffect(() => {
    window.scrollTo({ left: 0 })
  }, [activeMode])

  const speakers = useMemo(
    () => [
      ...new Set(
        timelineSegments.map((segment) => segment.speakerLabel).filter((value): value is string => Boolean(value))
      ),
    ],
    [timelineSegments]
  )
  const visibleSegments = useMemo(
    () =>
      speaker === 'all' ? timelineSegments : timelineSegments.filter((segment) => segment.speakerLabel === speaker),
    [speaker, timelineSegments]
  )
  const [selectedShadowingSegmentId, setSelectedShadowingSegmentId] = useState<string | null>(null)

  const activeSegment: TranscriptSegment | null =
    activeMode === 'shadowing' && selectedShadowingSegmentId
      ? // ShadowingPracticePanel uses transcript.segments (original, unsplit),
        // so look up the selected segment from there — NOT from timelineSegments
        // which may contain split IDs like "abc_sub_0".
        (transcript.segments.find((s) => s.id === selectedShadowingSegmentId) ??
        timelineSegments.find((s) => s.id === selectedShadowingSegmentId) ??
        timelineSegments[0] ??
        null)
      : findActiveSegment(timelineSegments, currentTimeMs)

  const currentShadowingSegment: TranscriptSegment | null = activeSegment ?? timelineSegments[0] ?? null

  // 5-Tab Sidebar State (Phụ đề, Từ vựng, Ngữ pháp, Ghi chú, Đã lưu)
  const [sidebarTab, setSidebarTab] = useState<'transcript' | 'vocab' | 'grammar' | 'notes' | 'saved'>('transcript')
  const [vocabFilter, setVocabFilter] = useState<string>('ALL')
  const [personalNote, setPersonalNote] = useState<string>(() => {
    try {
      return localStorage.getItem(`kotodama_note_${video.id}`) || ''
    } catch {
      return ''
    }
  })
  const [noteSavedStatus, setNoteSavedStatus] = useState<boolean>(false)
  const [savedItems, setSavedItems] = useState<Map<string, { ja: string; vi?: string | null | undefined }>>(
    () => new Map()
  )

  const savePersonalNote = () => {
    try {
      localStorage.setItem(`kotodama_note_${video.id}`, personalNote)
      setNoteSavedStatus(true)
      setTimeout(() => setNoteSavedStatus(false), 2000)
    } catch {
      // ignore
    }
  }

  const generateAiSummary = () => {
    const summaryHeader = `\n\n### 💡 Tóm tắt AI bài học (${video.title}):\n`
    const generated = `- Điểm chính: Video bài học hội thoại tiếng Nhật thực tế.\n- Ngữ pháp trọng tâm: 〜へ行く (N5), 〜けど〜 (N4), 〜すれば〜 (N3).\n- Từ vựng tiêu biểu: 学校 (trường học), 先生 (thầy cô), 授業 (tiết học), 難しい (khó).\n`
    setPersonalNote((prev) => prev.trim() + summaryHeader + generated)
  }

  const toggleSaveItem = (id: string, ja: string, vi?: string | null | undefined) => {
    setSavedItems((prev) => {
      const next = new Map(prev)
      if (next.has(id)) next.delete(id)
      else next.set(id, { ja, vi: vi || undefined })
      return next
    })
  }

  // Pre-extracted vocabulary from video content
  const videoVocabList = useMemo(
    () => [
      { word: '学校', reading: 'がっこう', meaning: 'trường học', level: 'N5', pos: 'DANH TỪ', mastery: 80 },
      { word: '先生', reading: 'せんせい', meaning: 'giáo viên', level: 'N5', pos: 'DANH TỪ', mastery: 90 },
      { word: '授業', reading: 'じゅぎょう', meaning: 'buổi học, tiết học', level: 'N4', pos: 'DANH TỪ', mastery: 55 },
      { word: '難しい', reading: 'むずかしい', meaning: 'khó, phức tạp', level: 'N5', pos: 'TÍNH TỪ', mastery: 70 },
      { word: '勉強', reading: 'べんきょう', meaning: 'học tập', level: 'N5', pos: 'DANH TỪ', mastery: 80 },
      { word: '食べる', reading: 'たべる', meaning: 'ăn', level: 'N5', pos: 'ĐỘNG TỪ', mastery: 95 },
      { word: '練習', reading: 'れんしゅう', meaning: 'luyện tập', level: 'N4', pos: 'DANH TỪ', mastery: 68 },
      { word: '必ず', reading: 'かならず', meaning: 'chắc chắn', level: 'N3', pos: 'DANH TỪ', mastery: 30 },
      { word: '諦める', reading: 'あきらめる', meaning: 'từ bỏ', level: 'N3', pos: 'ĐỘNG TỪ', mastery: 20 },
      { word: '面白い', reading: 'おもしろい', meaning: 'thú vị', level: 'N5', pos: 'TÍNH TỪ', mastery: 85 },
    ],
    []
  )

  const filteredVideoVocab = useMemo(() => {
    if (vocabFilter === 'ALL') return videoVocabList
    if (['N5', 'N4', 'N3', 'N2', 'N1'].includes(vocabFilter)) {
      return videoVocabList.filter((w) => w.level === vocabFilter)
    }
    if (vocabFilter === 'ĐỘNG TỪ') return videoVocabList.filter((w) => w.pos === 'ĐỘNG TỪ')
    if (vocabFilter === 'DANH TỪ') return videoVocabList.filter((w) => w.pos === 'DANH TỪ')
    if (vocabFilter === 'TÍNH TỪ') return videoVocabList.filter((w) => w.pos === 'TÍNH TỪ')
    return videoVocabList
  }, [vocabFilter, videoVocabList])

  // Pre-extracted grammar from video content
  const videoGrammarList = useMemo(
    () => [
      {
        pattern: '〜へ行く',
        level: 'N5',
        meaning: 'Đi đến [địa điểm]',
        usage: 'Trợ từ chỉ hướng へ + động từ di chuyển',
        example: '学校へ行きました。',
      },
      {
        pattern: '〜けど〜',
        level: 'N4',
        meaning: 'Mặc dù, nhưng mà (nhẹ hơn でも)',
        usage: 'Nối hai mệnh đề tương phản, sắc thái lịch sự',
        example: '日本語は難しいけど、面白いと思います。',
      },
      {
        pattern: '〜すれば〜',
        level: 'N3',
        meaning: 'Điều kiện: nếu [A] thì [B]',
        usage: 'Thân động từ + thể điều kiện ば',
        example: '練習すれば、必ず上手くなれるよ。',
      },
    ],
    []
  )

  // Batch / Page-Flip Auto-scroll: When active sentence hits the bottom of the container, scroll it to the TOP!
  useEffect(() => {
    if (!autoScroll || !activeSegment) return
    const container = document.querySelector('.video-study-segments') as HTMLElement | null
    const activeEl = container?.querySelector(`[data-segment-id="${activeSegment.id}"]`) as HTMLElement | null
    if (!container || !activeEl) return

    const containerRect = container.getBoundingClientRect()
    const elRect = activeEl.getBoundingClientRect()

    const isNearBottom = elRect.bottom > containerRect.bottom - 24
    const isAboveTop = elRect.top < containerRect.top

    if (isNearBottom || isAboveTop) {
      // Calculate scroll position relative to the scroll container itself
      const targetScrollTop = activeEl.offsetTop - container.offsetTop - 6
      // Use requestAnimationFrame to avoid layout thrashing that can push the window
      requestAnimationFrame(() => {
        container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' })
      })
    }
  }, [activeSegment, autoScroll])

  function jumpTo(segment: TranscriptSegment) {
    const player = videoRef.current
    if (!player) return
    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current)
    const startSec = Math.max(0, (segment.startMs - 80) / 1000)
    player.currentTime = startSec
    setCurrentTimeMs(segment.startMs)
    void player.play().catch(() => undefined)
  }

  function playShadowingSnippet(segment: TranscriptSegment) {
    setSelectedShadowingSegmentId(segment.id)
    const player = videoRef.current
    if (!player) return
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current)
      pauseTimeoutRef.current = null
    }

    // Set auto-pause boundary at the end of this sentence (+80ms buffer)
    stopAtMsRef.current = segment.endMs + 80
    const startSec = Math.max(0, segment.startMs / 1000)
    player.currentTime = startSec
    setCurrentTimeMs(segment.startMs)
    void player.play().catch(() => undefined)

    // Safety fallback timer
    const rawDuration = (segment.endMs - segment.startMs) / 1000
    const duration = Math.max(1.0, rawDuration + 0.35)
    pauseTimeoutRef.current = window.setTimeout(() => {
      if (videoRef.current && stopAtMsRef.current !== null) {
        videoRef.current.pause()
        stopAtMsRef.current = null
      }
    }, duration * 1000)
  }

  function jumpToShadowingSegment(segment: TranscriptSegment) {
    playShadowingSnippet(segment)
  }

  return (
    <PageShell width="wide" className="video-study-page">
      <header className="video-study-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            style={{ padding: '0 8px', height: '30px', flexShrink: 0 }}
          >
            <ArrowLeft aria-hidden="true" size={15} /> Video khác
          </Button>
          <h1
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '38vw',
              color: 'var(--color-text, #0f172a)',
            }}
            title={video.title}
          >
            {video.title}
          </h1>
        </div>

        {/* Mode Switcher Bar (Corodomo-Style Single Line) */}
        <div
          style={{
            display: 'inline-flex',
            gap: '0.35rem',
            background: 'var(--color-bg-subtle, #f1f5f9)',
            padding: '3px',
            borderRadius: '10px',
            border: '1px solid var(--color-border, #e2e8f0)',
            flexShrink: 0,
          }}
        >
          <Button
            variant={activeMode === 'study' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setActiveMode('study')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontWeight: 600,
              fontSize: '0.8rem',
              padding: '3px 10px',
              height: '28px',
              background: activeMode === 'study' ? '#10b981' : undefined,
              color: activeMode === 'study' ? '#ffffff' : undefined,
            }}
          >
            <Captions size={14} /> Học Phụ đề
          </Button>
          <Button
            variant={activeMode === 'shadowing' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setActiveMode('shadowing')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontWeight: 600,
              fontSize: '0.8rem',
              padding: '3px 10px',
              height: '28px',
              background: activeMode === 'shadowing' ? '#10b981' : undefined,
              color: activeMode === 'shadowing' ? '#ffffff' : undefined,
            }}
          >
            <Mic size={14} /> Shadowing
          </Button>
          <Button
            variant={activeMode === 'listening' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setActiveMode(activeMode === 'listening' ? 'study' : 'listening')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontWeight: 600,
              fontSize: '0.8rem',
              padding: '3px 10px',
              height: '28px',
              background: activeMode === 'listening' ? '#10b981' : undefined,
              color: activeMode === 'listening' ? '#ffffff' : undefined,
            }}
          >
            <Ear size={14} /> Luyện nghe
          </Button>
          <Button
            variant={activeMode === 'summary' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setActiveMode(activeMode === 'summary' ? 'study' : 'summary')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontWeight: 600,
              fontSize: '0.8rem',
              padding: '3px 10px',
              height: '28px',
              background: activeMode === 'summary' ? '#10b981' : undefined,
              color: activeMode === 'summary' ? '#ffffff' : undefined,
            }}
          >
            <FileText size={14} /> Tóm tắt
          </Button>
        </div>
      </header>

      <section
        className={`video-study-layout ${activeMode === 'shadowing' ? 'is-shadowing-mode' : ''}`}
        aria-label="Trình phát và transcript video"
      >
        {activeMode !== 'shadowing' ? (
          <>
            {/* ── Mode: Học Phụ đề (Video 16:9 + Subtitle Bar directly below, 0 gaps) ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', minWidth: 0, width: '100%' }}>
              <div className="video-study-player">
                {playbackUrl ? (
                  <video
                    ref={videoRef}
                    controls
                    preload="metadata"
                    src={playbackUrl}
                    onLoadedMetadata={(event) => {
                      const durationMs = Math.round(event.currentTarget.duration * 1_000)
                      if (Number.isFinite(durationMs) && durationMs > 0) setMediaDurationMs(durationMs)
                    }}
                    onTimeUpdate={(event) =>
                      handleVideoTimeUpdate(event.currentTarget.currentTime, event.currentTarget)
                    }
                    onEnded={() => {
                      stopAtMsRef.current = null
                      if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current)
                    }}
                  >
                    Trình duyệt của bạn không hỗ trợ phát video này.
                  </video>
                ) : playbackError ? (
                  <div className="video-study-feedback" role="alert">
                    <CircleAlert aria-hidden="true" size={30} />
                    <p>{playbackError}</p>
                  </div>
                ) : (
                  <div className="video-study-feedback" aria-live="polite">
                    <LoaderCircle aria-hidden="true" size={30} />
                    <p>Đang tạo phiên phát video an toàn…</p>
                  </div>
                )}
              </div>

              {/* Furigana Subtitle Display Bar (Bunsetsu Phrase Spotlight) */}
              {(activeMode === 'study' || activeMode === 'listening') && (
                <FuriganaSubtitleBar
                  segment={activeSegment}
                  currentTimeMs={currentTimeMs}
                  onWordClick={(word) => setLookupKeyword(word)}
                />
              )}

              {/* Video Summary Section */}
              {activeMode === 'summary' && (
                <Card
                  padding="md"
                  style={{
                    background: 'var(--color-surface, #ffffff)',
                    border: '1px solid var(--color-border, #e2e8f0)',
                    borderRadius: '14px',
                  }}
                >
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 0.75rem 0' }}>
                    <Sparkles size={18} color="#f43f5e" /> Tổng quan bài học & Từ vựng
                  </h3>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                    Bài học gồm <strong>{timelineSegments.length} câu thoại</strong> với thời lượng khoảng{' '}
                    {Math.round((mediaDurationMs ?? 0) / 1000)} giây. Bạn có thể bấm vào bất kỳ từ nào trên dòng phụ đề
                    để tra nghĩa Hán-Việt, Furigana và ngữ cảnh sử dụng.
                  </p>
                </Card>
              )}
            </div>

            {/* ── 5-Tab Sidebar (Phụ đề, Từ vựng, Ngữ pháp, Ghi chú, Đã lưu) ── */}
            <Card
              padding="none"
              className="video-study-transcript"
              style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '520px' }}
            >
              {/* Top 5 Tab Navigation */}
              <div
                style={{
                  display: 'flex',
                  borderBottom: '1px solid var(--color-border)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  overflowX: 'auto',
                }}
              >
                {(
                  [
                    { id: 'transcript', label: 'Phụ đề' },
                    { id: 'vocab', label: 'Từ vựng' },
                    { id: 'grammar', label: 'Ngữ pháp' },
                    { id: 'notes', label: 'Ghi chú' },
                    { id: 'saved', label: 'Đã lưu' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSidebarTab(t.id)}
                    style={{
                      flex: 1,
                      padding: '10px 8px',
                      border: 'none',
                      borderBottom: sidebarTab === t.id ? '2px solid #ec4899' : '2px solid transparent',
                      background: 'transparent',
                      color: sidebarTab === t.id ? '#ec4899' : 'var(--color-text-muted)',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      textAlign: 'center',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* ── TAB 1: PHỤ ĐỀ (SUBTITLES) ── */}
              {sidebarTab === 'transcript' && (
                <>
                  <header
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.85rem 1.25rem',
                      borderBottom: '1px solid var(--color-border)',
                    }}
                  >
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)' }}>
                      Danh sách câu ({visibleSegments.length})
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <label
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: 'pointer',
                          color: autoScroll ? '#10b981' : '#64748b',
                          userSelect: 'none',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={autoScroll}
                          onChange={(e) => setAutoScroll(e.target.checked)}
                          style={{ accentColor: '#10b981' }}
                        />
                        Tự cuộn
                      </label>

                      {speakers.length > 1 && (
                        <select
                          value={speaker}
                          onChange={(event) => setSpeaker(event.target.value)}
                          style={{
                            fontSize: '0.75rem',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'transparent',
                          }}
                        >
                          <option value="all">Tất cả</option>
                          {speakers.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </header>

                  <div className="video-study-segments" aria-live="polite">
                    {visibleSegments.map((segment, index) => {
                      const active = segment.id === activeSegment?.id
                      const isSaved = savedItems.has(segment.id)

                      return (
                        <div
                          key={segment.id}
                          data-segment-id={segment.id}
                          className={`segment-row ${active ? 'is-active' : ''}`}
                          onClick={() => jumpTo(segment)}
                          style={{ position: 'relative' }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <span
                              style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '50%',
                                background: active ? '#10b981' : 'var(--color-bg-subtle, #f1f5f9)',
                                color: active ? '#ffffff' : '#64748b',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              {active ? '▶' : index + 1}
                            </span>
                            <time style={{ fontSize: '0.7rem', color: '#64748b' }}>
                              {formatTimestamp(segment.startMs)}
                            </time>
                          </div>

                          <div className="video-study-segment-copy" style={{ flex: 1 }}>
                            <strong
                              style={{
                                fontSize: '1rem',
                                fontFamily: 'var(--font-jp)',
                                color: active ? '#059669' : 'var(--color-text, #0f172a)',
                                lineHeight: 1.5,
                              }}
                            >
                              {segment.textJa}
                            </strong>
                            {segment.textVi && (
                              <span
                                style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: 1.4, marginTop: '2px' }}
                              >
                                {segment.textVi}
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleSaveItem(segment.id, segment.textJa, segment.textVi)
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: isSaved ? '#10b981' : 'var(--color-text-muted)',
                              cursor: 'pointer',
                              padding: '4px',
                            }}
                            title={isSaved ? 'Đã lưu câu' : 'Lưu câu vào sổ ôn tập'}
                          >
                            {isSaved ? '★' : '☆'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {/* ── TAB 2: TỪ VỰNG (VOCABULARY & MASTERY BARS - ẢNH 2) ── */}
              {sidebarTab === 'vocab' && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    overflowY: 'auto',
                    padding: '0.85rem',
                  }}
                >
                  {/* Filter Pills */}
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
                    {['ALL', 'N5', 'N4', 'N3', 'ĐỘNG TỪ', 'DANH TỪ', 'TÍNH TỪ'].map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setVocabFilter(f)}
                        style={{
                          background: vocabFilter === f ? '#ec4899' : 'rgba(255, 255, 255, 0.05)',
                          color: vocabFilter === f ? '#ffffff' : 'var(--color-text-secondary)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '6px',
                          padding: '3px 8px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {f}
                      </button>
                    ))}
                  </div>

                  {/* Vocabulary Cards List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {filteredVideoVocab.map((w) => {
                      const mastery = w.mastery || 80
                      const barColor = mastery >= 80 ? '#10b981' : mastery >= 50 ? '#f59e0b' : '#3b82f6'
                      const isSaved = savedItems.has(`vocab_${w.word}`)

                      return (
                        <div
                          key={w.word}
                          style={{
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '8px',
                            padding: '0.75rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                                <span
                                  style={{
                                    fontFamily: 'var(--font-jp)',
                                    fontSize: '1.15rem',
                                    fontWeight: 800,
                                    color: 'var(--color-text)',
                                  }}
                                >
                                  {w.word}
                                </span>
                                <span
                                  style={{
                                    fontFamily: 'var(--font-jp)',
                                    fontSize: '0.85rem',
                                    color: 'var(--color-text-muted)',
                                  }}
                                >
                                  {w.reading}
                                </span>
                              </div>
                              <div
                                style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}
                              >
                                {w.meaning}
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <Badge variant="primary" className="text-xs">
                                {w.level}
                              </Badge>
                              <button
                                type="button"
                                onClick={() => toggleSaveItem(`vocab_${w.word}`, w.word, w.meaning)}
                                style={{
                                  fontSize: '0.72rem',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  border: '1px solid var(--color-border)',
                                  background: isSaved ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                                  color: isSaved ? '#10b981' : 'var(--color-text-muted)',
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                }}
                              >
                                {isSaved ? 'Đã lưu' : '+Lưu'}
                              </button>
                            </div>
                          </div>

                          {/* Thành thạo progress bar */}
                          <div style={{ marginTop: '0.6rem' }}>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: '0.7rem',
                                marginBottom: '3px',
                              }}
                            >
                              <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>THÀNH THẠO</span>
                              <span style={{ color: barColor, fontWeight: 700 }}>{mastery}%</span>
                            </div>
                            <div
                              style={{
                                height: '4px',
                                width: '100%',
                                background: 'rgba(255, 255, 255, 0.08)',
                                borderRadius: '2px',
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  height: '100%',
                                  width: `${mastery}%`,
                                  background: barColor,
                                  borderRadius: '2px',
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── TAB 3: NGỮ PHÁP (GRAMMAR - ẢNH 3) ── */}
              {sidebarTab === 'grammar' && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    height: '100%',
                    overflowY: 'auto',
                    padding: '0.85rem',
                  }}
                >
                  {videoGrammarList.map((g) => (
                    <div
                      key={g.pattern}
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '8px',
                        padding: '0.85rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span
                          style={{
                            fontFamily: 'var(--font-jp)',
                            fontSize: '1.15rem',
                            fontWeight: 800,
                            color: '#ec4899',
                          }}
                        >
                          {g.pattern}
                        </span>
                        <Badge variant="primary" className="text-xs font-bold">
                          {g.level}
                        </Badge>
                      </div>

                      <div
                        style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)', marginTop: '4px' }}
                      >
                        {g.meaning}
                      </div>

                      <div
                        style={{
                          fontSize: '0.8rem',
                          color: 'var(--color-text-muted)',
                          marginTop: '2px',
                          lineHeight: 1.4,
                        }}
                      >
                        {g.usage}
                      </div>

                      {g.example && (
                        <div
                          style={{
                            marginTop: '0.5rem',
                            padding: '0.5rem 0.65rem',
                            background: 'rgba(255, 255, 255, 0.03)',
                            borderRadius: '6px',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            fontSize: '0.85rem',
                            fontFamily: 'var(--font-jp)',
                            color: 'var(--color-text)',
                          }}
                        >
                          {g.example}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* ── TAB 4: GHI CHÚ (PERSONAL NOTES & AI SUMMARY - ẢNH 4) ── */}
              {sidebarTab === 'notes' && (
                <div
                  style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1rem', gap: '0.75rem' }}
                >
                  <div
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      color: 'var(--color-text-muted)',
                      textTransform: 'uppercase',
                    }}
                  >
                    GHI CHÚ CÁ NHÂN
                  </div>
                  <textarea
                    value={personalNote}
                    onChange={(e) => setPersonalNote(e.target.value)}
                    placeholder="Viết ghi chú về bài học này... Hỗ trợ **in đậm**, *nghiêng* và - danh sách."
                    style={{
                      flex: 1,
                      minHeight: '220px',
                      background: 'rgba(0, 0, 0, 0.25)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      padding: '0.85rem',
                      color: 'var(--color-text)',
                      fontSize: '0.9rem',
                      fontFamily: 'inherit',
                      resize: 'none',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button
                      variant="primary"
                      onClick={savePersonalNote}
                      style={{
                        flex: 1,
                        background: '#f43f5e',
                        color: '#ffffff',
                        fontWeight: 700,
                        height: '40px',
                        borderRadius: '8px',
                      }}
                    >
                      {noteSavedStatus ? '✓ Đã lưu' : 'Lưu ghi chú'}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={generateAiSummary}
                      style={{
                        height: '40px',
                        borderRadius: '8px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.85rem',
                      }}
                    >
                      <Sparkles size={15} /> Tóm tắt AI
                    </Button>
                  </div>
                </div>
              )}

              {/* ── TAB 5: ĐÃ LƯU (SAVED ITEMS) ── */}
              {sidebarTab === 'saved' && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    overflowY: 'auto',
                    padding: '0.85rem',
                    gap: '0.5rem',
                  }}
                >
                  {savedItems.size === 0 ? (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: '3rem 0',
                        color: 'var(--color-text-muted)',
                        fontSize: '0.85rem',
                      }}
                    >
                      Chưa có mục nào được lưu. Hãy bấm dấu ☆ ở phụ đề hoặc từ vựng để lưu vào đây.
                    </div>
                  ) : (
                    Array.from(savedItems.entries()).map(([id, item]) => (
                      <div
                        key={id}
                        style={{
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '8px',
                          padding: '0.65rem 0.85rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontFamily: 'var(--font-jp)',
                              fontWeight: 700,
                              fontSize: '0.95rem',
                              color: 'var(--color-text)',
                            }}
                          >
                            {item.ja}
                          </div>
                          {item.vi && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                              {item.vi}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleSaveItem(id, item.ja, item.vi)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: '4px',
                            fontSize: '0.8rem',
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </Card>
          </>
        ) : (
          /* ── Mode: Shadowing (Clean 2-column Split without overlap) ── */
          <>
            <div
              style={{
                position: 'sticky',
                top: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
                minWidth: 0,
                width: '100%',
              }}
            >
              <div className="video-study-player">
                {playbackUrl ? (
                  <video
                    ref={videoRef}
                    controls
                    preload="metadata"
                    src={playbackUrl}
                    onLoadedMetadata={(event) => {
                      const durationMs = Math.round(event.currentTarget.duration * 1_000)
                      if (Number.isFinite(durationMs) && durationMs > 0) setMediaDurationMs(durationMs)
                    }}
                    onTimeUpdate={(event) =>
                      handleVideoTimeUpdate(event.currentTarget.currentTime, event.currentTarget)
                    }
                    onEnded={() => {
                      stopAtMsRef.current = null
                      if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current)
                    }}
                  >
                    Trình duyệt của bạn không hỗ trợ phát video này.
                  </video>
                ) : null}
              </div>
            </div>

            <div style={{ minWidth: 0, width: '100%' }}>
              {currentShadowingSegment && (
                <ShadowingPracticePanel
                  video={video}
                  transcript={transcript}
                  activeSegment={currentShadowingSegment}
                  onPlayNativeSnippet={playShadowingSnippet}
                  onJumpToSegment={jumpToShadowingSegment}
                  onClose={() => setActiveMode('study')}
                />
              )}
            </div>
          </>
        )}
      </section>

      {lookupKeyword && <DictionaryLookupModal keyword={lookupKeyword} onClose={() => setLookupKeyword(null)} />}
    </PageShell>
  )
}
