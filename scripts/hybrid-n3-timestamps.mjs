/**
 * FINAL HYBRID APPROACH:
 *
 * For each exam, try multiple parsing strategies and pick the best one.
 * Strategy 1: Use 問題 headers (works for exams with good headers)
 * Strategy 2: Use 1番 resets (works when 1番 appears at each mondai start)
 * Strategy 3: Sequential matching (works when sub has clean N番 sequence)
 *
 * Quality check: timestamps must be monotonically increasing,
 * Q1 < 120s, Q7 around 500-700s, Q13 around 1200-1500s, etc.
 */

import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'D:\\VKU\\DoAnTN\\kotodama'

function parseT(str) {
  const p = str.split(':')
  return parseInt(p[0]) * 3600 + parseInt(p[1]) * 60 + parseFloat(p[2])
}

function fmt(sec) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function extractHits(vttText) {
  const normalized = vttText.replace(/(\d+)\s*\n\s*番/g, '$1番')
  const lines = normalized.split(/\r?\n/)
  let curTime = 0
  const raw = []
  for (const line of lines) {
    if (line.includes('-->')) {
      curTime = parseT(line.split('-->')[0].trim())
    } else {
      const clean = line.replace(/<[^>]+>/g, '').trim()
      if (!clean) continue
      const m = clean.match(/([1-9])番/)
      if (m && !clean.includes('例')) {
        raw.push({ num: parseInt(m[1]), time: curTime })
      }
    }
  }
  // Dedup within 3s
  const deduped = []
  for (const h of raw) {
    if (!deduped.some((d) => d.num === h.num && Math.abs(d.time - h.time) < 3)) {
      deduped.push(h)
    }
  }
  return deduped
}

function findHeaders(vttText) {
  const normalized = vttText.replace(/問題\s*\n\s*(\d)/g, '問題$1')
  const lines = normalized.split(/\r?\n/)
  let curTime = 0
  const headers = {}
  for (const line of lines) {
    if (line.includes('-->')) {
      curTime = parseT(line.split('-->')[0].trim())
    } else {
      const clean = line.replace(/<[^>]+>/g, '').trim()
      for (let m = 1; m <= 5; m++) {
        if (clean.includes(`問題${m}`)) {
          const prev = headers[m - 1] || 0
          if (!headers[m] && curTime > prev + 30) {
            headers[m] = curTime
          }
        }
      }
    }
  }
  return headers
}

/**
 * Strategy using 問題 headers to bound each mondai section
 */
function strategyHeaders(hits, headers) {
  if (!headers[1] || !headers[2] || !headers[3] || !headers[4] || !headers[5]) return null

  const ranges = {
    1: { start: headers[1], end: headers[2] },
    2: { start: headers[2], end: headers[3] },
    3: { start: headers[3], end: headers[4] },
    4: { start: headers[4], end: headers[5] },
    5: { start: headers[5], end: 9999 },
  }

  const ts = {}
  const mondaiConfig = [
    { m: 1, count: 6, offset: 0 },
    { m: 2, count: 6, offset: 6 },
    { m: 3, count: 3, offset: 12 },
    { m: 4, count: 4, offset: 15 },
    { m: 5, count: 9, offset: 19 },
  ]

  for (const mc of mondaiConfig) {
    const range = ranges[mc.m]
    let searchFrom = range.start
    for (let local = 1; local <= mc.count; local++) {
      const globalQ = local + mc.offset
      const cue = hits.find((h) => h.num === local && h.time >= searchFrom && h.time < range.end)
      if (cue) {
        ts[globalQ] = Math.round(cue.time)
        searchFrom = cue.time + 5
      }
    }
  }

  interpolate(ts)
  return ts
}

/**
 * Strategy using 1番 resets to detect mondai boundaries
 */
