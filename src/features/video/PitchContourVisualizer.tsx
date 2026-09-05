import { useMemo, useState } from 'react'
import type { PitchContourData, PitchPoint } from './videoTypes'

function buildSvgPath(
  points: PitchPoint[],
  maxTimeMs: number,
  minSemitone: number,
  maxSemitone: number,
  width: number,
  height: number,
  padding: { top: number; bottom: number; left: number; right: number }
): string {
  const voicedPoints = points.filter((p) => p.voiced && p.semitone !== null)
  if (voicedPoints.length < 2) return ''

  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const semitoneRange = Math.max(4, maxSemitone - minSemitone)

  let path = ''
  let inSegment = false

  for (const pt of points) {
    if (pt && pt.voiced && pt.semitone !== null) {
      const x = padding.left + (pt.timeMs / maxTimeMs) * plotWidth
      const normY = (pt.semitone - minSemitone) / semitoneRange
      const y = padding.top + (1 - normY) * plotHeight

      if (!inSegment) {
        path += ` M ${x.toFixed(1)} ${y.toFixed(1)}`
        inSegment = true
      } else {
        path += ` L ${x.toFixed(1)} ${y.toFixed(1)}`
      }
    } else {
      inSegment = false
    }
  }

  return path
}

const WIDTH = 640
const HEIGHT = 180
const PADDING = { top: 20, bottom: 30, left: 45, right: 20 }

