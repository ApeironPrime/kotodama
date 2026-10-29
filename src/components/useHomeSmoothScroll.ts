import { useEffect } from 'react'

/** Initializes Lenis smooth scroll for desktop browsers to ensure silky-smooth scrollytelling. */
export function useHomeSmoothScroll() {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const eligible = window.matchMedia('(min-width: 701px) and (prefers-reduced-motion: no-preference)')
    let disposed = false
    let instance: { destroy: () => void } | null = null

    const sync = () => {
      if (!eligible.matches) {
        instance?.destroy()
        instance = null
        return
      }
      if (instance) return

      void import('lenis').then(({ default: Lenis }) => {
        if (disposed || !eligible.matches || instance) return

        instance = new Lenis({
          autoRaf: true,
          anchors: true,
          duration: 1.15,
          wheelMultiplier: 0.88,
          touchMultiplier: 1,
        })
      })
    }

    sync()
    eligible.addEventListener('change', sync)
    return () => {
      disposed = true
      eligible.removeEventListener('change', sync)
      instance?.destroy()
    }
  }, [])
}
