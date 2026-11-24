/**
 * Utilities for Kana / Romaji normalization, live Romaji->Hiragana conversion,
 * and Japanese Cloze sentence generation for Kotodama Vocabulary Dojo.
 */

export function katakanaToHiragana(input: string): string {
  return String(input || '').replace(/[\u30A1-\u30F6]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
}

const ROMAJI_TABLE: ReadonlyArray<readonly [string, string]> = [
  // 4-letter / 3-letter combos first
  ['ltsu', 'っ'],
  ['xtsu', 'っ'],
  ['dzu', 'づ'],
  ['kya', 'きゃ'],
  ['kyu', 'きゅ'],
  ['kyo', 'きょ'],
  ['sha', 'しゃ'],
  ['shi', 'し'],
  ['shu', 'しゅ'],
  ['sho', 'しょ'],
  ['sya', 'しゃ'],
  ['syu', 'しゅ'],
  ['syo', 'しょ'],
  ['cha', 'ちゃ'],
  ['chi', 'ち'],
  ['chu', 'ちゅ'],
  ['cho', 'ちょ'],
  ['tya', 'ちゃ'],
  ['tyu', 'ちゅ'],
  ['tyo', 'ちょ'],
  ['cya', 'ちゃ'],
  ['cyu', 'ちゅ'],
  ['cyo', 'ちょ'],
  ['nya', 'にゃ'],
  ['nyu', 'にゅ'],
  ['nyo', 'にょ'],
  ['hya', 'ひゃ'],
  ['hyu', 'ひゅ'],
  ['hyo', 'ひょ'],
  ['mya', 'みゃ'],
  ['myu', 'みゅ'],
  ['myo', 'みょ'],
  ['rya', 'りゃ'],
  ['ryu', 'りゅ'],
  ['ryo', 'りょ'],
  ['gya', 'ぎゃ'],
  ['gyu', 'ぎゅ'],
  ['gyo', 'ぎょ'],
  ['jya', 'じゃ'],
  ['jyu', 'じゅ'],
  ['jyo', 'じょ'],
  ['zya', 'じゃ'],
  ['zyu', 'じゅ'],
  ['zyo', 'じょ'],
  ['dya', 'ぢゃ'],
  ['dyu', 'ぢゅ'],
  ['dyo', 'ぢょ'],
  ['bya', 'びゃ'],
  ['byu', 'びゅ'],
  ['byo', 'びょ'],
  ['pya', 'ぴゃ'],
  ['pyu', 'ぴゅ'],
  ['pyo', 'ぴょ'],
  ['tsu', 'つ'],
  ['ltu', 'っ'],
  ['xtu', 'っ'],
  ['lya', 'ゃ'],
  ['lyu', 'ゅ'],
  ['lyo', 'ょ'],
  ['xya', 'ゃ'],
  ['xyu', 'ゅ'],
  ['xyo', 'ょ'],
  ['fya', 'ふゃ'],
  ['fyu', 'ふゅ'],
  ['fyo', 'ふょ'],
  // 2-letter combos
  ['ka', 'か'],
  ['ki', 'き'],
  ['ku', 'く'],
  ['ke', 'け'],
  ['ko', 'こ'],
  ['sa', 'さ'],
  ['si', 'し'],
  ['su', 'す'],
  ['se', 'せ'],
  ['so', 'そ'],
  ['ta', 'た'],
  ['ti', 'ち'],
  ['tu', 'つ'],
  ['te', 'て'],
  ['to', 'と'],
  ['na', 'な'],
  ['ni', 'に'],
  ['nu', 'ぬ'],
  ['ne', 'ね'],
  ['no', 'の'],
  ['ha', 'は'],
  ['hi', 'ひ'],
  ['hu', 'ふ'],
  ['fu', 'ふ'],
  ['he', 'へ'],
  ['ho', 'ほ'],
  ['ma', 'ま'],
  ['mi', 'み'],
  ['mu', 'む'],
  ['me', 'め'],
  ['mo', 'も'],
  ['ya', 'や'],
  ['yu', 'ゆ'],
  ['yo', 'よ'],
  ['ra', 'ら'],
  ['ri', 'り'],
  ['ru', 'る'],
  ['re', 'れ'],
  ['ro', 'ろ'],
  ['wa', 'わ'],
  ['wi', 'うぃ'],
  ['we', 'うぇ'],
  ['wo', 'を'],
  ['ga', 'が'],
  ['gi', 'ぎ'],
  ['gu', 'ぐ'],
  ['ge', 'げ'],
  ['go', 'ご'],
  ['za', 'ざ'],
  ['zi', 'じ'],
  ['ji', 'じ'],
  ['ja', 'じゃ'],
  ['ju', 'じゅ'],
  ['jo', 'じょ'],
  ['zu', 'ず'],
  ['ze', 'ぜ'],
  ['zo', 'ぞ'],
  ['da', 'だ'],
  ['di', 'ぢ'],
  ['du', 'づ'],
  ['de', 'で'],
  ['do', 'ど'],
  ['ba', 'ば'],
  ['bi', 'び'],
  ['bu', 'ぶ'],
  ['be', 'べ'],
  ['bo', 'ぼ'],
  ['pa', 'ぱ'],
  ['pi', 'ぴ'],
  ['pu', 'ぷ'],
  ['pe', 'ぺ'],
  ['po', 'ぽ'],
  ['fa', 'ふぁ'],
  ['fi', 'ふぃ'],
  ['fe', 'ふぇ'],
  ['fo', 'ふぉ'],
  ['la', 'ぁ'],
  ['li', 'ぃ'],
  ['lu', 'ぅ'],
  ['le', 'ぇ'],
  ['lo', 'ぉ'],
  ['xa', 'ぁ'],
  ['xi', 'ぃ'],
  ['xu', 'ぅ'],
  ['xe', 'ぇ'],
  ['xo', 'ぉ'],
  ['nn', 'ん'],
  ["n'", 'ん'],
  // Single vowels & long mark
  ['a', 'あ'],
  ['i', 'い'],
  ['u', 'う'],
  ['e', 'え'],
  ['o', 'お'],
  ['-', 'ー'],
]

const SOKUON_CONSONANTS = new Set(['k', 's', 't', 'p', 'c', 'g', 'z', 'd', 'b', 'f', 'h', 'j', 'r', 'w'])
const VOWELS_AND_Y = new Set(['a', 'i', 'u', 'e', 'o', 'y', 'n', "'"])

export function romajiToHiragana(input: string): string {
  const normalized = katakanaToHiragana(String(input || '').toLowerCase())
  let out = ''
  let i = 0

  while (i < normalized.length) {
    const rest = normalized.slice(i)

    // Handle 'n' followed by non-vowel/non-y consonant -> 'ん' (including 'm' before b/p/m e.g. shimbun)
    if (rest[0] === 'n' && rest.length >= 2) {
      const next = rest[1] || ''
      if (next === 'n' || next === "'") {
        out += 'ん'
        i += 2
        continue
      }
      if (!VOWELS_AND_Y.has(next) && /[a-z]/.test(next)) {
        out += 'ん'
        i += 1
        continue
      }
    }
    if (rest[0] === 'm' && rest.length >= 2 && (rest[1] === 'b' || rest[1] === 'p' || rest[1] === 'm')) {
      out += 'ん'
      i += 1
      continue
    }

    // Handle double-consonant sokuon (e.g. gakkou -> がっこう, kitte -> きって, match -> まっち)
    if (rest.length >= 2) {
      const c1 = rest[0] || ''
      const c2 = rest[1] || ''
      if (c1 === c2 && SOKUON_CONSONANTS.has(c1)) {
        out += 'っ'
        i += 1
        continue
      }
      if (c1 === 't' && c2 === 'c' && rest[2] === 'h') {
        out += 'っ'
        i += 1
        continue
      }
    }

    let matched = false
    for (const [romaji, kana] of ROMAJI_TABLE) {
      if (rest.startsWith(romaji)) {
        out += kana
        i += romaji.length
        matched = true
        break
      }
    }
    if (matched) continue

    out += normalized[i]
    i += 1
  }

  return out
}

export function normalizeReading(input: string): string {
  const cleaned = String(input || '')
    .trim()
    .replace(/[\s　【】()（）・〜~「」『』]/g, '')
  if (!cleaned) return ''
  let converted = romajiToHiragana(cleaned)
  if (converted.endsWith('n')) {
    converted = `${converted.slice(0, -1)}ん`
  }
  return converted
}

export function isReadingMatch(userInput: string, targetReading: string, targetWord?: string): boolean {
  const userNorm = normalizeReading(userInput)
  if (!userNorm) return false

  const candidateSource = targetReading && targetReading.trim() ? targetReading : targetWord || ''
  const variants = candidateSource
    .split(/[/、,;；|]/)
    .map((part) => normalizeReading(part))
    .filter(Boolean)

  if (variants.includes(userNorm)) return true
  if (targetWord) {
    const wordNorm = normalizeReading(targetWord)
    if (wordNorm && wordNorm === userNorm) return true
  }
  return false
}

export interface ClozeSentence {
  before: string
  after: string
  matchedText: string
  fullJa: string
  vi: string
}

export function buildClozeSentence(
  word: string,
  examples?: ReadonlyArray<{ jp: string; vi: string }>
): ClozeSentence | null {
  const cleanWord = String(word || '').trim()
  if (!cleanWord || !examples || examples.length === 0) return null

  const candidates = [cleanWord]
  if (cleanWord.length >= 2) candidates.push(cleanWord.slice(0, -1))
  if (cleanWord.length >= 3) candidates.push(cleanWord.slice(0, -2))

  for (const target of candidates) {
    if (!target) continue
    for (const ex of examples) {
      const fullJa = String(ex.jp || '').trim()
      if (!fullJa) continue
      const idx = fullJa.indexOf(target)
      if (idx !== -1) {
        return {
          before: fullJa.slice(0, idx),
          after: fullJa.slice(idx + target.length),
          matchedText: target,
          fullJa,
          vi: String(ex.vi || '').trim(),
        }
      }
    }
  }

  return null
}

export function splitSentenceByKeyword(
  sentenceJa: string,
  word: string
): { before: string; match: string; after: string } | null {
  const full = String(sentenceJa || '').trim()
  const cleanWord = String(word || '').trim()
  if (!full || !cleanWord) return null

  const candidates = [cleanWord]
  if (cleanWord.length >= 2) candidates.push(cleanWord.slice(0, -1))
  if (cleanWord.length >= 3) candidates.push(cleanWord.slice(0, -2))

  for (const target of candidates) {
    if (!target) continue
    const idx = full.indexOf(target)
    if (idx !== -1) {
      return {
        before: full.slice(0, idx),
        match: target,
        after: full.slice(idx + target.length),
      }
    }
  }
  return null
}

export interface KanaDiffToken {
  char: string
  isDiff: boolean
}

export interface KanaReadingDiff {
  userHira: string
  targetHira: string
  tokens: KanaDiffToken[]
  hintNote?: string
}

const LONG_VOWEL_CHARS = new Set(['う', 'い', 'あ', 'え', 'お', 'ー'])
const DAKUTEN_MAP: Record<string, string> = {
  が: 'か',
  ぎ: 'き',
  ぐ: 'く',
  げ: 'け',
  ご: 'こ',
  ざ: 'さ',
  じ: 'し',
  ず: 'す',
  ぜ: 'せ',
  ぞ: 'そ',
  だ: 'た',
  ぢ: 'ち',
  づ: 'つ',
  で: 'て',
  ど: 'と',
  ば: 'は',
  び: 'ひ',
  ぶ: 'ふ',
  べ: 'へ',
  ぼ: 'ほ',
  ぱ: 'は',
  ぴ: 'ひ',
  ぷ: 'ふ',
  ぺ: 'へ',
  ぽ: 'ほ',
}

function lcsAlignTargetDiffs(userChars: string[], targetChars: string[]): boolean[] {
  const m = userChars.length
  const n = targetChars.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0))

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const row = dp[i]
      const prevRow = dp[i - 1]
      if (!row || !prevRow) continue
      if (userChars[i - 1] === targetChars[j - 1]) {
        row[j] = (prevRow[j - 1] ?? 0) + 1
      } else {
        row[j] = Math.max(prevRow[j] ?? 0, row[j - 1] ?? 0)
      }
    }
  }

  const matched = Array<boolean>(n).fill(false)
  let i = m
  let j = n
  while (i > 0 && j > 0) {
    if (userChars[i - 1] === targetChars[j - 1]) {
      matched[j - 1] = true
      i -= 1
      j -= 1
    } else if ((dp[i - 1]?.[j] ?? 0) >= (dp[i]?.[j - 1] ?? 0)) {
      i -= 1
    } else {
      j -= 1
    }
  }
  return matched.map((ok) => !ok)
}

