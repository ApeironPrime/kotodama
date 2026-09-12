import { useState } from 'react'
import { Clapperboard, Layers, Subtitles } from 'lucide-react'
import type { AnimeSeriesSummary } from './animeTypes'

interface AnimeSeriesCardProps {
  series: AnimeSeriesSummary
  onSelect: (seriesSlug: string) => void
  isSelected?: boolean
}

export function AnimeSeriesCard({ series, onSelect, isSelected = false }: AnimeSeriesCardProps) {
  const [imgError, setImgError] = useState(false)

  const hasPoster = Boolean(series.poster_url) && !imgError

  return (
    <article
      className={`anime-card anime-card--landscape${isSelected ? ' is-selected' : ''}`}
      aria-labelledby={`anime-card-title-${series.series_slug}`}
    >
      <button
        type="button"
        onClick={() => onSelect(series.series_slug)}
        className="anime-card__action-btn"
        aria-label={`Xem chi tiết và danh sách tập của ${series.title_vi}`}
      >
        <div className="anime-card__poster-container">
          {hasPoster && series.poster_url ? (
            <img
              src={series.poster_url}
              alt={series.title_vi}
              loading="lazy"
              onError={() => setImgError(true)}
              className="anime-card__poster-img"
            />
          ) : (
            <div className="anime-card__poster-placeholder" aria-hidden="true">
              <Clapperboard size={48} strokeWidth={1.5} className="anime-card__placeholder-icon" />
              <span className="anime-card__placeholder-text">Anime</span>
            </div>
          )}

          <div className="anime-card__scrim" aria-hidden="true" />

          <div className="anime-card__floating-badges">
            {series.jlpt_level && (
              <span className={`anime-card__badge-jlpt anime-card__badge-jlpt--${series.jlpt_level.toLowerCase()}`}>
                {series.jlpt_level}
              </span>
            )}
            <span className="anime-card__badge-sub">
              <Subtitles size={12} aria-hidden="true" />
              <span>{series.subbed_episodes_count}/{series.total_episodes}</span>
            </span>
          </div>
        </div>

        <div className="anime-card__content">
          <h3 id={`anime-card-title-${series.series_slug}`} className="anime-card__title-vi">
            {series.title_vi}
          </h3>

          {series.title_ja && (
            <p className="anime-card__title-ja font-jp" lang="ja">
              {series.title_ja}
            </p>
          )}

          <div className="anime-card__meta-tags">
            {series.category && (
              <span className="anime-card__tag-category">
                {series.category}
              </span>
            )}
            <span className="anime-card__tag-info">
              <Layers size={13} aria-hidden="true" />
              {series.season_count > 0 ? `${series.season_count} mùa` : '1 mùa'}
            </span>
            <span className="anime-card__tag-info anime-card__tag-info--sub">
              <Subtitles size={13} aria-hidden="true" />
              {series.subbed_episodes_count}/{series.total_episodes} tập có phụ đề
            </span>
          </div>

          <div className="anime-card__footer">
            <span className="anime-card__cta">
              Xem danh sách tập →
            </span>
          </div>
        </div>
      </button>
    </article>
  )
}
