import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Sparkles, Layers, BookOpen, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { nhaikanjiApi } from './nhaikanjiApi'
import type { KanjiSummary } from './nhaikanjiTypes'
import { KanjiDetailModal } from './KanjiDetailModal'
import { Badge, Button } from '../../components/ui'
import PageHeader from '../../components/PageHeader'

const JLPT_LEVELS = ['ALL', 'N5', 'N4', 'N3', 'N2', 'N1'] as const

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

export function KanjiPage() {
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [selectedKanji, setSelectedKanji] = useState<KanjiSummary | null>(null)
  const [sortBy, setSortBy] = useState<'default' | 'stroke_asc' | 'stroke_desc' | 'hanzi_az'>('default')
  const [limit, setLimit] = useState<number>(48)

  const { data, isLoading } = useQuery({
    queryKey: ['nhaikanji', 'kanjiList', selectedLevel, searchQuery, page, sortBy, limit],
    queryFn: () =>
      nhaikanjiApi.fetchKanjiList({
        level: selectedLevel,
        query: searchQuery,
        page,
        limit,
        sort: sortBy,
      }),
  })

  const handleLevelChange = (level: string) => {
    setSelectedLevel(level)
    setPage(1)
  }

  const handleSearchChange = (val: string) => {
    setSearchQuery(val)
    setPage(1)
  }

  const handleKanjiSelectByChar = async (char: string) => {
    const target = data?.items.find((item) => item.kanji === char)
    if (target) {
      setSelectedKanji(target)
    } else {
      try {
        const res = await nhaikanjiApi.fetchKanjiList({ query: char, limit: 1 })
        if (res.items && res.items.length > 0 && res.items[0]) {
          setSelectedKanji(res.items[0])
        }
      } catch {
        // ignore
      }
    }
  }

  return (
    <div className="nhaikanji-container">
      <PageHeader
        eyebrow="KHO HÁN TỰ & CHIẾT TỰ"
        title="Kho Hán Tự (Kanji) & Chiết Tự"
        description="2500+ Chữ Hán phân loại N5→N1 với đầy đủ Âm Hán-Việt, câu chuyện gợi nhớ, nét viết và phát âm chuẩn"
      />

      {/* Control Bar: Filters & Search */}
      <div className="nhaikanji-filter-card">
        <div className="nhaikanji-filter-row">
          {/* Level Filter Tabs */}
          <div className="nhaikanji-tab-group">
            {JLPT_LEVELS.map((lvl) => (
              <button
                key={lvl}
                type="button"
                className={`nhaikanji-tab-btn${selectedLevel === lvl ? ' is-active' : ''}`}
                onClick={() => handleLevelChange(lvl)}
              >
                {lvl === 'ALL' ? 'Tất cả (2500+)' : `Kanji ${lvl}`}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="nhaikanji-search-box">
            <Search size={18} className="nhaikanji-search-icon" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Tìm Kanji, Âm Hán Việt (thổ, nhật...), nghĩa..."
            />
            {searchQuery && (
              <button type="button" onClick={() => handleSearchChange('')} className="nhaikanji-search-clear">
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Feature quick badges */}
        <div className="nhaikanji-badge-line">
          <span>
            <Sparkles size={14} className="text-amber-500" /> Chiết tự & Mẹo nhớ
          </span>
          <span>
            <Layers size={14} className="text-indigo-500" /> 214 Bộ thủ liên kết
          </span>
          <span>
            <BookOpen size={14} className="text-emerald-500" /> Luyện viết nét tay
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
          {data && (
            <span style={{ fontWeight: 600 }}>
              Tổng cộng: <b>{data.total}</b> chữ Hán
            </span>
          )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Sắp xếp:</span>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as 'default' | 'stroke_asc' | 'stroke_desc' | 'hanzi_az')
                  setPage(1)
                }}
                aria-label="Sắp xếp danh sách Hán tự"
                style={{
                  fontSize: '0.78rem',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: 'var(--color-surface, #ffffff)',
                  color: 'var(--color-text, #0f172a)',
                  cursor: 'pointer',
                }}
              >
                <option value="default">Lộ trình học logic</option>
                <option value="stroke_asc">Số nét (Ít → Nhiều)</option>
                <option value="stroke_desc">Số nét (Nhiều → Ít)</option>
                <option value="hanzi_az">Âm Hán-Việt (A → Z)</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Hiển thị:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value))
                  setPage(1)
                }}
                aria-label="Số lượng chữ Hán hiển thị mỗi trang"
                style={{
                  fontSize: '0.78rem',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: 'var(--color-surface, #ffffff)',
                  color: 'var(--color-text, #0f172a)',
                  cursor: 'pointer',
                }}
              >
                <option value={48}>48 / trang</option>
                <option value={96}>96 / trang</option>
                <option value={192}>192 / trang</option>
                <option value={3000}>Tất cả</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Kanji Cards */}
      {isLoading ? (
        <div className="kanji-grid">
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              className="kanji-card"
              style={{ minHeight: '140px', background: 'var(--color-bg-subtle, #f1f5f9)' }}
            />
          ))}
        </div>
      ) : data?.items?.length === 0 ? (
        <div className="nhaikanji-filter-card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <p style={{ fontWeight: 500, color: 'var(--color-text-secondary, #64748b)' }}>
            Không tìm thấy Hán tự nào phù hợp với từ khóa "{searchQuery}"
          </p>
          <Button
            variant="secondary"
            size="sm"
            style={{ marginTop: '0.75rem' }}
            onClick={() => {
              setSearchQuery('')
              setSelectedLevel('ALL')
            }}
          >
            Đặt lại bộ lọc
          </Button>
        </div>
      ) : (
        <div className="kanji-grid">
          {(data?.items || []).map((k) => (
            <div
              key={k.kanji}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedKanji(k)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setSelectedKanji(k)
                }
              }}
              className="kanji-card"
            >
              {/* JLPT Badge top right */}
              <div className="kanji-card__header">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {k.jlpt_level || 'N5'}
                </Badge>
                <span>{k.stroke_count} nét</span>
              </div>

              {/* Big Kanji */}
              <div className="kanji-card__char">{k.kanji}</div>

              {/* Hanzi / Âm Hán Việt */}
              <div className="kanji-card__hanzi">{k.hanzi}</div>

              {/* Meaning */}
              <div className="kanji-card__meaning">{k.meaning_vi}</div>

              {/* Onyomi Preview */}
              {k.onyomi && <div className="kanji-card__onyomi">{k.onyomi}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            <ChevronLeft size={16} /> Trang trước
          </Button>
          <div className="flex items-center gap-1">
            {getVisiblePages(page, data.totalPages).map((pNum, idx) =>
              typeof pNum === 'number' ? (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPage(pNum)}
                  style={{
                    minWidth: '32px',
                    height: '32px',
                    padding: '0 6px',
                    borderRadius: '6px',
                    border: page === pNum ? '1px solid #2563eb' : '1px solid #cbd5e1',
                    background: page === pNum ? '#2563eb' : 'var(--color-surface, #ffffff)',
                    color: page === pNum ? '#ffffff' : 'var(--color-text, #0f172a)',
                    fontWeight: page === pNum ? 700 : 500,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  {pNum}
                </button>
              ) : (
                <span key={idx} style={{ padding: '0 4px', color: '#64748b' }}>
                  ...
                </span>
              )
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= data.totalPages}
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
          >
            Trang sau <ChevronRight size={16} />
          </Button>
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 px-3">
            Trang {page} / {data.totalPages} (Tổng {data.total} chữ)
          </span>
        </div>
      )}
      {data && data.totalPages === 1 && data.total > 0 && (
        <div style={{ textAlign: 'center', paddingTop: '1rem', fontSize: '0.82rem', color: '#64748b' }}>
          Đang hiển thị toàn bộ <b>{data.total}</b> chữ Hán
        </div>
      )}

      {/* Kanji Detail Modal */}
      {selectedKanji && (
        <KanjiDetailModal
          kanjiSummary={selectedKanji}
          onClose={() => setSelectedKanji(null)}
          onSelectKanji={handleKanjiSelectByChar}
        />
      )}
    </div>
  )
}
export default KanjiPage
