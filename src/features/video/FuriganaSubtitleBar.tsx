import { usePersistentState } from '../../lib/usePersistentState'
import { useMemo, useState } from 'react'
import { buildBunsetsuChunks } from './bunsetsuHelper'
import type { TranscriptChunk, TranscriptSegment } from './videoTypes'

function hasKanji(text: string): boolean {
  return /[\u4e00-\u9faf]/u.test(text)
}

interface FuriganaSubtitleBarProps {
  allSegments?: TranscriptSegment[]
  segment: TranscriptSegment | null
  currentTimeMs: number
  onWordClick: (word: string) => void
  onJumpToSegment?: (segment: TranscriptSegment) => void
  theme?: 'dark' | 'light'
}

export default function FuriganaSubtitleBar({ segment, currentTimeMs, onWordClick }: FuriganaSubtitleBarProps) {
  const [showFurigana, setShowFurigana] = usePersistentState('kotodama.settings.furigana', true)
  const [showRomaji, setShowRomaji] = usePersistentState('kotodama.settings.romaji', false)
  const [showTranslation, setShowTranslation] = useState(true)

  const chunks: TranscriptChunk[] = useMemo(() => {
    if (!segment) return []
    return buildBunsetsuChunks(segment)
  }, [segment])

  if (!segment) {
    return (
      <div className="furigana-bar-empty">
        <span>▶ Phát video để hiển thị phụ đề Karaoke Bunsetsu và Furigana thời gian thực</span>
      </div>
    )
  }

  // Determine current active chunk in real time
  const currentChunkIndex = chunks.findIndex((c) => currentTimeMs >= c.startMs && currentTimeMs < c.endMs + 80)

  return (
    <div className="furigana-bar-stack">
      {/* ── Karaoke Bunsetsu Phrase Spotlight Container ── */}
      <div key={segment.id} className="furigana-bar-card">
        {/* Bunsetsu Chunks Flow */}
        <div className="furigana-bar-chunks">
          {chunks.map((chunk, idx) => {
            const isCurrent =
              currentChunkIndex === idx ||
              (currentChunkIndex === -1 && currentTimeMs >= chunk.startMs && currentTimeMs <= chunk.endMs + 80)
            const isSpoken = currentTimeMs >= chunk.endMs + 80
            const isPending = currentTimeMs < chunk.startMs

            const chunkHasKanji = hasKanji(chunk.text)
            // Separate furigana if identical to surface
            const furiganaText = chunk.reading && chunkHasKanji && chunk.reading !== chunk.text ? chunk.reading : null

            const stateClass = isCurrent ? 'is-current' : isSpoken ? 'is-spoken' : isPending ? 'is-pending' : ''

            return (
              <button
                type="button"
                key={chunk.id}
                onClick={(e) => {
                  e.stopPropagation()
                  onWordClick(chunk.text)
                }}
                className={`furigana-bar-chunk ${stateClass}`}
                title={`Bấm để tra cứu cụm từ: "${chunk.text}" (${chunk.romaji || ''})`}
              >
                {/* 1. Top Tier: Furigana (Hiragana Reading) */}
                {showFurigana && <span className="furigana-bar-chunk__rt">{furiganaText || '\u00A0'}</span>}

                {/* 2. Middle Tier: Main Japanese Kanji/Kana */}
                <span className="furigana-bar-chunk__text">{chunk.text}</span>

                {/* 3. Bottom Tier: Romaji (Latin Pronunciation) */}
                {showRomaji && chunk.romaji && <span className="furigana-bar-chunk__romaji">{chunk.romaji}</span>}
              </button>
            )
          })}
        </div>

        {/* ── Vietnamese Translation (Bottom Line) ── */}
        {showTranslation && segment.textVi && <div className="furigana-bar-translation">{segment.textVi}</div>}
      </div>

      {/* ── Subtitle Controls Toolbar (Furigana / Romaji / Translation toggles) ── */}
      <div className="furigana-bar-controls">
        <button
          type="button"
          aria-pressed={showFurigana}
          onClick={() => setShowFurigana((v) => !v)}
          className={`furigana-bar-toggle furigana-bar-toggle--furigana${showFurigana ? ' is-active' : ''}`}
        >
          あ Furigana
        </button>

        <button
          type="button"
          aria-pressed={showRomaji}
          onClick={() => setShowRomaji((v) => !v)}
          className={`furigana-bar-toggle${showRomaji ? ' is-active' : ''}`}
        >
          Aa Romaji
        </button>

        <button
          type="button"
          aria-pressed={showTranslation}
          onClick={() => setShowTranslation((v) => !v)}
          className={`furigana-bar-toggle${showTranslation ? ' is-active' : ''}`}
        >
          Bản dịch VI
        </button>
      </div>
    </div>
  )
}
