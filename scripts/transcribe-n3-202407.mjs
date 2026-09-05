import fs from 'node:fs'

const apiKey = process.env.GEMINI_API_KEY || 'AQ.Ab8RN6LxR69ay69KW6grJFvdK4IMtSSGjfTPLf6zVVc0HJLbLw'
const model = 'gemini-3.5-flash-lite'

async function transcribeChunk(chunk) {
  const audioBuffer = fs.readFileSync(chunk.chunkFile)
  const base64 = audioBuffer.toString('base64')

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`

  const payload = {
    contents: [
      {
        parts: [
          {
            text: `You are transcribing a JLPT N3 Japanese listening exam audio chunk with start offset ${chunk.start}s.
Transcribe each spoken dialogue line, question number announcement ("1番", "2番", "3番", "4番", "5番", "6番", "問題1", "問題2", "問題3", "問題4", "問題5"), and answer options.
Return valid JSON format matching:
{
  "segments": [
    { "start": 5.2, "end": 10.4, "text": "問題1。問題1では、まず質問を聞いてください。" },
    { "start": 42.1, "end": 48.6, "text": "1番。大学で男の学生と女の学生が話しています。" }
  ]
}
Values of start and end MUST be in seconds relative to this chunk (e.g. 12.3).`,
          },
          {
            inline_data: {
              mime_type: 'audio/mp3',
              data: base64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      response_mime_type: 'application/json',
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Gemini API error ${res.status}: ${errText}`)
  }

  const json = await res.json()
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
  return JSON.parse(text)
}

async function run() {
  const chunksMeta = JSON.parse(fs.readFileSync('data/n3_202407_chunks_meta.json', 'utf-8'))
  console.log(`Bắt đầu bóc tách ASR cho ${chunksMeta.length} chunks...`)

  const results = []

  for (let i = 0; i < chunksMeta.length; i++) {
    const chunk = chunksMeta[i]
    console.log(`[${i + 1}/${chunksMeta.length}] Đang xử lý: ${chunk.start}s -> ${chunk.end}s...`)

    try {
      const data = await transcribeChunk(chunk)
      const segments = data.segments || []
      const mapped = segments.map((s) => ({
        relStart: s.start,
        relEnd: s.end,
        absStart: Math.round(chunk.start + s.start),
        absEnd: Math.round(chunk.start + s.end),
        ja: s.text,
      }))
      results.push({ chunkIdx: i, start: chunk.start, end: chunk.end, segments: mapped })
      console.log(` -> Tìm thấy ${mapped.length} câu thoại.`)
    } catch (err) {
      console.error(`Lỗi chunk ${i}:`, err.message)
      results.push({ chunkIdx: i, start: chunk.start, end: chunk.end, segments: [] })
    }

    await new Promise((r) => setTimeout(r, 600))
  }

  fs.writeFileSync('data/n3_202407_transcripts.json', JSON.stringify(results, null, 2), 'utf-8')
  console.log('🎉 Hoàn tất bóc tách toàn bộ 18 phân đoạn âm thanh N3 07/2024!')
}

run().catch(console.error)
