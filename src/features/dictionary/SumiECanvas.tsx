import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Volume2, VolumeX, Sparkles, ZoomIn, ZoomOut, RotateCcw, X, ExternalLink } from 'lucide-react'
import type { KanjiSummary } from '../nhaikanji/nhaikanjiTypes'
import { sumiAudio } from './sumiAudio'
import {
  getKanjiDeconstruction,
  getSemanticElement,
  type DeconstructionInfo,
  type SemanticElement,
} from './kanjiDecomposition'
import {
  hankoManager,
  drawHankoSeal,
  type KanjiHankoRecord,
  type CinnabarDustParticle,
} from './kanjiHankoSrs'
import {
  getMeaningfulLinksForKanji,
  type KanjiLinkResult,
} from './kanjiRelationships'

interface SumiECanvasProps {
  items: KanjiSummary[]
  activeLevel: string
  onSelectLevel: (lvl: string) => void
  onSelectKanji: (item: KanjiSummary) => void
}

interface GlyphParticle {
  item: KanjiSummary
  x: number
  y: number
  targetX: number
  targetY: number
  vx: number
  vy: number
  dispX: number // Water refraction displacement X
  dispY: number // Water refraction displacement Y
  rotation: number
  baseRotation: number
  targetRotation: number
  scale: number
  targetScale: number
  baseFontSize: number
  depth: number // 0.65 to 1.25
  depthTier: 'deep' | 'mid' | 'fore'
  parallaxFactor: number // -0.32 to 1.35
  baseAlpha: number
  phase: number
  isHovered: boolean
  hoverRatio: number // Smooth 0 -> 1 hover with 0.6s smoke decay
  proximityRatio: number // Smooth 0 -> 1 proximity lantern
  semanticElement: SemanticElement
  row: number
  birthTime: number
}

interface OutgoingParticle {
  item: KanjiSummary
  x: number
  y: number
  scale: number
  baseFontSize: number
  baseAlpha: number
  dissolveStart: number
  dissolveDuration: number
}

interface WaterRipple {
  x: number
  y: number
  radius: number
  maxRadius: number
  alpha: number
  speed: number
  asymmetrySeed: number
}

const JLPT_LEVELS = ['ALL', 'N5', 'N4', 'N3', 'N2', 'N1'] as const

// Calligraphic font constants
const FONT_CORE = '600 46px "Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif'
const FONT_MEDIUM = '600 36px "Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif'
const FONT_NUANCE = '600 28px "Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif'
const FONT_HANZI = '700 11px system-ui, -apple-system, sans-serif'
const FONT_MEANING = '500 10.5px system-ui, -apple-system, sans-serif'

