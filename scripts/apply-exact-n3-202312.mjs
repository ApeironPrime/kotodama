import fs from 'node:fs'

const master = JSON.parse(fs.readFileSync('data/jlpt_full_master.json', 'utf-8'))
const exam = master.find((e) => e.id === 'cm2u2y69r01gd134iqiw21op8-listening')

console.log('Searching exact question dialogue lines...')

const exactTimestamps = [
  // Mondai 1 (Q1-Q6)
  { num: 1, start: 187 },
  { num: 2, start: 273 },
  { num: 3, start: 361 },
  { num: 4, start: 443 },
  { num: 5, start: 532 },
  { num: 6, start: 615 },
  // Mondai 2 (Q7-Q12)
  { num: 7, start: 843 },
  { num: 8, start: 942 },
  { num: 9, start: 1042 },
  { num: 10, start: 1161 },
  { num: 11, start: 1275 },
  { num: 12, start: 1385 },
  // Mondai 3 (Q13-Q15)
  { num: 13, start: 1654 },
  { num: 14, start: 1743 },
  { num: 15, start: 1823 },
  // Mondai 4 (Q16-Q19)
  { num: 16, start: 1998 },
  { num: 17, start: 2035 },
  { num: 18, start: 2072 },
  { num: 19, start: 2110 },
  // Mondai 5 (Q20-Q28)
  { num: 20, start: 2230 },
  { num: 21, start: 2261 },
  { num: 22, start: 2293 },
  { num: 23, start: 2326 },
  { num: 24, start: 2359 },
  { num: 25, start: 2389 },
  { num: 26, start: 2422 },
  { num: 27, start: 2452 },
  { num: 28, start: 2482 },
]

// Update exam with audioUrl and exact question timestamps
exam.audioUrl = '/audio/jlpt/jlpt-n3-2023-12.mp3'

let gIdx = 0
for (const part of exam.parts) {
  for (const q of part.questions) {
    const ts = exactTimestamps[gIdx]
    if (ts) {
      q.audioStart = ts.start
      const nextTs = exactTimestamps[gIdx + 1]
      q.audioEnd = nextTs ? nextTs.start : ts.start + 60

      // Update dialogue segments timestamps proportionally if present
      if (q.audioSegments && q.audioSegments.length > 0) {
        const segDuration = (q.audioEnd - q.audioStart) / q.audioSegments.length
        q.audioSegments.forEach((seg, sIdx) => {
          seg.start = Math.round(q.audioStart + sIdx * segDuration)
          seg.end = Math.round(q.audioStart + (sIdx + 1) * segDuration)
        })
      }
    }
    gIdx++
  }
}

fs.writeFileSync('data/jlpt_full_master.json', JSON.stringify(master, null, 2), 'utf-8')
console.log('✓ Successfully applied custom audio file and exact audio timestamps to JLPT N3 12/2023 Listening Exam!')
