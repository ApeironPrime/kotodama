import { useEffect, useRef } from 'react'

const clamp = (value: number) => Math.min(1, Math.max(0, value))
const smoothstep = (start: number, end: number, value: number) => {
  const progress = clamp((value - start) / (end - start))
  return progress * progress * (3 - 2 * progress)
}

export default function HomeStory() {
  const storyRef = useRef<HTMLElement>(null)
  const glyphCanvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const story = storyRef.current
    if (!story) return

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (reducedMotion?.matches) return

    const letters = Array.from(story.querySelectorAll<HTMLElement>('[data-ink-character]')).map((node) => ({
      node,
      verse: Number(node.dataset['inkVerse']),
      delay: Number(node.dataset['inkDelay']),
    }))
    const canvas = glyphCanvasRef.current
    const context = typeof CanvasRenderingContext2D === 'undefined' ? null : canvas?.getContext('2d')
    let firstPoints: Array<[number, number]> = []
    let secondPoints: Array<[number, number]> = []
    let glyphFont = 'serif'

    const sampleGlyph = (glyph: string, font: string) => {
      const buffer = document.createElement('canvas')
      buffer.width = 400
      buffer.height = 400
      const brush = buffer.getContext('2d')
      if (!brush) return [] as Array<[number, number]>
      brush.fillStyle = '#222'
      brush.font = `300 315px ${font}`
      brush.textAlign = 'center'
      brush.textBaseline = 'middle'
      brush.fillText(glyph, 200, 211)
      const pixels = brush.getImageData(0, 0, 400, 400).data
      const points: Array<[number, number]> = []
      for (let y = 30; y < 370; y += 3) {
        for (let x = 30; x < 370; x += 3) {
          if ((pixels[(y * 400 + x) * 4 + 3] ?? 0) > 90) points.push([x, y])
        }
      }
      return points
    }

    const prepareGlyph = () => {
      if (!canvas || !context) return
      const size = Math.max(1, canvas.clientWidth)
      const dpr = Math.min(1.5, window.devicePixelRatio || 1)
      canvas.width = Math.round(size * dpr)
      canvas.height = Math.round(size * dpr)
      context.setTransform(canvas.width / 400, 0, 0, canvas.height / 400, 0, 0)
      glyphFont = window.getComputedStyle(canvas).fontFamily || 'serif'
      firstPoints = sampleGlyph('言', glyphFont)
      secondPoints = sampleGlyph('道', glyphFont)
      if (firstPoints.length && secondPoints.length) canvas.parentElement?.classList.add('is-canvas-ready')
    }

    const renderGlyph = (value: number) => {
      if (!canvas || !context || !firstPoints.length || !secondPoints.length) return
      context.clearRect(0, 0, 400, 400)
      const progress = smoothstep(0, 1, value)
      const dissolve = Math.sin(Math.PI * progress)
      const scatter = dissolve * 23
      const count = Math.max(firstPoints.length, secondPoints.length)
      context.font = `300 315px ${glyphFont}`
      context.textAlign = 'center'
      context.textBaseline = 'middle'

      // Clean cross-dissolve: Only draw active glyph or particles, never stacked
      if (progress < 0.25) {
        context.fillStyle = `rgba(39, 36, 31, ${0.075 * (1 - progress * 4)})`
        context.fillText('言', 200, 211)
      } else if (progress > 0.75) {
        context.fillStyle = `rgba(39, 36, 31, ${0.075 * ((progress - 0.75) * 4)})`
        context.fillText('道', 200, 211)
      }

      // Particle dissolution transition
      context.fillStyle = `rgba(39, 36, 31, ${0.025 + dissolve * 0.1})`
      for (let i = 0; i < count; i += 1) {
        const start = firstPoints[Math.floor((i / count) * firstPoints.length)] ?? [200, 200]
        const end = secondPoints[Math.floor((i / count) * secondPoints.length)] ?? [200, 200]
        const x = start[0] + (end[0] - start[0]) * progress + Math.sin(i * 12.37) * (scatter + 1.5)
        const y = start[1] + (end[1] - start[1]) * progress + Math.cos(i * 8.71) * (scatter + 1.5)
        context.fillRect(x, y, 7, 7)
      }
    }

    prepareGlyph()

    const verseElements = [
      story.querySelector<HTMLElement>('.showcase-story__verse--first'),
      story.querySelector<HTMLElement>('.showcase-story__verse--second'),
      story.querySelector<HTMLElement>('.showcase-story__verse--third'),
    ]

    const applyProgress = (progress: number) => {
      // 360svh Pinning: 260svh (~2100px) of dedicated storytelling scroll travel
      // Phase 1: Verse 1 ("Một nét mực.") holds firmly from 0.00 -> 0.32
      // Transition 1: 0.32 -> 0.42 (Dissolve '言' into floating ink particles)
      // Phase 2: Verse 2 ("Một lời được hiểu.") holds prominently from 0.42 -> 0.70 (~600px of scroll! NEVER skipped!)
      // Transition 2: 0.70 -> 0.80 (Reassembles into '道')
      // Phase 3: Verse 3 ("Một con đường mở ra.") locks from 0.80 -> 1.00
      const strengths = [
        1 - smoothstep(0.22, 0.32, progress),
        smoothstep(0.38, 0.46, progress) * (1 - smoothstep(0.64, 0.72, progress)),
        smoothstep(0.76, 0.86, progress),
      ]

      story.style.setProperty('--story-first', String(strengths[0]))
      story.style.setProperty('--story-second', String(strengths[1]))
      story.style.setProperty('--story-third', String(strengths[2]))
      story.style.setProperty('--story-glyph-first', String((1 - smoothstep(0.32, 0.72, progress)) * 0.09))
      story.style.setProperty('--story-glyph-second', String(smoothstep(0.32, 0.72, progress) * 0.09))
      story.style.setProperty('--story-line', `${Math.round(progress * 100)}%`)
      story.style.setProperty('--story-translate', `${Math.round(progress * -50)}px`)

      verseElements.forEach((el, idx) => {
        if (!el) return
        const str = strengths[idx] ?? 0
        el.style.opacity = String(str)
        el.style.visibility = str > 0.005 ? 'visible' : 'hidden'
      })

      for (const { node, verse, delay } of letters) {
        const vStrength = strengths[verse] ?? 0
        const visible = vStrength > 0.005 ? smoothstep(0, 1, clamp((vStrength - delay) / 0.22)) : 0
        node.style.opacity = String(visible)
        node.style.transform = `translate3d(0, ${((1 - visible) * 24).toFixed(1)}px, 0)`
        node.style.filter = `blur(${((1 - visible) * 4).toFixed(1)}px)`
      }

      renderGlyph(smoothstep(0.32, 0.72, progress))
    }

    let frame = 0
    const update = () => {
      frame = 0
      const bounds = story.getBoundingClientRect()
      const travel = Math.max(1, bounds.height - window.innerHeight)
      const progress = clamp(-bounds.top / travel)
      applyProgress(progress)
    }

    const requestUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }

    // Initial update
    update()

    window.addEventListener('scroll', requestUpdate, { passive: true })
    const onResize = () => {
      prepareGlyph()
      requestUpdate()
    }
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('scroll', requestUpdate)
      window.removeEventListener('resize', onResize)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <section id="story" className="showcase-story" ref={storyRef} aria-label="Từ một nét mực đến một hành trình">
      <div className="showcase-story__stage">
        <div className="showcase-story__circle" aria-hidden="true" />
        <span className="showcase-story__eyebrow">序章 · MỘT NÉT MỰC</span>
        <div className="showcase-story__glyph" aria-hidden="true">
          <span className="showcase-story__glyph-first">言</span>
          <span className="showcase-story__glyph-second">道</span>
          <canvas ref={glyphCanvasRef} className="showcase-story__glyph-canvas" />
        </div>
        <div className="showcase-story__verses">
          <StoryVerse index={0} text="Một nét mực." />
          <StoryVerse index={1} text="Một lời được hiểu." />
          <StoryVerse index={2} text="Một con đường mở ra." />
        </div>
        <span className="showcase-story__japanese" aria-hidden="true">
          一筆から、世界へ。
        </span>
        <div className="showcase-story__track" aria-hidden="true">
          <span />
        </div>
      </div>
    </section>
  )
}

function StoryVerse({ index, text }: { index: number; text: string }) {
  const words = text.split(' ')
  const count = Array.from(text.replaceAll(' ', '')).length
  let position = 0
  return (
    <p
      className={`showcase-story__verse showcase-story__verse--${['first', 'second', 'third'][index]}`}
      aria-label={text}
    >
      {words.map((word, wordIndex) => (
        <span className="showcase-story__word" key={`${index}-${wordIndex}`} aria-hidden="true">
          {Array.from(word).map((character, characterIndex) => {
            const delay = ((position++ / Math.max(1, count - 1)) * 0.2).toFixed(3)
            return (
              <span
                className="showcase-story__character"
                data-ink-character
                data-ink-verse={index}
                data-ink-delay={delay}
                key={`${wordIndex}-${characterIndex}`}
              >
                {character}
              </span>
            )
          })}
        </span>
      ))}
    </p>
  )
}
