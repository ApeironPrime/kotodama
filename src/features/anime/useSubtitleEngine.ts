import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AnimeSubtitleCue } from './animePlaybackTypes'
import { animePlaybackApi } from './animePlaybackApi'
import {
  computeWindowForTime,
  deduplicateAndSortCues,
  findActiveCues,
  isTimeInRanges,
  type WindowRange,
} from './subtitleEngineUtils'

export interface SubtitleEngineState {
  cues: AnimeSubtitleCue[]
  activeCues: AnimeSubtitleCue[]
  isLoading: boolean
  isPrefetching: boolean
  error: string | null
  offset: number
  showJapanese: boolean
  showVietnamese: boolean
  showFurigana: boolean
  hasFuriganaData: boolean
  setOffset: (offset: number) => void
  resetOffset: () => void
  setShowJapanese: (show: boolean) => void
  setShowVietnamese: (show: boolean) => void
  setShowFurigana: (show: boolean) => void
  retry: () => void
}

interface UseSubtitleEngineProps {
  episodeId: string | null
  hasSubtitles: boolean
  currentTime: number
  windowSize?: number
  prefetchThreshold?: number
}

export function useSubtitleEngine({
  episodeId,
  hasSubtitles,
  currentTime,
  windowSize = 120,
  prefetchThreshold = 25,
}: UseSubtitleEngineProps): SubtitleEngineState {
  const [cues, setCues] = useState<AnimeSubtitleCue[]>([])
  const [maxDuration, setMaxDuration] = useState<number>(10)
  const [loadedRanges, setLoadedRanges] = useState<WindowRange[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isPrefetching, setIsPrefetching] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Subtitle Controls State
  const [offset, setOffsetState] = useState<number>(0.0)
  const [showJapanese, setShowJapanese] = useState<boolean>(true)
  const [showVietnamese, setShowVietnamese] = useState<boolean>(true)
  const [showFurigana, setShowFurigana] = useState<boolean>(false)

  // In-flight window keys tracking to prevent duplicate concurrent requests
  const inFlightRangesRef = useRef<Set<string>>(new Set())
  const activeEpisodeIdRef = useRef<string | null>(episodeId)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Clamp offset to [-5.0, 5.0] with 0.1 precision
  const setOffset = useCallback((value: number) => {
    const clamped = Math.min(5.0, Math.max(-5.0, Math.round(value * 10) / 10))
    setOffsetState(clamped)
  }, [])

  const resetOffset = useCallback(() => {
    setOffsetState(0.0)
  }, [])

  // Window fetching helper
  const fetchWindow = useCallback(
    async (from: number, to: number, isInitial = false) => {
      if (!episodeId || !hasSubtitles) return

      const rangeKey = `${from}-${to}`
      if (inFlightRangesRef.current.has(rangeKey)) return
      inFlightRangesRef.current.add(rangeKey)

      if (isInitial) {
        setIsLoading(true)
        setError(null)
      } else {
        setIsPrefetching(true)
      }

      try {
        const data = await animePlaybackApi.fetchEpisodeSubtitles(episodeId, {
          from,
          to,
          lang: 'all',
          signal: abortControllerRef.current?.signal,
        })

        // Verify this response matches current episode (drop stale/out-of-order)
        if (activeEpisodeIdRef.current !== episodeId) {
          return
        }

        setCues((prev) => {
          const { cues: nextCues, maxDuration: nextMax } = deduplicateAndSortCues(
            prev,
            data?.cues || []
          )
          setMaxDuration((cur) => Math.max(cur, nextMax))
          return nextCues
        })

        setLoadedRanges((prev) => {
          if (isTimeInRanges(from, prev) && isTimeInRanges(to, prev)) {
            return prev
          }
          return [...prev, { from, to }]
        })
      } catch (err: unknown) {
        if (activeEpisodeIdRef.current !== episodeId) return

        // Ignore AbortError
        if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError') {
          return
        }

        if (isInitial) {
          setError('Không thể tải phụ đề cho tập này. Vui lòng thử lại.')
        }
      } finally {
        inFlightRangesRef.current.delete(rangeKey)
        if (activeEpisodeIdRef.current === episodeId) {
          if (isInitial) setIsLoading(false)
          setIsPrefetching(false)
        }
      }
    },
    [episodeId, hasSubtitles]
  )

  // Reset & Load Initial Window [0, 120] when episode changes
  useEffect(() => {
    activeEpisodeIdRef.current = episodeId
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()
    inFlightRangesRef.current.clear()

    setCues([])
    setLoadedRanges([])
    setError(null)
    setMaxDuration(10)

    if (episodeId && hasSubtitles) {
      fetchWindow(0, windowSize, true)
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [episodeId, hasSubtitles, windowSize, fetchWindow])

  // Prefetch or Seek-fetch based on playback time advancement
  useEffect(() => {
    if (!episodeId || !hasSubtitles || isLoading || !loadedRanges.length) return

    // 1. Check if currentTime is outside all loaded ranges (seek jump)
    if (!isTimeInRanges(currentTime, loadedRanges)) {
      const neededWindow = computeWindowForTime(currentTime, windowSize)
      fetchWindow(neededWindow.from, neededWindow.to, false)
      return
    }

    // 2. Check if currentTime is near the end of any loaded window (prefetch boundary)
    for (const range of loadedRanges) {
      if (
        currentTime >= range.to - prefetchThreshold &&
        currentTime <= range.to &&
        !isTimeInRanges(range.to + 1, loadedRanges)
      ) {
        // Prefetch next contiguous window
        fetchWindow(range.to, range.to + windowSize, false)
        break
      }
    }
  }, [
    currentTime,
    episodeId,
    hasSubtitles,
    isLoading,
    loadedRanges,
    prefetchThreshold,
    windowSize,
    fetchWindow,
  ])

  // Active cues calculation using Binary Search
  const activeCues = useMemo(() => {
    const effectiveTime = currentTime + offset
    return findActiveCues(cues, effectiveTime, maxDuration)
  }, [cues, currentTime, offset, maxDuration])

  // Determine if furigana/ruby data is available in the payload
  const hasFuriganaData = useMemo(() => {
    // In T06, cues payload does not include furigana or ruby annotations
    return false
  }, [])

  const retry = useCallback(() => {
    if (episodeId && hasSubtitles) {
      fetchWindow(0, windowSize, true)
    }
  }, [episodeId, hasSubtitles, windowSize, fetchWindow])

  return {
    cues,
    activeCues,
    isLoading,
    isPrefetching,
    error,
    offset,
    showJapanese,
    showVietnamese,
    showFurigana,
    hasFuriganaData,
    setOffset,
    resetOffset,
    setShowJapanese,
    setShowVietnamese,
    setShowFurigana,
    retry,
  }
}
