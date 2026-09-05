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

    console.log('2. Vào đề thi N3 07/2024...')
    const n3Btn = page.locator('button:has-text("Đề thi N3")').first()
    if (await n3Btn.isVisible()) await n3Btn.click()
    await page.waitForTimeout(500)

    const listeningBtn = page.locator('button:has-text("Nghe hiểu")').first()
    if (await listeningBtn.isVisible()) await listeningBtn.click()
    await page.waitForTimeout(500)

    // Bấm vào đề N3 07/2024
    const examCards = page.locator('.jlpt-card')
    const count = await examCards.count()
    for (let i = 0; i < count; i++) {
      const text = await examCards.nth(i).innerText()
      if (text.includes('07 2024') || text.includes('2024-07') || text.includes('07/2024')) {
        const btn = examCards.nth(i).locator('button:has-text("Vào làm bài")')
        await btn.click()
        break
      }
    }
    await page.waitForTimeout(2000)

    // Chụp giao diện phòng thi với nút -10s, +10s và các mốc thời gian
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '29_jlpt_n3_07_2024_exact_room.png'),
      fullPage: true,
    })
    console.log('📸 Đã chụp: 29_jlpt_n3_07_2024_exact_room.png')

    // Bấm nút "Nghe câu này (02:02)" cho Câu 2
    console.log('3. Bấm nút nhảy Câu 2 (02:02)...')
    const seekBtn2 = page.locator('button.jlpt-seek-btn:has-text("02:02")').first()
    if (await seekBtn2.isVisible()) {
      await seekBtn2.click()
      await page.waitForTimeout(1500)
    }

    // Bấm nút tua tới +10s
    console.log('4. Bấm nút tua tới +10s...')
    const fwd10 = page.locator('button.jlpt-audio-seek-step-btn:has-text("+10s")').first()
    if (await fwd10.isVisible()) {
      await fwd10.click()
      await page.waitForTimeout(1000)
    }

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '30_jlpt_n3_07_2024_jumped_and_seeked10s.png'),
      fullPage: true,
    })
    console.log('📸 Đã chụp: 30_jlpt_n3_07_2024_jumped_and_seeked10s.png')

    console.log('🎉 Kiểm thử đề N3 07/2024 hoàn tất thành công!')
  } catch (err) {
    console.error('Lỗi test:', err)
  } finally {
    await browser.close()
  }
}

run().catch(console.error)
