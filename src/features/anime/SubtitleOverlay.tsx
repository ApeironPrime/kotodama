import React from 'react'
import type { AnimeSubtitleCue, AnimeSubtitleToken } from './animePlaybackTypes'

export interface SubtitleOverlayProps {
  activeCues: AnimeSubtitleCue[]
  showJapanese: boolean
  showVietnamese: boolean
  onSelectToken?: (cue: AnimeSubtitleCue, token: AnimeSubtitleToken, triggerEl: HTMLElement) => void
}

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({
  activeCues,
  showJapanese,
  showVietnamese,
  onSelectToken,
}) => {
  if (activeCues.length === 0 || (!showJapanese && !showVietnamese)) {
    return null
  }

  return (
    <div
      className="anime-sub-overlay"
      aria-label="Phụ đề tương tác"
      aria-live="off"
    >
      <div className="anime-sub-cues-container">
        {activeCues.map((cue) => {
          const hasJa = showJapanese && Boolean(cue.ja)
          const hasVi = showVietnamese && Boolean(cue.vi)

          if (!hasJa && !hasVi) return null

          return (
            <div key={cue.cue_id} className="anime-sub-cue-card">
              {hasJa && (
                <div className="anime-sub-line anime-sub-line--ja" lang="ja">
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
                    <span>{cue.ja}</span>
                  )}
                </div>
              )}
              {hasVi && (
                <div className="anime-sub-line anime-sub-line--vi" lang="vi">
                  {cue.vi}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

