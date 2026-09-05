import fs from 'node:fs'

const vtt = fs.readFileSync('tmp/yt_n3_202407.ja.vtt', 'utf-8')
const lines = vtt.split(/\r?\n/)

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

const markers = []
let currentT = 0
for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  if (line.includes('-->')) {
    const startStr = line.split('-->')[0].trim()
    currentT = parseTime(startStr)
  } else if (line.trim()) {
    const cleanText = line.replace(/<[^>]+>/g, '').trim()
    if (
      cleanText.includes('問題') ||
      cleanText.includes('1番') ||
      cleanText.includes('2番') ||
      cleanText.includes('3番') ||
      cleanText.includes('4番') ||
      cleanText.includes('5番') ||
      cleanText.includes('6番') ||
      cleanText.includes('7番') ||
      cleanText.includes('8番') ||
      cleanText.includes('9番') ||
      cleanText.includes('一番') ||
      cleanText.includes('二番') ||
      cleanText.includes('三番') ||
      cleanText.includes('四番') ||
      cleanText.includes('五番') ||
      cleanText.includes('六番') ||
      cleanText.includes('七番') ||
      cleanText.includes('八番') ||
      cleanText.includes('九番') ||
      cleanText.includes('例')
    ) {
      markers.push({ time: currentT, text: cleanText })
    }
  }
}

console.log(`Tìm thấy ${markers.length} markers từ phụ đề YouTube video 07/2024!`)
markers.forEach((m) => {
  const mm = Math.floor(m.time / 60)
  const ss = Math.floor(m.time % 60)
  console.log(`[${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}] (${Math.round(m.time)}s): ${m.text}`)
})
