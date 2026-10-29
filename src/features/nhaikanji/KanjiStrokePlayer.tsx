import { useState, useEffect, useRef, useCallback } from 'react'
import HanziWriter, { type CharacterJson } from 'hanzi-writer'
import {
  RotateCcw,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Hash,
  Gauge,
} from 'lucide-react'
import { sumiAudio } from '../dictionary/sumiAudio'

interface KanjiStrokePlayerProps {
  kanji: string
  fallbackStrokeCount?: number | string
  className?: string
}

interface SpeedOption {
  label: string
  val: number
  delay: number
}

const SPEED_OPTIONS: SpeedOption[] = [
  { label: '0.75x', val: 0.75, delay: 240 },
  { label: '1x', val: 1.0, delay: 170 },
  { label: '1.5x', val: 1.5, delay: 110 },
]

const STAGE_SIZE = 280
const STAGE_PADDING = 18

export function KanjiStrokePlayer({
  kanji,
  fallbackStrokeCount,
  className = '',
}: KanjiStrokePlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const writerRef = useRef<HanziWriter | null>(null)
  const isPlayingRef = useRef<boolean>(true)
  const animTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const speedRef = useRef<SpeedOption>(SPEED_OPTIONS[1] as SpeedOption)
  const charDataRef = useRef<CharacterJson | null>(null)

  const [charData, setCharData] = useState<CharacterJson | null>(null)
  const [currentStrokeIndex, setCurrentStrokeIndex] = useState<number>(0)
  const [isPlaying, setIsPlaying] = useState<boolean>(true)
  const [showNumbers, setShowNumbers] = useState<boolean>(false)
  const [speedIndex, setSpeedIndex] = useState<number>(1) // 1x default
  const [hasError, setHasError] = useState<boolean>(false)

  const speed = SPEED_OPTIONS[speedIndex] ?? (SPEED_OPTIONS[1] as SpeedOption)
  const totalStrokes = charData?.strokes.length || Number(fallbackStrokeCount) || 1

  // ─── Playback execution loop ──────────────────────────────────────────────
  const playStroke = useCallback((strokeIdx: number, data: CharacterJson, writer: HanziWriter) => {
    if (animTimeoutRef.current) {
      clearTimeout(animTimeoutRef.current)
      animTimeoutRef.current = null
    }

    if (strokeIdx >= data.strokes.length) {
      setIsPlaying(false)
      isPlayingRef.current = false
      setCurrentStrokeIndex(data.strokes.length)
      return
    }

    setCurrentStrokeIndex(strokeIdx + 1)
    sumiAudio.playBrushFriction()

    writer.animateStroke(strokeIdx, {
      onComplete: (res) => {
        if (!res.canceled && isPlayingRef.current) {
          animTimeoutRef.current = setTimeout(() => {
            if (isPlayingRef.current) {
              playStroke(strokeIdx + 1, data, writer)
            }
          }, speedRef.current.delay)
        }
      },
    })
  }, [])

  // Start complete playback from first stroke
  const startPlayback = useCallback((writer: HanziWriter, data: CharacterJson) => {
    if (animTimeoutRef.current) {
      clearTimeout(animTimeoutRef.current)
      animTimeoutRef.current = null
    }
    isPlayingRef.current = true
    setIsPlaying(true)
    setCurrentStrokeIndex(0)

    writer.hideCharacter({
      onComplete: () => {
        if (isPlayingRef.current) {
          playStroke(0, data, writer)
        }
      },
    })
  }, [playStroke])

  // ─── Initialize HanziWriter Instance ──────────────────────────────────────
  useEffect(() => {
    let isCancelled = false
    if (!containerRef.current || !kanji) return

    if (animTimeoutRef.current) {
      clearTimeout(animTimeoutRef.current)
      animTimeoutRef.current = null
    }

    containerRef.current.innerHTML = ''
    setCharData(null)
    charDataRef.current = null
    setCurrentStrokeIndex(0)
    setHasError(false)
    setIsPlaying(true)
    isPlayingRef.current = true

    try {
      const writer = HanziWriter.create(containerRef.current, kanji, {
        width: STAGE_SIZE,
        height: STAGE_SIZE,
        padding: STAGE_PADDING,
        showCharacter: false,
        showOutline: true,
        strokeColor: '#1A1817', // Sắc mực Sumi đen tuyền
        outlineColor: 'rgba(215, 205, 190, 0.45)', // Nét mờ dẫn đường trên giấy Washi
        radicalColor: '#C23A2B', // Chu sa điểm nét bộ thủ
        highlightColor: '#C23A2B',
        drawingColor: '#1A1817',
        drawingWidth: 16,
        strokeAnimationSpeed: speedRef.current.val,
        delayBetweenStrokes: speedRef.current.delay,
        charDataLoader: (char, onLoad, onError) => {
          void (async () => {
            // 1. Try local server cache / proxy (AnimCJK / hanzi-writer-data-jp)
            try {
              const res = await fetch(`/api/v1/nhaikanji/kanji/${encodeURIComponent(char)}/brush`)
              if (res.ok) {
                const json = await res.json()
                const data = json.data || json
                if (data && Array.isArray(data.strokes) && data.strokes.length > 0) {
                  if (!isCancelled) onLoad(data)
                  return
                }
              }
            } catch {}

            // 2. Direct fallback to AnimCJK Japanese Kanji on jsDelivr
            try {
              const resJp = await fetch(`https://cdn.jsdelivr.net/npm/hanzi-writer-data-jp@0/${encodeURIComponent(char)}.json`)
              if (resJp.ok) {
                const data = await resJp.json()
                if (!isCancelled) onLoad(data)
                return
              }
            } catch {}

            // 3. Fallback to standard Chinese characters (9000+ characters)
            try {
              const resCn = await fetch(`https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/${encodeURIComponent(char)}.json`)
              if (resCn.ok) {
                const data = await resCn.json()
                if (!isCancelled) onLoad(data)
                return
              }
            } catch {}

            if (!isCancelled) {
              onError(new Error(`Không thể tải dữ liệu bút lông cho ${char}`))
            }
          })()
        },
        onLoadCharDataSuccess: (loaded) => {
          if (isCancelled) return
          setCharData(loaded)
          charDataRef.current = loaded
          setHasError(false)
          startPlayback(writer, loaded)
        },
        onLoadCharDataError: () => {
          if (isCancelled) return
          setHasError(true)
        },
      })

      writerRef.current = writer
    } catch {
      if (!isCancelled) setHasError(true)
    }

    return () => {
      isCancelled = true
      if (animTimeoutRef.current) {
        clearTimeout(animTimeoutRef.current)
        animTimeoutRef.current = null
      }
      if (writerRef.current) {
        try {
          writerRef.current.pauseAnimation()
        } catch {}
        writerRef.current = null
      }
    }
  }, [kanji, startPlayback])

  // ─── Control Handlers ─────────────────────────────────────────────────────
  const handleReplay = () => {
    const writer = writerRef.current
    const data = charDataRef.current
    if (!writer || !data) return
    sumiAudio.playBrushFriction()
    startPlayback(writer, data)
  }

  const handleTogglePlay = () => {
    const writer = writerRef.current
    const data = charDataRef.current
    if (!writer || !data) return

    if (isPlaying) {
      if (animTimeoutRef.current) {
        clearTimeout(animTimeoutRef.current)
        animTimeoutRef.current = null
      }
      isPlayingRef.current = false
      setIsPlaying(false)
      writer.pauseAnimation()
    } else {
      isPlayingRef.current = true
      setIsPlaying(true)
      writer.resumeAnimation()
      if (currentStrokeIndex >= data.strokes.length) {
        startPlayback(writer, data)
      } else {
        playStroke(currentStrokeIndex, data, writer)
      }
    }
  }

  const handleStepPrev = () => {
    const writer = writerRef.current
    const data = charDataRef.current
    if (!writer || !data) return

    if (animTimeoutRef.current) {
      clearTimeout(animTimeoutRef.current)
      animTimeoutRef.current = null
    }
    isPlayingRef.current = false
    setIsPlaying(false)

    const prevIdx = Math.max(0, currentStrokeIndex - 1)
    setCurrentStrokeIndex(prevIdx)
    writer.hideCharacter({
      onComplete: () => {
        // Redraw up to prevIdx
        for (let i = 0; i < prevIdx; i++) {
          writer.animateStroke(i)
        }
      },
    })
  }

  const handleStepNext = () => {
    const writer = writerRef.current
    const data = charDataRef.current
    if (!writer || !data) return

    if (animTimeoutRef.current) {
      clearTimeout(animTimeoutRef.current)
      animTimeoutRef.current = null
    }
    isPlayingRef.current = false
    setIsPlaying(false)

    if (currentStrokeIndex < data.strokes.length) {
      const nextIdx = currentStrokeIndex
      setCurrentStrokeIndex(nextIdx + 1)
      sumiAudio.playBrushFriction()
      writer.animateStroke(nextIdx)
    }
  }

  const cycleSpeed = () => {
    setSpeedIndex((prev) => {
      const next = (prev + 1) % SPEED_OPTIONS.length
      const opt = SPEED_OPTIONS[next] as SpeedOption
      speedRef.current = opt
      if (writerRef.current) {
        const writerOpts = (writerRef.current as unknown as { _options?: { strokeAnimationSpeed?: number; delayBetweenStrokes?: number } })._options
        if (writerOpts) {
          writerOpts.strokeAnimationSpeed = opt.val
          writerOpts.delayBetweenStrokes = opt.delay
        }
      }
      return next
    })
  }

  // ─── Stroke numbers coordinates calculation ───────────────────────────────
  const strokeNumbers = (() => {
    if (!showNumbers || !charData) return []
    const transform = HanziWriter.getScalingTransform(STAGE_SIZE, STAGE_SIZE, STAGE_PADDING)
    return charData.medians.map((median, i) => {
      const p = median[0] ?? [0, 0]
      const px = p[0] ?? 0
      const py = p[1] ?? 0
      const sx = transform.x + px * transform.scale
      const sy = (STAGE_SIZE - transform.y) - py * transform.scale
      return { num: i + 1, x: sx, y: sy }
    })
  })()

  return (
    <div className={`kanji-stroke-player ${className}`}>
      {/* ─── STROKE STAGE (Giấy Washi + Cửu cung 九宮格) ───────────────────── */}
      <div className="kanji-stroke-stage" style={{ width: STAGE_SIZE, height: STAGE_SIZE }}>
        {/* Background Cửu cung / Mễ tự cách Grid */}
        <svg
          viewBox={`0 0 ${STAGE_SIZE} ${STAGE_SIZE}`}
          className="kanji-stroke-grid-bg"
          aria-hidden="true"
        >
          {/* Border */}
          <rect
            x="1.5"
            y="1.5"
            width={STAGE_SIZE - 3}
            height={STAGE_SIZE - 3}
            fill="none"
            stroke="#B44632"
            strokeWidth="1.2"
            opacity="0.35"
          />
          {/* Center Vertical */}
          <line
            x1={STAGE_SIZE / 2}
            y1="2"
            x2={STAGE_SIZE / 2}
            y2={STAGE_SIZE - 2}
            stroke="#B44632"
            strokeWidth="0.8"
            strokeDasharray="4 4"
            opacity="0.25"
          />
          {/* Center Horizontal */}
          <line
            x1="2"
            y1={STAGE_SIZE / 2}
            x2={STAGE_SIZE - 2}
            y2={STAGE_SIZE / 2}
            stroke="#B44632"
            strokeWidth="0.8"
            strokeDasharray="4 4"
            opacity="0.25"
          />
          {/* Diagonals 米 */}
          <line
            x1="2"
            y1="2"
            x2={STAGE_SIZE - 2}
            y2={STAGE_SIZE - 2}
            stroke="#B44632"
            strokeWidth="0.6"
            strokeDasharray="3 5"
            opacity="0.15"
          />
          <line
            x1={STAGE_SIZE - 2}
            y1="2"
            x2="2"
            y2={STAGE_SIZE - 2}
            stroke="#B44632"
            strokeWidth="0.6"
            strokeDasharray="3 5"
            opacity="0.15"
          />
        </svg>

        {/* 1. HanziWriter Canvas mount point */}
        <div
          ref={containerRef}
          className="kanji-stroke-writer-mount"
          style={{ width: STAGE_SIZE, height: STAGE_SIZE }}
        />

        {/* 2. Number badges overlay (When toggled on) */}
        {showNumbers && strokeNumbers.length > 0 && (
          <div className="kanji-stroke-num-overlay" aria-hidden="true">
            {strokeNumbers.map((s) => {
              const isPast = s.num <= currentStrokeIndex
              return (
                <div
                  key={`num-${s.num}`}
                  className={`kanji-stroke-badge-dot ${isPast ? 'is-drawn' : ''}`}
                  style={{ left: `${s.x}px`, top: `${s.y}px` }}
                >
                  {s.num}
                </div>
              )
            })}
          </div>
        )}

        {/* 3. Fallback if brush data fails to load */}
        {hasError && (
          <div className="kanji-stroke-fallback-glyph">
            <span>{kanji}</span>
          </div>
        )}
      </div>

      {/* ─── CONTROLS (Thư pháp Bút pháp) ───────────────────────────────── */}
      <div className="kanji-stroke-controls">
        {/* Replay action */}
        <button
          type="button"
          className="kanji-stroke-ctrl-btn kanji-stroke-ctrl-btn--primary"
          onClick={handleReplay}
          title="Diễn lại thứ tự nét viết từ đầu"
          aria-label="Diễn lại bút pháp"
        >
          <RotateCcw size={13} />
          <span>Diễn lại bút pháp</span>
        </button>

        {/* Step & Playback Actions */}
        <div className="kanji-stroke-ctrl-group">
          {/* Step Back */}
          <button
            type="button"
            className="kanji-stroke-mini-btn"
            onClick={handleStepPrev}
            disabled={currentStrokeIndex <= 0}
            title="Lùi 1 nét"
            aria-label="Lùi 1 nét"
          >
            <ChevronLeft size={14} />
          </button>

          {/* Play/Pause */}
          <button
            type="button"
            className="kanji-stroke-mini-btn kanji-stroke-mini-btn--play"
            onClick={handleTogglePlay}
            title={isPlaying ? 'Tạm dừng viết' : 'Tiếp tục viết'}
            aria-label={isPlaying ? 'Tạm dừng' : 'Tiếp tục'}
          >
            {isPlaying ? <Pause size={13} /> : <Play size={13} />}
          </button>

          {/* Step Next */}
          <button
            type="button"
            className="kanji-stroke-mini-btn"
            onClick={handleStepNext}
            disabled={currentStrokeIndex >= totalStrokes}
            title="Tiến 1 nét"
            aria-label="Tiến 1 nét"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Status Badge: Nét X / Y */}
        <div className="kanji-stroke-step-badge">
          <span>
            Nét {Math.min(currentStrokeIndex, totalStrokes)} / {totalStrokes}
          </span>
        </div>

        {/* Toggles: Numbers & Speed */}
        <div className="kanji-stroke-toggles">
          <button
            type="button"
            className={`kanji-stroke-tag-btn ${showNumbers ? 'is-active' : ''}`}
            onClick={() => setShowNumbers(!showNumbers)}
            title="Bật/tắt số thứ tự các nét tại điểm khởi bút"
            aria-label="Số thứ tự nét"
          >
            <Hash size={12} />
            <span>Số nét</span>
          </button>

          <button
            type="button"
            className="kanji-stroke-tag-btn"
            onClick={cycleSpeed}
            title={`Tốc độ vẽ hiện tại: ${speed.label}. Bấm để đổi`}
            aria-label="Tốc độ vẽ"
          >
            <Gauge size={12} />
            <span>{speed.label}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default KanjiStrokePlayer
