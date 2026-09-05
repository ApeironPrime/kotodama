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
    // 1. Kiểm tra đề N1 Nghe hiểu
    console.log('1. Mở trang JLPT...')
    await page.goto('http://127.0.0.1:5173/jlpt', {
      waitUntil: 'domcontentloaded',
    })
    await page.waitForTimeout(1500)

    console.log('2. Kiểm tra N1 Nghe hiểu...')
    const n1Btn = page.locator('button:has-text("Đề thi N1")').first()
    if (await n1Btn.isVisible()) await n1Btn.click()
    await page.waitForTimeout(500)

    const listeningBtn = page.locator('button:has-text("Nghe hiểu")').first()
    if (await listeningBtn.isVisible()) await listeningBtn.click()
    await page.waitForTimeout(500)

    const enterN1 = page.locator('.jlpt-card button:has-text("Vào làm bài")').first()
    if (await enterN1.isVisible()) {
      await enterN1.click()
      await page.waitForTimeout(2000)

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '26_jlpt_n1_listening_clean_room.png'),
        fullPage: true,
      })
      console.log('📸 Đã chụp: 26_jlpt_n1_listening_clean_room.png')

      const backBtn = page.locator('button:has-text("Quay lại")').first()
      if (await backBtn.isVisible()) await backBtn.click()
      await page.waitForTimeout(1000)
    }

    // 2. Kiểm tra N2 Nghe hiểu
    console.log('3. Kiểm tra N2 Nghe hiểu...')
    const n2Btn = page.locator('button:has-text("Đề thi N2")').first()
    if (await n2Btn.isVisible()) await n2Btn.click()
    await page.waitForTimeout(500)

    const enterN2 = page.locator('.jlpt-card button:has-text("Vào làm bài")').first()
    if (await enterN2.isVisible()) {
      await enterN2.click()
      await page.waitForTimeout(2000)

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '27_jlpt_n2_listening_clean_room.png'),
        fullPage: true,
      })
      console.log('📸 Đã chụp: 27_jlpt_n2_listening_clean_room.png')

      const backBtn = page.locator('button:has-text("Quay lại")').first()
      if (await backBtn.isVisible()) await backBtn.click()
      await page.waitForTimeout(1000)
    }

    // 3. Kiểm tra N3 12/2023 Nghe hiểu (giao diện mới sạch đẹp, chỉ có nút nhảy giây)
    console.log('4. Kiểm tra N3 12/2023 Nghe hiểu...')
    const n3Btn = page.locator('button:has-text("Đề thi N3")').first()
    if (await n3Btn.isVisible()) await n3Btn.click()
    await page.waitForTimeout(500)

    const examCards = page.locator('.jlpt-card')
    const count = await examCards.count()
    for (let i = 0; i < count; i++) {
      const text = await examCards.nth(i).innerText()
      if (text.includes('12 2023') || text.includes('12-2023') || text.includes('12/2023')) {
        const btn = examCards.nth(i).locator('button:has-text("Vào làm bài")')
        await btn.click()
        break
      }
    }
    await page.waitForTimeout(2000)

    // Bấm nút nhảy câu 1 (03:07)
    const seekBtn = page.locator('button.jlpt-seek-btn').first()
    if (await seekBtn.isVisible()) {
      console.log('Clicking seek button 03:07...')
      await seekBtn.click()
      await page.waitForTimeout(1500)
    }

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '28_jlpt_n3_12_2023_clean_audio_jump.png'),
      fullPage: true,
    })
    console.log('📸 Đã chụp: 28_jlpt_n3_12_2023_clean_audio_jump.png')

    console.log('🎉 Toàn bộ kiểm thử trực quan hoàn tất xuất sắc!')
  } catch (err) {
    console.error('Lỗi test:', err)
  } finally {
    await browser.close()
  }
}

run().catch(console.error)
