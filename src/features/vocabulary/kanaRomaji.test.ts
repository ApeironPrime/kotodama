import { describe, expect, it } from 'vitest'
import {
  buildClozeSentence,
  diffKanaReading,
  isReadingMatch,
  katakanaToHiragana,
  normalizeReading,
  romajiToHiragana,
  splitSentenceByKeyword,
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

  it('highlights missed long vowels, sokuon, and splits example keywords for Tensaku grading', () => {
    const longVowelDiff = diffKanaReading('chonan', 'ちょうなん')
    expect(longVowelDiff.userHira).toBe('ちょなん')
    expect(longVowelDiff.targetHira).toBe('ちょうなん')
    expect(longVowelDiff.tokens.find((t) => t.char === 'う')?.isDiff).toBe(true)
    expect(longVowelDiff.hintNote).toBe('Chú ý trường âm (う / い)')

    const sokuonDiff = diffKanaReading('gako', 'がっこう')
    expect(sokuonDiff.tokens.find((t) => t.char === 'っ')?.isDiff).toBe(true)
    expect(sokuonDiff.hintNote).toBe('Chú ý âm ngắt (っ)')

    expect(splitSentenceByKeyword('理想の男性と結婚する。', '男性')).toEqual({
      before: '理想の',
      match: '男性',
      after: 'と結婚する。',
    })
  })
})
