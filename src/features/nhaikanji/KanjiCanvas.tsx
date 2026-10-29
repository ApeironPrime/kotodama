import React, { useRef, useState, useEffect, useCallback } from 'react'
import { Eraser, Eye, EyeOff, RotateCcw } from 'lucide-react'
import { Button } from '../../components/ui'

interface KanjiCanvasProps {
  kanjiChar: string
}

// ─── Brush physics constants ──────────────────────────────────────────────────
const MIN_WIDTH = 1.2    // Harai: fast stroke → thin
const MAX_WIDTH = 11     // Tome: slow/start → thick
const SMOOTHING = 0.55   // velocity low-pass alpha (higher = more inertia)
const OPACITY_BASE = 0.90

// ─── Cửu cung / 九宮格 grid colours ─────────────────────────────────────────
const GRID_LINE = 'rgba(180, 70, 50, 0.15)'   // chu-sa red, very faint
const GRID_DIAG = 'rgba(180, 70, 50, 0.07)'   // diagonal guides, even fainter
const BORDER_CLR = 'rgba(180, 70, 50, 0.30)'  // outer square

// ─── Draw Cửu cung 九宮格 grid ───────────────────────────────────────────────
function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save()
  ctx.setLineDash([])

  // Outer border
  ctx.strokeStyle = BORDER_CLR
  ctx.lineWidth = 1.2
  ctx.strokeRect(0.6, 0.6, w - 1.2, h - 1.2)

  // Inner 4-cell dividing lines (horizontal + vertical center)
  ctx.strokeStyle = GRID_LINE
  ctx.lineWidth = 0.8
  ctx.setLineDash([4, 5])
  ctx.beginPath()
  ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h)  // vertical center
  ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2)  // horizontal center
  ctx.stroke()

  // Diagonal guides — 米 style (X across each quadrant)
  ctx.strokeStyle = GRID_DIAG
  ctx.lineWidth = 0.6
  ctx.setLineDash([2, 6])
  ctx.beginPath()
  // Full diagonals
  ctx.moveTo(0, 0); ctx.lineTo(w, h)
  ctx.moveTo(w, 0); ctx.lineTo(0, h)
  ctx.stroke()

  ctx.setLineDash([])
  ctx.restore()
}

// ─── Interpolate variable-width stroke segment ────────────────────────────────
function drawBrushSegment(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number,
  x1: number, y1: number,
  w0: number, w1: number,
) {
  // Perpendicular normals for the two endpoints
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.sqrt(dx * dx + dy * dy) || 0.001
  const nx = -dy / len
  const ny = dx / len

  const hw0 = w0 / 2
  const hw1 = w1 / 2

  ctx.beginPath()
  ctx.moveTo(x0 + nx * hw0, y0 + ny * hw0)
  ctx.lineTo(x1 + nx * hw1, y1 + ny * hw1)
  ctx.lineTo(x1 - nx * hw1, y1 - ny * hw1)
  ctx.lineTo(x0 - nx * hw0, y0 - ny * hw0)
  ctx.closePath()
  ctx.fill()
}

