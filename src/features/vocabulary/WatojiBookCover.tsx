import { useState } from 'react'

export type WatojiPalette = 'aizumi' | 'shuiro' | 'matcha' | 'kokutan' | 'benigara' | 'kuri' | 'kon'
export type WatojiPattern = 'seigaiha' | 'asanoha' | 'shippo' | 'kumiko' | 'kasumi'

export interface WatojiBookCoverProps {
  kanjiTitle: string
  subtitle?: string
  volumeTag?: string
  level?: string
  palette?: WatojiPalette
  pattern?: WatojiPattern
  size?: 'featured' | 'companion' | 'spine'
  sealChar?: string
  className?: string
  coverSrc?: string | undefined
  bookTitle?: string | undefined
}

/**
 * Classical Japanese Woodblock / Washi Patterns (Karakami 唐紙)
 */
function KarakamiPatternSvg({ pattern }: { pattern: WatojiPattern }) {
  if (pattern === 'seigaiha') {
    // Overlapping ocean waves (Seigaiha 青海波 - Wisdom & Serenity)
    return (
      <svg className="watoji-cover__pattern-svg" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="pat-seigaiha" width="40" height="20" patternUnits="userSpaceOnUse">
            <path
              d="M 0,20 A 20,20 0 0,1 40,20 M 5,20 A 15,15 0 0,1 35,20 M 10,20 A 10,10 0 0,1 30,20 M 15,20 A 5,5 0 0,1 25,20 M 20,0 A 20,20 0 0,1 60,0 M 25,0 A 15,15 0 0,1 55,0 M -20,0 A 20,20 0 0,1 20,0 M -15,0 A 15,15 0 0,1 15,0"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity="0.12"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#pat-seigaiha)" />
      </svg>
    )
  }

  if (pattern === 'asanoha') {
    // Geometric hemp leaf (Asanoha 麻の葉 - Growth & Vigor)
    return (
      <svg className="watoji-cover__pattern-svg" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="pat-asanoha" width="36" height="62.35" patternUnits="userSpaceOnUse">
            <path
              d="M 18,0 L 18,62.35 M 0,31.18 L 36,31.18 M 0,0 L 36,62.35 M 0,62.35 L 36,0 M 18,31.18 L 0,0 M 18,31.18 L 36,0 M 18,31.18 L 0,62.35 M 18,31.18 L 36,62.35"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.75"
              opacity="0.1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#pat-asanoha)" />
      </svg>
    )
  }

  if (pattern === 'shippo') {
    // Seven treasures interlocking circles (Shippo 七宝 - Harmony)
    return (
      <svg className="watoji-cover__pattern-svg" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="pat-shippo" width="32" height="32" patternUnits="userSpaceOnUse">
            <circle cx="0" cy="0" r="16" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.12" />
            <circle cx="32" cy="0" r="16" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.12" />
            <circle cx="0" cy="32" r="16" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.12" />
            <circle cx="32" cy="32" r="16" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.12" />
            <circle cx="16" cy="16" r="16" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.12" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#pat-shippo)" />
      </svg>
    )
  }

  // Kumiko / Kasumi (Geometric lattice & Kyoto mist)
  return (
    <svg className="watoji-cover__pattern-svg" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="pat-kumiko" width="28" height="28" patternUnits="userSpaceOnUse">
          <path
            d="M 14,0 L 28,14 L 14,28 L 0,14 Z M 0,0 L 28,28 M 28,0 L 0,28"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.75"
            opacity="0.09"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#pat-kumiko)" />
    </svg>
  )
}

/**
 * Retina-crisp Vector Title Slip (Daisen 題簽 - 和紙短冊)
 * Renders mathematical glyph coordinates in SVG to eliminate browser vertical-text blur,
 * maintaining razor-sharp woodblock Mincho stroke edges at 200%, 300% zoom and Retina 4K displays.
 */
