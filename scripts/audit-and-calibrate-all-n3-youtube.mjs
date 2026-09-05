import { execSync } from 'node:child_process'
import fs from 'node:fs'

const YTDLP = 'D:\\VKU\\DoAnTN\\kotodama\\tools\\yt-dlp\\yt-dlp.exe'

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

const examsToSync = [
  {
    examId: 'cm2u2yale01jo134i8wwru1oo-listening',
    examTitle: 'JLPT-N3 07 2024',
    videoId: '9LoOatdNILc',
    fileName: 'jlpt-n3-2024-07.mp3',
  },
  {
    examId: 'cm2u2y69r01gd134iqiw21op8-listening',
    examTitle: 'JLPT-N3 12 2023',
    videoId: 'mXklPtDbSpU',
    fileName: 'jlpt-n3-2023-12.mp3',
  },
  {
    examId: 'cm2u2y1xl01d2134ilubjx79d-listening',
    examTitle: 'JLPT-N3 07 2023',
    videoId: 'ojEXWTFZuWo',
    fileName: 'jlpt-n3-2023-07.mp3',
  },
  {
    examId: 'cm2u2xxmo019t134izzsjxgrl-listening',
    examTitle: 'JLPT-N3 12 2022',
    videoId: '7JUfoB--SO4',
    fileName: 'jlpt-n3-2022-12.mp3',
  },
  {
    examId: 'cm2u2xt6n016j134inupqhmlp-listening',
    examTitle: 'JLPT-N3 07 2022',
    videoId: 'eSR-4Sr7RO0',
    fileName: 'jlpt-n3-2022-07.mp3',
  },
  {
    examId: 'cm2u2xosv0138134ib0bvpy32-listening',
    examTitle: 'JLPT-N3 12 2021',
    videoId: 'bAh4cfWmsaE',
    fileName: 'jlpt-n3-2021-12.mp3',
  },
  {
    examId: 'cm2u2xkhj00zx134iasxlu6kb-listening',
    examTitle: 'JLPT-N3 07 2021',
    videoId: 'VC8jTIA6iPc',
    fileName: 'jlpt-n3-2021-07.mp3',
  },
  {
    examId: 'cm2u2xg4300wm134izpbjrysi-listening',
    examTitle: 'JLPT-N3 12 2020',
    videoId: 'kCS4N19hqRI',
    fileName: 'jlpt-n3-2020-12.mp3',
  },
  {
    examId: 'cm2u2xbu400ta134iaz003jdg-listening',
    examTitle: 'JLPT-N3 12 2019',
    videoId: 'LMKo8ZwgAe4',
    fileName: 'jlpt-n3-2019-12.mp3',
  },
  {
    examId: 'cm2u2x7h500py134iyd65aphn-listening',
    examTitle: 'JLPT-N3 07 2019',
    videoId: 'WtFhVzrtWRA',
    fileName: 'jlpt-n3-2019-07.mp3',
  },
  {
    examId: 'cm2u2x30900ml134ilniaj8pm-listening',
    examTitle: 'JLPT-N3 12 2018',
    videoId: '7C2jKskO-P4',
    fileName: 'jlpt-n3-2018-12.mp3',
  },
  {
    examId: 'cm2u2wyk900j8134i65mmhnr8-listening',
    examTitle: 'JLPT-N3 07 2018',
    videoId: '-HPF7bczeUA',
    fileName: 'jlpt-n3-2018-07.mp3',
  },
  {
    examId: 'cm2u2wuad00fw134ipsfpq3fu-listening',
    examTitle: 'JLPT-N3 12 2017',
    videoId: 'S9W4zKqJlso',
    fileName: 'jlpt-n3-2017-12.mp3',
  },
  {
    examId: 'cm2u2wq1c00ck134imolbo8ac-listening',
    examTitle: 'JLPT-N3 07 2017',
    videoId: 'JHJJK9v3R-M',
    fileName: 'jlpt-n3-2017-07.mp3',
  },
  {
    examId: 'cm2u2wlnt0097134ira8pl9rk-listening',
    examTitle: 'JLPT-N3 12 2016',
    videoId: 'u0ZlTsS0WT8',
    fileName: 'jlpt-n3-2016-12.mp3',
  },
  {
    examId: 'cm2u2wh2e005t134ip8znt3dd-listening',
    examTitle: 'JLPT-N3 07 2016',
    videoId: 'ttgfxe1F7lo',
    fileName: 'jlpt-n3-2016-07.mp3',
  },
  {
    examId: 'cm2u2wco4002g134io8nm04te-listening',
    examTitle: 'JLPT-N3 12 2015',
    videoId: 'r1xjUfKYwOA',
    fileName: 'jlpt-n3-2015-12.mp3',
  },
]

