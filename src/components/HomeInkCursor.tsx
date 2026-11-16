import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import '../styles/home-cursor.css'

const ACTION_SELECTOR = [
  'button',
  'a[href]',
  '[role="button"]',
  '[role="link"]',
  '[role="tab"]',
  '[role="checkbox"]',
  '[role="radio"]',
  'summary',
  'select',
  'input[type="button"]',
  'input[type="submit"]',
  'input[type="reset"]',
  'input[type="checkbox"]',
  'input[type="radio"]',
].join(',')

function getAction(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null
  const action = target.closest<HTMLElement>(ACTION_SELECTOR)
  if (!action || action.closest('[inert], [aria-disabled="true"]') || action.matches(':disabled')) return null
  return action
}

export default function HomeInkCursor() {
  const ripplesRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const layer = ripplesRef.current
    if (!mounted || !layer || typeof window.matchMedia !== 'function') return

    const pointer = window.matchMedia('(min-width: 701px) and (pointer: fine)')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let hovered: HTMLElement | null = null
    const running = new Map<HTMLElement, number>()

    const clearRipples = () => {
      for (const [ripple, frame] of running) {
        window.cancelAnimationFrame(frame)
        ripple.remove()
      }
      running.clear()
      hovered = null
    }

    const syncPointer = () => {
      document.documentElement.classList.toggle('has-brush-cursor', pointer.matches)
      clearRipples()
    }

    const emitRipple = (action: HTMLElement, pressed: boolean, point?: { x: number; y: number }) => {
      if (!pointer.matches || reducedMotion.matches) return
      const rect = action.getBoundingClientRect()
      if (!rect.width || !rect.height) return

      if (pressed) {
        for (const [previous, frame] of running) {
          window.cancelAnimationFrame(frame)
          previous.remove()
        }
        running.clear()
      }

      // Bound the number of effects, even when moving rapidly through a dense list.
      while (running.size >= 3) {
        const oldest = running.entries().next().value
        if (!oldest) break
        window.cancelAnimationFrame(oldest[1])
        oldest[0].remove()
        running.delete(oldest[0])
      }

      const ripple = document.createElement('span')
      ripple.className = `button-water-ripple${pressed ? ' is-pressed' : ''}`
      ripple.style.left = `${rect.left}px`
      ripple.style.top = `${rect.top}px`
      ripple.style.width = `${rect.width}px`
      ripple.style.height = `${rect.height}px`
      ripple.style.borderRadius = window.getComputedStyle(action).borderRadius
      const canvas = document.createElement('canvas')
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.ceil(rect.width * dpr)
      canvas.height = Math.ceil(rect.height * dpr)
      const context = canvas.getContext('2d')
      if (!context) return
      context.scale(dpr, dpr)
      ripple.appendChild(canvas)
      layer.appendChild(ripple)

      const originX = point ? Math.max(0, Math.min(rect.width, point.x - rect.left)) : rect.width / 2
      const originY = point ? Math.max(0, Math.min(rect.height, point.y - rect.top)) : rect.height / 2
      const duration = pressed ? 880 : 620
      const reach = pressed ? 100 : 46
      const started = performance.now()
      ripple.dataset['originX'] = String(originX)
      ripple.dataset['originY'] = String(originY)

      // A moving light/dark meniscus reads as a surface disturbance, not an expanding outline.
      const traceWave = (radius: number, time: number) => {
        context.beginPath()
        for (let step = 0; step <= 100; step += 1) {
          const angle = (step / 100) * Math.PI * 2
          const drift = Math.sin(angle * 3 + time * 2) * Math.min(0.8, radius * 0.025)
          const x = originX + Math.cos(angle) * (radius + drift)
          const y = originY + Math.sin(angle) * (radius + drift)
          if (step === 0) context.moveTo(x, y)
          else context.lineTo(x, y)
        }
        context.closePath()
      }

      const draw = (now: number) => {
        const progress = Math.max(0, (now - started) / duration)
        const bounds = action.getBoundingClientRect()
        if (
          progress >= 1 ||
          !action.isConnected ||
          Math.abs(bounds.width - rect.width) > 2 ||
          Math.abs(bounds.height - rect.height) > 2
        ) {
          ripple.remove()
          running.delete(ripple)
          return
        }
        ripple.style.left = `${bounds.left}px`
        ripple.style.top = `${bounds.top}px`
        context.clearRect(0, 0, rect.width, rect.height)
        const travel = reach * Math.pow(progress, 0.8)
        for (let index = 0; index < (pressed ? 3 : 2); index += 1) {
          const radius = travel - index * (pressed ? 13 : 10)
          if (radius <= 0) continue
          const fade =
            (Math.sin((Math.min(1, radius / 8) * Math.PI) / 2) * Math.pow(1 - progress, 1.8)) / (1 + index * 0.6)
          const strength = fade * (pressed ? 0.6 : 0.3)
          const reflection = context.createLinearGradient(
            originX - radius,
            originY - radius,
            originX + radius,
            originY + radius
          )
          reflection.addColorStop(0, `rgba(255, 252, 237, ${strength})`)
          reflection.addColorStop(0.45, `rgba(255, 252, 237, ${strength * 0.3})`)
          reflection.addColorStop(0.7, `rgba(70, 86, 86, ${strength * 0.35})`)
          reflection.addColorStop(1, `rgba(255, 252, 237, ${strength * 0.5})`)
          traceWave(radius, progress)
          context.strokeStyle = reflection
          context.lineWidth = pressed ? 1.2 : 0.8
          context.stroke()
          traceWave(Math.max(0.1, radius - 1.5), progress)
          context.strokeStyle = `rgba(52, 70, 69, ${strength * 0.12})`
          context.lineWidth = 0.7
          context.stroke()
        }
        running.set(ripple, window.requestAnimationFrame(draw))
      }
      running.set(ripple, window.requestAnimationFrame(draw))
    }

    const handleOver = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      const action = getAction(event.target)
      if (action === hovered) return
      hovered = action
      if (action) emitRipple(action, false, { x: event.clientX, y: event.clientY })
    }
    const handleOut = (event: PointerEvent) => {
      if (getAction(event.relatedTarget) !== hovered) hovered = null
    }
    const handleClick = (event: MouseEvent) => {
      if (typeof PointerEvent !== 'undefined' && event instanceof PointerEvent && event.pointerType === 'touch') return
      const action = getAction(event.target)
      if (action) emitRipple(action, true, event.detail === 0 ? undefined : { x: event.clientX, y: event.clientY })
    }
    const handleFocus = (event: FocusEvent) => {
      const action = getAction(event.target)
      if (action?.matches(':focus-visible')) emitRipple(action, false)
    }

    syncPointer()
    pointer.addEventListener('change', syncPointer)
    reducedMotion.addEventListener('change', clearRipples)
    document.addEventListener('pointerover', handleOver, { passive: true })
    document.addEventListener('pointerout', handleOut, { passive: true })
    document.addEventListener('click', handleClick, true)
    document.addEventListener('focusin', handleFocus)
    document.addEventListener('scroll', clearRipples, { capture: true, passive: true })
    document.addEventListener('pointerleave', clearRipples)
    window.addEventListener('blur', clearRipples)
    window.addEventListener('resize', clearRipples)

    return () => {
      clearRipples()
      pointer.removeEventListener('change', syncPointer)
      reducedMotion.removeEventListener('change', clearRipples)
      document.removeEventListener('pointerover', handleOver)
      document.removeEventListener('pointerout', handleOut)
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('focusin', handleFocus)
      document.removeEventListener('scroll', clearRipples, true)
      document.removeEventListener('pointerleave', clearRipples)
      window.removeEventListener('blur', clearRipples)
      window.removeEventListener('resize', clearRipples)
      document.documentElement.classList.remove('has-brush-cursor')
    }
  }, [mounted])

  if (!mounted || typeof document === 'undefined') return null
  return createPortal(<div ref={ripplesRef} className="button-water-ripples" aria-hidden="true" />, document.body)
}
