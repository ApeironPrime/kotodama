import fs from 'node:fs'
import path from 'node:path'
import {
  translateRadicalMeaning,
  toCanonicalRadicalGlyph,
  toRadicalFamilyGlyph,
  getRadicalMetadata,
  getRadicalMeaningByGlyph,
} from './radical-dictionary.mjs'

let DatabaseSync = null
try {
  const sqlite = await import('node:sqlite')
  DatabaseSync = sqlite.DatabaseSync
} catch {
  // Optional enrichment: gracefully skip if node:sqlite is unavailable
}

let masterDictDb = null
let masterDictCompoundStmt = null
let masterDictSingleCharStmt = null
let masterDictInitAttempted = false

function getMasterDictStatements() {
  if (masterDictInitAttempted) {
    return { compoundStmt: masterDictCompoundStmt, singleCharStmt: masterDictSingleCharStmt }
  }
  masterDictInitAttempted = true
  if (!DatabaseSync) return { compoundStmt: null, singleCharStmt: null }
  const dbPath = path.resolve(process.cwd(), 'data', 'master_dictionary.db')
  if (!fs.existsSync(dbPath)) return { compoundStmt: null, singleCharStmt: null }
  try {
    masterDictDb = new DatabaseSync(dbPath, { open: true, readOnly: true })
    masterDictCompoundStmt = masterDictDb.prepare(
      `SELECT word, reading, han_viet, jlpt, meanings, examples
         FROM words
        WHERE word LIKE ?
          AND length(word) BETWEEN 2 AND 6
        ORDER BY
          CASE WHEN jlpt IS NOT NULL THEN 0 ELSE 1 END,
          CASE WHEN examples IS NOT NULL AND examples != '[]' THEN 0 ELSE 1 END,
          length(word) ASC
        LIMIT 14`
    )
    masterDictSingleCharStmt = masterDictDb.prepare(`SELECT meanings FROM words WHERE word = ? LIMIT 3`)
  } catch {
    masterDictDb = null
    masterDictCompoundStmt = null
    masterDictSingleCharStmt = null
  }
  return { compoundStmt: masterDictCompoundStmt, singleCharStmt: masterDictSingleCharStmt }
}

