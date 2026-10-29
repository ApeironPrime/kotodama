import { useEffect, useRef, useState, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface ConstellationNode {
  char: string
  label: string // Han Viet or brief meaning
  role: 'center' | 'component' | 'descendant'
  // physics state
  x: number
  y: number
  vx: number
  vy: number
  targetX: number
  targetY: number
}

interface ConstellationEdge {
  from: number
  to: number
  type: 'component' | 'descendant'
}

interface Props {
  kanji: string
  components: Array<{ char: string; label: string }>   // upstream radical pieces
  descendants?: Array<{ char: string; label: string }> // derived kanji (Phả hệ nở rộng)
  onSelectKanji?: (k: string) => void
}

// ─── Spring physics constants ─────────────────────────────────────────────────
const SPRING_K = 0.08
const DAMPING = 0.72
const TARGET_DIST_COMPONENT = 105
const TARGET_DIST_DESCENDANT = 118

// ─── Colour palette ───────────────────────────────────────────────────────────
const THREAD_IDLE = 'rgba(180, 168, 152, 0.42)'
const THREAD_HOVER = 'rgba(194, 58, 43, 0.85)'
const SHU_IRO = '#C23A2B'

// ─── Utility ─────────────────────────────────────────────────────────────────
function polar(cx: number, cy: number, r: number, angle: number): [number, number] {
  return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]
}

