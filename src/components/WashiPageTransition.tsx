import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import '../styles/page-transition.css'

export default function WashiPageTransition() {
  const location = useLocation()
  const [isTransitioning, setIsTransitioning] = useState(false)

  useEffect(() => {
    // Only trigger mist overlay when View Transitions API is not available
    const supportsViewTransition = typeof document !== 'undefined' && 'startViewTransition' in document
    if (supportsViewTransition) return

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    setIsTransitioning(true)

    const timer = setTimeout(() => {
      setIsTransitioning(false)
    }, 320)

    return () => clearTimeout(timer)
  }, [location.pathname, location.search])

  return <div className={`washi-mist-overlay ${isTransitioning ? 'is-active' : ''}`} aria-hidden="true" />
}
