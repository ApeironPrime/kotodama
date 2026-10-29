import { useEffect, useRef } from 'react'

type Petal = {
  x: number
  y: number
  size: number
  speed: number
  sway: number
  phase: number
  angle: number
  spin: number
  shade: number
  driftX: number
  driftY: number
}

const randomPetal = (width: number, height: number, anywhere = false): Petal => ({
  x: Math.random() * width,
  y: anywhere ? Math.random() * height : -15 - Math.random() * height * 0.35,
  size: 4 + Math.random() * 7,
  speed: 0.25 + Math.random() * 0.55,
  sway: 0.35 + Math.random() * 0.7,
  phase: Math.random() * Math.PI * 2,
  angle: Math.random() * Math.PI * 2,
  spin: (Math.random() - 0.5) * 0.022,
  shade: Math.random(),
  driftX: 0,
  driftY: 0,
})

export default function HomeInkCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || typeof CanvasRenderingContext2D === 'undefined') return
    const context = canvas.getContext('2d', { alpha: true })
    const hero = canvas.parentElement
    if (!context || !hero || !window.matchMedia) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let width = 0
    let height = 0
    let petals: Petal[] = []
    let frame = 0
    let lastTime = 0
    let inView = false
    let pointerX = -1000
    let pointerY = -1000
    let windX = 0
    let windY = 0
    let previousX = 0
    let previousY = 0

    const resize = () => {
      const bounds = hero.getBoundingClientRect()
      width = bounds.width
      height = bounds.height
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      petals = Array.from({ length: window.innerWidth < 600 ? 14 : 32 }, () => randomPetal(width, height, true))
    }

    const draw = (time: number) => {
      frame = 0
      if (!inView || reducedMotion.matches || document.hidden) return

      const step = Math.min((time - (lastTime || time)) / 16.67, 2)
      lastTime = time
      context.clearRect(0, 0, width, height)
      windX *= 0.955
      windY *= 0.955

      for (let index = 0; index < petals.length; index += 1) {
        const petal = petals[index]
        if (!petal) continue
        const distance = Math.hypot(petal.x - pointerX, petal.y - pointerY)
        const gustRadius = 260
        const gust = Math.max(0, 1 - distance / gustRadius)
        if (gust > 0 && distance > 1) {
          // Dynamic aerodynamic repulsion + drag from mouse velocity
          const push = gust * 3.6 * step
          const dirX = (petal.x - pointerX) / distance
          const dirY = (petal.y - pointerY) / distance
          petal.driftX += dirX * push + windX * gust * 1.5
          petal.driftY += dirY * push * 0.85 + windY * gust * 1.2
          petal.spin += (Math.random() - 0.5) * 0.05 * gust
        }
        petal.driftX = Math.max(-7.0, Math.min(7.0, petal.driftX * 0.94))
        petal.driftY = Math.max(-6.0, Math.min(6.0, petal.driftY * 0.94))
        petal.phase += 0.009 * step
        petal.x += (Math.sin(petal.phase) * petal.sway + 0.25 + windX * gust + petal.driftX) * step
        petal.y += (petal.speed + windY * gust + petal.driftY) * step
        petal.angle += petal.spin * step
        if (petal.y > height + 20 || petal.x > width + 25 || petal.x < -25) {
          petals[index] = randomPetal(width, height)
          continue
        }

        context.save()
        context.translate(petal.x, petal.y)
        context.rotate(petal.angle)
        context.globalAlpha = 0.34 + petal.shade * 0.37
        context.fillStyle = petal.shade > 0.5 ? '#d99793' : '#f1c8ba'
        context.beginPath()
        context.moveTo(0, -petal.size)
        context.quadraticCurveTo(petal.size * 0.95, -petal.size * 0.2, 0, petal.size)
        context.quadraticCurveTo(-petal.size * 0.85, petal.size * 0.1, 0, -petal.size)
        context.fill()
        context.restore()
      }
      frame = window.requestAnimationFrame(draw)
    }

    const syncAnimation = () => {
      if (inView && !reducedMotion.matches && !document.hidden && !frame) {
        lastTime = 0
        frame = window.requestAnimationFrame(draw)
      } else if ((!inView || reducedMotion.matches || document.hidden) && frame) {
        window.cancelAnimationFrame(frame)
        frame = 0
        context.clearRect(0, 0, width, height)
      }
    }

    const handlePointer = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      const bounds = hero.getBoundingClientRect()
      pointerX = event.clientX - bounds.left
      pointerY = event.clientY - bounds.top
      windX = Math.max(-5.5, Math.min(5.5, (event.clientX - previousX) * 0.18))
      windY = Math.max(-4.0, Math.min(4.0, (event.clientY - previousY) * 0.14))
      previousX = event.clientX
      previousY = event.clientY
    }
    const clearPointer = () => {
      pointerX = -1000
      pointerY = -1000
    }

    resize()
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
    resizeObserver?.observe(hero)
    const visibilityObserver =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            inView = entry?.isIntersecting ?? false
            syncAnimation()
          })
    visibilityObserver?.observe(hero)
    if (!visibilityObserver) {
      inView = true
      syncAnimation()
    }
    window.addEventListener('pointermove', handlePointer, { passive: true })
    window.addEventListener('pointerleave', clearPointer)
    reducedMotion.addEventListener('change', syncAnimation)
    document.addEventListener('visibilitychange', syncAnimation)

    return () => {
      resizeObserver?.disconnect()
      visibilityObserver?.disconnect()
      window.removeEventListener('pointermove', handlePointer)
      window.removeEventListener('pointerleave', clearPointer)
      reducedMotion.removeEventListener('change', syncAnimation)
      document.removeEventListener('visibilitychange', syncAnimation)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="showcase-hero__petals"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 2,
      }}
      aria-hidden="true"
    />
  )
}
