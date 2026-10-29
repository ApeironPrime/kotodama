/**
 * Hanko SRS (Spaced Repetition System) for Kotodama Interactive Sumi-e Canvas
 * 
 * Translates the algorithmic Ebbinghaus forgetting curve into traditional East Asian
 * seal engraving (落款印 - Rakkan-in / Hanko) and physical ink states on mulberry washi paper:
 * 
 * 1. Ink Decay States (Trạng thái độ phai của mực):
 *    - Fresh ('fresh'): Cinnabar Shu-iro (#C23A2B), crisp boundaries, wet gloss reflection.
 *    - Soaked ('soaked'): Deep brick red (#8E3526), absorbed into paper fibers.
 *    - Dry Due ('dry_due'): Faded red (#9A4232), Kasure dry-brush border scratches, gentle 3-4s ambient breathing pulse.
 *    - Ash Decay ('ash_decay'): Ash gray (#78716C, alpha 0.25), micro-fractures, overdue memory.
 * 
 * 2. Seal Hierarchy (Cấp bậc ấn triện theo chu kỳ 2^n ngày):
 *    - Tier 1 (1-2 days)   : Sơ triện - Dấu tròn nhỏ thanh nhã, khắc 1 nét sổ hoặc chấm son.
 *    - Tier 2 (4-8 days)   : Phương ấn - Dấu vuông viền đơn, khắc chữ Hán cổ giản lược (正 / 記).
 *    - Tier 3 (16-32 days) : Thành ấn - Dấu chữ nhật viền đôi, hoa văn hồi văn góc truyền thống (得 / 習).
 *    - Tier 4 (>60 days)   : Bảo triện vĩnh viễn - Ấn triện hoàng gia cỡ lớn, viền mây tinh xảo (極 / 通).
 */

export type HankoTier = 'tier1_initial' | 'tier2_square' | 'tier3_established' | 'tier4_master'

export type HankoInkState = 'fresh' | 'soaked' | 'dry_due' | 'ash_decay'

export interface KanjiHankoRecord {
  kanji: string
  repetition: number
  intervalDays: number
  lastReviewedAt: number
  nextReviewAt: number
  tier: HankoTier
  inkState: HankoInkState
  decayRatio: number
  inscription: string
}

export interface CinnabarDustParticle {
  x: number
  y: number
  vx: number
  vy: number
  alpha: number
  size: number
  color: string
}

const STORAGE_KEY = 'kotodama_kanji_hanko_srs_v2'

const MS_PER_DAY = 24 * 60 * 60 * 1000

// Inscription assignments for tiers
function getInscriptionForTier(tier: HankoTier, kanji: string): string {
  switch (tier) {
    case 'tier1_initial':
      return '•'
    case 'tier2_square':
      return kanji === '雨' || kanji === '八' ? '記' : '正'
    case 'tier3_established':
      return kanji === '休' ? '息' : '得'
    case 'tier4_master':
      return kanji === '日' ? '極' : '通'
    default:
      return '正'
  }
}

// Map repetition count to Seal Tier
export function getTierForRepetition(repetition: number, intervalDays: number): HankoTier {
  if (repetition >= 6 || intervalDays >= 60) return 'tier4_master'
  if (repetition >= 4 || intervalDays >= 16) return 'tier3_established'
  if (repetition >= 2 || intervalDays >= 4) return 'tier2_square'
  return 'tier1_initial'
}

// Calculate real-time ink state and decay ratio
export function computeInkState(
  lastReviewedAt: number,
  nextReviewAt: number,
  now: number = Date.now()
): { inkState: HankoInkState; decayRatio: number } {
  const total = Math.max(10_000, nextReviewAt - lastReviewedAt)
  const elapsed = Math.max(0, now - lastReviewedAt)
  const ratio = elapsed / total

  if (ratio <= 0.25) {
    return { inkState: 'fresh', decayRatio: ratio }
  } else if (ratio <= 0.85) {
    return { inkState: 'soaked', decayRatio: ratio }
  } else if (ratio <= 1.15) {
    return { inkState: 'dry_due', decayRatio: ratio }
  } else {
    return { inkState: 'ash_decay', decayRatio: ratio }
  }
}

