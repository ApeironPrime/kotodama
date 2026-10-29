import { describe, it, expect, beforeEach } from 'vitest'
import {
  computeInkState,
  getTierForRepetition,
  hankoManager,
} from './kanjiHankoSrs'

describe('kanjiHankoSrs - Spaced Repetition Hanko System', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.clear()
    }
  })

  describe('computeInkState (Độ phai của mực theo đường cong quên lãng)', () => {
    it('recognizes Fresh Ink (Mực tươi) right after review (0 - 25% duration)', () => {
      const now = Date.now()
      const last = now
      const next = now + 4 * 24 * 3600 * 1000 // 4 days interval

      const { inkState, decayRatio } = computeInkState(last, next, now)
      expect(inkState).toBe('fresh')
      expect(decayRatio).toBeCloseTo(0, 1)
    })

    it('recognizes Soaked Ink (Mực thấm thấu) at 50% interval', () => {
      const start = 100000
      const total = 100000
      const end = start + total
      const now = start + total * 0.5 // 50%

      const { inkState, decayRatio } = computeInkState(start, end, now)
      expect(inkState).toBe('soaked')
      expect(decayRatio).toBeCloseTo(0.5, 2)
    })

    it('recognizes Dry Due Ink (Mực khô kiệt - Kasure & nhịp thở) when reaching review due date (85 - 115%)', () => {
      const start = 100000
      const total = 100000
      const end = start + total
      const now = start + total * 0.95 // 95% due

      const { inkState, decayRatio } = computeInkState(start, end, now)
      expect(inkState).toBe('dry_due')
      expect(decayRatio).toBeCloseTo(0.95, 2)
    })

    it('recognizes Ash Decay Ink (Mực hóa tro - Rạn nứt xám) when overdue (>115%)', () => {
      const start = 100000
      const total = 100000
      const end = start + total
      const now = start + total * 1.5 // 150% overdue

      const { inkState, decayRatio } = computeInkState(start, end, now)
      expect(inkState).toBe('ash_decay')
      expect(decayRatio).toBeGreaterThan(1.15)
    })
  })

  describe('getTierForRepetition (Cấp bậc ấn triện theo chu kỳ 2^n)', () => {
    it('assigns Tier 1 (Sơ triện) for 1-2 days', () => {
      expect(getTierForRepetition(0, 1)).toBe('tier1_initial')
      expect(getTierForRepetition(1, 2)).toBe('tier1_initial')
    })

    it('assigns Tier 2 (Phương ấn) for 4-8 days', () => {
      expect(getTierForRepetition(2, 4)).toBe('tier2_square')
      expect(getTierForRepetition(3, 8)).toBe('tier2_square')
    })

    it('assigns Tier 3 (Thành ấn) for 16-32 days', () => {
      expect(getTierForRepetition(4, 16)).toBe('tier3_established')
      expect(getTierForRepetition(5, 32)).toBe('tier3_established')
    })

    it('assigns Tier 4 (Bảo triện vĩnh viễn) for >=60 days or >=6 repetitions', () => {
      expect(getTierForRepetition(6, 64)).toBe('tier4_master')
      expect(getTierForRepetition(7, 128)).toBe('tier4_master')
    })
  })

  describe('hankoManager stamping workflow', () => {
    it('stamps a new kanji and advances interval and tier', () => {
      const stamped1 = hankoManager.stampKanji('新')
      expect(stamped1.repetition).toBe(1)
      expect(stamped1.intervalDays).toBe(1)
      expect(stamped1.inkState).toBe('fresh')
      expect(stamped1.tier).toBe('tier1_initial')

      // Second stamp doubles to 2 days
      const stamped2 = hankoManager.stampKanji('新')
      expect(stamped2.repetition).toBe(2)
      expect(stamped2.intervalDays).toBe(2)
      expect(stamped2.inkState).toBe('fresh')

      // Third stamp doubles to 4 days (Tier 2 Phương ấn)
      const stamped3 = hankoManager.stampKanji('新')
      expect(stamped3.repetition).toBe(3)
      expect(stamped3.intervalDays).toBe(4)
      expect(stamped3.tier).toBe('tier2_square')
    })
  })
})
