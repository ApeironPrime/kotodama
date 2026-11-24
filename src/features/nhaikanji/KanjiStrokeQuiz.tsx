import { useCallback, useEffect, useRef, useState } from 'react'
import HanziWriter, { type CharacterJson } from 'hanzi-writer'
import { Eye, EyeOff, Lightbulb, RotateCcw } from 'lucide-react'
import { Button } from '../../components/ui'
import { sumiAudio } from '../dictionary/sumiAudio'

interface KanjiStrokeQuizProps {
  kanjiChar: string
  fallbackStrokeCount?: number | string
  onCompleteQuiz?: () => void
}

const STAGE_SIZE = 248
const STAGE_PADDING = 16

export function KanjiStrokeQuiz({ kanjiChar, fallbackStrokeCount, onCompleteQuiz }: KanjiStrokeQuizProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const writerRef = useRef<HanziWriter | null>(null)
  const onCompleteQuizRef = useRef(onCompleteQuiz)
  onCompleteQuizRef.current = onCompleteQuiz
  const [totalStrokes, setTotalStrokes] = useState<number>(Number(fallbackStrokeCount) || 1)
  const [currentStroke, setCurrentStroke] = useState<number>(0)
  const [mistakes, setMistakes] = useState<number>(0)
  const [isCompleted, setIsCompleted] = useState<boolean>(false)
  const [showOutline, setShowOutline] = useState<boolean>(false)
  const [hasError, setHasError] = useState<boolean>(false)

  const startQuiz = useCallback((writer: HanziWriter) => {
    setCurrentStroke(0)
    setMistakes(0)
    setIsCompleted(false)
    void writer.quiz({
      leniency: 1.15,
      showHintAfterMisses: 2,
      highlightOnComplete: true,
      onCorrectStroke: (strokeData) => {
        sumiAudio.playBrushFriction()
        setCurrentStroke(strokeData.strokeNum + 1)
      },
      onMistake: () => {
        setMistakes((prev) => prev + 1)
      },
      onComplete: (summaryData) => {
        setIsCompleted(true)
        setMistakes(summaryData.totalMistakes)
        onCompleteQuizRef.current?.()
      },
    })
  }, [])

  useEffect(() => {
    let isCancelled = false
    if (!containerRef.current || !kanjiChar) return

    containerRef.current.innerHTML = ''
    setCurrentStroke(0)
    setMistakes(0)
    setIsCompleted(false)
    setHasError(false)
    setShowOutline(false)
    setTotalStrokes(Number(fallbackStrokeCount) || 1)

    try {
      const writer = HanziWriter.create(containerRef.current, kanjiChar, {
        width: STAGE_SIZE,
        height: STAGE_SIZE,
        padding: STAGE_PADDING,
        showCharacter: false,
        showOutline: false,
        strokeColor: '#1E1D1A',
        outlineColor: 'rgba(180, 165, 145, 0.45)',
        highlightColor: '#B82E2E',
        drawingColor: '#1E1D1A',
        drawingWidth: 16,
        charDataLoader: (char, onLoad, onError) => {
          void (async () => {
            try {
              const res = await fetch(`/api/v1/nhaikanji/kanji/${encodeURIComponent(char)}/brush`)
              if (res.ok) {
                const json = await res.json()
                const data = (json.data || json) as CharacterJson
                if (data && Array.isArray(data.strokes) && data.strokes.length > 0) {
                  if (!isCancelled) onLoad(data)
                  return
                }
              }
            } catch {}

            try {
              const resJp = await fetch(
                `https://cdn.jsdelivr.net/npm/hanzi-writer-data-jp@0/${encodeURIComponent(char)}.json`
              )
              if (resJp.ok) {
                const data = (await resJp.json()) as CharacterJson
                if (!isCancelled) onLoad(data)
                return
              }
            } catch {}

            try {
              const resCn = await fetch(
                `https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/${encodeURIComponent(char)}.json`
              )
              if (resCn.ok) {
                const data = (await resCn.json()) as CharacterJson
                if (!isCancelled) onLoad(data)
                return
              }
            } catch {}

            if (!isCancelled) {
              onError(new Error(`Không thể tải dữ liệu chấm nét cho ${char}`))
            }
          })()
        },
        onLoadCharDataSuccess: (loaded) => {
          if (isCancelled) return
          const data = loaded as CharacterJson
          setTotalStrokes(data.strokes.length || Number(fallbackStrokeCount) || 1)
          setHasError(false)
          startQuiz(writer)
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
      if (writerRef.current) {
        try {
          writerRef.current.cancelQuiz()
        } catch {}
        writerRef.current = null
      }
    }
  }, [kanjiChar, fallbackStrokeCount, startQuiz])

  const handleToggleOutline = () => {
    const writer = writerRef.current
    if (!writer) return
    if (showOutline) {
      void writer.hideOutline()
      setShowOutline(false)
    } else {
      void writer.showOutline()
      setShowOutline(true)
    }
  }

  const handleHintStroke = () => {
    const writer = writerRef.current
    if (!writer || isCompleted) return
    const targetStroke = Math.min(currentStroke, Math.max(0, totalStrokes - 1))
    void writer.highlightStroke(targetStroke)
  }

  const handleRestart = () => {
    const writer = writerRef.current
    if (!writer) return
    void writer.hideOutline()
    setShowOutline(false)
    startQuiz(writer)
  }

  return (
    <div className="shodo-canvas-shell">
      <div className="shodo-quiz-status">
        <span>
          Nét: <strong>{Math.min(currentStroke, totalStrokes)}</strong> / {totalStrokes}
        </span>
        <span>
          Lỗi nét: <strong>{mistakes}</strong>
        </span>
      </div>

      <div className="kanji-stroke-stage" style={{ width: STAGE_SIZE, height: STAGE_SIZE }}>
        <svg viewBox={`0 0 ${STAGE_SIZE} ${STAGE_SIZE}`} className="kanji-stroke-grid-bg" aria-hidden="true">
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

        <div
          ref={containerRef}
          className="kanji-stroke-writer-mount"
          role="application"
          aria-label={`Bảng tập viết chấm nét chữ ${kanjiChar}`}
          style={{ width: STAGE_SIZE, height: STAGE_SIZE }}
        />

        {hasError && (
          <div className="kanji-stroke-fallback-glyph">
            <span>{kanjiChar}</span>
          </div>
        )}
      </div>

      {isCompleted && (
        <div className="shodo-quiz-complete" role="status">
          <span className="shodo-quiz-complete__seal">達</span>
          <span>Hoàn thành chuẩn bút thuận{mistakes === 0 ? ' (Không sai nét nào!)' : ` (${mistakes} lỗi nhỏ)`}</span>
        </div>
      )}

      <div className="shodo-canvas-toolbar">
        <Button variant="secondary" size="sm" onClick={handleToggleOutline}>
          {showOutline ? <EyeOff size={15} /> : <Eye size={15} />}
          {showOutline ? 'Ẩn mẫu' : 'Hiện mẫu'}
        </Button>
        <Button variant="secondary" size="sm" onClick={handleHintStroke} disabled={isCompleted || hasError}>
          <Lightbulb size={15} />
          Gợi ý nét
        </Button>
        <Button variant="secondary" size="sm" onClick={handleRestart} disabled={hasError}>
          <RotateCcw size={15} />
          Viết lại
        </Button>
      </div>

      <p className="shodo-canvas-hint">Vẽ từng nét theo đúng thứ tự và chiều nét; sai 2 lần sẽ tự động gợi ý.</p>
    </div>
  )
}

export default KanjiStrokeQuiz
