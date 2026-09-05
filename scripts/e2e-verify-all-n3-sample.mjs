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

    const n3Btn = page.locator('button:has-text("Đề thi N3")').first()
    if (await n3Btn.isVisible()) await n3Btn.click()
    await page.waitForTimeout(500)

    const listeningBtn = page.locator('button:has-text("Nghe hiểu")').first()
    if (await listeningBtn.isVisible()) await listeningBtn.click()
    await page.waitForTimeout(500)

    // Test N3 12/2019
    console.log('2. Mở đề N3 12/2019...')
    const examCards = page.locator('.jlpt-card')
    const count = await examCards.count()
    for (let i = 0; i < count; i++) {
      const text = await examCards.nth(i).innerText()
      if (text.includes('12 2019') || text.includes('2019-12') || text.includes('12/2019')) {
        const btn = examCards.nth(i).locator('button:has-text("Vào làm bài")')
        await btn.click()
        break
      }
    }
    await page.waitForTimeout(2000)

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '32_jlpt_n3_12_2019_synced_room.png'),
      fullPage: true,
    })
    console.log('📸 Đã chụp: 32_jlpt_n3_12_2019_synced_room.png')

    // Bấm nút quay lại và mở N3 12/2022
    const backBtn = page.locator('button:has-text("Quay lại")').first()
    if (await backBtn.isVisible()) await backBtn.click()
    await page.waitForTimeout(1000)

    console.log('3. Mở đề N3 12/2022...')
    const examCards2 = page.locator('.jlpt-card')
    const count2 = await examCards2.count()
    for (let i = 0; i < count2; i++) {
      const text = await examCards2.nth(i).innerText()
      if (text.includes('12 2022') || text.includes('2022-12') || text.includes('12/2022')) {
        const btn = examCards2.nth(i).locator('button:has-text("Vào làm bài")')
        await btn.click()
        break
      }
    }
    await page.waitForTimeout(2000)

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '33_jlpt_n3_12_2022_synced_room.png'),
      fullPage: true,
    })
    console.log('📸 Đã chụp: 33_jlpt_n3_12_2022_synced_room.png')

    console.log('🎉 Kiểm thử mẫu hoàn tất thành công!')
  } catch (err) {
    console.error('Lỗi test:', err)
  } finally {
    await browser.close()
  }
}

run().catch(console.error)
