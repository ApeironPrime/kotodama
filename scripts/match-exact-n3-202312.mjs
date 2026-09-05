import fs from 'node:fs'

const master = JSON.parse(fs.readFileSync('data/jlpt_full_master.json', 'utf-8'))
const exam = master.find((e) => e.id === 'cm2u2y69r01gd134iqiw21op8-listening')
const transcripts = JSON.parse(fs.readFileSync('data/n3_202312_full_transcripts.json', 'utf-8'))

console.log('Exam Title:', exam.title)

// Helper to convert mm:ss / s string to relative seconds
function parseTimeStr(str) {
  const mMatch = str.match(/(\d+)m\s*(\d+(?:\.\d+)?)s/)
  if (mMatch) return Number(mMatch[1]) * 60 + Number(mMatch[2])
  const sMatch = str.match(/(\d+(?:\.\d+)?)s/)
  if (sMatch) return Number(sMatch[1])
  const colonMatch = str.match(/(\d+):(\d+(?:\.\d+)?)/)
  if (colonMatch) return Number(colonMatch[1]) * 60 + Number(colonMatch[2])
  return 0
}

// Build chronological list of lines with absolute timestamps
const allLines = []

for (const chunk of transcripts) {
  const lines = chunk.text.split('\n')
  for (const line of lines) {
    const timeMatch = line.match(/\[\s*([^\]]+?)\s*-\s*([^\]]+?)\s*\]/)
    if (timeMatch) {
      const relStart = parseTimeStr(timeMatch[1])
      const relEnd = parseTimeStr(timeMatch[2])
      const absStart = Math.round(chunk.startSec + relStart)
      const absEnd = Math.round(chunk.startSec + relEnd)
      const text = line.slice(timeMatch[0].length).trim()
      if (text) {
        allLines.push({
          absStart,
          absEnd,
          text,
        })
      }
    }
  }
}

// Sort lines by start time
allLines.sort((a, b) => a.absStart - b.absStart)

// Remove duplicate lines from chunk overlap
const deduplicated = []
for (const line of allLines) {
  if (!deduplicated.some((d) => Math.abs(d.absStart - line.absStart) < 3 && d.text === line.text)) {
    deduplicated.push(line)
  }
}

console.log(`Extracted ${deduplicated.length} timestamped lines across 42 minutes.`)

// Print questions markers
const questionMarkers = []
for (const line of deduplicated) {
  const m = line.text.match(/(?:問題|もんだい)\s*([1-5１-５])|(?:([1-9１-９])\s*番|番)/)
  if (m || line.text.includes('番') || line.text.includes('問題')) {
    questionMarkers.push(line)
  }
}

console.log('--- Sample Question Markers ---')
for (const qm of questionMarkers.slice(0, 30)) {
  console.log(
    `[${Math.floor(qm.absStart / 60)}:${String(qm.absStart % 60).padStart(2, '0')} (${qm.absStart}s)] ${qm.text}`
  )
}

// Now match each question in exam.parts with its exact start in deduplicated lines
exam.audioUrl = '/audio/jlpt/jlpt-n3-2023-12.mp3'

// We will find each question's script in the deduplicated lines
let currentLineIdx = 0
for (const part of exam.parts) {
  for (const q of part.questions) {
    const qNum = q.number
    const scriptFirstWords = (q.script || '').replace(/[\s\r\n\t]/g, '').slice(0, 15)

    // Search for matching line after currentLineIdx
    let matchedStart = null
    for (let i = currentLineIdx; i < deduplicated.length; i++) {
      const lineText = deduplicated[i].text.replace(/[\s\r\n\t]/g, '')
      // Check if line contains "X番" or matches script words
      const isNumMarker = deduplicated[i].text.includes(`${qNum} 番`) || deduplicated[i].text.includes(`${qNum}番`)
      const isScriptMatch = scriptFirstWords && lineText.includes(scriptFirstWords.slice(0, 8))

      if (isNumMarker || isScriptMatch) {
        matchedStart = deduplicated[i].absStart
        currentLineIdx = i
        break
      }
    }

    if (matchedStart !== null) {
      q.audioStart = matchedStart
      console.log(
        `✓ Câu ${qNum}: ${Math.floor(matchedStart / 60)}:${String(matchedStart % 60).padStart(2, '0')} (${matchedStart}s)`
      )
    } else {
      console.warn(`? Câu ${qNum} not matched directly, keeping estimated offset`)
    }
  }
}

fs.writeFileSync('data/deduped_lines_202312.json', JSON.stringify(deduplicated, null, 2), 'utf-8')
