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

export async function syncExam({ videoId, examId, localAudioFileName }) {
  console.log(`\n======================================================`)
  console.log(`Đang đồng bộ đề thi [${examId}] từ YouTube [${videoId}]...`)
  console.log(`======================================================`)

  const subPrefix = `tmp/yt_${videoId}`
  try {
    execSync(
      `"${YTDLP}" --write-auto-sub --sub-lang ja --skip-download -o "${subPrefix}" "https://www.youtube.com/watch?v=${videoId}"`,
      { stdio: 'pipe' }
    )
  } catch (err) {
    console.warn('Cảnh báo tải sub:', err.message)
  }

  const vttFile = `${subPrefix}.ja.vtt`
  if (!fs.existsSync(vttFile)) {
    throw new Error(`Không tìm thấy phụ đề ${vttFile}`)
  }

  const targetMp3 = path.resolve(`public/audio/jlpt/${localAudioFileName}`)
  fs.mkdirSync(path.dirname(targetMp3), { recursive: true })

  if (!fs.existsSync(targetMp3) || fs.statSync(targetMp3).size < 1000000) {
    console.log('Tải âm thanh MP3 từ YouTube...')
    execSync(
      `"${YTDLP}" -x --audio-format mp3 --ffmpeg-location "${path.dirname(FFMPEG)}" -o "${targetMp3}" "https://www.youtube.com/watch?v=${videoId}"`,
      { stdio: 'pipe' }
    )
  }

  const vttText = fs.readFileSync(vttFile, 'utf-8')
  const normalizedVtt = vttText.replace(/(\d+)\s*\n\s*番/g, '$1番').replace(/ます\s*番/g, '1番')

  const lines = normalizedVtt.split(/\r?\n/)

  const questionTimes = {}
  let currentT = 0
  let passedM5 = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.includes('-->')) {
      const startStr = line.split('-->')[0].trim()
      currentT = parseTime(startStr)
    } else if (line.trim()) {
      const clean = line.replace(/<[^>]+>/g, '').trim()
      if (clean.includes('問題5') || clean.includes('問題 5')) {
        passedM5 = true
      }

      // Mondai 1 (Q1-Q6)
      if (!questionTimes[1] && (clean.includes('1番') || clean.includes('１番')) && currentT < 250) {
        questionTimes[1] = Math.round(currentT)
      } else if (!questionTimes[2] && (clean.includes('2番') || clean.includes('２番')) && currentT < 350) {
        questionTimes[2] = Math.round(currentT)
      } else if (!questionTimes[3] && (clean.includes('3番') || clean.includes('３番')) && currentT < 450) {
        questionTimes[3] = Math.round(currentT)
      } else if (!questionTimes[4] && (clean.includes('4番') || clean.includes('４番')) && currentT < 550) {
        questionTimes[4] = Math.round(currentT)
      } else if (!questionTimes[5] && (clean.includes('5番') || clean.includes('５番')) && currentT < 650) {
        questionTimes[5] = Math.round(currentT)
      } else if (!questionTimes[6] && (clean.includes('6番') || clean.includes('６番')) && currentT < 750) {
        questionTimes[6] = Math.round(currentT)
      }
      // Mondai 2 (Q7-Q12)
      else if (
        !questionTimes[7] &&
        (clean.includes('1番') || clean.includes('１番')) &&
        currentT >= 500 &&
        currentT < 850
      ) {
        questionTimes[7] = Math.round(currentT)
      } else if (
        !questionTimes[8] &&
        (clean.includes('2番') || clean.includes('２番')) &&
        currentT >= 600 &&
        currentT < 950
      ) {
        questionTimes[8] = Math.round(currentT)
      } else if (
        !questionTimes[9] &&
        (clean.includes('3番') || clean.includes('３番')) &&
        currentT >= 700 &&
        currentT < 1050
      ) {
        questionTimes[9] = Math.round(currentT)
      } else if (
        !questionTimes[10] &&
        (clean.includes('4番') || clean.includes('４番')) &&
        currentT >= 800 &&
        currentT < 1150
      ) {
        questionTimes[10] = Math.round(currentT)
      } else if (
        !questionTimes[11] &&
        (clean.includes('5番') || clean.includes('５番')) &&
        currentT >= 900 &&
        currentT < 1250
      ) {
        questionTimes[11] = Math.round(currentT)
      } else if (
        !questionTimes[12] &&
        (clean.includes('6番') || clean.includes('６番')) &&
        currentT >= 1000 &&
        currentT < 1350
      ) {
        questionTimes[12] = Math.round(currentT)
      }
      // Mondai 3 (Q13-Q15)
      else if (
        !questionTimes[13] &&
        (clean.includes('1番') || clean.includes('１番')) &&
        currentT >= 1200 &&
        currentT < 1550
      ) {
        questionTimes[13] = Math.round(currentT)
      } else if (
        !questionTimes[14] &&
        (clean.includes('2番') || clean.includes('２番')) &&
        currentT >= 1300 &&
        currentT < 1650
      ) {
        questionTimes[14] = Math.round(currentT)
      } else if (
        !questionTimes[15] &&
        (clean.includes('3番') || clean.includes('３番')) &&
        currentT >= 1400 &&
        currentT < 1750
      ) {
        questionTimes[15] = Math.round(currentT)
      }
      // Mondai 4 (Q16-Q19)
      else if (
        !questionTimes[16] &&
        (clean.includes('1番') || clean.includes('１番')) &&
        currentT >= 1550 &&
        currentT < 1850
      ) {
        questionTimes[16] = Math.round(currentT)
      } else if (
        !questionTimes[17] &&
        (clean.includes('2番') || clean.includes('２番')) &&
        currentT >= 1600 &&
        currentT < 1900
      ) {
        questionTimes[17] = Math.round(currentT)
      } else if (
        !questionTimes[18] &&
        (clean.includes('3番') || clean.includes('３番')) &&
        currentT >= 1650 &&
        currentT < 1950
      ) {
        questionTimes[18] = Math.round(currentT)
      } else if (
        !questionTimes[19] &&
        (clean.includes('4番') || clean.includes('４番')) &&
        currentT >= 1700 &&
        currentT < 2000
      ) {
        questionTimes[19] = Math.round(currentT)
      }
      // Mondai 5 (Q20-Q28)
      else if (
        !questionTimes[20] &&
        passedM5 &&
        (clean.includes('1番') || clean.includes('１番') || clean.includes('番')) &&
        currentT >= 1740 &&
        currentT < 2050
      ) {
        questionTimes[20] = Math.round(currentT)
      } else if (
        !questionTimes[21] &&
        (clean.includes('2番') || clean.includes('２番')) &&
        currentT >= 1800 &&
        currentT < 2100
      ) {
        questionTimes[21] = Math.round(currentT)
      } else if (
        !questionTimes[22] &&
        (clean.includes('3番') || clean.includes('３番')) &&
        currentT >= 1830 &&
        currentT < 2150
      ) {
        questionTimes[22] = Math.round(currentT)
      } else if (
        !questionTimes[23] &&
        (clean.includes('4番') || clean.includes('４番')) &&
        currentT >= 1860 &&
        currentT < 2200
      ) {
        questionTimes[23] = Math.round(currentT)
      } else if (
        !questionTimes[24] &&
        (clean.includes('5番') || clean.includes('５番')) &&
        currentT >= 1890 &&
        currentT < 2250
      ) {
        questionTimes[24] = Math.round(currentT)
      } else if (
        !questionTimes[25] &&
        (clean.includes('6番') || clean.includes('６番')) &&
        currentT >= 1920 &&
        currentT < 2300
      ) {
        questionTimes[25] = Math.round(currentT)
      } else if (
        !questionTimes[26] &&
        (clean.includes('7番') || clean.includes('７番')) &&
        currentT >= 1950 &&
        currentT < 2350
      ) {
        questionTimes[26] = Math.round(currentT)
      } else if (
        !questionTimes[27] &&
        (clean.includes('8番') || clean.includes('８番')) &&
        currentT >= 1990 &&
        currentT < 2400
      ) {
        questionTimes[27] = Math.round(currentT)
      } else if (
        !questionTimes[28] &&
        (clean.includes('9番') || clean.includes('９番')) &&
        currentT >= 2020 &&
        currentT < 2450
      ) {
        questionTimes[28] = Math.round(currentT)
      }
    }
  }

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
  console.log(`🎉 Đồng bộ thành công đề thi [${exam.title}]!`)
}
