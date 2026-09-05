/**
 * MASTER DICTIONARY NORMALIZER - Multi-Worker Pipeline
 * =====================================================
 * Chuẩn hóa toàn bộ 232,862 từ vựng Nhật-Việt thành bộ database chuẩn mực.
 *
 * Chiến lược:
 *   1. Nạp toàn bộ 2,627 từ Mazii local (vocabulary_full.json) vào master DB.
 *   2. Quét 232,862 từ từ vnjpdict.db, enrich qua Mazii API (multi-worker).
 *   3. Tự động checkpoint, resume khi tắt/bật.
 *   4. Deduplicate nghĩa, loại bỏ tiếng Anh rác.
 *
 * Chạy: node scripts/normalize-master-dictionary.mjs [--workers=N] [--batch=N]
 */

import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

// ── Config ──────────────────────────────────────────────────────────────
const DB_DIR = path.resolve('data')
if (!existsSync(DB_DIR)) mkdirSync(DB_DIR, { recursive: true })

const MASTER_DB_PATH = path.join(DB_DIR, 'master_dictionary.db')
const SOURCE_DB_PATH = 'D:/VKU/data/drive-download-20260828T102340Z-1-002/vnjpdict_scraper/vnjpdict.db'
const MAZII_LOCAL_PATH =
  'D:/VKU/data/drive-download-20260828T102340Z-1-002/mazii_crawler/data/json/vocabulary_full.json'

const args = process.argv.slice(2)
const WORKER_COUNT = parseInt(args.find((a) => a.startsWith('--workers='))?.split('=')[1] || '4')
const BATCH_SIZE = parseInt(args.find((a) => a.startsWith('--batch='))?.split('=')[1] || '50')
const MAX_TOTAL = parseInt(args.find((a) => a.startsWith('--max='))?.split('=')[1] || '0') // 0 = unlimited
const DELAY_MS = parseInt(args.find((a) => a.startsWith('--delay='))?.split('=')[1] || '100')

// ── Master DB ───────────────────────────────────────────────────────────
const masterDb = new DatabaseSync(MASTER_DB_PATH)

masterDb.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA cache_size = -64000;

  CREATE TABLE IF NOT EXISTS words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL,
    reading TEXT NOT NULL,
    han_viet TEXT,
    jlpt TEXT,
    pos TEXT,
    meanings TEXT NOT NULL,
    examples TEXT,
    source TEXT DEFAULT 'local',
    verified INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    UNIQUE(word, reading)
  );

  CREATE INDEX IF NOT EXISTS idx_w_word ON words(word);
  CREATE INDEX IF NOT EXISTS idx_w_reading ON words(reading);
  CREATE INDEX IF NOT EXISTS idx_w_jlpt ON words(jlpt);
  CREATE INDEX IF NOT EXISTS idx_w_verified ON words(verified);

  CREATE TABLE IF NOT EXISTS progress (
    key TEXT PRIMARY KEY,
    value INTEGER NOT NULL
  );
