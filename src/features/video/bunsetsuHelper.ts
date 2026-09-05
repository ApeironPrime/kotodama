import type { TranscriptChunk, TranscriptSegment, TranscriptToken } from './videoTypes'

/**
 * Complete Hepburn Kana to Romaji table
 */
const DIGRAPHS_ROMAJI: Record<string, string> = {
  // Hiragana digraphs
  きゃ: 'kya',
  きゅ: 'kyu',
  きょ: 'kyo',
  しゃ: 'sha',
  しゅ: 'shu',
  しょ: 'sho',
  ちゃ: 'cha',
  ちゅ: 'chu',
  ちょ: 'cho',
  にゃ: 'nya',
  にゅ: 'nyu',
  にょ: 'nyo',
  ひゃ: 'hya',
  ひゅ: 'hyu',
  ひょ: 'hyo',
  みゃ: 'mya',
  みゅ: 'myu',
  みょ: 'myo',
  りゃ: 'rya',
  りゅ: 'ryu',
  りょ: 'ryo',
  ぎゃ: 'gya',
  ぎゅ: 'gyu',
  ぎょ: 'gyo',
  じゃ: 'ja',
  じゅ: 'ju',
  じょ: 'jo',
  びゃ: 'bya',
  びゅ: 'byu',
  びょ: 'byo',
  ぴゃ: 'pya',
  ぴゅ: 'pyu',
  ぴょ: 'pyo',
  // Katakana digraphs
  キャ: 'kya',
  キュ: 'kyu',
  キョ: 'kyo',
  シャ: 'sha',
  シュ: 'shu',
  ショ: 'sho',
  チャ: 'cha',
  チュ: 'chu',
  チョ: 'cho',
  ニャ: 'nya',
  ニュ: 'nyu',
  ニョ: 'nyo',
  ヒャ: 'hya',
  ヒュ: 'hyu',
  ヒョ: 'hyo',
  ミャ: 'mya',
  ミュ: 'myu',
  ミョ: 'myo',
  リャ: 'rya',
  リュ: 'ryu',
  リョ: 'ryo',
  ギャ: 'gya',
  ギュ: 'gyu',
  ギョ: 'gyo',
  ジャ: 'ja',
  ジュ: 'ju',
  ジョ: 'jo',
  ビャ: 'bya',
  ビュ: 'byu',
  ビョ: 'byo',
  ピャ: 'pya',
  ピュ: 'pyu',
  ピョ: 'pyo',
  ファ: 'fa',
  フィ: 'fi',
  フェ: 'fe',
  フォ: 'fo',
  ティ: 'ti',
  ディ: 'di',
  トゥ: 'tu',
  ドゥ: 'du',
  ウィ: 'wi',
  ウェ: 'we',
  ウォ: 'wo',
  ヴァ: 'va',
  ヴィ: 'vi',
  ヴ: 'vu',
  ヴェ: 've',
  ヴォ: 'vo',
  シェ: 'she',
  ジェ: 'je',
  チェ: 'che',
}

