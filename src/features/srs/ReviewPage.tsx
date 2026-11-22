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
import { usePersistentState } from '../../lib/usePersistentState'

const QUICK_SUGGESTIONS = ['食べる', '育つ', '必ず', '愛', '成長', '学校', '勉強', '難しい']
const JLPT_LEVELS = ['ALL', 'N5', 'N4', 'N3', 'N2', 'N1'] as const

export default function ReviewPage({ onDictionary }: { onDictionary?: (query?: string) => void }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [reviewLimit] = usePersistentState('kotodama.settings.review-limit', '100')
  const dailyLimit = reviewLimit === 'unlimited' ? Infinity : Math.max(1, Number(reviewLimit) || 100)
  const [activeTab, setActiveTab] = useState<SrsCardType | 'search'>('vocab')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeStatus, setActiveStatus] = useState<string>('all')
  const [activeLevel, setActiveLevel] = useState<string>('ALL')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [hoveredDay, setHoveredDay] = useState<SrsHeatmapDay | null>(null)

  // Study Modal State
  const [studyModalCards, setStudyModalCards] = useState<SrsCard[] | null>(null)
  const [studyInitialIndex, setStudyInitialIndex] = useState(0)
  const [preparingStudy, setPreparingStudy] = useState(false)
  const [studyError, setStudyError] = useState<string | null>(null)

  // Query Deck Cards
  const {
    data: deckData,
    isLoading,
    isError,
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
  const {
    data: globalStats,
    isLoading: statsLoading,
    isError: statsError,
  } = useQuery({
    queryKey: ['srs', user?.id ?? 'me', 'stats', 'global'],
    queryFn: () => srsApi.fetchStats('all'),
    refetchOnMount: 'always',
  })

  const cards = deckData?.items || []
  const sessionLimit = dailyLimit === Infinity ? Infinity : Math.max(0, dailyLimit - (globalStats?.reviewedToday ?? 0))

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

  const openStudySession = async (startIndex = 0) => {
    if (!cards.length || preparingStudy) return
    if (dailyLimit !== Infinity && (statsLoading || statsError)) {
      setStudyError('Chưa tải được số lượt ôn hôm nay. Hãy thử lại sau khi tải lại tiến độ.')
      void queryClient.invalidateQueries({ queryKey: ['srs', user?.id ?? 'me', 'stats'] })
      return
    }
    if (sessionLimit === 0) {
      setStudyError('Bạn đã đạt giới hạn ôn tập hôm nay. Nghỉ ngơi hoặc điều chỉnh giới hạn trong Cài đặt.')
      return
    }
    setPreparingStudy(true)
    setStudyError(null)
    try {
      const allCards = [...cards]
      for (let page = 2; page <= (deckData?.totalPages ?? 1) && allCards.length < sessionLimit; page++) {
        const next = await srsApi.fetchDeck({
          type: activeTab === 'search' ? 'all' : activeTab,
          status: activeStatus,
          level: activeLevel,
          query: searchQuery,
          page,
          limit: 100,
        })
        if (!next.items.length) break
        allCards.push(...next.items)
      }
      const ordered = [...allCards.slice(startIndex), ...allCards.slice(0, startIndex)]
      setStudyModalCards(ordered.slice(0, sessionLimit))
      setStudyInitialIndex(0)
    } catch {
      setStudyError('Chưa tải đủ thẻ cho phiên ôn tập. Kiểm tra kết nối rồi thử lại.')
    } finally {
      setPreparingStudy(false)
    }
  }

  return (
    <section className="review-page washi-page">
      <header className="washi-masthead">
        <div className="washi-masthead__lead">
          <span className="washi-hanko" aria-hidden="true">
            復
          </span>
          <div>
            <span className="washi-masthead__eyebrow">SỔ TAY ÔN TẬP • 間隔反復</span>
            <h1 className="washi-masthead__title">Phòng Ôn Tập SRS</h1>
            <p className="washi-masthead__desc">
              Nhịp lặp lại ngắt quãng SM-2 giúp khắc sâu kiến thức tiếng Nhật theo chu kỳ trí nhớ dài hạn.
            </p>
          </div>
        </div>
        <span className="washi-vertical-tag" aria-hidden="true">
          復習記録
        </span>
      </header>
      {preparingStudy && <p role="status">Đang chuẩn bị thẻ ôn tập…</p>}
      {studyError && (
        <p role="alert" className="ui-error-text">
          {studyError}
        </p>
      )}
      {isError && (
        <div role="alert" className="ui-status-panel">
          <p>Chưa tải được kho thẻ. Kiểm tra kết nối và thử lại.</p>
          <Button onClick={() => void refetch()}>Thử lại</Button>
        </div>
      )}
      {/* 1. TOP SEARCH & AI ANALYSIS BAR */}
      <div className="washi-querybar">
        <div className="srs-search-wrap">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm từ vựng, kanji hoặc ngữ pháp..."
            style={{ paddingLeft: '2.5rem', height: '46px', fontSize: '1.05rem' }}
          />
          <Search
            size={18}
            style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--color-accent-text)' }}
          />
        </div>

        <Button
          type="button"
          variant="primary"
          onClick={() => {
            if (onDictionary) onDictionary(searchQuery)
          }}
          style={{ height: '44px', padding: '0 1.25rem', gap: '6px' }}
        >
          <Zap size={16} /> Mở Từ điển
        </Button>

        {/* Quick chip suggestions */}
        <div className="srs-quick-pills">
          {QUICK_SUGGESTIONS.slice(0, 5).map((word) => (
            <button key={word} type="button" onClick={() => setSearchQuery(word)} className="srs-quick-pill">
              {word}
            </button>
          ))}
        </div>
      </div>

      {/* 2. CATEGORY SUB-TABS (TRA TỪ, TỪ VỰNG, NGỮ PHÁP, KANJI) */}
      <div className="washi-tabs">
        <button
          type="button"
          onClick={() => setActiveTab('search')}
          className={`washi-tab${activeTab === 'search' ? ' is-active' : ''}`}
        >
          <Search size={16} /> Tất cả thẻ
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('vocab')}
          className={`washi-tab${activeTab === 'vocab' ? ' is-active' : ''}`}
        >
          <Layers size={16} /> Từ vựng ({vocabCount} từ)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('grammar')}
          className={`washi-tab${activeTab === 'grammar' ? ' is-active' : ''}`}
        >
          <BookOpen size={16} /> Ngữ pháp ({grammarCount} mẫu)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('kanji')}
          className={`washi-tab${activeTab === 'kanji' ? ' is-active' : ''}`}
        >
          <span style={{ fontFamily: 'var(--font-jp-serif)', fontWeight: 700 }}>漢</span> Kanji ({kanjiCount} chữ)
        </button>
      </div>

      {/* 3. 4 SUMMARY KPI STATS STRIP */}
      <div className="washi-kpi-strip">
        <div className="washi-kpi-cell">
          <div className="washi-kpi-cell__head">
            <Layers size={15} /> Kho thẻ
          </div>
          <div className="washi-kpi-cell__val">{stats.totalCards}</div>
          <div className="washi-kpi-cell__label">
            Tổng {activeTab === 'grammar' ? 'ngữ pháp' : activeTab === 'kanji' ? 'chữ Hán' : 'từ vựng'}
          </div>
        </div>

        <div className="washi-kpi-cell">
          <div className="washi-kpi-cell__head">
            <CheckCircle2 size={15} /> Vững vàng
          </div>
          <div className="washi-kpi-cell__val washi-kpi-cell__val--success">{stats.masteredCount}</div>
          <div className="washi-kpi-cell__label">Đã thành thạo</div>
        </div>

        <div className="washi-kpi-cell">
          <div className="washi-kpi-cell__head">
            <Flame size={15} /> Đến hạn
          </div>
          <div className="washi-kpi-cell__val washi-kpi-cell__val--warning">{stats.dueTodayCount}</div>
          <div className="washi-kpi-cell__label">Cần ôn hôm nay</div>
        </div>

        <div className="washi-kpi-cell">
          <div className="washi-kpi-cell__head">
            <TrendingUp size={15} /> Độ nhớ
          </div>
          <div className="washi-kpi-cell__val washi-kpi-cell__val--accent">{stats.averageMastery}%</div>
          <div className="washi-kpi-cell__label">Trung bình thành thạo</div>
        </div>
      </div>

      {/* 3.5 STREAK & CONTRIBUTION HEATMAP WIDGET */}
      <div className="srs-heatmap-card">
        <div className="srs-heatmap-header">
          {/* Left: Streak stats & Motivation */}
          <div className="srs-streak-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div className="srs-streak-badge">
                <Flame size={24} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)' }}>
                    {globalStats?.streak ?? stats.streak ?? 0}
                  </span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-warning)' }}>
                    ngày liên tiếp
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                  Kỷ lục: {globalStats?.longestStreak ?? stats.longestStreak ?? 0} ngày · Hôm nay:{' '}
                  {globalStats?.reviewedToday ?? stats.reviewedToday ?? 0} thẻ
                </div>
              </div>
            </div>

            {/* Daily Urgency Pressure Banner */}
            {stats.dueTodayCount > 0 ? (
              <div className="srs-urgency-banner srs-urgency-banner--due">
                <Flame size={15} /> Bạn còn {stats.dueTodayCount} thẻ cần hoàn thành hôm nay để giữ chuỗi!
              </div>
            ) : (
              <div className="srs-urgency-banner srs-urgency-banner--done">
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
              background: 'var(--color-success)',
              color: 'var(--color-text-inverse)',
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
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-success)', marginLeft: 'auto' }}>
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
                          tabIndex={0}
                          role="img"
                          aria-label={`${day.date}: ${day.count} thẻ`}
                          className="srs-heatmap-cell"
                          data-level={Math.min(4, Math.max(0, day.level || 0))}
                          onFocus={() => setHoveredDay(day)}
                          onBlur={() => setHoveredDay(null)}
                          onMouseEnter={() => setHoveredDay(day)}
                          onMouseLeave={() => setHoveredDay(null)}
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
              {[0, 1, 2, 3, 4].map((lvl) => (
                <div
                  key={lvl}
                  className="srs-heatmap-cell"
                  data-level={lvl}
                  style={{ width: '10px', height: '10px' }}
                />
              ))}
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
              className={`srs-status-btn${activeStatus === st.id ? ' is-active' : ''}`}
            >
              {st.label} {st.count > 0 && <span style={{ opacity: 0.8 }}>({st.count})</span>}
            </button>
          ))}
        </div>

        {/* JLPT Levels & Anki Launch Button */}
        <div style={{ display: 'flex', flexWrap: 'wrap', maxWidth: '100%', alignItems: 'center', gap: '0.5rem' }}>
          <div className="srs-level-group">
            {JLPT_LEVELS.map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setActiveLevel(lvl)}
                className={`srs-level-btn${activeLevel === lvl ? ' is-active' : ''}`}
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
              fontWeight: 700,
              fontSize: '0.82rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Play size={14} /> Bắt đầu ôn tập
          </Button>

          <div className="srs-view-toggle">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`srs-view-btn${viewMode === 'grid' ? ' is-active' : ''}`}
              title="Xem dạng Lưới"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`srs-view-btn${viewMode === 'list' ? ' is-active' : ''}`}
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
          <Loader2 size={36} className="animate-spin" style={{ margin: '0 auto', color: 'var(--color-accent-text)' }} />
          <p style={{ marginTop: '1rem', color: 'var(--color-text-secondary)' }}>Đang nạp thẻ ôn tập SRS...</p>
        </div>
      ) : cards.length === 0 ? (
        <EmptyState
          title="Không có thẻ ôn tập nào phù hợp"
          description="Hãy thử chọn cấp độ khác hoặc tra từ điển để thêm từ vựng / ngữ pháp vào sổ ôn tập."
          action={
            <Button variant="primary" onClick={() => onDictionary?.(searchQuery)}>
              Mở từ điển tra từ
            </Button>
          }
        />
      ) : viewMode === 'grid' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 210px), 1fr))',
            gap: '1rem',
          }}
        >
          {cards.map((card, idx) => {
            const mastery = card.masteryPercentage || 0
            const isMastered = mastery >= 80
            const isDue = card.stage === 'due'
            const badgeLabel = isMastered ? 'Thành thạo' : isDue ? 'Cần ôn' : 'Đang học'
            const stageMod = isMastered ? 'mastered' : isDue ? 'due' : 'learning'
            const badgeColor = isMastered
              ? 'var(--color-success)'
              : isDue
                ? 'var(--color-warning)'
                : 'var(--color-accent-text)'

            return (
              <div
                key={card.id}
                role="button"
                tabIndex={0}
                aria-label={`Ôn tập ${card.term}`}
                className="srs-card-item"
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    openStudySession(idx)
                  }
                }}
                onClick={() => openStudySession(idx)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Header: Status badge & JLPT level */}
                <div className="srs-card-head">
                  <span className={`srs-stage-pill srs-stage-pill--${stageMod}`}>{badgeLabel}</span>
                  {card.jlptLevel && <span className="srs-card-level">{card.jlptLevel}</span>}
                </div>

                {/* Main term & reading */}
                <div className="srs-card-body">
                  <div className={`srs-card-term${card.type === 'kanji' ? ' srs-card-term--kanji' : ''}`}>
                    {card.term}
                  </div>
                  {card.reading && card.reading !== card.term && <div className="srs-card-reading">{card.reading}</div>}
                  <div className="srs-card-meaning">{card.meaning}</div>
                </div>

                {/* Footer: Progress bar with % text */}
                <div className="srs-card-footer" style={{ display: 'block', marginTop: '0.75rem' }}>
                  <div className="srs-card-mastery-meta">
                    <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>THÀNH THẠO</span>
                    <span style={{ color: badgeColor, fontWeight: 800 }}>{mastery}%</span>
                  </div>
                  <div className="srs-card-mastery-track">
                    <div className="srs-card-mastery-fill" style={{ width: `${mastery}%`, background: badgeColor }} />
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
              className="review-list-card"
              role="button"
              tabIndex={0}
              aria-label={`Ôn tập ${card.term}`}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  openStudySession(idx)
                }
              }}
              onClick={() => openStudySession(idx)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem 1rem' }}>
                <span className="srs-list-term">{card.term}</span>
                <span className="srs-list-reading">{card.reading}</span>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>{card.meaning}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Badge variant="primary">{card.jlptLevel || 'N5'}</Badge>
                <span
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    color: card.masteryPercentage >= 80 ? 'var(--color-success)' : 'var(--color-accent-text)',
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