function parseJsonArraySafe(raw) {
  if (!raw || typeof raw !== 'string') return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// Helper to remove Vietnamese diacritics for flexible search
function removeVietnameseTones(str) {
  if (!str) return ''
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
}

function katakanaToHiragana(str) {
  if (!str) return ''
  return String(str).replace(/[\u30a1-\u30f6]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
}

const HIRA_TO_ROMAJI = {
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
  を: 'wo',
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
  ぁ: 'a',
  ぃ: 'i',
  ぅ: 'u',
  ぇ: 'e',
  ぉ: 'o',
}

function kanaToRomaji(raw) {
  if (!raw) return ''
  const parts = String(raw)
    .split(/[,、;；/\s]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 3)

  const convertOne = (token) => {
    const clean = katakanaToHiragana(token).replace(/[.\-・（）()~〜]/g, '')
    let out = ''
    for (let i = 0; i < clean.length; i++) {
      const ch = clean[i]
      if (ch === 'っ' && i + 1 < clean.length) {
        const nextTwo = clean.slice(i + 1, i + 3)
        const nextRom = HIRA_TO_ROMAJI[nextTwo] || HIRA_TO_ROMAJI[clean[i + 1]] || ''
        if (nextRom) out += nextRom[0]
        continue
      }
      if (ch === 'ー' && out.length > 0) {
        out += out[out.length - 1]
        continue
      }
      const pair = clean.slice(i, i + 2)
      if (HIRA_TO_ROMAJI[pair]) {
        out += HIRA_TO_ROMAJI[pair]
        i++
        continue
      }
      if (HIRA_TO_ROMAJI[ch]) {
        out += HIRA_TO_ROMAJI[ch]
      }
    }
    return out
  }

  return parts.map(convertOne).filter(Boolean).join(', ')
}

const ROMAJI_TABLE = [
  ['kya', 'きゃ'],
  ['kyu', 'きゅ'],
  ['kyo', 'きょ'],
  ['sha', 'しゃ'],
  ['shu', 'しゅ'],
  ['sho', 'しょ'],
  ['sya', 'しゃ'],
  ['syu', 'しゅ'],
  ['syo', 'しょ'],
  ['cha', 'ちゃ'],
  ['chu', 'ちゅ'],
  ['cho', 'ちょ'],
  ['tya', 'ちゃ'],
  ['tyu', 'ちゅ'],
  ['tyo', 'ちょ'],
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
  ['ja', 'じゃ'],
  ['ju', 'じゅ'],
  ['jo', 'じょ'],
  ['jya', 'じゃ'],
  ['jyu', 'じゅ'],
  ['jyo', 'じょ'],
  ['bya', 'びゃ'],
  ['byu', 'びゅ'],
  ['byo', 'びょ'],
  ['pya', 'ぴゃ'],
  ['pyu', 'ぴゅ'],
  ['pyo', 'ぴょ'],
  ['shi', 'し'],
  ['chi', 'ち'],
  ['tsu', 'つ'],
  ['fu', 'ふ'],
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
  ['wo', 'を'],
  ['ga', 'が'],
  ['gi', 'ぎ'],
  ['gu', 'ぐ'],
  ['ge', 'げ'],
  ['go', 'ご'],
  ['za', 'ざ'],
  ['zi', 'じ'],
  ['ji', 'じ'],
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
  ['a', 'あ'],
  ['i', 'い'],
  ['u', 'う'],
  ['e', 'え'],
  ['o', 'お'],
  ['n', 'ん'],
]

function romajiToHiragana(input) {
  const s = String(input || '')
    .toLowerCase()
    .trim()
  if (!s || !/^[a-z\-']+$/u.test(s)) return ''
  let out = ''
  let i = 0
  while (i < s.length) {
    if (s[i] === '-' || s[i] === "'") {
      i++
      continue
    }
    if (i + 1 < s.length && s[i] === s[i + 1] && /[bcdfghjklmpqrstvwxyz]/.test(s[i]) && s[i] !== 'n') {
      out += 'っ'
      i++
      continue
    }
    if (s[i] === 'n' && i + 1 < s.length && !/[aeiouy]/.test(s[i + 1]) && s[i + 1] !== 'n') {
      out += 'ん'
      i++
      continue
    }
    let matched = false
    for (const [rom, hira] of ROMAJI_TABLE) {
      if (s.startsWith(rom, i)) {
        out += hira
        i += rom.length
        matched = true
        break
      }
    }
    if (!matched) return ''
  }
  return out
}

function numericStroke(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function extractStoryComponentChars(text) {
  if (!text) return []
  const chars = new Set()
  const matches = String(text).matchAll(/[（(]([^\s）)]{1})[）)]/g)
  for (const m of matches) {
    const canon = toCanonicalRadicalGlyph(m[1])
    if (canon && /[\u4e00-\u9fff\u3400-\u4dbf]/.test(canon)) {
      chars.add(canon)
    }
  }
  return [...chars]
}

function parseCSVLine(text) {
  const result = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  result.push(cur)
  return result
}

function firstUsefulMeaning(item) {
  const exampleMeaning = Array.isArray(item.examples)
    ? item.examples.find((example) => typeof example?.m === 'string' && example.m.trim())?.m
    : ''
  if (exampleMeaning) return exampleMeaning.trim().replace(/\s+/g, ' ')

  const firstLine = typeof item.detail === 'string' ? item.detail.split(/\r?\n/)[0] : ''
  return firstLine.replace(/^\s*\d+[.)]\s*/, '').trim()
}

function compositionDescription(item) {
  if (!Array.isArray(item.compDetail) || item.compDetail.length === 0) return ''
  const components = item.compDetail
    .filter((component) => typeof component?.w === 'string' && component.w)
    .map((component) => `${component.w}${component.h ? ` (${component.h})` : ''}`)
  return components.length ? `Cấu tạo: ${components.join(' + ')}` : ''
}

function normalizeJlptExamMetadata(exam, defaults = {}) {
  const rawYear = String(exam.year ?? '').trim()
  const rawTitle = String(exam.title ?? '').trim()
  const combined = `${rawYear} ${rawTitle}`
  const year =
    rawYear.match(/(?:19|20)\d{2}/)?.[0] ?? rawTitle.match(/(?:19|20)\d{2}/)?.[0] ?? defaults.year ?? exam.year
  const inferredSession = combined.match(/(?:^|\D)(07|12)(?=\D|$)/)?.[1]
  const rawSession = String(exam.session ?? '').trim()
  const sessionLooksLikeYear = /^(?:19|20)\d{2}$/u.test(rawSession)
  const rawYearLooksLikeSession = /^(?:07|12)$/u.test(rawYear)
  const session =
    (sessionLooksLikeYear ? undefined : exam.session) ??
    inferredSession ??
    (rawYearLooksLikeSession ? rawYear : undefined) ??
    defaults.session ??
    exam.session

  return { ...exam, year, session }
}

function normalizeQuestionTextForExplanationMatch(question) {
  return String(question?.sentence || question?.text || question?.question || '')
    .replace(/<br\s*\/?\s*>/giu, ' ')
    .replace(/<[^>]*>/gu, '')
    .replace(/&nbsp;|&#160;/giu, ' ')
    .replace(/&amp;/giu, '&')
    .replace(/&quot;|&#34;/giu, '"')
    .replace(/&apos;|&#39;/giu, "'")
    .replace(/&lt;/giu, '<')
    .replace(/&gt;/giu, '>')
    .normalize('NFKC')
    .replace(/[‐‑‒–—―]/gu, 'ー')
    .replace(/[「」『』【】()（）［］:：,，、。.!！?？"“”]/gu, '')
    .replace(/\s+/gu, '')
    .replace(/^\[\s*\d+\s*\]/u, '')
    .replace(/^\d+[)）.．、]?/u, '')
    .replace(/^A(?=[一-龯ぁ-んァ-ン])/u, '')
}

function normalizeQuestionPassageForExplanationMatch(passage) {
  return String(passage || '')
    .replace(/<br\s*\/?\s*>/giu, ' ')
    .replace(/<[^>]*>/gu, '')
    .replace(/&nbsp;|&#160;/giu, ' ')
    .replace(/&amp;/giu, '&')
    .replace(/&quot;|&#34;/giu, '"')
    .replace(/&apos;|&#39;/giu, "'")
    .replace(/&lt;/giu, '<')
    .replace(/&gt;/giu, '>')
    .normalize('NFKC')
    .replace(/【\s*(?:[1-5]|19|20|21|22|23)\s*】|[（(]\s*(?:19|20|21|22|23)\s*[）)]/gu, ' GAP ')
    .replace(/[\s「」『』【】()（）［］:：,，、。.!！?？"“”]/gu, '')
}

function normalizeQuestionOptionsForExplanationMatch(question) {
  if (!Array.isArray(question?.options)) return []
  return question.options.map((option) => {
    const text = typeof option === 'string' ? option : (option?.text ?? option?.value ?? '')
    return String(text)
      .normalize('NFKC')
      .replace(/^\s*[1-4](?:[.．、]\s*|\s+)/u, '')
      .replace(/\s+/gu, '')
      .replace(/[。．.、,，]+$/gu, '')
  })
}

function normalizeSectionQuestionOptionsForMatch(question) {
  if (!Array.isArray(question?.options)) return []
  return question.options.map((option) => {
    const text = typeof option === 'string' ? option : (option?.text ?? option?.value ?? '')
    return String(text)
      .normalize('NFKC')
      .replace(/[⓵①➀]/gu, '1')
      .replace(/[⓶②➁]/gu, '2')
      .replace(/[⓷③➂]/gu, '3')
      .replace(/[⓸④➃]/gu, '4')
      .replace(/好き/gu, 'すき')
      .replace(/社長/gu, 'しゃちょう')
      .replace(/食べ放題/gu, '食べほうだい')
      .replace(/価格/gu, 'かかく')
      .replace(/^\s*[1-4](?=$|[.．、\s])(?:[.．、]\s*|\s*)/u, '')
      .replace(/\s+/gu, '')
      .replace(/[。．.、,，]+$/gu, '')
  })
}

function examSessionKey(exam) {
  const year = String(exam?.year || '').trim()
  if (/^\d{4}$/u.test(year)) {
    const month = String(exam?.session || '')
      .trim()
      .padStart(2, '0')
    return /^(07|12)$/u.test(month) ? `${year}${month}` : ''
  }
  const match = /^(07|12)\s+(\d{4})$/u.exec(year)
  return match ? `${match[2]}${match[1]}` : ''
}

function hasSameQuestionContent(question, sourceQuestion, { ignoreQuestionNumber = false } = {}) {
  if (!ignoreQuestionNumber && Number(question?.number) !== Number(sourceQuestion?.number)) return false
  if (
    Number(question?.correctAnswer ?? question?.answer) !==
    Number(sourceQuestion?.correctAnswer ?? sourceQuestion?.answer)
  )
    return false

  const questionText = normalizeQuestionTextForExplanationMatch(question)
  if (!questionText || questionText !== normalizeQuestionTextForExplanationMatch(sourceQuestion)) return false

  const options = normalizeQuestionOptionsForExplanationMatch(question)
  const sourceOptions = normalizeQuestionOptionsForExplanationMatch(sourceQuestion)
  return (
    options.length === 4 &&
    sourceOptions.length === 4 &&
    options.every((option, index) => option === sourceOptions[index])
  )
}

function hasSameSectionPositionQuestionContent(question, sourceQuestion) {
  if (
    Number(question?.correctAnswer ?? question?.answer) !==
    Number(sourceQuestion?.correctAnswer ?? sourceQuestion?.answer)
  ) {
    return false
  }

  const questionText = normalizeQuestionTextForExplanationMatch(question)
  if (!questionText || questionText !== normalizeQuestionTextForExplanationMatch(sourceQuestion)) return false

  const options = normalizeSectionQuestionOptionsForMatch(question)
  const sourceOptions = normalizeSectionQuestionOptionsForMatch(sourceQuestion)
  const answer = Number(question?.correctAnswer ?? question?.answer)
  if (options.length < 3 || options.length !== sourceOptions.length || !Number.isInteger(answer)) return false

  const sectionUsesNumberOnlyChoices = options.every((option) => option === '')
  return sectionUsesNumberOnlyChoices || options.every((option, index) => option === sourceOptions[index])
}

function firstQuestionImage(question) {
  if (typeof question?.image === 'string' && question.image.trim()) return question.image.trim()
  const html = String(question?.sentence || question?.text || question?.question || '')
  const source = html.match(/<img\b[^>]*\bsrc\s*=\s*(['"])(.*?)\1/iu)?.[2]
  return source?.replace(/&amp;/giu, '&').trim() || ''
}

function hasSameStarOrderQuestionContent(question, sourceQuestion, explanation) {
  if (Number(question?.number) !== Number(sourceQuestion?.number)) return false
  const answer = Number(question?.correctAnswer ?? question?.answer)
  if (answer !== Number(sourceQuestion?.correctAnswer ?? sourceQuestion?.answer)) return false

  const options = normalizeQuestionOptionsForExplanationMatch(question)
  const sourceOptions = normalizeQuestionOptionsForExplanationMatch(sourceQuestion)
  if (
    options.length !== 4 ||
    sourceOptions.length !== 4 ||
    !options.every((option, index) => option === sourceOptions[index])
  ) {
    return false
  }

  const sourceOrder = sourceQuestion?.starCorrectOrder
  const verifiedSourceOrder =
    sourceQuestion?.starOrderVerified === true &&
    sourceQuestion?.starPositionVerified === true &&
    Array.isArray(sourceOrder) &&
    sourceOrder.length === 4 &&
    sourceOrder.every((number) => Number.isInteger(number) && number >= 1 && number <= 4) &&
    new Set(sourceOrder).size === 4 &&
    Number.isInteger(sourceQuestion.starPosition) &&
    sourceQuestion.starPosition >= 0 &&
    sourceQuestion.starPosition < 4 &&
    sourceOrder[sourceQuestion.starPosition] === answer
  const orderMatch = String(explanation || '').match(
    /(?:Thứ tự(?: bốn mảnh)?(?: ghép đúng)? là|thứ tự ghép là)\s*([1-4])\s*(?:→|->)\s*([1-4])\s*(?:→|->)\s*([1-4])\s*(?:→|->)\s*([1-4])/iu
  )
  const order = verifiedSourceOrder ? sourceOrder : orderMatch?.slice(1).map(Number)
  if (!order || new Set(order).size !== 4 || order[sourceQuestion?.starPosition ?? 2] !== answer) return false

  const assembled = order
    .map((optionNumber) => options[optionNumber - 1])
    .join('')
    .normalize('NFKC')
    .replace(/\s+/gu, '')
    .replace(/[、。,.，]/gu, '')
  const script = String(question?.script || '')
    .replace(/<[^>]*>/gu, '')
    .replace(/&nbsp;|&#160;|&#x0*a0;/giu, ' ')
    .normalize('NFKC')
    .replace(/\s+/gu, '')
    .replace(/[、。,.，]/gu, '')
  // Section copies sometimes retain the surrounding clause from the source
  // sentence, while the full-mock source contains only the four ordered
  // fragments. The source order, star position, answer and all four options
  // have already been checked above, so the reconstructed fragment sequence
  // may safely appear within that larger script.
  return Boolean(script) && script.includes(assembled)
}

function hasSameClozeQuestionContent(question, sourceQuestion, sectionPart, sourcePart) {
  if (Number(question?.number) !== Number(sourceQuestion?.number)) return false
  if (
    Number(question?.correctAnswer ?? question?.answer) !==
    Number(sourceQuestion?.correctAnswer ?? sourceQuestion?.answer)
  ) {
    return false
  }

  const options = normalizeQuestionOptionsForExplanationMatch(question)
  const sourceOptions = normalizeQuestionOptionsForExplanationMatch(sourceQuestion)
  if (
    options.length !== 4 ||
    sourceOptions.length !== 4 ||
    !options.every((option, index) => option === sourceOptions[index])
  ) {
    return false
  }

  const passage = normalizeQuestionPassageForExplanationMatch(sectionPart?.passage)
  const sourcePassage = normalizeQuestionPassageForExplanationMatch(sourcePart?.passage)
  return Boolean(passage && sourcePassage && passage === sourcePassage)
}

function normalizeMazziKanji(item) {
  const composition = compositionDescription(item)
  const examples = Array.isArray(item.examples)
    ? item.examples
        .filter((example) => typeof example?.w === 'string' && example.w)
        .map((example, index) => ({
          id: `${item.id ?? item.mobileId ?? item.kanji}-${index}`,
          word: example.w.trim(),
          reading: typeof example.p === 'string' ? example.p.trim() : '',
          meaning: typeof example.m === 'string' ? example.m.trim() : '',
          yinHan: typeof example.h === 'string' ? example.h.trim() : '',
        }))
    : []
  const rawRadical = typeof item.comp === 'string' && item.comp.trim() ? item.comp.trim() : ''
  const radicalUtf = rawRadical ? toCanonicalRadicalGlyph(rawRadical) : '—'
  const radMeta = getRadicalMetadata(radicalUtf === '—' ? '' : radicalUtf)
  const onyomi = typeof item.on === 'string' ? item.on.trim() : ''
  const kunyomi = typeof item.kun === 'string' ? item.kun.trim() : ''
  const summary = {
    kanji: item.kanji,
    hanzi: typeof item.mean === 'string' ? item.mean.trim() : '',
    meaning_vi: firstUsefulMeaning(item),
    meaning_en: '',
    jlpt_level: typeof item.level === 'string' ? item.level.trim().toUpperCase() : '',
    onyomi,
    kunyomi,
    stroke_count: item.stroke_count ?? '',
    numericStrokeCount: numericStroke(item.stroke_count),
    radical_utf: radicalUtf,
    radical_family: radMeta.family,
    radical_vi_name: radMeta.nameVi,
    radical_name_ja: composition ? 'Thành phần cấu tạo' : '',
    radical_meaning: composition,
    story: composition,
    storyComponents: extractStoryComponentChars(composition),
    readingsHiragana: katakanaToHiragana(`${onyomi} ${kunyomi}`.toLowerCase()),
    num_vocab_examples: examples.length,
  }
  const detail = {
    kanji: item.kanji,
    kanjiInfo: {
      id: String(item.id ?? item.mobileId ?? item.kanji),
      hanzi: summary.hanzi,
      meaning: typeof item.detail === 'string' ? item.detail.trim() : summary.meaning_vi,
      story: composition,
      jlptLevel: summary.jlpt_level,
      kanjialiveData: {
        rad_name_ja: summary.radical_name_ja,
        onyomi_ja: summary.onyomi,
        kunyomi_ja: summary.kunyomi,
        rad_utf: summary.radical_utf,
        rad_meaning: summary.radical_meaning,
        examples,
      },
    },
  }
  return { summary, detail }
}

function normalizeHackNaoKanji(item, level, index, allInLevel) {
  const kanji = String(item?.kanji || '').trim()
  const hanzi = String(item?.han_viet || (kanji === '那' ? 'NA' : '')).trim()
  const meaningVi = String(item?.nghia || '').trim()
  const jlptLevel = String(item?.cap_do || level || '')
    .trim()
    .toUpperCase()
  const onyomi = Array.isArray(item?.am_on) ? item.am_on.filter(Boolean).join(', ') : String(item?.am_on || '').trim()
  const kunyomi = Array.isArray(item?.am_kun)
    ? item.am_kun.filter(Boolean).join(', ')
    : String(item?.am_kun || '').trim()
  const strokeCount =
    typeof item?.so_net === 'number' ? item.so_net : Number.parseInt(String(item?.so_net || ''), 10) || ''
  const rawRadicalUtf = String(item?.bo_thu || '').trim()
  const radicalUtf = rawRadicalUtf ? toCanonicalRadicalGlyph(rawRadicalUtf) : '—'
  const radMeta = getRadicalMetadata(radicalUtf === '—' ? '' : radicalUtf)
  const radicalNameJa = String(item?.ten_bo_thu || '').trim()
  const radicalMeaning = translateRadicalMeaning(item?.nghia_bo_thu, radicalUtf)
  const story = String(item?.cau_chuyen_ghi_nho || '').trim()
  const storyComponents = extractStoryComponentChars(story)

  const examples = Array.isArray(item?.tu_vung_vi_du)
    ? item.tu_vung_vi_du
        .filter((ex) => ex && typeof ex.tu === 'string' && ex.tu.trim())
        .map((ex, exIdx) => ({
          id: `${kanji}-${exIdx}`,
          word: ex.tu.trim(),
          reading: typeof ex.cach_doc === 'string' ? ex.cach_doc.trim() : '',
          meaning: typeof ex.nghia === 'string' ? ex.nghia.trim() : '',
          yinHan: typeof ex.han_viet === 'string' ? ex.han_viet.trim() : '',
          example: typeof ex.cau_vi_du === 'string' ? ex.cau_vi_du.trim() : '',
          exampleVi: typeof ex.nghia_cau_vi_du === 'string' ? ex.nghia_cau_vi_du.trim() : '',
        }))
    : []

  const prevKanji = index > 0 && allInLevel && allInLevel[index - 1] ? allInLevel[index - 1].kanji : undefined
  const nextKanji =
    index < (allInLevel?.length ?? 0) - 1 && allInLevel && allInLevel[index + 1]
      ? allInLevel[index + 1].kanji
      : undefined

  const summary = {
    kanji,
    hanzi,
    meaning_vi: meaningVi,
    meaning_en: radicalMeaning,
    jlpt_level: jlptLevel,
    onyomi,
    kunyomi,
    stroke_count: strokeCount,
    numericStrokeCount: numericStroke(strokeCount),
    radical_utf: radicalUtf,
    radical_family: radMeta.family,
    radical_vi_name: radMeta.nameVi,
    radical_name_ja: radicalNameJa,
    radical_meaning: radicalMeaning,
    story,
    storyComponents,
    readingsHiragana: katakanaToHiragana(`${onyomi} ${kunyomi}`.toLowerCase()),
    num_vocab_examples: examples.length,
    normalizedHanzi: removeVietnameseTones(hanzi),
    normalizedMeaning: removeVietnameseTones(meaningVi),
    normalizedRadical: removeVietnameseTones(`${radMeta.nameVi} ${radicalMeaning}`),
    ...(prevKanji ? { prev_kanji: prevKanji } : {}),
    ...(nextKanji ? { next_kanji: nextKanji } : {}),
  }

  const detail = {
    kanji,
    kanjiInfo: {
      id: String(item?.stt ?? kanji),
      hanzi,
      meaning: meaningVi,
      story,
      jlptLevel,
      kanjialiveData: {
        rad_name_ja: radicalNameJa,
        onyomi_ja: onyomi,
        kunyomi_ja: kunyomi,
        rad_utf: radicalUtf,
        rad_meaning: radicalMeaning,
        examples,
      },
    },
  }

  return { summary, detail }
}

export class NhaiKanjiService {
  constructor(options = {}) {
    this.kanjiDataPath = options.kanjiDataPath !== undefined ? options.kanjiDataPath : process.env.KANJI_DATA_PATH || ''
    this.mazziDataPath = options.mazziDataPath || process.env.MAZII_CRAWLER_DATA_PATH || ''
    this.dataPath = options.dataPath || process.env.NHAIKANJI_DATA_PATH || ''

    this.kanjiSummaryList = []
    this.kanjiMap = new Map() // kanji char -> summary object
    this.verifiedDescendantsMap = new Map() // component char -> derived kanji summaries
    this.fullKanjiData = null // loaded lazily or on demand
    this.bunpoList = []
    this.jlptExamsMaster = null

    this.isLoaded = false
  }

  loadHackNaoKanji() {
    const filePath = this.kanjiDataPath
    if (!filePath || !fs.existsSync(filePath)) {
      return false
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8')
      const data = JSON.parse(content)

      this.kanjiSummaryList = []
      this.kanjiMap.clear()
      this.fullKanjiData = {}

      const levels = ['N5', 'N4', 'N3', 'N2', 'N1']
      for (const lvl of levels) {
        const items = data[lvl]
        if (!Array.isArray(items)) continue

        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          if (!item || typeof item.kanji !== 'string' || !item.kanji.trim() || this.kanjiMap.has(item.kanji)) continue

          const normalized = normalizeHackNaoKanji(item, lvl, i, items)
          this.kanjiSummaryList.push(normalized.summary)
          this.kanjiMap.set(normalized.summary.kanji, normalized.summary)
          this.fullKanjiData[normalized.summary.kanji] = normalized.detail
        }
      }

      if (this.kanjiSummaryList.length === 0) {
        throw new Error('Hack Nao Kanji JSON contains no valid entries')
      }

      return true
    } catch (err) {
      console.warn('[NhaiKanjiService] Failed to load Hack Nao Kanji:', err.message)
      this.kanjiSummaryList = []
      this.kanjiMap.clear()
      this.fullKanjiData = null
      return false
    }
  }

  loadMazziKanjiCourses() {
    if (!this.mazziDataPath) return false

    const courseFile = path.join(this.mazziDataPath, 'courses', 'kanji_all_levels.json')
    if (!fs.existsSync(courseFile)) {
      console.warn(`[NhaiKanjiService] MAZII_CRAWLER_DATA_PATH has no Kanji course data: ${courseFile}`)
      return false
    }

    try {
      const records = JSON.parse(fs.readFileSync(courseFile, 'utf8'))
      if (!Array.isArray(records)) throw new Error('kanji_all_levels.json must contain an array')

      this.fullKanjiData = {}
      for (const item of records) {
        if (!item || typeof item.kanji !== 'string' || !item.kanji.trim() || this.kanjiMap.has(item.kanji)) continue
        const normalized = normalizeMazziKanji(item)
        normalized.summary.normalizedHanzi = removeVietnameseTones(normalized.summary.hanzi)
        normalized.summary.normalizedMeaning = removeVietnameseTones(normalized.summary.meaning_vi)
        this.kanjiSummaryList.push(normalized.summary)
        this.kanjiMap.set(normalized.summary.kanji, normalized.summary)
        this.fullKanjiData[normalized.summary.kanji] = normalized.detail
      }

      if (this.kanjiSummaryList.length === 0) throw new Error('Kanji course data contains no valid entries')
      return true
    } catch (err) {
      console.warn('[NhaiKanjiService] Failed to load Mazii Kanji courses:', err.message)
      this.kanjiSummaryList = []
      this.kanjiMap.clear()
      this.fullKanjiData = null
      return false
    }
  }

  ensureLoaded() {
    if (this.isLoaded) {
      this.reloadFullMaster()
      return
    }

    try {
      // 1. Primary canonical source: Hack Nao Kanji N1-N5 dataset.
      const loadedHackNao = this.loadHackNaoKanji()

      // 2. Fallbacks only when Hack Nao Kanji was not available (e.g. mock test environments)
      if (!loadedHackNao) {
        const loadedMazziCourses = this.loadMazziKanjiCourses()
        if (!loadedMazziCourses && this.dataPath) {
          const summaryFile = path.join(this.dataPath, 'kanji_summary.csv')
          if (fs.existsSync(summaryFile)) {
            let raw = fs.readFileSync(summaryFile, 'utf8').replace(/^\uFEFF/, '')
            const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0)
            if (lines.length > 1) {
              const headers = parseCSVLine(lines[0]).map((h) => h.trim().replace(/^\uFEFF/, ''))
              for (let i = 1; i < lines.length; i++) {
                const cols = parseCSVLine(lines[i])
                const row = {}
                headers.forEach((h, idx) => {
                  row[h] = (cols[idx] || '').trim()
                })
                if (row.kanji) {
                  row.radical_utf = row.radical_utf ? toCanonicalRadicalGlyph(row.radical_utf) : '—'
                  const radMeta = getRadicalMetadata(row.radical_utf === '—' ? '' : row.radical_utf)
                  row.radical_family = radMeta.family
                  row.radical_vi_name = radMeta.nameVi
                  row.numericStrokeCount = numericStroke(row.stroke_count)
                  row.readingsHiragana = katakanaToHiragana(`${row.onyomi || ''} ${row.kunyomi || ''}`.toLowerCase())
                  row.normalizedHanzi = removeVietnameseTones(row.hanzi)
                  row.normalizedMeaning = removeVietnameseTones(row.meaning_vi)
                  row.normalizedRadical = removeVietnameseTones(`${radMeta.nameVi} ${row.radical_meaning || ''}`)
                  this.kanjiSummaryList.push(row)
                  this.kanjiMap.set(row.kanji, row)
                }
              }
            }
          }
        }
      }

      // 3. Load Bunpo data
      if (this.dataPath) {
        const bunpoFile = path.join(this.dataPath, 'bunpo_data.json')
        if (fs.existsSync(bunpoFile)) {
          const rawBunpo = fs.readFileSync(bunpoFile, 'utf8')
          this.bunpoList = JSON.parse(rawBunpo).map((item) => ({
            ...item,
            normalizedPattern: removeVietnameseTones(item.pattern),
            normalizedMeaning: removeVietnameseTones(item.shortMeaning || ''),
          }))
        }
      }

      // 4. Load JLPT Full Master (N1 -> N5 từ Corodomo với Từ vựng, Ngữ pháp, Đọc hiểu có bài đọc, Nghe hiểu có Audio)
      this.fullMasterFile = path.resolve(process.cwd(), 'data', 'jlpt_full_master.json')
      this.fullMasterMtime = 0
      this.toanMasterFile = path.resolve(process.cwd(), 'data', 'jlpt_n3_toan_master.json')
      this.toanMasterMtime = 0
      this.listeningImageAssetsFile = path.resolve(process.cwd(), 'data', 'jlpt_n3_listening_image_assets.json')
      this.listeningImageAssetsMtime = 0
      this.listeningImageAssets = {}
      this.listeningImageAssetAliases = {}
      this.listeningQuestionAliases = {}
      this.curatedExplanationsFile = path.resolve(process.cwd(), 'data', 'jlpt_n3_explanations_curated.json')
      this.curatedExplanationsMtime = 0
      this.curatedExplanations = {}
      this.reloadFullMaster()

      // 5. Load JLPT Exams Master dự phòng
      if (this.dataPath) {
        const jlptFile = path.join(this.dataPath, 'de_thi_jlpt', 'jlpt_all_exams_master.json')
        if (fs.existsSync(jlptFile)) {
          const rawJlpt = fs.readFileSync(jlptFile, 'utf8')
          this.jlptExamsMaster = JSON.parse(rawJlpt)
        }
      }

      this.buildVerifiedDescendantsIndex()
      this.isLoaded = true
    } catch (err) {
      console.warn('[NhaiKanjiService] Warning during load:', err.message)
      this.isLoaded = true
    }
  }

  buildVerifiedDescendantsIndex() {
    this.verifiedDescendantsMap = new Map()
    const jlptOrder = { N5: 1, N4: 2, N3: 3, N2: 4, N1: 5 }
    const temp = new Map()

    for (const k of this.kanjiSummaryList) {
      const parents = new Set()
      if (Array.isArray(k.storyComponents)) {
        for (const comp of k.storyComponents) {
          const canon = toCanonicalRadicalGlyph(comp)
          if (canon && canon !== k.kanji) parents.add(canon)
        }
      }
      if (k.radical_utf && k.radical_utf !== '—') {
        const canonRad = toCanonicalRadicalGlyph(k.radical_utf)
        if (canonRad && canonRad !== k.kanji) parents.add(canonRad)
        if (k.radical_family && k.radical_family !== k.kanji) parents.add(k.radical_family)
      }
      for (const parent of parents) {
        if (!temp.has(parent)) temp.set(parent, [])
        temp.get(parent).push({
          char: k.kanji,
          label: k.hanzi,
          meaning: k.meaning_vi,
          rank: jlptOrder[(k.jlpt_level || '').toUpperCase()] || 99,
        })
      }
    }

    for (const [parent, list] of temp.entries()) {
      list.sort((a, b) => a.rank - b.rank)
      this.verifiedDescendantsMap.set(
        parent,
        list.slice(0, 8).map(({ char, label, meaning }) => ({ char, label, meaning }))
      )
    }
  }

  reloadFullMaster() {
    try {
      if (this.fullMasterFile && fs.existsSync(this.fullMasterFile)) {
        const stats = fs.statSync(this.fullMasterFile)
        if (stats.mtimeMs > this.fullMasterMtime) {
          const rawFull = fs.readFileSync(this.fullMasterFile, 'utf8')
          this.jlptFullMaster = JSON.parse(rawFull)
          this.fullMasterMtime = stats.mtimeMs
        }
      }
      if (this.toanMasterFile && fs.existsSync(this.toanMasterFile)) {
        const stats = fs.statSync(this.toanMasterFile)
        if (stats.mtimeMs > this.toanMasterMtime) {
          const rawToan = fs.readFileSync(this.toanMasterFile, 'utf8')
          this.toanMockMaster = JSON.parse(rawToan)
          this.toanMasterMtime = stats.mtimeMs
        }
      }
      if (this.listeningImageAssetsFile && fs.existsSync(this.listeningImageAssetsFile)) {
        const stats = fs.statSync(this.listeningImageAssetsFile)
        if (stats.mtimeMs > this.listeningImageAssetsMtime) {
          const rawAssets = fs.readFileSync(this.listeningImageAssetsFile, 'utf8')
          const parsedAssets = JSON.parse(rawAssets)
          this.listeningImageAssets = parsedAssets.assets || {}
          this.listeningImageAssetAliases = parsedAssets.aliases || {}
          this.listeningQuestionAliases = parsedAssets.questionAliases || {}
          this.listeningImageAssetsMtime = stats.mtimeMs
        }
      }
      if (this.curatedExplanationsFile && fs.existsSync(this.curatedExplanationsFile)) {
        const stats = fs.statSync(this.curatedExplanationsFile)
        if (stats.mtimeMs > this.curatedExplanationsMtime) {
          const rawExplanations = fs.readFileSync(this.curatedExplanationsFile, 'utf8')
          this.curatedExplanations = JSON.parse(rawExplanations)
          this.curatedExplanationsMtime = stats.mtimeMs
        }
      }
    } catch (err) {
      console.warn('[NhaiKanjiService] Failed to reload full master:', err.message)
    }
  }

  loadFullKanjiJson() {
    if (this.fullKanjiData) return this.fullKanjiData
    if (!this.dataPath) {
      this.fullKanjiData = {}
      return this.fullKanjiData
    }
    try {
      const fullFile = path.join(this.dataPath, 'kanji_full_data.json')
      if (fs.existsSync(fullFile)) {
        const raw = fs.readFileSync(fullFile, 'utf8')
        this.fullKanjiData = JSON.parse(raw)
      } else {
        this.fullKanjiData = {}
      }
    } catch (err) {
      console.warn('[NhaiKanjiService] Failed to load full kanji json:', err.message)
      this.fullKanjiData = {}
    }
    return this.fullKanjiData
  }

  computeLevelCounts(list) {
    const counts = { ALL: list.length, N5: 0, N4: 0, N3: 0, N2: 0, N1: 0 }
    for (const k of list) {
      const lvl = k.jlpt_level ? k.jlpt_level.toUpperCase() : ''
      if (lvl === 'N5' || lvl === 'N4' || lvl === 'N3' || lvl === 'N2' || lvl === 'N1') {
        counts[lvl]++
      }
    }
    return counts
  }

  getKanjiList({ level, query = '', radical = '', strokeMin, strokeMax, page = 1, limit = 50, sort = 'default' } = {}) {
    this.ensureLoaded()
    const catalogCounts = this.computeLevelCounts(this.kanjiSummaryList)
    let results = this.kanjiSummaryList

    if (radical && String(radical).trim()) {
      const rawRad = String(radical).trim()
      const canonRad = toCanonicalRadicalGlyph(rawRad)
      const targetFamily = toRadicalFamilyGlyph(canonRad)
      results = results.filter((k) => {
        const kRad = k.radical_utf || ''
        const kFamily = k.radical_family || toRadicalFamilyGlyph(kRad)
        return (
          kFamily === targetFamily ||
          kRad === canonRad ||
          kRad === rawRad ||
          (Array.isArray(k.storyComponents) &&
            (k.storyComponents.includes(canonRad) || k.storyComponents.includes(targetFamily)))
        )
      })
    }

    const minStrokes = Number(strokeMin)
    if (Number.isFinite(minStrokes) && minStrokes > 0) {
      results = results.filter((k) => {
        const s = k.numericStrokeCount ?? numericStroke(k.stroke_count)
        return s >= minStrokes
      })
    }

    const maxStrokes = Number(strokeMax)
    if (Number.isFinite(maxStrokes) && maxStrokes > 0) {
      results = results.filter((k) => {
        const s = k.numericStrokeCount ?? numericStroke(k.stroke_count)
        return s > 0 && s <= maxStrokes
      })
    }

    if (query && query.trim()) {
      const rawQ = query.trim()
      const q = rawQ.toLowerCase()
      const normQ = removeVietnameseTones(q)
      const hiraQ = katakanaToHiragana(q)
      const romajiHiraQ = romajiToHiragana(q)

      results = results.filter((k) => {
        const readingsHira =
          k.readingsHiragana ?? katakanaToHiragana(`${k.onyomi || ''} ${k.kunyomi || ''}`.toLowerCase())
        return (
          k.kanji.includes(rawQ) ||
          k.hanzi.toLowerCase().includes(q) ||
          (k.normalizedHanzi && k.normalizedHanzi.includes(normQ)) ||
          k.meaning_vi.toLowerCase().includes(q) ||
          (k.normalizedMeaning && k.normalizedMeaning.includes(normQ)) ||
          (k.onyomi && k.onyomi.toLowerCase().includes(q)) ||
          (k.kunyomi && k.kunyomi.toLowerCase().includes(q)) ||
          (hiraQ && readingsHira.includes(hiraQ)) ||
          (romajiHiraQ && readingsHira.includes(romajiHiraQ)) ||
          (k.normalizedRadical && k.normalizedRadical.includes(normQ))
        )
      })
    }

    const levelCounts = this.computeLevelCounts(results)

    if (level && level.toUpperCase() !== 'ALL') {
      const targetLevel = level.toUpperCase()
      results = results.filter((k) => k.jlpt_level && k.jlpt_level.toUpperCase() === targetLevel)
    }

    const jlptOrder = { N5: 1, N4: 2, N3: 3, N2: 4, N1: 5 }
    if (sort === 'stroke_asc') {
      results = [...results].sort((a, b) => {
        const netA = a.numericStrokeCount ?? numericStroke(a.stroke_count)
        const netB = b.numericStrokeCount ?? numericStroke(b.stroke_count)
        if (netA !== netB) return netA - netB
        return (a.normalizedHanzi || '').localeCompare(b.normalizedHanzi || '')
      })
    } else if (sort === 'stroke_desc') {
      results = [...results].sort((a, b) => {
        const netA = a.numericStrokeCount ?? numericStroke(a.stroke_count)
        const netB = b.numericStrokeCount ?? numericStroke(b.stroke_count)
        if (netA !== netB) return netB - netA
        return (a.normalizedHanzi || '').localeCompare(b.normalizedHanzi || '')
      })
    } else if (sort === 'hanzi_az') {
      results = [...results].sort((a, b) => (a.normalizedHanzi || '').localeCompare(b.normalizedHanzi || ''))
    } else if (sort === 'jlpt_asc') {
      results = [...results].sort((a, b) => {
        const rankA = jlptOrder[(a.jlpt_level || '').toUpperCase()] || 99
        const rankB = jlptOrder[(b.jlpt_level || '').toUpperCase()] || 99
        if (rankA !== rankB) return rankA - rankB
        return (
          (a.numericStrokeCount ?? numericStroke(a.stroke_count)) -
          (b.numericStrokeCount ?? numericStroke(b.stroke_count))
        )
      })
    } else if (sort === 'examples_desc') {
      results = [...results].sort((a, b) => (Number(b.num_vocab_examples) || 0) - (Number(a.num_vocab_examples) || 0))
    }

    const total = results.length
    const safePage = Math.max(1, Number(page) || 1)
    const safeLimit = Math.max(1, Number(limit) || 50)
    const offset = (safePage - 1) * safeLimit
    const items = results.slice(offset, offset + safeLimit)

    return {
      items,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
      levelCounts,
      catalogCounts,
    }
  }

  getKanjiRadicals({ level = 'ALL', query = '' } = {}) {
    this.ensureLoaded()
    const targetLevel = level ? level.toUpperCase() : 'ALL'
    const map = new Map()

    for (const k of this.kanjiSummaryList) {
      if (targetLevel !== 'ALL' && (!k.jlpt_level || k.jlpt_level.toUpperCase() !== targetLevel)) continue
      const glyph = k.radical_family || toRadicalFamilyGlyph(k.radical_utf)
      if (!glyph || glyph === '—') continue

      let entry = map.get(glyph)
      if (!entry) {
        const meta = getRadicalMetadata(glyph)
        entry = {
          glyph,
          variants: new Set(),
          nameVi: meta.nameVi || k.radical_vi_name || '',
          meaningVi: k.radical_meaning || '',
          strokeCount: meta.strokeCount || 0,
          count: 0,
        }
        map.set(glyph, entry)
      }
      if (k.radical_utf && k.radical_utf !== '—') {
        entry.variants.add(k.radical_utf)
      }
      if (!entry.meaningVi && k.radical_meaning) {
        entry.meaningVi = k.radical_meaning
      }
      entry.count++
    }

    let radicals = [...map.values()].map((entry) => ({
      glyph: entry.glyph,
      variants: [...entry.variants],
      nameVi: entry.nameVi,
      meaningVi: entry.meaningVi,
      strokeCount: entry.strokeCount,
      count: entry.count,
    }))

    if (query && String(query).trim()) {
      const q = String(query).trim().toLowerCase()
      const normQ = removeVietnameseTones(q)
      radicals = radicals.filter(
        (r) =>
          r.glyph.includes(query.trim()) ||
          r.variants.some((v) => v.includes(query.trim())) ||
          removeVietnameseTones(r.nameVi).includes(normQ) ||
          removeVietnameseTones(r.meaningVi).includes(normQ)
      )
    }

    radicals.sort((a, b) => {
      const sA = a.strokeCount || 99
      const sB = b.strokeCount || 99
      if (sA !== sB) return sA - sB
      return b.count - a.count
    })

    return {
      radicals,
      totalRadicals: radicals.length,
    }
  }

  getKanjiDetail(kanjiChar) {
    this.ensureLoaded()
    const summary = this.kanjiMap.get(kanjiChar)
    const fullData = this.loadFullKanjiJson()
    const detail = fullData[kanjiChar] || null
    const jlptOrder = { N5: 1, N4: 2, N3: 3, N2: 4, N1: 5 }

    if (!summary && !detail) {
      const trimmed = String(kanjiChar || '').trim()
      const codePoints = [...trimmed]
      const isSingleRadicalOrKanji =
        this.kanjiSummaryList.length > 0 && codePoints.length === 1 && /^[\u2e80-\u2fd5\u3400-\u9fff]$/u.test(trimmed)
      if (!isSingleRadicalOrKanji) {
        return null
      }

      const canonChar = toCanonicalRadicalGlyph(trimmed)
      const radMeta = getRadicalMetadata(canonChar)
      const relatedByRadical = this.kanjiSummaryList
        .filter(
          (k) =>
            k.radical_utf === canonChar ||
            k.radical_utf === trimmed ||
            (radMeta.family && k.radical_family === radMeta.family) ||
            (Array.isArray(k.storyComponents) && k.storyComponents.includes(canonChar))
        )
        .sort(
          (a, b) =>
            (jlptOrder[(a.jlpt_level || '').toUpperCase()] || 99) -
            (jlptOrder[(b.jlpt_level || '').toUpperCase()] || 99)
        )
        .slice(0, 10)

      if (!radMeta.nameVi && relatedByRadical.length === 0) {
        return null
      }

      const meaningVi =
        getRadicalMeaningByGlyph(canonChar) ||
        relatedByRadical.find((k) => k.radical_meaning)?.radical_meaning ||
        'Bộ thủ cấu tạo chữ Hán'
      const hanziTitle = radMeta.nameVi ? `BỘ ${radMeta.nameVi.toUpperCase()}` : 'BỘ THỦ'
      const storyText = `Bộ ${radMeta.nameVi || canonChar} (${canonChar}) — ${meaningVi}. Thường dùng làm thành phần biểu ý hoặc chỉ loại trong chữ Hán.`
      const sampleExamples = relatedByRadical.slice(0, 8).map((k, idx) => ({
        id: `rad-${canonChar}-${idx}`,
        word: k.kanji,
        reading: k.onyomi || k.kunyomi || '',
        meaning: k.meaning_vi,
        yinHan: k.hanzi,
      }))

      const syntheticSummary = {
        kanji: canonChar,
        hanzi: hanziTitle,
        meaning_vi: meaningVi,
        meaning_en: meaningVi,
        jlpt_level: 'Bộ thủ',
        onyomi: '',
        kunyomi: '',
        stroke_count: radMeta.strokeCount || '—',
        radical_utf: canonChar,
        radical_family: radMeta.family || canonChar,
        radical_vi_name: radMeta.nameVi || '',
        radical_name_ja: '部首',
        radical_meaning: meaningVi,
        story: storyText,
        num_vocab_examples: sampleExamples.length,
      }

      const syntheticDetail = {
        kanji: canonChar,
        kanjiInfo: {
          id: `radical-${canonChar}`,
          hanzi: hanziTitle,
          meaning: meaningVi,
          story: storyText,
          jlptLevel: 'Bộ thủ',
          kanjialiveData: {
            rad_name_ja: '部首',
            onyomi_ja: '',
            kunyomi_ja: '',
            rad_utf: canonChar,
            rad_meaning: meaningVi,
            examples: sampleExamples,
          },
        },
      }

      return {
        kanji: canonChar,
        isRadicalOnly: true,
        summary: syntheticSummary,
        detail: syntheticDetail,
        relatedByRadical,
        relatedByHanzi: [],
        phonetics: { onyomiRomaji: '', kunyomiRomaji: '' },
        secondaryMeanings: [],
      }
    }

    const targetFamily = summary?.radical_family || toRadicalFamilyGlyph(summary?.radical_utf || '')
    const primaryHanzi = (summary?.hanzi || detail?.kanjiInfo?.hanzi || '').split(/[,;/]/)[0].trim().toUpperCase()

    const relatedByRadical = targetFamily
      ? this.kanjiSummaryList
          .filter(
            (k) => k.kanji !== kanjiChar && (k.radical_family || toRadicalFamilyGlyph(k.radical_utf)) === targetFamily
          )
          .sort(
            (a, b) =>
              (jlptOrder[(a.jlpt_level || '').toUpperCase()] || 99) -
              (jlptOrder[(b.jlpt_level || '').toUpperCase()] || 99)
          )
          .slice(0, 8)
      : []

    const relatedByHanzi = primaryHanzi
      ? this.kanjiSummaryList
          .filter((k) => {
            if (k.kanji === kanjiChar) return false
            const tokens = String(k.hanzi || '')
              .split(/[,;/]/)
              .map((t) => t.trim().toUpperCase())
            return tokens.includes(primaryHanzi)
          })
          .sort(
            (a, b) =>
              (jlptOrder[(a.jlpt_level || '').toUpperCase()] || 99) -
              (jlptOrder[(b.jlpt_level || '').toUpperCase()] || 99)
          )
          .slice(0, 6)
      : []

    const onyomiRaw = summary?.onyomi || detail?.kanjiInfo?.kanjialiveData?.onyomi_ja || ''
    const kunyomiRaw = summary?.kunyomi || detail?.kanjiInfo?.kanjialiveData?.kunyomi_ja || ''
    const primaryMeaningNorm = removeVietnameseTones(summary?.meaning_vi || '')
    const baseExamples = detail?.kanjiInfo?.kanjialiveData?.examples || []
    const { compoundStmt, singleCharStmt } = getMasterDictStatements()

    // Extract secondary meanings ONLY from single-character entries (never multi-char compounds!)
    const secondaryMeanings = []
    for (const ex of baseExamples) {
      if (ex.word !== kanjiChar) continue
      const m = String(ex?.meaning || '').trim()
      if (!m || m.length > 48) continue
      const normM = removeVietnameseTones(m)
      if (normM === primaryMeaningNorm || secondaryMeanings.some((s) => removeVietnameseTones(s) === normM)) continue
      secondaryMeanings.push(m)
      if (secondaryMeanings.length >= 2) break
    }
    if (secondaryMeanings.length < 2 && singleCharStmt) {
      try {
        const rows = singleCharStmt.all(kanjiChar)
        for (const row of rows) {
          for (const rawM of parseJsonArraySafe(row?.meanings)) {
            const m = String(rawM || '').trim()
            if (!m || m.length > 48) continue
            const normM = removeVietnameseTones(m)
            if (normM === primaryMeaningNorm || secondaryMeanings.some((s) => removeVietnameseTones(s) === normM)) {
              continue
            }
            secondaryMeanings.push(m)
            if (secondaryMeanings.length >= 2) break
          }
          if (secondaryMeanings.length >= 2) break
        }
      } catch {
        // ignore optional SQLite read error
      }
    }

    // Backfill sparse vocab examples (< 6) from master_dictionary.db while preserving canonical examples first
    let mergedExamples = baseExamples
    if (baseExamples.length < 6 && compoundStmt && summary) {
      try {
        const seenWords = new Set(baseExamples.map((e) => e.word))
        const rows = compoundStmt.all(`%${kanjiChar}%`)
        const extra = []
        for (const row of rows) {
          const w = String(row?.word || '').trim()
          if (!w || seenWords.has(w) || !/[\u4e00-\u9fff]/.test(w)) continue
          seenWords.add(w)
          const meanings = parseJsonArraySafe(row?.meanings)
          const exList = parseJsonArraySafe(row?.examples)
          const firstEx = exList.find((e) => e?.jp)
          extra.push({
            id: `dict-${kanjiChar}-${extra.length}`,
            word: w,
            reading: String(row?.reading || '').trim(),
            meaning: String(meanings[0] || '').trim(),
            yinHan: String(row?.han_viet || '').trim(),
            ...(firstEx?.jp ? { example: String(firstEx.jp).trim() } : {}),
            ...(firstEx?.vi ? { exampleVi: String(firstEx.vi).trim() } : {}),
          })
          if (baseExamples.length + extra.length >= 6) break
        }
        if (extra.length > 0) {
          mergedExamples = [...baseExamples, ...extra]
        }
      } catch {
        // ignore optional SQLite read error
      }
    }

    const enrichedDetail =
      detail && mergedExamples !== baseExamples
        ? {
            ...detail,
            kanjiInfo: {
              ...detail.kanjiInfo,
              kanjialiveData: {
                ...detail.kanjiInfo?.kanjialiveData,
                examples: mergedExamples,
              },
            },
          }
        : detail || null

    const verifiedDescendants = this.verifiedDescendantsMap.get(kanjiChar) || []

    return {
      kanji: kanjiChar,
      summary: summary || null,
      detail: enrichedDetail,
      relatedByRadical,
      relatedByHanzi,
      verifiedDescendants,
      phonetics: {
        onyomiRomaji: kanaToRomaji(onyomiRaw),
        kunyomiRomaji: kanaToRomaji(kunyomiRaw),
      },
      secondaryMeanings,
    }
  }

  async getKanjiStrokeData(kanjiChar) {
    if (!kanjiChar) return null
    const char = String(kanjiChar).trim()
    if (!char) return null
    const code = char.codePointAt(0).toString(16).padStart(5, '0')
    const cacheDir = path.resolve(process.cwd(), 'data', 'kanjivg')
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true })

    const cacheFile = path.join(cacheDir, `${code}.json`)
    if (fs.existsSync(cacheFile)) {
      try {
        return JSON.parse(fs.readFileSync(cacheFile, 'utf8'))
      } catch {}
    }

    const url = `https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg/kanji/${code}.svg`
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) {
        return null
      }
      const svgText = await res.text()

      const strokePathRegex = /<path[^>]*\bid="([^"]*-s\d+)"[^>]*\bd="([^"]+)"[^>]*>/g
      const strokes = []
      let m
      while ((m = strokePathRegex.exec(svgText)) !== null) {
        const id = m[1]
        const d = m[2]
        const typeMatch = m[0].match(/kvg:type="([^"]+)"/)
        strokes.push({ id, d, type: typeMatch ? typeMatch[1] : undefined })
      }

      const numRegex = /<text transform="matrix\(([^)]+)\)">(\d+)<\/text>/g
      const numbers = []
      while ((m = numRegex.exec(svgText)) !== null) {
        const parts = m[1].split(/\s+/).map(Number)
        numbers.push({ num: parseInt(m[2], 10), x: parts[4], y: parts[5] })
      }

      const data = {
        kanji: char,
        code,
        strokeCount: strokes.length,
        strokes,
        numbers,
      }
      fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2))
      return data
    } catch {
      return null
    }
  }

  async getKanjiBrushData(kanjiChar) {
    if (!kanjiChar) return null
    const char = String(kanjiChar).trim()
    if (!char) return null
    const cacheDir = path.resolve(process.cwd(), 'data', 'hanzi_brush')
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true })

    const encoded = encodeURIComponent(char)
    const cacheFile = path.join(cacheDir, `${encoded}.json`)
    if (fs.existsSync(cacheFile)) {
      try {
        return JSON.parse(fs.readFileSync(cacheFile, 'utf8'))
      } catch {}
    }

    // 1. Japanese Kanji stroke outlines (AnimCJK via hanzi-writer-data-jp)
    try {
      const urlJp = `https://cdn.jsdelivr.net/npm/hanzi-writer-data-jp@0/${encoded}.json`
      const res = await fetch(urlJp, { signal: AbortSignal.timeout(5000) })
      if (res.ok) {
        const data = await res.json()
        fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2))
        return data
      }
    } catch {}

    // 2. Fallback: Standard Chinese Hanzi stroke outlines (MakeMeAHanzi via hanzi-writer-data 2.0)
    try {
      const urlCn = `https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/${encoded}.json`
      const res = await fetch(urlCn, { signal: AbortSignal.timeout(5000) })
      if (res.ok) {
        const data = await res.json()
        fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2))
        return data
      }
    } catch {}

    return null
  }

  async recognizeHandwriting({ strokes = [], width = 240, height = 240 } = {}) {
    this.ensureLoaded()
    if (!Array.isArray(strokes) || strokes.length === 0) {
      return { candidates: [], source: 'empty' }
    }

    const validStrokes = strokes
      .slice(0, 40)
      .map((pts) =>
        Array.isArray(pts)
          ? pts
              .slice(0, 120)
              .filter(
                (p) =>
                  Array.isArray(p) && p.length >= 2 && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1]))
              )
              .map((p) => [Math.round(Number(p[0])), Math.round(Number(p[1]))])
          : []
      )
      .filter((pts) => pts.length > 0)

    if (validStrokes.length === 0) {
      return { candidates: [], source: 'empty' }
    }

    const areaW = Math.max(80, Math.min(800, Math.round(Number(width) || 240)))
    const areaH = Math.max(80, Math.min(800, Math.round(Number(height) || 240)))

    try {
      const res = await fetch('https://inputtools.google.com/request?ime=handwriting&app=mobilesearch&cs=1&oe=UTF-8', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(4500),
        body: JSON.stringify({
          options: 'enable_pre_space',
          requests: [
            {
              writing_guide: { writing_area_width: areaW, writing_area_height: areaH },
              ink: validStrokes.map((pts) => [pts.map((p) => p[0]), pts.map((p) => p[1])]),
              language: 'ja',
            },
          ],
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const rawCandidates = Array.isArray(data?.[1]?.[0]?.[1]) ? data[1][0][1] : []
        const seen = new Set()
        const candidates = []

        for (const entry of rawCandidates) {
          if (typeof entry !== 'string' || !entry.trim()) continue
          const ch = Array.from(entry.trim())[0]
          if (!ch || seen.has(ch)) continue
          const match = this.kanjiMap?.get(ch) || this.kanjiSummaryList.find((k) => k.kanji === ch)
          if (match) {
            seen.add(ch)
            candidates.push(match)
            if (candidates.length >= 12) break
          }
        }

        if (candidates.length > 0) {
          return { candidates, source: 'ime' }
        }
      }
    } catch {
      // Fall through to offline stroke-count fallback
    }

    const levelRank = { N5: 1, N4: 2, N3: 3, N2: 4, N1: 5 }
    const targetCount = validStrokes.length
    const fallback = this.kanjiSummaryList
      .filter((k) => Number(k.stroke_count) === targetCount)
      .sort((a, b) => (levelRank[a.jlpt_level] || 9) - (levelRank[b.jlpt_level] || 9))
      .slice(0, 12)

    return { candidates: fallback, source: 'fallback' }
  }

  getBunpoList({ level, bookId, query = '', page = 1, limit = 50 }) {
    this.ensureLoaded()
    let results = this.bunpoList

    if (level && level.toUpperCase() !== 'ALL') {
      const targetLevel = level.toUpperCase()
      results = results.filter((b) => b.level && b.level.toUpperCase() === targetLevel)
    }

    if (bookId && bookId !== 'all') {
      results = results.filter((b) => b.bookId === bookId)
    }

    if (query && query.trim()) {
      const q = query.trim().toLowerCase()
      const normQ = removeVietnameseTones(q)

      results = results.filter((b) => {
        return (
          b.pattern.toLowerCase().includes(q) ||
          (b.shortMeaning && b.shortMeaning.toLowerCase().includes(q)) ||
          b.normalizedPattern.includes(normQ) ||
          b.normalizedMeaning.includes(normQ) ||
          (b.structure && b.structure.toLowerCase().includes(q))
        )
      })
    }

    const total = results.length
    const offset = (Math.max(1, page) - 1) * limit
    const items = results.slice(offset, offset + limit)

    return {
      items,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    }
  }

  getJlptExams({ level, section }) {
    this.ensureLoaded()
    this.reloadFullMaster()
    let exams = []

    // 1. Nạp từ kho đề thi trọn gói ToanSensei (30 đề Full Mock Exam N3 từ 2010 đến 2025)
    if (this.toanMockMaster && Array.isArray(this.toanMockMaster) && this.toanMockMaster.length > 0) {
      this.toanMockMaster.forEach((t) => {
        exams.push({
          id: t.id,
          title: t.title,
          level: t.level || 'N3',
          year: t.year || '2025',
          session: t.session || '07',
          section: t.section || 'full_mock',
          sectionLabel: t.sectionLabel || 'Thi thử Trọn gói (180 điểm)',
          sectionLabelJP: t.sectionLabelJP || '総合模擬試験 (180点満点)',
          timeLimit: t.timeLimit || 140,
          questionCount:
            t.questionCount || (t.parts ? t.parts.reduce((acc, p) => acc + (p.questions?.length || 0), 0) : 0),
          audioUrl: t.audioUrl,
          isFullMock: true,
          available: true,
        })
      })
    }

    // 2. Nạp từ kho đề thi đầy đủ 199 đề thi N1-N5 (Corodomo Master - Luyện từng phần)
    if (this.jlptFullMaster && Array.isArray(this.jlptFullMaster) && this.jlptFullMaster.length > 0) {
      this.jlptFullMaster.forEach((t) => {
        const metadata = normalizeJlptExamMetadata(t, { year: '2024', session: '12' })
        exams.push({
          id: t.id,
          title: t.title,
          level: t.level || 'N3',
          year: metadata.year,
          session: metadata.session,
          section: t.section,
          sectionLabel: t.sectionLabel,
          sectionLabelJP: t.sectionLabelJP,
          timeLimit: t.timeLimit || 40,
          questionCount:
            t.questionCount || (t.parts ? t.parts.reduce((acc, p) => acc + (p.questions?.length || 0), 0) : 0),
          audioUrl: t.audioUrl,
          isFullMock: false,
          available: true,
        })
      })
    } else if (this.jlptExamsMaster) {
      // 3. Dự phòng master cũ
      const levels = ['n5', 'n4', 'n3', 'n2', 'n1']
      levels.forEach((lvlKey) => {
        const lvlData = this.jlptExamsMaster[lvlKey]
        if (lvlData && Array.isArray(lvlData.tests)) {
          lvlData.tests.forEach((t) => {
            const qCount = t.parts ? t.parts.reduce((acc, p) => acc + (p.questions ? p.questions.length : 0), 0) : 0
            if (qCount > 0) {
              exams.push({
                id: t.id,
                title: t.title || `${t.level || lvlKey.toUpperCase()} - ${t.year} (${t.sectionLabel || 'Tổng hợp'})`,
                level: t.level || lvlKey.toUpperCase(),
                year: t.year,
                session: t.session,
                section: t.section,
                sectionLabel: t.sectionLabel,
                sectionLabelJP: t.sectionLabelJP,
                timeLimit: t.timeLimit,
                questionCount: qCount,
                isFullMock: false,
                available: true,
              })
            }
          })
        }
      })
    }

    if (level && level.toUpperCase() !== 'ALL') {
      exams = exams.filter((e) => e.level.toUpperCase() === level.toUpperCase())
    }

    if (section && section !== 'all') {
      exams = exams.filter((e) => e.section === section)
    }

    return { exams }
  }

  getJlptExamDetail(examId) {
    this.ensureLoaded()
    this.reloadFullMaster()

    const attachLocalListeningImages = (exam) => {
      if (!Array.isArray(exam.parts) || !this.listeningImageAssets) return exam
      let changed = false
      const parts = exam.parts.map((part) => {
        const isListeningPart =
          Number(part?.sectionType) === 4 || String(exam?.section || '').toLowerCase() === 'listening'
        if (!isListeningPart || !Array.isArray(part.questions)) return part
        const questions = part.questions.map((question) => {
          const assetKey = this.listeningImageAssets[question?.id]
            ? question.id
            : this.listeningImageAssetAliases[question?.id]
          const asset = this.listeningImageAssets[assetKey]
          const localFile = asset?.publicPath
            ? path.join(process.cwd(), 'public', asset.publicPath.replace(/^\//u, ''))
            : ''
          const image = localFile && fs.existsSync(localFile) ? asset.publicPath : asset?.sourceUrl
          if (!image || question.image === image) return question
          changed = true
          return { ...question, image }
        })
        return questions.every((question, index) => question === part.questions[index]) ? part : { ...part, questions }
      })
      return changed ? { ...exam, parts } : exam
    }

    const attachCuratedExplanations = (exam) => {
      if (!Array.isArray(exam.parts) || !this.curatedExplanations) return exam
      const session = String(exam.session ?? '').padStart(2, '0')
      const sessionKey = examSessionKey(exam)
      const fullMock = this.toanMockMaster?.find(
        (candidate) =>
          candidate.id !== exam.id &&
          (candidate.isFullMock || candidate.section === 'full_mock') &&
          String(candidate.level || '').toUpperCase() === String(exam.level || '').toUpperCase() &&
          (sessionKey
            ? examSessionKey(candidate) === sessionKey
            : String(candidate.year ?? '') === String(exam.year ?? '') &&
              String(candidate.session ?? '').padStart(2, '0') === session)
      )
      const fullMockQuestions = new Map(
        (fullMock?.parts || []).flatMap((part) =>
          (part.questions || []).map((question) => [Number(question.number), { question, part }])
        )
      )
      const fullMockQuestionsById = new Map(
        (fullMock?.parts || []).flatMap((part) =>
          (part.questions || []).map((question) => [question.id, { question, part }])
        )
      )
      const sectionTypes = {
        vocabulary: [1],
        vocab: [1],
        'grammar-reading': [2, 3],
        grammar: [2],
        reading: [3],
        listening: [4],
      }[String(exam.section || '').toLowerCase()]
      const positionalSourceQuestions = new Map()
      if (fullMock && sectionTypes) {
        const matchingParts = fullMock.parts.filter((part) => sectionTypes.includes(Number(part.sectionType)))
        const samePartShape =
          matchingParts.length === exam.parts.length &&
          exam.parts.every(
            (part, index) =>
              Array.isArray(part.questions) &&
              Array.isArray(matchingParts[index]?.questions) &&
              part.questions.length === matchingParts[index].questions.length
          )
        if (samePartShape) {
          exam.parts.forEach((part, partIndex) => {
            part.questions.forEach((question, questionIndex) => {
              const sourceQuestion = matchingParts[partIndex].questions[questionIndex]
              if (
                hasSameQuestionContent(question, sourceQuestion, { ignoreQuestionNumber: true }) ||
                hasSameSectionPositionQuestionContent(question, sourceQuestion)
              ) {
                positionalSourceQuestions.set(question.id, {
                  question: sourceQuestion,
                  part: matchingParts[partIndex],
                  matchedBySectionPosition: true,
                })
              }
            })
          })
        }
      }
      let changed = false
      const parts = exam.parts.map((part) => {
        if (!Array.isArray(part.questions)) return part
        const questions = part.questions.map((question) => {
          const sourceEntry =
            positionalSourceQuestions.get(question.id) ||
            (this.listeningQuestionAliases?.[question.id]
              ? {
                  ...fullMockQuestionsById.get(this.listeningQuestionAliases[question.id]),
                  matchedByListeningAlias: true,
                }
              : undefined) ||
            fullMockQuestions.get(Number(question.number))
          const sourceQuestion = sourceEntry?.question
          const sourceExplanation = sourceQuestion?.explanation || this.curatedExplanations[sourceQuestion?.id]
          const mirroredExplanation =
            sourceQuestion &&
            (hasSameQuestionContent(question, sourceQuestion, {
              ignoreQuestionNumber: sourceEntry?.matchedBySectionPosition === true,
            }) ||
              sourceEntry?.matchedByListeningAlias === true ||
              (sourceEntry?.matchedBySectionPosition === true &&
                hasSameSectionPositionQuestionContent(question, sourceQuestion)) ||
              hasSameStarOrderQuestionContent(question, sourceQuestion, sourceExplanation) ||
              hasSameClozeQuestionContent(question, sourceQuestion, part, sourceEntry?.part))
              ? sourceExplanation
              : undefined
          const generatedGrammarPatternNote = String(question.explanation || '').includes(
            'Mẫu ngữ pháp được nhận diện từ dữ liệu N3 cục bộ'
          )
          const isFullMock =
            question.examType === 'full_mock' || exam.isFullMock === true || exam.section === 'full_mock'
          const hasVerifiedStarLayout = (candidate) =>
            Array.isArray(candidate?.starCorrectOrder) &&
            candidate.starCorrectOrder.length === 4 &&
            Number.isInteger(candidate.starPosition) &&
            candidate.starPosition >= 0 &&
            candidate.starPosition < 4
          const isStarQuestion =
            hasVerifiedStarLayout(question) ||
            (sourceQuestion?.starPositionVerified === true && hasVerifiedStarLayout(sourceQuestion))
          const starExplanationMatches =
            !isStarQuestion ||
            !sourceQuestion ||
            hasSameStarOrderQuestionContent(question, sourceQuestion, sourceExplanation || question.explanation)
          const explanation = !starExplanationMatches
            ? undefined
            : generatedGrammarPatternNote
              ? isFullMock
                ? question.explanation
                : mirroredExplanation
              : question.explanation || this.curatedExplanations[question.id] || mirroredExplanation
          const image =
            !question.image && sourceEntry?.matchedBySectionPosition ? firstQuestionImage(sourceQuestion) : ''
          if ((generatedGrammarPatternNote && !isFullMock && !mirroredExplanation) || !starExplanationMatches) {
            if ((question.explanation === null || question.explanation === undefined) && !image) return question
            changed = true
            return {
              ...question,
              explanation: null,
              ...(question.image || !image ? {} : { image }),
            }
          }
          if ((!explanation || question.explanation) && !image) return question
          changed = true
          return {
            ...question,
            ...(question.explanation || !explanation ? {} : { explanation }),
            ...(question.image || !image ? {} : { image }),
          }
        })
        return questions.every((question, index) => question === part.questions[index]) ? part : { ...part, questions }
      })
      return changed ? { ...exam, parts } : exam
    }

    // 1. Tìm trong kho đề Full Mock Exam ToanSensei
    if (this.toanMockMaster && Array.isArray(this.toanMockMaster)) {
      const found = this.toanMockMaster.find((e) => e.id === examId)
      if (found) {
        return attachLocalListeningImages(attachCuratedExplanations(normalizeJlptExamMetadata(found)))
      }
    }

    // 2. Tìm trong kho đề Corodomo Master (Đầy đủ 199 đề thi N1 - N5)
    if (this.jlptFullMaster && Array.isArray(this.jlptFullMaster)) {
      const found = this.jlptFullMaster.find((e) => e.id === examId)
      if (found) {
        return attachLocalListeningImages(
          attachCuratedExplanations(normalizeJlptExamMetadata(found, { year: '2024', session: '12' }))
        )
      }
    }

    // 3. Dự phòng trong đề master truyền thống (N5 -> N1)
    if (this.jlptExamsMaster) {
      const levels = ['n5', 'n4', 'n3', 'n2', 'n1']
      for (const lvlKey of levels) {
        const lvlData = this.jlptExamsMaster[lvlKey]
        if (lvlData && Array.isArray(lvlData.tests)) {
          const found = lvlData.tests.find((t) => t.id === examId)
          if (found) {
            return found
          }
        }
      }
    }
    return null
  }

  submitJlptExam(examId, answers = {}, examSnapshot = null) {
    const exam = examSnapshot && examSnapshot.id === examId ? examSnapshot : this.getJlptExamDetail(examId)
    if (!exam) return null

    let totalQuestions = 0
    let correctCount = 0
    const questionResults = []

    const isFullMock = exam.isFullMock || exam.section === 'full_mock'
    const level = (exam.level || 'N3').toUpperCase()

    // Phân nhóm câu hỏi theo từng kỹ năng chuẩn JLPT
    const sectionGroups = {
      vocab: {
        name: 'Từ vựng (文字・語彙)',
        total: 0,
        correct: 0,
        weightedTotal: 0,
        weightedCorrect: 0,
        maxScore: 60,
        minPass: 19,
      },
      grammar: {
        name: 'Ngữ pháp (文法)',
        total: 0,
        correct: 0,
        weightedTotal: 0,
        weightedCorrect: 0,
        maxScore: 60,
        minPass: 19,
      },
      reading: {
        name: 'Đọc hiểu (読解)',
        total: 0,
        correct: 0,
        weightedTotal: 0,
        weightedCorrect: 0,
        maxScore: 60,
        minPass: 19,
      },
      listening: {
        name: 'Nghe hiểu (聴解)',
        total: 0,
        correct: 0,
        weightedTotal: 0,
        weightedCorrect: 0,
        maxScore: 60,
        minPass: 19,
      },
    }

    if (Array.isArray(exam.parts)) {
      exam.parts.forEach((part, partIdx) => {
        const title = (part.title || '').toLowerCase()
        const instruction = (part.instruction || '').toLowerCase()
        const sectionType = part.sectionType // 1: vocab, 2: grammar, 3: reading, 4: listening

        let targetGroup = sectionGroups.grammar
        if (sectionType === 1 || exam.section === 'vocab' || title.includes('文字') || title.includes('語彙')) {
          targetGroup = sectionGroups.vocab
        } else if (sectionType === 2 || title.includes('文法') || (exam.section === 'grammar-reading' && partIdx < 3)) {
          targetGroup = sectionGroups.grammar
        } else if (
          sectionType === 3 ||
          Boolean(part.passage) ||
          title.includes('読解') ||
          instruction.includes('文章を読ん') ||
          instruction.includes('右のページ') ||
          (exam.section === 'grammar-reading' && partIdx >= 3)
        ) {
          targetGroup = sectionGroups.reading
        } else if (
          sectionType === 4 ||
          exam.section === 'listening' ||
          title.includes('聴解') ||
          title.includes('問題1では、まず')
        ) {
          targetGroup = sectionGroups.listening
        }

        if (Array.isArray(part.questions)) {
          part.questions.forEach((q, qIdx) => {
            totalQuestions++
            targetGroup.total++

            const qWeight = Number(q.scoreWeight || q.diem || 1)
            targetGroup.weightedTotal += qWeight

            const qId = q.id || `p${partIdx}_q${qIdx}`
            const userAnswer = answers[qId] ?? answers[q.number] ?? null
            const correctAnswer = q.correctAnswer ?? q.answer ?? 1
            const isCorrect = String(userAnswer) === String(correctAnswer)

            if (isCorrect) {
              correctCount++
              targetGroup.correct++
              targetGroup.weightedCorrect += qWeight
            }

            questionResults.push({
              id: qId,
              number: q.number,
              partTitle: part.title || part.titleJP,
              questionText: q.sentence || q.text || q.question,
              passage: q.passage || part.passage || null,
              image: q.image || null,
              audio: q.audio || q.audioUrl || null,
              script: q.script || null,
              scriptVi: q.scriptVi || null,
              audioStart: q.audioStart ?? null,
              audioEnd: q.audioEnd ?? null,
              audioSegments: q.audioSegments || [],
              options: q.options || [],
              scoreWeight: qWeight,
              userAnswer,
              correctAnswer,
              isCorrect,
              explanation: q.explanation || '',
            })
          })
        }
      })
    }

    const scorePercentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0

    // Chuẩn điểm đỗ chuẩn JLPT theo cấp độ (Thang 180)
    let passScore180 = 95
    let passPercentage = 53
    if (level === 'N1') {
      passScore180 = 100
      passPercentage = 56
    } else if (level === 'N2') {
      passScore180 = 90
      passPercentage = 50
    } else if (level === 'N3') {
      passScore180 = 95
      passPercentage = 53
    } else if (level === 'N4') {
      passScore180 = 90
      passPercentage = 50
    } else if (level === 'N5') {
      passScore180 = 80
      passPercentage = 45
    }

    // 3 Section chính theo cấu trúc JLPT:
    // 1. 言語知識 (文字・語彙・文法) = Vocab + Grammar (Max 60, minPass 19)
    // 2. 読解 = Reading (Max 60, minPass 19)
    // 3. 聴解 = Listening (Max 60, minPass 19)
    const sec1TotalWeight = sectionGroups.vocab.weightedTotal + sectionGroups.grammar.weightedTotal
    const sec1CorrectWeight = sectionGroups.vocab.weightedCorrect + sectionGroups.grammar.weightedCorrect
    const sec1TotalQ = sectionGroups.vocab.total + sectionGroups.grammar.total
    const sec1CorrectQ = sectionGroups.vocab.correct + sectionGroups.grammar.correct
    const sec1Score = sec1TotalWeight > 0 ? Math.round((sec1CorrectWeight / sec1TotalWeight) * 60) : 0
    const sec1Min = 19
    const isSection1Failed = sec1Score < sec1Min && sec1TotalQ > 0

    const sec2TotalWeight = sectionGroups.reading.weightedTotal
    const sec2CorrectWeight = sectionGroups.reading.weightedCorrect
    const sec2TotalQ = sectionGroups.reading.total
    const sec2CorrectQ = sectionGroups.reading.correct
    const sec2Score = sec2TotalWeight > 0 ? Math.round((sec2CorrectWeight / sec2TotalWeight) * 60) : 0
    const sec2Min = 19
    const isSection2Failed = sec2Score < sec2Min && sec2TotalQ > 0

    const sec3TotalWeight = sectionGroups.listening.weightedTotal
    const sec3CorrectWeight = sectionGroups.listening.weightedCorrect
    const sec3TotalQ = sectionGroups.listening.total
    const sec3CorrectQ = sectionGroups.listening.correct
    const sec3Score = sec3TotalWeight > 0 ? Math.round((sec3CorrectWeight / sec3TotalWeight) * 60) : 0
    const sec3Min = 19
    const isSection3Failed = sec3Score < sec3Min && sec3TotalQ > 0

    const scaledTotalScore = sec1Score + sec2Score + sec3Score
    const maxScore180 = 180

    const hasSectionalFailure = isSection1Failed || isSection2Failed || isSection3Failed
    const isOverallScorePassed = isFullMock ? scaledTotalScore >= passScore180 : scorePercentage >= passPercentage
    const passed = isOverallScorePassed && !hasSectionalFailure

    // Tính mức chuẩn CEFR
    let cefrLevel = 'Chưa đạt'
    if (passed) {
      if (level === 'N1') {
        cefrLevel = scaledTotalScore >= 142 ? 'C1' : scaledTotalScore >= 100 ? 'B2' : 'Chưa đạt'
      } else if (level === 'N2') {
        cefrLevel = scaledTotalScore >= 112 ? 'B2' : scaledTotalScore >= 90 ? 'B1' : 'Chưa đạt'
      } else if (level === 'N3') {
        cefrLevel = scaledTotalScore >= 104 ? 'B1' : scaledTotalScore >= 95 ? 'A2' : 'Chưa đạt'
      } else if (level === 'N4') {
        cefrLevel = scaledTotalScore >= 90 ? 'A2' : 'Chưa đạt'
      } else if (level === 'N5') {
        cefrLevel = scaledTotalScore >= 80 ? 'A1' : 'Chưa đạt'
      }
    }

    const failedSectionNames = []
    if (isSection1Failed) failedSectionNames.push('Từ vựng & Ngữ pháp')
    if (isSection2Failed) failedSectionNames.push('Đọc hiểu')
    if (isSection3Failed) failedSectionNames.push('Nghe hiểu')

    let resultStatus = passed ? 'PASSED' : 'FAILED_SCORE'
    let resultMessage = passed ? 'CHÚC MỪNG! BẠN ĐÃ ĐỖ KỲ THI' : 'CHƯA ĐẠT (ĐIỂM TỔNG CHƯA ĐẠT ĐIỂM CHUẨN)'
    if (hasSectionalFailure) {
      resultStatus = 'FAILED_SECTIONAL'
      resultMessage = `CHƯA ĐẠT DO BỊ ĐIỂM LIỆT (${failedSectionNames.join(', ')})`
    }

    const sectionBreakdown = {
      section1: {
        name: '言語知識（文字・語彙・文法）',
        nameVi: 'Từ vựng & Ngữ pháp',
        score: sec1Score,
        max: 60,
        minPass: 19,
        isFailed: isSection1Failed,
        correct: sec1CorrectQ,
        total: sec1TotalQ,
      },
      section2: {
        name: '読解',
        nameVi: 'Đọc hiểu',
        score: sec2Score,
        max: 60,
        minPass: 19,
        isFailed: isSection2Failed,
        correct: sec2CorrectQ,
        total: sec2TotalQ,
      },
      section3: {
        name: '聴解',
        nameVi: 'Nghe hiểu',
        score: sec3Score,
        max: 60,
        minPass: 19,
        isFailed: isSection3Failed,
        correct: sec3CorrectQ,
        total: sec3TotalQ,
      },
    }

    // Chuẩn sectionalScores tương thích với giao diện cũ
    const sectionalScores = [
      {
        name: 'Từ vựng & Ngữ pháp (文字・語彙・文法)',
        correct: sec1CorrectQ,
        total: sec1TotalQ,
        percentage: sec1TotalQ > 0 ? Math.round((sec1CorrectQ / sec1TotalQ) * 100) : 0,
        scaledScore: sec1Score,
        maxScore: 60,
        minPass: 19,
        isBelowThreshold: isSection1Failed,
      },
      {
        name: 'Đọc hiểu (読解)',
        correct: sec2CorrectQ,
        total: sec2TotalQ,
        percentage: sec2TotalQ > 0 ? Math.round((sec2CorrectQ / sec2TotalQ) * 100) : 0,
        scaledScore: sec2Score,
        maxScore: 60,
        minPass: 19,
        isBelowThreshold: isSection2Failed,
      },
      {
        name: 'Nghe hiểu (聴解)',
        correct: sec3CorrectQ,
        total: sec3TotalQ,
        percentage: sec3TotalQ > 0 ? Math.round((sec3CorrectQ / sec3TotalQ) * 100) : 0,
        scaledScore: sec3Score,
        maxScore: 60,
        minPass: 19,
        isBelowThreshold: isSection3Failed,
      },
    ]

    return {
      examId,
      title: exam.title,
      level,
      isFullMock,
      totalQuestions,
      correctCount,
      scorePercentage,
      passPercentage,
      scaledTotalScore,
      maxScore180,
      passScore180,
      cefrLevel,
      passed,
      resultStatus,
      resultMessage,
      hasSectionalFailure,
      sectionBreakdown,
      sectionalScores,
      questionResults,
    }
  }
}

export const nhaiKanjiService = new NhaiKanjiService({
  kanjiDataPath:
    process.env.KANJI_DATA_PATH ||
    (fs.existsSync('D:/student/Languages/Japanese/kanji_hack_nao_n1_n5.json')
      ? 'D:/student/Languages/Japanese/kanji_hack_nao_n1_n5.json'
      : path.resolve(process.cwd(), 'data', 'kanji_hack_nao_n1_n5.json')),
})