const MONOGRAPHS_ROMAJI: Record<string, string> = {
  // Hiragana
  あ: 'a',
  い: 'i',
  う: 'u',
  え: 'e',
  お: 'o',
  か: 'ka',
  き: 'ki',
  く: 'ku',
  け: 'ke',
  こ: 'ko',
  さ: 'sa',
  し: 'shi',
  す: 'su',
  せ: 'se',
  そ: 'so',
  た: 'ta',
  ち: 'chi',
  つ: 'tsu',
  て: 'te',
  と: 'to',
  な: 'na',
  に: 'ni',
  ぬ: 'nu',
  ね: 'ne',
  の: 'no',
  は: 'ha',
  ひ: 'hi',
  ふ: 'fu',
  へ: 'he',
  ほ: 'ho',
  ま: 'ma',
  み: 'mi',
  む: 'mu',
  め: 'me',
  も: 'mo',
  や: 'ya',
  ゆ: 'yu',
  よ: 'yo',
  ら: 'ra',
  り: 'ri',
  る: 'ru',
  れ: 're',
  ろ: 'ro',
  わ: 'wa',
  を: 'o',
  ん: 'n',
  が: 'ga',
  ぎ: 'gi',
  ぐ: 'gu',
  げ: 'ge',
  ご: 'go',
  ざ: 'za',
  じ: 'ji',
  ず: 'zu',
  ぜ: 'ze',
  ぞ: 'zo',
  だ: 'da',
  ぢ: 'ji',
  づ: 'zu',
  で: 'de',
  ど: 'do',
  ば: 'ba',
  び: 'bi',
  ぶ: 'bu',
  べ: 'be',
  ぼ: 'bo',
  ぱ: 'pa',
  ぴ: 'pi',
  ぷ: 'pu',
  ぺ: 'pe',
  ぽ: 'po',
  // Katakana
  ア: 'a',
  イ: 'i',
  ウ: 'u',
  エ: 'e',
  オ: 'o',
  カ: 'ka',
  キ: 'ki',
  ク: 'ku',
  ケ: 'ke',
  コ: 'ko',
  サ: 'sa',
  シ: 'shi',
  ス: 'su',
  セ: 'se',
  ソ: 'so',
  タ: 'ta',
  チ: 'chi',
  ツ: 'tsu',
  テ: 'te',
  ト: 'to',
  ナ: 'na',
  ニ: 'ni',
  ヌ: 'nu',
  ネ: 'ne',
  ノ: 'no',
  ハ: 'ha',
  ヒ: 'hi',
  フ: 'fu',
  ヘ: 'he',
  ホ: 'ho',
  マ: 'ma',
  ミ: 'mi',
  ム: 'mu',
  メ: 'me',
  モ: 'mo',
  ヤ: 'ya',
  ユ: 'yu',
  ヨ: 'yo',
  ラ: 'ra',
  リ: 'ri',
  ル: 'ru',
  レ: 're',
  ロ: 'ro',
  ワ: 'wa',
  ヲ: 'o',
  ン: 'n',
  ガ: 'ga',
  ギ: 'gi',
  グ: 'gu',
  ゲ: 'ge',
  ゴ: 'go',
  ザ: 'za',
  ジ: 'ji',
  ズ: 'zu',
  ゼ: 'ze',
  ゾ: 'zo',
  ダ: 'da',
  ヂ: 'ji',
  ヅ: 'zu',
  デ: 'de',
  ド: 'do',
  バ: 'ba',
  ビ: 'bi',
  ブ: 'bu',
  ベ: 'be',
  ボ: 'bo',
  パ: 'pa',
  ピ: 'pi',
  プ: 'pu',
  ペ: 'pe',
  ポ: 'po',
  // Small vowels & extras
  ぁ: 'a',
  ぃ: 'i',
  ぅ: 'u',
  ぇ: 'e',
  ぉ: 'o',
  ァ: 'a',
  ィ: 'i',
  ゥ: 'u',
  ェ: 'e',
  ォ: 'o',
  ー: '-',
}

/**
 * Converts a Hiragana/Katakana string into standard Romaji.
 */
export function kanaToRomaji(kana: string): string {
  if (!kana) return ''
  let result = ''
  let i = 0

  while (i < kana.length) {
    // 1. Check for sokuon (っ / ッ)
    if (kana[i] === 'っ' || kana[i] === 'ッ') {
      if (i + 1 < kana.length) {
        // Peek next sound to double the consonant
        const nextTwo = kana.slice(i + 1, i + 3)
        const nextOne = kana[i + 1] ?? ''
        const nextRomaji = DIGRAPHS_ROMAJI[nextTwo] || MONOGRAPHS_ROMAJI[nextOne] || ''
        if (nextRomaji) {
          const firstChar = nextRomaji[0]
          // If next is 'ch', double with 't' (e.g. matcha)
          result += firstChar === 'c' ? 't' : firstChar
        }
      }
      i++
      continue
    }

    // 2. Check 2-character digraphs (e.g. きゃ, シュ)
    const twoChars = kana.slice(i, i + 2)
    if (DIGRAPHS_ROMAJI[twoChars]) {
      result += DIGRAPHS_ROMAJI[twoChars]
      i += 2
      continue
    }

    // 3. Check 1-character monographs
    const oneChar = kana[i] ?? ''
    if (oneChar === 'ー') {
      // Prolong previous vowel if possible
      const lastChar = result[result.length - 1]
      if (lastChar && 'aeiou'.includes(lastChar)) {
        result += lastChar
      } else {
        result += '-'
      }
      i++
      continue
    }

    if (MONOGRAPHS_ROMAJI[oneChar]) {
      result += MONOGRAPHS_ROMAJI[oneChar]
      i++
      continue
    }

    // Keep ASCII / spaces / punctuation as is
    result += oneChar
    i++
  }

  return result
}