// Curated seed data demonstrating the richness of all 4 tiers and all 4 ink states
function createInitialHankoSeeds(): Record<string, KanjiHankoRecord> {
  const now = Date.now()

  return {
    // 1. Tier 4 Master Seal - Vĩnh viễn (Fresh / Soaked)
    日: {
      kanji: '日',
      repetition: 7,
      intervalDays: 64,
      lastReviewedAt: now - 3 * MS_PER_DAY,
      nextReviewAt: now + 61 * MS_PER_DAY,
      tier: 'tier4_master',
      inkState: 'fresh',
      decayRatio: 3 / 64,
      inscription: '極',
    },
    // 2. Tier 3 Established Seal - Mực thấm thấu
    月: {
      kanji: '月',
      repetition: 5,
      intervalDays: 32,
      lastReviewedAt: now - 12 * MS_PER_DAY,
      nextReviewAt: now + 20 * MS_PER_DAY,
      tier: 'tier3_established',
      inkState: 'soaked',
      decayRatio: 12 / 32,
      inscription: '得',
    },
    // 3. Tier 3 Established Seal - Mực thấm thấu
    休: {
      kanji: '休',
      repetition: 4,
      intervalDays: 16,
      lastReviewedAt: now - 8 * MS_PER_DAY,
      nextReviewAt: now + 8 * MS_PER_DAY,
      tier: 'tier3_established',
      inkState: 'soaked',
      decayRatio: 8 / 16,
      inscription: '息',
    },
    // 4. Tier 2 Square Seal - Mực tươi
    木: {
      kanji: '木',
      repetition: 3,
      intervalDays: 8,
      lastReviewedAt: now - 1 * MS_PER_DAY,
      nextReviewAt: now + 7 * MS_PER_DAY,
      tier: 'tier2_square',
      inkState: 'fresh',
      decayRatio: 1 / 8,
      inscription: '正',
    },
    // 5. Tier 2 Square Seal - Mực khô kiệt (Kasure xước khô + nhịp thở! CHỜ NẠP MỰC)
    上: {
      kanji: '上',
      repetition: 2,
      intervalDays: 4,
      lastReviewedAt: now - 3.9 * MS_PER_DAY,
      nextReviewAt: now + 0.1 * MS_PER_DAY,
      tier: 'tier2_square',
      inkState: 'dry_due',
      decayRatio: 0.98,
      inscription: '正',
    },
    // 6. Tier 1 Initial Seal - Mực khô kiệt (CHỜ NẠP MỰC)
    十: {
      kanji: '十',
      repetition: 1,
      intervalDays: 2,
      lastReviewedAt: now - 1.95 * MS_PER_DAY,
      nextReviewAt: now + 0.05 * MS_PER_DAY,
      tier: 'tier1_initial',
      inkState: 'dry_due',
      decayRatio: 0.98,
      inscription: '•',
    },
    // 7. Tier 1 Initial Seal - Mực hóa tro (Quá hạn)
    二: {
      kanji: '二',
      repetition: 1,
      intervalDays: 1,
      lastReviewedAt: now - 2.8 * MS_PER_DAY,
      nextReviewAt: now - 1.8 * MS_PER_DAY,
      tier: 'tier1_initial',
      inkState: 'ash_decay',
      decayRatio: 2.8,
      inscription: '•',
    },
    // 8. Tier 2 Square Seal - Mực hóa tro (Quá hạn / nứt vỡ)
    八: {
      kanji: '八',
      repetition: 2,
      intervalDays: 4,
      lastReviewedAt: now - 6.5 * MS_PER_DAY,
      nextReviewAt: now - 2.5 * MS_PER_DAY,
      tier: 'tier2_square',
      inkState: 'ash_decay',
      decayRatio: 1.6,
      inscription: '記',
    },
    // 9. Tier 1 Initial Seal - Mực tươi
    人: {
      kanji: '人',
      repetition: 1,
      intervalDays: 2,
      lastReviewedAt: now - 0.2 * MS_PER_DAY,
      nextReviewAt: now + 1.8 * MS_PER_DAY,
      tier: 'tier1_initial',
      inkState: 'fresh',
      decayRatio: 0.1,
      inscription: '•',
    },
    // 10. Additional due Kanji
    雨: {
      kanji: '雨',
      repetition: 2,
      intervalDays: 4,
      lastReviewedAt: now - 3.8 * MS_PER_DAY,
      nextReviewAt: now + 0.2 * MS_PER_DAY,
      tier: 'tier2_square',
      inkState: 'dry_due',
      decayRatio: 0.95,
      inscription: '記',
    },
    火: {
      kanji: '火',
      repetition: 1,
      intervalDays: 2,
      lastReviewedAt: now - 1.9 * MS_PER_DAY,
      nextReviewAt: now + 0.1 * MS_PER_DAY,
      tier: 'tier1_initial',
      inkState: 'dry_due',
      decayRatio: 0.95,
      inscription: '•',
    },
    森: {
      kanji: '森',
      repetition: 2,
      intervalDays: 4,
      lastReviewedAt: now - 6 * MS_PER_DAY,
      nextReviewAt: now - 2 * MS_PER_DAY,
      tier: 'tier2_square',
      inkState: 'ash_decay',
      decayRatio: 1.5,
      inscription: '記',
    },
    間: {
      kanji: '間',
      repetition: 1,
      intervalDays: 1,
      lastReviewedAt: now - 2.5 * MS_PER_DAY,
      nextReviewAt: now - 1.5 * MS_PER_DAY,
      tier: 'tier1_initial',
      inkState: 'ash_decay',
      decayRatio: 2.5,
      inscription: '•',
    },
  }
}

