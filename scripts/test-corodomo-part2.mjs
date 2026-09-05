import { chromium } from 'playwright'

async function testPart2() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  page.on('response', async (res) => {
    const url = res.url()
    if (url.includes('/api/')) {
      console.log('API Hit:', url)
    }
  })

  await page.goto('https://corodomo.com/practice/exams/jlpt?id=cm2u2y69r01gd134iqiw21op8', {
    waitUntil: 'networkidle',
  })

  // Click Nộp bài
  const submitBtn = page.getByRole('button', { name: 'Nộp bài' })
  await submitBtn.click()
  await page.waitForTimeout(1000)

  // Click confirmation modal button if any
  const modalButtons = await page.locator('button').all()
  for (const btn of modalButtons) {
    const txt = (await btn.innerText()).trim()
    if (txt === 'Xác nhận' || txt === 'Đồng ý' || txt === 'Nộp bài') {
      try {
        await btn.click()
        break
      } catch {}
    }
  }

  await page.waitForTimeout(3000)
  console.log('URL after submit:', page.url())

  // Look for Part 2 button or next section button
  const continueButtons = await page.locator('button, a').all()
  for (const btn of continueButtons) {
    const txt = (await btn.innerText()).trim()
    if (txt.includes('Phần 2') || txt.includes('tiếp theo') || txt.includes('nghe') || txt.includes('Bắt đầu')) {
      console.log('Clicking button:', txt)
      try {
        await btn.click()
        await page.waitForTimeout(3000)
        break
      } catch {}
    }
  }

  console.log('Final URL:', page.url())

  const result = await page.evaluate(() => {
    const audios = Array.from(document.querySelectorAll('audio, source'))
      .map((a) => a.src || a.getAttribute('src'))
      .filter(Boolean)
    const images = Array.from(document.querySelectorAll('img'))
      .map((i) => i.src)
      .filter((s) => s && !s.includes('google') && !s.includes('facebook') && !s.includes('icon'))
    const questionBoxes = Array.from(document.querySelectorAll('.question, [class*="question"]')).map((el) =>
      el.innerText.slice(0, 100)
    )
    return { audios, images, questionBoxes, bodySnippet: document.body.innerText.slice(0, 800) }
  })

  console.log('Listening result:', JSON.stringify(result, null, 2))
  await page.screenshot({ path: 'corodomo_listening.png' })
  await browser.close()
}

testPart2()
