import fs from 'node:fs'

const vtt = fs.readFileSync('tmp/yt_n3_202407.ja.vtt', 'utf-8')
const lines = vtt.split(/\r?\n/)

console.log('--- AUTO SUBTITLES FROM YOUTUBE (N3 07/2024) ---')

let currentTimestamp = ''
for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  if (line.includes('-->')) {
    currentTimestamp = line.split('-->')[0].trim()
  } else if (
    line.includes('問題') ||
    line.includes('1番') ||
    line.includes('2番') ||
    line.includes('3番') ||
    line.includes('4番') ||
    line.includes('5番') ||
    line.includes('6番') ||
    line.includes('7番') ||
    line.includes('8番') ||
    line.includes('9番') ||
    line.includes('一番') ||
    line.includes('二番')
  ) {
    console.log(`[${currentTimestamp}]: ${line.trim()}`)
  }
}
