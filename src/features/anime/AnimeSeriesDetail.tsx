import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clapperboard,
  Film,
  Layers,
  Play,
  Tv,
  X,
} from 'lucide-react'
import type { AnimeEpisodeSummary, AnimeSeriesDetail as AnimeSeriesDetailType } from './animeTypes'

interface AnimeSeriesDetailProps {
  series: AnimeSeriesDetailType | null
  episodes: AnimeEpisodeSummary[]
  isLoadingSeries: boolean
  isLoadingEpisodes: boolean
  seriesError: string | null
  episodesError?: string | null
  selectedEpisodeId: string | null
  onSelectEpisode: (episodeId: string, episodeNumber: number) => void
  onClose: () => void
  onRetry?: () => void
  onRetryEpisodes?: () => void
}

export function AnimeSeriesDetail({
  series,
  episodes,
  isLoadingSeries,
  isLoadingEpisodes,
  seriesError,
  episodesError,
  selectedEpisodeId,
  onSelectEpisode,
  onClose,
  onRetry,
  onRetryEpisodes,
}: AnimeSeriesDetailProps) {
  const [imgError, setImgError] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [activeSeasonSlug, setActiveSeasonSlug] = useState<string>(
    () => series?.seasons?.[0]?.season_slug || ''
  )

  // Sync active season if series changes
  useEffect(() => {
    if (series?.seasons && series.seasons.length > 0) {
      if (!series.seasons.some((s) => s.season_slug === activeSeasonSlug)) {
        setActiveSeasonSlug(series.seasons[0]?.season_slug || '')
      }
    }
  }, [series, activeSeasonSlug])

  // Escape key handler to close detail
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleEpisodeClick = (episode: AnimeEpisodeSummary) => {
    onSelectEpisode(episode.episode_id, episode.episode_number)
    setNotice(
      `Đang mở ${
        episode.title ? `Tập ${episode.episode_number}: ${episode.title}` : `Tập ${episode.episode_number}`
      }...`
    )
  }

  if (isLoadingSeries) {
    return (
      <section className="anime-detail-panel anime-series-hub" aria-label="Đang tải chi tiết anime">
        <div className="anime-detail-skeleton">
          <div className="anime-detail-skeleton__body">
            <div className="anime-detail-skeleton__line anime-detail-skeleton__line--title" />
            <div className="anime-detail-skeleton__line anime-detail-skeleton__line--subtitle" />
            <div className="anime-detail-skeleton__line anime-detail-skeleton__line--desc" />
          </div>
        </div>
      </section>
    )
  }

  if (seriesError || !series) {
    return (
      <section className="anime-detail-panel" aria-label="Lỗi tải chi tiết anime">
        <div className="anime-detail-error-box" role="alert">
          <p>{seriesError || 'Không thể tải chi tiết anime lúc này.'}</p>
          <div className="anime-detail-error-actions">
            {onRetry && (
              <button type="button" onClick={onRetry} className="anime-btn anime-btn--primary">
                Thử lại
              </button>
            )}
            <button type="button" onClick={onClose} className="anime-btn anime-btn--secondary">
              Đóng
            </button>
          </div>
        </div>
      </section>
    )
  }

  const hasPoster = Boolean(series.poster_url) && !imgError

  // Group episodes by season if seasons exist
  const seasonsMap = new Map<string, AnimeEpisodeSummary[]>()
  if (series.seasons && series.seasons.length > 0) {
    for (const season of series.seasons) {
      seasonsMap.set(season.season_slug, [])
    }
    for (const ep of episodes) {
      const list = seasonsMap.get(ep.season_slug)
      if (list) {
        list.push(ep)
      } else {
        const defaultList = seasonsMap.get(series.seasons[0]?.season_slug ?? 'default')
        if (defaultList) defaultList.push(ep)
      }
    }
  }

  const displayedEpisodes =
    seasonsMap.size > 1 && activeSeasonSlug
      ? seasonsMap.get(activeSeasonSlug) || episodes
      : episodes

  return (
    <section
      className="anime-detail-panel anime-series-hub"
      aria-labelledby="anime-detail-title"
      tabIndex={-1}
    >
      {/* Series Hub Hero Banner */}
      <div className="anime-series-hub__backdrop" aria-hidden="true">
        {hasPoster && series.poster_url ? (
          <img
            src={series.poster_url}
            alt=""
            className="anime-series-hub__backdrop-img"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="anime-series-hub__backdrop-placeholder">
            <Clapperboard size={96} strokeWidth={1.2} />
          </div>
        )}
        <div className="anime-series-hub__scrim-h" />
        <div className="anime-series-hub__scrim-v" />
      </div>

      {/* Top Header Navigation */}
      <div className="anime-detail-header anime-series-hub__nav">
        <button
          type="button"
          onClick={onClose}
          className="anime-detail-back-btn"
          aria-label="Quay lại danh mục anime (phím Escape)"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          <span>Quay lại danh mục</span>
        </button>

        <button
          type="button"
          onClick={onClose}
          className="anime-detail-close-btn"
          aria-label="Đóng chi tiết series"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      {/* Main Info Hero (Wide Layout, No Vertical Poster Card) */}
      <div className="anime-detail-hero anime-series-hub__hero">
        <div className="anime-detail-info anime-series-hub__info">
          <div className="anime-detail-title-group">
            <h2 id="anime-detail-title" className="anime-detail-title-vi">
              {series.title_vi}
            </h2>
            {series.title_ja && (
              <p className="anime-detail-title-ja font-jp" lang="ja">
                {series.title_ja}
              </p>
            )}
          </div>

          <div className="anime-detail-badges">
            {series.jlpt_level && (
              <span className={`anime-badge-jlpt anime-badge-jlpt--${series.jlpt_level.toLowerCase()}`}>
                Trình độ {series.jlpt_level}
              </span>
            )}
            {series.category && (
              <span className="anime-badge-category">
                {series.category}
              </span>
            )}
            <span className="anime-badge-meta">
              <Film size={14} aria-hidden="true" />
              {series.total_episodes} tập
            </span>
            {series.seasons && series.seasons.length > 0 && (
              <span className="anime-badge-meta">
                <Layers size={14} aria-hidden="true" />
                {series.seasons.length} mùa
              </span>
            )}
            {series.channel && (
              <span className="anime-badge-meta">
                <Tv size={14} aria-hidden="true" />
                {series.channel}
              </span>
            )}
          </div>

          {series.description && (
            <div className="anime-detail-desc-box">
              <h3 className="anime-detail-section-title">Tóm tắt nội dung</h3>
              <p className="anime-detail-desc-text">
                {series.description}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Feedback Notice on Selection */}
      {notice && (
        <div className="anime-detail-notice" role="status" aria-live="polite">
          <CheckCircle2 size={18} className="anime-detail-notice-icon" aria-hidden="true" />
          <span>{notice}</span>
        </div>
      )}

      {/* Episode Picker Section */}
      <div className="anime-detail-episodes-section">
        <div className="anime-series-hub__episodes-header">
          <h3 className="anime-detail-section-title">
            Danh sách tập phim ({episodes.length} tập)
          </h3>

          {/* Season Selector Tabs */}
          {series.seasons && series.seasons.length > 1 && (
            <div
              className="anime-season-tabs"
              role="tablist"
              aria-label="Chọn mùa phim"
            >
              {series.seasons.map((season) => {
                const seasonEpisodes = seasonsMap.get(season.season_slug) || []
                const isActive = activeSeasonSlug === season.season_slug
                return (
                  <button
                    key={season.season_id}
                    type="button"
                    role="tab"
                    id={`season-tab-${season.season_slug}`}
                    aria-controls={`season-panel-${season.season_slug}`}
                    aria-selected={isActive}
                    className={`anime-season-tab${isActive ? ' is-active' : ''}`}
                    onClick={() => setActiveSeasonSlug(season.season_slug)}
                  >
                    <span>{season.title_vi || season.season_label || `Mùa ${season.season_ordinal}`}</span>
                    <span className="anime-season-tab__count">({seasonEpisodes.length})</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {isLoadingEpisodes ? (
          <div className="anime-episodes-skeleton" aria-label="Đang tải danh sách tập">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="anime-episode-skeleton-btn" />
            ))}
          </div>
        ) : episodesError ? (
          <div className="anime-detail-error-box anime-detail-error-box--episodes" role="alert">
            <p>{episodesError}</p>
            {(onRetryEpisodes || onRetry) && (
              <button
                type="button"
                onClick={onRetryEpisodes || onRetry}
                className="anime-btn anime-btn--primary"
              >
                Thử lại
              </button>
            )}
          </div>
        ) : episodes.length === 0 ? (
          <p className="anime-episodes-empty">Chưa có thông tin tập phim cho series này.</p>
        ) : (
          /* Episode Rows (Horizontal Streaming Pattern with Semantic Placeholders & Honest CTAs) */
          <div className="anime-episodes-list" role="list">
            {displayedEpisodes.map((ep) => {
              const isSelected = selectedEpisodeId === ep.episode_id
              const isPlayable = Boolean(ep.playback_allowed)
              const hasSubs = Boolean(ep.has_subtitles)

              return (
                <button
                  key={ep.episode_id}
                  type="button"
                  onClick={() => handleEpisodeClick(ep)}
                  className={`anime-episode-row${isSelected ? ' is-selected' : ''}`}
                  aria-label={`Chọn tập ${ep.episode_number}${
                    ep.title ? ` - ${ep.title}` : ''
                  }: ${ep.has_subtitles ? 'Có phụ đề' : 'Chưa có phụ đề'}`}
                  aria-pressed={isSelected}
                >
                  <span className="anime-episode-row__index">#{ep.episode_number}</span>

                  {/* Semantic horizontal thumbnail placeholder: No series poster recycling */}
                  <div className="anime-episode-row__semantic-thumb" aria-hidden="true">
                    <Clapperboard size={18} strokeWidth={1.5} />
                  </div>

                  <div className="anime-episode-row__main">
                    <div className="anime-episode-row__header">
                      <span className="anime-episode-row__num">
                        Tập {ep.episode_number}
                      </span>
                      {ep.title && (
                        <span className="anime-episode-row__title">
                          {ep.title}
                        </span>
                      )}
                      <span
                        className={`anime-episode-badge ${
                          ep.has_subtitles
                            ? 'anime-episode-badge--subbed'
                            : 'anime-episode-badge--raw'
                        }`}
                      >
                        {ep.has_subtitles ? 'Có phụ đề' : 'Chưa có phụ đề'}
                      </span>
                    </div>

                    <span className="anime-episode-row__cue-count">
                      {ep.cue_count ? `${ep.cue_count} câu thoại tương tác` : 'Phụ đề gốc'}
                    </span>
                  </div>

                  {/* Honest Media Capability CTA */}
                  <div className="anime-episode-row__cta-wrapper">
                    {isPlayable ? (
                      <span className="anime-btn anime-btn--primary anime-episode-row__cta anime-episode-row__cta--play">
                        <Play size={14} fill="currentColor" aria-hidden="true" />
                        Học ngay
                      </span>
                    ) : hasSubs ? (
                      <span className="anime-btn anime-btn--secondary anime-episode-row__cta anime-episode-row__cta--sub">
                        <BookOpen size={14} aria-hidden="true" />
                        Học phụ đề
                      </span>
                    ) : (
                      <span className="anime-episode-row__status-badge">
                        Chưa có nguồn phát
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