/**
 * Hanko SRS Manager: Persistence in LocalStorage with automatic timestamp decay
 */
class HankoSrsManager {
  private cache: Record<string, KanjiHankoRecord> | null = null

  public getAll(): Record<string, KanjiHankoRecord> {
    if (this.cache) return this.cache

    if (typeof window === 'undefined') {
      return createInitialHankoSeeds()
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, KanjiHankoRecord>
        // Update dynamic decay based on current time
        const now = Date.now()
        for (const k in parsed) {
          const item = parsed[k]
          if (item) {
            const { inkState, decayRatio } = computeInkState(item.lastReviewedAt, item.nextReviewAt, now)
            item.inkState = inkState
            item.decayRatio = decayRatio
          }
        }
        this.cache = parsed
        return parsed
      }
    } catch {
      // Fallback
    }

    const initial = createInitialHankoSeeds()
    this.save(initial)
    this.cache = initial
    return initial
  }

  public get(kanji: string): KanjiHankoRecord | null {
    const all = this.getAll()
    return all[kanji] || null
  }

  public save(data: Record<string, KanjiHankoRecord>): void {
    this.cache = data
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      } catch {
        // quota ignore
      }
    }
  }

  /**
   * Perform the physical stamping of a Kanji (Dập ấn nạp mực)
   * Advances repetition count, sets interval, and refreshes ink to 'fresh' Shu-iro.
   */
  public stampKanji(kanji: string): KanjiHankoRecord {
    const all = this.getAll()
    const existing = all[kanji]
    const now = Date.now()

    let nextRep = 1
    let nextInterval = 1

    if (existing) {
      nextRep = existing.repetition + 1
      // Spaced Repetition Doubling Schedule: 1 -> 2 -> 4 -> 8 -> 16 -> 32 -> 64
      if (existing.intervalDays <= 1) nextInterval = 2
      else if (existing.intervalDays <= 2) nextInterval = 4
      else if (existing.intervalDays <= 4) nextInterval = 8
      else if (existing.intervalDays <= 8) nextInterval = 16
      else if (existing.intervalDays <= 16) nextInterval = 32
      else nextInterval = 64
    } else {
      nextRep = 1
      nextInterval = 1
    }

    const tier = getTierForRepetition(nextRep, nextInterval)
    const inscription = getInscriptionForTier(tier, kanji)

    const updated: KanjiHankoRecord = {
      kanji,
      repetition: nextRep,
      intervalDays: nextInterval,
      lastReviewedAt: now,
      nextReviewAt: now + nextInterval * MS_PER_DAY,
      tier,
      inkState: 'fresh',
      decayRatio: 0,
      inscription,
    }

    all[kanji] = updated
    this.save(all)
    return updated
  }
}

export const hankoManager = new HankoSrsManager()

/**
 * ─── RENDER HANKO SEALS ON CANVAS ──────────────────────────────────────────
 * High-performance, calligraphically authentic vector rendering of the seal
 * corresponding to the HankoTier and HankoInkState.
 */