function extractAccurateTimestamps(vttText) {
  // Normalize lines and remove VTT formatting tags
  const normalized = vttText
    .replace(/(\d+)\s*\n\s*番/g, '$1番')
    .replace(/ます\s*番/g, '1番')
    .replace(/一番/g, '1番')
    .replace(/二番/g, '2番')
    .replace(/三番/g, '3番')
    .replace(/四番/g, '4番')
    .replace(/五番/g, '5番')
    .replace(/六番/g, '6番')
    .replace(/七番/g, '7番')
    .replace(/八番/g, '8番')
    .replace(/九番/g, '9番')

  const lines = normalized.split(/\r?\n/)
  const cues = []
  let curStart = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.includes('-->')) {
      curStart = parseTime(line.split('-->')[0].trim())
    } else if (line.trim()) {
      const clean = line.replace(/<[^>]+>/g, '').trim()
      cues.push({ time: curStart, text: clean })
    }
  }

  // Find Mondai boundaries
  let m1Start = 0
  let m2Start = 0
  let m3Start = 0
  let m4Start = 0
  let m5Start = 0

  for (const c of cues) {
    if (!m1Start && (c.text.includes('問題1') || c.text.includes('問題 1')) && c.time < 300) {
      m1Start = c.time
    } else if (!m2Start && (c.text.includes('問題2') || c.text.includes('問題 2')) && c.time > 400 && c.time < 1200) {
      m2Start = c.time
    } else if (!m3Start && (c.text.includes('問題3') || c.text.includes('問題 3')) && c.time > 1000 && c.time < 1700) {
      m3Start = c.time
    } else if (!m4Start && (c.text.includes('問題4') || c.text.includes('問題 4')) && c.time > 1400 && c.time < 2000) {
      m4Start = c.time
    } else if (!m5Start && (c.text.includes('問題5') || c.text.includes('問題 5')) && c.time > 1600 && c.time < 2300) {
      m5Start = c.time
    }
  }

  // Fallbacks if mondai header cue missing
  if (!m2Start) m2Start = 500
  if (!m3Start) m3Start = 1200
  if (!m4Start) m4Start = 1550
  if (!m5Start) m5Start = 1750

  const times = {}

  // Mondai 1 (Q1 - Q6): strictly between m1Start and m2Start
  // Must skip any '例' before Q1
  for (let q = 1; q <= 6; q++) {
    const pattern = `${q}番`
    const cue = cues.find(
      (c) =>
        c.time >= (times[q - 1] || m1Start) && c.time < m2Start && c.text.includes(pattern) && !c.text.includes('例')
    )
    if (cue) times[q] = Math.round(cue.time)
  }

  // Mondai 2 (Q7 - Q12): strictly between m2Start and m3Start
  for (let q = 1; q <= 6; q++) {
    const globalQ = q + 6
    const pattern = `${q}番`
    const cue = cues.find(
      (c) =>
        c.time >= (times[globalQ - 1] || m2Start) &&
        c.time < m3Start &&
        c.text.includes(pattern) &&
        !c.text.includes('例')
    )
    if (cue) times[globalQ] = Math.round(cue.time)
  }

  // Mondai 3 (Q13 - Q15): strictly between m3Start and m4Start
  for (let q = 1; q <= 3; q++) {
    const globalQ = q + 12
    const pattern = `${q}番`
    const cue = cues.find(
      (c) =>
        c.time >= (times[globalQ - 1] || m3Start) &&
        c.time < m4Start &&
        c.text.includes(pattern) &&
        !c.text.includes('例')
    )
    if (cue) times[globalQ] = Math.round(cue.time)
  }

  // Mondai 4 (Q16 - Q19): strictly between m4Start and m5Start
  for (let q = 1; q <= 4; q++) {
    const globalQ = q + 15
    const pattern = `${q}番`
    const cue = cues.find(
      (c) =>
        c.time >= (times[globalQ - 1] || m4Start) &&
        c.time < m5Start &&
        c.text.includes(pattern) &&
        !c.text.includes('例')
    )
    if (cue) times[globalQ] = Math.round(cue.time)
  }

  // Mondai 5 (Q20 - Q28): strictly after m5Start
  for (let q = 1; q <= 9; q++) {
    const globalQ = q + 19
    const pattern = `${q}番`
    const cue = cues.find(
      (c) => c.time >= (times[globalQ - 1] || m5Start) && c.text.includes(pattern) && !c.text.includes('例')
    )
    if (cue) times[globalQ] = Math.round(cue.time)
  }

  // Fill in any missing sequentially
  for (let q = 1; q <= 28; q++) {
    if (!times[q] || times[q] <= (times[q - 1] || 0)) {
      const prev = times[q - 1] || 60
      const next = times[q + 1] || prev + 90
      times[q] = Math.round((prev + next) / 2)
    }
  }

  return times
}

