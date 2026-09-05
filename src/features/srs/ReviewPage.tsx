import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Flame,
  Layers,
  LayoutGrid,
  List,
  Loader2,
  Play,
  Search,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { Badge, Button, Card, EmptyState, Input } from '../../components/ui'
import { srsApi } from './srsApi'
import type { SrsCard, SrsCardType, SrsHeatmapDay, SrsRating } from './srsTypes'
import { FlashcardStudyModal } from './FlashcardStudyModal'
import { useAuth } from '../auth/authContext'

const QUICK_SUGGESTIONS = ['食べる', '育つ', '必ず', '愛', '成長', '学校', '勉強', '難しい']
const JLPT_LEVELS = ['ALL', 'N5', 'N4', 'N3', 'N2', 'N1'] as const

export default function ReviewPage({ onDictionary }: { onDictionary?: () => void }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<SrsCardType | 'search'>('vocab')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeStatus, setActiveStatus] = useState<string>('all')
  const [activeLevel, setActiveLevel] = useState<string>('ALL')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [hoveredDay, setHoveredDay] = useState<SrsHeatmapDay | null>(null)

  // Study Modal State
  const [studyModalCards, setStudyModalCards] = useState<SrsCard[] | null>(null)
  const [studyInitialIndex, setStudyInitialIndex] = useState(0)

  // Query Deck Cards
  const {
    data: deckData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['srs', user?.id ?? 'me', 'deck', activeTab, activeStatus, activeLevel, searchQuery],
    queryFn: () =>
      srsApi.fetchDeck({
        type: activeTab === 'search' ? 'all' : activeTab,
        status: activeStatus,
        level: activeLevel,
        query: searchQuery,
        page: 1,
        limit: 100,
      }),
    refetchOnMount: 'always',
  })

  // Query Stats
  const { data: statsData } = useQuery({
    queryKey: ['srs', user?.id ?? 'me', 'stats', activeTab],
    queryFn: () => srsApi.fetchStats(activeTab === 'search' ? 'all' : activeTab),
    refetchOnMount: 'always',
  })

  // Global counts across all categories
  const { data: globalStats } = useQuery({
    queryKey: ['srs', user?.id ?? 'me', 'stats', 'global'],
    queryFn: () => srsApi.fetchStats('all'),
    refetchOnMount: 'always',
  })

  const cards = deckData?.items || []

  // Count items per category dynamically from real deck stats
  const vocabCount = globalStats?.vocabCount ?? (activeTab === 'vocab' ? (deckData?.total ?? 0) : 0)
  const grammarCount = globalStats?.grammarCount ?? (activeTab === 'grammar' ? (deckData?.total ?? 0) : 0)
  const kanjiCount = globalStats?.kanjiCount ?? (activeTab === 'kanji' ? (deckData?.total ?? 0) : 0)

  const stats = statsData || {
    totalCards: cards.length,
    masteredCount: cards.filter((c) => c.masteryPercentage >= 80).length,
    dueTodayCount: cards.filter((c) => c.stage === 'due').length,
    averageMastery:
      cards.length > 0 ? Math.round(cards.reduce((acc, c) => acc + c.masteryPercentage, 0) / cards.length) : 0,
  }

  const handleReview = async (cardId: string, rating: SrsRating) => {
    await srsApi.submitReview(cardId, rating)
    await queryClient.invalidateQueries({ queryKey: ['srs'] })
    void refetch()
  }

  const openStudySession = (startIndex = 0) => {
    if (cards.length > 0) {
      setStudyModalCards(cards)
      setStudyInitialIndex(startIndex)
    }
  }

  return (
    <section className="review-page" style={{ maxWidth: '1280px', margin: '0 auto', padding: '1rem 1.25rem' }}>
      {/* 1. TOP SEARCH & AI ANALYSIS BAR */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm từ vựng, kanji hoặc ngữ pháp..."
            style={{ paddingLeft: '2.5rem', height: '46px', fontSize: '0.95rem' }}
          />
          <Search
            size={18}
            style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--color-text-muted)' }}
          />
        </div>

        <Button
          type="button"
          style={{
            background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
            color: '#ffffff',
            fontWeight: 700,
            padding: '0 1.25rem',
            height: '46px',
            borderRadius: '8px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
          onClick={() => {
            if (onDictionary) onDictionary()
          }}
        >
          <Zap size={16} /> Phân tích AI
        </Button>

        {/* Quick chip suggestions */}
        <div style={{ display: 'none' }} className="sm:flex">
          {QUICK_SUGGESTIONS.slice(0, 5).map((word) => (
            <button
              key={word}
              type="button"
              onClick={() => setSearchQuery(word)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '0.82rem',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                marginRight: '6px',
              }}
            >
              {word}
            </button>
          ))}
        </div>
      </div>

      {/* 2. CATEGORY SUB-TABS (TRA TỪ, TỪ VỰNG, NGỮ PHÁP, KANJI) */}
      <div
        style={{
          display: 'flex',
          gap: '1.5rem',
          borderBottom: '1px solid var(--color-border)',
          marginBottom: '1.25rem',
          overflowX: 'auto',
          paddingBottom: '2px',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('search')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'search' ? '2px solid #ec4899' : '2px solid transparent',
            color: activeTab === 'search' ? '#ec4899' : 'var(--color-text-muted)',
            fontWeight: 700,
            fontSize: '0.95rem',
            padding: '8px 4px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
          }}
        >
          <Search size={16} /> Tra từ / Phân tích sâu
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('vocab')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'vocab' ? '2px solid #ec4899' : '2px solid transparent',
            color: activeTab === 'vocab' ? '#ec4899' : 'var(--color-text-muted)',
            fontWeight: 700,
            fontSize: '0.95rem',
            padding: '8px 4px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
          }}
        >
          <Layers size={16} /> Từ vựng ({vocabCount} từ)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('grammar')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'grammar' ? '2px solid #ec4899' : '2px solid transparent',
            color: activeTab === 'grammar' ? '#ec4899' : 'var(--color-text-muted)',
            fontWeight: 700,
            fontSize: '0.95rem',
            padding: '8px 4px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
          }}
        >
          <BookOpen size={16} /> Ngữ pháp ({grammarCount} mẫu)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('kanji')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'kanji' ? '2px solid #ec4899' : '2px solid transparent',
            color: activeTab === 'kanji' ? '#ec4899' : 'var(--color-text-muted)',
            fontWeight: 700,
            fontSize: '0.95rem',
            padding: '8px 4px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ fontFamily: 'var(--font-jp)', fontWeight: 800 }}>漢</span> Kanji ({kanjiCount} chữ)
        </button>
      </div>

      {/* 3. 4 SUMMARY KPI STATS CARDS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {/* Total Cards */}
        <Card
          padding="md"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '12px',
          }}
        >
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#3b82f6', marginBottom: '0.5rem' }}
          >
            <Layers size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-text)' }}>{stats.totalCards}</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            Tổng {activeTab === 'grammar' ? 'ngữ pháp' : activeTab === 'kanji' ? 'chữ Hán' : 'từ vựng'}
          </div>
        </Card>

        {/* Mastered */}
        <Card
          padding="md"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '12px',
          }}
        >
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', marginBottom: '0.5rem' }}
          >
            <CheckCircle2 size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981' }}>{stats.masteredCount}</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>Đã thành thạo</div>
        </Card>

        {/* Due Today */}
        <Card
          padding="md"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '12px',
          }}
        >
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b', marginBottom: '0.5rem' }}
          >
            <Flame size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f59e0b' }}>{stats.dueTodayCount}</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>Cần ôn hôm nay</div>
        </Card>

        {/* Average Mastery % */}
        <Card
          padding="md"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '12px',
          }}
        >
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#8b5cf6', marginBottom: '0.5rem' }}
          >
            <TrendingUp size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-text)' }}>{stats.averageMastery}%</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            Trung bình thành thạo
          </div>
        </Card>
      </div>

      {/* 3.5 STREAK & CONTRIBUTION HEATMAP WIDGET */}
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '16px',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1rem',
          }}
        >
          {/* Left: Streak stats & Motivation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(239, 68, 68, 0.2) 100%)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  padding: '10px',
                  borderRadius: '12px',
                  color: '#f59e0b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Flame size={24} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)' }}>
                    {globalStats?.streak ?? stats.streak ?? 0}
                  </span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f59e0b' }}>ngày liên tiếp</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                  🏆 Kỷ lục: {globalStats?.longestStreak ?? stats.longestStreak ?? 0} ngày · ⚡ Hôm nay:{' '}
                  {globalStats?.reviewedToday ?? stats.reviewedToday ?? 0} thẻ
                </div>
              </div>
            </div>

            {/* Daily Urgency Pressure Banner */}
            {stats.dueTodayCount > 0 ? (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '10px',
                  padding: '6px 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: '#ef4444',
                }}
              >
                <Flame size={15} /> Bạn còn {stats.dueTodayCount} thẻ cần hoàn thành hôm nay để giữ chuỗi!
              </div>
            ) : (
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '10px',
                  padding: '6px 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: '#10b981',
                }}
              >
                <CheckCircle2 size={15} /> Đã hoàn thành toàn bộ mục tiêu hôm nay!
              </div>
            )}
          </div>

          {/* Quick CTA */}
          <Button
            size="sm"
            onClick={() => openStudySession(0)}
            disabled={cards.length === 0}
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              fontWeight: 700,
              gap: '6px',
            }}
          >
            <Play size={15} /> Luyện Thẻ Ngay
          </Button>
        </div>

        {/* Heatmap Contribution Grid (16 Weeks x 7 Days) */}
        <div style={{ marginTop: '0.75rem', overflowX: 'auto', paddingBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <Calendar size={14} style={{ color: 'var(--color-text-muted)' }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
              Biểu đồ học tập 16 tuần gần nhất
            </span>
            {hoveredDay && (
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#10b981', marginLeft: 'auto' }}>
                {hoveredDay.date}: Đã ôn {hoveredDay.count} thẻ
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-start' }}>
            {/* Day of week labels */}
            <div
              style={{
                display: 'grid',
                gridTemplateRows: 'repeat(7, 13px)',
                gap: '3px',
                fontSize: '0.68rem',
                color: 'var(--color-text-muted)',
                paddingRight: '6px',
                lineHeight: '13px',
                userSelect: 'none',
              }}
            >
              <span>T2</span>
              <span />
              <span>T4</span>
              <span />
              <span>T6</span>
              <span />
              <span>CN</span>
            </div>

            {/* Weeks columns */}
            {(() => {
              const heatmapList = globalStats?.heatmap || stats.heatmap || []
              const weeks: SrsHeatmapDay[][] = []
              for (let i = 0; i < heatmapList.length; i += 7) {
                weeks.push(heatmapList.slice(i, i + 7))
              }

              const getColorForLevel = (level: number) => {
                switch (level) {
                  case 4:
                    return '#10b981'
                  case 3:
                    return '#059669'
                  case 2:
                    return '#047857'
                  case 1:
                    return '#065f46'
                  default:
                    return 'rgba(255, 255, 255, 0.06)'
                }
              }

              return (
                <div style={{ display: 'flex', gap: '3px' }}>
                  {weeks.map((week, wIdx) => (
                    <div
                      key={wIdx}
                      style={{
                        display: 'grid',
                        gridTemplateRows: 'repeat(7, 13px)',
                        gap: '3px',
                      }}
                    >
                      {week.map((day, dIdx) => (
                        <div
                          key={dIdx}
                          onMouseEnter={() => setHoveredDay(day)}
                          onMouseLeave={() => setHoveredDay(null)}
                          style={{
                            width: '13px',
                            height: '13px',
                            borderRadius: '2.5px',
                            background: getColorForLevel(day.level),
                            cursor: 'pointer',
                            transition: 'transform 0.1s ease',
                          }}
                          title={`${day.date}: ${day.count} thẻ`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              )
            })()}

            {/* Heatmap Legend */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                marginLeft: 'auto',
                fontSize: '0.72rem',
                color: 'var(--color-text-muted)',
                alignSelf: 'flex-end',
                paddingTop: '6px',
              }}
            >
              <span>Ít</span>
              <div
                style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'rgba(255, 255, 255, 0.06)' }}
              />
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#065f46' }} />
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#047857' }} />
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#059669' }} />
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#10b981' }} />
              <span>Nhiều</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. FILTER BAR & VIEW TOGGLES */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1.25rem',
        }}
      >
        {/* Status Pills */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'Tất cả', count: cards.length },
            { id: 'mastered', label: 'Thành thạo', count: stats.masteredCount },
            {
              id: 'learning',
              label: 'Đang học',
              count: Math.max(0, cards.length - stats.masteredCount - stats.dueTodayCount),
            },
            { id: 'due', label: 'Cần ôn', count: stats.dueTodayCount },
          ].map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setActiveStatus(st.id)}
              style={{
                background: activeStatus === st.id ? 'rgba(236, 72, 153, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                color: activeStatus === st.id ? '#ec4899' : 'var(--color-text-secondary)',
                border: activeStatus === st.id ? '1px solid #ec4899' : '1px solid var(--color-border)',
                borderRadius: '8px',
                padding: '4px 12px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {st.label} {st.count > 0 && <span style={{ opacity: 0.8 }}>({st.count})</span>}
            </button>
          ))}
        </div>

        {/* JLPT Levels & Anki Launch Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              display: 'flex',
              gap: '2px',
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '2px',
              borderRadius: '6px',
            }}
          >
            {JLPT_LEVELS.map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setActiveLevel(lvl)}
                style={{
                  background: activeLevel === lvl ? '#3b82f6' : 'transparent',
                  color: activeLevel === lvl ? '#ffffff' : 'var(--color-text-muted)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '3px 8px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {lvl}
              </button>
            ))}
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => openStudySession(0)}
            style={{
              background: '#10b981',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.82rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Play size={14} /> Ôn tập Anki
          </Button>

          <div
            style={{
              display: 'flex',
              gap: '2px',
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '2px',
              borderRadius: '6px',
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              style={{
                background: viewMode === 'grid' ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                padding: '4px',
                cursor: 'pointer',
                color: 'var(--color-text)',
              }}
              title="Xem dạng Lưới"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              style={{
                background: viewMode === 'list' ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                padding: '4px',
                cursor: 'pointer',
                color: 'var(--color-text)',
              }}
              title="Xem dạng Danh sách"
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* 5. FLASHCARD GRID LIST */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '4rem 0' }}>
          <Loader2 size={36} className="animate-spin" style={{ margin: '0 auto', color: '#ec4899' }} />
          <p style={{ marginTop: '1rem', color: 'var(--color-text-secondary)' }}>Đang nạp thẻ ôn tập SRS...</p>
        </div>
      ) : cards.length === 0 ? (
        <EmptyState
          title="Không có thẻ ôn tập nào phù hợp"
          description="Hãy thử chọn cấp độ khác hoặc tra từ điển để thêm từ vựng / ngữ pháp vào sổ ôn tập."
          action={
            <Button variant="primary" onClick={onDictionary}>
              Mở từ điển tra từ
            </Button>
          }
        />
      ) : viewMode === 'grid' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
            gap: '1rem',
          }}
        >
          {cards.map((card, idx) => {
            const mastery = card.masteryPercentage || 0
            const isMastered = mastery >= 80
            const isDue = card.stage === 'due'
            const badgeLabel = isMastered ? 'Thành thạo' : isDue ? 'Cần ôn' : 'Đang học'
            const badgeBg = isMastered
              ? 'rgba(16, 185, 129, 0.15)'
              : isDue
                ? 'rgba(245, 158, 11, 0.15)'
                : 'rgba(59, 130, 246, 0.15)'
            const badgeColor = isMastered ? '#10b981' : isDue ? '#f59e0b' : '#3b82f6'

            return (
              <div
                key={card.id}
                onClick={() => openStudySession(idx)}
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '12px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.borderColor = '#ec4899'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.borderColor = 'var(--color-border)'
                }}
              >
                {/* Header: Status badge & JLPT level */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.5rem',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: '4px',
                      background: badgeBg,
                      color: badgeColor,
                    }}
                  >
                    {badgeLabel}
                  </span>
                  {card.jlptLevel && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                      {card.jlptLevel}
                    </span>
                  )}
                </div>

                {/* Main term & reading */}
                <div style={{ margin: '0.4rem 0', flex: 1 }}>
                  <div
                    style={{
                      fontSize: card.type === 'kanji' ? '2.4rem' : '1.35rem',
                      fontFamily: 'var(--font-jp)',
                      fontWeight: 800,
                      color: 'var(--color-text)',
                      lineHeight: 1.2,
                    }}
                  >
                    {card.term}
                  </div>
                  {card.reading && card.reading !== card.term && (
                    <div
                      style={{
                        fontSize: '0.85rem',
                        fontFamily: 'var(--font-jp)',
                        color: 'var(--color-text-muted)',
                        marginTop: '2px',
                      }}
                    >
                      {card.reading}
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: '0.85rem',
                      color: 'var(--color-text-secondary)',
                      marginTop: '4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {card.meaning}
                  </div>
                </div>

                {/* Footer: Progress bar with % text */}
                <div
                  style={{
                    marginTop: '0.75rem',
                    paddingTop: '0.5rem',
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '4px',
                      fontSize: '0.72rem',
                    }}
                  >
                    <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>THÀNH THẠO</span>
                    <span style={{ color: badgeColor, fontWeight: 800 }}>{mastery}%</span>
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
                      style={{ height: '100%', width: `${mastery}%`, background: badgeColor, borderRadius: '2px' }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* List View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {cards.map((card, idx) => (
            <Card
              key={card.id}
              padding="sm"
              onClick={() => openStudySession(idx)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontFamily: 'var(--font-jp)', fontWeight: 800, fontSize: '1.2rem', minWidth: '100px' }}>
                  {card.term}
                </span>
                <span style={{ fontFamily: 'var(--font-jp)', color: '#3b82f6', fontSize: '0.9rem', minWidth: '90px' }}>
                  {card.reading}
                </span>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>{card.meaning}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Badge variant="primary" className="text-xs">
                  {card.jlptLevel || 'N5'}
                </Badge>
                <span
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    color: card.masteryPercentage >= 80 ? '#10b981' : '#3b82f6',
                  }}
                >
                  {card.masteryPercentage}%
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 6. FLASHCARD 3D FLIP STUDY MODAL */}
      {studyModalCards && (
        <FlashcardStudyModal
          cards={studyModalCards}
          initialIndex={studyInitialIndex}
          onClose={() => setStudyModalCards(null)}
          onReview={handleReview}
        />
      )}
    </section>
  )
}