`)

const stmtUpsert = masterDb.prepare(`
  INSERT INTO words (word, reading, han_viet, jlpt, pos, meanings, examples, source, verified, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(word, reading) DO UPDATE SET
    han_viet = COALESCE(NULLIF(excluded.han_viet, ''), words.han_viet),
    jlpt = COALESCE(excluded.jlpt, words.jlpt),
    pos = COALESCE(NULLIF(excluded.pos, ''), words.pos),
    meanings = CASE WHEN excluded.verified > words.verified THEN excluded.meanings ELSE words.meanings END,
    examples = CASE WHEN excluded.verified > words.verified THEN excluded.examples ELSE words.examples END,
    source = CASE WHEN excluded.verified > words.verified THEN excluded.source ELSE words.source END,
    verified = MAX(excluded.verified, words.verified)
`)

const stmtHasVerified = masterDb.prepare('SELECT 1 FROM words WHERE word = ? AND verified = 1 LIMIT 1')
const stmtGetProgress = masterDb.prepare('SELECT value FROM progress WHERE key = ?')
const stmtSetProgress = masterDb.prepare('INSERT OR REPLACE INTO progress (key, value) VALUES (?, ?)')
const stmtCountWords = masterDb.prepare('SELECT COUNT(*) as c FROM words')
const stmtCountVerified = masterDb.prepare('SELECT COUNT(*) as c FROM words WHERE verified = 1')

function getProgress(key) {
  return stmtGetProgress.get(key)?.value ?? 0
}

// ── Utilities ───────────────────────────────────────────────────────────
function dedup(arr) {
  if (!Array.isArray(arr)) return []
  const seen = new Set()
  return arr.filter((item) => {
    const normalized = String(item).trim().toLowerCase()
    if (!normalized || seen.has(normalized)) return false
    seen.add(normalized)
    return true
  })
}

function isVietnamese(text) {
  return /[àáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/i.test(text)
}

function cleanMeaning(raw) {
  if (!raw || typeof raw !== 'string') return ''
  return raw
    .replace(/\{[^}]*\}/g, '') // remove {tags}
    .replace(/\([^)]*\)/g, (m) => (isVietnamese(m) ? m : '')) // keep only Vietnamese in parens
    .replace(/\s+/g, ' ')
    .trim()
}

function normJlpt(level) {
  if (!level) return null
  const s = String(level).replace(/^N+/i, '')
  const n = parseInt(s)
  if (n >= 1 && n <= 5) return `N${n}`
  return null
}

// ── Mazii API Fetcher ───────────────────────────────────────────────────
const UA_LIST = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
]

let requestCount = 0
let failCount = 0

async function fetchMazii(query) {
  requestCount++
  const ua = UA_LIST[requestCount % UA_LIST.length]
  try {
    const res = await fetch('https://mazii.net/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': ua },
      body: JSON.stringify({ dict: 'javi', type: 'word', query, limit: 3 }),
      signal: AbortSignal.timeout(5000),
    })
    if (res.status === 429) {
      failCount++
      return { rateLimit: true }
    }
    if (!res.ok) {
      failCount++
      return null
    }
    const json = await res.json()
    return json.data || json.results || null
  } catch {
    failCount++
    return null
  }
}

function parseMaziiItem(item) {
  const allMeans = []
  for (const m of item.means || []) {
    const cleaned = cleanMeaning(m.mean)
    if (cleaned) {
      // Split by comma/semicolon and deduplicate
      for (const part of cleaned
        .split(/[;,]/)
        .map((s) => s.trim())
        .filter(Boolean)) {
        if (part.length > 0) allMeans.push(part)
      }
    }
  }
  if (item.short_mean) {
    for (const part of item.short_mean
      .split(/[;,]/)
      .map((s) => s.trim())
      .filter(Boolean)) {
      allMeans.push(part)
    }
  }

  const examples = []
  for (const m of item.means || []) {
    for (const ex of m.examples || []) {
      if (ex.content && ex.mean) {
        examples.push({
          jp: ex.content,
          vi: ex.mean,
          furigana: ex.transcription || null,
        })
      }
    }
  }

  return {
    word: item.word,
    reading: item.phonetic || item.word,
    hanViet: item.han || null,
    jlpt: normJlpt(item.level?.[0] || item.level),
    pos: item.means?.[0]?.kind || '',
    meanings: dedup(allMeans).slice(0, 6),
    examples: examples.slice(0, 4),
  }
}

// ── Phase 1: Load Mazii Local ───────────────────────────────────────────
function phase1_loadMaziiLocal() {
  console.log('\n═══ PHASE 1: Nạp Mazii Local (vocabulary_full.json) ═══')
  if (!existsSync(MAZII_LOCAL_PATH)) {
    console.log('  ⚠ File không tồn tại:', MAZII_LOCAL_PATH)
    return
  }

  const data = JSON.parse(readFileSync(MAZII_LOCAL_PATH, 'utf8'))
  let inserted = 0

  masterDb.exec('BEGIN')
  for (const item of data) {
    if (!item.word) continue
    const parsed = parseMaziiItem(item)
    if (parsed.meanings.length === 0) continue

    stmtUpsert.run(
      parsed.word,
      parsed.reading,
      parsed.hanViet,
      parsed.jlpt,
      parsed.pos,
      JSON.stringify(parsed.meanings),
      JSON.stringify(parsed.examples),
      'mazii_local',
      1, // verified
      Date.now()
    )
    inserted++
  }
  masterDb.exec('COMMIT')

  console.log(`  ✅ Đã nạp ${inserted}/${data.length} từ từ Mazii local.`)
}

// ── Phase 2: Crawl + Normalize from vnjpdict.db via Mazii API ───────────
async function phase2_crawlAndNormalize() {
  console.log(`\n═══ PHASE 2: Chuẩn hóa từ vnjpdict.db (${WORKER_COUNT} workers, batch=${BATCH_SIZE}) ═══`)

  const sourceDb = new DatabaseSync(SOURCE_DB_PATH, { readOnly: true })
  const stmtFetch = sourceDb.prepare('SELECT id, word, reading FROM tuvung WHERE id > ? ORDER BY id ASC LIMIT ?')

  let lastId = getProgress('phase2_lastId')
  let totalProcessed = getProgress('phase2_total')
  let totalEnriched = getProgress('phase2_enriched')
  let batchNum = 0

  console.log(`  📍 Resume: lastId=${lastId}, processed=${totalProcessed}, enriched=${totalEnriched}`)

  const startTime = Date.now()

  while (true) {
    const rows = stmtFetch.all(lastId, BATCH_SIZE * WORKER_COUNT)
    if (!rows || rows.length === 0) {
      console.log('  🏁 Đã quét hết toàn bộ vnjpdict.db!')
      break
    }

    // Split into worker chunks
    const chunks = []
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      chunks.push(rows.slice(i, i + BATCH_SIZE))
    }

    // Process chunks concurrently
    const workerResults = await Promise.all(chunks.map((chunk) => processChunk(chunk)))

    // Write all results to DB in one transaction
    masterDb.exec('BEGIN')
    for (const results of workerResults) {
      for (const r of results) {
        stmtUpsert.run(
          r.word,
          r.reading,
          r.hanViet,
          r.jlpt,
          r.pos,
          JSON.stringify(r.meanings),
          JSON.stringify(r.examples),
          r.source,
          r.verified,
          Date.now()
        )
      }
    }
    masterDb.exec('COMMIT')

    // Update stats
    const enrichedInBatch = workerResults.flat().filter((r) => r.verified).length
    totalProcessed += rows.length
    totalEnriched += enrichedInBatch
    lastId = rows[rows.length - 1].id

    // Checkpoint
    stmtSetProgress.run('phase2_lastId', lastId)
    stmtSetProgress.run('phase2_total', totalProcessed)
    stmtSetProgress.run('phase2_enriched', totalEnriched)

    batchNum++
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0)
    const rate = (totalProcessed / Math.max(1, (Date.now() - startTime) / 1000)).toFixed(1)
    const pct = ((lastId / 284196) * 100).toFixed(1)

    console.log(
      `  [${batchNum}] ID ${lastId} (${pct}%) | +${rows.length} từ (${enrichedInBatch} enriched)` +
        ` | Tổng: ${totalProcessed} (${totalEnriched} verified) | ${rate} từ/s | ${elapsed}s`
    )

    // Rate limit check
    if (failCount > 10) {
      console.log('  ⚠ Quá nhiều lỗi mạng, tạm dừng 30s...')
      failCount = 0
      await new Promise((r) => setTimeout(r, 30000))
    }

    if (MAX_TOTAL > 0 && totalProcessed >= MAX_TOTAL) {
      console.log(`  🛑 Đạt giới hạn ${MAX_TOTAL} từ, dừng lại.`)
      break
    }
  }

  return { totalProcessed, totalEnriched }
}

async function processChunk(rows) {
  const results = []

  for (const row of rows) {
    const word = String(row.word || '').trim()
    const reading = String(row.reading || '').trim() || word
    if (!word || word.length > 30) continue

    // Skip if already verified
    if (stmtHasVerified.get(word)) {
      continue
    }

    // Try Mazii enrichment
    const online = await fetchMazii(word)

    if (online && !online.rateLimit && Array.isArray(online) && online.length > 0) {
      // Find exact match
      const exact = online.find((i) => i.word === word) || online[0]
      const parsed = parseMaziiItem(exact)

      if (parsed.meanings.length > 0) {
        results.push({
          word: parsed.word,
          reading: parsed.reading,
          hanViet: parsed.hanViet,
          jlpt: parsed.jlpt,
          pos: parsed.pos,
          meanings: parsed.meanings,
          examples: parsed.examples,
          source: 'mazii_api',
          verified: 1,
        })
        await new Promise((r) => setTimeout(r, DELAY_MS))
        continue
      }
    }

    if (online?.rateLimit) {
      // Back off on rate limit
      await new Promise((r) => setTimeout(r, 5000))
    }

    // Fallback: store raw with unverified flag
    results.push({
      word,
      reading,
      hanViet: null,
      jlpt: null,
      pos: '',
      meanings: [word],
      examples: [],
      source: 'vnjpdict_raw',
      verified: 0,
    })

    await new Promise((r) => setTimeout(r, DELAY_MS / 2))
  }

  return results
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║   KOTODAMA - Master Dictionary Normalizer v2.0         ║')
  console.log('╚══════════════════════════════════════════════════════════╝')
  console.log(`  Workers: ${WORKER_COUNT} | Batch: ${BATCH_SIZE} | Delay: ${DELAY_MS}ms`)
  console.log(`  DB: ${MASTER_DB_PATH}`)

  const existing = stmtCountWords.get()
  const verified = stmtCountVerified.get()
  console.log(`  Existing: ${existing.c} words (${verified.c} verified)`)

  // Phase 1: Nạp Mazii local
  phase1_loadMaziiLocal()

  // Phase 2: Crawl + Normalize
  const _result = await phase2_crawlAndNormalize()

  // Final stats
  const final = stmtCountWords.get()
  const finalVerified = stmtCountVerified.get()
  console.log('\n╔══════════════════════════════════════════════════════════╗')
  console.log(`║  KẾT QUẢ: ${final.c} từ tổng | ${finalVerified.c} verified        ║`)
  console.log(`║  DB: ${MASTER_DB_PATH}`)
  console.log('╚══════════════════════════════════════════════════════════╝')
}

main().catch(console.error)
