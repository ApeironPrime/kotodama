import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Sparkles, Layers, BookOpen, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { nhaikanjiApi } from './nhaikanjiApi'
import type { KanjiSummary } from './nhaikanjiTypes'
import { KanjiDetailModal } from './KanjiDetailModal'
import { Badge, Button } from '../../components/ui'
import PageHeader from '../../components/PageHeader'

const JLPT_LEVELS = ['ALL', 'N5', 'N4', 'N3', 'N2', 'N1'] as const

export function KanjiPage() {
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [selectedKanji, setSelectedKanji] = useState<KanjiSummary | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['nhaikanji', 'kanjiList', selectedLevel, searchQuery, page],
    queryFn: () =>
      nhaikanjiApi.fetchKanjiList({
        level: selectedLevel,
        query: searchQuery,
        page,
        limit: 48,
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
          {data && (
            <span style={{ marginLeft: 'auto', fontWeight: 600 }}>
              Tổng cộng: <b>{data.total}</b> chữ Hán
            </span>
          )}
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
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 px-3">
            Trang {page} / {data.totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= data.totalPages}
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
          >
            Trang sau <ChevronRight size={16} />
          </Button>
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
