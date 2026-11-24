import { useCallback, useEffect, useRef, useState } from 'react'
import { RotateCcw, Eraser, Loader2 } from 'lucide-react'
import { nhaikanjiApi } from './nhaikanjiApi'
import type { KanjiSummary } from './nhaikanjiTypes'

interface KanjiHandwritingPadProps {
  onSelectKanji: (kanji: KanjiSummary) => void
  onClose?: () => void
}

type Point = [number, number]
type Stroke = Point[]

const PAD_SIZE = 220

export function KanjiHandwritingPad({ onSelectKanji, onClose }: KanjiHandwritingPadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const strokesRef = useRef<Stroke[]>([])
  const activeStrokeRef = useRef<Stroke | null>(null)
  const isDrawingRef = useRef(false)

  const [strokeCount, setStrokeCount] = useState(0)
  const [candidates, setCandidates] = useState<KanjiSummary[]>([])
  const [isRecognizing, setIsRecognizing] = useState(false)
  const [sourceNote, setSourceNote] = useState<'ime' | 'fallback' | null>(null)

  const redrawCanvas = useCallback((strokes: Stroke[], active?: Stroke | null) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const targetSize = PAD_SIZE * dpr
    if (canvas.width !== targetSize || canvas.height !== targetSize) {
      canvas.width = targetSize
      canvas.height = targetSize
    }

    ctx.save()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, PAD_SIZE, PAD_SIZE)

    ctx.strokeStyle = '#1E1D1A'
    ctx.lineWidth = 5.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const all = active && active.length > 0 ? [...strokes, active] : strokes
    for (const stroke of all) {
      const first = stroke[0]
      if (!first) continue
      ctx.beginPath()
      ctx.moveTo(first[0], first[1])
      if (stroke.length === 1) {
        ctx.lineTo(first[0] + 0.5, first[1] + 0.5)
      } else {
        for (let i = 1; i < stroke.length; i++) {
          const pt = stroke[i]
          if (pt) ctx.lineTo(pt[0], pt[1])
        }
      }
      ctx.stroke()
    }
    ctx.restore()
  }, [])

  useEffect(() => {
    redrawCanvas(strokesRef.current)
  }, [redrawCanvas])

  useEffect(() => {
    if (strokeCount === 0) {
      setCandidates([])
      setSourceNote(null)
      setIsRecognizing(false)
      return
    }

    let cancelled = false
    setIsRecognizing(true)
    const timer = window.setTimeout(() => {
      void nhaikanjiApi
        .recognizeHandwriting({
          strokes: strokesRef.current,
          width: PAD_SIZE,
          height: PAD_SIZE,
        })
        .then((res) => {
          if (cancelled) return
          setCandidates(Array.isArray(res.candidates) ? res.candidates : [])
          setSourceNote(res.source === 'fallback' ? 'fallback' : 'ime')
        })
        .catch(() => {
          if (cancelled) return
          setCandidates([])
        })
        .finally(() => {
          if (!cancelled) setIsRecognizing(false)
        })
    }, 320)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [strokeCount])

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(PAD_SIZE, ((e.clientX - rect.left) / rect.width) * PAD_SIZE))
    const y = Math.max(0, Math.min(PAD_SIZE, ((e.clientY - rect.top) / rect.height) * PAD_SIZE))
    return [x, y]
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    isDrawingRef.current = true
    const pt = getPoint(e)
    activeStrokeRef.current = [pt]
    redrawCanvas(strokesRef.current, activeStrokeRef.current)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !activeStrokeRef.current) return
    const pt = getPoint(e)
    const last = activeStrokeRef.current[activeStrokeRef.current.length - 1]
    if (!last || Math.hypot(pt[0] - last[0], pt[1] - last[1]) >= 2) {
      activeStrokeRef.current.push(pt)
      redrawCanvas(strokesRef.current, activeStrokeRef.current)
    }
  }

  const finishStroke = () => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    if (activeStrokeRef.current && activeStrokeRef.current.length > 0) {
      strokesRef.current = [...strokesRef.current, activeStrokeRef.current]
      activeStrokeRef.current = null
      redrawCanvas(strokesRef.current)
      setStrokeCount(strokesRef.current.length)
    }
  }

  const handleUndo = () => {
    if (strokesRef.current.length === 0) return
    strokesRef.current = strokesRef.current.slice(0, -1)
    redrawCanvas(strokesRef.current)
    setStrokeCount(strokesRef.current.length)
  }

  const handleClear = () => {
    strokesRef.current = []
    activeStrokeRef.current = null
    redrawCanvas([])
    setStrokeCount(0)
    setCandidates([])
    setSourceNote(null)
  }

  return (
    <div className="kanji-handwriting-panel" role="region" aria-label="Bảng vẽ nhận diện Hán tự">
      <div className="kanji-handwriting-stage-wrap">
        <div className="kanji-handwriting-box" style={{ width: PAD_SIZE, height: PAD_SIZE }}>
          <svg viewBox={`0 0 ${PAD_SIZE} ${PAD_SIZE}`} className="kanji-handwriting-grid" aria-hidden="true">
            <line
              x1={PAD_SIZE / 2}
              y1="0"
              x2={PAD_SIZE / 2}
              y2={PAD_SIZE}
              stroke="#B44632"
              strokeWidth="0.8"
              strokeDasharray="4 4"
              opacity="0.3"
            />
            <line
              x1="0"
              y1={PAD_SIZE / 2}
              x2={PAD_SIZE}
              y2={PAD_SIZE / 2}
              stroke="#B44632"
              strokeWidth="0.8"
              strokeDasharray="4 4"
              opacity="0.3"
            />
            <line
              x1="0"
              y1="0"
              x2={PAD_SIZE}
              y2={PAD_SIZE}
              stroke="#B44632"
              strokeWidth="0.6"
              strokeDasharray="3 5"
              opacity="0.18"
            />
            <line
              x1={PAD_SIZE}
              y1="0"
              x2="0"
              y2={PAD_SIZE}
              stroke="#B44632"
              strokeWidth="0.6"
              strokeDasharray="3 5"
              opacity="0.18"
            />
          </svg>
          <canvas
            ref={canvasRef}
            className="kanji-handwriting-canvas"
            aria-label="Vùng vẽ nét Hán tự để tìm kiếm"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishStroke}
            onPointerCancel={finishStroke}
          />
          {strokeCount === 0 && <span className="kanji-handwriting-placeholder">Vẽ chữ Kanji vào ô cửu cung…</span>}
        </div>

        <div className="kanji-handwriting-toolbar">
          <span className="kanji-handwriting-strokes">{strokeCount} nét</span>
          <button
            type="button"
            className="kanji-pill-btn"
            onClick={handleUndo}
            disabled={strokeCount === 0}
            title="Hoàn tác nét vừa vẽ"
          >
            <RotateCcw size={12} aria-hidden="true" /> Hoàn tác
          </button>
          <button
            type="button"
            className="kanji-pill-btn"
            onClick={handleClear}
            disabled={strokeCount === 0}
            title="Xóa toàn bộ nét vẽ"
          >
            <Eraser size={12} aria-hidden="true" /> Xóa
          </button>
          {onClose && (
            <button type="button" className="kanji-pill-btn" onClick={onClose}>
              Đóng
            </button>
          )}
        </div>
      </div>

      <div className="kanji-handwriting-results">
        <div className="kanji-handwriting-results__head">
          <span>Gợi ý chữ nhận diện</span>
          {isRecognizing && (
            <span className="kanji-handwriting-loading">
              <Loader2 size={13} className="spin" aria-hidden="true" /> Đang nhận diện…
            </span>
          )}
          {!isRecognizing && sourceNote === 'fallback' && candidates.length > 0 && (
            <span className="kanji-handwriting-note">Gợi ý theo {strokeCount} nét</span>
          )}
        </div>

        {strokeCount === 0 ? (
          <p className="kanji-handwriting-empty">
            Dùng chuột hoặc ngón tay vẽ từng nét; hệ thống sẽ tự động gợi ý các chữ Hán khớp nhất.
          </p>
        ) : !isRecognizing && candidates.length === 0 ? (
          <p className="kanji-handwriting-empty">
            Chưa nhận diện được chữ phù hợp — thử vẽ rõ nét hơn hoặc xóa vẽ lại.
          </p>
        ) : (
          <div className="kanji-handwriting-candidates" role="list" aria-label="Kết quả nhận diện chữ viết tay">
            {candidates.map((cand) => (
              <button
                key={cand.kanji}
                type="button"
                role="listitem"
                className="kanji-handwriting-candidate"
                onClick={() => onSelectKanji(cand)}
                title={`${cand.kanji} (${cand.hanzi}) — ${cand.meaning_vi}`}
              >
                <span className="kanji-handwriting-candidate__char">{cand.kanji}</span>
                <span className="kanji-handwriting-candidate__meta">
                  <strong>{cand.hanzi}</strong>
                  <small>{cand.jlpt_level || 'N5'}</small>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
export default KanjiHandwritingPad
