import fs from 'node:fs'

const lines = JSON.parse(fs.readFileSync('data/deduped_lines_202312.json', 'utf-8'))
for (const l of lines) {
  if (l.text.includes('番') || l.text.includes('問題') || l.text.includes('例')) {
    const m = Math.floor(l.absStart / 60)
    const s = String(l.absStart % 60).padStart(2, '0')
    console.log(`[${m}:${s} (${l.absStart}s)] ${l.text}`)
  }
}
