/**
 * Script cuối cùng: Tải audio YouTube → thay thế hoàn toàn file cũ → hiệu chỉnh timestamps
 *
 * Quy trình cho mỗi đề:
 * 1. XÓA file MP3 cũ (nếu có)
 * 2. Tải MP3 mới từ YouTube (yt-dlp)  
 * 3. Tải phụ đề tự động tiếng Nhật (.ja.vtt)
 * 4. Parse VTT → tìm mốc thời gian chính xác cho từng câu (bỏ qua 例/Rei)
 * 5. Ghi vào jlpt_full_master.json
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'D:\\VKU\\DoAnTN\\kotodama'
const YTDLP = path.join(ROOT, 'tools', 'yt-dlp', 'yt-dlp.exe')
const FFMPEG_DIR = path.join(ROOT, 'tools', 'ffmpeg')
const AUDIO_DIR = path.join(ROOT, 'public', 'audio', 'jlpt')
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

const EXAMS = [
  {
    examId: 'cm2u2yale01jo134i8wwru1oo-listening',
    title: 'N3 07/2024',
    videoId: '9LoOatdNILc',
    file: 'jlpt-n3-2024-07.mp3',
  },
  {
    examId: 'cm2u2y69r01gd134iqiw21op8-listening',
    title: 'N3 12/2023',
    videoId: 'mXklPtDbSpU',
    file: 'jlpt-n3-2023-12.mp3',
  },
  {
    examId: 'cm2u2y1xl01d2134ilubjx79d-listening',
    title: 'N3 07/2023',
    videoId: 'ojEXWTFZuWo',
    file: 'jlpt-n3-2023-07.mp3',
  },
  {
    examId: 'cm2u2xxmo019t134izzsjxgrl-listening',
    title: 'N3 12/2022',
    videoId: '7JUfoB--SO4',
    file: 'jlpt-n3-2022-12.mp3',
  },
  {
    examId: 'cm2u2xt6n016j134inupqhmlp-listening',
    title: 'N3 07/2022',
    videoId: 'eSR-4Sr7RO0',
    file: 'jlpt-n3-2022-07.mp3',
  },
  {
    examId: 'cm2u2xosv0138134ib0bvpy32-listening',
    title: 'N3 12/2021',
    videoId: 'bAh4cfWmsaE',
    file: 'jlpt-n3-2021-12.mp3',
  },
  {
    examId: 'cm2u2xkhj00zx134iasxlu6kb-listening',
    title: 'N3 07/2021',
    videoId: 'VC8jTIA6iPc',
    file: 'jlpt-n3-2021-07.mp3',
  },
  {
    examId: 'cm2u2xg4300wm134izpbjrysi-listening',
    title: 'N3 12/2020',
    videoId: 'kCS4N19hqRI',
    file: 'jlpt-n3-2020-12.mp3',
  },
  {
    examId: 'cm2u2xbu400ta134iaz003jdg-listening',
    title: 'N3 12/2019',
    videoId: 'LMKo8ZwgAe4',
    file: 'jlpt-n3-2019-12.mp3',
  },
  {
    examId: 'cm2u2x7h500py134iyd65aphn-listening',
    title: 'N3 07/2019',
    videoId: 'WtFhVzrtWRA',
    file: 'jlpt-n3-2019-07.mp3',
  },
  {
    examId: 'cm2u2x30900ml134ilniaj8pm-listening',
    title: 'N3 12/2018',
    videoId: '7C2jKskO-P4',
    file: 'jlpt-n3-2018-12.mp3',
  },
  {
    examId: 'cm2u2wyk900j8134i65mmhnr8-listening',
    title: 'N3 07/2018',
    videoId: '-HPF7bczeUA',
    file: 'jlpt-n3-2018-07.mp3',
  },
  {
    examId: 'cm2u2wuad00fw134ipsfpq3fu-listening',
    title: 'N3 12/2017',
    videoId: 'S9W4zKqJlso',
    file: 'jlpt-n3-2017-12.mp3',
  },
  {
    examId: 'cm2u2wq1c00ck134imolbo8ac-listening',
    title: 'N3 07/2017',
    videoId: 'JHJJK9v3R-M',
    file: 'jlpt-n3-2017-07.mp3',
  },
  {
    examId: 'cm2u2wlnt0097134ira8pl9rk-listening',
    title: 'N3 12/2016',
    videoId: 'u0ZlTsS0WT8',
    file: 'jlpt-n3-2016-12.mp3',
  },
  {
    examId: 'cm2u2wh2e005t134ip8znt3dd-listening',
    title: 'N3 07/2016',
    videoId: 'ttgfxe1F7lo',
    file: 'jlpt-n3-2016-07.mp3',
  },
  {
    examId: 'cm2u2wco4002g134io8nm04te-listening',
    title: 'N3 12/2015',
    videoId: 'r1xjUfKYwOA',
    file: 'jlpt-n3-2015-12.mp3',
  },
]

/**
 * Parse VTT file và tìm chính xác mốc thời gian cho 28 câu hỏi.
 * Bỏ qua hoàn toàn phần 例 (Rei / ví dụ mẫu).
 */
