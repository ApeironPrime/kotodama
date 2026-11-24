import { useReducedMotion } from '../../lib/useReducedMotion'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'

interface ConstellationNode {
  char: string
  label: string
  role: 'center' | 'component' | 'descendant'
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

export type ConstellationMode = 'auto' | 'components' | 'descendants'

interface Props {
  kanji: string
  components: Array<{ char: string; label: string }>
  descendants?: Array<{ char: string; label: string }>
  mode?: ConstellationMode
  onSelectKanji?: (k: string) => void
}

const SPRING_K = 0.08
const DAMPING = 0.72
const TARGET_DIST_COMPONENT = 96
const TARGET_DIST_DESCENDANT = 104

const THREAD_IDLE = 'rgba(140, 128, 114, 0.42)'
const THREAD_HOVER = 'rgba(184, 46, 46, 0.88)'
const SHU_IRO = '#B82E2E'
const MOEGI = '#3F5E45'
const SUMI = '#1E1D1A'

function polar(cx: number, cy: number, r: number, angle: number): [number, number] {
  return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]
}

export function KanjiConstellationGraph({ kanji, components, descendants = [], mode = 'auto', onSelectKanji }: Props) {
  const reducedMotion = useReducedMotion()
  const stageRef = useRef<HTMLDivElement>(null)
  const sizeRef = useRef({ width: 360, height: 300 })
  const wakeRef = useRef(() => {})
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nodesRef = useRef<ConstellationNode[]>([])
  const edgesRef = useRef<ConstellationEdge[]>([])
  const animRef = useRef<number>(0)
  const mouseRef = useRef<{ x: number; y: number }>({ x: -999, y: -999 })
  const hoveredRef = useRef<number>(-1)
  const [hoveredIdx, setHoveredIdx] = useState(-1)

  const visibleComponents = useMemo(() => (mode === 'descendants' ? [] : components.slice(0, 5)), [mode, components])
  const visibleDescendants = useMemo(() => (mode === 'components' ? [] : descendants.slice(0, 7)), [mode, descendants])

  const isThreeTierMode = visibleComponents.length > 0 && visibleDescendants.length > 0
  const isDescendantOnlyMode = !isThreeTierMode && visibleComponents.length === 0 && visibleDescendants.length > 0

  const buildGraph = useCallback(
    (w: number, h: number) => {
      hoveredRef.current = -1
      setHoveredIdx(-1)
      const nodes: ConstellationNode[] = []
      const edges: ConstellationEdge[] = []

      const topPad = 36
      const bottomPad = 44
      const usableH = Math.max(h - topPad - bottomPad, 120)

      if (isThreeTierMode) {
        // 3-Tier Lineage: [Components on left] ──► [Center Kanji] ──► [Descendants on right]
        const centerX = w * 0.45
        const centerY = topPad + usableH * 0.5
        nodes.push({
          char: kanji,
          label: '',
          role: 'center',
          x: centerX,
          y: centerY,
          vx: 0,
          vy: 0,
          targetX: centerX,
          targetY: centerY,
        })

        const compCount = visibleComponents.length
        visibleComponents.forEach(({ char, label }, i) => {
          const ty = compCount > 1 ? topPad + 12 + (i / (compCount - 1)) * (usableH - 24) : centerY
          const tx = Math.max(w * 0.14, 34)
          nodes.push({
            char,
            label,
            role: 'component',
            x: centerX - 24,
            y: centerY + (Math.random() - 0.5) * 20,
            vx: -2 - Math.random() * 2,
            vy: (ty - centerY) * 0.04,
            targetX: tx,
            targetY: ty,
          })
          edges.push({ from: nodes.length - 1, to: 0, type: 'component' })
        })

        const descCount = visibleDescendants.length
        visibleDescendants.forEach(({ char, label }, i) => {
          const ty = descCount > 1 ? topPad + (i / (descCount - 1)) * usableH : centerY
          const normY = descCount > 1 ? (i / (descCount - 1) - 0.5) * 2 : 0
          const arcOffset = (1 - normY * normY) * (w * 0.06)
          const tx = Math.min(w * 0.77 + arcOffset, w - 30)
          nodes.push({
            char,
            label,
            role: 'descendant',
            x: centerX + 24,
            y: centerY + (Math.random() - 0.5) * 24,
            vx: 2 + Math.random() * 3,
            vy: (ty - centerY) * 0.04,
            targetX: tx,
            targetY: ty,
          })
          edges.push({ from: 0, to: nodes.length - 1, type: 'descendant' })
        })
      } else if (isDescendantOnlyMode) {
        const rootX = Math.max(w * 0.18, 44)
        const rootY = topPad + usableH * 0.5
        nodes.push({
          char: kanji,
          label: 'Chữ gốc',
          role: 'center',
          x: rootX,
          y: rootY,
          vx: 0,
          vy: 0,
          targetX: rootX,
          targetY: rootY,
        })

        const count = visibleDescendants.length
        visibleDescendants.forEach(({ char, label }, i) => {
          const ty = count > 1 ? topPad + (i / (count - 1)) * usableH : rootY
          const normY = count > 1 ? (i / (count - 1) - 0.5) * 2 : 0
          const arcOffset = (1 - normY * normY) * (w * 0.08)
          const tx = Math.min(w * 0.74 + arcOffset, w - 34)
          nodes.push({
            char,
            label,
            role: 'descendant',
            x: rootX + 18 + Math.random() * 18,
            y: rootY + (Math.random() - 0.5) * 26,
            vx: 3 + Math.random() * 3,
            vy: (ty - rootY) * 0.05,
            targetX: tx,
            targetY: ty,
          })
          edges.push({ from: 0, to: nodes.length - 1, type: 'descendant' })
        })
      } else {
        const cx = w / 2
        const cy = topPad + usableH * 0.54
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

        const compCount = visibleComponents.length
        visibleComponents.forEach(({ char, label }, i) => {
          let angle: number
          if (compCount === 1) {
            angle = -Math.PI / 2
          } else if (compCount === 2) {
            angle = -Math.PI * 0.72 + i * Math.PI * 0.44
          } else {
            angle = -Math.PI * 0.8 + (i / Math.max(compCount - 1, 1)) * Math.PI * 0.6
          }
          const [tx, ty] = polar(cx, cy, Math.min(TARGET_DIST_COMPONENT, usableH * 0.46), angle)
          nodes.push({
            char,
            label,
            role: 'component',
            x: cx + (Math.random() - 0.5) * 14,
            y: cy + (Math.random() - 0.5) * 14,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            targetX: tx,
            targetY: Math.max(topPad, ty),
          })
          edges.push({ from: nodes.length - 1, to: 0, type: 'component' })
        })

        const descCount = visibleDescendants.length
        visibleDescendants.forEach(({ char, label }, i) => {
          let angle: number
          if (descCount === 1) {
            angle = Math.PI / 2
          } else if (descCount === 2) {
            angle = Math.PI * 0.28 + i * Math.PI * 0.44
          } else {
            angle = Math.PI * 0.2 + (i / Math.max(descCount - 1, 1)) * Math.PI * 0.6
          }
          const [tx, ty] = polar(cx, cy, Math.min(TARGET_DIST_DESCENDANT, usableH * 0.44), angle)
          nodes.push({
            char,
            label,
            role: 'descendant',
            x: cx + (Math.random() - 0.5) * 14,
            y: cy + (Math.random() - 0.5) * 14,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            targetX: tx,
            targetY: Math.min(h - bottomPad, ty),
          })
          edges.push({ from: 0, to: nodes.length - 1, type: 'descendant' })
        })
      }

      nodesRef.current = nodes
      edgesRef.current = edges
    },
    [kanji, visibleComponents, visibleDescendants, isThreeTierMode, isDescendantOnlyMode]
  )

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

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { width: w, height: h } = sizeRef.current
    ctx.clearRect(0, 0, w, h)

    const nodes = nodesRef.current
    const edges = edgesRef.current
    const hov = hoveredRef.current

    for (const n of nodes) {
      if (!n || n.role === 'center') continue
      const dx = n.targetX - n.x
      const dy = n.targetY - n.y
      n.vx = (n.vx + dx * SPRING_K) * DAMPING
      n.vy = (n.vy + dy * SPRING_K) * DAMPING
      n.x += n.vx
      n.y += n.vy
    }

    const mx = mouseRef.current.x
    const my = mouseRef.current.y
    const newHov = hitTest(mx, my)
    if (newHov !== hoveredRef.current) {
      hoveredRef.current = newHov
      setHoveredIdx(newHov)
    }

    // Draw edges
    for (const edge of edges) {
      const a = nodes[edge.from]
      const b = nodes[edge.to]
      if (!a || !b) continue
      const isHovered = (hov === edge.from || hov === edge.to) && hov !== -1

      ctx.save()
      ctx.beginPath()
      if (edge.type === 'descendant' || isThreeTierMode) {
        const cp1x = a.x + (b.x - a.x) * 0.45
        const cp1y = a.y
        const cp2x = a.x + (b.x - a.x) * 0.55
        const cp2y = b.y
        ctx.moveTo(a.x, a.y)
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, b.x, b.y)
      } else {
        const midX = (a.x + b.x) / 2
        const midY = (a.y + b.y) / 2
        const perpX = -(b.y - a.y) * 0.16
        const perpY = (b.x - a.x) * 0.16
        ctx.moveTo(a.x, a.y)
        ctx.quadraticCurveTo(midX + perpX, midY + perpY, b.x, b.y)
      }

      if (isHovered) {
        ctx.strokeStyle = edge.type === 'component' ? MOEGI : THREAD_HOVER
        ctx.lineWidth = 1.6
        ctx.setLineDash([])
      } else {
        ctx.strokeStyle = THREAD_IDLE
        ctx.lineWidth = 1
        ctx.setLineDash([3, 4])
      }
      ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()

      // Subtle directional arrowhead pointing from source -> target
      if (isHovered || isThreeTierMode || edge.type === 'descendant') {
        const angle = Math.atan2(b.y - a.y, b.x - a.x)
        const offset = edge.to === 0 ? 26 : 18
        const arrowX = b.x - offset * Math.cos(angle)
        const arrowY = b.y - offset * Math.sin(angle)
        ctx.save()
        ctx.translate(arrowX, arrowY)
        ctx.rotate(angle)
        ctx.beginPath()
        ctx.moveTo(-5, -2.5)
        ctx.lineTo(0, 0)
        ctx.lineTo(-5, 2.5)
        ctx.strokeStyle = isHovered ? (edge.type === 'component' ? MOEGI : THREAD_HOVER) : 'rgba(140, 128, 114, 0.55)'
        ctx.lineWidth = isHovered ? 1.4 : 1
        ctx.stroke()
        ctx.restore()
      }
    }

    // Draw nodes
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]
      if (!n) continue
      const isHov = i === hov
      ctx.save()

      if (n.role === 'center') {
        ctx.font = '600 2.45rem "Shippori Mincho", "Noto Serif JP", serif'
        ctx.fillStyle = SUMI
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(n.char, n.x, n.y)

        if (n.label) {
          ctx.font = '600 0.62rem "DM Sans", sans-serif'
          ctx.fillStyle = SHU_IRO
          ctx.fillText(n.label, n.x, n.y + 24)
        }
      } else {
        const isComp = n.role === 'component'
        const baseSize = isThreeTierMode ? 1.18 : 1.32
        const scale = isHov ? 1.18 : 1
        ctx.font = `500 ${baseSize * scale}rem "Shippori Mincho", "Noto Serif JP", serif`

        ctx.fillStyle = isComp ? (isHov ? '#2A4230' : MOEGI) : isHov ? '#9F2626' : SHU_IRO
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(n.char, n.x, n.y)

        if (n.label) {
          ctx.font = '600 0.62rem "DM Sans", sans-serif'
          ctx.fillStyle = isHov ? (isComp ? MOEGI : SHU_IRO) : '#6E665C'
          ctx.textBaseline = 'top'
          ctx.fillText(n.label, n.x, n.y + 13)
          ctx.textBaseline = 'middle'
        }
      }

      ctx.restore()
    }
  }, [hitTest, isThreeTierMode])

  useEffect(() => {
    const canvas = canvasRef.current
    const stage = stageRef.current
    if (!canvas || !stage) return

    const applySizeAndBuild = () => {
      const w = Math.floor(stage.clientWidth || 360)
      const h = Math.min(Math.max(Math.floor(stage.clientHeight || 290), 250), 340)
      if (w > 0 && h > 0) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        sizeRef.current = { width: w, height: h }
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
        canvas.style.width = `${w}px`
        canvas.style.height = `${h}px`
        canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0)
        buildGraph(w, h)
        if (reducedMotion) {
          for (const node of nodesRef.current) {
            node.x = node.targetX
            node.y = node.targetY
            node.vx = 0
            node.vy = 0
          }
        }
        wakeRef.current()
      }
    }
    applySizeAndBuild()

    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => applySizeAndBuild())
      ro.observe(stage)
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', applySizeAndBuild)
    }

    const tick = () => {
      draw()
      const moving =
        !reducedMotion &&
        nodesRef.current.some(
          (node) =>
            Math.abs(node.x - node.targetX) + Math.abs(node.y - node.targetY) + Math.abs(node.vx) + Math.abs(node.vy) >
            0.2
        )
      animRef.current = moving ? requestAnimationFrame(tick) : 0
    }
    wakeRef.current = () => {
      if (!animRef.current) animRef.current = requestAnimationFrame(tick)
    }
    wakeRef.current()

    return () => {
      if (ro) {
        ro.disconnect()
      } else if (typeof window !== 'undefined') {
        window.removeEventListener('resize', applySizeAndBuild)
      }
      cancelAnimationFrame(animRef.current)
      animRef.current = 0
      wakeRef.current = () => {}
    }
  }, [buildGraph, draw, reducedMotion])

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    wakeRef.current()
  }
  const handleMouseLeave = () => {
    mouseRef.current = { x: -999, y: -999 }
    wakeRef.current()
  }
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const idx = hitTest(e.clientX - rect.left, e.clientY - rect.top)
    if (idx > 0 && onSelectKanji) {
      const target = nodesRef.current[idx]
      if (target) onSelectKanji(target.char)
    }
  }

  return (
    <div className="kanji-constellation-wrap">
      <div className="kanji-constellation-legend">
        {visibleComponents.length > 0 && (
          <span className="kanji-const-legend-item kanji-const-legend--moegi">
            <span className="kanji-const-legend-dot kanji-const-legend-dot--moegi" />
            Bộ cấu thành ({visibleComponents.length})
          </span>
        )}
        <span className="kanji-const-legend-item kanji-const-legend--root">
          <span className="kanji-const-legend-dot kanji-const-legend-dot--root" />
          Chữ đang học 【{kanji}】
        </span>
        {visibleDescendants.length > 0 && (
          <span className="kanji-const-legend-item kanji-const-legend--component">
            <span className="kanji-const-legend-dot" />
            Phái sinh ({visibleDescendants.length}) · Bấm để khám phá
          </span>
        )}
      </div>

      <div ref={stageRef} className="kanji-constellation-stage">
        <canvas
          ref={canvasRef}
          className={`kanji-constellation-canvas${hoveredIdx > 0 ? ' is-hovering' : ''}`}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          aria-label={`Sơ đồ phả hệ Hán tự: ${kanji}`}
        />
      </div>
    </div>
  )
}

export default KanjiConstellationGraph
