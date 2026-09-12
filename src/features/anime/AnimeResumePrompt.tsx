import React from 'react'
import { History, Play, RotateCcw, X } from 'lucide-react'

export interface AnimeResumePromptProps {
  position: number
  onContinue: () => void
  onStartOver: () => void
  onDismiss: () => void
}

function formatSeconds(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export const AnimeResumePrompt: React.FC<AnimeResumePromptProps> = ({
  position,
  onContinue,
  onStartOver,
  onDismiss,
}) => {
  const timeFormatted = formatSeconds(position)

  return (
    <div
      className="anime-resume-prompt"
      role="alertdialog"
      aria-label={`Tiếp tục từ ${timeFormatted}?`}
      aria-live="polite"
    >
      <div className="anime-resume-prompt__info">
        <History size={18} className="anime-resume-prompt__icon" aria-hidden="true" />
        <span className="anime-resume-prompt__text">
          Tiếp tục từ <strong>{timeFormatted}</strong>?
        </span>
      </div>

      <div className="anime-resume-prompt__actions">
        <button
          type="button"
          onClick={onContinue}
          className="anime-btn anime-btn--primary anime-btn--sm anime-resume-prompt__btn"
          aria-label={`Tiếp tục phát từ ${timeFormatted}`}
        >
          <Play size={14} aria-hidden="true" />
          <span>Tiếp tục</span>
        </button>

        <button
          type="button"
          onClick={onStartOver}
          className="anime-btn anime-btn--secondary anime-btn--sm anime-resume-prompt__btn"
          aria-label="Xem lại từ đầu tập (00:00)"
        >
          <RotateCcw size={14} aria-hidden="true" />
          <span>Xem từ đầu</span>
        </button>

        <button
          type="button"
          onClick={onDismiss}
          className="anime-resume-prompt__close"
          aria-label="Bỏ qua lời nhắc xem tiếp"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