function strategy1BanResets(hits) {
  // Find all 1番 positions with >60s gap
  const onePositions = []
  for (const h of hits) {
    if (h.num === 1) {
      if (onePositions.length === 0 || h.time - onePositions[onePositions.length - 1].time > 60) {
        onePositions.push(h)
      }
    }
  }

  // We need at least 3 mondai starts from 1番
  if (onePositions.length < 3) return null

  // Try to assign mondai boundaries
  // M1 starts with first 1番
  // M2 starts with second 1番
  // M3 starts with third 1番
  // M4 starts with fourth 1番 (if exists)
  // M5 determined by remaining

  const m1Start = onePositions[0].time
  const m2Start = onePositions[1].time
  const m3Start = onePositions[2].time
  const m4Start = onePositions[3]?.time
  const m5Start = onePositions[4]?.time

  const ranges = {}
  if (m4Start && m5Start) {
    ranges[1] = { start: m1Start, end: m2Start }
    ranges[2] = { start: m2Start, end: m3Start }
    ranges[3] = { start: m3Start, end: m4Start }
    ranges[4] = { start: m4Start, end: m5Start }
    ranges[5] = { start: m5Start, end: 9999 }
  } else if (m4Start) {
    // 4 starts: M1, M2, M3, M4. M5 boundary needs inference
    ranges[1] = { start: m1Start, end: m2Start }
    ranges[2] = { start: m2Start, end: m3Start }
    ranges[3] = { start: m3Start, end: m4Start }
    // Find end of M4 (after 4番)
    const m4last = hits.filter((h) => h.time >= m4Start && h.num === 4)[0]
    const m5Infer = m4last ? m4last.time + 30 : m4Start + 180
    ranges[4] = { start: m4Start, end: m5Infer }
    ranges[5] = { start: m5Infer, end: 9999 }
  } else {
    // Only 3 starts: could be M1, M2, M3 or M1, M2, M4, etc.
    // Heuristic: check gap sizes
    ranges[1] = { start: m1Start, end: m2Start }
    ranges[2] = { start: m2Start, end: m3Start }
    // After M3, try to find where M4 starts by looking for next numbered sequences
    const afterM3 = hits.filter((h) => h.time > m3Start + 200)
    if (afterM3.length > 0) {
      ranges[3] = { start: m3Start, end: afterM3[0].time - 30 }
      // Find M4/M5 boundary
      const m4s = afterM3[0].time - 30
      ranges[4] = { start: m4s, end: m4s + 200 }
      ranges[5] = { start: m4s + 200, end: 9999 }
    } else {
      ranges[3] = { start: m3Start, end: m3Start + 300 }
      ranges[4] = { start: m3Start + 300, end: m3Start + 500 }
      ranges[5] = { start: m3Start + 500, end: 9999 }
    }
  }

  const ts = {}
  const mondaiConfig = [
    { m: 1, count: 6, offset: 0 },
    { m: 2, count: 6, offset: 6 },
    { m: 3, count: 3, offset: 12 },
    { m: 4, count: 4, offset: 15 },
    { m: 5, count: 9, offset: 19 },
  ]

  for (const mc of mondaiConfig) {
    const range = ranges[mc.m]
    if (!range) continue
    let searchFrom = range.start
    for (let local = 1; local <= mc.count; local++) {
      const globalQ = local + mc.offset
      const cue = hits.find((h) => h.num === local && h.time >= searchFrom && h.time < range.end)
      if (cue) {
        ts[globalQ] = Math.round(cue.time)
        searchFrom = cue.time + 5
      }
    }
  }

  interpolate(ts)
  return ts
}

function interpolate(ts) {
  for (let q = 1; q <= 28; q++) {
    if (!ts[q]) {
      let prevQ = q - 1
      while (prevQ >= 1 && !ts[prevQ]) prevQ--
      let nextQ = q + 1
      while (nextQ <= 28 && !ts[nextQ]) nextQ++
      const prevT = ts[prevQ] || 0
      const nextT = ts[nextQ] || prevT + 90
      const gap = nextQ - prevQ
      ts[q] = Math.round(prevT + ((nextT - prevT) / gap) * (q - prevQ))
    }
  }
}

function scoreTimestamps(ts) {
  // Quality score: higher is better
  let score = 0

  // Check monotonically increasing
  for (let q = 2; q <= 28; q++) {
    if (ts[q] > ts[q - 1]) score += 10
    else score -= 100 // Penalty for non-monotonic
  }

  // Check Q1 is early (< 120s)
  if (ts[1] < 120) score += 50
  else score -= 50

  // Check Q7 is around 500-750s (M2 start)
  if (ts[7] >= 450 && ts[7] <= 800) score += 50
  else score -= 30

  // Check Q13 is around 1100-1600s (M3 start)
  if (ts[13] >= 1100 && ts[13] <= 1700) score += 50
  else score -= 30

  // Check Q16 is around 1450-1900s (M4 start)
  if (ts[16] >= 1400 && ts[16] <= 2000) score += 50
  else score -= 30

  // Check Q20 is around 1650-2200s (M5 start)
  if (ts[20] >= 1600 && ts[20] <= 2300) score += 50
  else score -= 30

  // Check total span is reasonable (28-42 minutes)
  const span = ts[28] - ts[1]
  if (span >= 1700 && span <= 2600) score += 30
  else score -= 30

  return score
}

