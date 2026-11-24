import { useDialogAccessibility } from '../../lib/useDialogAccessibility'
import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  X,
  Volume2,
  PenTool,
  BookOpen,
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
import { KanjiCanvas } from './KanjiCanvas'
import { KanjiStrokeQuiz } from './KanjiStrokeQuiz'
import { KanjiConstellationGraph, type ConstellationMode } from './KanjiConstellationGraph'
import { KanjiStrokePlayer } from './KanjiStrokePlayer'
import { srsApi } from '../srs/srsApi'
import { useAuth } from '../auth/authContext'
import { sumiAudio } from '../dictionary/sumiAudio'
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

export function KanjiDetailModal({ kanjiSummary, onClose, onSelectKanji, onFilterByRadical }: KanjiDetailModalProps) {
  const { user } = useAuth()
  const [saveError, setSaveError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'info' | 'practice'>('info')
  const [practiceMode, setPracticeMode] = useState<'quiz' | 'brush'>('quiz')
  const [viewMode, setViewMode] = useState<'calligraphy' | 'illustration'>('calligraphy')
  const [graphMode, setGraphMode] = useState<ConstellationMode>('auto')
  const [playingAudio, setPlayingAudio] = useState<string | null>(null)
  const [savedSrs, setSavedSrs] = useState<Record<string, boolean>>({})
  const [illustrationError, setIllustrationError] = useState(false)
  const [historyStack, setHistoryStack] = useState<KanjiSummary[]>([kanjiSummary])
  const dialogRef = useRef<HTMLDivElement>(null)
  useDialogAccessibility(dialogRef, onClose)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const queryClient = useQueryClient()

  // Update exploration history stack whenever focal kanji changes
  useEffect(() => {
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
      onSelectKanji(previous.kanji)
    }
  }, [historyStack, onSelectKanji])

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
        onSelectKanji(kanjiSummary.prev_kanji)
      } else if (e.key === 'ArrowRight' && kanjiSummary.next_kanji && onSelectKanji) {
        e.preventDefault()
        onSelectKanji(kanjiSummary.next_kanji)
      } else if (e.key === 'Backspace' && historyStack.length > 1 && onSelectKanji) {
        e.preventDefault()
        handleStepBackHistory()
      } else if (e.key === '1') {
        setActiveTab('info')
      } else if (e.key === '2') {
        setActiveTab('practice')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [kanjiSummary.prev_kanji, kanjiSummary.next_kanji, onSelectKanji, historyStack.length, handleStepBackHistory])

  useEffect(() => {
    setIllustrationError(false)
    setSaveError(null)
    setGraphMode('auto')
    setViewMode('calligraphy')
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

  // Hide illustration view if backend reports no illustration asset exists
  const showIllustrationToggle = detailData?.hasIllustration !== false && !detailData?.isRadicalOnly
  useEffect(() => {
    if (!showIllustrationToggle && viewMode === 'illustration') {
      setViewMode('calligraphy')
    }
  }, [showIllustrationToggle, viewMode])

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
  const descendantNodes = useMemo(() => getKanjiDescendants(kanjiSummary.kanji), [kanjiSummary.kanji])
  const illustrationUrl = apiPaths.nhaikanji.kanjiIllustration(kanjiSummary.kanji)

  const isPrimitive = allComponents.length === 0
  const hasBothLineage = allComponents.length > 0 && descendantNodes.length > 0
  const hasAnyGraphData = allComponents.length > 0 || descendantNodes.length > 0

  const handleSelectConstellationKanji = (k: string) => {
    if (onSelectKanji) onSelectKanji(k)
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
                  {kanjiSummary.kanji} • {kanjiSummary.hanzi}
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

            {onSelectKanji && (
              <div className="shodo-theater-nav-group" role="group" aria-label="Chuyển chữ theo thứ tự">
                <button
                  type="button"
                  className="shodo-theater-hairline-btn"
                  disabled={!kanjiSummary.prev_kanji}
                  onClick={() => kanjiSummary.prev_kanji && onSelectKanji(kanjiSummary.prev_kanji)}
                  title={kanjiSummary.prev_kanji ? `Chữ trước: ${kanjiSummary.prev_kanji} (←)` : 'Đầu danh sách'}
                  aria-label={kanjiSummary.prev_kanji ? `Chữ trước: ${kanjiSummary.prev_kanji}` : 'Chữ trước'}
                >
                  <ChevronLeft size={17} strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  className="shodo-theater-hairline-btn"
                  disabled={!kanjiSummary.next_kanji}
                  onClick={() => kanjiSummary.next_kanji && onSelectKanji(kanjiSummary.next_kanji)}
                  title={kanjiSummary.next_kanji ? `Chữ kế: ${kanjiSummary.next_kanji} (→)` : 'Cuối danh sách'}
                  aria-label={kanjiSummary.next_kanji ? `Chữ kế: ${kanjiSummary.next_kanji}` : 'Chữ kế'}
                >
                  <ChevronRight size={17} strokeWidth={1.5} />
                </button>
              </div>
            )}

            <button
              type="button"
              className="shodo-theater-hairline-btn shodo-theater-hairline-btn--close"
              onClick={onClose}
              aria-label="Đóng sân khấu thư pháp"
              title="Đóng (Esc)"
            >
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* ─── EXPLORATION BREADCRUMB TRAIL ────────────────────────────────── */}
        {historyStack.length > 1 && onSelectKanji && (
          <nav className="shodo-history-bar" aria-label="Lộ trình khám phá Hán tự">
            <button
              type="button"
              className="shodo-history-back"
              onClick={handleStepBackHistory}
              title="Quay lại chữ vừa xem (Backspace)"
            >
              <ArrowLeft size={13} aria-hidden="true" />
              <span>Quay lại {historyStack[historyStack.length - 2]?.kanji}</span>
            </button>
            <ol className="shodo-history-crumbs">
              {historyStack.map((item, idx) => {
                const isLast = idx === historyStack.length - 1
                return (
                  <li key={`${item.kanji}-${idx}`}>
                    {idx > 0 && <span className="shodo-history-sep">›</span>}
                    {isLast ? (
                      <span className="shodo-history-current" aria-current="page">
                        {item.kanji}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="shodo-history-crumb-btn"
                        onClick={() => onSelectKanji(item.kanji)}
                      >
                        {item.kanji}
                      </button>
                    )}
                  </li>
                )
              })}
            </ol>
          </nav>
        )}

        {/* ─── STAGE TABS ──────────────────────────────────────────────────── */}
        <div className="shodo-theater-tabs">
          <button
            type="button"
            className={`shodo-theater-tab ${activeTab === 'info' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            <BookOpen size={15} />
            <span>
              {isRadicalOnly
                ? `Bộ thủ & Chữ tiêu biểu (${examples.length})`
                : `Trình diễn & Chiết tự (${examples.length || kanjiSummary.num_vocab_examples} từ vựng)`}
            </span>
          </button>
          <button
            type="button"
            className={`shodo-theater-tab ${activeTab === 'practice' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('practice')}
          >
            <PenTool size={15} />
            <span>Luyện viết nét ({kanjiSummary.stroke_count} nét)</span>
          </button>
        </div>

        {/* ─── STAGE CONTENT ───────────────────────────────────────────────── */}
        <div className="shodo-theater-body">
          {activeTab === 'practice' ? (
            <div className="shodo-practice-layout">
              <div className="shodo-practice-view">
                <div className="shodo-practice-head">
                  <h3 className="shodo-practice-title">
                    Tập viết chữ: <span className="shodo-practice-char">{kanjiSummary.kanji}</span> (
                    {kanjiSummary.stroke_count} nét)
                  </h3>
                  <div className="shodo-practice-mode-switch" role="group" aria-label="Chế độ luyện viết">
                    <button
                      type="button"
                      className={`shodo-practice-mode-btn${practiceMode === 'quiz' ? ' is-active' : ''}`}
                      onClick={() => setPracticeMode('quiz')}
                    >
                      Chấm nét chuẩn
                    </button>
                    <button
                      type="button"
                      className={`shodo-practice-mode-btn${practiceMode === 'brush' ? ' is-active' : ''}`}
                      onClick={() => setPracticeMode('brush')}
                    >
                      Vung cọ tự do
                    </button>
                  </div>
                </div>

                {practiceMode === 'quiz' ? (
                  <KanjiStrokeQuiz
                    key={`quiz-${kanjiSummary.kanji}`}
                    kanjiChar={kanjiSummary.kanji}
                    fallbackStrokeCount={kanjiSummary.stroke_count}
                  />
                ) : (
                  <>
                    <p className="shodo-practice-desc">
                      Dùng chuột hoặc ngón tay để vẽ các nét theo chữ mẫu mờ bên dưới
                    </p>
                    <KanjiCanvas kanjiChar={kanjiSummary.kanji} />
                  </>
                )}
              </div>

              <aside className="shodo-practice-aside" aria-label="Ghi chú luyện viết">
                <div className="shodo-practice-aside__card">
                  <span className="shodo-practice-aside__label">Âm Hán-Việt &amp; Nghĩa</span>
                  <strong className="shodo-practice-aside__hanzi">{kanjiSummary.hanzi}</strong>
                  <p className="shodo-practice-aside__meaning">{kanjiSummary.meaning_vi}</p>
                </div>
                {kanjiSummary.radical_utf && kanjiSummary.radical_utf !== '—' && (
                  <div className="shodo-practice-aside__card">
                    <span className="shodo-practice-aside__label">Bộ thủ chủ đạo</span>
                    <div className="shodo-practice-aside__rad">
                      <span>{kanjiSummary.radical_utf}</span>
                      <div>
                        <strong>{radicalDisplayName ? `Bộ ${radicalDisplayName}` : 'Bộ thủ'}</strong>
                        <small>{kanjiSummary.radical_meaning}</small>
                      </div>
                    </div>
                  </div>
                )}
                {kanjiSummary.story && (
                  <div className="shodo-practice-aside__card">
                    <span className="shodo-practice-aside__label">Mẹo nhớ chiết tự</span>
                    <p className="shodo-practice-aside__story">「 {kanjiSummary.story} 」</p>
                  </div>
                )}
              </aside>
            </div>
          ) : (
            /* ═══════════════════════════════════════════════════════════════
               3-REALM LAYOUT: Thư pháp | Phả hệ | Từ vựng
               ═══════════════════════════════════════════════════════════════ */
            <div
              className={`kanji-three-realms${!hasAnyGraphData ? ' kanji-three-realms--two-col' : ''}${isPrimitive && hasAnyGraphData ? ' kanji-three-realms--compound-only' : ''}`}
            >
              {/* ── REALM 1: Thư pháp & Âm đọc (Left) ───────────────────── */}
              <div className="kanji-realm kanji-realm--visual">
                {showIllustrationToggle && (
                  <div className="kanji-realm-toggle">
                    <button
                      type="button"
                      className={`kanji-realm-toggle-btn ${viewMode === 'calligraphy' ? 'is-active' : ''}`}
                      onClick={() => setViewMode('calligraphy')}
                    >
                      <span>書</span> Thư pháp
                    </button>
                    <button
                      type="button"
                      className={`kanji-realm-toggle-btn ${viewMode === 'illustration' ? 'is-active' : ''}`}
                      onClick={() => setViewMode('illustration')}
                    >
                      <Image size={13} /> Minh họa
                    </button>
                  </div>
                )}

                {viewMode === 'calligraphy' && (
                  <div className="kanji-realm-calligraphy">
                    <KanjiStrokePlayer kanji={kanjiSummary.kanji} fallbackStrokeCount={kanjiSummary.stroke_count} />
                    <div className="shodo-hero-art">
                      <div className="shodo-hero-hanzi">{kanjiSummary.hanzi}</div>
                      <div className="shodo-hero-meaning">{kanjiSummary.meaning_vi}</div>
                      {(detailData?.secondaryMeanings?.length ?? 0) > 0 && (
                        <div className="shodo-hero-secondary">{detailData?.secondaryMeanings?.join(' · ')}</div>
                      )}
                      <div className="shodo-hero-meta-line">
                        {kanjiSummary.stroke_count} nét · {kanjiSummary.jlpt_level}
                      </div>
                    </div>
                  </div>
                )}

                {viewMode === 'illustration' && showIllustrationToggle && (
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
                    {kanjiSummary.story && (
                      <div className="kanji-illus-caption">
                        <span className="kanji-illus-caption-quote">「</span>
                        <span className="kanji-illus-caption-text">{kanjiSummary.story}</span>
                        <span className="kanji-illus-caption-quote">」</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Readings & Radical */}
                <div className="kanji-realm-readings">
                  <button
                    type="button"
                    className={`kanji-reading-chip kanji-reading-chip--interactive${playingAudio === 'reading_on' ? ' is-playing' : ''}`}
                    disabled={!kanjiSummary.onyomi}
                    onClick={() => kanjiSummary.onyomi && speakJapanese(kanjiSummary.onyomi, undefined, 'reading_on')}
                    title={kanjiSummary.onyomi ? 'Bấm để nghe âm On' : 'Không có âm On'}
                  >
                    <span className="kanji-reading-chip-label">
                      On {kanjiSummary.onyomi && <Volume2 size={10} aria-hidden="true" />}
                    </span>
                    <span className="kanji-reading-chip-val">{kanjiSummary.onyomi || '—'}</span>
                    {detailData?.phonetics?.onyomiRomaji && (
                      <span className="kanji-reading-chip-romaji">{detailData.phonetics.onyomiRomaji}</span>
                    )}
                  </button>

                  <button
                    type="button"
                    className={`kanji-reading-chip kanji-reading-chip--interactive${playingAudio === 'reading_kun' ? ' is-playing' : ''}`}
                    disabled={!kanjiSummary.kunyomi}
                    onClick={() =>
                      kanjiSummary.kunyomi && speakJapanese(kanjiSummary.kunyomi, undefined, 'reading_kun')
                    }
                    title={kanjiSummary.kunyomi ? 'Bấm để nghe âm Kun' : 'Không có âm Kun'}
                  >
                    <span className="kanji-reading-chip-label">
                      Kun {kanjiSummary.kunyomi && <Volume2 size={10} aria-hidden="true" />}
                    </span>
                    <span className="kanji-reading-chip-val">{kanjiSummary.kunyomi || '—'}</span>
                    {detailData?.phonetics?.kunyomiRomaji && (
                      <span className="kanji-reading-chip-romaji">{detailData.phonetics.kunyomiRomaji}</span>
                    )}
                  </button>

                  {kanjiSummary.radical_utf && kanjiSummary.radical_utf !== '—' && (
                    <button
                      type="button"
                      className={`kanji-reading-chip kanji-reading-chip--radical${onFilterByRadical ? ' kanji-reading-chip--interactive' : ''}`}
                      disabled={!onFilterByRadical}
                      onClick={() => onFilterByRadical?.(kanjiSummary.radical_family || kanjiSummary.radical_utf)}
                      title={
                        onFilterByRadical
                          ? `Lọc các chữ cùng bộ ${kanjiSummary.radical_utf}${radicalDisplayName ? ` (${radicalDisplayName})` : ''}`
                          : undefined
                      }
                    >
                      <span className="kanji-reading-chip-label">
                        <Layers size={10} /> Bộ {radicalDisplayName || ''}
                      </span>
                      <span className="kanji-reading-chip-val kanji-reading-chip-val--large">
                        {kanjiSummary.radical_utf}
                      </span>
                      {onFilterByRadical && <span className="kanji-reading-chip-romaji">Lọc bộ →</span>}
                    </button>
                  )}
                </div>
              </div>

              {/* ── REALM 2: Phả hệ Chiết tự & Đồng âm / Cùng bộ (Center) ─ */}
              {hasAnyGraphData && (
                <div className="kanji-realm kanji-realm--constellation">
                  <div className="kanji-realm-label kanji-realm-label--between">
                    <div className="kanji-realm-label-main">
                      <span className="kanji-realm-label-jp">{hasBothLineage ? '系譜図' : '星座図'}</span>
                      <span>
                        {hasBothLineage
                          ? 'Phả hệ Chiết tự · Cấu tạo & Phái sinh'
                          : allComponents.length > 0
                            ? 'Phả hệ Chiết tự • Bộ thủ cấu thành'
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

                  <KanjiConstellationGraph
                    key={`${kanjiSummary.kanji}-${graphMode}`}
                    kanji={kanjiSummary.kanji}
                    components={allComponents}
                    descendants={descendantNodes}
                    mode={graphMode}
                    onSelectKanji={handleSelectConstellationKanji}
                  />

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
              )}

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
                        <div key={idx} className="shodo-vocab-row">
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
          )}
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent
}
export default KanjiDetailModal