export default function PitchContourVisualizer({
  pitchContour,
}: {
  pitchContour?: PitchContourData
  referenceText?: string
}) {
  const [hoveredPoint, setHoveredPoint] = useState<{
    label: string
    timeMs: number
    f0Hz: number
    semitone: number
    x: number
    y: number
  } | null>(null)

  const refPoints = useMemo(() => pitchContour?.reference ?? [], [pitchContour?.reference])
  const userPoints = useMemo(() => pitchContour?.user ?? [], [pitchContour?.user])

  const hasData =
    refPoints.some((p) => p.voiced && p.semitone !== null) || userPoints.some((p) => p.voiced && p.semitone !== null)

  const { maxTimeMs, minSemitone, maxSemitone } = useMemo(() => {
    const allVoiced = [...refPoints, ...userPoints].filter((p) => p.voiced && p.semitone !== null)
    if (!allVoiced.length) return { maxTimeMs: 1000, minSemitone: -6, maxSemitone: 6 }

    const maxTime = Math.max(1000, ...allVoiced.map((p) => p.timeMs))
    const semitones = allVoiced.map((p) => (p.semitone !== null ? p.semitone : 0))
    const minSt = Math.min(-4, Math.floor(Math.min(...semitones) - 1))
    const maxSt = Math.max(4, Math.ceil(Math.max(...semitones) + 1))

    return { maxTimeMs: maxTime, minSemitone: minSt, maxSemitone: maxSt }
  }, [refPoints, userPoints])

  const refPath = useMemo(
    () => buildSvgPath(refPoints, maxTimeMs, minSemitone, maxSemitone, WIDTH, HEIGHT, PADDING),
    [refPoints, maxTimeMs, minSemitone, maxSemitone]
  )

  const userPath = useMemo(
    () => buildSvgPath(userPoints, maxTimeMs, minSemitone, maxSemitone, WIDTH, HEIGHT, PADDING),
    [userPoints, maxTimeMs, minSemitone, maxSemitone]
  )

  if (!hasData) {
    return null
  }

  const plotWidth = WIDTH - PADDING.left - PADDING.right
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom
  const semitoneRange = Math.max(4, maxSemitone - minSemitone)

  // Zero-semitone horizontal guideline Y position
  const zeroY = PADDING.top + (1 - (0 - minSemitone) / semitoneRange) * plotHeight

  // Time grid marks (every 0.5s or 1.0s)
  const timeStepMs = maxTimeMs > 4000 ? 1000 : 500
  const timeTicks = []
  for (let t = 0; t <= maxTimeMs; t += timeStepMs) {
    timeTicks.push(t)
  }

  return (
    <div
      style={{
        marginTop: '0.75rem',
        background: 'var(--color-bg-subtle, #f8fafc)',
        border: '1px solid var(--color-border, #e2e8f0)',
        borderRadius: '12px',
        padding: '1rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75rem',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div
          style={{
            fontWeight: 800,
            fontSize: '0.82rem',
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          BIỂU ĐỒ NGỮ ĐIỆU & CAO ĐỘ (PITCH CONTOUR)
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.8rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '14px', height: '3px', background: '#0284c7', borderRadius: '2px' }} />
            <span style={{ color: '#0284c7', fontWeight: 700 }}>Giọng mẫu nhân vật</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '14px', height: '3px', background: '#e11d48', borderRadius: '2px' }} />
            <span style={{ color: '#e11d48', fontWeight: 700 }}>Giọng của bạn</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas */}
      <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          style={{ width: '100%', height: 'auto', display: 'block', minWidth: '400px' }}
        >
          {/* Background grid lines */}
          <line
            x1={PADDING.left}
            y1={zeroY}
            x2={WIDTH - PADDING.right}
            y2={zeroY}
            stroke="rgba(100, 116, 139, 0.3)"
            strokeDasharray="4 3"
          />

          {/* Semitone labels */}
          <text
            x={PADDING.left - 8}
            y={zeroY + 4}
            fill="#64748b"
            fontSize="10"
            fontWeight="600"
            textAnchor="end"
            fontFamily="sans-serif"
          >
            0 st
          </text>
          <text
            x={PADDING.left - 8}
            y={PADDING.top + 10}
            fill="#64748b"
            fontSize="10"
            fontWeight="600"
            textAnchor="end"
            fontFamily="sans-serif"
          >
            +{maxSemitone}
          </text>
          <text
            x={PADDING.left - 8}
            y={HEIGHT - PADDING.bottom - 4}
            fill="#64748b"
            fontSize="10"
            fontWeight="600"
            textAnchor="end"
            fontFamily="sans-serif"
          >
            {minSemitone}
          </text>

          {/* Time axis marks */}
          {timeTicks.map((t) => {
            const x = PADDING.left + (t / maxTimeMs) * plotWidth
            return (
              <g key={t}>
                <line x1={x} y1={PADDING.top} x2={x} y2={HEIGHT - PADDING.bottom} stroke="rgba(100, 116, 139, 0.15)" />
                <text
                  x={x}
                  y={HEIGHT - PADDING.bottom + 16}
                  fill="#64748b"
                  fontSize="10"
                  fontWeight="600"
                  textAnchor="middle"
                  fontFamily="sans-serif"
                >
                  {(t / 1000).toFixed(1)}s
                </text>
              </g>
            )
          })}

          {/* Reference pitch curve */}
          {refPath && (
            <path
              d={refPath}
              fill="none"
              stroke="#0284c7"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.9"
            />
          )}

          {/* User pitch curve */}
          {userPath && (
            <path
              d={userPath}
              fill="none"
              stroke="#e11d48"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="2 1"
              opacity="0.9"
            />
          )}

          {/* Interactive Reference Dots */}
          {refPoints
            .filter((p) => p.voiced && p.semitone !== null)
            .map((pt, idx) => {
              const semitone = pt.semitone ?? 0
              const x = PADDING.left + (pt.timeMs / maxTimeMs) * plotWidth
              const normY = (semitone - minSemitone) / semitoneRange
              const y = PADDING.top + (1 - normY) * plotHeight
              return (
                <circle
                  key={`ref-${idx}`}
                  cx={x}
                  cy={y}
                  r="3.5"
                  fill="#06b6d4"
                  opacity="0.8"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() =>
                    setHoveredPoint({
                      label: 'Mẫu',
                      timeMs: pt.timeMs,
                      f0Hz: pt.f0Hz || 0,
                      semitone,
                      x,
                      y,
                    })
                  }
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              )
            })}

          {/* Interactive User Dots */}
          {userPoints
            .filter((p) => p.voiced && p.semitone !== null)
            .map((pt, idx) => {
              const semitone = pt.semitone ?? 0
              const x = PADDING.left + (pt.timeMs / maxTimeMs) * plotWidth
              const normY = (semitone - minSemitone) / semitoneRange
              const y = PADDING.top + (1 - normY) * plotHeight
              return (
                <circle
                  key={`usr-${idx}`}
                  cx={x}
                  cy={y}
                  r="3"
                  fill="#ec4899"
                  opacity="0.85"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() =>
                    setHoveredPoint({
                      label: 'Bạn',
                      timeMs: pt.timeMs,
                      f0Hz: pt.f0Hz || 0,
                      semitone,
                      x,
                      y,
                    })
                  }
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              )
            })}
        </svg>

        {/* Hover Tooltip */}
        {hoveredPoint && (
          <div
            style={{
              position: 'absolute',
              left: `${(hoveredPoint.x / WIDTH) * 100}%`,
              top: `${(hoveredPoint.y / HEIGHT) * 100}%`,
              transform: 'translate(-50%, -120%)',
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '0.75rem',
              color: 'var(--color-text)',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              zIndex: 10,
            }}
          >
            <span style={{ fontWeight: 700, color: hoveredPoint.label === 'Mẫu' ? '#06b6d4' : '#ec4899' }}>
              [{hoveredPoint.label}]
            </span>{' '}
            {(hoveredPoint.timeMs / 1000).toFixed(2)}s: {hoveredPoint.f0Hz.toFixed(1)} Hz (
            {hoveredPoint.semitone > 0 ? `+${hoveredPoint.semitone}` : hoveredPoint.semitone} st)
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: '0.5rem',
          fontSize: '0.75rem',
          color: 'var(--color-text-muted)',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>* Cao độ được quy đổi theo đơn vị bán âm (Semitone) tương đối so với giọng từng người.</span>
        <span>Thời lượng: {(maxTimeMs / 1000).toFixed(1)}s</span>
      </div>
    </div>
  )
}
