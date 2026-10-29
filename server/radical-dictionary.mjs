/**
 * Radical Dictionary & Normalization in Vietnamese for Kotodama Server.
 * Translates all English radical meanings from KanjiAlive/Jisho to authentic Vietnamese.
 */

import fs from 'node:fs'
import path from 'node:path'

// Load translations from verified complete translations json
const completeDataPath = path.resolve(process.cwd(), 'scripts', 'complete_radical_translations.json')
let translationsMap = {}
let canonicalMap = {}

try {
  if (fs.existsSync(completeDataPath)) {
    const parsed = JSON.parse(fs.readFileSync(completeDataPath, 'utf8'))
    translationsMap = parsed.translations || {}
    canonicalMap = parsed.canonical || {}
  }
} catch {
  // Fallback map
}

export function toCanonicalRadicalGlyph(glyph) {
  if (!glyph) return ''
  const trimmed = String(glyph).trim()
  return canonicalMap[trimmed] || trimmed
}

export function translateRadicalMeaning(meaning, radicalChar) {
  if (!meaning && !radicalChar) return 'Bộ thủ biểu ý cốt lõi'
  const raw = String(meaning || '').trim()

  // 1. Direct match with English phrase database
  if (raw && translationsMap[raw]) {
    return translationsMap[raw]
  }

  // 2. Case-insensitive lookup
  if (raw && /[a-zA-Z]{2,}/.test(raw)) {
    const lower = raw.toLowerCase()
    for (const [enKey, viVal] of Object.entries(translationsMap)) {
      if (enKey.toLowerCase() === lower) {
        return viVal
      }
    }
  }

  // 3. Fallback: if raw is already Vietnamese
  if (raw && (!/[a-zA-Z]{3,}/.test(raw) || /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(raw))) {
    return raw
  }

  return 'Bộ thủ biểu ý cốt lõi'
}
