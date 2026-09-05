import { chromium } from 'playwright'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()
  await page.goto('https://corodomo.com/practice/exams/jlpt?id=cm2u2y69r01gd134iqiw21op8', {
    waitUntil: 'networkidle',
  })

  const data = await page.evaluate(async () => {
    const r2 = await fetch('/api/exam/question?examId=cm2u2y69r01gd134iqiw21op8')
    const j2 = await r2.json()

    // Also let's check how the page renders the audio!
    const scripts = Array.from(document.querySelectorAll('script')).map((s) => s.innerText)
    const audioUrls = []
    scripts.forEach((txt) => {
      const matches = txt.match(/https:\/\/[^"'\s]+\.mp3/gi)
      if (matches) audioUrls.push(...matches)
    })

    return { questions: j2.data, audioUrls }
  })

  console.log('Total questions:', data.questions?.length)
  console.log('Audio URLs found:', data.audioUrls)

  // Check how many questions have script
  const withScript = data.questions.filter((q) => q.script)
  console.log('Questions with script (Listening transcript):', withScript.length)

  // Check how many questions have image in question HTML
  const withImg = data.questions.filter((q) => q.question && q.question.includes('<img'))
  console.log('Questions with image:', withImg.length)
  withImg.forEach((q, i) => {
    console.log(`Image Q${i + 1}:`, q.question)
  })

  if (withScript.length > 0) {
    console.log('Sample Listening Question 1:')
    console.log('Question:', withScript[0].question)
    console.log('Options:', withScript[0].options)
    console.log('CorrectAnswer:', withScript[0].correctAnswer)
    console.log('Script:', withScript[0].script)
  }

  await browser.close()
}

main()
