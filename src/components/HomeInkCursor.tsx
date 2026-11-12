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
    const running = new Map<HTMLElement, Animation[]>()

    const clearRipples = () => {
      for (const [ripple, animations] of running) {
        animations.forEach((animation) => animation.cancel())
        ripple.remove()
      }
      running.clear()
      hovered = null
    }

    const syncPointer = () => {
      document.documentElement.classList.toggle('has-brush-cursor', pointer.matches)
      clearRipples()
    }

    const emitRipple = (action: HTMLElement, pressed: boolean) => {
      if (!pointer.matches || reducedMotion.matches) return
      const rect = action.getBoundingClientRect()
      if (!rect.width || !rect.height) return

      // Bound the number of effects, even when moving rapidly through a dense list.
      while (running.size >= 6) {
        const oldest = running.entries().next().value
        if (!oldest) break
        oldest[1].forEach((animation) => animation.cancel())
        oldest[0].remove()
        running.delete(oldest[0])
      }

      const ripple = document.createElement('span')
      ripple.className = `button-water-ripple${pressed ? ' is-pressed' : ''}`
      ripple.style.left = `${rect.left + rect.width / 2}px`
      ripple.style.top = `${rect.top + rect.height / 2}px`
      ripple.style.width = `${rect.width + 12}px`
      ripple.style.height = `${rect.height + 12}px`
      layer.appendChild(ripple)

      const animations = [0, 1].map((index) => {
        const ring = document.createElement('i')
        ripple.appendChild(ring)
        return ring.animate(
          [
            { transform: 'scale(0.82)', opacity: 0 },
            { opacity: pressed ? 0.42 : 0.22, offset: 0.18 },
            { transform: `scale(${pressed ? 1.42 : 1.2})`, opacity: 0 },
          ],
          {
            duration: pressed ? 1050 : 900,
            delay: index * (pressed ? 130 : 170),
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            fill: 'both',
          }
        )
      })
      running.set(ripple, animations)
      void Promise.all(animations.map((animation) => animation.finished))
        .catch(() => undefined)
        .then(() => {
          ripple.remove()
          running.delete(ripple)
        })
    }

    const handleOver = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      const action = getAction(event.target)
      if (action === hovered) return
      hovered = action
      if (action) emitRipple(action, false)
    }
    const handleOut = (event: PointerEvent) => {
      if (getAction(event.relatedTarget) !== hovered) hovered = null
    }
    const handleClick = (event: MouseEvent) => {
      if (typeof PointerEvent !== 'undefined' && event instanceof PointerEvent && event.pointerType === 'touch') return
      const action = getAction(event.target)
      if (action) emitRipple(action, true)
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
