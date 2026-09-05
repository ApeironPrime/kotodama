import fs from 'node:fs'

const data = JSON.parse(fs.readFileSync('data/jlpt_full_master.json', 'utf-8'))
const n3Listening = data.filter(
  (e) => e.level === 'N3' && (e.section === 'listening' || e.sectionLabelJP?.includes('聴解'))
)

console.log(`Total N3 listening exams: ${n3Listening.length}`)
n3Listening.forEach((e, idx) => {
  console.log(`${idx + 1}. [${e.id}] ${e.title} (Year: ${e.year}, Session: ${e.session}) -> Audio: ${e.audioUrl}`)
})