function parseTimestampsFromVtt(vttText) {
  // Normalize kanji numbers → arabic
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
    // Fix line-break between number and 番
    .replace(/(\d+)\s*\n\s*番/g, '$1番')

  const lines = normalized.split(/\r?\n/)

  // Build cue list: [{time, text}]
  const cues = []
  let curTime = 0
  for (const line of lines) {
    if (line.includes('-->')) {
      curTime = parseVttTime(line.split('-->')[0].trim())
    } else {
      const clean = line.replace(/<[^>]+>/g, '').trim()
      if (clean) cues.push({ time: curTime, text: clean })
    }
  }

  // Step 1: Find Mondai section headers (問題1 ~ 問題5)
  const mondaiHeaders = {}
  for (const c of cues) {
    for (let m = 1; m <= 5; m++) {
      if (!mondaiHeaders[m] && (c.text.includes(`問題${m}`) || c.text.includes(`問題 ${m}`))) {
        // Sanity: mondai headers should be roughly sequential
        const prev = mondaiHeaders[m - 1] || 0
        if (c.time > prev) {
          mondaiHeaders[m] = c.time
        }
      }
    }
  }

  // Mondai boundaries (start, end) for question search
  const mondaiRanges = {
    1: { start: mondaiHeaders[1] || 0, end: mondaiHeaders[2] || 9999 },
    2: { start: mondaiHeaders[2] || 0, end: mondaiHeaders[3] || 9999 },
    3: { start: mondaiHeaders[3] || 0, end: mondaiHeaders[4] || 9999 },
    4: { start: mondaiHeaders[4] || 0, end: mondaiHeaders[5] || 9999 },
    5: { start: mondaiHeaders[5] || 0, end: 9999 },
  }

  // Step 2: Within each mondai range, find N番 patterns IN ORDER, skipping 例
  const questionMap = {} // globalQ → seconds

  // Mondai 1: questions 1-6 (local 1番~6番)
  findQuestionsInRange(cues, mondaiRanges[1], 6, 0, questionMap)
  // Mondai 2: questions 7-12 (local 1番~6番)
  findQuestionsInRange(cues, mondaiRanges[2], 6, 6, questionMap)
  // Mondai 3: questions 13-15 (local 1番~3番)
  findQuestionsInRange(cues, mondaiRanges[3], 3, 12, questionMap)
  // Mondai 4: questions 16-19 (local 1番~4番) — note: mondai 4 has no 番 labels, uses sequential
  findQuestionsInRange(cues, mondaiRanges[4], 4, 15, questionMap)
  // Mondai 5: questions 20-28 (local 1番~9番)
  findQuestionsInRange(cues, mondaiRanges[5], 9, 19, questionMap)

  return questionMap
}

function findQuestionsInRange(cues, range, count, offset, questionMap) {
  let searchFrom = range.start
  for (let local = 1; local <= count; local++) {
    const globalQ = local + offset
    const pattern = `${local}番`
    // Find FIRST cue after searchFrom that contains N番 and is NOT 例
    const cue = cues.find(
      (c) => c.time >= searchFrom && c.time < range.end && c.text.includes(pattern) && !c.text.includes('例')
    )
    if (cue) {
      questionMap[globalQ] = Math.round(cue.time)
      searchFrom = cue.time + 1 // advance past this cue for next question
    }
  }
}

function downloadAudio(videoId, targetPath) {
  // Delete old file first
  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath)
    console.log(`  🗑️  Xóa file cũ: ${path.basename(targetPath)}`)
  }

  // yt-dlp appends extension, so we use a temp output pattern
  const tmpOutput = path.join(TMP_DIR, `yt_audio_${videoId}`)
  // Clean any previous temp files
  for (const f of fs.readdirSync(TMP_DIR).filter((f) => f.startsWith(`yt_audio_${videoId}`))) {
    fs.unlinkSync(path.join(TMP_DIR, f))
  }

  console.log(`  ⬇️  Đang tải audio từ YouTube (${videoId})...`)
  execSync(
    `"${YTDLP}" -x --audio-format mp3 --audio-quality 0 --ffmpeg-location "${FFMPEG_DIR}" -o "${tmpOutput}.%(ext)s" "https://www.youtube.com/watch?v=${videoId}"`,
    { stdio: 'pipe', timeout: 120000 }
  )

  // Find the downloaded file
  const downloaded = fs.readdirSync(TMP_DIR).find((f) => f.startsWith(`yt_audio_${videoId}`) && f.endsWith('.mp3'))
  if (!downloaded) {
    throw new Error(`Không tìm thấy file MP3 đã tải cho ${videoId}`)
  }

  // Move to target
  fs.copyFileSync(path.join(TMP_DIR, downloaded), targetPath)
  fs.unlinkSync(path.join(TMP_DIR, downloaded))

  const size = fs.statSync(targetPath).size
  console.log(`  ✅ Đã lưu: ${path.basename(targetPath)} (${(size / 1024 / 1024).toFixed(1)} MB)`)
}

