import path from 'node:path'
import { chromium } from 'playwright'

const SCREENSHOTS_DIR = 'C:/Users/Phuc_Le/.gemini/antigravity/brain/da942045-a382-4a06-8801-52ba6c759860/screenshots'

async function run() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })
  const page = await context.newPage()

  await page.goto('http://127.0.0.1:5173/jlpt', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)

  // Click N3
  const n3Btn = page.locator('button:has-text("Đề thi N3")').first()
  if (await n3Btn.isVisible()) await n3Btn.click()
  await page.waitForTimeout(500)

  // Click Nghe hiểu
  const listeningBtn = page.locator('button:has-text("Nghe hiểu")').first()
  if (await listeningBtn.isVisible()) await listeningBtn.click()
  await page.waitForTimeout(500)

  // Find card with "12 2023"
  console.log('Finding card for 12 2023...')
  const examCards = page.locator('.jlpt-card')
  const count = await examCards.count()
  console.log(`Found ${count} exam cards.`)

  for (let i = 0; i < count; i++) {
    const text = await examCards.nth(i).innerText()
    if (text.includes('12 2023') || text.includes('12-2023') || text.includes('12/2023')) {
      console.log(`Card ${i} matches:`, text.split('\n')[0])
      const btn = examCards.nth(i).locator('button:has-text("Vào làm bài")')
      await btn.click()
      break
    }
  }

  await page.waitForTimeout(2000)

  // Take screenshot of 12/2023 exam room
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, '23_jlpt_n3_12_2023_actual_room.png'),
    fullPage: true,
  })
  console.log('📸 Đã chụp: 23_jlpt_n3_12_2023_actual_room.png')

  // Click seek button of question 1
  const seekBtn = page.locator('button.jlpt-seek-btn').first()
  if (await seekBtn.isVisible()) {
    console.log('Clicking seek button:', await seekBtn.innerText())
    await seekBtn.click()
    await page.waitForTimeout(1500)
  }

  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, '24_jlpt_n3_12_2023_playing_at_3m07s.png'),
    fullPage: true,
  })
  console.log('📸 Đã chụp: 24_jlpt_n3_12_2023_playing_at_3m07s.png')

  await browser.close()
}

run().catch(console.error)
