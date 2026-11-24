import { flushSync } from 'react-dom'

export type SpatialDirection = 'forward' | 'back'

let lastSpatialDirection: SpatialDirection = 'forward'

export function getLastSpatialDirection(): SpatialDirection {
  return lastSpatialDirection
}

/**
 * Runs a directional spatial slide transition scoped strictly to `.library-stage-viewport`
 * (keeping sticky Navbar and Library Tab Bar completely still with zero blur/blink).
 */
export function runSpatialTransition(direction: SpatialDirection, update: () => void): void {
  lastSpatialDirection = direction

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    update()
    return
  }

  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    update()
    return
  }

  const doc = document as Document & {
    startViewTransition?: (callback: () => void) => { finished: Promise<void> }
  }

  if (typeof doc.startViewTransition === 'function') {
    const root = document.documentElement
    root.dataset['vtScope'] = 'library'
    root.dataset['vtDir'] = direction

    try {
      const transition = doc.startViewTransition(() => {
        flushSync(() => {
          update()
        })
      })
      void transition.finished.finally(() => {
        if (root.dataset['vtScope'] === 'library') {
          delete root.dataset['vtScope']
          delete root.dataset['vtDir']
        }
      })
      return
    } catch {
      delete root.dataset['vtScope']
      delete root.dataset['vtDir']
    }
  }

  update()
}
