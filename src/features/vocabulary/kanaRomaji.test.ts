import { describe, expect, it } from 'vitest'
import {
  buildClozeSentence,
  isReadingMatch,
  katakanaToHiragana,
  normalizeReading,
  romajiToHiragana,
} from './kanaRomaji'

describe('kanaRomaji utilities', () => {
  it('converts Katakana and Romaji cleanly into Hiragana', () => {
    expect(katakanaToHiragana('ジンセイ')).toBe('じんせい')
    expect(romajiToHiragana('jinsei')).toBe('じんせい')
    expect(romajiToHiragana('gakkou')).toBe('がっこう')
    expect(normalizeReading('shinbun')).toBe('しんぶん')
    expect(normalizeReading('shimbun')).toBe('しんぶん')
    expect(romajiToHiragana('watashi')).toBe('わたし')
    expect(romajiToHiragana('chotto')).toBe('ちょっと')
  })

  it('matches user input across Romaji, Hiragana, and Katakana variants', () => {
    expect(isReadingMatch('jinsei', 'じんせい')).toBe(true)
    expect(isReadingMatch('じんせい', 'じんせい')).toBe(true)
    expect(isReadingMatch('ジンセイ', 'じんせい')).toBe(true)
    expect(isReadingMatch('hon', 'ほん')).toBe(true)
    expect(isReadingMatch('nihon', 'にほん / にっぽん')).toBe(true)
    expect(isReadingMatch('nippon', 'にほん / にっぽん')).toBe(true)
    expect(isReadingMatch('jinse', 'じんせい')).toBe(false)
  })

  it('builds a cloze sentence for exact words and conjugated verb stems', () => {
    const exact = buildClozeSentence('人生', [{ jp: '幸せな人生を送る。', vi: 'Sống một cuộc đời hạnh phúc.' }])
    expect(exact).toEqual({
      before: '幸せな',
      after: 'を送る。',
      matchedText: '人生',
      fullJa: '幸せな人生を送る。',
      vi: 'Sống một cuộc đời hạnh phúc.',
    })

    const conjugated = buildClozeSentence('食べる', [{ jp: '朝ごはんを食べました。', vi: 'Tôi đã ăn bữa sáng.' }])
    expect(conjugated).toEqual({
      before: '朝ごはんを',
      after: 'ました。',
      matchedText: '食べ',
      fullJa: '朝ごはんを食べました。',
      vi: 'Tôi đã ăn bữa sáng.',
    })

    const none = buildClozeSentence('宇宙', [{ jp: '今日はいい天気だ。', vi: 'Hôm nay trời đẹp.' }])
    expect(none).toBeNull()
  })
})
