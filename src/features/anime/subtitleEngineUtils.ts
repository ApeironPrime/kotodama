import type { AnimeSubtitleCue } from './animePlaybackTypes'

export interface WindowRange {
  from: number
  to: number
}

/**
 * Deduplicates and merges new cues into existing cues array.
 * Deduplication uses cue_id.
 * Results are strictly sorted by start ASC, cue_id ASC.
 */
export function deduplicateAndSortCues(
  existingCues: AnimeSubtitleCue[],
  newCues: AnimeSubtitleCue[]
): { cues: AnimeSubtitleCue[]; maxDuration: number } {
  const map = new Map<number, AnimeSubtitleCue>()

  for (const c of existingCues) {
    map.set(c.cue_id, c)
  }
  for (const c of newCues) {
    map.set(c.cue_id, c)
  }

  const merged = Array.from(map.values()).sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start
    return a.cue_id - b.cue_id
  })

  let maxDuration = 0
  for (const c of merged) {
    const duration = c.end - c.start
    if (duration > maxDuration) {
      maxDuration = duration
    }
  }

  return { cues: merged, maxDuration }
}

/**
 * Binary search to find the highest index in sortedCues where cue.start <= effectiveTime.
 * Returns -1 if all cues start after effectiveTime.
 */
export function binarySearchRightmostStart(
  sortedCues: AnimeSubtitleCue[],
  effectiveTime: number
): number {
  let low = 0
  let high = sortedCues.length - 1
  let candidate = -1

  while (low <= high) {
    const mid = (low + high) >> 1
    const cue = sortedCues[mid]
    if (cue && cue.start <= effectiveTime) {
      candidate = mid
      low = mid + 1 // look for potentially later cue starting <= effectiveTime
    } else {
      high = mid - 1
    }
  }

  return candidate
}

/**
 * Finds all active cues at effectiveTime using binary search.
 * A cue is active iff cue.start <= effectiveTime && effectiveTime <= cue.end.
 * Handles overlaps, boundary points, and gaps without scanning the full list.
 * Output is ordered by start ASC, cue_id ASC.
 */
export function findActiveCues(
  sortedCues: AnimeSubtitleCue[],
  effectiveTime: number,
  maxDuration = 60
): AnimeSubtitleCue[] {
  if (sortedCues.length === 0) return []

  const rightmostIndex = binarySearchRightmostStart(sortedCues, effectiveTime)
  if (rightmostIndex === -1) {
    // effectiveTime is before the start of the first cue
    return []
  }

  const active: AnimeSubtitleCue[] = []
  // Safety threshold: no cue can start before (effectiveTime - maxDuration) and still be active
  const minStartThreshold = effectiveTime - Math.max(maxDuration, 10)

  // Walk backwards from rightmostIndex only as far as minStartThreshold
  for (let i = rightmostIndex; i >= 0; i--) {
    const cue = sortedCues[i]
    if (!cue) continue
    if (cue.start < minStartThreshold) {
      // Any earlier cue ends before effectiveTime, stop searching backwards
      break
    }
    if (effectiveTime <= cue.end) {
      active.push(cue)
    }
  }

  // Restore sorted order (start ASC, cue_id ASC)
  if (active.length > 1) {
    active.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start
      return a.cue_id - b.cue_id
    })
  }

  return active
}

/**
 * Checks if a given time is already covered by any of the loaded window ranges.
 */
export function isTimeInRanges(time: number, ranges: WindowRange[]): boolean {
  return ranges.some((r) => time >= r.from && time <= r.to)
}

/**
 * Computes window range for a given target timestamp with specified window size (default 120s).
 */
export function computeWindowForTime(time: number, windowSize = 120): WindowRange {
  const safeTime = Math.max(0, time)
  const from = Math.floor(safeTime / windowSize) * windowSize
  return {
    from,
    to: from + windowSize,
  }
}
