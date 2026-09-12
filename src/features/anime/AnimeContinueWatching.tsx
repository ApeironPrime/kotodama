import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, History, Play, RotateCcw } from 'lucide-react'
import { useAuth } from '../auth/authContext'
import { animePlaybackApi } from './animePlaybackApi'
import type { AnimeContinueWatchingItem } from './animePlaybackTypes'

export interface AnimeContinueWatchingProps {
  onSelectEpisode: (seriesSlug: string, episodeId: string) => void
  className?: string | undefined
}

function formatSeconds(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export const AnimeContinueWatching: React.FC<AnimeContinueWatchingProps> = ({
  onSelectEpisode,
  className = '',
}) => {
  const { status, user } = useAuth()
  const isAuthenticated = status === 'authenticated' && Boolean(user)

  const [items, setItems] = useState<AnimeContinueWatchingItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const loadContinueWatching = useCallback(async () => {
    if (!isAuthenticated) return

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    setIsLoading(true)
    setError(null)

    try {
      const res = await animePlaybackApi.fetchContinueWatching({
        signal: abortControllerRef.current.signal,
      })
      setItems(res.items || [])
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError') {
        return
      }
      setError('Không thể tải danh sách xem tiếp.')
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (isAuthenticated) {
      loadContinueWatching()
    } else {
      setItems([])
      setIsLoading(false)
      setError(null)
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [isAuthenticated, loadContinueWatching])

  // Guest users: do not render anything (zero leak)
  if (!isAuthenticated) {
    return null
  }

  // If not loading, no error, and empty items: hide section
  if (!isLoading && !error && items.length === 0) {
    return null
  }

  return (
    <section
      className={`anime-continue-section ${className}`}
      aria-label="Danh sách xem tiếp"
    >
      <div className="anime-continue-header">
        <div className="anime-continue-title-group">
          <History size={20} className="anime-continue-icon" aria-hidden="true" />
          <h2 className="anime-continue-title">Xem tiếp</h2>
        </div>
      </div>

      {isLoading ? (
        <div className="anime-continue-grid" aria-label="Đang tải danh sách xem tiếp">
          {[1, 2, 3].map((i) => (
            <div key={i} className="anime-continue-card-skeleton" aria-hidden="true">
              <div className="anime-continue-card-skeleton__thumb" />
              <div className="anime-continue-card-skeleton__body">
                <div className="anime-continue-card-skeleton__line anime-continue-card-skeleton__line--title" />
                <div className="anime-continue-card-skeleton__line anime-continue-card-skeleton__line--sub" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="anime-continue-error" role="alert">
          <AlertCircle size={18} className="anime-continue-error__icon" aria-hidden="true" />
          <span>{error}</span>
          <button
            type="button"
            onClick={loadContinueWatching}
            className="anime-btn anime-btn--secondary anime-btn--sm"
          >
            <RotateCcw size={12} aria-hidden="true" />
            <span>Thử lại</span>
          </button>
        </div>
      ) : (
        <div className="anime-continue-grid" role="list">
          {items.map((item) => {
            const percent = item.duration > 0
              ? Math.min(100, Math.max(0, (item.last_playback_position / item.duration) * 100))
              : 0
            const episodeLabel = item.episode_title
              ? `Tập ${item.episode_number}: ${item.episode_title}`
              : `Tập ${item.episode_number}`

            return (
              <div
                key={item.episode_id}
                className="anime-continue-card"
                role="listitem"
              >
                <button
                  type="button"
                  onClick={() => onSelectEpisode(item.series_slug, item.episode_id)}
                  className="anime-continue-card__action"
                  aria-label={`Tiếp tục xem ${item.series_title_vi} - ${episodeLabel} (đã xem ${formatSeconds(item.last_playback_position)})`}
                >
                  <div className="anime-continue-card__thumb-area">
                    <div className="anime-continue-card__play-badge" aria-hidden="true">
                      <Play size={16} fill="currentColor" />
                    </div>
                    {/* Progress Bar Track */}
                    <div
                      className="anime-continue-card__progress-bar"
                      role="progressbar"
                      aria-valuenow={Math.round(percent)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="anime-continue-card__progress-fill"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  <div className="anime-continue-card__info">
                    <span className="anime-continue-card__series">
                      {item.series_title_vi}
                    </span>
                    <span className="anime-continue-card__episode">
                      {episodeLabel}
                    </span>
                    <div className="anime-continue-card__time">
                      <span>{formatSeconds(item.last_playback_position)}</span>
                      {item.duration > 0 && (
                        <span> / {formatSeconds(item.duration)}</span>
                      )}
                    </div>
                  </div>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