// ─── Component ───────────────────────────────────────────────────────────────
export function KanjiConstellationGraph({
  kanji,
  components,
  descendants = [],
  onSelectKanji,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nodesRef = useRef<ConstellationNode[]>([])
  const edgesRef = useRef<ConstellationEdge[]>([])
  const animRef = useRef<number>(0)
  const mouseRef = useRef<{ x: number; y: number }>({ x: -999, y: -999 })
  const hoveredRef = useRef<number>(-1)
  const [hoveredIdx, setHoveredIdx] = useState(-1)

  // Descendant tree mode: active when kanji is a prolific root (>= 3 descendants) OR when it has no upstream components
  const isDescendantMode = descendants.length >= 3 || (components.length === 0 && descendants.length > 0)

  // ─── Build graph ───────────────────────────────────────────────────────────
  const buildGraph = useCallback(
    (w: number, h: number) => {
      hoveredRef.current = -1
      setHoveredIdx(-1)
      const nodes: ConstellationNode[] = []
      const edges: ConstellationEdge[] = []

      if (isDescendantMode) {
        // ── MODE B: Descendant Tree (Phả hệ nở rộng từ chữ gốc bên trái) ────────
        // Root node sits on the left side
        const rootX = Math.max(w * 0.18, 46)
        const rootY = h * 0.5
        nodes.push({
          char: kanji,
          label: 'Gốc',
          role: 'center',
          x: rootX,
          y: rootY,
          vx: 0,
          vy: 0,
          targetX: rootX,
          targetY: rootY,
        })

        // Derived kanji (Chữ phái sinh) distributed along the right in a graceful crescent
        const descList = descendants.slice(0, 8)
        const count = descList.length

        descList.forEach(({ char, label }, i) => {
          // Vertical positioning
          const topMargin = Math.min(36, h * 0.12)
          const bottomMargin = Math.min(36, h * 0.12)
          const spanH = h - topMargin - bottomMargin
          const ty = count > 1 ? topMargin + (i / (count - 1)) * spanH : h * 0.5

          // Gentle outward arc curving toward the right
          const normY = count > 1 ? (i / (count - 1) - 0.5) * 2 : 0 // -1 to +1
          const arcOffset = (1 - normY * normY) * (w * 0.08)
          const tx = w * 0.74 + arcOffset

          // Initial burst from root with positive x velocity
          nodes.push({
            char,
            label,
            role: 'descendant',
            x: rootX + 15 + Math.random() * 20,
            y: rootY + (Math.random() - 0.5) * 30,
            vx: 3 + Math.random() * 4,
            vy: (ty - rootY) * 0.05,
            targetX: tx,
            targetY: ty,
          })

          edges.push({ from: 0, to: nodes.length - 1, type: 'descendant' })
        })
      } else {
        // ── MODE A: Convergent Constellation (Chòm sao hội tụ ở tâm) ─────────
        const cx = w / 2
        const cy = h / 2

        // Center node
        nodes.push({
          char: kanji,
          label: '',
          role: 'center',
          x: cx,
          y: cy,
          vx: 0,
          vy: 0,
          targetX: cx,
          targetY: cy,
        })

        // Upstream components: fan above center
        const compCount = components.length
        components.forEach(({ char, label }, i) => {
          let angle: number
          if (compCount === 1) {
            angle = -Math.PI / 2
          } else if (compCount === 2) {
            angle = -Math.PI * 0.72 + i * Math.PI * 0.44
          } else {
            angle = -Math.PI * 0.8 + (i / Math.max(compCount - 1, 1)) * Math.PI * 0.6
          }
          const [tx, ty] = polar(cx, cy, TARGET_DIST_COMPONENT, angle)
          const jitter = 15
          nodes.push({
            char,
            label,
            role: 'component',
            x: cx + (Math.random() - 0.5) * jitter,
            y: cy + (Math.random() - 0.5) * jitter,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            targetX: tx,
            targetY: ty,
          })
          edges.push({ from: nodes.length - 1, to: 0, type: 'component' })
        })

        // Downstream genuine descendants (if any): fan below center
        const descList = descendants.slice(0, 6)
        const descCount = descList.length

        if (descCount > 0) {
          descList.forEach(({ char, label }, i) => {
            let angle: number
            if (descCount === 1) {
              angle = Math.PI / 2
            } else if (descCount === 2) {
              angle = Math.PI * 0.28 + i * Math.PI * 0.44
            } else {
              angle = Math.PI * 0.2 + (i / Math.max(descCount - 1, 1)) * Math.PI * 0.6
            }
            const [tx, ty] = polar(cx, cy, TARGET_DIST_DESCENDANT, angle)
            nodes.push({
              char,
              label,
              role: 'descendant',
              x: cx + (Math.random() - 0.5) * 15,
              y: cy + (Math.random() - 0.5) * 15,
              vx: (Math.random() - 0.5) * 4,
              vy: (Math.random() - 0.5) * 4,
              targetX: tx,
              targetY: ty,
            })
            edges.push({ from: 0, to: nodes.length - 1, type: 'descendant' })
          })
        }
      }

      nodesRef.current = nodes
      edgesRef.current = edges
    },
    [kanji, components, descendants, isDescendantMode]
  )

  // ─── Hit test ──────────────────────────────────────────────────────────────
  const hitTest = useCallback((mx: number, my: number): number => {
    const nodes = nodesRef.current
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]
      if (!n) continue
      const r = i === 0 ? 28 : 22
      if ((mx - n.x) ** 2 + (my - n.y) ** 2 < r * r) return i
    }
    return -1
  }, [])

  // ─── Draw loop ─────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { width: w, height: h } = canvas
    ctx.clearRect(0, 0, w, h)

    const nodes = nodesRef.current
    const edges = edgesRef.current
    const hov = hoveredRef.current

    // Physics step
    for (const n of nodes) {
      if (!n || n.role === 'center') continue
      const dx = n.targetX - n.x
      const dy = n.targetY - n.y
      n.vx = (n.vx + dx * SPRING_K) * DAMPING
      n.vy = (n.vy + dy * SPRING_K) * DAMPING
      n.x += n.vx
      n.y += n.vy
    }

    // Hover hit test
    const mx = mouseRef.current.x
    const my = mouseRef.current.y
    const newHov = hitTest(mx, my)
    if (newHov !== hoveredRef.current) {
      hoveredRef.current = newHov
      setHoveredIdx(newHov)
    }

    // ── Draw edges (Hairline ink threads) ────────────────────────────────────
    for (const edge of edges) {
      const a = nodes[edge.from]
      const b = nodes[edge.to]
      if (!a || !b) continue
      const isHovered = (hov === edge.from || hov === edge.to) && hov !== -1

      ctx.save()
      ctx.beginPath()

      if (edge.type === 'descendant') {
        // Horizontal S-curve sweeping from root (left) to descendant (right)
        const cp1x = a.x + (b.x - a.x) * 0.45
        const cp1y = a.y
        const cp2x = a.x + (b.x - a.x) * 0.55
        const cp2y = b.y
        ctx.moveTo(a.x, a.y)
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, b.x, b.y)
      } else {
        // Convergent arc
        const midX = (a.x + b.x) / 2
        const midY = (a.y + b.y) / 2
        const perpX = -(b.y - a.y) * 0.18
        const perpY = (b.x - a.x) * 0.18
        ctx.moveTo(a.x, a.y)
        ctx.quadraticCurveTo(midX + perpX, midY + perpY, b.x, b.y)
      }

      if (isHovered) {
        ctx.strokeStyle = THREAD_HOVER
        ctx.lineWidth = 1.6
        ctx.shadowColor = 'rgba(194, 58, 43, 0.45)'
        ctx.shadowBlur = 9
        ctx.setLineDash([])
      } else {
        ctx.strokeStyle = THREAD_IDLE
        ctx.lineWidth = 0.95
        ctx.setLineDash([3, 4])
      }
      ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()

      // Arrow tip pointing to child in descendant mode or hover
      if (edge.type === 'descendant' && isHovered) {
        const angle = Math.atan2(b.y - a.y, b.x - a.x)
        const arrowX = b.x - 18 * Math.cos(angle)
        const arrowY = b.y - 18 * Math.sin(angle)
        ctx.save()
        ctx.translate(arrowX, arrowY)
        ctx.rotate(angle)
        ctx.beginPath()
        ctx.moveTo(-6, -3)
        ctx.lineTo(0, 0)
        ctx.lineTo(-6, 3)
        ctx.strokeStyle = THREAD_HOVER
        ctx.lineWidth = 1.3
        ctx.stroke()
        ctx.restore()
      }
    }

    // ── Draw nodes (Floating ink characters) ─────────────────────────────────
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]
      if (!n) continue
      const isHov = i === hov
      ctx.save()

      if (n.role === 'center') {
        // Root / Focal Kanji
        if (isHov) {
          ctx.shadowColor = 'rgba(194, 58, 43, 0.35)'
          ctx.shadowBlur = 18
        }
        ctx.font = `600 2.5rem "Noto Serif JP", serif`
        ctx.fillStyle = '#1C1917'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(n.char, n.x, n.y)

        // Subtitle indicator below root
        if (isDescendantMode) {
          ctx.font = `600 0.62rem "Noto Serif JP", serif`
          ctx.fillStyle = SHU_IRO
          ctx.fillText('Chữ gốc', n.x, n.y + 24)
        }
      } else {
        // Floating character (component or descendant)
        const isDesc = n.role === 'descendant'
        const baseSize = isDesc ? 1.3 : 1.35
        const scale = isHov ? 1.2 : 1
        ctx.font = `500 ${baseSize * scale}rem "Noto Serif JP", serif`

        const alpha = isHov ? 1 : 0.88
        if (isDesc || n.role === 'component') {
          ctx.fillStyle = `rgba(194, 58, 43, ${alpha})` // Shu-iro red
          if (isHov) {
            ctx.shadowColor = 'rgba(194, 58, 43, 0.5)'
            ctx.shadowBlur = 12
          }
        } else {
          ctx.fillStyle = `rgba(38, 34, 30, ${alpha})` // Deep sumi ink
          if (isHov) {
            ctx.shadowColor = 'rgba(38, 34, 30, 0.4)'
            ctx.shadowBlur = 10
          }
        }

        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(n.char, n.x, n.y)

        // Han Viet label cleanly placed below character (no overlapping, no dots)
        if (n.label) {
          ctx.font = `500 0.65rem "Noto Sans", sans-serif`
          ctx.fillStyle = isHov ? SHU_IRO : '#78716C'
          ctx.shadowBlur = 0
          ctx.textBaseline = 'top'
          ctx.fillText(n.label, n.x, n.y + 14)
          ctx.textBaseline = 'middle'
        }
      }

      ctx.restore()
    }
  }, [hitTest, isDescendantMode])

  // ─── Animation loop ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const parent = canvas.parentElement
    if (!parent) return

    const applySizeAndBuild = () => {
      const w = Math.floor(parent.clientWidth || 360)
      const h = Math.min(Math.max(Math.floor(parent.clientHeight || 340), 280), 380)
      if (w > 0 && h > 0) {
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w
          canvas.height = h
        }
        buildGraph(w, h)
      }
    }
    applySizeAndBuild()

    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        applySizeAndBuild()
      })
      ro.observe(parent)
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', applySizeAndBuild)
    }

    const tick = () => {
      draw()
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)

    return () => {
      if (ro) {
        ro.disconnect()
      } else if (typeof window !== 'undefined') {
        window.removeEventListener('resize', applySizeAndBuild)
      }
      cancelAnimationFrame(animRef.current)
    }
  }, [buildGraph, draw])

  // ─── Mouse handlers ────────────────────────────────────────────────────────
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }
  const handleMouseLeave = () => {
    mouseRef.current = { x: -999, y: -999 }
  }
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const idx = hitTest(mx, my)
    if (idx > 0 && onSelectKanji) {
      const target = nodesRef.current[idx]
      if (target) {
        onSelectKanji(target.char)
      }
    }
  }

  // ─── Legend labels ─────────────────────────────────────────────────────────
  const showCompLegend = components.length > 0
  const showDescLegend = descendants.length > 0

  return (
    <div className="kanji-constellation-wrap">
      <div className="kanji-constellation-legend">
        {isDescendantMode ? (
          <>
            <span className="kanji-const-legend-item kanji-const-legend--root">
              <span className="kanji-const-legend-dot kanji-const-legend-dot--root" />
              Chữ gốc 【{kanji}】
            </span>
            <span className="kanji-const-legend-item kanji-const-legend--component">
              <span className="kanji-const-legend-dot" />
              Hán tự phái sinh (Bấm để khám phá)
            </span>
          </>
        ) : (
          <>
            {showCompLegend && (
              <span className="kanji-const-legend-item kanji-const-legend--component">
                <span className="kanji-const-legend-dot" />
                Bộ thủ cấu thành
              </span>
            )}
            {showDescLegend && (
              <span className="kanji-const-legend-item kanji-const-legend--descendant">
                <span className="kanji-const-legend-dot kanji-const-legend-dot--descendant" />
                Hán tự phái sinh (Bấm để khám phá)
              </span>
            )}
          </>
        )}
      </div>

      <canvas
        ref={canvasRef}
        className={`kanji-constellation-canvas${hoveredIdx > 0 ? ' is-hovering' : ''}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        aria-label={`Sơ đồ phả hệ Hán tự: ${kanji}`}
      />
    </div>
  )
}

export default KanjiConstellationGraph
