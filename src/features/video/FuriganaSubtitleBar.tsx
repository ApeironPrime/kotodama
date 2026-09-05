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

export default function FuriganaSubtitleBar({
  segment,
  currentTimeMs,
  onWordClick,
  theme = 'light',
}: FuriganaSubtitleBarProps) {
  const [showFurigana, setShowFurigana] = useState(true)
  const [showRomaji, setShowRomaji] = useState(true)
  const [showTranslation, setShowTranslation] = useState(true)

  const chunks: TranscriptChunk[] = useMemo(() => {
    if (!segment) return []
    return buildBunsetsuChunks(segment)
  }, [segment])

  if (!segment) {
    return (
      <div
        style={{
          background: 'var(--color-bg-subtle, #f8fafc)',
          borderRadius: '14px',
          padding: '1.5rem',
          minHeight: '110px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#64748b',
          fontSize: '0.95rem',
          marginTop: '0.75rem',
          border: '1.5px dashed var(--color-border, #cbd5e1)',
        }}
      >
        <span>▶ Phát video để hiển thị phụ đề Karaoke Bunsetsu và Furigana thời gian thực</span>
      </div>
    )
  }

  // Determine current active chunk in real time
  const currentChunkIndex = chunks.findIndex((c) => currentTimeMs >= c.startMs && currentTimeMs < c.endMs + 80)

  const isDark = theme === 'dark'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        marginTop: '0.65rem',
      }}
    >
      {/* ── Karaoke Bunsetsu Phrase Spotlight Container ── */}
      <div
        key={segment.id}
        style={{
          background: isDark ? '#1e293b' : 'var(--color-surface, #ffffff)',
          borderRadius: '16px',
          padding: '1rem 1.25rem',
          boxShadow: isDark ? '0 4px 20px -2px rgba(15, 23, 42, 0.35)' : '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
          border: isDark ? '1px solid #334155' : '1.5px solid var(--color-border, #e2e8f0)',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        {/* Bunsetsu Chunks Flow */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.6rem 0.75rem',
            alignItems: 'center',
            minHeight: '4.2rem',
          }}
        >
          {chunks.map((chunk, idx) => {
            const isCurrent =
              currentChunkIndex === idx ||
              (currentChunkIndex === -1 && currentTimeMs >= chunk.startMs && currentTimeMs <= chunk.endMs + 80)
            const isSpoken = currentTimeMs >= chunk.endMs + 80
            const isPending = currentTimeMs < chunk.startMs

            const chunkHasKanji = hasKanji(chunk.text)
            // Separate furigana if identical to surface
            const furiganaText = chunk.reading && chunkHasKanji && chunk.reading !== chunk.text ? chunk.reading : null

            // Active Spotlight Styles (Matching user's reference image)
            let badgeBg = 'transparent'
            let badgeBorder = '2px solid transparent'
            let badgeShadow = 'none'
            let textCol = isDark ? 'rgba(255, 255, 255, 0.9)' : '#0f172a'
            let rtCol = isDark ? '#6ee7b7' : '#059669'
            let romajiCol = isDark ? '#94a3b8' : '#64748b'
            let scaleTransform = 'scale(1)'

            if (isCurrent) {
              // Active Spotlight Box (Pastel Green/Yellow with Glow)
              badgeBg = isDark ? 'rgba(16, 185, 129, 0.22)' : '#dcfce7'
              badgeBorder = isDark ? '2px solid #34d399' : '2px solid #10b981'
              badgeShadow = isDark ? '0 0 14px rgba(52, 211, 153, 0.45)' : '0 3px 12px rgba(16, 185, 129, 0.35)'
              textCol = isDark ? '#ffffff' : '#065f46'
              rtCol = isDark ? '#fde047' : '#047857'
              romajiCol = isDark ? '#a7f3d0' : '#047857'
              scaleTransform = 'scale(1.04)'
            } else if (isSpoken) {
              textCol = isDark ? '#ffffff' : '#1e293b'
              rtCol = isDark ? '#a7f3d0' : '#10b981'
              romajiCol = isDark ? '#cbd5e1' : '#475569'
            } else if (isPending) {
              textCol = isDark ? 'rgba(255, 255, 255, 0.55)' : '#64748b'
              rtCol = isDark ? 'rgba(110, 231, 183, 0.45)' : '#94a3b8'
              romajiCol = isDark ? 'rgba(148, 163, 184, 0.45)' : '#94a3b8'
            }

            return (
              <div
                key={chunk.id}
                onClick={(e) => {
                  e.stopPropagation()
                  onWordClick(chunk.text)
                }}
                style={{
                  display: 'inline-flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  background: badgeBg,
                  border: badgeBorder,
                  boxShadow: badgeShadow,
                  transform: scaleTransform,
                  transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isCurrent) {
                    e.currentTarget.style.borderColor = isDark ? '#38bdf8' : '#38bdf8'
                    e.currentTarget.style.background = isDark ? 'rgba(56, 189, 248, 0.15)' : '#f0f9ff'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isCurrent) {
                    e.currentTarget.style.borderColor = 'transparent'
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
                title={`Bấm để tra cứu cụm từ: "${chunk.text}" (${chunk.romaji || ''})`}
              >
                {/* 1. Top Tier: Furigana (Hiragana Reading) */}
                {showFurigana && (
                  <span
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: isCurrent ? 800 : 600,
                      color: rtCol,
                      letterSpacing: '0.02em',
                      minHeight: '1.1rem',
                      lineHeight: 1.1,
                      display: 'block',
                      transition: 'color 0.15s ease',
                    }}
                  >
                    {furiganaText || '\u00A0'}
                  </span>
                )}

                {/* 2. Middle Tier: Main Japanese Kanji/Kana */}
                <span
                  style={{
                    fontSize: '1.45rem',
                    fontWeight: 700,
                    fontFamily: 'var(--font-jp, "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif)',
                    color: textCol,
                    lineHeight: 1.3,
                    display: 'block',
                    transition: 'color 0.15s ease',
                  }}
                >
                  {chunk.text}
                </span>

                {/* 3. Bottom Tier: Romaji (Latin Pronunciation) */}
                {showRomaji && chunk.romaji && (
                  <span
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: isCurrent ? 700 : 500,
                      color: romajiCol,
                      letterSpacing: '0.01em',
                      lineHeight: 1.1,
                      marginTop: '2px',
                      display: 'block',
                      transition: 'color 0.15s ease',
                    }}
                  >
                    {chunk.romaji}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* ── Vietnamese Translation (Bottom Line) ── */}
        {showTranslation && segment.textVi && (
          <div
            style={{
              fontSize: '1.05rem',
              fontWeight: 600,
              color: isDark ? '#e2e8f0' : '#334155',
              lineHeight: 1.45,
              marginTop: '0.65rem',
              paddingTop: '0.65rem',
              borderTop: isDark ? '1px solid #334155' : '1px solid var(--color-border, #e2e8f0)',
            }}
          >
            {segment.textVi}
          </div>
        )}
      </div>

      {/* ── Subtitle Controls Toolbar (Furigana / Romaji / Translation toggles) ── */}
      <div
        style={{
          display: 'flex',
          gap: '0.45rem',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => setShowFurigana((v) => !v)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '3px 10px',
            borderRadius: '8px',
            fontSize: '0.78rem',
            fontWeight: 700,
            background: showFurigana ? '#dcfce7' : 'var(--color-bg-subtle, #f1f5f9)',
            color: showFurigana ? '#15803d' : '#64748b',
            border: `1px solid ${showFurigana ? '#86efac' : 'var(--color-border, #e2e8f0)'}`,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          あ Furigana
        </button>

        <button
          type="button"
          onClick={() => setShowRomaji((v) => !v)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '3px 10px',
            borderRadius: '8px',
            fontSize: '0.78rem',
            fontWeight: 700,
            background: showRomaji ? '#eff6ff' : 'var(--color-bg-subtle, #f1f5f9)',
            color: showRomaji ? '#1d4ed8' : '#64748b',
            border: `1px solid ${showRomaji ? '#bfdbfe' : 'var(--color-border, #e2e8f0)'}`,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          Aa Romaji
        </button>

        <button
          type="button"
          onClick={() => setShowTranslation((v) => !v)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '3px 10px',
            borderRadius: '8px',
            fontSize: '0.78rem',
            fontWeight: 700,
            background: showTranslation ? '#faf5ff' : 'var(--color-bg-subtle, #f1f5f9)',
            color: showTranslation ? '#7e22ce' : '#64748b',
            border: `1px solid ${showTranslation ? '#e9d5ff' : 'var(--color-border, #e2e8f0)'}`,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          🇻🇳 Bản dịch
        </button>
      </div>
    </div>
  )
}
