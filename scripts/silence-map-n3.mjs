/**
 * DEFINITIVE: Map silence detection patterns to JLPT N3 question structure.
 *
 * Key insight from silence analysis:
 * - M1 (課題理解): each question preceded by ~12s silence. 6 questions.
 * - M2 (ポイント理解): each question has narration setup (~12s) + thinking time (~20s). 6 questions.
 *   Pattern: [instr 20s] [narr 12s] [think 20s] × 6
 * - M3 (概要理解): each question followed by ~8s thinking. 3 questions.
 * - M4 (発話表現): each question preceded by ~10s silence. 4 questions.
 * - M5 (即時応答): each question followed by ~8s thinking. 9 questions.
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'D:\\VKU\\DoAnTN\\kotodama'
const FFMPEG = path.join(ROOT, 'tools', 'ffmpeg', 'ffmpeg.exe')
const AUDIO_DIR = path.join(ROOT, 'public', 'audio', 'jlpt')

function fmt(sec) {
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function detectSilences(audioPath, minDur = 3.0) {
  const output = execSync(`"${FFMPEG}" -i "${audioPath}" -af silencedetect=noise=-35dB:d=${minDur} -f null - 2>&1`, {
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
  })
  const silences = []
  for (const line of output.split('\n')) {
    const m = line.match(/silence_end:\s*([\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)/)
    if (m) {
      silences.push({
        start: parseFloat(m[1]) - parseFloat(m[2]),
        end: parseFloat(m[1]),
        duration: parseFloat(m[2]),
      })
    }
  }
  return silences
}

function mapSilencesToQuestions(silences) {
  // Step 1: Classify silences
  const major = silences.filter((s) => s.duration >= 10)
  const all = silences.filter((s) => s.duration >= 3.5)

  // Step 2: Find M1 questions (first 6 major silences, each ~12s)
  // M1 questions are preceded by ~12s silences
  const m1Silences = major.slice(0, 6)
  const m1End = m1Silences[5]?.end || 0

  // Step 3: Find M2 section
  // After M1, there's a ~20s instruction silence, then alternating 12s/20s pairs
  const afterM1 = major.filter((s) => s.end > m1End)

  // M2 instruction = first ~20s silence after M1
  const m2InstrIdx = afterM1.findIndex((s) => s.duration >= 18)
  const m2Instr = m2InstrIdx >= 0 ? afterM1[m2InstrIdx] : null
  const m2StartTime = m2Instr?.end || m1End + 30

  // M2 narration silences are ~12s, M2 thinking silences are ~20s
  // Take major silences after M2 instruction, pick the ~12s ones (narration starts)
  const m2Region = major.filter((s) => s.end > m2StartTime)

  // Group into pairs: [narration(~12s), thinking(~20s)]
  const m2Questions = []
  let i = 0
  while (i < m2Region.length && m2Questions.length < 6) {
    const s = m2Region[i]
    if (s.duration < 18) {
      // This is a narration silence (question start)
      m2Questions.push(Math.round(s.end))
      i++ // skip this
      if (i < m2Region.length && m2Region[i].duration >= 18) {
        i++ // skip the following thinking silence
      }
    } else {
      // This is a thinking silence (skip, or could be a section boundary)
      i++
    }
  }

  const m2LastThinkingEnd =
    m2Questions.length > 0
      ? (() => {
          // Find the thinking silence after the last M2 question
          const lastQ = m2Questions[m2Questions.length - 1]
          const thinking = major.find((s) => s.end > lastQ && s.duration >= 18)
          return thinking?.end || lastQ + 90
        })()
      : m2StartTime + 600

  // Step 4: M3, M4, M5 — these use smaller silences
  // After M2, all remaining silences > 3.5s
  const afterM2 = all.filter((s) => s.end > m2LastThinkingEnd)

  // M3: 3 questions, typically ~8s silences + 1 boundary silence
  // M4: 4 questions, typically ~10s silences + 1 boundary silence
  // M5: 9 questions, typically ~8s silences

  // Total remaining should be ~16-20 silences for 16 questions (M3:3 + M4:4 + M5:9)
  // Plus some boundary/instruction silences

  // Find M3 start: first significant silence after M2
  // M3 questions have ~4-8s gap, followed by long dialogue, then 8s thinking
  // The first silence after M2 is likely M3 instruction

  // Simple approach: just take remaining silences and assign sequentially
  // M3: 3 questions, M4: 4 questions, M5: 9 questions = 16 total
  // But there are boundary silences between sections too

  // Find section boundaries (>8s silences that come after a cluster of shorter ones)
  // Actually, let's use a smarter heuristic:
  // M3 questions have LONGER gaps (~8s) because dialogues are long
  // M4 questions have shorter gaps (~10s) with different pattern
  // M5 questions have very regular ~8s gaps

  // The most reliable approach: M3+M4+M5 silences should total ~16+ silences
  // M3: take 3 silences > 7s (the thinking pauses after each question)
  // Then find a gap or instruction boundary
  // M4: take 4 silences > 9s
  // M5: take the remaining 9 silences

  // Actually, looking at the data patterns, let me use a different approach:
  // After M2, silences naturally cluster into M3 (long gaps ~8s),
  // then M4 (medium gaps ~10s), then M5 (short regular ~8s)

  // The transition points can be detected by duration patterns or gap clustering

  // For now, let me just assign them based on count:
  // Total remaining silences - find groups

  // Count all silences after M2 that could be question boundaries
  const remaining = afterM2.map((s) => Math.round(s.end))

  // Expected: ~16-19 remaining (3 M3 + transition + 4 M4 + transition + 9 M5)
  // The transitions show up as slightly different duration patterns

  // Simpler: assign the first 3 to M3, skip if there's a clear gap,
  // next 4 to M4, rest to M5

  // Find natural clusters by looking at inter-silence gaps
  const gaps = []
  for (let j = 1; j < remaining.length; j++) {
    gaps.push({ idx: j, gap: remaining[j] - remaining[j - 1] })
  }

  // Find the two largest gaps — they separate M3/M4 and M4/M5
  const sortedGaps = [...gaps].sort((a, b) => b.gap - a.gap)

  let m3End, m4End
  if (sortedGaps.length >= 2) {
    const split1 = Math.min(sortedGaps[0].idx, sortedGaps[1].idx)
    const split2 = Math.max(sortedGaps[0].idx, sortedGaps[1].idx)

    // M3 = remaining[0..split1-1], M4 = remaining[split1..split2-1], M5 = remaining[split2..]
    // But verify counts make sense
    const m3Count = split1
    const m4Count = split2 - split1
    const m5Count = remaining.length - split2

    if (m3Count >= 3 && m4Count >= 4 && m5Count >= 8) {
      m3End = split1
      m4End = split2
    }
  }

  // Fallback: use fixed counts
  if (!m3End) {
    // Try to find M3 (3 questions), then look for M4 transition
    // M3 questions have gaps of ~90-120s between them (long dialogues)
    // M4 questions have gaps of ~35-40s
    // M5 questions have gaps of ~30-35s

    // Find where gap drops significantly (M3→M4 transition)
    let m3EndIdx = 3 // default
    for (let j = 2; j < Math.min(6, remaining.length); j++) {
      if (remaining[j] - remaining[j - 1] < 60 && j >= 3) {
        m3EndIdx = j
        break
      }
    }

    // Find M4→M5 transition (M4 gaps ~35-40s, M5 gaps ~30-35s)
    let m4EndIdx = m3EndIdx + 4
    if (m4EndIdx > remaining.length - 9) {
      m4EndIdx = remaining.length - 9
    }

    m3End = m3EndIdx
    m4End = Math.max(m3End + 4, m4EndIdx)
  }

  // Ensure M5 has exactly 9
  if (remaining.length - m4End > 9) {
    // Too many — adjust m4End
    m4End = remaining.length - 9
  }
  if (remaining.length - m4End < 9 && m4End > m3End + 4) {
    m4End = remaining.length - 9
  }

  const m3Starts = remaining.slice(0, m3End)
  const m4Starts = remaining.slice(m3End, m4End)
  const m5Starts = remaining.slice(m4End, m4End + 9)

  // Build final timestamps
  const ts = {}

  // M1
  for (let q = 0; q < 6; q++) {
    ts[q + 1] = Math.round(m1Silences[q]?.end || 0)
  }

  // M2
  for (let q = 0; q < m2Questions.length && q < 6; q++) {
    ts[q + 7] = m2Questions[q]
  }
  // Fill remaining M2 if needed
  if (m2Questions.length < 6) {
    for (let q = m2Questions.length; q < 6; q++) {
      const prev = ts[q + 6] || m2StartTime + q * 100
      ts[q + 7] = prev + 90
    }
  }

  // M3
  for (let q = 0; q < 3; q++) {
    ts[q + 13] = m3Starts[q] || (ts[12] || 0) + (q + 1) * 100
  }

  // M4
  for (let q = 0; q < 4; q++) {
    ts[q + 16] = m4Starts[q] || (ts[15] || 0) + (q + 1) * 40
  }

  // M5
  for (let q = 0; q < 9; q++) {
    ts[q + 20] = m5Starts[q] || (ts[19] || 0) + (q + 1) * 35
  }

  // Final interpolation for any missing
  for (let q = 1; q <= 28; q++) {
    if (!ts[q]) {
      let pq = q - 1
      while (pq >= 1 && !ts[pq]) pq--
      let nq = q + 1
      while (nq <= 28 && !ts[nq]) nq++
      const pt = ts[pq] || 0
      const nt = ts[nq] || pt + 90
      ts[q] = Math.round(pt + ((nt - pt) / (nq - pq)) * (q - pq))
    }
  }

  return ts
}

// === MAIN ===
const ALL_EXAMS = [
  { examId: 'cm2u2yale01jo134i8wwru1oo-listening', title: 'N3 07/2024', file: 'jlpt-n3-2024-07.mp3', useVtt: true },
  { examId: 'cm2u2y69r01gd134iqiw21op8-listening', title: 'N3 12/2023', file: 'jlpt-n3-2023-12.mp3', useVtt: true },
  { examId: 'cm2u2y1xl01d2134ilubjx79d-listening', title: 'N3 07/2023', file: 'jlpt-n3-2023-07.mp3', useVtt: true },
  { examId: 'cm2u2xxmo019t134izzsjxgrl-listening', title: 'N3 12/2022', file: 'jlpt-n3-2022-12.mp3', useVtt: true },
  { examId: 'cm2u2xt6n016j134inupqhmlp-listening', title: 'N3 07/2022', file: 'jlpt-n3-2022-07.mp3', useSilence: true },
  { examId: 'cm2u2xosv0138134ib0bvpy32-listening', title: 'N3 12/2021', file: 'jlpt-n3-2021-12.mp3', useVtt: true },
  { examId: 'cm2u2xkhj00zx134iasxlu6kb-listening', title: 'N3 07/2021', file: 'jlpt-n3-2021-07.mp3', useVtt: true },
  { examId: 'cm2u2xg4300wm134izpbjrysi-listening', title: 'N3 12/2020', file: 'jlpt-n3-2020-12.mp3', useSilence: true },
  { examId: 'cm2u2xbu400ta134iaz003jdg-listening', title: 'N3 12/2019', file: 'jlpt-n3-2019-12.mp3', useSilence: true },
  { examId: 'cm2u2x7h500py134iyd65aphn-listening', title: 'N3 07/2019', file: 'jlpt-n3-2019-07.mp3', useSilence: true },
  { examId: 'cm2u2x30900ml134ilniaj8pm-listening', title: 'N3 12/2018', file: 'jlpt-n3-2018-12.mp3', useSilence: true },
  { examId: 'cm2u2wyk900j8134i65mmhnr8-listening', title: 'N3 07/2018', file: 'jlpt-n3-2018-07.mp3', useVtt: true },
  { examId: 'cm2u2wuad00fw134ipsfpq3fu-listening', title: 'N3 12/2017', file: 'jlpt-n3-2017-12.mp3', useVtt: true },
  { examId: 'cm2u2wq1c00ck134imolbo8ac-listening', title: 'N3 07/2017', file: 'jlpt-n3-2017-07.mp3', useSilence: true },
  { examId: 'cm2u2wlnt0097134ira8pl9rk-listening', title: 'N3 12/2016', file: 'jlpt-n3-2016-12.mp3', useVtt: true },
  { examId: 'cm2u2wh2e005t134ip8znt3dd-listening', title: 'N3 07/2016', file: 'jlpt-n3-2016-07.mp3', useSilence: true },
  { examId: 'cm2u2wco4002g134io8nm04te-listening', title: 'N3 12/2015', file: 'jlpt-n3-2015-12.mp3', useSilence: true },
]

const masterPath = path.join(ROOT, 'data', 'jlpt_full_master.json')
const master = JSON.parse(fs.readFileSync(masterPath, 'utf-8'))
const results = []

for (const item of ALL_EXAMS.filter((e) => e.useSilence)) {
  console.log(`\n--- ${item.title} (silence detection) ---`)
  const audioPath = path.join(AUDIO_DIR, item.file)
  const silences = detectSilences(audioPath)
  const ts = mapSilencesToQuestions(silences)

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
    if ((ts[q] || 0) <= (ts[q - 1] || 0)) {
      ok = false
      console.log(`  ⚠️ Q${q} (${fmt(ts[q])}) <= Q${q - 1} (${fmt(ts[q - 1])})`)
    }
  }

  results.push({
    title: item.title,
    Q1: fmt(ts[1] || 0),
    Q7: fmt(ts[7] || 0),
    Q13: fmt(ts[13] || 0),
    Q16: fmt(ts[16] || 0),
    Q20: fmt(ts[20] || 0),
    ok: ok ? '✅' : '❌',
  })
}

fs.writeFileSync(masterPath, JSON.stringify(master, null, 2), 'utf-8')

console.log('\n=== SILENCE-BASED RESULTS ===')
console.table(results)
