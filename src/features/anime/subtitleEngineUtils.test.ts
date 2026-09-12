import { describe, expect, it } from 'vitest'
import {
  computeWindowForTime,
  deduplicateAndSortCues,
  findActiveCues,
  isTimeInRanges,
} from './subtitleEngineUtils'
import type { AnimeSubtitleCue } from './animePlaybackTypes'

describe('subtitleEngineUtils', () => {
  const sampleCues: AnimeSubtitleCue[] = [
    { cue_id: 1, start: 10.0, end: 14.0, ja: 'おはよう', vi: 'Chào buổi sáng' },
    { cue_id: 2, start: 15.0, end: 18.0, ja: '元気ですか', vi: 'Bạn khỏe không?' },
    { cue_id: 3, start: 17.5, end: 22.0, ja: 'はい、元気です', vi: 'Vâng, tôi khỏe' }, // overlaps with cue 2 at 17.5-18.0
    { cue_id: 4, start: 30.0, end: 35.0, ja: 'さようなら', vi: 'Tạm biệt' },
  ]

  describe('deduplicateAndSortCues', () => {
    it('merges new cues and deduplicates existing ones by cue_id, sorting by start ASC', () => {
      const cue0 = sampleCues[0]
      const cue1 = sampleCues[1]
      const cue2 = sampleCues[2]
      if (!cue0 || !cue1 || !cue2) throw new Error('Fixtures missing')

      const existing = [cue0, cue1]
      const incoming = [
        cue1, // duplicate cue_id 2
        cue2, // new cue 3
        { cue_id: 0, start: 5.0, end: 8.0, ja: '初めまして', vi: 'Rất vui được gặp' }, // earlier cue
      ]

      const { cues, maxDuration } = deduplicateAndSortCues(existing, incoming)
      expect(cues).toHaveLength(4)
      expect(cues.map((c) => c.cue_id)).toEqual([0, 1, 2, 3])
      expect(cues[0]?.start).toBe(5.0)
      expect(cues[1]?.start).toBe(10.0)
      expect(maxDuration).toBe(4.5) // cue 3: 22.0 - 17.5 = 4.5
    })
  })

  describe('findActiveCues', () => {
    it('returns empty array when effective time is before the first cue', () => {
      expect(findActiveCues(sampleCues, 5.0)).toEqual([])
      expect(findActiveCues(sampleCues, 9.99)).toEqual([])
    })

    it('returns cue when effective time is exactly on cue.start', () => {
      const active = findActiveCues(sampleCues, 10.0)
      expect(active).toHaveLength(1)
      expect(active[0]?.cue_id).toBe(1)
    })

    it('returns cue when effective time is in the middle of a cue', () => {
      const active = findActiveCues(sampleCues, 12.0)
      expect(active).toHaveLength(1)
      expect(active[0]?.cue_id).toBe(1)
    })

    it('returns cue when effective time is exactly on cue.end', () => {
      const active = findActiveCues(sampleCues, 14.0)
      expect(active).toHaveLength(1)
      expect(active[0]?.cue_id).toBe(1)
    })

    it('returns empty array when effective time falls in a gap between cues', () => {
      expect(findActiveCues(sampleCues, 14.5)).toEqual([])
      expect(findActiveCues(sampleCues, 25.0)).toEqual([])
    })

    it('returns multiple overlapping cues ordered by start time', () => {
      // At 17.8s, both cue 2 [15.0 - 18.0] and cue 3 [17.5 - 22.0] are active
      const active = findActiveCues(sampleCues, 17.8)
      expect(active).toHaveLength(2)
      expect(active[0]?.cue_id).toBe(2)
      expect(active[1]?.cue_id).toBe(3)
    })

    it('correctly shifts active cue with positive and negative offset', () => {
      const currentTime = 8.0
      // With offset +2.0s: effectiveTime = 10.0s (matches cue 1 start)
      expect(findActiveCues(sampleCues, currentTime + 2.0)).toHaveLength(1)
      expect(findActiveCues(sampleCues, currentTime + 2.0)[0]?.cue_id).toBe(1)

      // With offset -2.0s: effectiveTime = 6.0s (in gap before first cue)
      expect(findActiveCues(sampleCues, currentTime - 2.0)).toEqual([])
    })

    it('finds active cue immediately after seek to arbitrary timestamp', () => {
      // Seek to 32.5s
      const active = findActiveCues(sampleCues, 32.5)
      expect(active).toHaveLength(1)
      expect(active[0]?.cue_id).toBe(4)
    })

    it('efficiently searches without scanning thousands of cues', () => {
      // Generate 1,000 cues spanning 0 to 5,000s
      const largeCues: AnimeSubtitleCue[] = []
      for (let i = 0; i < 1000; i++) {
        largeCues.push({
          cue_id: i,
          start: i * 5,
          end: i * 5 + 3,
          ja: `Cue ${i}`,
          vi: `Câu ${i}`,
        })
      }

      // Query cue 900 at 4501.5s
      const active = findActiveCues(largeCues, 4501.5, 3)
      expect(active).toHaveLength(1)
      expect(active[0]?.cue_id).toBe(900)
    })
  })

  describe('isTimeInRanges and computeWindowForTime', () => {
    it('identifies if timestamp is within loaded ranges', () => {
      const ranges = [
        { from: 0, to: 120 },
        { from: 120, to: 240 },
      ]
      expect(isTimeInRanges(50, ranges)).toBe(true)
      expect(isTimeInRanges(120, ranges)).toBe(true)
      expect(isTimeInRanges(240, ranges)).toBe(true)
      expect(isTimeInRanges(250, ranges)).toBe(false)
    })

    it('computes 120s window chunks', () => {
      expect(computeWindowForTime(0)).toEqual({ from: 0, to: 120 })
      expect(computeWindowForTime(45)).toEqual({ from: 0, to: 120 })
      expect(computeWindowForTime(119)).toEqual({ from: 0, to: 120 })
      expect(computeWindowForTime(120)).toEqual({ from: 120, to: 240 })
      expect(computeWindowForTime(245)).toEqual({ from: 240, to: 360 })
    })
  })
})
