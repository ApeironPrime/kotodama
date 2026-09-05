import fs from 'node:fs'

function applyTimestamps() {
  const masterPath = 'data/jlpt_full_master.json'
  const master = JSON.parse(fs.readFileSync(masterPath, 'utf-8'))
  const exam = master.find((e) => e.id === 'cm2u2y69r01gd134iqiw21op8-listening')

  if (!exam) {
    console.error('Exam cm2u2y69r01gd134iqiw21op8-listening not found!')
    return
  }

  // Update audioUrl to local file served via Vite/backend
  exam.audioUrl = '/audio/jlpt/jlpt-n3-2023-12.mp3'

  if (!fs.existsSync('data/n3_202312_full_transcripts.json')) {
    console.warn('Transcript file not ready yet.')
    return
  }

  const transcripts = JSON.parse(fs.readFileSync('data/n3_202312_full_transcripts.json', 'utf-8'))
  console.log(`Loaded ${transcripts.length} chunk transcripts.`)

  // Parse all text and find question markers
  // Helper to extract mm:ss / ss from timestamp string like [0m38s] or [38s] or [1m12s]
  function parseRelSec(str) {
    const mMatch = str.match(/(\d+)m\s*(\d+(?:\.\d+)?)s/)
    if (mMatch) return Number(mMatch[1]) * 60 + Number(mMatch[2])
    const sMatch = str.match(/(\d+(?:\.\d+)?)s/)
    if (sMatch) return Number(sMatch[1])
    return 0
  }

  for (const chunk of transcripts) {
    const lines = chunk.text.split('\n')
    for (const line of lines) {
      const timeMatch = line.match(/\[\s*([^\]]+?)\s*-\s*([^\]]+?)\s*\]/)
      if (timeMatch) {
        const relStart = parseRelSec(timeMatch[1])
        const absStart = Math.round(chunk.startSec + relStart)
        const content = line.slice(timeMatch[0].length).trim()

        // Check markers
        // Mondai 1: 1番 ... 6番
        // Mondai 2: 1番 ... 6番
        // Mondai 3: 1番 ... 3番
        // Mondai 4: 1番 ... 4番
        // Mondai 5: 1番 ... 9番
        console.log(
          `[${absStart}s (${Math.floor(absStart / 60)}:${String(absStart % 60).padStart(2, '0')})] ${content.slice(0, 80)}`
        )
      }
    }
  }
}

applyTimestamps()
