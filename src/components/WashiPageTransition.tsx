import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { sumiAudio } from '../features/dictionary/sumiAudio'
import '../styles/page-transition.css'

export default function WashiPageTransition() {
  const location = useLocation()
  const [isTransitioning, setIsTransitioning] = useState(false)

  useEffect(() => {
    // Only trigger mist overlay when View Transitions API is not available
    const supportsViewTransition = typeof document !== 'undefined' && 'startViewTransition' in document
    if (supportsViewTransition) return

    setIsTransitioning(true)
    sumiAudio.playWindSwoosh()

    const timer = setTimeout(() => {
      setIsTransitioning(false)
    }, 320)

    return () => clearTimeout(timer)
  }, [location.pathname, location.search])

  return (
    <div
      className={`washi-mist-overlay ${isTransitioning ? 'is-active' : ''}`}
      aria-hidden="true"
    />
  )
}
