import React, { useEffect, useRef } from 'react'
import { Clapperboard, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { AnimeSrsActions } from './AnimeSrsActions'
import type { AnimeSubtitleCue, AnimeSubtitleToken } from './animePlaybackTypes'

export interface SubtitleTranscriptProps {
  cues: AnimeSubtitleCue[]
  activeCueIds: Set<number>
  hasSubtitles: boolean
  isLoading: boolean
  isPrefetching: boolean
  error: string | null
  offset: number
  showJapanese: boolean
  showVietnamese: boolean
  showFurigana: boolean
  hasFuriganaData: boolean
  onSeekTo: (seconds: number) => void
  onOffsetChange: (offset: number) => void
  onResetOffset: () => void
  onToggleJapanese: (show: boolean) => void
  onToggleVietnamese: (show: boolean) => void
  onToggleFurigana: (show: boolean) => void
  onRetry?: () => void
  onSelectToken?: (cue: AnimeSubtitleCue, token: AnimeSubtitleToken, triggerEl: HTMLElement) => void
  episodeId?: string | undefined
}

function formatSeconds(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export const SubtitleTranscript: React.FC<SubtitleTranscriptProps> = ({
  cues,
  activeCueIds,
  hasSubtitles,
  isLoading,
  isPrefetching,
  error,
  offset,
  showJapanese,
  showVietnamese,
  showFurigana,
  hasFuriganaData,
  onSeekTo,
  onOffsetChange,
  onResetOffset,
  onToggleJapanese,
  onToggleVietnamese,
  onToggleFurigana,
  onRetry,
  onSelectToken,
  episodeId,
}) => {
  const activeItemRef = useRef<HTMLLIElement | null>(null)
  const userScrolledRef = useRef<boolean>(false)
  const scrollTimeoutRef = useRef<number | null>(null)

  // Auto-scroll active cue into view if user hasn't actively scrolled away
  useEffect(() => {
    if (activeItemRef.current && !userScrolledRef.current) {
      activeItemRef.current.scrollIntoView?.({
        block: 'nearest',
        behavior: 'smooth',
      })
    }
  }, [activeCueIds])

  const handleContainerScroll = () => {
    userScrolledRef.current = true
    if (scrollTimeoutRef.current !== null) {
      window.clearTimeout(scrollTimeoutRef.current)
    }
    // Reset user scroll state after 3s of idle scroll
    scrollTimeoutRef.current = window.setTimeout(() => {
      userScrolledRef.current = false
    }, 3000)
  }

  return (
    <div className="anime-transcript" aria-label="Bảng phụ đề tương tác">
      {/* Transcript Toolbar */}
      <div className="anime-transcript-toolbar">
        <div className="anime-transcript-layers" role="group" aria-label="Bộ chọn lớp phụ đề">
          <button
            type="button"
            className={`anime-pill-btn ${showJapanese ? 'anime-pill-btn--active' : ''}`}
            onClick={() => onToggleJapanese(!showJapanese)}
            aria-pressed={showJapanese}
          >
            Nhật
          </button>
          <button
            type="button"
            className={`anime-pill-btn ${showVietnamese ? 'anime-pill-btn--active' : ''}`}
            onClick={() => onToggleVietnamese(!showVietnamese)}
            aria-pressed={showVietnamese}
          >
            Việt
          </button>
          <button
            type="button"
            className="anime-pill-btn anime-pill-btn--disabled"
            disabled={!hasFuriganaData}
            title="Furigana chưa được cung cấp trong dữ liệu tập này"
            aria-label="Furigana (Chưa có dữ liệu)"
            onClick={() => onToggleFurigana(!showFurigana)}
          >
            Furigana
          </button>
        </div>

        {/* Offset Synchronizer */}
        <div className="anime-transcript-offset" role="group" aria-label="Đồng bộ thời gian phụ đề">
          <SlidersHorizontal size={14} aria-hidden="true" />
          <span className="anime-transcript-offset-label">
            Lệch: {offset > 0 ? `+${offset.toFixed(1)}` : offset.toFixed(1)}s
          </span>
          <input
            type="range"
            min="-5.0"
            max="5.0"
            step="0.1"
            value={offset}
            onChange={(e) => onOffsetChange(parseFloat(e.target.value))}
            className="anime-transcript-offset-slider"
            aria-label="Chỉnh độ lệch phụ đề từ -5 giây đến +5 giây"
          />
          {offset !== 0 && (
            <button
              type="button"
              onClick={onResetOffset}
              className="anime-transcript-offset-reset"
              title="Đặt lại độ lệch về 0"
              aria-label="Đặt lại độ lệch về 0"
            >
              <RotateCcw size={12} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Transcript Body */}
      <div
        className="anime-transcript-body"
        onScroll={handleContainerScroll}
        tabIndex={0}
        role="region"
        aria-label="Danh sách câu phụ đề tương tác"
      >
        {!hasSubtitles ? (
          <div className="anime-transcript-state anime-transcript-state--empty">
            <Clapperboard size={32} className="anime-transcript-state__icon" aria-hidden="true" />
            <p className="anime-transcript-state__title">Tập này chưa có phụ đề tương tác</p>
            <p className="anime-transcript-state__desc">
              Bạn vẫn có thể phát video bài học bình thường nếu nguồn phát hợp lệ.
            </p>
          </div>
        ) : error ? (
          <div className="anime-transcript-state anime-transcript-state--error">
            <p className="anime-transcript-state__title">{error}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="anime-btn anime-btn--secondary anime-btn--sm"
              >
                <RotateCcw size={14} aria-hidden="true" />
                <span>Thử lại</span>
              </button>
            )}
          </div>
        ) : isLoading ? (
          <div className="anime-transcript-skeleton" aria-label="Đang tải phụ đề...">
            <div className="anime-transcript-skeleton__item" />
            <div className="anime-transcript-skeleton__item" />
            <div className="anime-transcript-skeleton__item" />
            <div className="anime-transcript-skeleton__item" />
          </div>
        ) : cues.length === 0 ? (
          <div className="anime-transcript-state anime-transcript-state--empty">
            <p className="anime-transcript-state__title">Chưa có câu phụ đề nào trong đoạn này</p>
          </div>
        ) : (
          <ol className="anime-transcript-list" role="list">
            {cues.map((cue) => {
              const isActive = activeCueIds.has(cue.cue_id)
              const hasJa = showJapanese && Boolean(cue.ja)
              const hasVi = showVietnamese && Boolean(cue.vi)

              return (
                <li
                  key={cue.cue_id}
                  ref={isActive ? (el) => { activeItemRef.current = el } : undefined}
                  className={`anime-transcript-item ${isActive ? 'anime-transcript-item--active' : ''}`}
                >
                  <div className="anime-transcript-cue-card">
                    <button
                      type="button"
                      onClick={() => onSeekTo(cue.start)}
                      className="anime-transcript-cue-time-btn"
                      aria-label={`Tua tới ${formatSeconds(cue.start)}: ${cue.ja}`}
                    >
                      {formatSeconds(cue.start)}
                    </button>

                    <div className="anime-transcript-cue-content">
                      {hasJa && (
                        <div className="anime-transcript-cue-ja" lang="ja">
                          {cue.tokens && cue.tokens.length > 0 ? (
                            cue.tokens.map((token) => (
                              <button
                                key={token.token_ordinal}
                                type="button"
                                className="anime-sub-token-btn"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onSelectToken?.(cue, token, e.currentTarget)
                                }}
                                aria-label={`${token.surface} — Tra nghĩa`}
                              >
                                {token.surface}
                              </button>
                            ))
                          ) : (
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={() => onSeekTo(cue.start)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  onSeekTo(cue.start)
                                }
                              }}
                              className="anime-transcript-cue-plain-text"
                            >
                              {cue.ja}
                            </span>
                          )}
                        </div>
                      )}
                      {hasVi && (
                        <div
                          className="anime-transcript-cue-vi"
                          lang="vi"
                          role="button"
                          tabIndex={0}
                          onClick={() => onSeekTo(cue.start)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              onSeekTo(cue.start)
                            }
                          }}
                        >
                          {cue.vi}
                        </div>
                      )}
                      {!hasJa && !hasVi && (
                        <div className="anime-transcript-cue-muted">
                          (Đã ẩn phụ đề)
                        </div>
                      )}
                    </div>

                    {episodeId && (
                      <div className="anime-transcript-cue-actions">
                        <AnimeSrsActions
                          episodeId={episodeId}
                          cue={cue}
                          mode="sentence"
                        />
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        )}

        {isPrefetching && (
          <div className="anime-transcript-prefetching" aria-live="polite">
            <span className="anime-transcript-prefetching__dot" />
            Đang tải tiếp phụ đề…
          </div>
        )}
      </div>
    </div>
  )
}
