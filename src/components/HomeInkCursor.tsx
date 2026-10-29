import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { sumiAudio } from '../features/dictionary/sumiAudio'
import '../styles/home-cursor.css'

export default function HomeInkCursor() {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const dot = dotRef.current
    const ring = ringRef.current
    if (!dot || !ring || typeof window === 'undefined') return

    if (typeof window.matchMedia !== 'function') return
    const eligible = window.matchMedia('(min-width: 701px) and (prefers-reduced-motion: no-preference)')
    if (!eligible.matches) return

    let mouseX = -100
    let mouseY = -100
    let ringX = -100
    let ringY = -100
    let isVisible = false
    let animId = 0

    const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor

    const syncRender = () => {
      // Fluid LERP inertia lag (0.16 factor for silky trailing follow)
      ringX = lerp(ringX, mouseX, 0.16)
      ringY = lerp(ringY, mouseY, 0.16)

      dot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`
      ring.style.transform = `translate3d(${ringX.toFixed(2)}px, ${ringY.toFixed(2)}px, 0) translate(-50%, -50%)`

      animId = window.requestAnimationFrame(syncRender)
    }

    const showCursor = (x: number, y: number) => {
      mouseX = x
      mouseY = y
      if (!isVisible) {
        isVisible = true
        dot.classList.add('is-visible')
        ring.classList.add('is-visible')
        ringX = mouseX
        ringY = mouseY
      }
    }

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return

      // Activate custom cursor styling and hide system OS cursor completely
      document.documentElement.classList.add('has-custom-cursor', 'home-ink-cursor-ready')
      document.body.classList.add('has-custom-cursor')

      sumiAudio.initOnGesture()

      let targetX = e.clientX
      let targetY = e.clientY

      const target = e.target as HTMLElement | null
      const isCardOrArtwork = Boolean(
        target?.closest('.showcase-course-plate, .showcase-hero__landscape, .showcase-hero__mobile-art')
      )
      const interactive = target?.closest(
        'a, button, [role="button"], input, select, textarea, .ui-button, .showcase-tool'
      ) as HTMLElement | null

      if (interactive) {
        // Subtle magnetic attraction towards center of button
        const rect = interactive.getBoundingClientRect()
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        targetX = lerp(e.clientX, cx, 0.22)
        targetY = lerp(e.clientY, cy, 0.22)
      }

      showCursor(targetX, targetY)

      if (isCardOrArtwork) {
        ring.className = 'kotodama-global-cursor-ring is-visible is-seal'
      } else if (interactive) {
        ring.className = 'kotodama-global-cursor-ring is-visible is-interactive'
      } else {
        ring.className = 'kotodama-global-cursor-ring is-visible'
      }
    }

    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      dot.classList.add('is-down')
      dot.style.setProperty('--cx', `${e.clientX}px`)
      dot.style.setProperty('--cy', `${e.clientY}px`)
      sumiAudio.playBrushFriction()
    }

    const handlePointerUp = () => {
      dot.classList.remove('is-down')
    }

    const handleScroll = () => {
      if (isVisible) {
        dot.classList.add('is-visible')
        ring.classList.add('is-visible')
      }
    }

    const handleMouseLeave = (e: MouseEvent) => {
      if (
        !e.relatedTarget &&
        (e.clientY <= 0 || e.clientX <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight)
      ) {
        isVisible = false
        dot.classList.remove('is-visible')
        ring.classList.remove('is-visible')
        document.documentElement.classList.remove('has-custom-cursor')
        document.body.classList.remove('has-custom-cursor')
      }
    }

    window.addEventListener('pointermove', handlePointerMove, { capture: true, passive: true })
    window.addEventListener('pointerdown', handlePointerDown, { passive: true })
    window.addEventListener('pointerup', handlePointerUp, { passive: true })
    window.addEventListener('scroll', handleScroll, { passive: true })
    document.addEventListener('mouseleave', handleMouseLeave)
    window.addEventListener('blur', () => {
      isVisible = false
      dot.classList.remove('is-visible')
      ring.classList.remove('is-visible')
    })

    animId = window.requestAnimationFrame(syncRender)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove, { capture: true })
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('scroll', handleScroll)
      document.removeEventListener('mouseleave', handleMouseLeave)
      if (animId) window.cancelAnimationFrame(animId)
      document.documentElement.classList.remove('has-custom-cursor', 'home-ink-cursor-ready')
      document.body.classList.remove('has-custom-cursor')
    }
  }, [mounted])

  if (!mounted || typeof document === 'undefined') return null

  return createPortal(
    <>
      <div ref={dotRef} className="kotodama-global-cursor-dot" aria-hidden="true" />
      <div ref={ringRef} className="kotodama-global-cursor-ring" aria-hidden="true" />
    </>,
    document.body
  )
}
