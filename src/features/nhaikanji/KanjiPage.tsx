import { useDebouncedValue } from '../../lib/useDebouncedValue'
import { useUrlState } from '../../lib/useUrlState'
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import gsap from 'gsap'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, ChevronLeft, ChevronRight, X, Bookmark, BookmarkCheck, PenTool, RotateCcw } from 'lucide-react'
import { nhaikanjiApi } from './nhaikanjiApi'
import type { KanjiSummary } from './nhaikanjiTypes'
import { KanjiDetailModal } from './KanjiDetailModal'
import { KanjiHandwritingPad } from './KanjiHandwritingPad'
import { Button } from '../../components/ui'
import { srsApi } from '../srs/srsApi'
import { useAuth } from '../auth/authContext'
import { playPaperFlip, playStampSuccess } from '../vocabulary/soundEngine'
import { playWashiPaperSound } from '../vocabulary/tactileAudio'

const JLPT_LEVELS = ['ALL', 'N5', 'N4', 'N3', 'N2', 'N1'] as const
const KANJI_BOOK_FILTERS = [
  { id: 'ALL', label: 'Tất cả sách' },
  { id: '1', label: 'Hack Não Tập 1' },
  { id: '2', label: 'Hack Não Tập 2' },
  { id: '3', label: 'Hack Não Tập 3' },
] as const
const DEFAULT_LIMIT = 48

function getVisiblePages(currentPage: number, totalPages: number): (number | string)[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, '...', totalPages]
  }
  if (currentPage >= totalPages - 3) {
    return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
  }
  return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages]
}

interface KanjiPageProps {
  query?: string
  viewMode?: 'grid' | 'ink'
  onChangeViewMode?: (mode: 'grid' | 'ink') => void
  inkContent?: ReactNode
  onGoToSrs?: () => void
}

