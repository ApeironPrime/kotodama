import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, RotateCcw, X } from 'lucide-react'
import { animeDictionaryCache } from './animeDictionaryCache'
import { AnimeSrsActions } from './AnimeSrsActions'
import type {
  AnimeDictionaryEntry,
  AnimeSubtitleCue,
  AnimeSubtitleToken,
} from './animePlaybackTypes'

export interface AnimeWordPopoverProps {
  episodeId: string
  cue: AnimeSubtitleCue
  token: AnimeSubtitleToken
  triggerElement: HTMLElement | null
  onClose: () => void
}

function formatSeconds(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export const AnimeWordPopover: React.FC<AnimeWordPopoverProps> = ({
  episodeId,
  cue,
  token,
  triggerElement,
  onClose,
}) => {
  const [entry, setEntry] = useState<AnimeDictionaryEntry | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const popoverRef = useRef<HTMLDivElement | null>(null)
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const loadDictionaryData = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    setIsLoading(true)
    setError(null)
    setEntry(null)

    try {
      const data = await animeDictionaryCache.lookupToken(token, {
        signal: abortControllerRef.current.signal,
      })
      setEntry(data)
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError') {
        return
      }
      const message = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: string }).message)
        : 'Không thể tra cứu từ vựng. Vui lòng thử lại.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadDictionaryData()
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [loadDictionaryData])

  // Focus management: focus close button on open; restore to triggerElement on unmount
  useEffect(() => {
    const prevTrigger = triggerElement
    // Delay slightly for render completion
    const timer = setTimeout(() => {
      closeBtnRef.current?.focus()
    }, 50)

    return () => {
      clearTimeout(timer)
      if (prevTrigger && typeof prevTrigger.focus === 'function') {
        prevTrigger.focus()
      }
    }
  }, [triggerElement])

  // Escape key & Click outside listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        (!triggerElement || !triggerElement.contains(e.target as Node))
      ) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [onClose, triggerElement])

  return (
    <div
      ref={popoverRef}
      className="anime-word-popover"
      role="dialog"
      aria-modal="false"
      aria-label={`Tra từ: ${token.surface}`}
      tabIndex={-1}
    >
      {/* Popover Header */}
      <div className="anime-word-popover__header">
        <div className="anime-word-popover__title-area">
          <span className="anime-word-popover__surface" lang="ja">
            {token.surface}
          </span>
          {entry?.reading && entry.reading !== token.surface && (
            <span className="anime-word-popover__reading" lang="ja">
              【{entry.reading}】
            </span>
          )}
          {entry?.hanviet && (
            <span className="anime-word-popover__hanviet">
              {entry.hanviet}
            </span>
          )}
        </div>

        <div className="anime-word-popover__header-actions">
          {entry?.jlpt && (
            <span className={`anime-badge anime-badge--${entry.jlpt.toLowerCase()}`}>
              {entry.jlpt}
            </span>
          )}
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="anime-word-popover__close-btn"
            aria-label="Đóng bảng tra từ"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Popover Content */}
      <div className="anime-word-popover__content">
        {isLoading ? (
          <div className="anime-word-popover__skeleton" aria-label="Đang tra cứu từ điển…">
            <div className="anime-word-popover__skeleton-line anime-word-popover__skeleton-line--lg" />
            <div className="anime-word-popover__skeleton-line" />
            <div className="anime-word-popover__skeleton-line anime-word-popover__skeleton-line--sm" />
          </div>
        ) : error ? (
          <div className="anime-word-popover__error" role="alert">
            <AlertCircle size={20} className="anime-word-popover__error-icon" aria-hidden="true" />
            <p className="anime-word-popover__error-text">{error}</p>
            <button
              type="button"
              onClick={loadDictionaryData}
              className="anime-btn anime-btn--secondary anime-btn--sm"
            >
              <RotateCcw size={14} aria-hidden="true" />
              <span>Thử lại</span>
            </button>
          </div>
        ) : entry ? (
          <>
            {/* Part of Speech */}
            {entry.pos_vi && entry.pos_vi.length > 0 && (
              <div className="anime-word-popover__pos">
                {entry.pos_vi.join(', ')}
              </div>
            )}

            {/* Meanings */}
            <div className="anime-word-popover__meanings">
              {entry.meanings && entry.meanings.length > 0 ? (
                <ul className="anime-word-popover__meanings-list">
                  {entry.meanings.slice(0, 4).map((m, idx) => {
                    const text = typeof m === 'string' ? m : m.def_vi || ''
                    if (!text) return null
                    return (
                      <li key={idx} className="anime-word-popover__meaning-item">
                        {typeof m === 'object' && m.pos && (
                          <span className="anime-word-popover__meaning-pos">({m.pos}) </span>
                        )}
                        <span>{text}</span>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="anime-word-popover__empty-desc">Chưa có dữ liệu định nghĩa chi tiết.</p>
              )}
            </div>

            {/* Fallback Notice */}
            {entry.isFallback && (
              <div className="anime-word-popover__fallback-notice">
                Kết quả tra cứu từ kho dữ liệu từ điển tham khảo.
              </div>
            )}

            {/* Sentence Context */}
            <div className="anime-word-popover__context">
              <div className="anime-word-popover__context-time">
                Mốc {formatSeconds(cue.start)}
              </div>
              {cue.ja && (
                <div className="anime-word-popover__context-ja" lang="ja">
                  {cue.ja}
                </div>
              )}
              {cue.vi && (
                <div className="anime-word-popover__context-vi" lang="vi">
                  {cue.vi}
                </div>
              )}
            </div>

            {/* SRS Actions */}
            <div className="anime-word-popover__srs-row">
              <AnimeSrsActions
                episodeId={episodeId}
                cue={cue}
                token={token}
                dictionaryEntry={entry}
                mode="token"
              />
              <AnimeSrsActions
                episodeId={episodeId}
                cue={cue}
                token={token}
                dictionaryEntry={entry}
                mode="sentence"
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