export function diffKanaReading(userInput: string, targetReading: string, targetWord?: string): KanaReadingDiff {
  const userHira = normalizeReading(userInput)
  const candidateSource = targetReading && targetReading.trim() ? targetReading : targetWord || ''
  const variants = candidateSource
    .split(/[/、,;；|]/)
    .map((part) => normalizeReading(part))
    .filter(Boolean)

  const targetHira = variants[0] || normalizeReading(targetWord || '')
  const targetChars = Array.from(targetHira)
  const userChars = Array.from(userHira)

  if (!userHira) {
    return {
      userHira: '',
      targetHira,
      tokens: targetChars.map((char) => ({ char, isDiff: true })),
    }
  }

  // Pick closest variant if multiple readings exist
  let bestTarget = targetHira
  let bestDiffs = lcsAlignTargetDiffs(userChars, targetChars)
  let bestScore = bestDiffs.filter((d) => !d).length
  for (const v of variants.slice(1)) {
    const vChars = Array.from(v)
    const diffs = lcsAlignTargetDiffs(userChars, vChars)
    const matchedCount = diffs.filter((d) => !d).length
    if (matchedCount > bestScore) {
      bestScore = matchedCount
      bestTarget = v
      bestDiffs = diffs
    }
  }

  const finalChars = Array.from(bestTarget)
  const tokens = finalChars.map((char, idx) => ({ char, isDiff: Boolean(bestDiffs[idx]) }))

  const diffChars = tokens.filter((t) => t.isDiff).map((t) => t.char)
  let hintNote: string | undefined
  if (diffChars.includes('っ') || userChars.includes('っ') !== finalChars.includes('っ')) {
    hintNote = 'Chú ý âm ngắt (っ)'
  } else if (diffChars.some((ch) => DAKUTEN_MAP[ch] && userChars.includes(DAKUTEN_MAP[ch]))) {
    hintNote = 'Chú ý âm đục / bán đục'
  } else if (diffChars.some((ch) => LONG_VOWEL_CHARS.has(ch)) && userChars.length < finalChars.length) {
    hintNote = 'Chú ý trường âm (う / い)'
  }

  return {
    userHira,
    targetHira: bestTarget,
    tokens,
    ...(hintNote ? { hintNote } : {}),
  }
}