export function KanjiPage({ query, viewMode = 'grid', onChangeViewMode, inkContent, onGoToSrs }: KanjiPageProps = {}) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const ledgerTopRef = useRef<HTMLDivElement>(null)

  const [selectedLevel, setSelectedLevel] = useUrlState<string>('klevel', 'ALL', JLPT_LEVELS)
  const [selectedBook, setSelectedBook] = useUrlState<string>('kbook', 'ALL', ['ALL', '1', '2', '3'])
  const [urlKanjiChar, setUrlKanjiChar] = useUrlState<string>('kanji', '')

  const [searchQuery, setSearchQuery] = useState(query ?? '')
  const debouncedSearchQuery = useDebouncedValue(searchQuery)
  const [page, setPage] = useState(1)
  const [onlySaved, setOnlySaved] = useState(false)
  const [studyMode, setStudyMode] = useState(false)
  const [studyIdx, setStudyIdx] = useState(0)
  const [studyFlipped, setStudyFlipped] = useState(false)
  const [studyHasFlipped, setStudyHasFlipped] = useState(false)
  const [studyInstantSwap, setStudyInstantSwap] = useState(false)
  const [studyDealTick, setStudyDealTick] = useState(0)
  const [studyDealDir, setStudyDealDir] = useState<1 | -1>(1)
  const studySceneRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const didMountGridRef = useRef(false)
  const [isHandwritingOpen, setIsHandwritingOpen] = useState(false)
  const [selectedKanji, setSelectedKanji] = useState<KanjiSummary | null>(null)
  const [optimisticSaved, setOptimisticSaved] = useState<Record<string, boolean>>({})
  const [savingKanji, setSavingKanji] = useState<string | null>(null)

  useEffect(() => {
    if (typeof query === 'string') {
      setSearchQuery(query)
      setPage(1)
    }
  }, [query])

  const effectiveLimit = onlySaved ? 3000 : DEFAULT_LIMIT
  const selectedTap = selectedBook === 'ALL' ? undefined : Number(selectedBook)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['nhaikanji', 'kanjiList', selectedLevel, selectedBook, debouncedSearchQuery, page, effectiveLimit],
    queryFn: () =>
      nhaikanjiApi.fetchKanjiList({
        level: selectedLevel,
        ...(selectedTap ? { tap: selectedTap } : {}),
        query: debouncedSearchQuery,
        page: onlySaved ? 1 : page,
        limit: effectiveLimit,
      }),
    enabled: viewMode !== 'ink',
    placeholderData: (prev) => prev,
  })

  const { data: savedTermsData } = useQuery({
    queryKey: ['srs', user?.id ?? 'me', 'saved-terms'],
    queryFn: () => srsApi.fetchSavedTerms(),
    enabled: Boolean(user) && typeof srsApi?.fetchSavedTerms === 'function',
    staleTime: 30_000,
  })

  const savedKanjiSet = useMemo(() => {
    const set = new Set<string>()
    if (Array.isArray(savedTermsData)) {
      for (const entry of savedTermsData) {
        if (entry?.term && (entry.type === 'kanji' || entry.term.length === 1)) {
          set.add(entry.term)
        }
      }
    }
    for (const [k, v] of Object.entries(optimisticSaved)) {
      if (v) set.add(k)
    }
    return set
  }, [savedTermsData, optimisticSaved])

  // Sync deep-linked ?kanji=漢 param with modal state
  useEffect(() => {
    if (!urlKanjiChar) {
      setSelectedKanji(null)
      return
    }
    if (selectedKanji?.kanji === urlKanjiChar) return
    const inList = data?.items.find((item) => item.kanji === urlKanjiChar)
    if (inList) {
      setSelectedKanji(inList)
      return
    }
    let cancelled = false
    void nhaikanjiApi
      .fetchKanjiList({ query: urlKanjiChar, limit: 5 })
      .then((res) => {
        if (cancelled) return
        const exact = res.items.find((item) => item.kanji === urlKanjiChar) ?? res.items[0]
        if (exact) setSelectedKanji(exact)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [urlKanjiChar, data?.items, selectedKanji?.kanji])

  const openKanjiModal = (item: KanjiSummary) => {
    setSelectedKanji(item)
    setUrlKanjiChar(item.kanji)
  }

  const closeKanjiModal = () => {
    setSelectedKanji(null)
    setUrlKanjiChar('')
  }

  const handleKanjiSelectByChar = async (char: string) => {
    const target = data?.items.find((item) => item.kanji === char)
    if (target) {
      openKanjiModal(target)
      return
    }
    try {
      const res = await nhaikanjiApi.fetchKanjiList({ query: char, limit: 10 })
      const exact = res.items.find((item) => item.kanji === char)
      if (exact) {
        openKanjiModal(exact)
        return
      }
    } catch {
      // ignore and fall back to detail lookup
    }
    if (typeof nhaikanjiApi.fetchKanjiDetail === 'function') {
      try {
        const detailRes = await nhaikanjiApi.fetchKanjiDetail(char)
        if (detailRes?.summary) {
          openKanjiModal(detailRes.summary)
        }
      } catch {
        // ignore
      }
    }
  }

  const handleSaveCard = async (e: React.MouseEvent, item: KanjiSummary) => {
    e.stopPropagation()
    if (savedKanjiSet.has(item.kanji) || savingKanji === item.kanji) return
    setSavingKanji(item.kanji)
    setOptimisticSaved((prev) => ({ ...prev, [item.kanji]: true }))
    playStampSuccess()
    try {
      await srsApi.addCard({
        type: 'kanji',
        term: item.kanji,
        hanViet: item.hanzi,
        meaning: item.meaning_vi,
        reading: [item.onyomi, item.kunyomi].filter(Boolean).join(' · '),
        jlptLevel: item.jlpt_level,
        radical: item.radical_utf,
        strokeCount: Number(item.stroke_count) || undefined,
        story: item.story,
      })
      await queryClient.invalidateQueries({ queryKey: ['srs', user?.id ?? 'me', 'saved-terms'] })
    } catch {
      setOptimisticSaved((prev) => ({ ...prev, [item.kanji]: false }))
    } finally {
      setSavingKanji(null)
    }
  }

  const handleLevelChange = (level: string) => {
    if (level !== selectedLevel) playWashiPaperSound()
    setSelectedLevel(level)
    setPage(1)
  }

  const handleSearchChange = (val: string) => {
    setSearchQuery(val)
    setPage(1)
  }

  const resetAllFilters = () => {
    setSearchQuery('')
    setSelectedLevel('ALL')
    setSelectedBook('ALL')
    setOnlySaved(false)
    setPage(1)
  }

  const goToPage = (nextPage: number) => {
    setPage(nextPage)
    if (ledgerTopRef.current && typeof ledgerTopRef.current.scrollIntoView === 'function') {
      ledgerTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const displayedItems = useMemo(() => {
    const items = data?.items ?? []
    if (!onlySaved) return items
    return items.filter((item) => savedKanjiSet.has(item.kanji))
  }, [data?.items, onlySaved, savedKanjiSet])

  useEffect(() => {
    setStudyIdx(0)
    setStudyFlipped(false)
    setStudyHasFlipped(false)
  }, [selectedLevel, debouncedSearchQuery, onlySaved, page])

  const activeStudyKanji = displayedItems[studyIdx] ?? displayedItems[0] ?? null

  const stepStudyCard = useCallback(
    (dir: 1 | -1) => {
      if (dir < 0 && studyIdx <= 0) return
      if (dir > 0 && studyIdx >= displayedItems.length - 1) return
      setStudyInstantSwap(true)
      setStudyFlipped(false)
      setStudyHasFlipped(false)
      setStudyDealDir(dir)
      setStudyDealTick((t) => t + 1)
      setStudyIdx((i) => Math.min(displayedItems.length - 1, Math.max(0, i + dir)))
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => setStudyInstantSwap(false))
        })
      } else {
        setStudyInstantSwap(false)
      }
    },
    [studyIdx, displayedItems.length]
  )

  useLayoutEffect(() => {
    if (studyDealTick === 0) return
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const el = studySceneRef.current
    if (!el) return
    gsap.killTweensOf(el)
    gsap.fromTo(
      el,
      { x: studyDealDir * 60, y: 3, rotationZ: studyDealDir * 1.2, scale: 0.985 },
      { x: 0, y: 0, rotationZ: 0, scale: 1, duration: 0.38, ease: 'power3.out', clearProps: 'transform' }
    )
  }, [studyDealTick, studyDealDir])

  useLayoutEffect(() => {
    if (!didMountGridRef.current) {
      didMountGridRef.current = true
      return
    }
    if (studyMode || viewMode === 'ink') return
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const gridEl = gridRef.current
    if (!gridEl) return
    const cards = gridEl.querySelectorAll<HTMLElement>('.kanji-card')
    if (!cards.length) return
    gsap.killTweensOf(cards)
    gsap.fromTo(
      cards,
      { y: 12, scale: 0.985 },
      { y: 0, scale: 1, duration: 0.28, stagger: 0.008, ease: 'power2.out', clearProps: 'transform' }
    )
  }, [selectedLevel, selectedBook, onlySaved, page, studyMode, viewMode])

  useEffect(() => {
    if (!studyMode || viewMode === 'ink' || selectedKanji || displayedItems.length === 0) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === ' ') {
        e.preventDefault()
        playPaperFlip()
        setStudyInstantSwap(false)
        setStudyHasFlipped(true)
        setStudyFlipped((f) => !f)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        stepStudyCard(-1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        stepStudyCard(1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [studyMode, viewMode, selectedKanji, displayedItems.length, stepStudyCard])

  const hasActiveFilters =
    selectedLevel !== 'ALL' || selectedBook !== 'ALL' || onlySaved || Boolean(debouncedSearchQuery)

  if (isError && viewMode !== 'ink') {
    return (
      <section className="ui-status-panel" role="alert">
        <h1>Chưa tải được Hán tự</h1>
        <p>Kiểm tra kết nối rồi thử lại.</p>
        <Button onClick={() => void refetch()}>Thử lại</Button>
      </section>
    )
  }

  return (
    <div className="kanji-ledger-root" ref={ledgerTopRef}>
      <h1 className="sr-only">Kho Hán Tự (Kanji) & Chiết Tự</h1>

      {/* 1. Synchronized Search Console & View Switcher */}
      <div className="kanji-ledger-topbar">
        <div className="kanji-search-console">
          <div className="nhaikanji-search-box kanji-search-box--wide">
            <Search size={16} className="nhaikanji-search-icon" aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Tìm Kanji theo Hán-Việt (nhân), Romaji (hito), Furigana (ひと), nghĩa..."
              aria-label="Tìm kiếm Hán tự"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => handleSearchChange('')}
                className="nhaikanji-search-clear"
                aria-label="Xóa từ khóa Hán tự"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <button
            type="button"
            className={`kanji-draw-toggle-btn${isHandwritingOpen ? ' is-active' : ''}`}
            aria-expanded={isHandwritingOpen}
            onClick={() => setIsHandwritingOpen((open) => !open)}
            title="Vẽ chữ Kanji bằng tay để tìm kiếm"
          >
            <PenTool size={14} aria-hidden="true" />
            <span>Vẽ chữ</span>
          </button>
        </div>

        {onChangeViewMode && (
          <div className="kanji-view-segmented" role="group" aria-label="Cách xem Hán tự">
            <button
              type="button"
              className={`kanji-view-segmented__btn${viewMode === 'grid' && !studyMode ? ' is-active' : ''}`}
              aria-pressed={viewMode === 'grid' && !studyMode}
              onClick={() => {
                setStudyMode(false)
                onChangeViewMode('grid')
              }}
            >
              Danh sách
            </button>
            <button
              type="button"
              className={`kanji-view-segmented__btn${viewMode === 'grid' && studyMode ? ' is-active' : ''}`}
              aria-pressed={viewMode === 'grid' && studyMode}
              onClick={() => {
                if (viewMode !== 'grid') {
                  onChangeViewMode('grid')
                  setStudyMode(true)
                } else {
                  setStudyMode((prev) => !prev)
                }
              }}
            >
              Lật thẻ
            </button>
            <button
              type="button"
              className={`kanji-view-segmented__btn${viewMode === 'ink' ? ' is-active' : ''}`}
              aria-pressed={viewMode === 'ink'}
              onClick={() => {
                setStudyMode(false)
                onChangeViewMode('ink')
              }}
            >
              Thủy mặc
            </button>
          </div>
        )}
      </div>

      {/* Collapsible Handwriting Recognition Pad */}
      {isHandwritingOpen && (
        <KanjiHandwritingPad
          onSelectKanji={(cand) => {
            setIsHandwritingOpen(false)
            openKanjiModal(cand)
          }}
          onClose={() => setIsHandwritingOpen(false)}
        />
      )}

      {/* 2. View Body: Ink Mode vs Grid / Flashcard */}
      {viewMode === 'ink' ? (
        <div className="kanji-ink-body">{inkContent}</div>
      ) : (
        <>
          {/* JLPT Hairline Tabs + Saved SRS Filter */}
          <section className="kanji-ledger-controls" aria-label="Bộ lọc Hán tự">
            <div className="kanji-ledger-row-a">
              <div className="nhaikanji-tab-group" role="tablist" aria-label="Cấp độ JLPT">
                {JLPT_LEVELS.map((lvl) => {
                  const count = data?.levelCounts?.[lvl]
                  return (
                    <button
                      key={lvl}
                      type="button"
                      role="tab"
                      aria-selected={selectedLevel === lvl}
                      className={`nhaikanji-tab-btn${selectedLevel === lvl ? ' is-active' : ''}`}
                      onClick={() => handleLevelChange(lvl)}
                    >
                      <span>{lvl === 'ALL' ? 'Tất cả' : `Kanji ${lvl}`}</span>
                      {typeof count === 'number' && <small className="kanji-tab-count">{count}</small>}
                    </button>
                  )
                })}
              </div>

              <div className="kanji-ledger-triggers">
                {hasActiveFilters && (
                  <button type="button" className="kanji-reset-link" onClick={resetAllFilters}>
                    <RotateCcw size={12} aria-hidden="true" />
                    <span>Đặt lại</span>
                  </button>
                )}

                <button
                  type="button"
                  className={`kanji-trigger-btn${onlySaved ? ' is-active' : ''}`}
                  aria-pressed={onlySaved}
                  onClick={() => {
                    setOnlySaved((prev) => !prev)
                    setPage(1)
                  }}
                  title="Lọc các chữ Hán đã lưu vào Sổ tay SRS"
                >
                  <Bookmark size={14} aria-hidden="true" />
                  <span>Đã lưu{savedKanjiSet.size > 0 ? ` (${savedKanjiSet.size})` : ''}</span>
                </button>

                {onGoToSrs && savedKanjiSet.size > 0 && (
                  <button
                    type="button"
                    className="curriculum-hanko-srs-pill"
                    onClick={onGoToSrs}
                    title="Mở Sổ tay ôn tập SRS"
                  >
                    <span className="curriculum-hanko-srs-pill__stamp" aria-hidden="true">
                      記
                    </span>
                    <span className="curriculum-hanko-srs-pill__action">Ôn tập SRS ›</span>
                  </button>
                )}
              </div>
            </div>

            <div
              className="curriculum-series-bar"
              role="tablist"
              aria-label="Lọc Hán tự theo cuốn sách"
              style={{ marginTop: '0.55rem', marginBottom: 0 }}
            >
              <span className="curriculum-series-bar__label">Cuốn sách:</span>
              <div className="curriculum-series-bar__list">
                {KANJI_BOOK_FILTERS.map((book) => {
                  const isActive = selectedBook === book.id
                  return (
                    <button
                      key={book.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      className={`curriculum-series-btn${isActive ? ' is-active' : ''}`}
                      onClick={() => {
                        if (book.id !== selectedBook) playWashiPaperSound()
                        setSelectedBook(book.id)
                        setPage(1)
                      }}
                    >
                      {book.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </section>

          {/* 3. Kanji Specimen Grid or Inline Flashcard Stage */}
          {isLoading && !data ? (
            <div className="kanji-grid" aria-busy="true" aria-label="Đang tải danh sách Hán tự">
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className="kanji-card kanji-card--skeleton" />
              ))}
            </div>
          ) : displayedItems.length === 0 ? (
            <div className="kanji-empty-ledger">
              <span className="kanji-empty-ledger__glyph" aria-hidden="true">
                無
              </span>
              <p>
                {onlySaved
                  ? 'Chưa có chữ Hán nào phù hợp được lưu vào Sổ tay SRS.'
                  : `Không tìm thấy Hán tự nào phù hợp${debouncedSearchQuery ? ` với “${debouncedSearchQuery}”` : ''}.`}
              </p>
              <Button variant="secondary" size="sm" onClick={resetAllFilters}>
                Đặt lại bộ lọc
              </Button>
            </div>
          ) : studyMode && activeStudyKanji ? (
            <div className="kanji-flashcard-stage" role="region" aria-label="Ôn nhanh Hán tự dạng thẻ">
              <div className="kanji-flashcard-meta">
                <span>
                  Thẻ <strong>{studyIdx + 1}</strong> / {displayedItems.length}
                </span>
                <span>
                  {activeStudyKanji.jlpt_level} · {activeStudyKanji.stroke_count} nét
                  {activeStudyKanji.radical_utf && activeStudyKanji.radical_utf !== '—'
                    ? ` · Bộ ${activeStudyKanji.radical_utf}`
                    : ''}
                </span>
              </div>

              <div ref={studySceneRef} className="washi-3d-scene">
                <div
                  role="button"
                  tabIndex={0}
                  className={`washi-3d-flipper${studyFlipped ? ' is-flipped' : ''}${studyInstantSwap ? ' is-instant' : ''}`}
                  onClick={() => {
                    playPaperFlip()
                    setStudyInstantSwap(false)
                    setStudyHasFlipped(true)
                    setStudyFlipped((f) => !f)
                  }}
                  onKeyDown={(e) => {
                    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault()
                      playPaperFlip()
                      setStudyInstantSwap(false)
                      setStudyHasFlipped(true)
                      setStudyFlipped((f) => !f)
                    }
                  }}
                  aria-label={
                    studyFlipped ? 'Mặt sau thẻ Hán tự — nhấn để lật lại' : 'Mặt trước thẻ Hán tự — nhấn để xem nghĩa'
                  }
                >
                  <div
                    className="washi-3d-face washi-3d-face--front kanji-flashcard-3d-face"
                    aria-hidden={studyFlipped}
                  >
                    <div className="kanji-flashcard-front">
                      <span className="kanji-flashcard-glyph">{activeStudyKanji.kanji}</span>
                      <span className="kanji-flashcard-hint">
                        Nhấn [Space] hoặc chạm để lật xem Hán-Việt &amp; Chiết tự
                      </span>
                    </div>
                  </div>

                  <div
                    className="washi-3d-face washi-3d-face--back kanji-flashcard-3d-face"
                    aria-hidden={!studyFlipped}
                  >
                    {(studyFlipped || studyHasFlipped) && (
                      <div className="kanji-flashcard-back">
                        <div className="kanji-flashcard-back__top">
                          <span className="kanji-flashcard-back__char">{activeStudyKanji.kanji}</span>
                          <div>
                            <div className="kanji-flashcard-back__hanzi">{activeStudyKanji.hanzi}</div>
                            <div className="kanji-flashcard-back__meaning">{activeStudyKanji.meaning_vi}</div>
                          </div>
                        </div>
                        <div className="kanji-flashcard-back__readings">
                          <span>On: {activeStudyKanji.onyomi || '—'}</span>
                          <span>Kun: {activeStudyKanji.kunyomi || '—'}</span>
                        </div>
                        {activeStudyKanji.story && (
                          <blockquote className="kanji-flashcard-back__story">
                            「 {activeStudyKanji.story} 」
                          </blockquote>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="kanji-flashcard-actions">
                <Button variant="secondary" size="sm" disabled={studyIdx <= 0} onClick={() => stepStudyCard(-1)}>
                  <ChevronLeft size={15} /> Chữ trước
                </Button>
                <Button variant="secondary" size="sm" onClick={() => openKanjiModal(activeStudyKanji)}>
                  Mở chi tiết &amp; Tập viết
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={studyIdx >= displayedItems.length - 1}
                  onClick={() => stepStudyCard(1)}
                >
                  Chữ tiếp <ChevronRight size={15} />
                </Button>
              </div>
            </div>
          ) : (
            <div ref={gridRef} className={`kanji-grid${displayedItems.length < 6 ? ' kanji-grid--compact' : ''}`}>
              {displayedItems.map((k, idx) => {
                const isSaved = savedKanjiSet.has(k.kanji)
                const levelTag = (k.jlpt_level || 'N5').toLowerCase()
                return (
                  <div
                    key={k.kanji}
                    role="button"
                    tabIndex={0}
                    style={{ '--kanji-i': idx } as CSSProperties}
                    onClick={() => openKanjiModal(k)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        openKanjiModal(k)
                      }
                    }}
                    className="kanji-card"
                  >
                    <div className="kanji-card__header">
                      <div className="kanji-card__meta-left">
                        <span className={`kanji-card__jlpt kanji-card__jlpt--${levelTag}`}>{k.jlpt_level || 'N5'}</span>
                        <span className="kanji-card__strokes">{k.stroke_count} nét</span>
                      </div>
                      <button
                        type="button"
                        className={`kanji-card__save-btn${isSaved ? ' is-saved' : ''}`}
                        onClick={(e) => void handleSaveCard(e, k)}
                        aria-label={isSaved ? `Đã lưu ${k.kanji}` : `Lưu ${k.kanji}`}
                        title={isSaved ? 'Đã lưu vào Sổ tay SRS' : 'Lưu vào Sổ tay SRS'}
                      >
                        {isSaved ? (
                          <BookmarkCheck size={12} aria-hidden="true" />
                        ) : (
                          <Bookmark size={12} aria-hidden="true" />
                        )}
                        <span>{isSaved ? 'Đã lưu' : 'Lưu'}</span>
                      </button>
                    </div>

                    <div className="kanji-card__kyugu">
                      {k.radical_utf && k.radical_utf !== '—' && (
                        <span
                          className="kanji-card__radical-mark"
                          title={k.radical_vi_name ? `Bộ ${k.radical_vi_name}` : 'Bộ thủ'}
                        >
                          {k.radical_utf}
                        </span>
                      )}
                      <div className="kanji-card__char">{k.kanji}</div>
                    </div>

                    <div className="kanji-card__body">
                      <div className="kanji-card__hanzi">{k.hanzi}</div>
                      <div className="kanji-card__meaning">{k.meaning_vi}</div>
                      {(k.onyomi || k.kunyomi) && <div className="kanji-card__onyomi">{k.onyomi || k.kunyomi}</div>}
                      {k.story && <div className="kanji-card__story">{k.story}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* 4. Editorial Hairline Pagination */}
          {!onlySaved && data && data.totalPages > 1 && (
            <nav className="kanji-pagination" aria-label="Phân trang Hán tự">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => goToPage(Math.max(1, page - 1))}
              >
                <ChevronLeft size={15} /> Trang trước
              </Button>
              <div className="kanji-pagination__pages">
                {getVisiblePages(page, data.totalPages).map((pNum, idx) =>
                  typeof pNum === 'number' ? (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => goToPage(pNum)}
                      className={`kanji-page-btn${page === pNum ? ' is-active' : ''}`}
                      aria-current={page === pNum ? 'page' : undefined}
                    >
                      {pNum}
                    </button>
                  ) : (
                    <span key={idx} className="kanji-page-ellipsis" aria-hidden="true">
                      …
                    </span>
                  )
                )}
              </div>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= data.totalPages}
                onClick={() => goToPage(Math.min(data.totalPages, page + 1))}
              >
                Trang sau <ChevronRight size={15} />
              </Button>
              <span className="kanji-pagination__summary">
                Trang {page} / {data.totalPages} · {data.total} chữ
              </span>
            </nav>
          )}
          {!onlySaved && data && data.totalPages === 1 && data.total > 0 && (
            <div className="kanji-pagination__footer-note">
              Đang hiển thị toàn bộ <strong>{data.total}</strong> chữ Hán
            </div>
          )}
        </>
      )}

      {/* 5. Shodo Detail Modal */}
      {selectedKanji && (
        <KanjiDetailModal
          kanjiSummary={selectedKanji}
          onClose={closeKanjiModal}
          onSelectKanji={handleKanjiSelectByChar}
        />
      )}
    </div>
  )
}
export default KanjiPage