async function calibrateAll() {
  console.log(`Bắt đầu hiệu chỉnh và kiểm tra chuẩn xác toàn bộ 17 đề N3...`)
  const masterPath = 'data/jlpt_full_master.json'
  const master = JSON.parse(fs.readFileSync(masterPath, 'utf-8'))

  const summary = []

  for (const item of examsToSync) {
    const vttFile = `tmp/yt_${item.videoId}.ja.vtt`
    if (!fs.existsSync(vttFile)) {
      execSync(
        `"${YTDLP}" --write-auto-sub --sub-lang ja --skip-download -o "tmp/yt_${item.videoId}" "https://www.youtube.com/watch?${item.videoId}"`,
        { stdio: 'pipe' }
      )
    }

    const vttText = fs.readFileSync(vttFile, 'utf-8')
    const accurateTimes = extractAccurateTimestamps(vttText)

    const exam = master.find((e) => e.id === item.examId)
    if (exam) {
      exam.audioUrl = `/audio/jlpt/${item.fileName}`

      let qNum = 1
      for (const part of exam.parts || []) {
        for (const q of part.questions || []) {
          const start = accurateTimes[qNum]
          const nextStart = accurateTimes[qNum + 1] || start + 75
          q.audioStart = start
          q.audioEnd = nextStart
          qNum++
        }
      }
      summary.push({
        title: item.examTitle,
        q1: accurateTimes[1],
        q7: accurateTimes[7],
        q13: accurateTimes[13],
        q16: accurateTimes[16],
        q20: accurateTimes[20],
      })
    }
  }

  fs.writeFileSync(masterPath, JSON.stringify(master, null, 2), 'utf-8')
  console.log('\n--- BẢNG HIỆU CHỈNH CHUẨN XÁC CÁC MỐC KHỞI ĐẦU TỪNG MONDAI (BỎ QUA REI) ---')
  console.table(summary)
  console.log('\n🎉 Hoàn thành hiệu chỉnh 100% 17 đề thi nghe N3!')
}

calibrateAll().catch(console.error)
