import React, { useRef, useState, useEffect } from 'react'
import { Eraser, Eye, EyeOff, RotateCcw } from 'lucide-react'
import { Button } from '../../components/ui'

interface KanjiCanvasProps {
  kanjiChar: string
}

export function KanjiCanvas({ kanjiChar }: KanjiCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [showGuide, setShowGuide] = useState(true)
  const [strokeHistory, setStrokeHistory] = useState<ImageData[]>([])

  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.save()
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])

    // Horizontal center line
    ctx.beginPath()
    ctx.moveTo(0, height / 2)
    ctx.lineTo(width, height / 2)
    ctx.stroke()

    // Vertical center line
    ctx.beginPath()
    ctx.moveTo(width / 2, 0)
    ctx.lineTo(width / 2, height)
    ctx.stroke()

    // Outer border
    ctx.setLineDash([])
    ctx.strokeStyle = '#cbd5e1'
    ctx.strokeRect(0, 0, width, height)
    ctx.restore()
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    drawGrid(ctx, canvas.width, canvas.height)
    setStrokeHistory([])
  }

  const handleUndo = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (strokeHistory.length > 1) {
      const prev = strokeHistory[strokeHistory.length - 2]
      if (prev) {
        ctx.putImageData(prev, 0, 0)
        setStrokeHistory((prevHist) => prevHist.slice(0, -1))
      }
    } else {
      clearCanvas()
    }
  }

  useEffect(() => {
    clearCanvas()
  }, [kanjiChar])

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    let clientX = 0
    let clientY = 0

    if ('touches' in e) {
      const touch = e.touches[0]
      if (!touch) return
      clientX = touch.clientX
      clientY = touch.clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }

    const x = clientX - rect.left
    const y = clientY - rect.top

    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 6
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    setIsDrawing(true)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    let clientX = 0
    let clientY = 0

    if ('touches' in e) {
      const touch = e.touches[0]
      if (!touch) return
      clientX = touch.clientX
      clientY = touch.clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }

    const x = clientX - rect.left
    const y = clientY - rect.top

    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    if (!isDrawing) return
    setIsDrawing(false)
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.closePath()
    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height)
    setStrokeHistory((prev) => [...prev, snapshot])
  }

  return (
    <div className="flex flex-col items-center gap-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
      <div className="relative w-[240px] h-[240px] bg-white dark:bg-slate-950 rounded-lg shadow-sm overflow-hidden flex items-center justify-center">
        {/* Background Guide Kanji */}
        {showGuide && (
          <div
            className="absolute inset-0 flex items-center justify-center text-[150px] text-slate-200 dark:text-slate-800 pointer-events-none select-none font-serif leading-none opacity-80"
            aria-hidden="true"
          >
            {kanjiChar}
          </div>
        )}

        {/* Drawing Canvas */}
        <canvas
          ref={canvasRef}
          width={240}
          height={240}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="relative z-10 cursor-crosshair touch-none"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowGuide(!showGuide)}
          title={showGuide ? 'Ẩn chữ mẫu' : 'Hiện chữ mẫu'}
        >
          {showGuide ? <EyeOff size={16} /> : <Eye size={16} />}
          {showGuide ? 'Ẩn mẫu' : 'Hiện mẫu'}
        </Button>
        <Button variant="secondary" size="sm" onClick={handleUndo} title="Hoàn tác nét vẽ">
          <RotateCcw size={16} />
          Hoàn tác
        </Button>
        <Button variant="secondary" size="sm" onClick={clearCanvas} title="Xóa toàn bộ">
          <Eraser size={16} />
          Xóa
        </Button>
      </div>
    </div>
  )
}
