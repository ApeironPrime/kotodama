import { useDebouncedValue } from '../../lib/useDebouncedValue'
import { useUrlState } from '../../lib/useUrlState'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Layers, ChevronLeft, ChevronRight, X, Bookmark, RotateCcw } from 'lucide-react'
import { nhaikanjiApi } from './nhaikanjiApi'
import type { KanjiRadicalFacet, KanjiSummary } from './nhaikanjiTypes'
import { KanjiDetailModal } from './KanjiDetailModal'
import { Button } from '../../components/ui'
import { srsApi } from '../srs/srsApi'
import { useAuth } from '../auth/authContext'

const JLPT_LEVELS = ['ALL', 'N5', 'N4', 'N3', 'N2', 'N1'] as const
const SORT_OPTIONS = [
  { id: 'default', label: 'Lộ trình' },
  { id: 'stroke_asc', label: 'Ít → Nhiều nét' },
  { id: 'stroke_desc', label: 'Nhiều → Ít nét' },
  { id: 'hanzi_az', label: 'Hán-Việt A–Z' },
] as const

const LIMIT_OPTIONS = [48, 96, 192] as const

const STROKE_PRESETS = [
  { id: 'all', label: 'Mọi nét', min: undefined, max: undefined },
  { id: '1-4', label: '1–4 nét', min: 1, max: 4 },
  { id: '5-8', label: '5–8 nét', min: 5, max: 8 },
  { id: '9-12', label: '9–12 nét', min: 9, max: 12 },
  { id: '13-16', label: '13–16 nét', min: 13, max: 16 },
  { id: '17+', label: '17+ nét', min: 17, max: undefined },
] as const

const RADICAL_STROKE_GROUPS = [
  { id: 'all', label: 'Tất cả' },
  { id: '1-2', label: '1–2 nét' },
  { id: '3', label: '3 nét' },
  { id: '4', label: '4 nét' },
  { id: '5-6', label: '5–6 nét' },
  { id: '7+', label: '7+ nét' },
] as const

type SortId = (typeof SORT_OPTIONS)[number]['id']
type StrokePresetId = (typeof STROKE_PRESETS)[number]['id']
type RadicalStrokeGroupId = (typeof RADICAL_STROKE_GROUPS)[number]['id']

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
}

