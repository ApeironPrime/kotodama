import fs from 'node:fs'

const env = fs.readFileSync('.env', 'utf-8')
const apiKey = env.match(/GEMINI_API_KEY=([^\r\n]+)/)[1].trim()

const fileUri = 'https://generativelanguage.googleapis.com/v1beta/files/q8t78en9a8xv'

async function analyzeTimestamps() {
  console.log('Requesting exact question timestamps from Gemini...')
  const models = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.5-flash']

  for (const model of models) {
    try {
      console.log(`Trying model: ${model}...`)
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    fileData: {
                      mimeType: 'audio/mp3',
                      fileUri: fileUri,
                    },
                  },
                  {
                    text: `This is the official Japanese JLPT N3 listening exam audio (12/2023 - 42 minutes).
Please listen carefully and extract the precise start timestamp for each question and each section:
Section 1: 問題1 (Mondai 1: 課題理解) - Questions 1 to 6
Section 2: 問題2 (Mondai 2: ポイント理解) - Questions 1 to 6 (Questions 7 to 12)
Section 3: 問題3 (Mondai 3: 概要理解) - Questions 1 to 3 (Questions 13 to 15)
Section 4: 問題4 (Mondai 4: 発話表現) - Questions 1 to 4 (Questions 16 to 19)
Section 5: 問題5 (Mondai 5: 即時応答) - Questions 1 to 9 (Questions 20 to 28)

For EVERY single question (from Question 1 to Question 28), return the EXACT start timestamp in seconds (startSec) and mm:ss format (startTime), and also identify each dialogue line start timestamp if possible.

Format output as valid JSON:
{
  "questions": [
    {
      "globalNumber": 1,
      "mondai": 1,
      "mondaiQuestionNumber": 1,
      "startSec": 52,
      "endSec": 150,
      "startTime": "00:52",
      "endTime": "02:30",
      "firstWordsJa": "..."
    }
  ]
}`,
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.1,
            },
          }),
        }
      )

      if (!res.ok) {
        console.warn(`Model ${model} failed with status ${res.status}: ${await res.text()}`)
        continue
      }

      const data = await res.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text
      if (text) {
        console.log('Received timestamp analysis!')
        fs.writeFileSync('data/n3_202312_exact_timestamps.json', text, 'utf-8')
        console.log('Saved to data/n3_202312_exact_timestamps.json')
        return JSON.parse(text)
      }
    } catch (e) {
      console.warn(`Error with ${model}:`, e)
    }
  }
}

analyzeTimestamps()
  .then((res) => {
    console.log('Total questions analyzed:', res?.questions?.length)
    console.log('Questions:', res?.questions)
  })
  .catch(console.error)
