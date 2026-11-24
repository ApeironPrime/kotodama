import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useReducedMotion } from './useReducedMotion'

/**
 * Exact cubic-bezier(0.22, 1, 0.36, 1) solver for GSAP tweens
 * (fast initial paper snap, crisp zero-overshoot settle).
 */
function createCubicBezierEase(x1: number, y1: number, x2: number, y2: number): (p: number) => number {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t
  const sampleDerivX = (t: number) => (3 * ax * t + 2 * bx) * t + cx
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t

  return (p: number) => {
    if (p <= 0) return 0
    if (p >= 1) return 1
    let t = p
    for (let i = 0; i < 6; i++) {
      const dx = sampleX(t) - p
      if (Math.abs(dx) < 1e-6) break
      const d = sampleDerivX(t)
      if (Math.abs(d) < 1e-6) break
      t -= dx / d
    }
    return sampleY(Math.min(1, Math.max(0, t)))
  }
}

const WASHI_OUT_EASE = createCubicBezierEase(0.22, 1, 0.36, 1)

export type CardAdvanceAction = 'pass' | 'miss' | 'next' | 'prev'

export interface OutgoingCardSnapshot {
  seq: number
  action: CardAdvanceAction
  term: string
  wasFlipped: boolean
}

export function usePaperCardPhysics() {
  const reducedMotion = useReducedMotion()

  const [isFlipped, setIsFlipped] = useState(false)
  const [hasFlippedCard, setHasFlippedCard] = useState(false)
  const [instantCardSwap, setInstantCardSwap] = useState(false)
  const [outgoingGhost, setOutgoingGhost] = useState<OutgoingCardSnapshot | null>(null)
  const [stampTriggerSeq, setStampTriggerSeq] = useState(0)

  const activeWrapRef = useRef<HTMLDivElement>(null)
  const flipperRef = useRef<HTMLDivElement>(null)
  const ghostRef = useRef<HTMLDivElement>(null)
  const stack1Ref = useRef<HTMLDivElement>(null)
  const stack2Ref = useRef<HTMLDivElement>(null)

  const seqRef = useRef(0)
  const pendingAdvanceRef = useRef<CardAdvanceAction | null>(null)
  const ghostCleanupTimerRef = useRef<number | null>(null)
  const isFlippedRef = useRef(false)

  useEffect(() => {
    isFlippedRef.current = isFlipped
  }, [isFlipped])

  useEffect(() => {
    const activeWrap = activeWrapRef.current
    const flipper = flipperRef.current
    const ghost = ghostRef.current
    const stack1 = stack1Ref.current
    const stack2 = stack2Ref.current
    return () => {
      if (ghostCleanupTimerRef.current) window.clearTimeout(ghostCleanupTimerRef.current)
      gsap.killTweensOf([activeWrap, flipper, ghost, stack1, stack2])
    }
  }, [])

  const animateFlipTo = useCallback(
    (nextFlipped: boolean) => {
      setInstantCardSwap(false)
      if (nextFlipped) setHasFlippedCard(true)
      setIsFlipped(nextFlipped)
      isFlippedRef.current = nextFlipped

      if (reducedMotion) return
      const flipper = flipperRef.current
      if (!flipper) return

      gsap.killTweensOf(flipper)
      const rawCurrent = Number(gsap.getProperty(flipper, 'rotationY'))
      const currentRot = Number.isFinite(rawCurrent) ? rawCurrent : nextFlipped ? 0 : 180
      const targetRot = nextFlipped ? 180 : 0
      const delta = Math.abs(targetRot - currentRot)

      if (delta < 1) {
        gsap.set(flipper, { rotationY: targetRot, scale: 1, y: 0 })
        delete flipper.dataset['lifting']
        return
      }

      const crossesMidpoint = (nextFlipped && currentRot < 86) || (!nextFlipped && currentRot > 94)

      if (crossesMidpoint) {
        const firstLegRatio = Math.min(1, Math.max(0.35, Math.abs(90 - currentRot) / 90))
        flipper.dataset['lifting'] = 'true'
        const tl = gsap.timeline({
          onComplete: () => {
            delete flipper.dataset['lifting']
          },
        })
        tl.to(flipper, {
          rotationY: 90,
          scale: 1.03,
          y: -5,
          duration: 0.11 * firstLegRatio,
          ease: 'power1.in',
        }).to(flipper, {
          rotationY: targetRot,
          scale: 1,
          y: 0,
          duration: 0.15,
          ease: WASHI_OUT_EASE,
        })
      } else {
        delete flipper.dataset['lifting']
        gsap.to(flipper, {
          rotationY: targetRot,
          scale: 1,
          y: 0,
          duration: Math.max(0.12, 0.24 * (delta / 180)),
          ease: WASHI_OUT_EASE,
        })
      }
    },
    [reducedMotion]
  )

  const toggleFlip = useCallback(() => {
    animateFlipTo(!isFlippedRef.current)
  }, [animateFlipTo])

  const resetWithoutAnimation = useCallback(() => {
    const flipper = flipperRef.current
    if (flipper) {
      gsap.killTweensOf(flipper)
      delete flipper.dataset['lifting']
      gsap.set(flipper, { clearProps: 'transform' })
    }
    setInstantCardSwap(true)
    setIsFlipped(false)
    isFlippedRef.current = false
    setHasFlippedCard(false)
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => setInstantCardSwap(false))
    } else {
      setInstantCardSwap(false)
    }
  }, [])

  const triggerStampInPlace = useCallback(() => {
    setStampTriggerSeq((s) => s + 1)
    if (reducedMotion || !activeWrapRef.current) return
    gsap.killTweensOf(activeWrapRef.current)
    gsap.fromTo(
      activeWrapRef.current,
      { scale: 0.992 },
      { scale: 1, duration: 0.16, ease: WASHI_OUT_EASE, clearProps: 'transform' }
    )
  }, [reducedMotion])

  const triggerCardAdvance = useCallback(
    (action: CardAdvanceAction, currentTerm: string) => {
      if (action === 'pass') {
        setStampTriggerSeq((s) => s + 1)
      }

      const wasFlipped = isFlippedRef.current

      const flipper = flipperRef.current
      if (flipper) {
        gsap.killTweensOf(flipper)
        delete flipper.dataset['lifting']
        gsap.set(flipper, { clearProps: 'transform' })
      }

      setInstantCardSwap(true)
      setIsFlipped(false)
      isFlippedRef.current = false
      setHasFlippedCard(false)

      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => setInstantCardSwap(false))
      } else {
        setInstantCardSwap(false)
      }

      if (reducedMotion) {
        setOutgoingGhost(null)
        return
      }

      const nextSeq = ++seqRef.current
      pendingAdvanceRef.current = action

      if (action !== 'prev') {
        setOutgoingGhost({
          seq: nextSeq,
          action,
          term: currentTerm,
          wasFlipped,
        })
        if (ghostCleanupTimerRef.current) window.clearTimeout(ghostCleanupTimerRef.current)
        ghostCleanupTimerRef.current = window.setTimeout(() => {
          setOutgoingGhost((prev) => (prev?.seq === nextSeq ? null : prev))
        }, 290)
      } else {
        setOutgoingGhost(null)
      }
    },
    [reducedMotion]
  )

  useLayoutEffect(() => {
    const action = pendingAdvanceRef.current
    if (!action || reducedMotion) return
    pendingAdvanceRef.current = null

    const activeEl = activeWrapRef.current
    const ghostEl = ghostRef.current
    const s1 = stack1Ref.current
    const s2 = stack2Ref.current

    gsap.killTweensOf([activeEl, ghostEl, s1, s2])

    if (action === 'prev') {
      if (activeEl) {
        gsap.fromTo(
          activeEl,
          { x: -104, y: -4, rotation: -2.5, scale: 1.01 },
          { x: 0, y: 0, rotation: 0, scale: 1, duration: 0.24, ease: WASHI_OUT_EASE, clearProps: 'transform' }
        )
      }
      return
    }

    if (ghostEl) {
      const targetX = action === 'pass' ? 148 : action === 'miss' ? -148 : -96
      const targetY = action === 'pass' ? -5 : 6
      const targetRot = action === 'pass' ? 5 : action === 'miss' ? -5 : -2.5

      gsap.fromTo(
        ghostEl,
        { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1 },
        {
          x: targetX,
          y: targetY,
          rotation: targetRot,
          scale: 0.99,
          opacity: 0,
          duration: 0.25,
          ease: WASHI_OUT_EASE,
        }
      )
    }

    if (activeEl) {
      gsap.fromTo(
        activeEl,
        { scale: 0.96, y: 8, x: 0, rotation: 0 },
        { scale: 1, y: 0, x: 0, rotation: 0, duration: 0.25, ease: WASHI_OUT_EASE, clearProps: 'transform' }
      )
    }

    if (s1) {
      gsap.fromTo(
        s1,
        { scale: 0.925, y: 15 },
        { scale: 0.96, y: 8, duration: 0.25, ease: WASHI_OUT_EASE, clearProps: 'transform' }
      )
    }

    if (s2) {
      gsap.fromTo(
        s2,
        { scale: 0.9, y: 20, opacity: 0 },
        { scale: 0.925, y: 15, opacity: 0.72, duration: 0.25, ease: WASHI_OUT_EASE, clearProps: 'transform,opacity' }
      )
    }
  })

  return {
    isFlipped,
    hasFlippedCard,
    instantCardSwap,
    outgoingGhost,
    stampTriggerSeq,
    reducedMotion,
    activeWrapRef,
    flipperRef,
    ghostRef,
    stack1Ref,
    stack2Ref,
    animateFlipTo,
    toggleFlip,
    resetWithoutAnimation,
    triggerStampInPlace,
    triggerCardAdvance,
  }
}