// === MAIN ===
const EXAMS = [
  { examId: 'cm2u2yale01jo134i8wwru1oo-listening', title: 'N3 07/2024', videoId: '9LoOatdNILc' },
  { examId: 'cm2u2y69r01gd134iqiw21op8-listening', title: 'N3 12/2023', videoId: 'mXklPtDbSpU' },
  { examId: 'cm2u2y1xl01d2134ilubjx79d-listening', title: 'N3 07/2023', videoId: 'ojEXWTFZuWo' },
  { examId: 'cm2u2xxmo019t134izzsjxgrl-listening', title: 'N3 12/2022', videoId: '7JUfoB--SO4' },
  { examId: 'cm2u2xt6n016j134inupqhmlp-listening', title: 'N3 07/2022', videoId: 'eSR-4Sr7RO0' },
  { examId: 'cm2u2xosv0138134ib0bvpy32-listening', title: 'N3 12/2021', videoId: 'bAh4cfWmsaE' },
  { examId: 'cm2u2xkhj00zx134iasxlu6kb-listening', title: 'N3 07/2021', videoId: 'VC8jTIA6iPc' },
  { examId: 'cm2u2xg4300wm134izpbjrysi-listening', title: 'N3 12/2020', videoId: 'kCS4N19hqRI' },
  { examId: 'cm2u2xbu400ta134iaz003jdg-listening', title: 'N3 12/2019', videoId: 'LMKo8ZwgAe4' },
  { examId: 'cm2u2x7h500py134iyd65aphn-listening', title: 'N3 07/2019', videoId: 'WtFhVzrtWRA' },
  { examId: 'cm2u2x30900ml134ilniaj8pm-listening', title: 'N3 12/2018', videoId: '7C2jKskO-P4' },
  { examId: 'cm2u2wyk900j8134i65mmhnr8-listening', title: 'N3 07/2018', videoId: '-HPF7bczeUA' },
  { examId: 'cm2u2wuad00fw134ipsfpq3fu-listening', title: 'N3 12/2017', videoId: 'S9W4zKqJlso' },
  { examId: 'cm2u2wq1c00ck134imolbo8ac-listening', title: 'N3 07/2017', videoId: 'JHJJK9v3R-M' },
  { examId: 'cm2u2wlnt0097134ira8pl9rk-listening', title: 'N3 12/2016', videoId: 'u0ZlTsS0WT8' },
  { examId: 'cm2u2wh2e005t134ip8znt3dd-listening', title: 'N3 07/2016', videoId: 'ttgfxe1F7lo' },
  { examId: 'cm2u2wco4002g134io8nm04te-listening', title: 'N3 12/2015', videoId: 'r1xjUfKYwOA' },
]

const masterPath = path.join(ROOT, 'data', 'jlpt_full_master.json')
const master = JSON.parse(fs.readFileSync(masterPath, 'utf-8'))
const results = []

for (const item of EXAMS) {
  const vttPath = path.join(ROOT, 'tmp', `yt_${item.videoId}.ja.vtt`)
  if (!fs.existsSync(vttPath)) {
    console.log(`❌ ${item.title}: VTT missing`)
    continue
  }

  const vttText = fs.readFileSync(vttPath, 'utf-8')
  const hits = extractHits(vttText)
  const headers = findHeaders(vttText)

  // Try all strategies
  const candidates = []

  const ts1 = strategyHeaders(hits, headers)
  if (ts1) candidates.push({ name: 'headers', ts: ts1, score: scoreTimestamps(ts1) })

  const ts2 = strategy1BanResets(hits)
  if (ts2) candidates.push({ name: '1ban-resets', ts: ts2, score: scoreTimestamps(ts2) })

  // Pick best
  candidates.sort((a, b) => b.score - a.score)
  const best = candidates[0]

  if (!best) {
    console.log(`❌ ${item.title}: No valid timestamps found`)
    continue
  }

  const ts = best.ts
  console.log(`\n${item.title} => Best: ${best.name} (score: ${best.score})`)

  // Update master
  const exam = master.find((e) => e.id === item.examId)
  if (!exam) continue

  let qNum = 1
  const qDetails = []
  for (const part of exam.parts || []) {
    for (const q of part.questions || []) {
      q.audioStart = ts[qNum] || 0
      q.audioEnd = ts[qNum + 1] || (ts[qNum] || 0) + 75
      qDetails.push(`Q${String(qNum).padStart(2, ' ')}:${fmt(ts[qNum] || 0)}`)
      qNum++
    }
  }

  console.log(`  M1: ${qDetails.slice(0, 6).join(' | ')}`)
  console.log(`  M2: ${qDetails.slice(6, 12).join(' | ')}`)
  console.log(`  M3: ${qDetails.slice(12, 15).join(' | ')}`)
  console.log(`  M4: ${qDetails.slice(15, 19).join(' | ')}`)
  console.log(`  M5: ${qDetails.slice(19, 28).join(' | ')}`)

  let ok = true
  for (let q = 2; q <= 28; q++) {
    if ((ts[q] || 0) <= (ts[q - 1] || 0)) ok = false
  }

  results.push({
    title: item.title,
    strategy: best.name,
    score: best.score,
    Q1: fmt(ts[1] || 0),
    Q7: fmt(ts[7] || 0),
    Q13: fmt(ts[13] || 0),
    Q16: fmt(ts[16] || 0),
    Q20: fmt(ts[20] || 0),
    ok: ok ? '✅' : '❌',
  })
}

fs.writeFileSync(masterPath, JSON.stringify(master, null, 2), 'utf-8')

console.log('\n\n=== FINAL SUMMARY ===')
console.table(results)

// Report which exams failed
const failed = results.filter((r) => r.ok === '❌')
if (failed.length > 0) {
  console.log(`\n⚠️  ${failed.length} đề cần kiểm tra thủ công:`)
  for (const f of failed) console.log(`   - ${f.title}`)
}
