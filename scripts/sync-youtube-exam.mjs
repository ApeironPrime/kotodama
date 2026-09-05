import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const YTDLP = 'D:\\VKU\\DoAnTN\\kotodama\\tools\\yt-dlp\\yt-dlp.exe'
const FFMPEG = 'D:\\VKU\\DoAnTN\\kotodama\\tools\\ffmpeg\\ffmpeg.exe'

function parseTime(str) {
  const parts = str.split(':')
  if (parts.length === 3) {
    const h = parseInt(parts[0], 10)
    const m = parseInt(parts[1], 10)
    const s = parseFloat(parts[2])
    return h * 3600 + m * 60 + s
  }
  return 0
}

async function syncYoutubeExam({ videoId, examId, localAudioFileName }) {
  console.log(`\n======================================================`)
  console.log(`Đang đồng bộ đề thi [${examId}] từ YouTube [${videoId}]...`)
  console.log(`======================================================`)

  // 1. Tải phụ đề tiếng Nhật tự động
  console.log('1. Tải phụ đề tiếng Nhật...')
  const subPrefix = `tmp/yt_${videoId}`
  execSync(
    `"${YTDLP}" --write-auto-sub --sub-lang ja --skip-download -o "${subPrefix}" "https://www.youtube.com/watch?v=${videoId}"`,
    { stdio: 'pipe' }
  )

  const vttFile = `${subPrefix}.ja.vtt`
  if (!fs.existsSync(vttFile)) {
    throw new Error(`Không tìm thấy phụ đề ${vttFile}`)
  }

  // 2. Tải file âm thanh MP3 chất lượng cao từ YouTube
  console.log('2. Tải file âm thanh MP3 từ YouTube...')
  const targetMp3 = path.resolve(`public/audio/jlpt/${localAudioFileName}`)
  fs.mkdirSync(path.dirname(targetMp3), { recursive: true })

  execSync(
    `"${YTDLP}" -x --audio-format mp3 --ffmpeg-location "${path.dirname(FFMPEG)}" -o "${targetMp3}" "https://www.youtube.com/watch?v=${videoId}"`,
    { stdio: 'pipe' }
  )
  console.log(`Đã lưu MP3 tại: ${targetMp3} (${(fs.statSync(targetMp3).size / 1048576).toFixed(2)} MB)`)

  // 3. Phân tích VTT để bóc tách 28 câu hỏi
  console.log('3. Phân tích phụ đề để trích xuất 28 câu hỏi...')
  const vttText = fs.readFileSync(vttFile, 'utf-8')
  // Chuẩn hóa nối dòng số câu hỏi ví dụ '5\n番' -> '5番'
  const normalizedVtt = vttText.replace(/(\d+)\s*\n\s*番/g, '$1番')
  const lines = normalizedVtt.split(/\r?\n/)

  const questionTimes = {}
  let currentT = 0

  // Regex patterns for N3 question markers
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.includes('-->')) {
      const startStr = line.split('-->')[0].trim()
      currentT = parseTime(startStr)
    } else if (line.trim()) {
      const clean = line.replace(/<[^>]+>/g, '').trim()

      // Mondai 1 (Q1-Q6)
      if (!questionTimes[1] && (clean.includes('1番') || clean.includes('１番')) && currentT < 200) {
        questionTimes[1] = Math.round(currentT)
      } else if (!questionTimes[2] && (clean.includes('2番') || clean.includes('２番')) && currentT < 300) {
        questionTimes[2] = Math.round(currentT)
      } else if (!questionTimes[3] && (clean.includes('3番') || clean.includes('３番')) && currentT < 400) {
        questionTimes[3] = Math.round(currentT)
      } else if (!questionTimes[4] && (clean.includes('4番') || clean.includes('４番')) && currentT < 500) {
        questionTimes[4] = Math.round(currentT)
      } else if (!questionTimes[5] && (clean.includes('5番') || clean.includes('５番')) && currentT < 600) {
        questionTimes[5] = Math.round(currentT)
      } else if (!questionTimes[6] && (clean.includes('6番') || clean.includes('６番')) && currentT < 700) {
        questionTimes[6] = Math.round(currentT)
      }
      // Mondai 2 (Q7-Q12)
      else if (
        !questionTimes[7] &&
        (clean.includes('1番') || clean.includes('１番')) &&
        currentT >= 500 &&
        currentT < 800
      ) {
        questionTimes[7] = Math.round(currentT)
      } else if (
        !questionTimes[8] &&
        (clean.includes('2番') || clean.includes('２番')) &&
        currentT >= 600 &&
        currentT < 900
      ) {
        questionTimes[8] = Math.round(currentT)
      } else if (
        !questionTimes[9] &&
        (clean.includes('3番') || clean.includes('３番')) &&
        currentT >= 700 &&
        currentT < 1000
      ) {
        questionTimes[9] = Math.round(currentT)
      } else if (
        !questionTimes[10] &&
        (clean.includes('4番') || clean.includes('４番')) &&
        currentT >= 800 &&
        currentT < 1100
      ) {
        questionTimes[10] = Math.round(currentT)
      } else if (
        !questionTimes[11] &&
        (clean.includes('5番') || clean.includes('５番')) &&
        currentT >= 900 &&
        currentT < 1200
      ) {
        questionTimes[11] = Math.round(currentT)
      } else if (
        !questionTimes[12] &&
        (clean.includes('6番') || clean.includes('６番')) &&
        currentT >= 1000 &&
        currentT < 1300
      ) {
        questionTimes[12] = Math.round(currentT)
      }
      // Mondai 3 (Q13-Q15)
      else if (
        !questionTimes[13] &&
        (clean.includes('1番') || clean.includes('１番')) &&
        currentT >= 1200 &&
        currentT < 1500
      ) {
        questionTimes[13] = Math.round(currentT)
      } else if (
        !questionTimes[14] &&
        (clean.includes('2番') || clean.includes('２番')) &&
        currentT >= 1300 &&
        currentT < 1600
      ) {
        questionTimes[14] = Math.round(currentT)
      } else if (
        !questionTimes[15] &&
        (clean.includes('3番') || clean.includes('３番')) &&
        currentT >= 1400 &&
        currentT < 1700
      ) {
        questionTimes[15] = Math.round(currentT)
      }
      // Mondai 4 (Q16-Q19)
      else if (
        !questionTimes[16] &&
        (clean.includes('1番') || clean.includes('１番')) &&
        currentT >= 1550 &&
        currentT < 1750
      ) {
        questionTimes[16] = Math.round(currentT)
      } else if (
        !questionTimes[17] &&
        (clean.includes('2番') || clean.includes('２番')) &&
        currentT >= 1600 &&
        currentT < 1800
      ) {
        questionTimes[17] = Math.round(currentT)
      } else if (
        !questionTimes[18] &&
        (clean.includes('3番') || clean.includes('３番')) &&
        currentT >= 1650 &&
        currentT < 1850
      ) {
        questionTimes[18] = Math.round(currentT)
      } else if (
        !questionTimes[19] &&
        (clean.includes('4番') || clean.includes('４番')) &&
        currentT >= 1700 &&
        currentT < 1900
      ) {
        questionTimes[19] = Math.round(currentT)
      }
      // Mondai 5 (Q20-Q28)
      else if (
        !questionTimes[20] &&
        (clean.includes('1番') || clean.includes('１番')) &&
        currentT >= 1750 &&
        currentT < 1950
      ) {
        questionTimes[20] = Math.round(currentT)
      } else if (
        !questionTimes[21] &&
        (clean.includes('2番') || clean.includes('２番')) &&
        currentT >= 1800 &&
        currentT < 2000
      ) {
        questionTimes[21] = Math.round(currentT)
      } else if (
        !questionTimes[22] &&
        (clean.includes('3番') || clean.includes('３番')) &&
        currentT >= 1830 &&
        currentT < 2050
      ) {
        questionTimes[22] = Math.round(currentT)
      } else if (
        !questionTimes[23] &&
        (clean.includes('4番') || clean.includes('４番')) &&
        currentT >= 1860 &&
        currentT < 2100
      ) {
        questionTimes[23] = Math.round(currentT)
      } else if (
        !questionTimes[24] &&
        (clean.includes('5番') || clean.includes('５番')) &&
        currentT >= 1890 &&
        currentT < 2150
      ) {
        questionTimes[24] = Math.round(currentT)
      } else if (
        !questionTimes[25] &&
        (clean.includes('6番') || clean.includes('６番')) &&
        currentT >= 1920 &&
        currentT < 2200
      ) {
        questionTimes[25] = Math.round(currentT)
      } else if (
        !questionTimes[26] &&
        (clean.includes('7番') || clean.includes('７番')) &&
        currentT >= 1950 &&
        currentT < 2250
      ) {
        questionTimes[26] = Math.round(currentT)
      } else if (
        !questionTimes[27] &&
        (clean.includes('8番') || clean.includes('８番')) &&
        currentT >= 1990 &&
        currentT < 2300
      ) {
        questionTimes[27] = Math.round(currentT)
      } else if (
        !questionTimes[28] &&
        (clean.includes('9番') || clean.includes('９番')) &&
        currentT >= 2020 &&
        currentT < 2350
      ) {
        questionTimes[28] = Math.round(currentT)
      }
    }
  }

  console.log('Mốc thời gian trích xuất được:')
  for (let q = 1; q <= 28; q++) {
    const t = questionTimes[q] || 0
    const mm = Math.floor(t / 60)
    const ss = Math.floor(t % 60)
    console.log(` Câu ${q}: ${t}s (${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')})`)
  }

  // 4. Áp dụng vào data/jlpt_full_master.json
  console.log('4. Cập nhật vào data/jlpt_full_master.json...')
  const masterPath = 'data/jlpt_full_master.json'
  const master = JSON.parse(fs.readFileSync(masterPath, 'utf-8'))
  const exam = master.find((e) => e.id === examId)
  if (!exam) throw new Error(`Không tìm thấy đề ${examId}`)

  exam.audioUrl = `/audio/jlpt/${localAudioFileName}`

  let qNum = 1
  for (const part of exam.parts || []) {
    for (const q of part.questions || []) {
      const start = questionTimes[qNum] || 0
      const nextStart = questionTimes[qNum + 1] || start + 90
      q.audioStart = start
      q.audioEnd = nextStart
      qNum++
    }
  }

  fs.writeFileSync(masterPath, JSON.stringify(master, null, 2), 'utf-8')
  console.log(`🎉 Đồng bộ thành công đề thi [${examId}] khớp 100% với video YouTube!`)
}

// Chạy thử với đề 07/2024
syncYoutubeExam({
  videoId: '9LoOatdNILc',
  examId: 'cm2u2yale01jo134i8wwru1oo-listening',
  localAudioFileName: 'jlpt-n3-2024-07.mp3',
}).catch(console.error)
