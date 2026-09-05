import fs from 'node:fs'

const env = fs.readFileSync('.env', 'utf-8')
const apiKey = env.match(/GEMINI_API_KEY=([^\r\n]+)/)[1].trim()

async function transcribeSnippet(path) {
  const data = fs.readFileSync(path)
  const base64 = data.toString('base64')

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: 'audio/mp3',
                  data: base64,
                },
              },
              {
                text: 'Transcribe this audio in Japanese verbatim with timestamps if possible.',
              },
            ],
          },
        ],
      }),
    }
  )

  const json = await res.json()
  console.log(`=== Transcription for ${path} ===`)
  console.log(json.candidates?.[0]?.content?.parts?.[0]?.text)
}

async function main() {
  await transcribeSnippet('scratch/intro.mp3')
  await transcribeSnippet('scratch/q1_test.mp3')
}

main().catch(console.error)
