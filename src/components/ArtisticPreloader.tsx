import { useEffect, useRef, useState } from 'react'
import { sumiAudio } from '../features/dictionary/sumiAudio'
import '../styles/preloader.css'

interface ArtisticPreloaderProps {
  onLoaded?: () => void
}

export default function ArtisticPreloader({ onLoaded }: ArtisticPreloaderProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isExiting, setIsExiting] = useState(false)
  const [isUnmounted, setIsUnmounted] = useState(false)

  useEffect(() => {
    try {
      if (sessionStorage.getItem('kotodama_preloaded')) {
        setIsUnmounted(true)
        onLoaded?.()
        return
      }
      sessionStorage.setItem('kotodama_preloaded', '1')
    } catch {
      // ignore
    }

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Sound effect upon droplet impact
    sumiAudio.initOnGesture()
    const soundTimer = setTimeout(() => {
      sumiAudio.playSuikinkutsu()
    }, 450)

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const size = 440
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    const startTime = performance.now()
    const cx = size / 2
    const cy = size / 2

    // Check when fonts and assets are ready (Eliminates FOUT/FOIT 100%)
    let assetsReady = false
    const unlockAssets = () => {
      assetsReady = true
    }
    if (document.fonts?.ready) {
      document.fonts.ready.then(unlockAssets).catch(unlockAssets)
    } else {
      unlockAssets()
    }
    const maxSafetyTimer = setTimeout(unlockAssets, 1600)

    let reqId = 0

    const render = (now: number) => {
      const elapsed = (now - startTime) / 1000 // seconds

      ctx.clearRect(0, 0, size, size)

      // Phase 1: Droplet falling (0s - 0.45s)
      if (elapsed < 0.45) {
        const progress = elapsed / 0.45
        const dropY = cy - 110 + progress * 110
        const dropRadius = 6.5 - progress * 2.2

        ctx.save()
        ctx.beginPath()
        ctx.arc(cx, dropY, dropRadius, 0, Math.PI * 2)
        ctx.fillStyle = '#b82e2e'
        ctx.shadowColor = 'rgba(184, 46, 46, 0.4)'
        ctx.shadowBlur = 8
        ctx.fill()
        ctx.restore()
      }

      // Phase 2: Impact & Ensō circle bloom (0.45s - 1.8s)
      if (elapsed >= 0.45) {
        const bloomTime = elapsed - 0.45

        // 1. Concentric water ripple
        const rippleR = bloomTime * 130
        if (rippleR < 200) {
          ctx.save()
          ctx.beginPath()
          ctx.arc(cx, cy, rippleR, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(184, 46, 46, ${Math.max(0, 0.45 - rippleR / 200)})`
          ctx.lineWidth = 1.4
          ctx.stroke()
          ctx.restore()
        }

        // 2. Japanese Zen Ensō (円相) Brushstroke Circle
        const ensoProgress = Math.min(1, bloomTime / 0.95)
        const startAngle = -Math.PI * 0.5
        const endAngle = startAngle + ensoProgress * Math.PI * 1.95 // Almost completes circle (Zen opening)

        ctx.save()
        ctx.beginPath()
        ctx.arc(cx, cy, 78, startAngle, endAngle, false)
        ctx.strokeStyle = '#b82e2e'
        ctx.lineWidth = 9 + Math.sin(ensoProgress * Math.PI) * 4
        ctx.lineCap = 'round'
        ctx.shadowColor = 'rgba(184, 46, 46, 0.25)'
        ctx.shadowBlur = 12
        ctx.stroke()
        ctx.restore()

        // 3. Central Vermilion Core Seed
        const coreAlpha = Math.max(0.3, 1 - bloomTime * 0.6)
        ctx.save()
        ctx.beginPath()
        ctx.arc(cx, cy, Math.max(4, 8 - bloomTime * 3.5), 0, Math.PI * 2)
        ctx.fillStyle = `rgba(184, 46, 46, ${coreAlpha})`
        ctx.fill()
        ctx.restore()
      }

      // Transition out once min animation time (1.6s) and assets are ready
      if (elapsed >= 1.6 && assetsReady) {
        setIsExiting(true)
        setTimeout(() => {
          setIsUnmounted(true)
          onLoaded?.()
        }, 800)
        return
      }

      reqId = requestAnimationFrame(render)
    }

    reqId = requestAnimationFrame(render)

    return () => {
      clearTimeout(soundTimer)
      clearTimeout(maxSafetyTimer)
      if (reqId) cancelAnimationFrame(reqId)
    }
  }, [onLoaded])

  if (isUnmounted) return null

  return (
    <aside
      className={`artistic-preloader ${isExiting ? 'is-exiting' : ''}`}
      aria-label="Khai mở không gian Kotodama"
    >
      <canvas ref={canvasRef} className="artistic-preloader__canvas" />
      <div className="artistic-preloader__meta" aria-hidden="true">
        <span className="artistic-preloader__kanji">言霊 · 和紙</span>
        <span className="artistic-preloader__sub">Khởi sự từ một nét son</span>
      </div>
    </aside>
  )
}
