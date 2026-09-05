import { describe, expect, it } from 'vitest'
import { buildBunsetsuChunks, kanaToRomaji } from './bunsetsuHelper'
import type { TranscriptSegment } from './videoTypes'

describe('bunsetsuHelper', () => {
  describe('kanaToRomaji', () => {
    it('correctly converts basic hiragana and katakana', () => {
      expect(kanaToRomaji('あいうえお')).toBe('aiueo')
      expect(kanaToRomaji('かきくけこ')).toBe('kakikukeko')
      expect(kanaToRomaji('サシスセソ')).toBe('sashisuseso')
    })

    it('correctly converts digraphs (youon)', () => {
      expect(kanaToRomaji('きゃく')).toBe('kyaku')
      expect(kanaToRomaji('しょうがっこう')).toBe('shougakkou')
      expect(kanaToRomaji('チョコレート')).toBe('chokoreeto')
    })

    it('correctly converts sokuon (double consonant)', () => {
      expect(kanaToRomaji('きって')).toBe('kitte')
      expect(kanaToRomaji('ずっと')).toBe('zutto')
      expect(kanaToRomaji('がっこう')).toBe('gakkou')
      expect(kanaToRomaji('マッチ')).toBe('matchi')
    })

    it('correctly converts song lyrics words from Silhouette', () => {
      expect(kanaToRomaji('おしえてくれた')).toBe('oshietekureta')
      expect(kanaToRomaji('あなた')).toBe('anata')
      expect(kanaToRomaji('は')).toBe('ha')
      expect(kanaToRomaji('きえぬ')).toBe('kienu')
      expect(kanaToRomaji('シルエット')).toBe('shiruetto')
    })
  })

  describe('buildBunsetsuChunks', () => {
    it('groups content words with dependent particles and auxiliaries', () => {
      const segment: TranscriptSegment = {
        id: 'seg_1',
        sequenceNo: 1,
        speakerLabel: null,
        speakerConfidence: null,
        startMs: 1000,
        endMs: 4000,
        textJa: '教えてくれたあなた は 消えぬ シルエット',
        textFurigana: '<ruby>教<rt>おし</rt></ruby>えてくれたあなた は <ruby>消<rt>き</rt></ruby>えぬ シルエット',
        textVi: 'Người đã dạy cho tôi điều đó chính là bạn, hình bóng không tan biến',
        confidence: 0.95,
        tokens: [],
      }

      const chunks = buildBunsetsuChunks(segment)
      expect(chunks.length).toBeGreaterThan(0)

      const surfaces = chunks.map((c) => c.text)
      // "教えてくれた" should be grouped together into 1 chunk
      expect(surfaces).toContain('教えてくれた')
      // "消えぬ" should be 1 chunk
      expect(surfaces).toContain('消えぬ')
      // "シルエット" should be 1 chunk
      expect(surfaces).toContain('シルエット')

      // Check readings and romaji
      const oshieteChunk = chunks.find((c) => c.text === '教えてくれた')
      expect(oshieteChunk).toBeDefined()
      expect(oshieteChunk?.reading).toBe('おしえてくれた')
      expect(oshieteChunk?.romaji).toBe('oshietekureta')

      const silhouetteChunk = chunks.find((c) => c.text === 'シルエット')
      expect(silhouetteChunk).toBeDefined()
      expect(silhouetteChunk?.romaji).toBe('shiruetto')
    })
  })
})
