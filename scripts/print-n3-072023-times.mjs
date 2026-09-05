import fs from 'node:fs'

const master = JSON.parse(fs.readFileSync('data/jlpt_full_master.json', 'utf-8'))
const exam = master.find((e) => e.id === 'cm2u2y1xl01d2134ilubjx79d-listening')

console.log('Title:', exam?.title)
console.log('AudioUrl:', exam?.audioUrl)
let qGlobal = 1
for (const p of exam?.parts || []) {
  for (const q of p.questions || []) {
    const mm = Math.floor(q.audioStart / 60)
    const ss = Math.floor(q.audioStart % 60)
    console.log(`  Câu ${qGlobal}: ${q.audioStart}s (${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')})`)
    qGlobal++
  }
}