export const SumiECanvas: React.FC<SumiECanvasProps> = ({
  items,
  activeLevel,
  onSelectLevel,
  onSelectKanji,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const particlesRef = useRef<GlyphParticle[]>([])
  const outgoingParticlesRef = useRef<OutgoingParticle[]>([])
  const ripplesRef = useRef<WaterRipple[]>([])
  const cameraParallaxRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const targetParallaxRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const hoveredIndexRef = useRef<number | null>(null)
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({ x: -1000, y: -1000, active: false })
  const animFrameRef = useRef<number | null>(null)

  // 2D Infinite Cosmos Navigation (Zoom & 2D Pan LERP)
  const zoomRef = useRef<{ current: number; target: number }>({ current: 1.0, target: 1.0 })
  const panRef = useRef<{ x: number; y: number; targetX: number; targetY: number }>({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
  })

  // In-Canvas Deconstruction Stage state
  const [deconstructionStage, setDeconstructionStage] = useState<{
    info: DeconstructionInfo
    item: KanjiSummary
  } | null>(null)
  const deconstructProgressRef = useRef<number>(0)

  // Drag physics state
  const pointerDragRef = useRef<{
    isDown: boolean
    isDragging: boolean
    startX: number
    startY: number
    panStartX: number
    panStartY: number
    startTime: number
  }>({
    isDown: false,
    isDragging: false,
    startX: 0,
    startY: 0,
    panStartX: 0,
    panStartY: 0,
    startTime: 0,
  })

  // Hanko SRS Spaced Repetition States & Ink Decay
  const [hankoRecords, setHankoRecords] = useState<Record<string, KanjiHankoRecord>>(() => hankoManager.getAll())
  const hankoRecordsRef = useRef<Record<string, KanjiHankoRecord>>(hankoRecords)
  hankoRecordsRef.current = hankoRecords

  // Ambient SRS Filter Mode ("Chờ nạp mực")
  const [hankoFilterActive, setHankoFilterActive] = useState<boolean>(false)
  const hankoFilterActiveRef = useRef<boolean>(hankoFilterActive)
  hankoFilterActiveRef.current = hankoFilterActive

  // Stamping physics: Screen Shake & Cinnabar Dust
  const screenShakeRef = useRef<{ intensity: number; decay: number }>({ intensity: 0, decay: 0.86 })
  const cinnabarDustRef = useRef<CinnabarDustParticle[]>([])

  // 0.5s Hold-to-Stamp gesture tracking
  const holdPressRef = useRef<{
    targetIndex: number | null
    startTime: number
    isHolding: boolean
    completed: boolean
    x: number
    y: number
  }>({
    targetIndex: null,
    startTime: 0,
    isHolding: false,
    completed: false,
    x: 0,
    y: 0,
  })

  const [isMuted, setIsMuted] = useState(sumiAudio.isMuted())

  // Execute Hanko Stamp (Dập ấn nạp mực)
  const executeStampAction = useCallback((kanji: string, screenX: number, screenY: number) => {
    sumiAudio.initOnGesture()
    sumiAudio.playHankoStamp()

    // 1. Tactile micro-screen shake (1-2px)
    screenShakeRef.current.intensity = 2.8

    // 2. Cinnabar dust splash (14 particles)
    for (let d = 0; d < 14; d++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 1.2 + Math.random() * 3.4
      cinnabarDustRef.current.push({
        x: screenX + 22,
        y: screenY + 14,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 0.95,
        size: 1.2 + Math.random() * 2.2,
        color: Math.random() > 0.3 ? '#C23A2B' : '#E0533C',
      })
    }

    // 3. Update Hanko Manager & React State
    const updated = hankoManager.stampKanji(kanji)
    const nextAll = { ...hankoManager.getAll(), [kanji]: updated }
    hankoRecordsRef.current = nextAll
    setHankoRecords(nextAll)

    // 4. Celebratory water resonance ripple
    ripplesRef.current.push({
      x: screenX,
      y: screenY,
      radius: 8,
      maxRadius: 110,
      alpha: 0.65,
      speed: 3.2,
      asymmetrySeed: Math.random() * 10,
    })
  }, [])

  // Toggle Audio
  const handleToggleAudio = () => {
    const next = sumiAudio.toggleMute()
    setIsMuted(next)
    if (!next) {
      sumiAudio.playSuikinkutsu()
    }
  }

  // Handle Level Selection (Smooth Camera Glide)
  const handleLevelClick = (lvl: string) => {
    sumiAudio.initOnGesture()
    sumiAudio.playWindSwoosh()
    panRef.current.targetY = 0
    panRef.current.targetX = 0
    onSelectLevel(lvl)
  }

  // Zoom controls
  const handleZoomIn = () => {
    zoomRef.current.target = Math.min(2.0, zoomRef.current.target + 0.25)
  }
  const handleZoomOut = () => {
    zoomRef.current.target = Math.max(0.4, zoomRef.current.target - 0.25)
  }
  const handleZoomReset = () => {
    zoomRef.current.target = 1.0
    panRef.current.targetX = 0
    panRef.current.targetY = 0
  }

  // Window-wide Mouse Move for continuous, breathing 3D Parallax across the entire screen
  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      const nx = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2)
      const ny = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2)
      targetParallaxRef.current = {
        x: Math.max(-1, Math.min(1, nx)) * 36,
        y: Math.max(-1, Math.min(1, ny)) * 22,
      }
    }

    window.addEventListener('mousemove', handleWindowMouseMove, { passive: true })
    return () => window.removeEventListener('mousemove', handleWindowMouseMove)
  }, [])

  // Organic meander layout (Nagare 流れ) with 2.5D Parallax planes & Stagger timing
  const layoutParticles = useCallback(
    (width: number, viewportHeight: number) => {
      if (!items || items.length === 0) {
        particlesRef.current = []
        return
      }

      const now = performance.now()
      const centerX = width / 2
      const centerY = viewportHeight / 2
      const maxR = Math.hypot(width / 2, viewportHeight / 2) || 1

      // Staggered dissolve of old particles from center outward
      if (particlesRef.current.length > 0) {
        const panY = panRef.current.y
        const panX = panRef.current.x
        outgoingParticlesRef.current = particlesRef.current
          .filter((p) => {
            const screenY = p.y - panY
            return screenY >= -100 && screenY <= viewportHeight + 100
          })
          .slice(0, 60)
          .map((p, idx) => {
            const distCenter = Math.hypot(p.targetX - centerX, p.targetY - centerY)
            const outDelay = Math.min(180, (distCenter / maxR) * 140 + (idx % 6) * 8)
            return {
              item: p.item,
              x: p.x - panX,
              y: p.y - panY,
              scale: p.scale,
              baseFontSize: p.baseFontSize,
              baseAlpha: p.baseAlpha,
              dissolveStart: now + outDelay,
              dissolveDuration: 360,
            }
          })
      }

      const cols = width < 640 ? 4 : width < 960 ? 6 : 8
      const colWidth = width / cols
      const rowHeight = 112
      const startY = 64

      particlesRef.current = items.map((item, idx) => {
        const col = idx % cols
        const row = Math.floor(idx / cols)

        // Fluid organic waves & alternating river meander
        const waveX = Math.sin(row * 0.95 + col * 0.4) * 26 + ((idx % 3) - 1) * 14
        const waveY = Math.cos(col * 0.85 + row * 0.45) * 18 + (idx % 2 === 0 ? 8 : -8)

        const targetX = (col + 0.5) * colWidth + waveX
        const targetY = startY + (row + 0.5) * rowHeight + waveY

        // 3D Calligraphic Hierarchy & Parallax Depth Planes
        const isCore = idx % 5 === 0 || ['日', '一', '人', '大', '土', '心', '生', '木', '水'].includes(item.kanji)
        const isNuance = idx % 4 === 3

        const depthTier: 'deep' | 'mid' | 'fore' = isCore ? 'fore' : isNuance ? 'deep' : 'mid'
        const baseFontSize = isCore ? 46 : isNuance ? 28 : 36
        const depth = isCore ? 1.25 : isNuance ? 0.65 : 0.92
        const parallaxFactor = isCore ? 1.35 : isNuance ? -0.32 : 0.85
        const baseAlpha = isCore ? 1.0 : isNuance ? 0.55 : 0.82
        const baseRotation = Math.sin(idx * 1.7) * 0.05

        const initialX = targetX + (Math.random() * 20 - 10)
        const initialY = targetY + (Math.random() * 20 - 10)

        // Stagger entrance delay radiating from center outward
        const distFromCenter = Math.hypot(targetX - centerX, targetY - centerY)
        const staggerDelay = Math.min(420, 80 + (distFromCenter / maxR) * 250 + (idx % 10) * 15)

        return {
          item,
          x: initialX,
          y: initialY,
          targetX,
          targetY,
          vx: 0,
          vy: 0,
          dispX: 0,
          dispY: 0,
          rotation: baseRotation,
          baseRotation,
          targetRotation: baseRotation,
          scale: 0.35,
          targetScale: 1,
          baseFontSize,
          depth,
          depthTier,
          parallaxFactor,
          baseAlpha,
          phase: idx * 0.35 + Math.random() * 0.5,
          isHovered: false,
          hoverRatio: 0,
          proximityRatio: 0,
          semanticElement: getSemanticElement(item.kanji),
          row,
          birthTime: now + staggerDelay,
        }
      })
    },
    [items]
  )

  // Canvas size and resize handler - STRICT VIEWPORT BOUNDS (Maximum 740px height)
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const updateSize = () => {
      const rect = container.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      const width = rect.width
      const viewportHeight = Math.min(740, Math.max(520, window.innerHeight - 240))

      canvas.width = width * dpr
      canvas.height = viewportHeight * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${viewportHeight}px`

      const ctx = canvas.getContext('2d', { alpha: false })
      if (ctx) {
        ctx.scale(dpr, dpr)
      }

      layoutParticles(width, viewportHeight)
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [items, layoutParticles])

  // Native wheel scroll / zoom listener
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleWheel = (e: WheelEvent) => {
      // Zoom with ctrl key or trackpad pinch
      if (e.ctrlKey) {
        e.preventDefault()
        const zoom = zoomRef.current
        zoom.target = Math.max(0.35, Math.min(2.2, zoom.target - e.deltaY * 0.003))
        return
      }

      // Smooth 2D panning with wheel
      e.preventDefault()
      const pan = panRef.current
      pan.targetY = Math.max(0, pan.targetY + e.deltaY * 0.85)
      if (Math.abs(e.deltaX) > 0) {
        pan.targetX += e.deltaX * 0.85
      }
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      ;(window as unknown as Record<string, unknown>)['__findKanjiPos'] = (kanji: string) => {
        const p = particlesRef.current.find((item) => item.item.kanji === kanji)
        const canvas = canvasRef.current
        if (!p || !canvas) return null
        const rect = canvas.getBoundingClientRect()
        const cam = cameraParallaxRef.current
        const panX = panRef.current.x
        const panY = panRef.current.y
        const width = parseFloat(canvas.style.width) || canvas.width
        const height = parseFloat(canvas.style.height) || canvas.height
        const currentZoom = zoomRef.current.current
        const worldX = p.x + cam.x * p.parallaxFactor + p.dispX - panX
        const worldY = p.y - panY + cam.y * p.parallaxFactor + p.dispY
        const screenX = (worldX - width / 2) * currentZoom + width / 2
        const screenY = (worldY - height / 2) * currentZoom + height / 2
        return { x: rect.left + screenX, y: rect.top + screenY }
      }
    }
  }, [])

  // Animation Loop: 60FPS Render Engine with all 4 Zen Art Mechanisms
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return // Handles jsdom safely

    const render = (time: number) => {
      const width = parseFloat(canvas.style.width) || canvas.width
      const height = parseFloat(canvas.style.height) || canvas.height

      // 1. Smooth 2D Pan & Zoom LERP
      const pan = panRef.current
      pan.x += (pan.targetX - pan.x) * 0.12
      pan.y += (pan.targetY - pan.y) * 0.12
      const panX = pan.x
      const panY = pan.y

      const zoom = zoomRef.current
      zoom.current += (zoom.target - zoom.current) * 0.12
      const currentZoom = zoom.current

      // 2. Parallax Camera Shift based on continuous mouse tracking
      const targetCam = targetParallaxRef.current
      const cam = cameraParallaxRef.current
      cam.x += (targetCam.x - cam.x) * 0.05
      cam.y += (targetCam.y - cam.y) * 0.05

      // Deconstruction progress LERP (0 -> 1)
      const targetDeconstruct = deconstructionStage ? 1 : 0
      deconstructProgressRef.current += (targetDeconstruct - deconstructProgressRef.current) * 0.16
      const deconstructProgress = deconstructProgressRef.current

      // 3. Draw Washi Paper Background (Warm Ivory Tone #FAF8F5)
      ctx.fillStyle = '#FAF8F5'
      ctx.fillRect(0, 0, width, height)

      // Ambient mist gradient with camera tilt
      const grad = ctx.createLinearGradient(cam.x * 2.2, 0, cam.x * -2.2, height)
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.90)')
      grad.addColorStop(0.5, 'rgba(250, 248, 245, 0.5)')
      grad.addColorStop(1, 'rgba(238, 233, 222, 0.70)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, width, height)

      // 4. Render Organic Asymmetric Water Ripples
      const ripples = ripplesRef.current
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rip = ripples[i]
        if (!rip) continue

        rip.radius += rip.speed
        rip.alpha *= 0.945

        if (rip.alpha <= 0.01 || rip.radius >= rip.maxRadius) {
          ripples.splice(i, 1)
          continue
        }

        ctx.save()
        ctx.beginPath()
        const segments = 28
        for (let s = 0; s <= segments; s++) {
          const theta = (s / segments) * Math.PI * 2
          const perturb =
            Math.sin(theta * 3 + rip.asymmetrySeed) * 0.05 +
            Math.cos(theta * 5 + rip.asymmetrySeed * 1.5) * 0.025
          const r = rip.radius * (1 + perturb)
          const px = rip.x + Math.cos(theta) * r
          const py = rip.y + Math.sin(theta) * r
          if (s === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.closePath()
        ctx.strokeStyle = `rgba(165, 145, 125, ${rip.alpha * 0.75})`
        ctx.lineWidth = 1.3
        ctx.stroke()
        ctx.restore()
      }

      // 5. Render Outgoing Dissolving Kanji Particles (Staggered Ink Dissolve)
      const outgoing = outgoingParticlesRef.current
      if (outgoing.length > 0) {
        let hasActiveOutgoing = false
        for (let i = 0; i < outgoing.length; i++) {
          const op = outgoing[i]
          if (!op) continue
          const elapsed = time - op.dissolveStart
          if (elapsed < 0) {
            hasActiveOutgoing = true
            ctx.save()
            ctx.translate(op.x, op.y)
            ctx.scale(op.scale, op.scale)
            ctx.font = op.baseFontSize >= 46 ? FONT_CORE : op.baseFontSize <= 28 ? FONT_NUANCE : FONT_MEDIUM
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillStyle = `rgba(38, 34, 32, ${op.baseAlpha * 0.7})`
            ctx.fillText(op.item.kanji, 0, -4)
            ctx.restore()
            continue
          }

          const progress = Math.min(1, elapsed / op.dissolveDuration)
          if (progress >= 1) continue
          hasActiveOutgoing = true

          const fadeAlpha = (1 - progress) * op.baseAlpha * 0.7
          op.y -= 0.45
          op.scale += 0.002

          ctx.save()
          ctx.translate(op.x, op.y)
          ctx.scale(op.scale, op.scale)
          ctx.font = op.baseFontSize >= 46 ? FONT_CORE : op.baseFontSize <= 28 ? FONT_NUANCE : FONT_MEDIUM
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = `rgba(38, 34, 32, ${fadeAlpha})`
          ctx.fillText(op.item.kanji, 0, -4)
          ctx.restore()
        }
        if (!hasActiveOutgoing) {
          outgoingParticlesRef.current = []
        }
      }

      // 6. Viewport Frustum Culling & Rendering of Active Kanji
      const particles = particlesRef.current
      const mouse = mouseRef.current
      let newHoveredIndex: number | null = null

      const rowHeight = 112
      const minVisibleRow = Math.max(0, Math.floor((panY - 140) / rowHeight))
      const maxVisibleRow = Math.ceil((panY + height / currentZoom + 140) / rowHeight)

      // Active Hovered Particle for Radical Constellation Network (supports graceful smoke decay)
      let activeHoveredParticle =
        hoveredIndexRef.current !== null ? particles[hoveredIndexRef.current] : null
      if (!activeHoveredParticle) {
        const decaying = particles.find((p) => p.hoverRatio > 0.05)
        if (decaying) {
          activeHoveredParticle = decaying
        }
      }

      // Academic & Etymological Kanji Constellation Links (Mạng lưới quan hệ Hán tự chuẩn mực)
      let activeMeaningfulLinks: { index: number; link: KanjiLinkResult }[] = []
      const relatedIndices: number[] = []

      if (activeHoveredParticle && activeHoveredParticle.hoverRatio > 0.05) {
        const sourceKanji = activeHoveredParticle.item.kanji
        const candidates = particles.map((p, idx) => ({ kanji: p.item.kanji, index: idx }))
        activeMeaningfulLinks = getMeaningfulLinksForKanji(sourceKanji, candidates, 4)
        for (const item of activeMeaningfulLinks) {
          relatedIndices.push(item.index)
        }
      }

      for (let idx = 0; idx < particles.length; idx++) {
        const p = particles[idx]
        if (!p) continue

        // Fast frustum row culling (keep connected partners so they can be magnetically pulled into view)
        const isConstellationPartner = relatedIndices.includes(idx)
        if (!isConstellationPartner && (p.row < minVisibleRow || p.row > maxVisibleRow)) {
          continue
        }

        // Stagger Entrance Animation Check
        const birthElapsed = time - p.birthTime
        if (birthElapsed < 0) {
          continue
        }
        const enterProgress = Math.min(1, birthElapsed / 380)
        const enterEase = 1 - Math.pow(1 - enterProgress, 3)
        const entranceScale = 0.40 + 0.60 * enterEase
        const entranceAlpha = enterEase

        // Living Environmental Water Drift
        const driftX = Math.sin(time * 0.0013 + p.phase) * (4.8 * p.depth)
        const driftY = Math.cos(time * 0.0010 + p.phase * 1.3) * (3.8 * p.depth)

        // 3D Parallax offset based on depth tier
        const parallaxX = cam.x * p.parallaxFactor
        const parallaxY = cam.y * p.parallaxFactor

        // Water Wave Displacement (Refraction wave effect)
        for (let rIdx = 0; rIdx < ripples.length; rIdx++) {
          const rip = ripples[rIdx]
          if (!rip) continue
          const rdx = p.x + parallaxX - rip.x
          const rdy = p.y - panY + parallaxY - rip.y
          const distToWave = Math.hypot(rdx, rdy)
          const waveWidth = 42
          const waveDiff = distToWave - rip.radius

          if (Math.abs(waveDiff) < waveWidth) {
            const norm = waveDiff / waveWidth
            const dispPulse = Math.sin(norm * Math.PI) * rip.alpha * 7.5
            const angle = Math.atan2(rdy, rdx)
            p.dispX += Math.cos(angle) * dispPulse
            p.dispY += Math.sin(angle) * dispPulse
          }
        }
        p.dispX *= 0.82
        p.dispY *= 0.82

        // Screen coordinate with true multi-layer 3D Parallax + Living Drift + 2D Zoom
        const worldX = p.x + parallaxX + p.dispX - panX
        const worldY = p.y - panY + parallaxY + p.dispY
        const screenX = (worldX - width / 2) * currentZoom + width / 2
        const screenY = (worldY - height / 2) * currentZoom + height / 2

        // Spatial mouse interaction
        let isHover = false
        const dx = screenX - mouse.x
        const dy = screenY - mouse.y
        const mouseDist = mouse.active ? Math.hypot(dx, dy) : 9999

        if (mouse.active && !pointerDragRef.current.isDragging && deconstructProgress < 0.2) {
          if (Math.abs(dx) <= 46 * currentZoom && dy >= -46 * currentZoom && dy <= 54 * currentZoom) {
            isHover = true
            newHoveredIndex = idx
          }
        }

        p.isHovered = isHover

        // ─── SHU-IRO SMOKE DECAY CURVES ─────────────────────────────────────────
        const targetHover = isHover ? 1 : 0
        const hoverSpeed = isHover ? 0.24 : 0.045
        p.hoverRatio += (targetHover - p.hoverRatio) * hoverSpeed

        const targetProx = mouse.active && mouseDist < 160 ? Math.pow(1 - mouseDist / 160, 1.4) : 0
        const proxSpeed = targetProx > p.proximityRatio ? 0.20 : 0.05
        p.proximityRatio += (targetProx - p.proximityRatio) * proxSpeed

        p.targetScale = (1 + 0.32 * p.hoverRatio) * currentZoom
        p.targetRotation = isHover ? 0 : p.baseRotation

        // ─── MAGNETIC GRAVITATIONAL PULL FOR CONNECTED KANJI ─────────────
        // Kéo các Hán tự có liên kết học thuật tiến lại gần chữ đang được trỏ chuột
        let pullX = 0
        let pullY = 0
        const partnerLinkIndex = activeMeaningfulLinks.findIndex((m) => m.index === idx)
        const isPartner = Boolean(
          activeHoveredParticle &&
          p !== activeHoveredParticle &&
          partnerLinkIndex !== -1 &&
          activeHoveredParticle.hoverRatio > 0.04
        )

        if (isPartner && activeHoveredParticle) {
          const numLinks = activeMeaningfulLinks.length
          // Determine angular spread offset around source to fan out partners cleanly
          let angleOffset = 0
          if (numLinks === 1) {
            angleOffset = 0
          } else if (numLinks === 2) {
            angleOffset = (partnerLinkIndex === 0 ? -1 : 1) * 0.46
          } else if (numLinks === 3) {
            angleOffset = (partnerLinkIndex - 1) * 0.50
          } else if (numLinks >= 4) {
            // Wide graceful fan spread (~96° arc) so kanji glyphs and subtitles never crowd
            angleOffset = (partnerLinkIndex - 1.5) * 0.56
          }

          // Initial angle from source's center to target's resting home
          const rawAngle = Math.atan2(p.targetY - activeHoveredParticle.y, p.targetX - activeHoveredParticle.x)

          // Determine best open hemisphere for the constellation fan
          let fanCenter = rawAngle
          // If source is close to the top boundary (< 220px), always fan downwards towards the canvas center!
          if (activeHoveredParticle.y - panY < 220) {
            fanCenter = Math.PI / 2 // Downwards
          } else if (activeHoveredParticle.y - panY > height - 220) {
            fanCenter = -Math.PI / 2 // Upwards
          }

          const orbitAngle = fanCenter + angleOffset

          // Orbital shell radius: staggered between 180px and 225px
          // Staggering creates wide breathing room so adjacent kanji nodes never touch
          const orbitRadius = partnerLinkIndex % 2 === 0 ? 180 : 225

          // Destination coordinates in the immediate orbital vicinity of the hovered Kanji
          const destX = activeHoveredParticle.x + Math.cos(orbitAngle) * orbitRadius
          const destY = activeHoveredParticle.y + Math.sin(orbitAngle) * orbitRadius

          // Vector from target's resting home to destination
          const pullVectorX = destX - p.targetX
          const pullVectorY = destY - p.targetY

          const pullRatio = Math.min(1.0, activeHoveredParticle.hoverRatio * 1.15)
          pullX = pullVectorX * pullRatio
          pullY = pullVectorY * pullRatio
        }

        // Damped Spring towards target + magnetic pull + living drift
        const targetX = p.targetX + pullX + (isHover ? 0 : driftX)
        const targetY = p.targetY + pullY + (isHover ? 0 : driftY)
        const springK = isHover ? 0.22 : isPartner ? 0.18 : 0.05
        const damping = isHover ? 0.55 : isPartner ? 0.70 : 0.88
        const ax = (targetX - p.x) * springK
        const ay = (targetY - p.y) * springK

        p.vx = (p.vx + ax) * damping
        p.vy = (p.vy + ay) * damping
        p.x += p.vx
        p.y += p.vy

        p.scale += (p.targetScale - p.scale) * 0.18
        p.rotation += (p.targetRotation - p.rotation) * 0.16

        // ─── CONSTELLATION DIMMING (Dim unrelated kanji during radical constellation) ─
        const isRelated =
          activeHoveredParticle &&
          (p === activeHoveredParticle || relatedIndices.includes(idx))
        const constellationDim =
          activeHoveredParticle && !isRelated
            ? 1 - activeHoveredParticle.hoverRatio * 0.82
            : 1.0

        // If Zen Deconstruction Stage is active, dim background kanji
        const zenStageDim = 1 - deconstructProgress * 0.92

        // Draw Entity at screen position
        ctx.save()
        ctx.translate(screenX, screenY)
        ctx.rotate(p.rotation)
        ctx.scale(p.scale * entranceScale, p.scale * entranceScale)

        // ─── 1. SHU-IRO INK GLOW AURA ───────────────────────────────────────────
        if (p.hoverRatio > 0.01) {
          const h = p.hoverRatio
          ctx.save()
          const innerAura = ctx.createRadialGradient(0, 0, 4, 0, 0, 38 * h)
          innerAura.addColorStop(0, `rgba(28, 25, 23, ${0.22 * h})`)
          innerAura.addColorStop(0.6, `rgba(38, 32, 28, ${0.10 * h})`)
          innerAura.addColorStop(1, 'rgba(250, 248, 245, 0)')
          ctx.fillStyle = innerAura
          ctx.beginPath()
          ctx.arc(0, 0, 38 * h, 0, Math.PI * 2)
          ctx.fill()

          const outerAura = ctx.createRadialGradient(0, 0, 16, 0, 0, 72 * h)
          outerAura.addColorStop(0, `rgba(194, 58, 43, ${0.14 * h})`)
          outerAura.addColorStop(0.65, `rgba(194, 58, 43, ${0.05 * h})`)
          outerAura.addColorStop(1, 'rgba(250, 248, 245, 0)')
          ctx.fillStyle = outerAura
          ctx.beginPath()
          ctx.arc(0, 0, 72 * h, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()

          // Cinnabar Shu-iro seal dot
          ctx.beginPath()
          ctx.arc(0, -p.baseFontSize * 0.65, 2.5 * h, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(194, 58, 43, ${h})`
          ctx.fill()
        }

        // Subtle partner resonance aura for linked constellation stars
        const partnerLink = activeMeaningfulLinks.find((m) => m.index === idx)
        if (
          partnerLink &&
          activeHoveredParticle &&
          p !== activeHoveredParticle &&
          activeHoveredParticle.hoverRatio > 0.08
        ) {
          ctx.save()
          const pAura = ctx.createRadialGradient(0, 0, 4, 0, 0, 42)
          pAura.addColorStop(0, `${partnerLink.link.color}35`)
          pAura.addColorStop(0.65, `${partnerLink.link.color}12`)
          pAura.addColorStop(1, 'rgba(250, 248, 245, 0)')
          ctx.fillStyle = pAura
          ctx.beginPath()
          ctx.arc(0, 0, 42, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }

        // ─── 2. SEMANTIC MICRO-PHYSICS (Nguyên tố tượng hình) ───────────────────
        if (p.hoverRatio > 0.05) {
          const hr = p.hoverRatio
          if (p.semanticElement === 'rain') {
            // Mưa (Raindrops falling downwards)
            ctx.save()
            ctx.strokeStyle = `rgba(87, 83, 78, ${0.45 * hr})`
            ctx.lineWidth = 1.2
            for (let r = 0; r < 5; r++) {
              const rx = (r - 2) * 12
              const ry = 20 + ((time * 0.12 + r * 15) % 36)
              ctx.beginPath()
              ctx.moveTo(rx, ry)
              ctx.lineTo(rx, ry + 8)
              ctx.stroke()
            }
            ctx.restore()
          } else if (p.semanticElement === 'fire') {
            // Lửa (Fiery embers drifting upwards)
            ctx.save()
            for (let f = 0; f < 5; f++) {
              const fx = Math.sin(time * 0.008 + f) * 16
              const fy = -18 - ((time * 0.09 + f * 14) % 38)
              ctx.beginPath()
              ctx.arc(fx, fy, 1.8 * hr, 0, Math.PI * 2)
              ctx.fillStyle = f % 2 === 0 ? '#C23A2B' : '#D97706'
              ctx.fill()
            }
            ctx.restore()
          } else if (p.semanticElement === 'wind') {
            // Gió (Swirling vortex arc)
            ctx.save()
            ctx.beginPath()
            const wAngle = time * 0.006
            ctx.arc(0, 0, 48 * hr, wAngle, wAngle + 1.2)
            ctx.strokeStyle = `rgba(120, 110, 100, ${0.4 * hr})`
            ctx.lineWidth = 1.5
            ctx.stroke()
            ctx.restore()
          } else if (p.semanticElement === 'wood') {
            // Mộc (Delicate sprout curls branching out)
            ctx.save()
            ctx.strokeStyle = `rgba(45, 80, 50, ${0.5 * hr})`
            ctx.lineWidth = 1.3
            ctx.beginPath()
            ctx.moveTo(-18, 0)
            ctx.quadraticCurveTo(-30, -12 * hr, -24, -22 * hr)
            ctx.moveTo(18, 0)
            ctx.quadraticCurveTo(30, -12 * hr, 24, -22 * hr)
            ctx.stroke()
            ctx.restore()
          } else if (p.semanticElement === 'celestial') {
            // Nhật Nguyệt (Solar/lunar radiant halo corona)
            ctx.save()
            ctx.strokeStyle = `rgba(217, 119, 6, ${0.25 * hr})`
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.arc(0, 0, (52 + Math.sin(time * 0.005) * 8) * hr, 0, Math.PI * 2)
            ctx.stroke()
            ctx.restore()
          }
        }

        // 3. Primary Calligraphic Kanji
        ctx.font = p.baseFontSize >= 46 ? FONT_CORE : p.baseFontSize <= 28 ? FONT_NUANCE : FONT_MEDIUM
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        const baseAlpha = isHover ? 1.0 : p.baseAlpha

        // ─── HANKO SRS FILTER DIMMING ("Chờ nạp mực" mode) ────────────────────
        const isFilterActive = hankoFilterActiveRef.current
        const hRecord = hankoRecordsRef.current[p.item.kanji]
        const isDueForReview = hRecord && (hRecord.inkState === 'dry_due' || hRecord.inkState === 'ash_decay')
        const hankoFilterDim = isFilterActive ? (isDueForReview || isHover ? 1.0 : 0.07) : 1.0

        // Soft cinnabar breathing aura for due kanji during "Chờ nạp mực" mode
        if (isFilterActive && isDueForReview) {
          ctx.save()
          const dueAura = ctx.createRadialGradient(0, 0, 8, 0, 0, 56)
          const pulse = 0.5 + 0.5 * Math.sin(time * 0.003)
          dueAura.addColorStop(0, `rgba(194, 58, 43, ${0.22 * pulse})`)
          dueAura.addColorStop(0.7, `rgba(194, 58, 43, ${0.08 * pulse})`)
          dueAura.addColorStop(1, 'rgba(250, 248, 245, 0)')
          ctx.fillStyle = dueAura
          ctx.beginPath()
          ctx.arc(0, 0, 56, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }

        const inkAlpha = baseAlpha * entranceAlpha * constellationDim * zenStageDim * hankoFilterDim
        ctx.fillStyle = isHover
          ? '#0f0e0d'
          : p.depthTier === 'fore'
            ? `rgba(15, 14, 13, ${inkAlpha})`
            : p.depthTier === 'deep'
              ? `rgba(95, 90, 85, ${inkAlpha})`
              : `rgba(40, 35, 33, ${inkAlpha})`
        ctx.fillText(p.item.kanji, 0, -4)

        // ─── 4. TRADITIONAL HANKO SEAL (Dấu ấn triện SRS theo cấp & độ phai mực) ──
        if (hRecord && zenStageDim > 0.3) {
          if (!isFilterActive || isDueForReview || isHover) {
            const sealX = p.baseFontSize * 0.44 + 6
            const sealY = p.baseFontSize * 0.26
            const sealScale = (0.90 + 0.15 * p.hoverRatio) * (isFilterActive && isDueForReview ? 1.25 : 1.0)
            drawHankoSeal(ctx, hRecord, sealX, sealY, time, sealScale)
          }
        }

        // 5. Progressive Disclosure Subtitles (revealed under lantern proximity or when pulled into partner orbit)
        const partnerAlpha = isPartner && activeHoveredParticle ? activeHoveredParticle.hoverRatio * 0.92 : 0
        const effectiveSubtitleAlpha = Math.max(p.proximityRatio, p.hoverRatio, partnerAlpha)
        if (effectiveSubtitleAlpha > 0.02 && zenStageDim > 0.5) {
          const textAlpha = effectiveSubtitleAlpha * entranceAlpha * constellationDim * zenStageDim

          ctx.font = FONT_HANZI
          ctx.fillStyle = `rgba(194, 58, 43, ${textAlpha * 0.95})`
          ctx.fillText(p.item.hanzi.toUpperCase(), 0, p.baseFontSize * 0.52 + 5)

          ctx.font = FONT_MEANING
          ctx.fillStyle = `rgba(110, 100, 90, ${textAlpha * 0.88})`
          const meaning = p.item.meaning_vi.length > 13 ? `${p.item.meaning_vi.slice(0, 12)}…` : p.item.meaning_vi
          ctx.fillText(meaning, 0, p.baseFontSize * 0.52 + 19)
        }

        ctx.restore()
      }

      // ─── 6. DRAW ACADEMIC CONSTELLATION NETWORK THREADS & RELATIONSHIP BADGE PILLS ──
      if (
        activeHoveredParticle &&
        activeMeaningfulLinks.length > 0 &&
        activeHoveredParticle.hoverRatio > 0.08 &&
        deconstructProgress < 0.2
      ) {
        const hr = activeHoveredParticle.hoverRatio
        const hScreenX =
          (activeHoveredParticle.x + cam.x * activeHoveredParticle.parallaxFactor + activeHoveredParticle.dispX - panX - width / 2) * currentZoom + width / 2
        const hScreenY =
          (activeHoveredParticle.y - panY + cam.y * activeHoveredParticle.parallaxFactor + activeHoveredParticle.dispY - height / 2) * currentZoom + height / 2

        const numLinks = activeMeaningfulLinks.length

        interface LinkGeom {
          linkIdx: number
          item: (typeof activeMeaningfulLinks)[0]
          tScreenX: number
          tScreenY: number
          ctrlX: number
          ctrlY: number
          initX: number
          initY: number
          badgeW: number
          badgeH: number
          label: string
        }

        ctx.font = '600 10.5px "Noto Sans", sans-serif'
        const geoms: LinkGeom[] = []

        for (let linkIdx = 0; linkIdx < numLinks; linkIdx++) {
          const item = activeMeaningfulLinks[linkIdx]
          if (!item) continue
          const targetP = particles[item.index]
          if (!targetP) continue

          const tScreenX =
            (targetP.x + cam.x * targetP.parallaxFactor + targetP.dispX - panX - width / 2) * currentZoom + width / 2
          const tScreenY =
            (targetP.y - panY + cam.y * targetP.parallaxFactor + targetP.dispY - height / 2) * currentZoom + height / 2

          // Arc physics: perpendicular curvature outward from the fan center
          const dx = tScreenX - hScreenX
          const dy = tScreenY - hScreenY
          const dist = Math.hypot(dx, dy)
          const normDx = dist > 0 ? dx / dist : 0
          const normDy = dist > 0 ? dy / dist : 1
          const perpX = -normDy
          const perpY = normDx

          // Alternate bowing direction gently
          const bowSign = numLinks === 2 ? (linkIdx === 0 ? -1 : 1) : (linkIdx % 2 === 0 ? -1 : 1)
          const bowMag = Math.min(26, Math.max(10, 12 + (linkIdx % 2) * 10))
          const ctrlX = (hScreenX + tScreenX) / 2 + perpX * bowSign * bowMag
          const ctrlY = (hScreenY + tScreenY) / 2 + perpY * bowSign * bowMag

          // Stagger placement fraction t along the curve:
          // For 4 links:
          // Link 0 (outer left): t = 0.50
          // Link 1 (inner left, deep): t = 0.72 (lower tier, close to target 1)
          // Link 2 (inner right, shallow): t = 0.40 (upper tier, closer to source)
          // Link 3 (outer right, deep): t = 0.58 (mid-lower tier)
          let tPill = 0.50
          if (numLinks === 2) {
            tPill = linkIdx === 0 ? 0.44 : 0.58
          } else if (numLinks === 3) {
            tPill = linkIdx === 0 ? 0.46 : linkIdx === 1 ? 0.68 : 0.44
          } else if (numLinks >= 4) {
            const tMap = [0.50, 0.72, 0.40, 0.58]
            tPill = tMap[linkIdx] ?? 0.50
          }

          const oneMinusT = 1 - tPill
          const curveMidX = oneMinusT * oneMinusT * hScreenX + 2 * oneMinusT * tPill * ctrlX + tPill * tPill * tScreenX
          const curveMidY = oneMinusT * oneMinusT * hScreenY + 2 * oneMinusT * tPill * ctrlY + tPill * tPill * tScreenY

          const label = item.link.badgeLabel
          const textMetrics = ctx.measureText(label)
          const badgeW = Math.ceil(textMetrics.width + 16)
          const badgeH = 20

          geoms.push({
            linkIdx,
            item,
            tScreenX,
            tScreenY,
            ctrlX,
            ctrlY,
            initX: curveMidX,
            initY: curveMidY,
            badgeW,
            badgeH,
            label,
          })
        }

        // 1. Draw Connecting Threads first
        for (const geom of geoms) {
          ctx.save()
          ctx.beginPath()
          ctx.moveTo(hScreenX, hScreenY)
          ctx.quadraticCurveTo(geom.ctrlX, geom.ctrlY, geom.tScreenX, geom.tScreenY)

          if (geom.item.link.relationType === 'constituent') {
            ctx.strokeStyle = `rgba(194, 58, 43, ${0.55 * hr})`
            ctx.lineWidth = 1.8
            ctx.setLineDash([6, 4])
          } else if (geom.item.link.relationType === 'phonetic_family') {
            ctx.strokeStyle = `rgba(217, 119, 6, ${0.58 * hr})`
            ctx.lineWidth = 1.8
            ctx.setLineDash([8, 3])
          } else if (geom.item.link.relationType === 'antonym') {
            ctx.strokeStyle = `rgba(79, 70, 229, ${0.60 * hr})`
            ctx.lineWidth = 2.0
            ctx.setLineDash([3, 3])
          } else {
            ctx.strokeStyle = `rgba(2, 132, 199, ${0.52 * hr})`
            ctx.lineWidth = 1.6
            ctx.setLineDash([7, 4])
          }
          ctx.lineDashOffset = -time * 0.022
          ctx.stroke()
          ctx.restore()
        }

        // 2. Anti-Collision Bounding Box Relaxation Solver for Badge Pills
        interface ResolvedBadge {
          x: number
          y: number
          w: number
          h: number
          geom: LinkGeom
        }

        const boxes: ResolvedBadge[] = geoms.map((g) => ({
          x: g.initX,
          y: g.initY,
          w: g.badgeW,
          h: g.badgeH,
          geom: g,
        }))

        // Step A: Push badges outside of source kanji exclusion zone (Kanji + Han-Viet + Meaning subtitle)
        const sourceMinY = hScreenY - 35
        const sourceMaxY = hScreenY + 54
        const sourceHalfW = 60

        for (const b of boxes) {
          if (
            Math.abs(b.x - hScreenX) < (b.w / 2 + sourceHalfW) &&
            b.y > sourceMinY &&
            b.y < sourceMaxY + b.h / 2
          ) {
            b.y = sourceMaxY + b.h / 2 + 6
          }
        }

        // Step B: Push badges outside of target kanji bounding boxes
        for (const b of boxes) {
          for (const g of geoms) {
            const targetMinY = g.tScreenY - 32
            const targetMaxY = g.tScreenY + 50
            const targetHalfW = 46
            if (
              Math.abs(b.x - g.tScreenX) < (b.w / 2 + targetHalfW) &&
              b.y > targetMinY - b.h / 2 &&
              b.y < targetMaxY + b.h / 2
            ) {
              b.y = targetMinY - b.h / 2 - 8
            }
          }
        }

        // Step C: Iterative Badge-vs-Badge Overlap Elimination
        const GAP_X = 14
        const GAP_Y = 8
        for (let iter = 0; iter < 12; iter++) {
          let hasOverlap = false
          for (let i = 0; i < boxes.length; i++) {
            for (let j = i + 1; j < boxes.length; j++) {
              const b1 = boxes[i]
              const b2 = boxes[j]
              if (!b1 || !b2) continue
              const overlapX = (b1.w / 2 + b2.w / 2 + GAP_X) - Math.abs(b1.x - b2.x)
              const overlapY = (b1.h / 2 + b2.h / 2 + GAP_Y) - Math.abs(b1.y - b2.y)
              if (overlapX > 0 && overlapY > 0) {
                hasOverlap = true
                if (overlapY <= overlapX) {
                  const shift = (overlapY / 2) + 1
                  if (b1.y < b2.y) {
                    b1.y -= shift
                    b2.y += shift
                  } else {
                    b1.y += shift
                    b2.y += shift
                  }
                } else {
                  const shift = (overlapX / 2) + 1
                  if (b1.x < b2.x) {
                    b1.x -= shift
                    b2.x += shift
                  } else {
                    b1.x += shift
                    b2.x += shift
                  }
                }
              }
            }
          }
          if (!hasOverlap) break
        }

        // 3. Render Resolved Non-Overlapping Badge Pills
        for (const b of boxes) {
          const geom = b.geom
          const badgeX = b.x - b.w / 2
          const badgeY = b.y - b.h / 2

          ctx.save()
          ctx.font = '600 10.5px "Noto Sans", sans-serif'

          // Subtle washi drop shadow
          ctx.shadowColor = 'rgba(40, 30, 20, 0.12)'
          ctx.shadowBlur = 5
          ctx.shadowOffsetY = 1.2

          // Background pill
          ctx.fillStyle = '#FAF7F2'
          ctx.strokeStyle = geom.item.link.color
          ctx.lineWidth = 1.1

          ctx.beginPath()
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(badgeX, badgeY, b.w, b.h, 10)
          } else {
            ctx.rect(badgeX, badgeY, b.w, b.h)
          }
          ctx.fill()
          ctx.stroke()

          // Label text
          ctx.shadowColor = 'transparent'
          ctx.fillStyle = geom.item.link.color
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(geom.label, b.x, b.y + 0.5)
          ctx.restore()
        }
      }

      // ─── 7. HOLD-TO-STAMP GESTURE CHARGING AURA & HANKO PREVIEW ───────────────
      const hold = holdPressRef.current
      if (hold.isHolding && hold.targetIndex !== null && deconstructProgress < 0.2) {
        const holdParticle = particles[hold.targetIndex]
        if (holdParticle) {
          const elapsed = time - hold.startTime
          const chargeProgress = Math.min(1.0, elapsed / 500)

          const hpParallaxX = cam.x * holdParticle.parallaxFactor
          const hpParallaxY = cam.y * holdParticle.parallaxFactor
          const hpWorldX = holdParticle.x + hpParallaxX + holdParticle.dispX - panX
          const hpWorldY = holdParticle.y - panY + hpParallaxY + holdParticle.dispY
          const hpScreenX = (hpWorldX - width / 2) * currentZoom + width / 2
          const hpScreenY = (hpWorldY - height / 2) * currentZoom + height / 2

          ctx.save()
          ctx.translate(hpScreenX, hpScreenY)

          // Shrinking/charging cinnabar ring
          const chargeRadius = (38 - 12 * chargeProgress) * currentZoom
          ctx.beginPath()
          ctx.arc(0, 0, Math.max(10, chargeRadius), 0, Math.PI * 2 * chargeProgress)
          ctx.strokeStyle = `rgba(194, 58, 43, ${0.55 + 0.45 * chargeProgress})`
          ctx.lineWidth = 2.4 * currentZoom
          ctx.stroke()

          // Descending Hanko seal block shadow
          const dropHeight = (1 - chargeProgress) * 22
          ctx.save()
          ctx.translate(22, 14 - dropHeight)
          ctx.fillStyle = `rgba(194, 58, 43, ${0.4 + 0.6 * chargeProgress})`
          ctx.strokeStyle = '#FAF8F5'
          ctx.lineWidth = 1.2
          ctx.strokeRect(-11, -11, 22, 22)
          ctx.fillRect(-11, -11, 22, 22)
          ctx.font = '700 11px "Noto Serif JP", serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = '#FAF8F5'
          ctx.fillText('印', 0, 0)
          ctx.restore()

          ctx.restore()

          // Trigger stamping upon completing 500ms
          if (elapsed >= 500 && !hold.completed) {
            hold.completed = true
            executeStampAction(holdParticle.item.kanji, hpScreenX, hpScreenY)
          }
        }
      }

      // ─── 8. CINNABAR DUST SPLASH PARTICLES ────────────────────────────────────
      const dust = cinnabarDustRef.current
      for (let i = dust.length - 1; i >= 0; i--) {
        const dp = dust[i]
        if (!dp) continue
        dp.x += dp.vx
        dp.y += dp.vy
        dp.vx *= 0.91
        dp.vy *= 0.91
        dp.alpha *= 0.92
        if (dp.alpha <= 0.02) {
          dust.splice(i, 1)
          continue
        }
        ctx.save()
        ctx.beginPath()
        ctx.arc(dp.x, dp.y, dp.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(194, 58, 43, ${dp.alpha})`
        ctx.fill()
        ctx.restore()
      }

      // ─── 7. DECONSTRUCTION STAGE OVERLAY (Sân khấu rã bộ thủ) ─────────────────
      if (deconstructProgress > 0.01 && deconstructionStage) {
        const prog = deconstructProgress
        // Meditative dark ink wash background
        ctx.fillStyle = `rgba(20, 18, 16, ${0.78 * prog})`
        ctx.fillRect(0, 0, width, height)

        const centerX = width / 2
        const centerY = height / 2 - 35
        const info = deconstructionStage.info

        // 1. Central Halo
        const glow = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, 180 * prog)
        glow.addColorStop(0, 'rgba(250, 248, 245, 0.12)')
        glow.addColorStop(0.5, 'rgba(194, 58, 43, 0.08)')
        glow.addColorStop(1, 'rgba(20, 18, 16, 0)')
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(centerX, centerY, 180 * prog, 0, Math.PI * 2)
        ctx.fill()

        // 2. Render Exploded Constituent Radicals/Components
        info.parts.forEach((part) => {
          const partX = centerX + part.offsetX * prog
          const partY = centerY + part.offsetY * prog

          // Ethereal connection thread back to center
          ctx.save()
          ctx.beginPath()
          ctx.moveTo(centerX, centerY)
          ctx.lineTo(partX, partY)
          ctx.strokeStyle = `rgba(194, 58, 43, ${0.35 * prog})`
          ctx.lineWidth = 1.4
          ctx.setLineDash([4, 4])
          ctx.stroke()
          ctx.restore()

          // Component Glyph
          ctx.save()
          ctx.translate(partX, partY)
          ctx.font = `600 52px "Noto Serif JP", serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = part.role === 'radical' ? '#C23A2B' : '#FAF8F5'
          ctx.fillText(part.glyph, 0, 0)

          // Component Tag & Meaning
          ctx.font = '700 12px system-ui, sans-serif'
          ctx.fillStyle = '#C23A2B'
          ctx.fillText(part.name.toUpperCase(), 0, 42)

          ctx.font = '500 11px system-ui, sans-serif'
          ctx.fillStyle = 'rgba(214, 211, 209, 0.9)'
          ctx.fillText(part.meaning, 0, 58)
          ctx.restore()
        })

        // 3. Poetic Mnemonic Scroll Inscription (Bottom)
        ctx.save()
        ctx.textAlign = 'center'
        ctx.font = '700 24px "Noto Serif JP", serif'
        ctx.fillStyle = '#FAF8F5'
        ctx.fillText(`${info.kanji} • ${info.hanzi}`, centerX, height - 120)

        // Draw Current Hanko Seal in Deconstruction Stage
        const stageHanko = hankoRecordsRef.current[info.kanji]
        if (stageHanko) {
          drawHankoSeal(ctx, stageHanko, centerX + 115, height - 120, time, 1.35)
          ctx.save()
          ctx.font = '600 11.5px system-ui, sans-serif'
          ctx.textAlign = 'left'
          const tierLabel =
            stageHanko.tier === 'tier4_master'
              ? 'Bảo triện'
              : stageHanko.tier === 'tier3_established'
                ? 'Thành ấn'
                : stageHanko.tier === 'tier2_square'
                  ? 'Phương ấn'
                  : 'Sơ triện'
          const stateLabel =
            stageHanko.inkState === 'fresh'
              ? 'Mực tươi'
              : stageHanko.inkState === 'soaked'
                ? 'Mực thấm'
                : stageHanko.inkState === 'dry_due'
                  ? 'Khô kiệt (Kasure)'
                  : 'Hóa tro'
          ctx.fillStyle =
            stageHanko.inkState === 'fresh'
              ? '#C23A2B'
              : stageHanko.inkState === 'dry_due'
                ? '#E0533C'
                : '#A8A29E'
          ctx.fillText(`${tierLabel} • ${stageHanko.intervalDays}d (${stateLabel})`, centerX + 140, height - 116)
          ctx.restore()
        }

        ctx.font = 'italic 14px "Noto Serif JP", serif'
        ctx.fillStyle = 'rgba(230, 225, 218, 0.88)'
        ctx.fillText(`“${info.story}”`, centerX, height - 90)

        // Close instruction tip
        ctx.font = '600 11px system-ui, sans-serif'
        ctx.fillStyle = 'rgba(168, 162, 158, 0.75)'
        ctx.fillText('Nhấp vào vùng trống để ghép các bộ thủ trở lại • Hoặc bấm Xem chi tiết bên dưới', centerX, height - 60)
        ctx.restore()
      }

      // Dynamic cursor feedback
      if (pointerDragRef.current.isDragging) {
        canvas.style.cursor = 'grabbing'
      } else if (newHoveredIndex !== null || deconstructionStage) {
        canvas.style.cursor = 'pointer'
      } else {
        canvas.style.cursor = 'grab'
      }

      // Audio feedback on new hover
      if (newHoveredIndex !== null && newHoveredIndex !== hoveredIndexRef.current && !pointerDragRef.current.isDragging) {
        sumiAudio.playBrushFriction()
      }
      hoveredIndexRef.current = newHoveredIndex

      animFrameRef.current = requestAnimationFrame(render)
    }

    animFrameRef.current = requestAnimationFrame(render)
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [deconstructionStage, executeStampAction])

  // Pointer Movement, Drag-to-Pan & Liquid Wake Interaction
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    mouseRef.current = { x, y, active: true }

    // If pointer moved beyond threshold, cancel hold-to-stamp gesture
    if (holdPressRef.current.isHolding) {
      const moved = Math.hypot(x - holdPressRef.current.x, y - holdPressRef.current.y)
      if (moved > 8) {
        holdPressRef.current.isHolding = false
      }
    }

    // Handle Active 2D Pan Drag
    const drag = pointerDragRef.current
    if (drag.isDown) {
      const dx = x - drag.startX
      const dy = y - drag.startY
      if (!drag.isDragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
        drag.isDragging = true
        holdPressRef.current.isHolding = false
      }

      if (drag.isDragging) {
        panRef.current.targetX = drag.panStartX - dx * 1.2
        panRef.current.targetY = Math.max(0, drag.panStartY - dy * 1.2)
      }
      return
    }

    sumiAudio.initOnGesture()

    // Emit gentle organic water ripple on movement
    if (Math.random() < 0.22) {
      ripplesRef.current.push({
        x,
        y,
        radius: 4,
        maxRadius: 58,
        alpha: 0.2,
        speed: 1.3,
        asymmetrySeed: Math.random() * 10,
      })
    }
  }

  const handlePointerLeave = () => {
    mouseRef.current.active = false
    hoveredIndexRef.current = null
    pointerDragRef.current.isDown = false
    pointerDragRef.current.isDragging = false
    holdPressRef.current.isHolding = false
  }

  // Pointer Down (Start potential click, drag, or 0.5s hold-to-stamp)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    sumiAudio.initOnGesture()

    pointerDragRef.current = {
      isDown: true,
      isDragging: false,
      startX: x,
      startY: y,
      panStartX: panRef.current.targetX,
      panStartY: panRef.current.targetY,
      startTime: performance.now(),
    }

    // Check hit against visible kanji particles for hold-to-stamp
    const panX = panRef.current.x
    const panY = panRef.current.y
    const currentZoom = zoomRef.current.current
    const particles = particlesRef.current
    const cam = cameraParallaxRef.current

    let hitIdx: number | null = null
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]
      if (!p) continue
      const parallaxX = cam.x * p.parallaxFactor
      const parallaxY = cam.y * p.parallaxFactor
      const worldX = p.x + parallaxX + p.dispX - panX
      const worldY = p.y - panY + parallaxY + p.dispY
      const screenX = (worldX - rect.width / 2) * currentZoom + rect.width / 2
      const screenY = (worldY - rect.height / 2) * currentZoom + rect.height / 2
      const dx = screenX - x
      const dy = screenY - y

      if (
        (Math.abs(dx) <= 48 * currentZoom && dy >= -48 * currentZoom && dy <= 56 * currentZoom) ||
        Math.hypot(dx, dy) <= 48 * p.scale
      ) {
        hitIdx = i
        break
      }
    }

    holdPressRef.current = {
      targetIndex: hitIdx,
      startTime: performance.now(),
      isHolding: hitIdx !== null,
      completed: false,
      x,
      y,
    }
  }

  // Pointer Up (Complete drag or perform selection / deconstruction click)
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const drag = pointerDragRef.current
    const wasDragging = drag.isDragging
    drag.isDown = false
    drag.isDragging = false

    const hold = holdPressRef.current
    const wasHolding = hold.isHolding
    const wasCompleted = hold.completed
    hold.isHolding = false

    if (wasDragging) return

    // If hold-to-stamp gesture was completed, don't open modal!
    if (wasCompleted) {
      return
    }

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // If Deconstruction Stage is active, clicking closes it (fuses radicals back together)
    if (deconstructionStage) {
      sumiAudio.playSuikinkutsu()
      setDeconstructionStage(null)
      return
    }

    // Add vibrant organic click ripple
    ripplesRef.current.push({
      x,
      y,
      radius: 6,
      maxRadius: 95,
      alpha: 0.55,
      speed: 2.6,
      asymmetrySeed: Math.random() * 10,
    })

    // Hit test against particles for short click (Deconstruction Stage)
    if (wasHolding && hold.targetIndex !== null) {
      const p = particlesRef.current[hold.targetIndex]
      if (p) {
        sumiAudio.playSuikinkutsu()
        const info = getKanjiDeconstruction(p.item.kanji, p.item)
        setDeconstructionStage({ info, item: p.item })
      }
    }
  }

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (e.key === 'Escape' && deconstructionStage) {
      sumiAudio.playSuikinkutsu()
      setDeconstructionStage(null)
      return
    }
    const pan = panRef.current
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      pan.targetY = Math.max(0, pan.targetY + 112)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      pan.targetY = Math.max(0, pan.targetY - 112)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      pan.targetX += 112
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      pan.targetX -= 112
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault()
      handleZoomIn()
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault()
      handleZoomOut()
    } else if (e.key === '0') {
      e.preventDefault()
      handleZoomReset()
    }
  }

  return (
    <div className="sumi-e-container" ref={containerRef}>
      {/* ─── WHISPER HUD (Giao diện điều khiển vi mô) ────────────────────── */}
      <header className="sumi-e-hud" aria-label="Bảng điều khiển thủy mặc">
        {/* Minimalist JLPT Level Selector (Tất cả, N5 - N1) */}
        <nav className="sumi-e-levels" aria-label="Chọn cấp độ Hán tự">
          {JLPT_LEVELS.map((lvl) => {
            const isActive = activeLevel === lvl
            const label = lvl === 'ALL' ? 'Tất cả' : `Kanji ${lvl}`

            return (
              <button
                key={lvl}
                type="button"
                className={`sumi-e-level-item ${isActive ? 'is-active' : ''}`}
                onClick={() => handleLevelClick(lvl)}
              >
                <span>{label}</span>
                {isActive && <span className="sumi-e-level-indicator" aria-hidden="true" />}
              </button>
            )
          })}
        </nav>

        {/* Ambient controls (Chờ nạp mực Filter, Audio Mute Toggle & Zen Counter) */}
        <div className="sumi-e-controls">
          {(() => {
            const dueCount = items.filter((item) => {
              const rec = hankoRecords[item.kanji]
              return rec && (rec.inkState === 'dry_due' || rec.inkState === 'ash_decay')
            }).length

            return (
              <button
                type="button"
                className={`sumi-e-hanko-filter ${hankoFilterActive ? 'is-active' : ''}`}
                onClick={() => setHankoFilterActive((prev) => !prev)}
                title={hankoFilterActive ? 'Hiện tất cả Hán tự' : 'Lọc các Hán tự chờ nạp mực (SRS)'}
              >
                <span className="sumi-e-hanko-filter-seal" aria-hidden="true">印</span>
                <span>Chờ nạp mực</span>
                {dueCount > 0 && <span className="sumi-e-hanko-filter-badge">{dueCount}</span>}
              </button>
            )
          })()}

          <span className="sumi-e-counter">
            <Sparkles size={13} aria-hidden="true" />
            <span>{items.length} Hán tự tụ lại</span>
          </span>
          <button
            type="button"
            className="sumi-e-audio-btn"
            onClick={handleToggleAudio}
            title={isMuted ? 'Bật âm thanh thiền định' : 'Tắt âm thanh'}
            aria-label={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          >
            {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
        </div>
      </header>

      {/* ─── INFINITE SUMI-E CANVAS (Thủy mặc vô cực) ────────────────────── */}
      <canvas
        ref={canvasRef}
        className="sumi-e-canvas"
        tabIndex={0}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
        role="region"
        aria-label="Không gian tương tác Hán tự Thủy Mặc Vô Cực"
      />

      {/* ─── 2D INFINITE ZOOM HUD (Bottom Right Floating Controls) ────────── */}
      <div
        style={{
          position: 'absolute',
          right: '1.25rem',
          bottom: '1.25rem',
          display: 'flex',
          gap: '0.35rem',
          background: 'rgba(250, 248, 245, 0.88)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(215, 205, 190, 0.45)',
          borderRadius: '9999px',
          padding: '0.25rem 0.5rem',
          boxShadow: '0 4px 16px rgba(40, 35, 30, 0.06)',
          zIndex: 10,
        }}
        aria-label="Điều hướng không gian vô cực"
      >
        <button
          type="button"
          onClick={handleZoomIn}
          title="Phóng to lướt sâu vào Hán tự (+)"
          style={{
            background: 'transparent',
            border: 'none',
            padding: '0.35rem',
            cursor: 'pointer',
            color: '#44403C',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ZoomIn size={15} />
        </button>
        <button
          type="button"
          onClick={handleZoomReset}
          title="Đưa về tỷ lệ chuẩn (0)"
          style={{
            background: 'transparent',
            border: 'none',
            padding: '0.35rem',
            cursor: 'pointer',
            color: '#44403C',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <RotateCcw size={13} />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          title="Thu nhỏ ngắm thiên hà Hán tự (-)"
          style={{
            background: 'transparent',
            border: 'none',
            padding: '0.35rem',
            cursor: 'pointer',
            color: '#44403C',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ZoomOut size={15} />
        </button>
      </div>

      {/* ─── DECONSTRUCTION STAGE ACTION OVERLAY ──────────────────────────── */}
      {deconstructionStage && (
        <div
          style={{
            position: 'absolute',
            bottom: '1.75rem',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '0.85rem',
            zIndex: 25,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {/* Hanko Direct Stamping in Stage */}
          <button
            type="button"
            onClick={() => {
              const item = deconstructionStage.item
              const canvas = canvasRef.current
              const rect = canvas ? canvas.getBoundingClientRect() : { width: 800, height: 600 }
              executeStampAction(item.kanji, rect.width / 2, rect.height / 2 - 35)
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              background: '#C23A2B',
              color: '#FAF8F5',
              border: 'none',
              padding: '0.55rem 1.25rem',
              borderRadius: '9999px',
              fontFamily: '"Noto Serif JP", serif',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 18px rgba(194, 58, 43, 0.45)',
            }}
          >
            <span style={{ border: '1px solid currentColor', padding: '0 3px', borderRadius: '2px', fontSize: '10px' }}>印</span>
            <span>Dập ấn nạp mực</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const item = deconstructionStage.item
              setDeconstructionStage(null)
              onSelectKanji(item)
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              background: 'rgba(250, 248, 245, 0.9)',
              color: '#44403C',
              border: '1px solid rgba(215, 205, 190, 0.65)',
              padding: '0.55rem 1.25rem',
              borderRadius: '9999px',
              fontFamily: '"Noto Serif JP", serif',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
            }}
          >
            <span>Luyện viết nét & Xem từ điển chi tiết</span>
            <ExternalLink size={14} />
          </button>

          <button
            type="button"
            onClick={() => setDeconstructionStage(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              background: 'rgba(250, 248, 245, 0.9)',
              color: '#44403C',
              border: '1px solid rgba(215, 205, 190, 0.6)',
              padding: '0.55rem 1rem',
              borderRadius: '9999px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <X size={14} />
            <span>Thu gọn bộ thủ</span>
          </button>
        </div>
      )}

      {/* ─── ACCESSIBLE DOM OVERLAY FOR SCREEN READERS & TEST SUITES ──────── */}
      <div
        className="sumi-e-accessible-list visually-hidden"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
          pointerEvents: 'none',
        }}
        aria-live="polite"
      >
        <ul>
          {items.map((k) => (
            <li key={k.kanji}>
              <button type="button" onClick={() => onSelectKanji(k)}>
                <span>{k.kanji}</span>
                <span>{k.hanzi}</span>
                <span>{k.meaning_vi}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
export default SumiECanvas
