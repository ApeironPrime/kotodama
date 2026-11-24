import { useDialogAccessibility } from '../../lib/useDialogAccessibility'
import { type CSSProperties, useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import gsap from 'gsap'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  X,
  Volume2,
  PenTool,
  Layers,
  ChevronLeft,
  ChevronRight,
  Image,
  BookmarkPlus,
  Check,
  ArrowLeft,
} from 'lucide-react'
import { nhaikanjiApi } from './nhaikanjiApi'
import { apiPaths } from '../../lib/apiClient'
import type { KanjiSummary, KanjiVocabExample } from './nhaikanjiTypes'
import { KanjiStrokeQuiz } from './KanjiStrokeQuiz'
import { KanjiConstellationGraph, type ConstellationMode } from './KanjiConstellationGraph'
import { KanjiStrokePlayer } from './KanjiStrokePlayer'
import { srsApi } from '../srs/srsApi'
import { useAuth } from '../auth/authContext'
import { sumiAudio } from '../dictionary/sumiAudio'
import { playStampSuccess } from '../vocabulary/soundEngine'
import { getKanjiDescendants } from '../dictionary/kanjiDescendantsData'
import { getComponentLabel } from '../dictionary/kanjiEtymologyMap'
import {
  toCanonicalRadicalGlyph,
  getRadicalVietnameseName,
  translateRadicalMeaning,
} from '../dictionary/kanjiRadicalDictionary'

interface KanjiDetailModalProps {
  kanjiSummary: KanjiSummary
  onClose: () => void
  onSelectKanji?: (kanji: string) => void
  onFilterByRadical?: (radicalGlyph: string) => void
}

function extractStoryComponents(story: string, focalKanji: string): Array<{ char: string; label: string }> {
  const matches = [...story.matchAll(/([^\s(（]+)?\s*[（(]([^\s）)]{1})[）)]/g)]
  const results: Array<{ char: string; label: string }> = []
  const seen = new Set<string>()
  const focalCanon = toCanonicalRadicalGlyph(focalKanji)
  for (const m of matches) {
    const rawLabel = (m[1] ?? '').trim()
    const rawChar = (m[2] ?? '').trim()
    const char = toCanonicalRadicalGlyph(rawChar)
    if (
      char &&
      char !== focalKanji &&
      char !== focalCanon &&
      !seen.has(char) &&
      /[\u4e00-\u9fff\u3400-\u4dbf\u2e80-\u2fd5]/.test(char)
    ) {
      seen.add(char)
      const label = getComponentLabel(char, rawLabel)
      results.push({ char, label })
    }
  }
  return results
}

function extractOtherKanjiChars(word: string, focalKanji: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const ch of word) {
    if (ch !== focalKanji && !seen.has(ch) && /[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch)) {
      seen.add(ch)
      out.push(ch)
    }
  }
  return out
}

function parseKanjiReadings(raw?: string): Array<{ display: string; spoken: string }> {
  if (!raw) return []
  const parts = raw
    .split(/[,、;；/\s]+/)
    .map((s) => s.trim())
    .filter((s) => Boolean(s) && s !== '-' && s !== '—')
  const seen = new Set<string>()
  const result: Array<{ display: string; spoken: string }> = []
  for (const part of parts) {
    const spoken = part.replace(/[.\-・（）()]/g, '').trim()
    if (!spoken || seen.has(spoken)) continue
    seen.add(spoken)
    result.push({ display: part, spoken })
  }
  return result
}

