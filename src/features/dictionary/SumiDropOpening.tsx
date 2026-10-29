import React, { useEffect, useRef } from 'react'
import { sumiAudio } from './sumiAudio'

interface SumiDropOpeningProps {
  onComplete?: () => void
}

export const SumiDropOpening: React.FC<SumiDropOpeningProps> = ({ onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animFrameRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Sound effect upon droplet impact
    sumiAudio.initOnGesture()
    setTimeout(() => {
      sumiAudio.playSuikinkutsu()
    }, 450)

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const width = 640
    const height = 360
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.scale(dpr, dpr)

    const startTime = performance.now()
    const centerX = width / 2
    const centerY = height / 2

    // Procedural organic bleeding lobes
    const lobes: { angle: number; reach: number; speed: number }[] = []
    const lobeCount = 28
    for (let i = 0; i < lobeCount; i++) {
      lobes.push({
        angle: (i / lobeCount) * Math.PI * 2,
        reach: 0.8 + Math.random() * 0.45,
        speed: 0.7 + Math.random() * 0.6,
      })
    }

    const render = (now: number) => {
      const elapsed = (now - startTime) / 1000 // in seconds

      ctx.clearRect(0, 0, width, height)

      // Phase 1: Droplet falling (0s - 0.45s)
      if (elapsed < 0.45) {
        const progress = elapsed / 0.45
        const dropY = centerY - 90 + progress * 90
        const dropRadius = 5 - progress * 1.5

        ctx.save()
        ctx.beginPath()
        ctx.arc(centerX, dropY, dropRadius, 0, Math.PI * 2)
        ctx.fillStyle = '#1c1917'
        ctx.fill()
        ctx.restore()
      }

      // Phase 2 & 3: Ink Impact & Organic Bleed Bloom (0.45s onwards)
      if (elapsed >= 0.45) {
        const bleedTime = elapsed - 0.45
        const baseRadius = Math.min(62, bleedTime * 42)
        const alpha = Math.max(0, 1 - bleedTime * 0.28)

        // 1. Concentric shockwave ripple
        const rippleR = bleedTime * 110
        if (rippleR < 180) {
          ctx.save()
          ctx.beginPath()
          ctx.arc(centerX, centerY, rippleR, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(180, 160, 140, ${(1 - rippleR / 180) * 0.35})`
          ctx.lineWidth = 1.5
          ctx.stroke()
          ctx.restore()
        }

        // 2. Organic ink bleed bloom on washi paper
        ctx.save()
        ctx.beginPath()
        for (let i = 0; i < lobes.length; i++) {
          const l = lobes[i]
          if (!l) continue
          const r = baseRadius * l.reach * Math.min(1.2, 1 + bleedTime * l.speed * 0.3)
          const px = centerX + Math.cos(l.angle) * r
          const py = centerY + Math.sin(l.angle) * r
          if (i === 0) {
            ctx.moveTo(px, py)
          } else {
            ctx.lineTo(px, py)
          }
        }
        ctx.closePath()

        const bleedGrad = ctx.createRadialGradient(centerX, centerY, 4, centerX, centerY, baseRadius * 1.3)
        bleedGrad.addColorStop(0, `rgba(28, 25, 23, ${alpha * 0.95})`)
        bleedGrad.addColorStop(0.5, `rgba(45, 40, 36, ${alpha * 0.75})`)
        bleedGrad.addColorStop(0.85, `rgba(75, 68, 62, ${alpha * 0.35})`)
        bleedGrad.addColorStop(1, 'rgba(250, 248, 245, 0)')
        ctx.fillStyle = bleedGrad
        ctx.shadowColor = 'rgba(28, 25, 23, 0.4)'
        ctx.shadowBlur = 12
        ctx.fill()
        ctx.restore()

        // 3. Central seal / seed
        ctx.save()
        ctx.beginPath()
        ctx.arc(centerX, centerY, Math.max(3, 8 - bleedTime * 4), 0, Math.PI * 2)
        ctx.fillStyle = '#1c1917'
        ctx.fill()
        ctx.restore()
      }

      if (elapsed < 2.5) {
        animFrameRef.current = requestAnimationFrame(render)
      } else if (onComplete) {
        onComplete()
      }
    }

    animFrameRef.current = requestAnimationFrame(render)

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [onComplete])

  return (
    <div className="sumi-opening-container" aria-label="Đang khai mở không gian thủy mặc Hán tự">
      <canvas ref={canvasRef} className="sumi-opening-canvas" />
      <div className="sumi-opening-meta">
        <div className="sumi-opening-jp">墨滴が和紙に滲む</div>
        <div className="sumi-opening-vi">Giọt mực đang loang trên thớ giấy dó...</div>
      </div>
    </div>
  )
}
export default SumiDropOpening
