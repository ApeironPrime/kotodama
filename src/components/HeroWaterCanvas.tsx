import { useEffect, useRef } from 'react'

export default function HeroWaterCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || typeof window === 'undefined') return

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0
    let animId = 0
    let isVisible = true

    // Ripple wave simulation
    interface Ripple {
      x: number
      y: number
      radius: number
      maxRadius: number
      strength: number
      speed: number
    }

    const ripples: Ripple[] = []
    let lastSpawn = 0

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const rect = parent.getBoundingClientRect()
      width = rect.width
      height = rect.height
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()
    window.addEventListener('resize', resize)

    const handlePointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      // Trigger ripples when mouse moves in the lower 40% (the lake/water region)
      if (y > height * 0.58 && y < height * 0.95 && x > width * 0.25) {
        const now = performance.now()
        if (now - lastSpawn > 60) {
          lastSpawn = now
          ripples.push({
            x,
            y,
            radius: 4,
            maxRadius: 45 + Math.random() * 25,
            strength: 0.24,
            speed: 1.2 + Math.random() * 0.6,
          })
          if (ripples.length > 20) ripples.shift()
        }
      }
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })

    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry?.isIntersecting ?? false
    })
    observer.observe(canvas)

    let time = 0
    const render = () => {
      if (!isVisible || document.hidden) {
        animId = requestAnimationFrame(render)
        return
      }

      ctx.clearRect(0, 0, width, height)
      time += 0.035

      // Ambient subtle current flow
      const waterTop = height * 0.62
      const waterHeight = height - waterTop

      // Draw interactive ripples with refraction caustics
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i]
        if (!r) continue
        r.radius += r.speed
        r.strength *= 0.965

        if (r.radius >= r.maxRadius || r.strength <= 0.01) {
          ripples.splice(i, 1)
          continue
        }

        ctx.save()
        ctx.beginPath()
        // Oval water ripple perspective
        ctx.ellipse(r.x, r.y, r.radius * 1.8, r.radius * 0.45, 0, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(255, 250, 240, ${r.strength * 0.65})`
        ctx.lineWidth = 1.5
        ctx.shadowColor = 'rgba(74, 98, 110, 0.2)'
        ctx.shadowBlur = 4
        ctx.stroke()

        // Inner caustic refraction line
        ctx.beginPath()
        ctx.ellipse(r.x, r.y, r.radius * 1.3, r.radius * 0.32, 0, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(180, 210, 220, ${r.strength * 0.35})`
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.restore()
      }

      // Continuous subtle water glimmer
      if (ripples.length > 0) {
        ctx.save()
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)'
        ctx.fillRect(0, waterTop, width, waterHeight)
        ctx.restore()
      }

      animId = requestAnimationFrame(render)
    }

    animId = requestAnimationFrame(render)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', handlePointerMove)
      if (animId) cancelAnimationFrame(animId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="showcase-hero__water"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 2,
        pointerEvents: 'none',
        mixBlendMode: 'screen',
      }}
      aria-hidden="true"
    />
  )
}