export function KanjiPage({ query, viewMode, onChangeViewMode }: KanjiPageProps = {}) {
  const { user } = useAuth()
  const ledgerTopRef = useRef<HTMLDivElement>(null)

  const [selectedLevel, setSelectedLevel] = useUrlState<string>('klevel', 'ALL', JLPT_LEVELS)
  const [selectedRadical, setSelectedRadical] = useUrlState<string>('rad', '')
  const [strokePreset, setStrokePreset] = useUrlState<StrokePresetId>(
    'strokes',
    'all',
    STROKE_PRESETS.map((s) => s.id)
  )
  const [sortBy, setSortBy] = useUrlState<SortId>(
    'ksort',
    'default',
    SORT_OPTIONS.map((s) => s.id)
  )
  const [urlKanjiChar, setUrlKanjiChar] = useUrlState<string>('kanji', '')

  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearchQuery = useDebouncedValue(query ?? searchQuery)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState<number>(48)
  const [onlySaved, setOnlySaved] = useState(false)
  const [studyMode, setStudyMode] = useState(false)
  const [studyIdx, setStudyIdx] = useState(0)
  const [studyFlipped, setStudyFlipped] = useState(false)
  const [isRadicalOpen, setIsRadicalOpen] = useState(false)
  const [radicalSearch, setRadicalSearch] = useState('')
  const [radicalStrokeGroup, setRadicalStrokeGroup] = useState<RadicalStrokeGroupId>('all')
  const [selectedKanji, setSelectedKanji] = useState<KanjiSummary | null>(null)

  useEffect(() => setPage(1), [query])

  const activeStrokeRange = useMemo(
    () => STROKE_PRESETS.find((p) => p.id === strokePreset) ?? STROKE_PRESETS[0],
    [strokePreset]
  )

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [
      'nhaikanji',
      'kanjiList',
      selectedLevel,
      debouncedSearchQuery,
      selectedRadical,
      activeStrokeRange.min ?? 0,
      activeStrokeRange.max ?? 0,
      page,
      sortBy,
      limit,
    ],
    queryFn: () =>
      nhaikanjiApi.fetchKanjiList({
        level: selectedLevel,
        query: debouncedSearchQuery,
        ...(selectedRadical ? { radical: selectedRadical } : {}),
        ...(activeStrokeRange.min ? { strokeMin: activeStrokeRange.min } : {}),
        ...(activeStrokeRange.max ? { strokeMax: activeStrokeRange.max } : {}),
        page,
        limit,
        sort: sortBy,
      }),
    placeholderData: (prev) => prev,
  })

  const { data: radicalsData, isLoading: isRadicalsLoading } = useQuery({
    queryKey: ['nhaikanji', 'radicals', selectedLevel],
    queryFn: () => nhaikanjiApi.fetchKanjiRadicals({ level: selectedLevel }),
    enabled: isRadicalOpen && typeof nhaikanjiApi.fetchKanjiRadicals === 'function',
    staleTime: 1000 * 60 * 10,
  })

  const { data: savedTermsData } = useQuery({
    queryKey: ['srs', user?.id ?? 'me', 'saved-terms'],
    queryFn: () => srsApi.fetchSavedTerms(),
    enabled: Boolean(user) && typeof srsApi?.fetchSavedTerms === 'function',
    staleTime: 30_000,
  })

  const savedKanjiSet = useMemo(() => {
    const set = new Set<string>()
    if (!Array.isArray(savedTermsData)) return set
    for (const entry of savedTermsData) {
      if (entry?.term && (entry.type === 'kanji' || entry.term.length === 1)) {
        set.add(entry.term)
      }
    }
    return set
  }, [savedTermsData])

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

  const handleLevelChange = (level: string) => {
    setSelectedLevel(level)
    setPage(1)
  }

  const handleSearchChange = (val: string) => {
    setSearchQuery(val)
    setPage(1)
  }

  const handleSelectRadical = (glyph: string) => {
    setSelectedRadical((prev) => (prev === glyph ? '' : glyph))
    setPage(1)
  }

  const handleFilterByRadicalFromModal = (glyph: string) => {
    closeKanjiModal()
    setSelectedRadical(glyph)
    setPage(1)
    setIsRadicalOpen(false)
  }

  const handleStrokePresetChange = (presetId: StrokePresetId) => {
    setStrokePreset(presetId)
    setPage(1)
  }

  const resetAllFilters = () => {
    setSearchQuery('')
    setSelectedLevel('ALL')
    setSelectedRadical('')
    setStrokePreset('all')
    setSortBy('default')
    setOnlySaved(false)
    setPage(1)
  }

  const goToPage = (nextPage: number) => {
    setPage(nextPage)
    if (ledgerTopRef.current && typeof ledgerTopRef.current.scrollIntoView === 'function') {
      ledgerTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const filteredRadicals = useMemo(() => {
    const list: KanjiRadicalFacet[] = radicalsData?.radicals ?? []
    const q = radicalSearch.trim().toLowerCase()
    return list.filter((r) => {
      if (radicalStrokeGroup === '1-2' && (r.strokeCount < 1 || r.strokeCount > 2)) return false
      if (radicalStrokeGroup === '3' && r.strokeCount !== 3) return false
      if (radicalStrokeGroup === '4' && r.strokeCount !== 4) return false
      if (radicalStrokeGroup === '5-6' && (r.strokeCount < 5 || r.strokeCount > 6)) return false
      if (radicalStrokeGroup === '7+' && r.strokeCount < 7) return false
      if (!q) return true
      return (
        r.glyph.includes(radicalSearch.trim()) ||
        r.nameVi.toLowerCase().includes(q) ||
        r.meaningVi.toLowerCase().includes(q) ||
        r.variants.some((v) => v.includes(radicalSearch.trim()))
      )
    })
  }, [radicalsData?.radicals, radicalSearch, radicalStrokeGroup])

  const selectedRadicalMeta = useMemo(
    () => (radicalsData?.radicals ?? []).find((r) => r.glyph === selectedRadical),
    [radicalsData?.radicals, selectedRadical]
  )

  const displayedItems = useMemo(() => {
    const items = data?.items ?? []
    if (!onlySaved) return items
    return items.filter((item) => savedKanjiSet.has(item.kanji))
  }, [data?.items, onlySaved, savedKanjiSet])

  useEffect(() => {
    setStudyIdx(0)
    setStudyFlipped(false)
  }, [selectedLevel, selectedRadical, strokePreset, debouncedSearchQuery, onlySaved, page])

  const activeStudyKanji = displayedItems[studyIdx] ?? displayedItems[0] ?? null

  useEffect(() => {
    if (!studyMode || selectedKanji || displayedItems.length === 0) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === ' ') {
        e.preventDefault()
        setStudyFlipped((f) => !f)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setStudyIdx((i) => Math.max(0, i - 1))
        setStudyFlipped(false)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setStudyIdx((i) => Math.min(displayedItems.length - 1, i + 1))
        setStudyFlipped(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [studyMode, selectedKanji, displayedItems.length])

  const hasActiveFilters =
    selectedLevel !== 'ALL' ||
    Boolean(selectedRadical) ||
    strokePreset !== 'all' ||
    onlySaved ||
    Boolean(debouncedSearchQuery)

  const totalCatalog = data?.catalogCounts?.ALL ?? data?.levelCounts?.ALL ?? data?.total ?? 2517

  if (isError) {
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
      {/* 1. Compact Editorial Masthead Strip */}
      <header className="kanji-ledger-masthead">
        <div className="kanji-ledger-masthead__title">
          <span className="kanji-ledger-hanko" aria-hidden="true">
            漢
          </span>
          <div>
            <h1>Kho Hán Tự (Kanji) & Chiết Tự</h1>
            <p className="kanji-ledger-masthead__sub">
              漢字大辞典 · {totalCatalog} chữ N5–N1 · Bút thuận, bộ thủ &amp; âm Hán-Việt
            </p>
          </div>
        </div>

        <div className="kanji-ledger-masthead__actions">
          {!query && (
            <div className="nhaikanji-search-box">
              <Search size={16} className="nhaikanji-search-icon" aria-hidden="true" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Tìm Kanji, Hán-Việt, On/Kun, nghĩa..."
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
          )}

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
                className={`kanji-view-segmented__btn${studyMode ? ' is-active' : ''}`}
                aria-pressed={studyMode}
                onClick={() => {
                  if (viewMode !== 'grid') onChangeViewMode('grid')
                  setStudyMode((prev) => !prev)
                }}
              >
                Lật thẻ
              </button>
              <button
                type="button"
                className={`kanji-view-segmented__btn${viewMode === 'ink' && !studyMode ? ' is-active' : ''}`}
                aria-pressed={viewMode === 'ink' && !studyMode}
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
      </header>

      {/* 2. Open Hairline Filter Ledger (Zero SaaS Box) */}
      <section className="kanji-ledger-controls" aria-label="Bộ lọc Hán tự">
        {/* Row A: JLPT Hairline Tabs + Radical Drawer Trigger + Saved SRS Toggle */}
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
            <button
              type="button"
              className={`kanji-trigger-btn${isRadicalOpen || selectedRadical ? ' is-active' : ''}`}
              aria-expanded={isRadicalOpen}
              onClick={() => setIsRadicalOpen((open) => !open)}
            >
              <Layers size={14} aria-hidden="true" />
              <span>{selectedRadical ? `Bộ: ${selectedRadical}` : 'Bộ thủ (部首)'}</span>
            </button>

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
          </div>
        </div>

        {/* Collapsible 214 Radicals Drawer */}
        {isRadicalOpen && (
          <div className="kanji-radical-drawer" role="region" aria-label="Bảng tra cứu Bộ thủ">
            <div className="kanji-radical-drawer__head">
              <div className="kanji-radical-drawer__search">
                <Search size={14} aria-hidden="true" />
                <input
                  type="text"
                  value={radicalSearch}
                  onChange={(e) => setRadicalSearch(e.target.value)}
                  placeholder="Tìm bộ thủ (thủy, nhân, tâm, 水...)"
                  aria-label="Tìm bộ thủ"
                />
                {radicalSearch && (
                  <button
                    type="button"
                    onClick={() => setRadicalSearch('')}
                    className="kanji-radical-drawer__clear"
                    aria-label="Xóa tìm bộ thủ"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <div className="kanji-stroke-pills" role="group" aria-label="Số nét bộ thủ">
                {RADICAL_STROKE_GROUPS.map((grp) => (
                  <button
                    key={grp.id}
                    type="button"
                    className={`kanji-pill-btn${radicalStrokeGroup === grp.id ? ' is-active' : ''}`}
                    onClick={() => setRadicalStrokeGroup(grp.id)}
                  >
                    {grp.label}
                  </button>
                ))}
              </div>
            </div>

            {isRadicalsLoading ? (
              <p className="kanji-radical-drawer__status">Đang lập mục lục bộ thủ…</p>
            ) : filteredRadicals.length === 0 ? (
              <p className="kanji-radical-drawer__status">Không tìm thấy bộ thủ phù hợp.</p>
            ) : (
              <div className="kanji-radical-grid">
                {filteredRadicals.map((rad) => {
                  const isActive = selectedRadical === rad.glyph
                  return (
                    <button
                      key={rad.glyph}
                      type="button"
                      className={`kanji-radical-tile${isActive ? ' is-active' : ''}`}
                      onClick={() => handleSelectRadical(rad.glyph)}
                      title={`${rad.glyph} — Bộ ${rad.nameVi || rad.glyph} (${rad.meaningVi})`}
                    >
                      <span className="kanji-radical-tile__glyph">{rad.glyph}</span>
                      <span className="kanji-radical-tile__name">{rad.nameVi || 'Bộ'}</span>
                      <span className="kanji-radical-tile__count">{rad.count}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Row B: Stroke Range Pills + Active Chips + Editorial Sort & Limit */}
        <div className="kanji-ledger-row-b">
          <div className="kanji-ledger-row-b__left">
            <div className="kanji-stroke-pills" role="group" aria-label="Lọc theo số nét">
              {STROKE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`kanji-pill-btn${strokePreset === preset.id ? ' is-active' : ''}`}
                  aria-pressed={strokePreset === preset.id}
                  onClick={() => handleStrokePresetChange(preset.id)}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {selectedRadical && (
              <button
                type="button"
                className="kanji-active-chip"
                onClick={() => {
                  setSelectedRadical('')
                  setPage(1)
                }}
              >
                <span>
                  Bộ {selectedRadical}
                  {selectedRadicalMeta?.nameVi ? ` · ${selectedRadicalMeta.nameVi}` : ''}
                </span>
                <X size={12} aria-hidden="true" />
              </button>
            )}

            {hasActiveFilters && (
              <button type="button" className="kanji-reset-link" onClick={resetAllFilters}>
                <RotateCcw size={12} aria-hidden="true" />
                <span>Đặt lại</span>
              </button>
            )}
          </div>

          <div className="kanji-ledger-row-b__right">
            {data && (
              <span className="kanji-ledger-total">
                <strong>{onlySaved ? displayedItems.length : data.total}</strong> chữ
              </span>
            )}

            <div className="kanji-segmented-control" role="group" aria-label="Sắp xếp danh sách Hán tự">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`kanji-seg-btn${sortBy === opt.id ? ' is-active' : ''}`}
                  aria-pressed={sortBy === opt.id}
                  onClick={() => {
                    setSortBy(opt.id)
                    setPage(1)
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="kanji-segmented-control" role="group" aria-label="Số lượng hiển thị mỗi trang">
              {LIMIT_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`kanji-seg-btn${limit === opt ? ' is-active' : ''}`}
                  aria-pressed={limit === opt}
                  onClick={() => {
                    setLimit(opt)
                    setPage(1)
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
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
              ? 'Chưa có chữ Hán nào trong trang hiện tại được lưu vào Sổ tay SRS.'
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

          <div
            role="button"
            tabIndex={0}
            className={`kanji-flashcard-card${studyFlipped ? ' is-flipped' : ''}`}
            onClick={() => setStudyFlipped((f) => !f)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                setStudyFlipped((f) => !f)
              }
            }}
            aria-label={
              studyFlipped ? 'Mặt sau thẻ Hán tự — nhấn để lật lại' : 'Mặt trước thẻ Hán tự — nhấn để xem nghĩa'
            }
          >
            {!studyFlipped ? (
              <div className="kanji-flashcard-front">
                <span className="kanji-flashcard-glyph">{activeStudyKanji.kanji}</span>
                <span className="kanji-flashcard-hint">Nhấn [Space] hoặc chạm để lật xem Hán-Việt &amp; Chiết tự</span>
              </div>
            ) : (
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
                  <blockquote className="kanji-flashcard-back__story">「 {activeStudyKanji.story} 」</blockquote>
                )}
              </div>
            )}
          </div>

          <div className="kanji-flashcard-actions">
            <Button
              variant="secondary"
              size="sm"
              disabled={studyIdx <= 0}
              onClick={() => {
                setStudyIdx((i) => Math.max(0, i - 1))
                setStudyFlipped(false)
              }}
            >
              <ChevronLeft size={15} /> Chữ trước
            </Button>
            <Button variant="secondary" size="sm" onClick={() => openKanjiModal(activeStudyKanji)}>
              Mở chi tiết &amp; Tập viết
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={studyIdx >= displayedItems.length - 1}
              onClick={() => {
                setStudyIdx((i) => Math.min(displayedItems.length - 1, i + 1))
                setStudyFlipped(false)
              }}
            >
              Chữ tiếp <ChevronRight size={15} />
            </Button>
          </div>
        </div>
      ) : (
        <div className={`kanji-grid${displayedItems.length < 6 ? ' kanji-grid--compact' : ''}`}>
          {displayedItems.map((k) => {
            const isSaved = savedKanjiSet.has(k.kanji)
            return (
              <div
                key={k.kanji}
                role="button"
                tabIndex={0}
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
                  <span className="kanji-card__jlpt">{k.jlpt_level || 'N5'}</span>
                  <span className="kanji-card__meta-right">
                    {k.radical_utf && k.radical_utf !== '—' && (
                      <span
                        className="kanji-card__radical"
                        title={k.radical_vi_name ? `Bộ ${k.radical_vi_name}` : 'Bộ thủ'}
                      >
                        {k.radical_utf}
                      </span>
                    )}
                    <span>{k.stroke_count} nét</span>
                    {isSaved && (
                      <span className="kanji-card__hanko" title="Đã lưu vào Sổ tay SRS" aria-label="Đã lưu SRS">
                        済
                      </span>
                    )}
                  </span>
                </div>

                <div className="kanji-card__char">{k.kanji}</div>
                <div className="kanji-card__hanzi">{k.hanzi}</div>
                <div className="kanji-card__meaning">{k.meaning_vi}</div>
                {(k.onyomi || k.kunyomi) && <div className="kanji-card__onyomi">{k.onyomi || k.kunyomi}</div>}
                {k.story && <div className="kanji-card__story">{k.story}</div>}
              </div>
            )
          })}
        </div>
      )}

      {/* 4. Editorial Hairline Pagination */}
      {data && data.totalPages > 1 && (
        <nav className="kanji-pagination" aria-label="Phân trang Hán tự">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => goToPage(Math.max(1, page - 1))}>
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
      {data && data.totalPages === 1 && data.total > 0 && (
        <div className="kanji-pagination__footer-note">
          Đang hiển thị toàn bộ <strong>{data.total}</strong> chữ Hán
        </div>
      )}

      {/* 5. Shodo Detail Modal */}
      {selectedKanji && (
        <KanjiDetailModal
          kanjiSummary={selectedKanji}
          onClose={closeKanjiModal}
          onSelectKanji={handleKanjiSelectByChar}
          onFilterByRadical={handleFilterByRadicalFromModal}
        />
      )}
    </div>
  )
}
export default KanjiPage
