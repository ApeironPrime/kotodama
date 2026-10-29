import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  rotation: number
  rotSpeed: number
  color: string
}

const GOLD_PALETTE = [
  'rgba(212, 175, 55, 0.45)', // Warm Kyoto gold
  'rgba(230, 195, 92, 0.35)', // Pale gold
  'rgba(184, 46, 46, 0.25)', // Subtle cinnabar vermilion dust
  'rgba(200, 180, 150, 0.3)', // Natural washi fiber
]

export function WashiGoldDustCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return // Guard for headless or jsdom test environments

    let animationFrameId: number
    let isVisible = true
    let width = (canvas.width = canvas.offsetWidth || window.innerWidth)
    let height = (canvas.height = canvas.offsetHeight || 300)

    const mouse = { x: width / 2, y: height / 2, active: false }

    const particles: Particle[] = Array.from({ length: 42 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.35,
      vy: Math.random() * 0.35 + 0.1,
      size: Math.random() * 2.2 + 0.8,
      alpha: Math.random() * 0.45 + 0.2,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.015,
      color: GOLD_PALETTE[Math.floor(Math.random() * GOLD_PALETTE.length)] ?? '#D4AF37',
    }))

    const handleResize = () => {
      if (!canvas) return
      width = canvas.width = canvas.offsetWidth || window.innerWidth
      height = canvas.height = canvas.offsetHeight || 300
    }

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouse.x = e.clientX - rect.left
      mouse.y = e.clientY - rect.top
      mouse.active = true
    }

    const handleMouseLeave = () => {
      mouse.active = false
    }

    window.addEventListener('resize', handleResize)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseleave', handleMouseLeave)

    // Pause rendering when off-screen to conserve CPU/battery
    const observer = new IntersectionObserver(([entry]) => {
      isVisible = Boolean(entry?.isIntersecting)
    })
    observer.observe(canvas)

    const render = () => {
      if (isVisible) {
        ctx.clearRect(0, 0, width, height)

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i]
          if (!p) continue

          // Mouse swirl physics
          if (mouse.active) {
            const dx = p.x - mouse.x
            const dy = p.y - mouse.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist < 140 && dist > 0) {
              const force = (1 - dist / 140) * 0.6
              p.vx += (dx / dist) * force
              p.vy += (dy / dist) * force
            }
          }

          // Gentle drag and organic descent
          p.x += p.vx
          p.y += p.vy
          p.rotation += p.rotSpeed
          p.vx *= 0.985
          p.vy = p.vy * 0.985 + 0.005

          // Wrap edges
          if (p.x < -10) p.x = width + 10
          if (p.x > width + 10) p.x = -10
          if (p.y > height + 10) {
            p.y = -10
            p.x = Math.random() * width
          }

          // Render gold leaf speck (rotated diamond or ellipse)
          ctx.save()
          ctx.translate(p.x, p.y)
          ctx.rotate(p.rotation)
          ctx.fillStyle = p.color
          ctx.globalAlpha = p.alpha

          ctx.beginPath()
          ctx.ellipse(0, 0, p.size * 1.4, p.size * 0.8, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
      }

      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => {
      window.removeEventListener('resize', handleResize)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseleave', handleMouseLeave)
      observer.disconnect()
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return <canvas ref={canvasRef} className="washi-gold-dust-canvas" aria-hidden="true" />
}