function WatojiDaisenSvg({
  kanjiTitle,
  volumeTag = '全',
  level,
  size = 'companion',
}: {
  kanjiTitle: string
  volumeTag?: string | undefined
  level?: string | undefined
  size?: 'featured' | 'companion' | 'spine' | undefined
}) {
  const isFeatured = size === 'featured'
  const width = isFeatured ? 48 : 34
  const height = isFeatured ? 164 : 112
  const chars = Array.from(kanjiTitle)
  const charCount = Math.max(chars.length, 1)

  // Layout coordinates
  const cx = width / 2
  const volY = isFeatured ? 14 : 9.5
  const volFontSize = isFeatured
    ? volumeTag.length > 2
      ? 8.5
      : volumeTag.length === 2
        ? 9.5
        : 11
    : volumeTag.length > 2
      ? 6
      : volumeTag.length === 2
        ? 7
        : 7.8
  const div1Y = isFeatured ? 22 : 15
  const divHalfWidth = isFeatured ? 10 : 7

  const hasLevel = Boolean(level && level !== volumeTag)
  const levelFontSize = isFeatured ? 9.5 : 6.5
  const levelY = isFeatured ? height - 12 : height - 8
  const div2Y = isFeatured ? height - 20 : height - 14

  // Title vertical region
  const titleStartY = div1Y + (isFeatured ? 9 : 6)
  const titleEndY = hasLevel ? div2Y - (isFeatured ? 7 : 5) : height - (isFeatured ? 11 : 8)
  const titleHeight = Math.max(titleEndY - titleStartY, 10)

  // Typography scaling based on character density
  let titleFontSize = isFeatured ? 13 : 8.8
  if (charCount <= 2) {
    titleFontSize = isFeatured ? 15.5 : 10.5
  } else if (charCount <= 4) {
    titleFontSize = isFeatured ? 13.5 : 9.2
  } else if (charCount >= 7) {
    titleFontSize = isFeatured ? 11.5 : 7.8
  }

  // Calculate precise character positions (mathematical vertical centering)
  const step = charCount > 1 ? titleHeight / charCount : 0
  const charPositions = chars.map((char, index) => {
    const y = charCount === 1 ? titleStartY + titleHeight / 2 : titleStartY + (index + 0.5) * step
    return { char, y }
  })

  return (
    <svg
      className="watoji-daisen-svg"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* 1. Washi Title Slip Paper Background */}
      <rect
        x="0.5"
        y="0.5"
        width={width - 1}
        height={height - 1}
        rx={isFeatured ? 2.5 : 1.5}
        fill="#FCFAF5"
        stroke="rgba(80, 68, 52, 0.42)"
        strokeWidth="0.8"
      />

      {/* 2. Classical Double Vermilion Hairline Border (Shu-iro 双線) */}
      <rect
        x={isFeatured ? 3 : 2.2}
        y={isFeatured ? 3 : 2.2}
        width={width - (isFeatured ? 6 : 4.4)}
        height={height - (isFeatured ? 6 : 4.4)}
        rx={isFeatured ? 1.5 : 1}
        fill="none"
        stroke="rgba(184, 46, 46, 0.55)"
        strokeWidth={isFeatured ? 0.8 : 0.65}
      />

      {/* 3. Classical Volume / Edition Tag (e.g. 全, 初級, 壱, 対策) */}
      <text
        x={cx}
        y={volY}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#B82E2E"
        fontFamily="var(--font-jp-serif, 'Shippori Mincho', 'Noto Serif JP', serif)"
        fontWeight="800"
        fontSize={volFontSize}
        letterSpacing="0.05em"
      >
        {volumeTag}
      </text>

      {/* Hairline Divider below Volume Tag */}
      <line
        x1={cx - divHalfWidth}
        y1={div1Y}
        x2={cx + divHalfWidth}
        y2={div1Y}
        stroke="rgba(184, 46, 46, 0.4)"
        strokeWidth={isFeatured ? 0.6 : 0.5}
      />

      {/* 4. Vertical Japanese Calligraphy Glyphs (Retina-crisp mathematical vector placement) */}
      {charPositions.map(({ char, y }, idx) => (
        <text
          key={idx}
          x={cx}
          y={y}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#1A1715"
          fontFamily="var(--font-jp-serif, 'Shippori Mincho', 'Noto Serif JP', serif)"
          fontWeight="800"
          fontSize={titleFontSize}
          letterSpacing="0.02em"
        >
          {char}
        </text>
      ))}

      {/* 5. Level Badge (Optional, at base of slip) */}
      {hasLevel && (
        <>
          <line
            x1={cx - divHalfWidth}
            y1={div2Y}
            x2={cx + divHalfWidth}
            y2={div2Y}
            stroke="rgba(80, 68, 52, 0.3)"
            strokeWidth={isFeatured ? 0.6 : 0.5}
          />
          <text
            x={cx}
            y={levelY}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#5A524A"
            fontFamily="var(--font-mono, monospace)"
            fontWeight="700"
            fontSize={levelFontSize}
          >
            {level}
          </text>
        </>
      )}
    </svg>
  )
}

