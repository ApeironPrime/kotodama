import path from 'node:path'
import { chromium } from 'playwright'

const SCREENSHOTS_DIR = 'C:/Users/Phuc_Le/.gemini/antigravity/brain/da942045-a382-4a06-8801-52ba6c759860/screenshots'

async function run() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })
  const page = await context.newPage()

  try {
    console.log('1. Mở trang JLPT...')
    await page.goto('http://127.0.0.1:5173/jlpt', {
      waitUntil: 'domcontentloaded',
    })
    await page.waitForTimeout(1500)

    console.log('2. Vào đề thi N3 07/2023...')
    const n3Btn = page.locator('button:has-text("Đề thi N3")').first()
    if (await n3Btn.isVisible()) await n3Btn.click()
    await page.waitForTimeout(500)

    const listeningBtn = page.locator('button:has-text("Nghe hiểu")').first()
    if (await listeningBtn.isVisible()) await listeningBtn.click()
    await page.waitForTimeout(500)

    const examCards = page.locator('.jlpt-card')
    const count = await examCards.count()
    for (let i = 0; i < count; i++) {
      const text = await examCards.nth(i).innerText()
      if (text.includes('07 2023') || text.includes('2023-07') || text.includes('07/2023')) {
        const btn = examCards.nth(i).locator('button:has-text("Vào làm bài")')
        await btn.click()
        break
      }
    }
    await page.waitForTimeout(2000)

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '31_jlpt_n3_07_2023_synced_room.png'),
      fullPage: true,
    })
    console.log('📸 Đã chụp: 31_jlpt_n3_07_2023_synced_room.png')

    console.log('🎉 Kiểm thử đề N3 07/2023 hoàn tất thành công!')
  } catch (err) {
    console.error('Lỗi test:', err)
  } finally {
    await browser.close()
  }
}

run().catch(console.error)
