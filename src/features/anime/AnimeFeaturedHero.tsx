import { useState } from 'react'
import { Clapperboard, Film, Play, Sparkles, Subtitles } from 'lucide-react'
import type { AnimeSeriesSummary } from './animeTypes'

interface AnimeFeaturedHeroProps {
  series: AnimeSeriesSummary
  onSelect: (seriesSlug: string) => void
}

export function AnimeFeaturedHero({ series, onSelect }: AnimeFeaturedHeroProps) {
  const [imgError, setImgError] = useState(false)
  const hasPoster = Boolean(series.poster_url) && !imgError

  return (
    <section className="anime-hero" aria-label="Phim tiêu điểm">
      <div className="anime-hero__backdrop" aria-hidden="true">
        {hasPoster && series.poster_url ? (
          <img
            src={series.poster_url}
            alt=""
            onError={() => setImgError(true)}
            className="anime-hero__backdrop-img"
          />
        ) : (
          <div className="anime-hero__backdrop-placeholder">
            <Clapperboard size={80} strokeWidth={1.2} />
          </div>
        )}
        <div className="anime-hero__scrim-horizontal" />
        <div className="anime-hero__scrim-vertical" />
      </div>

      <div className="anime-hero__content">
        <div className="anime-hero__kicker">
          <Sparkles size={14} aria-hidden="true" />
          <span>Phim Nổi Bật</span>
        </div>

        <h2 className="anime-hero__title-vi">
          <span className="sr-only">Phim nổi bật: </span>
          {series.title_vi}
        </h2>

        {series.title_ja && (
          <p className="anime-hero__title-ja font-jp" lang="ja">
            {series.title_ja}
          </p>
        )}

        <div className="anime-hero__badges">
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
          <span className="anime-hero__badge-sub">
            <Subtitles size={14} aria-hidden="true" />
            <span>{series.subbed_episodes_count}/{series.total_episodes} tập có phụ đề</span>
          </span>
        </div>

        {series.description && (
          <p className="anime-hero__synopsis">
            {series.description}
          </p>
        )}

        <div className="anime-hero__actions">
          <button
            type="button"
            onClick={() => onSelect(series.series_slug)}
            className="anime-hero__play-btn"
            aria-label={`Mở danh sách tập ${series.title_vi}`}
          >
            <Play size={18} fill="currentColor" aria-hidden="true" />
            <span>Mở danh sách tập</span>
          </button>
        </div>
      </div>
    </section>
  )
}