export function KanjiCanvas({ kanjiChar }: KanjiCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [showGuide, setShowGuide] = useState(true)
  const [strokeHistory, setStrokeHistory] = useState<ImageData[]>([])

  // Brush state refs (mutable, no re-render needed)
  const lastPosRef = useRef<{ x: number; y: number } | null>(null)
  const lastWidthRef = useRef(MAX_WIDTH)
  const velocityRef = useRef(0)
  const lastTimeRef = useRef(0)

  // ─── Grid + Guide render ──────────────────────────────────────────────────
  const renderBase = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    drawGrid(ctx, canvas.width, canvas.height)
  }, [])

  const clearCanvas = useCallback(() => {
    renderBase()
    setStrokeHistory([])
  }, [renderBase])

  useEffect(() => { clearCanvas() }, [kanjiChar, clearCanvas])

  const handleUndo = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (strokeHistory.length > 1) {
      const prev = strokeHistory[strokeHistory.length - 2]
      if (prev) {
        ctx.putImageData(prev, 0, 0)
        setStrokeHistory((h) => h.slice(0, -1))
      }
    } else {
      clearCanvas()
    }
  }

  // ─── Coordinate helpers ───────────────────────────────────────────────────
  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      const t = e.touches[0]
      if (!t) return null
      return { x: t.clientX - rect.left, y: t.clientY - rect.top }
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  // ─── Drawing handlers ─────────────────────────────────────────────────────
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const pos = getPos(e)
    if (!pos) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    lastPosRef.current = pos
    lastWidthRef.current = MAX_WIDTH * 0.75  // start with medium weight
    velocityRef.current = 0
    lastTimeRef.current = performance.now()
    setIsDrawing(true)

    // Dot at start point (Tome / 点)
    ctx.save()
    ctx.fillStyle = `rgba(18, 15, 10, ${OPACITY_BASE})`
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, lastWidthRef.current / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  const continueDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lastPosRef.current) return
    const pos = getPos(e)
    if (!pos) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const now = performance.now()
    const dt = Math.max(now - lastTimeRef.current, 1)
    const dx = pos.x - lastPosRef.current.x
    const dy = pos.y - lastPosRef.current.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const speed = dist / dt  // px/ms

    // Low-pass filter velocity → stable width transitions
    velocityRef.current = SMOOTHING * velocityRef.current + (1 - SMOOTHING) * speed

    // Map speed → width: fast = thin (Harai), slow = thick (Tome)
    const targetWidth = MAX_WIDTH - (MAX_WIDTH - MIN_WIDTH) * Math.min(velocityRef.current * 35, 1)
    const newWidth = lastWidthRef.current * 0.6 + targetWidth * 0.4  // smooth transition

    ctx.save()
    ctx.fillStyle = `rgba(18, 15, 10, ${OPACITY_BASE})`

    drawBrushSegment(
      ctx,
      lastPosRef.current.x, lastPosRef.current.y,
      pos.x, pos.y,
      lastWidthRef.current, newWidth,
    )

    // Round cap at current tip
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, newWidth / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    lastPosRef.current = pos
    lastWidthRef.current = newWidth
    lastTimeRef.current = now
  }

  const stopDrawing = () => {
    if (!isDrawing) return
    setIsDrawing(false)
    lastPosRef.current = null

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height)
    setStrokeHistory((prev) => [...prev, snapshot])
  }

  return (
    <div className="shodo-canvas-shell">
      <div className="shodo-canvas-frame">
        {/* Guide kanji ghost */}
        {showGuide && (
          <div className="shodo-canvas-guide" aria-hidden="true">
            {kanjiChar}
          </div>
        )}

        {/* Drawing canvas */}
        <canvas
          ref={canvasRef}
          width={280}
          height={280}
          onMouseDown={startDrawing}
          onMouseMove={continueDraw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={continueDraw}
          onTouchEnd={stopDrawing}
          className={`shodo-canvas-draw${isDrawing ? ' is-drawing' : ''}`}
        />
      </div>

      {/* Toolbar */}
      <div className="shodo-canvas-toolbar">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowGuide(!showGuide)}
          title={showGuide ? 'Ẩn chữ mẫu' : 'Hiện chữ mẫu'}
        >
          {showGuide ? <EyeOff size={15} /> : <Eye size={15} />}
          {showGuide ? 'Ẩn mẫu' : 'Hiện mẫu'}
        </Button>
        <Button variant="secondary" size="sm" onClick={handleUndo} title="Hoàn tác nét vẽ">
          <RotateCcw size={15} />
          Hoàn tác
        </Button>
        <Button variant="secondary" size="sm" onClick={clearCanvas} title="Xóa toàn bộ">
          <Eraser size={15} />
          Xóa tất cả
        </Button>
      </div>

      <p className="shodo-canvas-hint">
        Vẽ chậm → nét mực đậm (Tome 止め) · Vẽ nhanh → nét mảnh xước (Harai 払い)
      </p>
    </div>
  )
}
