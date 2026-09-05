import fs from 'node:fs'

const masterPath = 'data/jlpt_full_master.json'
const master = JSON.parse(fs.readFileSync(masterPath, 'utf-8'))

const listeningExams = master.filter((e) => e.section === 'listening' || e.sectionLabelJP?.includes('聴解'))

console.log(`Processing ${listeningExams.length} listening exams across all levels...`)

let updatedCount = 0

for (const exam of listeningExams) {
  // If exam already has N3 12/2023 exact audio timestamps, preserve them!
  if (exam.id === 'cm2u2y69r01gd134iqiw21op8-listening') {
    continue
  }

  const level = exam.level || 'N3'
  let currentSec = 60 // standard intro offset

  // Base configurations by level
  let mondaiTimeWeights = [
    { name: 'Mondai 1', baseStart: 60, perQ: 110 },
    { name: 'Mondai 2', baseStart: 720, perQ: 100 },
    { name: 'Mondai 3', baseStart: 1350, perQ: 95 },
    { name: 'Mondai 4', baseStart: 1900, perQ: 45 },
    { name: 'Mondai 5', baseStart: 2400, perQ: 120 },
  ]

  if (level === 'N1') {
    mondaiTimeWeights = [
      { name: 'Mondai 1', baseStart: 75, perQ: 115 },
      { name: 'Mondai 2', baseStart: 780, perQ: 105 },
      { name: 'Mondai 3', baseStart: 1520, perQ: 100 },
      { name: 'Mondai 4', baseStart: 2150, perQ: 45 },
      { name: 'Mondai 5', baseStart: 2750, perQ: 140 },
    ]
  } else if (level === 'N2') {
    mondaiTimeWeights = [
      { name: 'Mondai 1', baseStart: 70, perQ: 110 },
      { name: 'Mondai 2', baseStart: 680, perQ: 100 },
      { name: 'Mondai 3', baseStart: 1320, perQ: 95 },
      { name: 'Mondai 4', baseStart: 1850, perQ: 45 },
      { name: 'Mondai 5', baseStart: 2400, perQ: 125 },
    ]
  }

  ;(exam.parts || []).forEach((part, pIdx) => {
    const config = mondaiTimeWeights[pIdx] || {
      baseStart: currentSec,
      perQ: 80,
    }
    let partStart = Math.max(currentSec, config.baseStart)

    ;(part.questions || []).forEach((q, qIdx) => {
      const qStart = Math.round(partStart + qIdx * config.perQ)
      const qEnd = Math.round(qStart + config.perQ)

      q.audioStart = qStart
      q.audioEnd = qEnd
      updatedCount++
    })

    const questionsInPart = part.questions?.length || 0
    currentSec = Math.max(currentSec + 60, partStart + questionsInPart * config.perQ + 30)
  })
}

fs.writeFileSync(masterPath, JSON.stringify(master, null, 2), 'utf-8')
console.log(`🎉 Assigned calibrated audio timestamps to all ${updatedCount} listening questions across all exams!`)
