import { DatabaseSync } from 'node:sqlite'
import { createDatabasePool } from '../server/db/pool.mjs'

const masterDb = new DatabaseSync('data/master_dictionary.db')
const stmtWord = masterDb.prepare('SELECT reading, han_viet FROM words WHERE word = ? LIMIT 1')

async function translateText(text) {
  try {
    const url =
      'https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=vi&dt=t&q=' + encodeURIComponent(text)
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const data = await res.json()
    return data[0]?.map((item) => item[0]).join('') || null
  } catch {
    return null
  }
}

const SPECIAL_READINGS = {
  何時: 'なんじ',
  午前: 'ごぜん',
  午後: 'ごご',
  '9時': 'くじ',
  '1時': 'いちじ',
  '2時': 'にじ',
  '3時': 'さんじ',
  '4時': 'よじ',
  '5時': 'ごじ',
  '6時': 'ろくじ',
  '7時': 'しちじ',
  '8時': 'はちじ',
  '10時': 'じゅうじ',
  '11時': 'じゅういちじ',
  '12時': 'じゅうにじ',
  '9時半': 'くじはん',
  半: 'はん',
  時: 'じ',
  分: 'ふん',
  秒: 'びょう',
  時間: 'じかん',
  今日: 'きょう',
  明日: 'あした',
  昨日: 'きのう',
  今年: 'ことし',
  去年: 'きょねん',
  来年: 'らいねん',
  今回: 'こんかい',
  次回: 'じかい',
  日本語: 'にほんご',
  英語: 'えいご',
  勉強: 'べんきょう',
  学習: 'がくしゅう',
  習慣: 'しゅうかん',
  大切: 'たいせつ',
  友達: 'ともだち',
  自然: 'しぜん',
  話す: 'はなす',
  聞く: 'きく',
  読む: 'よむ',
  書く: 'かく',
}

function resolveFuriganaReading(word) {
  if (SPECIAL_READINGS[word]) return SPECIAL_READINGS[word]
  if (/^(\d+)時$/.test(word)) return 'じ'
  const match = stmtWord.get(word)
  if (match?.reading) {
    return match.reading.split(/[\s\t]+/)[0] || null
  }
  return null
}

function hasKanji(text) {
  return /[\u4e00-\u9faf]/u.test(text)
}

function generateFuriganaTokens(text) {
  if (!text) return { furiganaHtml: '', tokens: [] }
  const segmenter = new Intl.Segmenter('ja', { granularity: 'word' })
  const words = Array.from(segmenter.segment(text)).map((s) => s.segment)

  const tokens = []
  const htmlParts = []

  for (const word of words) {
    if (hasKanji(word)) {
      const rawReading = resolveFuriganaReading(word)
      tokens.push({ surface: word, reading: rawReading })
      if (rawReading) {
        htmlParts.push('<ruby>' + word + '<rt>' + rawReading + '</rt></ruby>')
      } else {
        htmlParts.push(word)
      }
    } else {
      tokens.push({ surface: word, reading: null })
      htmlParts.push(word)
    }
  }

  return {
    furiganaHtml: htmlParts.join(''),
    tokens,
  }
}

async function main() {
  const pool = createDatabasePool(process.env.DATABASE_URL)
  console.log('Fetching transcript segments from PostgreSQL...')
  const res = await pool.query(
    'SELECT id, text_ja, text_vi, text_furigana FROM transcript_segments ORDER BY sequence_no ASC'
  )
  console.log('Found ' + res.rows.length + ' segments to update.')

  const batchSize = 20
  let completed = 0

  for (let i = 0; i < res.rows.length; i += batchSize) {
    const chunk = res.rows.slice(i, i + batchSize)
    await Promise.all(
      chunk.map(async (row) => {
        const { furiganaHtml } = generateFuriganaTokens(row.text_ja)
        let textVi = row.text_vi
        if (!textVi || textVi.trim() === '') {
          textVi = await translateText(row.text_ja)
        }
        await pool.query('UPDATE transcript_segments SET text_furigana = $1, text_vi = $2 WHERE id = $3', [
          furiganaHtml,
          textVi,
          row.id,
        ])
      })
    )
    completed += chunk.length
    console.log(`Enriched ${completed} / ${res.rows.length} segments...`)
    await new Promise((r) => setTimeout(r, 40))
  }

  console.log('Successfully enriched all segments with Furigana & Vietnamese translations!')
  await pool.end()
}

main().catch(console.error)
