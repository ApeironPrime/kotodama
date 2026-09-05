import { chromium } from 'playwright'

async function debug() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()))
  page.on('pageerror', (err) => console.error('PAGE ERROR:', err.message, '\n', err.stack))

  await page.goto('http://127.0.0.1:5173/jlpt', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1000)

  const n3Btn = page.locator('button:has-text("Đề thi N3")').first()
  if (await n3Btn.isVisible()) await n3Btn.click()
  await page.waitForTimeout(500)

  const listeningPill = page.locator('button:has-text("Nghe hiểu")').first()
  if (await listeningPill.isVisible()) await listeningPill.click()
  await page.waitForTimeout(500)

  const enterExamBtn = page.locator('button:has-text("Vào làm bài")').first()
  await enterExamBtn.click()
  await page.waitForTimeout(1500)

  console.log('Submitting exam...')
  const submitBtn = page.locator('button:has-text("Nộp bài thi")').first()
  if (await submitBtn.isVisible()) await submitBtn.click()
  await page.waitForTimeout(1500)

  await browser.close()
}

debug().catch(console.error)
