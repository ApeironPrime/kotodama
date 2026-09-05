/**
 * Script sửa timestamps cho các đề bị lỗi parsing VTT.
 *
 * Chiến lược mới: Thay vì dựa vào 問題N headers (nhiều VTT không có),
 * ta tìm TẤT CẢ vị trí N番 xuất hiện, rồi nhóm chúng thành 5 mondai
 * dựa vào khoảng cách thời gian và thứ tự.
 */

import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'D:\\VKU\\DoAnTN\\kotodama'
const TMP_DIR = path.join(ROOT, 'tmp')

function parseVttTime(str) {
  const parts = str.split(':')
  if (parts.length === 3) {
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2])
  }
  return 0
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Extract all N番 cue hits from VTT, deduplicated (keep first occurrence per ~2s window)
 */
function extractBanHits(vttText) {
  const normalized = vttText
    .replace(/一番/g, '1番')
    .replace(/二番/g, '2番')
    .replace(/三番/g, '3番')
    .replace(/四番/g, '4番')
    .replace(/五番/g, '5番')
    .replace(/六番/g, '6番')
    .replace(/七番/g, '7番')
    .replace(/八番/g, '8番')
    .replace(/九番/g, '9番')
    .replace(/(\d+)\s*\n\s*番/g, '$1番')

  const lines = normalized.split(/\r?\n/)
  let curTime = 0
  const rawHits = []

  for (const line of lines) {
    if (line.includes('-->')) {
      curTime = parseVttTime(line.split('-->')[0].trim())
    } else {
      const clean = line.replace(/<[^>]+>/g, '').trim()
      if (!clean) continue
      // Match N番 where N is 1-9
      const match = clean.match(/([1-9])番/)
      if (match && !clean.includes('例')) {
        rawHits.push({ time: curTime, num: parseInt(match[1]), text: clean })
      }
    }
  }

  // Deduplicate: keep only first hit per (num, time-window-3s)
  const deduped = []
  for (const hit of rawHits) {
    const isDupe = deduped.some((d) => d.num === hit.num && Math.abs(d.time - hit.time) < 3)
    if (!isDupe) deduped.push(hit)
  }

  return deduped
}

/**
 * Find 問題 headers if available
 */
function findMondaiHeaders(vttText) {
  const normalized = vttText.replace(/問題\s*\n\s*(\d)/g, '問題$1')
  const lines = normalized.split(/\r?\n/)
  let curTime = 0
  const headers = {}

  for (const line of lines) {
    if (line.includes('-->')) {
      curTime = parseVttTime(line.split('-->')[0].trim())
    } else {
      const clean = line.replace(/<[^>]+>/g, '').trim()
      for (let m = 1; m <= 5; m++) {
        if (!headers[m] && clean.includes(`問題${m}`)) {
          const prev = headers[m - 1] || 0
          if (curTime > prev + 30) {
            headers[m] = curTime
          }
        }
      }
    }
  }
  return headers
}

/**
 * Smart timestamp extraction combining mondai headers + ban hits analysis
 */