export function drawHankoSeal(
  ctx: CanvasRenderingContext2D,
  record: KanjiHankoRecord,
  x: number,
  y: number,
  time: number,
  scale: number = 1.0
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)

  const { tier, inkState, inscription } = record

  // ─── 1. Determine Colors & Ambient Breathing Pulse ───────────────────────
  let strokeColor = '#C23A2B'
  let fillColor = '#C23A2B'
  let inkAlpha = 1.0
  let isBreathing = false
  let isKasure = false
  let isAsh = false

  switch (inkState) {
    case 'fresh':
      // Mực tươi: Đỏ son Chu Sa đậm đặc, nét căng mọng
      strokeColor = '#C23A2B'
      fillColor = '#C23A2B'
      inkAlpha = 0.96
      break
    case 'soaked':
      // Mực thấm thấu: Đỏ gạch trầm, chìm vào giấy dó
      strokeColor = '#8E3526'
      fillColor = '#8E3526'
      inkAlpha = 0.82
      break
    case 'dry_due': {
      // Mực khô kiệt: Sắc son khô ráo, viền xước Kasure, nhấp nháy nhịp thở khẽ (chu kỳ ~3.2s)
      strokeColor = '#9A4232'
      fillColor = '#9A4232'
      isKasure = true
      isBreathing = true
      const breath = 0.55 + 0.45 * Math.sin(time * 0.002)
      inkAlpha = 0.35 + 0.55 * breath
      break
    }
    case 'ash_decay':
      // Mực hóa tro: Sắc son biến mất hoàn toàn, xám tro mờ nhạt rạn nứt
      strokeColor = '#78716C'
      fillColor = '#78716C'
      inkAlpha = 0.24
      isAsh = true
      break
  }

  ctx.globalAlpha = inkAlpha

  // ─── 2. Render Specific Seal Geometry according to Tier ─────────────────

  if (tier === 'tier1_initial') {
    // ── CẤP 1: SƠ TRIỆN (Dấu tròn nhỏ, 1 nét sổ hoặc chấm son) ──────────────
    const r = 7
    ctx.lineWidth = 1.3
    ctx.strokeStyle = strokeColor

    if (isKasure) {
      ctx.setLineDash([3, 2])
    }

    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])

    // Center vertical stroke or dot
    ctx.fillStyle = fillColor
    ctx.beginPath()
    ctx.rect(-0.8, -3.5, 1.6, 7)
    ctx.fill()

    // Wet gloss dot for fresh ink
    if (inkState === 'fresh') {
      ctx.fillStyle = 'rgba(255, 240, 235, 0.65)'
      ctx.beginPath()
      ctx.arc(-2, -2.5, 1.2, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (tier === 'tier2_square') {
    // ── CẤP 2: PHƯƠNG ẤN (Dấu vuông viền đơn, khắc chữ 正 / 記) ──────────────
    const size = 18
    const half = size / 2

    ctx.lineWidth = 1.4
    ctx.strokeStyle = strokeColor

    if (isKasure) {
      ctx.setLineDash([4, 2])
    }

    ctx.strokeRect(-half, -half, size, size)
    ctx.setLineDash([])

    // Inscription Glyph
    ctx.font = '700 9.5px "Noto Serif JP", serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = fillColor
    ctx.fillText(inscription, 0, 0.5)

    // Wet gloss specular highlight
    if (inkState === 'fresh') {
      ctx.strokeStyle = 'rgba(255, 240, 235, 0.55)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(-half + 2, -half + 2)
      ctx.lineTo(-half + 6, -half + 2)
      ctx.stroke()
    }
  } else if (tier === 'tier3_established') {
    // ── CẤP 3: THÀNH ẤN (Dấu chữ nhật viền đôi, hoa văn hồi văn góc) ─────────
    const w = 18
    const h = 24
    const hw = w / 2
    const hh = h / 2

    // Outer Border
    ctx.lineWidth = 1.3
    ctx.strokeStyle = strokeColor
    if (isKasure) {
      ctx.setLineDash([5, 2.5])
    }
    ctx.strokeRect(-hw, -hh, w, h)

    // Inner Delicate Border
    ctx.lineWidth = 0.8
    ctx.strokeRect(-hw + 2.5, -hh + 2.5, w - 5, h - 5)
    ctx.setLineDash([])

    // Corner Meander accents (Hồi văn góc)
    ctx.fillStyle = fillColor
    ctx.fillRect(-hw, -hh, 3, 1)
    ctx.fillRect(-hw, -hh, 1, 3)
    ctx.fillRect(hw - 3, -hh, 3, 1)
    ctx.fillRect(hw - 1, -hh, 1, 3)
    ctx.fillRect(-hw, hh - 1, 3, 1)
    ctx.fillRect(-hw, hh - 3, 1, 3)
    ctx.fillRect(hw - 3, hh - 1, 3, 1)
    ctx.fillRect(hw - 1, hh - 3, 1, 3)

    // Inscription Glyph (得 / 習 / 息)
    ctx.font = '700 11px "Noto Serif JP", serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = fillColor
    ctx.fillText(inscription, 0, 0.5)

    // Wet gloss for fresh ink
    if (inkState === 'fresh') {
      ctx.strokeStyle = 'rgba(255, 240, 235, 0.65)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(-hw + 4, -hh + 4)
      ctx.lineTo(-hw + 8, -hh + 4)
      ctx.stroke()
    }
  } else if (tier === 'tier4_master') {
    // ── CẤP 4: BẢO TRIỆN VĨNH VIỄN (Ấn hoàng gia lớn viền mây, 通 / 極) ───────
    const size = 26
    const half = size / 2

    // Imperial Ornate Bracketed Border
    ctx.lineWidth = 1.6
    ctx.strokeStyle = strokeColor
    if (isKasure) {
      ctx.setLineDash([6, 3])
    }

    // Octagonal / Cloud-cornered path
    ctx.beginPath()
    const cut = 4
    ctx.moveTo(-half + cut, -half)
    ctx.lineTo(half - cut, -half)
    ctx.lineTo(half, -half + cut)
    ctx.lineTo(half, half - cut)
    ctx.lineTo(half - cut, half)
    ctx.lineTo(-half + cut, half)
    ctx.lineTo(-half, half - cut)
    ctx.lineTo(-half, -half + cut)
    ctx.closePath()
    ctx.stroke()

    // Inner ornate border
    ctx.lineWidth = 0.9
    ctx.beginPath()
    const innerCut = 3
    const ih = half - 2.5
    ctx.moveTo(-ih + innerCut, -ih)
    ctx.lineTo(ih - innerCut, -ih)
    ctx.lineTo(ih, -ih + innerCut)
    ctx.lineTo(ih, ih - innerCut)
    ctx.lineTo(ih - innerCut, ih)
    ctx.lineTo(-ih + innerCut, ih)
    ctx.lineTo(-ih, ih - innerCut)
    ctx.lineTo(-ih, -ih + innerCut)
    ctx.closePath()
    ctx.stroke()
    ctx.setLineDash([])

    // Traditional Cloud Motif points at cardinal notches
    ctx.fillStyle = fillColor
    ctx.fillRect(-1.5, -half - 1, 3, 2)
    ctx.fillRect(-1.5, half - 1, 3, 2)
    ctx.fillRect(-half - 1, -1.5, 2, 3)
    ctx.fillRect(half - 1, -1.5, 2, 3)

    // Master Inscription: 極 / 通
    ctx.font = '800 13px "Noto Serif JP", serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = strokeColor
    ctx.fillText(inscription, 0, 0.5)

    // Royal Imperial Aura
    if (inkState === 'fresh' || inkState === 'soaked') {
      ctx.save()
      const halo = ctx.createRadialGradient(0, 0, half, 0, 0, half + 8)
      halo.addColorStop(0, 'rgba(194, 58, 43, 0.15)')
      halo.addColorStop(1, 'rgba(194, 58, 43, 0)')
      ctx.fillStyle = halo
      ctx.beginPath()
      ctx.arc(0, 0, half + 8, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  }

  // ─── 3. Micro Fractures & Cracks for Ash Decay (Mực hóa tro rạn nứt) ──────
  if (isAsh) {
    ctx.save()
    ctx.strokeStyle = 'rgba(40, 36, 34, 0.45)'
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.moveTo(-8, -6)
    ctx.lineTo(-2, 1)
    ctx.lineTo(3, -2)
    ctx.lineTo(7, 5)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(-4, 7)
    ctx.lineTo(1, 3)
    ctx.stroke()
    ctx.restore()
  }

  // ─── 4. Ambient Need-Ink Breathing Glow Ring (Khi đến hạn nạp mực) ────────
  if (isBreathing) {
    const pulseRing = 14 + 4 * Math.sin(time * 0.003)
    ctx.save()
    ctx.beginPath()
    ctx.arc(0, 0, pulseRing, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(194, 58, 43, ${0.25 * (inkAlpha)})`
    ctx.lineWidth = 1
    ctx.setLineDash([2, 4])
    ctx.stroke()
    ctx.restore()
  }

  ctx.restore()
}