export function KanjiDetailModal({ kanjiSummary, onClose, onSelectKanji, onFilterByRadical }: KanjiDetailModalProps) {
  const { user } = useAuth()
  const [saveError, setSaveError] = useState<string | null>(null)
  const [stageMode, setStageMode] = useState<'stroke' | 'practice' | 'illustration'>('stroke')
  const [quizCompleted, setQuizCompleted] = useState(false)
  const [graphMode, setGraphMode] = useState<ConstellationMode>('auto')
  const [playingAudio, setPlayingAudio] = useState<string | null>(null)
  const [savedSrs, setSavedSrs] = useState<Record<string, boolean>>({})
  const [illustrationError, setIllustrationError] = useState(false)
  const [historyStack, setHistoryStack] = useState<KanjiSummary[]>([kanjiSummary])
  const dialogRef = useRef<HTMLDivElement>(null)
  const realmsRef = useRef<HTMLDivElement>(null)
  const navDirRef = useRef<1 | -1>(1)
  const didMountKanjiRef = useRef(false)
  useDialogAccessibility(dialogRef, onClose)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const queryClient = useQueryClient()

  const navigateToKanji = useCallback(
    (char: string, dir: 1 | -1 = 1) => {
      if (!onSelectKanji) return
      navDirRef.current = dir
      onSelectKanji(char)
    },
    [onSelectKanji]
  )

  useLayoutEffect(() => {
    if (!didMountKanjiRef.current) {
      didMountKanjiRef.current = true
      return
    }
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const el = realmsRef.current
    if (!el) return
    gsap.killTweensOf(el)
    gsap.fromTo(
      el,
      { x: navDirRef.current * 42 },
      { x: 0, duration: 0.34, ease: 'power3.out', clearProps: 'transform' }
    )
  }, [kanjiSummary.kanji])

  useEffect(() => {
    setQuizCompleted(false)
    setHistoryStack((prev) => {
      const existingIdx = prev.findIndex((item) => item.kanji === kanjiSummary.kanji)
      if (existingIdx >= 0) {
        return prev.slice(0, existingIdx + 1)
      }
      return [...prev, kanjiSummary].slice(-8)
    })
  }, [kanjiSummary])

  const handleStepBackHistory = useCallback(() => {
    if (historyStack.length <= 1 || !onSelectKanji) return
    const previous = historyStack[historyStack.length - 2]
    if (previous) {
      navigateToKanji(previous.kanji, -1)
    }
  }, [historyStack, onSelectKanji, navigateToKanji])

  useEffect(
    () => () => {
      audioRef.current?.pause()
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    },
    []
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }
      if (e.key === 'ArrowLeft' && kanjiSummary.prev_kanji && onSelectKanji) {
        e.preventDefault()
        navigateToKanji(kanjiSummary.prev_kanji, -1)
      } else if (e.key === 'ArrowRight' && kanjiSummary.next_kanji && onSelectKanji) {
        e.preventDefault()
        navigateToKanji(kanjiSummary.next_kanji, 1)
      } else if (e.key === 'Backspace' && historyStack.length > 1 && onSelectKanji) {
        e.preventDefault()
        handleStepBackHistory()
      } else if (e.key === '1') {
        setStageMode('stroke')
      } else if (e.key === '2') {
        setStageMode('practice')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    kanjiSummary.prev_kanji,
    kanjiSummary.next_kanji,
    onSelectKanji,
    historyStack.length,
    handleStepBackHistory,
    navigateToKanji,
  ])

  useEffect(() => {
    setIllustrationError(false)
    setSaveError(null)
    setGraphMode('auto')
    setStageMode('stroke')
  }, [kanjiSummary.kanji])

  useEffect(() => {
    sumiAudio.initOnGesture()
    sumiAudio.playBrushFriction()
  }, [kanjiSummary.kanji])

  const {
    data: detailData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['nhaikanji', 'kanjiDetail', kanjiSummary.kanji],
    queryFn: () => nhaikanjiApi.fetchKanjiDetail(kanjiSummary.kanji),
  })

  const showIllustrationToggle = detailData?.hasIllustration === true && !detailData?.isRadicalOnly
  useEffect(() => {
    if (!showIllustrationToggle && stageMode === 'illustration') {
      setStageMode('stroke')
    }
  }, [showIllustrationToggle, stageMode])

  const { data: savedTermsData } = useQuery({
    queryKey: ['srs', user?.id ?? 'me', 'saved-terms'],
    queryFn: () => srsApi.fetchSavedTerms(),
    enabled: Boolean(user),
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!Array.isArray(savedTermsData)) return
    const map: Record<string, boolean> = {}
    for (const entry of savedTermsData) {
      if (entry?.term) {
        map[`${entry.type}_${entry.term}`] = true
        map[entry.term] = true
      }
    }
    setSavedSrs(map)
  }, [savedTermsData])

  const speakJapanese = (text: string, audioUrl?: string, key?: string) => {
    const token = key || audioUrl || text
    if (audioRef.current) {
      audioRef.current.pause()
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    if (audioUrl) {
      const audio = new Audio(audioUrl)
      audioRef.current = audio
      setPlayingAudio(token)
      audio.play().catch(() => setPlayingAudio(null))
      audio.onended = () => setPlayingAudio(null)
      audio.onerror = () => setPlayingAudio(null)
      return
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && text.trim()) {
      const utter = new SpeechSynthesisUtterance(text.replace(/[-.、,]/g, ' '))
      utter.lang = 'ja-JP'
      utter.rate = 0.92
      setPlayingAudio(token)
      utter.onend = () => setPlayingAudio(null)
      utter.onerror = () => setPlayingAudio(null)
      window.speechSynthesis.speak(utter)
    }
  }

  const handleSaveToSrs = async (word: string, meaning: string, reading: string) => {
    setSaveError(null)
    if (!user) {
      setSaveError('Đăng nhập để lưu từ vào sổ tay ôn tập.')
      return
    }
    try {
      await srsApi.addCard({
        type: 'vocab',
        term: word,
        meaning,
        reading,
        jlptLevel: (kanjiSummary.jlpt_level || 'N3').toUpperCase(),
      })
      setSavedSrs((prev) => ({ ...prev, [`vocab_${word}`]: true, [word]: true }))
      sumiAudio.initOnGesture()
      sumiAudio.playHankoStamp()
      playStampSuccess()
      await queryClient.invalidateQueries({ queryKey: ['srs'] })
    } catch {
      setSaveError('Chưa lưu được từ. Kiểm tra kết nối rồi thử lại.')
    }
  }

  const kanjiInfo = detailData?.detail?.kanjiInfo
  const examples: KanjiVocabExample[] = kanjiInfo?.kanjialiveData?.examples || []
  const isKanjiSaved = Boolean(savedSrs[`kanji_${kanjiSummary.kanji}`] || savedSrs[kanjiSummary.kanji])
  const isRadicalOnly = Boolean(detailData?.isRadicalOnly)

  const handleSaveKanjiToSrs = async () => {
    setSaveError(null)
    if (!user) {
      setSaveError('Đăng nhập để lưu Hán tự vào sổ tay ôn tập.')
      return
    }
    try {
      const reading = `${kanjiSummary.onyomi || ''} ${kanjiSummary.kunyomi || ''}`.trim()
      const strokeCountNum =
        typeof kanjiSummary.stroke_count === 'number'
          ? kanjiSummary.stroke_count
          : parseInt(String(kanjiSummary.stroke_count || 0), 10)

      await srsApi.addCard({
        type: 'kanji',
        term: kanjiSummary.kanji,
        hanViet: kanjiSummary.hanzi,
        meaning: `${kanjiSummary.hanzi} - ${kanjiSummary.meaning_vi}`,
        reading,
        jlptLevel: (kanjiSummary.jlpt_level || 'N5').toUpperCase(),
        radical: kanjiSummary.radical_utf,
        strokeCount: strokeCountNum,
        story: kanjiSummary.story,
      })
      setSavedSrs((prev) => ({ ...prev, [`kanji_${kanjiSummary.kanji}`]: true, [kanjiSummary.kanji]: true }))
      sumiAudio.initOnGesture()
      sumiAudio.playHankoStamp()
      playStampSuccess()
      await queryClient.invalidateQueries({ queryKey: ['srs'] })
    } catch {
      setSaveError('Chưa lưu được Hán tự. Kiểm tra kết nối rồi thử lại.')
    }
  }

  const storyComponents = useMemo(
    () => (kanjiSummary.story ? extractStoryComponents(kanjiSummary.story, kanjiSummary.kanji) : []),
    [kanjiSummary.story, kanjiSummary.kanji]
  )

  const radicalComponent = useMemo(() => {
    if (!kanjiSummary.radical_utf || kanjiSummary.radical_utf === '—') return []
    const canonRadical = toCanonicalRadicalGlyph(kanjiSummary.radical_utf)
    const canonKanji = toCanonicalRadicalGlyph(kanjiSummary.kanji)
    const already = storyComponents.some((c) => toCanonicalRadicalGlyph(c.char) === canonRadical)
    if (already || canonRadical === canonKanji) return []
    const viName = getRadicalVietnameseName(canonRadical)
    const viMeaning = translateRadicalMeaning(kanjiSummary.radical_meaning, canonRadical)
    return [{ char: canonRadical, label: viName || viMeaning }]
  }, [kanjiSummary, storyComponents])

  const allComponents = useMemo(() => [...storyComponents, ...radicalComponent], [storyComponents, radicalComponent])

  const descendantNodes = useMemo(() => {
    const local = getKanjiDescendants(kanjiSummary.kanji)
    if (local.length > 0) return local
    return (detailData?.verifiedDescendants ?? []).map((d) => ({ char: d.char, label: d.label }))
  }, [kanjiSummary.kanji, detailData?.verifiedDescendants])

  const illustrationUrl = apiPaths.nhaikanji.kanjiIllustration(kanjiSummary.kanji)
  const hasBothLineage = storyComponents.length > 0 && descendantNodes.length > 0
  const hasAnyGraphData = allComponents.length > 0 || descendantNodes.length > 0

  const handleSelectConstellationKanji = (k: string) => {
    navigateToKanji(k, 1)
  }

  const radicalDisplayName =
    kanjiSummary.radical_vi_name || getRadicalVietnameseName(toCanonicalRadicalGlyph(kanjiSummary.radical_utf)) || ''

  const modalContent = (
    <div
      className="shodo-theater-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Trình diễn thư pháp chữ ${kanjiSummary.kanji}`}
    >
      {/* Floating Side Paddles for ergonomic left/right flipping */}
      {onSelectKanji && kanjiSummary.prev_kanji && (
        <button
          type="button"
          className="shodo-side-paddle shodo-side-paddle--prev"
          onClick={(e) => {
            e.stopPropagation()
            if (kanjiSummary.prev_kanji) navigateToKanji(kanjiSummary.prev_kanji, -1)
          }}
          title={`Chữ trước: ${kanjiSummary.prev_kanji} (←)`}
          aria-label={`Chữ trước: ${kanjiSummary.prev_kanji}`}
        >
          <ChevronLeft size={20} strokeWidth={1.6} />
          <span>{kanjiSummary.prev_kanji}</span>
        </button>
      )}

      <div
        className="shodo-theater-scroll shodo-theater-scroll--wide"
        ref={dialogRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {isError && (
          <p role="alert" className="ui-error-text shodo-theater-error-banner">
            Chưa tải được chi tiết chữ.{' '}
            <button type="button" onClick={() => void refetch()}>
              Thử lại
            </button>
          </p>
        )}

        {/* ─── STAGE HEADER ────────────────────────────────────────────────── */}
        <div className="shodo-theater-header">
          <div className="shodo-theater-brand">
            <span className="shodo-theater-hanko" title={isRadicalOnly ? 'Bộ thủ cấu tạo' : 'Ấn triện thư pháp'}>
              {isRadicalOnly ? '部' : '漢'}
            </span>
            <div>
              <span className="shodo-theater-eyebrow">
                {isRadicalOnly ? 'Chuyên khảo Bộ thủ • 部首解説' : 'Thư Pháp Chiết Tự • 書道舞台'}
              </span>
              <div className="shodo-theater-title-row">
                <span className="shodo-theater-title">
                  {stageMode === 'practice' && !quizCompleted
                    ? `？ • ${kanjiSummary.hanzi}`
                    : `${kanjiSummary.kanji} • ${kanjiSummary.hanzi}`}
                </span>
                <span className="shodo-theater-meta-pill">
                  {kanjiSummary.jlpt_level || 'N5'} · {kanjiSummary.stroke_count} nét
                </span>
              </div>
            </div>
          </div>

          <div className="shodo-theater-actions">
            {saveError && (
              <p role="alert" className="ui-error-text">
                {saveError}
              </p>
            )}
            {historyStack.length > 1 && onSelectKanji && (
              <button
                type="button"
                className="shodo-history-back"
                onClick={handleStepBackHistory}
                title="Quay lại chữ vừa xem (Backspace)"
              >
                <ArrowLeft size={13} aria-hidden="true" />
                <span>Quay lại {historyStack[historyStack.length - 2]?.kanji}</span>
              </button>
            )}
            {!isRadicalOnly && (
              <button
                type="button"
                className={`shodo-hanko-seal-btn ${isKanjiSaved ? 'is-stamped' : ''}`}
                onClick={handleSaveKanjiToSrs}
                title={isKanjiSaved ? 'Đã lưu Hán tự vào sổ tay SRS' : 'Lưu Hán tự vào sổ tay SRS'}
                aria-label={isKanjiSaved ? 'Đã lưu sổ tay' : 'Lưu sổ tay'}
              >
                <span className="shodo-hanko-seal-box">
                  <span className="shodo-hanko-seal-glyph">{isKanjiSaved ? '済' : '印'}</span>
                </span>
                <span className="shodo-hanko-seal-label">{isKanjiSaved ? 'Đã lưu SRS' : 'Lưu vào SRS'}</span>
              </button>
            )}
            <button
              type="button"
              className="shodo-theater-hairline-btn shodo-theater-hairline-btn--close"
              onClick={onClose}
              aria-label="Đóng sân khấu thư pháp"
              title="Đóng (Esc)"
            >
              <X size={18} strokeWidth={1.6} />
            </button>
          </div>
        </div>

        {/* ─── 3-REALM MONOGRAPH BODY ──────────────────────────────────────── */}
        <div className="shodo-theater-body">
          <div ref={realmsRef} className="kanji-three-realms">
            {/* ── REALM 1: Bút pháp / Tập viết & Âm đọc (Left) ─────────── */}
            <div className="kanji-realm kanji-realm--visual">
              <div className="kanji-realm-toggle" role="group" aria-label="Chế độ bảng chữ">
                <button
                  type="button"
                  className={`kanji-realm-toggle-btn ${stageMode === 'stroke' ? 'is-active' : ''}`}
                  onClick={() => setStageMode('stroke')}
                >
                  <span>書</span> Bút pháp
                </button>
                <button
                  type="button"
                  className={`kanji-realm-toggle-btn ${stageMode === 'practice' ? 'is-active' : ''}`}
                  onClick={() => {
                    setQuizCompleted(false)
                    setStageMode('practice')
                  }}
                >
                  <PenTool size={12} /> Luyện viết nét
                </button>
                {showIllustrationToggle && (
                  <button
                    type="button"
                    className={`kanji-realm-toggle-btn ${stageMode === 'illustration' ? 'is-active' : ''}`}
                    onClick={() => setStageMode('illustration')}
                  >
                    <Image size={12} /> Minh họa
                  </button>
                )}
              </div>

              {stageMode === 'stroke' && (
                <div className="kanji-realm-calligraphy">
                  <KanjiStrokePlayer kanji={kanjiSummary.kanji} fallbackStrokeCount={kanjiSummary.stroke_count} />
                  <div className="shodo-hero-art">
                    <div className="shodo-hero-hanzi">{kanjiSummary.hanzi}</div>
                    <div className="shodo-hero-meaning">{kanjiSummary.meaning_vi}</div>
                    {(detailData?.secondaryMeanings?.length ?? 0) > 0 && (
                      <div className="shodo-hero-secondary">{detailData?.secondaryMeanings?.join(' · ')}</div>
                    )}
                  </div>
                </div>
              )}

              {stageMode === 'practice' && (
                <div className="kanji-realm-practice">
                  <div className="shodo-practice-inline-head">
                    <span className="shodo-practice-inline-title">
                      Tập viết chữ: <strong>{quizCompleted ? kanjiSummary.kanji : kanjiSummary.hanzi}</strong> (
                      {kanjiSummary.stroke_count} nét)
                    </span>
                  </div>
                  <KanjiStrokeQuiz
                    key={`quiz-${kanjiSummary.kanji}`}
                    kanjiChar={kanjiSummary.kanji}
                    fallbackStrokeCount={kanjiSummary.stroke_count}
                    onCompleteQuiz={() => setQuizCompleted(true)}
                  />
                </div>
              )}

              {stageMode === 'illustration' && showIllustrationToggle && (
                <div className="kanji-realm-illustration">
                  {!illustrationError ? (
                    <div className="kanji-illus-canvas">
                      <img
                        src={illustrationUrl}
                        alt={`Minh họa ${kanjiSummary.kanji} — ${kanjiSummary.hanzi}`}
                        className="kanji-illus-img"
                        onError={() => setIllustrationError(true)}
                      />
                    </div>
                  ) : (
                    <div className="kanji-illus-zen-fallback">
                      <span className="kanji-illus-zen-glyph">{kanjiSummary.kanji}</span>
                      <span className="kanji-illus-zen-note">Bản họa nét mực đang biên soạn</span>
                    </div>
                  )}
                </div>
              )}

              {/* Readings & Radical */}
              <div className="kanji-realm-readings">
                <div className="kanji-reading-chip">
                  <span className="kanji-reading-chip-label">On</span>
                  {parseKanjiReadings(kanjiSummary.onyomi).length > 0 ? (
                    <div className="kanji-reading-pills">
                      {parseKanjiReadings(kanjiSummary.onyomi).map((r, idx) => {
                        const audioId = `reading_on_${idx}`
                        return (
                          <button
                            key={`${r.spoken}-${idx}`}
                            type="button"
                            className={`kanji-reading-pill-btn${playingAudio === audioId ? ' is-playing' : ''}`}
                            onClick={() => speakJapanese(r.spoken, undefined, audioId)}
                            title={`Nghe âm On: ${r.display}`}
                          >
                            <Volume2 size={11} aria-hidden="true" />
                            <span>{r.display}</span>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <span className="kanji-reading-chip-val">—</span>
                  )}
                </div>

                <div className="kanji-reading-chip">
                  <span className="kanji-reading-chip-label">Kun</span>
                  {parseKanjiReadings(kanjiSummary.kunyomi).length > 0 ? (
                    <div className="kanji-reading-pills">
                      {parseKanjiReadings(kanjiSummary.kunyomi).map((r, idx) => {
                        const audioId = `reading_kun_${idx}`
                        return (
                          <button
                            key={`${r.spoken}-${idx}`}
                            type="button"
                            className={`kanji-reading-pill-btn${playingAudio === audioId ? ' is-playing' : ''}`}
                            onClick={() => speakJapanese(r.spoken, undefined, audioId)}
                            title={`Nghe âm Kun: ${r.display}`}
                          >
                            <Volume2 size={11} aria-hidden="true" />
                            <span>{r.display}</span>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <span className="kanji-reading-chip-val">—</span>
                  )}
                </div>

                {kanjiSummary.radical_utf &&
                  kanjiSummary.radical_utf !== '—' &&
                  (onFilterByRadical ? (
                    <button
                      type="button"
                      className="kanji-reading-chip kanji-reading-chip--radical kanji-reading-chip--interactive"
                      onClick={() => onFilterByRadical(kanjiSummary.radical_family || kanjiSummary.radical_utf)}
                      title={`Lọc các chữ cùng bộ ${kanjiSummary.radical_utf}${radicalDisplayName ? ` (${radicalDisplayName})` : ''}`}
                    >
                      <span className="kanji-reading-chip-label">
                        <Layers size={10} /> Bộ {radicalDisplayName || ''}
                      </span>
                      <span className="kanji-reading-chip-val kanji-reading-chip-val--large">
                        {kanjiSummary.radical_utf}
                      </span>
                      <span className="kanji-reading-chip-romaji">Lọc bộ →</span>
                    </button>
                  ) : (
                    <div className="kanji-reading-chip kanji-reading-chip--radical">
                      <span className="kanji-reading-chip-label">
                        <Layers size={10} /> Bộ {radicalDisplayName || ''}
                      </span>
                      <span className="kanji-reading-chip-val kanji-reading-chip-val--large">
                        {kanjiSummary.radical_utf}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* ── REALM 2: Chiết tự, Phả hệ & Chữ liên quan (Center) ───── */}
            <div className="kanji-realm kanji-realm--constellation">
              <div className="kanji-realm-label kanji-realm-label--between">
                <div className="kanji-realm-label-main">
                  <span className="kanji-realm-label-jp">{hasBothLineage ? '系譜図' : '星座図'}</span>
                  <span>
                    {hasBothLineage
                      ? 'Phả hệ Chiết tự · Cấu tạo & Phái sinh'
                      : allComponents.length > 0
                        ? 'Chiết tự & Bộ thủ cấu thành'
                        : 'Phả hệ nở rộng • Chữ phái sinh'}
                  </span>
                </div>
                {hasBothLineage && (
                  <div className="kanji-constellation-mode-tabs" role="group" aria-label="Chế độ sơ đồ phả hệ">
                    <button
                      type="button"
                      className={`kanji-const-mode-btn${graphMode === 'auto' ? ' is-active' : ''}`}
                      onClick={() => setGraphMode('auto')}
                    >
                      Toàn cảnh
                    </button>
                    <button
                      type="button"
                      className={`kanji-const-mode-btn${graphMode === 'components' ? ' is-active' : ''}`}
                      onClick={() => setGraphMode('components')}
                    >
                      Cấu tạo
                    </button>
                    <button
                      type="button"
                      className={`kanji-const-mode-btn${graphMode === 'descendants' ? ' is-active' : ''}`}
                      onClick={() => setGraphMode('descendants')}
                    >
                      Phái sinh
                    </button>
                  </div>
                )}
              </div>

              {hasAnyGraphData ? (
                <KanjiConstellationGraph
                  key={`${kanjiSummary.kanji}-${graphMode}`}
                  kanji={kanjiSummary.kanji}
                  components={allComponents}
                  descendants={descendantNodes}
                  mode={graphMode}
                  onSelectKanji={handleSelectConstellationKanji}
                />
              ) : (
                <div className="kanji-constellation-primitive-note">
                  <span>{kanjiSummary.kanji}</span>
                  <p>Chữ tượng hình / nguyên thể độc lập</p>
                </div>
              )}

              {kanjiSummary.story && (
                <div className="kanji-constellation-story-box">
                  <span className="sr-only">Chiết tự & Câu chuyện gợi nhớ</span>
                  <blockquote className="kanji-constellation-story" title="Chiết tự & Câu chuyện gợi nhớ">
                    「 {kanjiSummary.story} 」
                  </blockquote>
                </div>
              )}

              {((detailData?.relatedByHanzi?.length ?? 0) > 0 || (detailData?.relatedByRadical?.length ?? 0) > 0) &&
                onSelectKanji && (
                  <div className="kanji-related-peers">
                    {(detailData?.relatedByHanzi?.length ?? 0) > 0 && (
                      <div className="kanji-related-peers__group">
                        <span className="kanji-related-peers__label">Cùng âm {kanjiSummary.hanzi}</span>
                        <div className="kanji-related-peers__list">
                          {detailData?.relatedByHanzi?.map((peer) => (
                            <button
                              key={peer.kanji}
                              type="button"
                              className="kanji-related-peer-btn"
                              onClick={() => onSelectKanji(peer.kanji)}
                              title={`${peer.kanji} (${peer.hanzi}) — ${peer.meaning_vi}`}
                            >
                              <strong>{peer.kanji}</strong>
                              <span>{peer.meaning_vi}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {(detailData?.relatedByRadical?.length ?? 0) > 0 && (
                      <div className="kanji-related-peers__group">
                        <span className="kanji-related-peers__label">
                          Cùng bộ {kanjiSummary.radical_utf}
                          {radicalDisplayName ? ` (${radicalDisplayName})` : ''}
                        </span>
                        <div className="kanji-related-peers__list">
                          {detailData?.relatedByRadical?.map((peer) => (
                            <button
                              key={peer.kanji}
                              type="button"
                              className="kanji-related-peer-btn"
                              onClick={() => onSelectKanji(peer.kanji)}
                              title={`${peer.kanji} (${peer.hanzi}) — ${peer.meaning_vi}`}
                            >
                              <strong>{peer.kanji}</strong>
                              <span>{peer.hanzi}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
            </div>

            {/* ── REALM 3: Từ vựng & Audio (Right) ─────────────────────── */}
            <div className="kanji-realm kanji-realm--vocab">
              <div className="kanji-realm-label">
                <span className="kanji-realm-label-jp">{isRadicalOnly ? '漢字例' : '語彙'}</span>
                <span>
                  {isRadicalOnly
                    ? `Chữ tiêu biểu dùng bộ ${kanjiSummary.kanji} (${examples.length})`
                    : `Từ vựng & Audio (${examples.length || kanjiSummary.num_vocab_examples})`}
                </span>
              </div>

              {isLoading ? (
                <div className="shodo-vocab-loading">Đang tải từ vựng...</div>
              ) : examples.length === 0 ? (
                <div className="shodo-vocab-empty">Chưa có từ vựng ví dụ.</div>
              ) : (
                <div className="shodo-vocab-list kanji-realm-vocab-list">
                  {examples.map((item, idx) => {
                    const isSaved = Boolean(savedSrs[`vocab_${item.word}`] || savedSrs[item.word])
                    const audioToken = item.audio || `vocab_${idx}_${item.word}`
                    const sentenceAudioToken = item.audioExample || `sent_${idx}_${item.word}`
                    const isPlaying = playingAudio === audioToken
                    const isPlayingSentence = playingAudio === sentenceAudioToken
                    const otherKanji = onSelectKanji ? extractOtherKanjiChars(item.word, kanjiSummary.kanji) : []

                    return (
                      <div key={idx} className="shodo-vocab-row" style={{ '--vocab-i': idx } as CSSProperties}>
                        <div className="shodo-vocab-main">
                          <div className="shodo-vocab-word-line">
                            <span className="shodo-vocab-index">{String(idx + 1).padStart(2, '0')}</span>
                            <span className="shodo-vocab-word">{item.word}</span>
                            {item.reading && item.reading !== item.word && (
                              <span className="shodo-vocab-reading">〔 {item.reading} 〕</span>
                            )}
                            {item.yinHan && <span className="shodo-vocab-yinhan">{item.yinHan}</span>}
                            {otherKanji.length > 0 && (
                              <span className="shodo-vocab-kanji-jumps">
                                {otherKanji.map((ch) => (
                                  <button
                                    key={ch}
                                    type="button"
                                    className="shodo-vocab-kanji-pill"
                                    onClick={() => onSelectKanji?.(ch)}
                                    title={`Xem chữ ${ch}`}
                                  >
                                    {ch}
                                  </button>
                                ))}
                              </span>
                            )}
                          </div>
                          {item.meaning && <div className="shodo-vocab-meaning">{item.meaning}</div>}
                          {item.example && (
                            <div className="shodo-vocab-example">
                              <div className="shodo-vocab-ex-jp-row">
                                <span className="shodo-vocab-ex-jp">{item.example}</span>
                                <button
                                  type="button"
                                  className={`shodo-sentence-audio-btn${isPlayingSentence ? ' is-playing' : ''}`}
                                  onClick={() =>
                                    speakJapanese(item.example || '', item.audioExample, sentenceAudioToken)
                                  }
                                  aria-label={`Nghe câu ${item.example}`}
                                  title="Nghe câu ví dụ"
                                >
                                  <Volume2 size={12} aria-hidden="true" />
                                  <span>Nghe câu</span>
                                </button>
                              </div>
                              {item.exampleVi && <span className="shodo-vocab-ex-vi">{item.exampleVi}</span>}
                            </div>
                          )}
                        </div>

                        <div className="shodo-vocab-row-actions">
                          <button
                            type="button"
                            className={`shodo-audio-play-btn ${isPlaying ? 'is-playing' : ''}`}
                            onClick={() => speakJapanese(item.reading || item.word, item.audio, audioToken)}
                            title={`Nghe phát âm ${item.word}`}
                            aria-label={`Nghe phát âm ${item.word}`}
                          >
                            <Volume2 size={15} />
                          </button>
                          {!isRadicalOnly && (
                            <button
                              type="button"
                              className={`shodo-vocab-save-btn ${isSaved ? 'is-saved' : ''}`}
                              onClick={() => handleSaveToSrs(item.word, item.meaning, item.reading)}
                              title={isSaved ? 'Đã lưu vào SRS' : 'Lưu từ vào sổ tay SRS'}
                              aria-label={isSaved ? `Đã lưu ${item.word}` : `Lưu ${item.word} vào SRS`}
                            >
                              {isSaved ? <Check size={14} /> : <BookmarkPlus size={14} />}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {onSelectKanji && kanjiSummary.next_kanji && (
        <button
          type="button"
          className="shodo-side-paddle shodo-side-paddle--next"
          onClick={(e) => {
            e.stopPropagation()
            if (kanjiSummary.next_kanji) navigateToKanji(kanjiSummary.next_kanji, 1)
          }}
          title={`Chữ kế: ${kanjiSummary.next_kanji} (→)`}
          aria-label={`Chữ kế: ${kanjiSummary.next_kanji}`}
        >
          <span>{kanjiSummary.next_kanji}</span>
          <ChevronRight size={20} strokeWidth={1.6} />
        </button>
      )}
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent
}
export default KanjiDetailModal