function smartExtractTimestamps(vttText) {
  const headers = findMondaiHeaders(vttText)
  const hits = extractBanHits(vttText)

  // If we have all 5 headers, use header-bounded approach
  const hasAllHeaders = headers[1] && headers[2] && headers[3] && headers[4] && headers[5]

  let mondaiBoundaries
  if (hasAllHeaders) {
    mondaiBoundaries = {
      1: { start: headers[1], end: headers[2] },
      2: { start: headers[2], end: headers[3] },
      3: { start: headers[3], end: headers[4] },
      4: { start: headers[4], end: headers[5] },
      5: { start: headers[5], end: 9999 },
    }
  } else {
    // Strategy: find all 1番 occurrences → they mark mondai starts
    // JLPT N3 structure: M1(6q), M2(6q), M3(3q), M4(4q), M5(9q)
    // M1 starts with 1番, M2 starts with 1番, M3 starts with 1番, M4 starts with 1番
    // M5 may or may not start with 1番

    const oneHits = hits.filter((h) => h.num === 1)

    // We expect at least 4 occurrences of 1番 (one per mondai 1-4)
    // M5 might not have a clear 1番 if auto-sub missed it

    // Filter: consecutive 1番 must be >60s apart to be different mondai
    const mondaiStarts = []
    for (const h of oneHits) {
      if (mondaiStarts.length === 0 || h.time - mondaiStarts[mondaiStarts.length - 1] > 60) {
        mondaiStarts.push(h.time)
      }
    }

    // We need exactly 4 or 5 mondai starts from 1番
    // If we got 4, M5 start needs to be inferred from when 4番 of M4 ends
    if (mondaiStarts.length >= 4) {
      const m1s = mondaiStarts[0]
      const m2s = mondaiStarts[1]
      const m3s = mondaiStarts[2]
      const m4s = mondaiStarts[3]

      // For M5: find the first hit after M4's questions end
      // M4 has 4 questions. Find the last question time in M4
      const m4Hits = hits.filter((h) => h.time >= m4s && h.time < (mondaiStarts[4] || m4s + 300))
      const m4End = m4Hits.length > 0 ? Math.max(...m4Hits.map((h) => h.time)) + 30 : m4s + 180

      let m5s = mondaiStarts[4] || 0
      if (!m5s) {
        // Find hits after m4End — first one is likely M5 Q20
        const afterM4 = hits.filter((h) => h.time > m4End)
        if (afterM4.length > 0) m5s = afterM4[0].time
      }

      mondaiBoundaries = {
        1: { start: m1s, end: m2s },
        2: { start: m2s, end: m3s },
        3: { start: m3s, end: m4s },
        4: { start: m4s, end: m5s || m4s + 200 },
        5: { start: m5s || m4s + 200, end: 9999 },
      }
    } else {
      console.error(`    ⚠️  Chỉ tìm được ${mondaiStarts.length} mondai starts, cần ít nhất 4`)
      return {}
    }
  }

  // Now extract questions within each mondai boundary
  const timestamps = {}

  // Mondai 1: Q1-Q6 (local 1番-6番)
  extractInRange(hits, mondaiBoundaries[1], 6, 0, timestamps)
  // Mondai 2: Q7-Q12 (local 1番-6番)
  extractInRange(hits, mondaiBoundaries[2], 6, 6, timestamps)
  // Mondai 3: Q13-Q15 (local 1番-3番)
  extractInRange(hits, mondaiBoundaries[3], 3, 12, timestamps)
  // Mondai 4: Q16-Q19 (local 1番-4番)
  extractInRange(hits, mondaiBoundaries[4], 4, 15, timestamps)
  // Mondai 5: Q20-Q28 (local 1番-9番)
  extractInRange(hits, mondaiBoundaries[5], 9, 19, timestamps)

  // Fill gaps: if any question is missing, interpolate
  for (let q = 1; q <= 28; q++) {
    if (!timestamps[q]) {
      // Find nearest known before and after
      let prevQ = q - 1
      while (prevQ >= 1 && !timestamps[prevQ]) prevQ--
      let nextQ = q + 1
      while (nextQ <= 28 && !timestamps[nextQ]) nextQ++

      const prevT = timestamps[prevQ] || 0
      const nextT = timestamps[nextQ] || prevT + 90
      const gap = nextQ - prevQ
      const step = (nextT - prevT) / gap
      timestamps[q] = Math.round(prevT + step * (q - prevQ))
    }
  }

  return timestamps
}

function extractInRange(hits, range, count, offset, timestamps) {
  let searchFrom = range.start
  for (let local = 1; local <= count; local++) {
    const globalQ = local + offset
    // Find the first hit with num==local, time >= searchFrom, time < range.end
    const cue = hits.find((h) => h.num === local && h.time >= searchFrom && h.time < range.end)
    if (cue) {
      timestamps[globalQ] = Math.round(cue.time)
      searchFrom = cue.time + 5 // must be at least 5s after for next question
    }
  }
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
  const vttPath = path.join(TMP_DIR, `yt_${item.videoId}.ja.vtt`)
  if (!fs.existsSync(vttPath)) {
    console.log(`❌ ${item.title}: VTT file missing`)
    continue
  }

  const vttText = fs.readFileSync(vttPath, 'utf-8')
  console.log(`\n--- ${item.title} (${item.videoId}) ---`)

  const timestamps = smartExtractTimestamps(vttText)

  // Update master
  const exam = master.find((e) => e.id === item.examId)
  if (!exam) continue

  let qNum = 1
  const qDetails = []
  for (const part of exam.parts || []) {
    for (const q of part.questions || []) {
      const start = timestamps[qNum] || 0
      const nextStart = timestamps[qNum + 1] || start + 75
      q.audioStart = start
      q.audioEnd = nextStart
      qDetails.push(`Q${qNum}:${fmtTime(start)}`)
      qNum++
    }
  }

  console.log(`  M1: ${qDetails.slice(0, 6).join(' ')}`)
  console.log(`  M2: ${qDetails.slice(6, 12).join(' ')}`)
  console.log(`  M3: ${qDetails.slice(12, 15).join(' ')}`)
  console.log(`  M4: ${qDetails.slice(15, 19).join(' ')}`)
  console.log(`  M5: ${qDetails.slice(19, 28).join(' ')}`)

  results.push({
    title: item.title,
    Q1: fmtTime(timestamps[1] || 0),
    Q7: fmtTime(timestamps[7] || 0),
    Q13: fmtTime(timestamps[13] || 0),
    Q16: fmtTime(timestamps[16] || 0),
    Q20: fmtTime(timestamps[20] || 0),
    ok: Object.values(timestamps).every((v) => v > 0) ? '✅' : '⚠️',
  })
}

fs.writeFileSync(masterPath, JSON.stringify(master, null, 2), 'utf-8')

console.log('\n\n=== TỔNG KẾT ===')
console.table(results)