export type RawWordUnit = {
  surface: string
  reading?: string | null
  startMs?: number | null
  endMs?: number | null
  token?: TranscriptToken
}

/**
 * Helper to check if a word is a dependent particle/auxiliary that should attach to the previous word.
 */
const DEPENDENT_PARTICLES = new Set([
  'は',
  'が',
  'を',
  'に',
  'で',
  'と',
  'も',
  'へ',
  'から',
  'まで',
  'より',
  'や',
  'か',
  'ね',
  'よ',
  'な',
  'の',
  'ば',
  'けど',
  'のに',
  'ので',
  'て',
  'た',
  'だ',
  'です',
  'ます',
  'ない',
  'たい',
  'らしい',
  'よう',
  'そう',
  'れる',
  'られる',
  'せる',
  'させる',
  'ぬ',
  'ず',
  'べき',
  'さん',
  'くん',
  'ちゃん',
  'たち',
  '的',
  '化',
])

function isDependentParticle(text: string): boolean {
  const trimmed = text.trim()
  return DEPENDENT_PARTICLES.has(trimmed) || /^[はがをにへとでもからまでよりやかねよなどのてただ]$/u.test(trimmed)
}

const INDEPENDENT_HIRAGANA = new Set([
  'あなた',
  'わたし',
  'ぼく',
  'おれ',
  'きみ',
  'かれ',
  'かのじょ',
  'これ',
  'それ',
  'あれ',
  'どれ',
  'ここ',
  'そこ',
  'あそこ',
  'どこ',
  'だれ',
  'なに',
  'なん',
  'いつ',
  'どう',
  'なぜ',
  'どうして',
  'いつも',
  'ずっと',
  'もっと',
  'とても',
  'すぐ',
  'まだ',
  'もう',
  'きっと',
  'そして',
  'しかし',
  'でも',
  'だから',
  'また',
  'みんな',
])

/**
 * Parse segment into atomic word units (Kanji + Furigana readings + timestamps).
 */
export function extractWordUnits(segment: TranscriptSegment): RawWordUnit[] {
  // 1. If textFurigana is present, parse ruby blocks and smartly attach okurigana
  if (segment.textFurigana && segment.textFurigana.includes('<ruby>')) {
    const units: RawWordUnit[] = []
    const regex = /<ruby>([^<]+)<rt>([^<]+)<\/rt><\/ruby>|([^<]+)/g
    let match: RegExpExecArray | null

    const segmenter =
      typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
        ? new Intl.Segmenter('ja', { granularity: 'word' })
        : null

    while ((match = regex.exec(segment.textFurigana)) !== null) {
      if (match[1] && match[2]) {
        units.push({ surface: match[1], reading: match[2] })
      } else if (match[3]) {
        const raw = match[3]
        const segments = segmenter ? Array.from(segmenter.segment(raw)).map((s) => s.segment) : [raw]

        let isDirectlyFollowingRuby = !raw.startsWith(' ') && units.length > 0
        for (const seg of segments) {
          const trimmed = seg.trim()
          if (!trimmed) {
            isDirectlyFollowingRuby = false
            continue
          }

          const isIndependent = INDEPENDENT_HIRAGANA.has(trimmed) || /[\u4e00-\u9faf\u30a0-\u30ff]/u.test(trimmed)
          if (isDirectlyFollowingRuby && !isIndependent) {
            // Attach okurigana or auxiliary verb (e.g. えて, くれ, た) to previous ruby unit
            const lastUnit = units[units.length - 1]
            if (lastUnit) {
              lastUnit.surface += trimmed
              lastUnit.reading = (lastUnit.reading || lastUnit.surface) + trimmed
            } else {
              units.push({ surface: trimmed, reading: trimmed })
            }
          } else {
            units.push({ surface: trimmed, reading: trimmed })
            isDirectlyFollowingRuby = false
          }
        }
      }
    }
    if (units.length > 0) return units
  }

  // 2. If tokens array with timestamps is present
  if (segment.tokens && segment.tokens.length > 0) {
    return segment.tokens.map((tok) => ({
      surface: tok.surface,
      reading: tok.reading || tok.surface,
      startMs: tok.startMs,
      endMs: tok.endMs,
      token: tok,
    }))
  }

  // 3. Fallback to Intl.Segmenter word segmentation
  const text = segment.textJa?.trim() || ''
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter('ja', { granularity: 'word' })
    return Array.from(segmenter.segment(text))
      .filter((s) => s.segment.trim())
      .map((s) => ({
        surface: s.segment,
        reading: s.segment,
      }))
  }

  return [{ surface: text, reading: text }]
}

