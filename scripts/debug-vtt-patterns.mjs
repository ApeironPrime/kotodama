import fs from 'node:fs'

const exams = [
  { id: 'LMKo8ZwgAe4', title: 'N3 12/2019' },
  { id: 'eSR-4Sr7RO0', title: 'N3 07/2022' },
  { id: '7C2jKskO-P4', title: 'N3 12/2018' },
  { id: 'ttgfxe1F7lo', title: 'N3 07/2016' },
  { id: 'r1xjUfKYwOA', title: 'N3 12/2015' },
  { id: 'WtFhVzrtWRA', title: 'N3 07/2019' },
  { id: 'JHJJK9v3R-M', title: 'N3 07/2017' },
]

function parseT(str) {
  const p = str.split(':')
  return parseInt(p[0]) * 3600 + parseInt(p[1]) * 60 + parseFloat(p[2])
}

function fmt(sec) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

for (const e of exams) {
  const vttPath = `tmp/yt_${e.id}.ja.vtt`
  if (!fs.existsSync(vttPath)) {
    console.log(`${e.title}: MISSING`)
    continue
  }

  const vtt = fs.readFileSync(vttPath, 'utf-8')
  const lines = vtt.split(/\r?\n/)
  let curTime = 0
  const allHits = []

  for (const line of lines) {
    if (line.includes('-->')) {
      curTime = parseT(line.split('-->')[0].trim())
    } else {
      const clean = line.replace(/<[^>]+>/g, '').trim()
      if (!clean) continue
      const m = clean.match(/([1-9])番/)
      if (m && !clean.includes('例')) {
        const num = parseInt(m[1])
        const t = Math.round(curTime)
        // Dedup within 3s
        if (!allHits.some((h) => h.num === num && Math.abs(h.time - t) < 3)) {
          allHits.push({ num, time: t })
        }
      }
    }
  }

  // Find all 1番 positions (>60s apart)
  const onePositions = []
  for (const h of allHits) {
    if (h.num === 1 && (onePositions.length === 0 || h.time - onePositions[onePositions.length - 1] > 60)) {
      onePositions.push(h.time)
    }
  }

  console.log(`\n=== ${e.title} (${e.id}) ===`)
  console.log(`1番 positions (${onePositions.length}): ${onePositions.map(fmt).join(', ')}`)
  console.log(`All hits (${allHits.length}):`)
  for (const h of allHits) {
    console.log(`  ${fmt(h.time)} [${h.num}番]`)
  }
}
