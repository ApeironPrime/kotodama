import fs from 'node:fs'

const data = JSON.parse(fs.readFileSync('data/n3_202407_transcripts.json', 'utf-8'))
const master = JSON.parse(fs.readFileSync('data/jlpt_full_master.json', 'utf-8'))
const exam = master.find((e) => e.id === 'cm2u2yale01jo134i8wwru1oo-listening')

console.log('Exam found:', exam?.title)

// Flatten all segments and sort by absStart
const allSegments = []
for (const chunk of data) {
  for (const s of chunk.segments || []) {
    if (s && s.ja) allSegments.push(s)
  }
}
allSegments.sort((a, b) => a.absStart - b.absStart)

console.log('\n--- TẤT CẢ DẤU MỐC TRONG AUDIO N3 07/2024 ---')
for (const s of allSegments) {
  const text = s.ja || ''
  if (
    text.includes('問題') ||
    text.includes('番') ||
    text.includes('男の人') ||
    text.includes('女の人') ||
    text.includes('学生') ||
    text.includes('アナウンサー')
  ) {
    const mm = Math.floor(s.absStart / 60)
    const ss = Math.floor(s.absStart % 60)
    const timeStr = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
    console.log(`[${timeStr}] (${s.absStart}s): ${text}`)
  }
}