function downloadSubtitles(videoId) {
  const vttPath = path.join(TMP_DIR, `yt_${videoId}.ja.vtt`)
  // Always re-download
  if (fs.existsSync(vttPath)) fs.unlinkSync(vttPath)

  console.log(`  📝 Đang tải phụ đề tiếng Nhật (${videoId})...`)
  try {
    execSync(
      `"${YTDLP}" --write-auto-sub --sub-lang ja --skip-download -o "${path.join(TMP_DIR, `yt_${videoId}`)}" "https://www.youtube.com/watch?v=${videoId}"`,
      { stdio: 'pipe', timeout: 30000 }
    )
  } catch {
    console.warn(`  ⚠️  Cảnh báo: không tải được phụ đề cho ${videoId}`)
  }
  return vttPath
}

async function main() {
  fs.mkdirSync(AUDIO_DIR, { recursive: true })
  fs.mkdirSync(TMP_DIR, { recursive: true })

  const masterPath = path.join(ROOT, 'data', 'jlpt_full_master.json')
  const master = JSON.parse(fs.readFileSync(masterPath, 'utf-8'))

  const results = []

  for (let i = 0; i < EXAMS.length; i++) {
    const item = EXAMS[i]
    console.log(`\n${'='.repeat(70)}`)
    console.log(`[${i + 1}/${EXAMS.length}] ${item.title} (YouTube: ${item.videoId})`)
    console.log(`${'='.repeat(70)}`)

    const targetMp3 = path.join(AUDIO_DIR, item.file)

    // 1. TẢI AUDIO MỚI TỪ YOUTUBE (xóa file cũ trước)
    downloadAudio(item.videoId, targetMp3)

    // 2. TẢI PHỤ ĐỀ
    const vttPath = downloadSubtitles(item.videoId)

    // 3. PARSE TIMESTAMPS
    let timestamps = {}
    if (fs.existsSync(vttPath)) {
      const vttText = fs.readFileSync(vttPath, 'utf-8')
      timestamps = parseTimestampsFromVtt(vttText)
    }

    // 4. CẬP NHẬT MASTER
    const exam = master.find((e) => e.id === item.examId)
    if (!exam) {
      console.error(`  ❌ Không tìm thấy exam ID: ${item.examId}`)
      continue
    }

    exam.audioUrl = `/audio/jlpt/${item.file}`

    let qNum = 1
    const qDetails = []
    for (const part of exam.parts || []) {
      for (const q of part.questions || []) {
        const start = timestamps[qNum] || 0
        const nextStart = timestamps[qNum + 1] || start + 75
        q.audioStart = start
        q.audioEnd = nextStart
        qDetails.push(`Q${qNum}: ${fmtTime(start)}`)
        qNum++
      }
    }

    console.log(`  📋 Timestamps (28 câu):`)
    // Print in groups
    console.log(`     Mondai 1: ${qDetails.slice(0, 6).join(' | ')}`)
    console.log(`     Mondai 2: ${qDetails.slice(6, 12).join(' | ')}`)
    console.log(`     Mondai 3: ${qDetails.slice(12, 15).join(' | ')}`)
    console.log(`     Mondai 4: ${qDetails.slice(15, 19).join(' | ')}`)
    console.log(`     Mondai 5: ${qDetails.slice(19, 28).join(' | ')}`)

    results.push({
      title: item.title,
      Q1: fmtTime(timestamps[1] || 0),
      Q7: fmtTime(timestamps[7] || 0),
      Q13: fmtTime(timestamps[13] || 0),
      Q16: fmtTime(timestamps[16] || 0),
      Q20: fmtTime(timestamps[20] || 0),
    })
  }

  // Save master
  fs.writeFileSync(masterPath, JSON.stringify(master, null, 2), 'utf-8')

  console.log(`\n\n${'🎉'.repeat(20)}`)
  console.log('TỔNG KẾT: Đã thay thế audio + hiệu chỉnh timestamps cho toàn bộ 17 đề!')
  console.log(`${'🎉'.repeat(20)}\n`)
  console.table(results)
}

main().catch((err) => {
  console.error('LỖI NGHIÊM TRỌNG:', err)
  process.exit(1)
})
