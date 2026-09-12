import React, { useState } from 'react'
import { PAGE_PATHS } from '../../types/app'
import { Bookmark, Check, Loader2, LogIn } from 'lucide-react'
import { useAuth } from '../auth/authContext'
import { srsApi } from '../srs/srsApi'
import type { AnimeDictionaryEntry, AnimeSubtitleCue, AnimeSubtitleToken } from './animePlaybackTypes'
import type { SrsCard } from '../srs/srsTypes'

export interface AnimeSrsActionsProps {
  episodeId: string
  cue: AnimeSubtitleCue
  token?: AnimeSubtitleToken | null | undefined
  dictionaryEntry?: AnimeDictionaryEntry | null | undefined
  mode: 'token' | 'sentence'
  className?: string | undefined
}

function extractMeaningString(entry?: AnimeDictionaryEntry | null): string {
  if (!entry || !entry.meanings) return ''
  const defs: string[] = []
  for (const m of entry.meanings) {
    if (typeof m === 'string') {
      const trimmed = m.trim()
      if (trimmed) defs.push(trimmed)
    } else if (m && typeof m === 'object' && m.def_vi) {
      const trimmed = String(m.def_vi).trim()
      if (trimmed) defs.push(trimmed)
    }
  }
  return defs.slice(0, 3).join('; ')
}

export const AnimeSrsActions: React.FC<AnimeSrsActionsProps> = ({
  episodeId,
  cue,
  token,
  dictionaryEntry,
  mode,
  className = '',
}) => {
  const { status, user } = useAuth()
  const isAuthenticated = status === 'authenticated' && Boolean(user)

  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const isTokenMode = mode === 'token'
  const tokenIdentifier = token?.word_id ? String(token.word_id) : (token?.surface || dictionaryEntry?.word || 'unknown')
  const sourceContext = isTokenMode
    ? `anime:v1:episode:${episodeId}:cue:${cue.cue_id}:token:${tokenIdentifier}`
    : `anime:v1:episode:${episodeId}:cue:${cue.cue_id}:sentence`

  const sourceRecordId = isTokenMode
    ? String(token?.word_id || cue.cue_id)
    : String(cue.cue_id)

  const handleSave = async () => {
    if (!isAuthenticated || isSaving || isSaved) return

    setIsSaving(true)
    setStatusMessage(null)

    try {
      let card: SrsCard
      if (isTokenMode) {
        const term = dictionaryEntry?.word || token?.surface || ''
        const reading = dictionaryEntry?.reading || ''
        const hanViet = dictionaryEntry?.hanviet || ''
        const meaning = extractMeaningString(dictionaryEntry) || ''
        const jlptLevel = dictionaryEntry?.jlpt ? String(dictionaryEntry.jlpt) : undefined

        card = await srsApi.addCard({
          type: 'vocab',
          term,
          reading,
          hanViet,
          meaning,
          jlptLevel,
          sourceRecordId,
          sourceContext,
        })
      } else {
        const term = cue.ja || ''
        const meaning = cue.vi || ''

        card = await srsApi.addCard({
          type: 'vocab',
          term,
          meaning,
          sourceRecordId,
          sourceContext,
        })
      }

      setIsSaved(true)
      if (card.alreadySaved || card.created === false) {
        setStatusMessage('Đã có trong SRS.')
      } else {
        setStatusMessage('Đã lưu vào SRS thành công.')
      }
    } catch {
      setStatusMessage('Không thể lưu vào SRS lúc này. Vui lòng thử lại.')
    } finally {
      setIsSaving(false)
    }
  }

  // 1. Guest CTA: does not perform any POST request
  if (!isAuthenticated) {
    return (
      <div className={`anime-srs-action ${className}`}>
        <a
          href={PAGE_PATHS.login}
          className="anime-srs-btn anime-srs-btn--guest"
          title="Đăng nhập tài khoản Kotodama để lưu vào thẻ ôn tập SRS"
          aria-label={isTokenMode ? 'Đăng nhập để lưu từ vào SRS' : 'Đăng nhập để lưu câu vào SRS'}
        >
          <LogIn size={14} aria-hidden="true" />
          <span>Đăng nhập để lưu SRS</span>
        </a>
      </div>
    )
  }

  // 2. User action button
  const buttonLabel = isSaved
    ? 'Đã lưu trong SRS'
    : isSaving
      ? 'Đang lưu…'
      : isTokenMode
        ? 'Lưu từ vào SRS'
        : 'Lưu câu vào SRS'

  return (
    <div className={`anime-srs-action ${className}`}>
      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving || isSaved}
        className={`anime-srs-btn ${isSaved ? 'anime-srs-btn--saved' : ''} ${isSaving ? 'anime-srs-btn--pending' : ''}`}
        aria-label={buttonLabel}
        aria-pressed={isSaved}
      >
        {isSaving ? (
          <Loader2 size={14} className="anime-spin" aria-hidden="true" />
        ) : isSaved ? (
          <Check size={14} aria-hidden="true" />
        ) : (
          <Bookmark size={14} aria-hidden="true" />
        )}
        <span>{buttonLabel}</span>
      </button>

      {/* Accessible live announcement */}
      {statusMessage && (
        <span className="sr-only" role="status" aria-live="polite">
          {statusMessage}
        </span>
      )}
    </div>
  )
}
