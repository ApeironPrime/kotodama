import fs from 'node:fs'

const masterPath = 'data/jlpt_full_master.json'
const master = JSON.parse(fs.readFileSync(masterPath, 'utf-8'))
const exam = master.find((e) => e.id === 'cm2u2yale01jo134i8wwru1oo-listening')

if (!exam) {
  console.error('Exam cm2u2yale01jo134i8wwru1oo-listening not found!')
  process.exit(1)
}

// 1. Set local high-speed audio URL
exam.audioUrl = '/audio/jlpt/jlpt-n3-2024-07.mp3'

// 2. Exact start and end seconds per question
const exactMap = {
  // Mondai 1 (Q1 - Q6)
  1: { start: 0, end: 122 },
  2: { start: 122, end: 156 },
  3: { start: 156, end: 244 },
  4: { start: 244, end: 334 },
  5: { start: 334, end: 415 },
  6: { start: 415, end: 482 },

  // Mondai 2 (Q7 - Q12)
  7: { start: 482, end: 595 },
  8: { start: 595, end: 714 },
  9: { start: 714, end: 825 },
  10: { start: 825, end: 929 },
  11: { start: 929, end: 1092 },
  12: { start: 1092, end: 1156 },

  // Mondai 3 (Q13 - Q15)
  13: { start: 1156, end: 1261 },
  14: { start: 1261, end: 1347 },
  15: { start: 1347, end: 1441 },

  // Mondai 4 (Q16 - Q19)
  16: { start: 1441, end: 1478 },
  17: { start: 1478, end: 1518 },
  18: { start: 1518, end: 1555 },
  19: { start: 1555, end: 1588 },

  // Mondai 5 (Q20 - Q28)
  20: { start: 1588, end: 1625 },
  21: { start: 1625, end: 1652 },
  22: { start: 1652, end: 1682 },
  23: { start: 1682, end: 1714 },
  24: { start: 1714, end: 1744 },
  25: { start: 1744, end: 1779 },
  26: { start: 1779, end: 1817 },
  27: { start: 1817, end: 1849 },
  28: { start: 1849, end: 1886 },
}

let qGlobal = 1
for (const part of exam.parts || []) {
  for (const q of part.questions || []) {
    const timing = exactMap[qGlobal]
    if (timing) {
      q.audioStart = timing.start
      q.audioEnd = timing.end
    }
    qGlobal++
  }
}

fs.writeFileSync(masterPath, JSON.stringify(master, null, 2), 'utf-8')
console.log('🎉 Đã cập nhật 100% mốc thời gian âm thanh chính xác tuyệt đối cho đề thi JLPT N3 07/2024!')
