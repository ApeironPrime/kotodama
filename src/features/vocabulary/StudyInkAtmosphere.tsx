import { useEffect, useRef } from 'react'
import { useReducedMotion } from '../../lib/useReducedMotion'

interface StudyInkAtmosphereProps {
  burstTrigger: number
  rippleTrigger: number
}

interface KinpakuMote {
  x: number
  y: number
  size: number
  vx: number
  vy: number
  phase: number
  alpha: number
  isVermilion: boolean
}

interface InkDustParticle {
  x: number
  y: number
  vx: number
  vy: number
  alpha: number
  size: number
  color: string
}

interface InkRipple {
  x: number
  y: number
  radius: number
  maxRadius: number
  alpha: number
  speed: number
  lineWidth: number
  isVermilion: boolean
}

function createMote(width: number, height: number): KinpakuMote {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    size: 1.4 + Math.random() * 2.4,
    vx: 0.08 + Math.random() * 0.16,
    vy: -0.05 + Math.random() * 0.1,
    phase: Math.random() * Math.PI * 2,
    alpha: 0.18 + Math.random() * 0.25,
    isVermilion: Math.random() > 0.68,
  }
}

export function StudyInkAtmosphere({ burstTrigger, rippleTrigger }: StudyInkAtmosphereProps) {
  const reducedMotion = useReducedMotion()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const dustRef = useRef<InkDustParticle[]>([])
  const ripplesRef = useRef<InkRipple[]>([])
  const sizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 })
  const pointerRef = useRef<{ x: number; y: number; active: boolean }>({ x: -999, y: -999, active: false })
  const prevBurstRef = useRef(burstTrigger)
  const prevRippleRef = useRef(rippleTrigger)

  useEffect(() => {
    if (reducedMotion || burstTrigger === prevBurstRef.current) return
    prevBurstRef.current = burstTrigger
    const { width, height } = sizeRef.current
    if (!width || !height) return

    const cx = width * 0.5
    const cy = height * 0.5
    for (let i = 0; i < 20; i += 1) {
      const angle = (Math.PI * 2 * i) / 20 + (Math.random() - 0.5) * 0.28
      const speed = 1.4 + Math.random() * 3.6
      dustRef.current.push({
        x: cx + (Math.random() - 0.5) * 24,
        y: cy + (Math.random() - 0.5) * 24,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 0.92,
        size: 1.5 + Math.random() * 2.5,
        color: Math.random() > 0.25 ? '#c23a2b' : '#d69e4e',
      })
    }
    ripplesRef.current.push({
      x: cx,
      y: cy,
      radius: 12,
      maxRadius: Math.min(width, height) * 0.44,
      alpha: 0.55,
      speed: 2.6,
      lineWidth: 2,
      isVermilion: true,
    })
  }, [burstTrigger, reducedMotion])

  useEffect(() => {
    if (reducedMotion || rippleTrigger === prevRippleRef.current) return
    prevRippleRef.current = rippleTrigger
    const { width, height } = sizeRef.current
    if (!width || !height) return

    ripplesRef.current.push({
      x: width * 0.5,
      y: height * 0.5,
      radius: 18,
      maxRadius: Math.min(width, height) * 0.36,
      alpha: 0.3,
      speed: 1.85,
      lineWidth: 1.25,
      isVermilion: false,
    })
  }, [rippleTrigger, reducedMotion])

  useEffect(() => {
    if (reducedMotion) return
    const canvas = canvasRef.current
    if (!canvas || typeof CanvasRenderingContext2D === 'undefined') return
    const ctx = canvas.getContext('2d')
    const host = canvas.parentElement
    if (!ctx || !host) return

    let rafId = 0
    let motes: KinpakuMote[] = []

    const resize = () => {
      const rect = host.getBoundingClientRect()
      const width = rect.width
      const height = rect.height
      if (!width || !height) return
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      sizeRef.current = { width, height }
      if (motes.length === 0) {
        motes = Array.from({ length: 18 }, () => createMote(width, height))
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      const rect = host.getBoundingClientRect()
      pointerRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
      }
    }

    const onPointerLeave = () => {
      pointerRef.current.active = false
    }

    const render = () => {
      rafId = 0
      if (document.hidden) return
      const { width, height } = sizeRef.current
      if (width && height) {
        ctx.clearRect(0, 0, width, height)

        // 1. Floating Kinpaku & Vermilion Washi Motes
        for (let i = 0; i < motes.length; i += 1) {
          const m = motes[i]
          if (!m) continue
          m.phase += 0.015
          let pushX = 0
          let pushY = 0
          if (pointerRef.current.active) {
            const dx = m.x - pointerRef.current.x
            const dy = m.y - pointerRef.current.y
            const dist = Math.hypot(dx, dy)
            if (dist > 1 && dist < 110) {
              const force = (1 - dist / 110) * 1.15
              pushX = (dx / dist) * force
              pushY = (dy / dist) * force
            }
          }
          m.x += m.vx + Math.sin(m.phase) * 0.12 + pushX
          m.y += m.vy + Math.cos(m.phase * 0.8) * 0.08 + pushY
          if (m.x > width + 10) m.x = -8
          if (m.y < -10) m.y = height + 8
          if (m.y > height + 10) m.y = -8

          ctx.save()
          ctx.globalAlpha = m.alpha
          ctx.fillStyle = m.isVermilion ? '#b82e2e' : '#c69c53'
          ctx.beginPath()
          ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }

        // 2. Suikinkutsu / Hanko Ripples
        for (let i = ripplesRef.current.length - 1; i >= 0; i -= 1) {
          const r = ripplesRef.current[i]
          if (!r) continue
          r.radius += r.speed
          r.alpha *= 0.945
          if (r.radius >= r.maxRadius || r.alpha <= 0.02) {
            ripplesRef.current.splice(i, 1)
            continue
          }
          ctx.save()
          ctx.globalAlpha = r.alpha
          ctx.strokeStyle = r.isVermilion ? '#b82e2e' : '#6e655a'
          ctx.lineWidth = r.lineWidth
          ctx.beginPath()
          ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2)
          ctx.stroke()
          ctx.restore()
        }

        // 3. Cinnabar Hanko Dust Particles
        for (let i = dustRef.current.length - 1; i >= 0; i -= 1) {
          const p = dustRef.current[i]
          if (!p) continue
          p.x += p.vx
          p.y += p.vy
          p.vx *= 0.94
          p.vy *= 0.94
          p.alpha *= 0.93
          if (p.alpha <= 0.03) {
            dustRef.current.splice(i, 1)
            continue
          }
          ctx.save()
          ctx.globalAlpha = p.alpha
          ctx.fillStyle = p.color
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
      }
      rafId = window.requestAnimationFrame(render)
    }

    const onVisibility = () => {
      if (!document.hidden && !rafId) {
        rafId = window.requestAnimationFrame(render)
      }
    }

    resize()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
    observer?.observe(host)
    host.addEventListener('pointermove', onPointerMove, { passive: true })
    host.addEventListener('pointerleave', onPointerLeave)
    document.addEventListener('visibilitychange', onVisibility)
    rafId = window.requestAnimationFrame(render)

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId)
      observer?.disconnect()
      host.removeEventListener('pointermove', onPointerMove)
      host.removeEventListener('pointerleave', onPointerLeave)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [reducedMotion])

  if (reducedMotion) return null

  return <canvas ref={canvasRef} className="kakejiku-atmosphere-canvas" aria-hidden="true" />
}