/**
 * Builds smart Bunsetsu phrase chunks for a segment.
 * Groups content words with following particles/auxiliary verbs into coherent semantic phrase blocks.
 */
export function buildBunsetsuChunks(segment: TranscriptSegment): TranscriptChunk[] {
  // If pre-computed chunks exist from backend, return them
  if (segment.chunks && segment.chunks.length > 0) {
    return segment.chunks
  }

  const units = extractWordUnits(segment)
  if (units.length === 0) return []

  const segDuration = Math.max(100, segment.endMs - segment.startMs)
  const totalChars = units.reduce((sum, u) => sum + u.surface.length, 0) || 1

  // 1. Group units into Bunsetsu groups
  const groups: RawWordUnit[][] = []
  let currentGroup: RawWordUnit[] = []

  for (const unit of units) {
    if (!unit.surface.trim()) continue

    const isParticle = isDependentParticle(unit.surface)

    if (currentGroup.length === 0) {
      currentGroup.push(unit)
    } else if (isParticle) {
      // Attach particle/auxiliary to current phrase group
      currentGroup.push(unit)
    } else {
      // Next content word: close current group and start new one
      groups.push(currentGroup)
      currentGroup = [unit]
    }
  }
  if (currentGroup.length > 0) {
    groups.push(currentGroup)
  }

  // 2. Assign timestamps, readings, and romaji to each group
  let cumulativeChars = 0
  const chunks: TranscriptChunk[] = groups.map((grp, idx) => {
    const text = grp.map((u) => u.surface).join('')
    const reading = grp.map((u) => u.reading || u.surface).join('')
    const romaji = kanaToRomaji(reading)

    // Check if tokens inside have concrete timestamps
    const tokensWithStart = grp.filter((u) => typeof u.startMs === 'number' && (u.startMs as number) > 0)
    const tokensWithEnd = grp.filter((u) => typeof u.endMs === 'number' && (u.endMs as number) > 0)

    let startMs = segment.startMs
    let endMs = segment.endMs

    if (tokensWithStart.length > 0 && tokensWithEnd.length > 0) {
      startMs = Math.max(segment.startMs, tokensWithStart[0]?.startMs ?? segment.startMs)
      endMs = Math.min(segment.endMs, tokensWithEnd[tokensWithEnd.length - 1]?.endMs ?? segment.endMs)
    } else {
      // Proportional timing across segment
      const grpChars = text.length
      const startProg = cumulativeChars / totalChars
      const endProg = (cumulativeChars + grpChars) / totalChars
      startMs = Math.round(segment.startMs + segDuration * startProg)
      endMs = Math.round(segment.startMs + segDuration * endProg)
      cumulativeChars += grpChars
    }

    return {
      id: `${segment.id}_chunk_${idx}`,
      sequenceNo: idx + 1,
      text,
      reading,
      romaji,
      startMs,
      endMs: Math.max(startMs + 100, endMs),
    }
  })

  return chunks
}