/**
 * Classical Japanese Book Binding (Watoji 和綴じ - 四つ目綴じ)
 * Renders an artisan book cover featuring:
 * 1. Silk thread spine binding stitches (Toji-ito) with corner cloth tabs (Kadogire).
 * 2. Traditional vertical washi title slip (Daisen 題簽) in Shippori Mincho calligraphy.
 * 3. Seasonal Japanese color palette & woodblock watermark (Dentō-iro & Karakami).
 * 4. Cinnabar Vermilion Hanko seal (Rakkan 落款印).
 */
export function WatojiBookCover({
  kanjiTitle,
  subtitle,
  volumeTag = '全',
  level,
  palette = 'aizumi',
  pattern = 'seigaiha',
  size = 'companion',
  sealChar = '言',
  className = '',
  coverSrc,
  bookTitle,
}: WatojiBookCoverProps) {
  const isFeatured = size === 'featured'
  const [failedCover, setFailedCover] = useState<string>()

  if (coverSrc && failedCover !== coverSrc) {
    return (
      <div className={`published-book published-book--${size} ${className}`}>
        <img
          src={coverSrc}
          alt={`Bìa sách ${bookTitle || kanjiTitle}`}
          loading="lazy"
          decoding="async"
          onError={() => setFailedCover(coverSrc)}
        />
      </div>
    )
  }

  return (
    <div className={`watoji-cover watoji-cover--${palette} watoji-cover--${size} ${className}`} aria-hidden="true">
      {/* 3D Spine and Page Edge Deckle */}
      <div className="watoji-cover__edge-shadow" />

      {/* Classical Binding Spine (Left margin with silk thread stitches) */}
      <div className="watoji-cover__spine">
        {/* Corner fabric protectors (Kadogire 角裂) */}
        <div className="watoji-cover__kadogire watoji-cover__kadogire--top" />
        <div className="watoji-cover__kadogire watoji-cover__kadogire--bottom" />

        {/* 4 Stitched Thread Loops (Yotsume-toji 四つ目綴じ) */}
        <div className="watoji-cover__stitches">
          <span className="watoji-cover__stitch" />
          <span className="watoji-cover__stitch" />
          <span className="watoji-cover__stitch" />
          <span className="watoji-cover__stitch" />
        </div>
      </div>

      {/* Textured Cover Paper with Karakami Watermark */}
      <div className="watoji-cover__surface">
        <KarakamiPatternSvg pattern={pattern} />

        {/* Vertical Title Slip (Daisen 題簽) - Authentic Japanese Washi Label (Retina Vector SVG) */}
        <WatojiDaisenSvg kanjiTitle={kanjiTitle} volumeTag={volumeTag} level={level} size={size} />

        {/* Subtitle / Edition note (if featured) */}
        {isFeatured && subtitle && (
          <div className="watoji-cover__footnote">
            <span>{subtitle}</span>
          </div>
        )}

        {/* Cinnabar Vermilion Hanko Seal (Rakkan 落款印) */}
        <div className="watoji-cover__seal">
          <span className="watoji-cover__seal-char">{sealChar}</span>
        </div>

        {/* Kotodama Bunko Insignia at Cover Base */}
        <div className="watoji-cover__masthead">
          <span className="watoji-cover__crest">言霊文庫</span>
        </div>
      </div>
    </div>
  )
}
