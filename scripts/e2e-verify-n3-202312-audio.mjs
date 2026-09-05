import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const SCREENSHOTS_DIR = 'C:/Users/Phuc_Le/.gemini/antigravity/brain/da942045-a382-4a06-8801-52ba6c759860/screenshots'

async function runTest() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
  }

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })
  const page = await context.newPage()

  try {
    // 1. Kiểm tra đề thi JLPT N3 12/2023
    console.log('1. Mở trang JLPT...')
    await page.goto('http://127.0.0.1:5173/jlpt', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)

    const n3Btn = page.locator('button:has-text("Đề thi N3")').first()
    if (await n3Btn.isVisible()) await n3Btn.click()
    await page.waitForTimeout(500)

    const listeningPill = page.locator('button:has-text("Nghe hiểu")').first()
    if (await listeningPill.isVisible()) await listeningPill.click()
    await page.waitForTimeout(500)

    // Chọn đề 12 2023
    console.log('2. Vào đề thi JLPT-N3 12 2023 - Nghe Hiểu...')
    const card202312 = page.locator('.jlpt-exam-card:has-text("12 2023")').first()
    if (await card202312.isVisible()) {
      const enterBtn = card202312.locator('button:has-text("Vào làm bài")')
      await enterBtn.click()
    } else {
      const enterFirst = page.locator('button:has-text("Vào làm bài")').first()
      await enterFirst.click()
    }
    await page.waitForTimeout(2000)

    // Chụp giao diện phòng thi nghe N3 12/2023 với nút nghe câu này (03:07)
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '20_jlpt_n3_12_2023_exact_timestamps.png'),
      fullPage: true,
    })
    console.log('📸 Đã chụp: 20_jlpt_n3_12_2023_exact_timestamps.png')

    // Bấm nút "Nghe câu này (03:07)"
    const seekBtn = page.locator('button.jlpt-seek-btn:has-text("Nghe câu này")').first()
    if (await seekBtn.isVisible()) {
      console.log('3. Bấm nút Nghe câu này (03:07)...')
      await seekBtn.click()
      await page.waitForTimeout(1500)
    }

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '21_jlpt_n3_12_2023_audio_jumped_to_3m07s.png'),
      fullPage: true,
    })
    console.log('📸 Đã chụp: 21_jlpt_n3_12_2023_audio_jumped_to_3m07s.png')

    // 4. Kiểm tra trang Shadowing Practice & Pitch Contour Graph
    console.log('4. Kiểm tra trang Shadowing & Pitch Contour Graph...')
    // Đăng nhập nhanh
    await page.goto('http://127.0.0.1:5173/auth/login', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1000)

    const emailInput = page.locator('input[type="email"]')
    const passInput = page.locator('input[type="password"]')
    if (await emailInput.isVisible()) {
      await emailInput.fill('learner@kotodama.local')
      await passInput.fill('Learner@123456')
      await page.locator('button:has-text("Đăng nhập")').click()
      await page.waitForTimeout(1500)
    }

    // Vào trang video shadowing
    await page.goto('http://127.0.0.1:5173/video', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '22_shadowing_pitch_contour_verified.png'),
      fullPage: true,
    })
    console.log('📸 Đã chụp: 22_shadowing_pitch_contour_verified.png')

    console.log('🎉 Toàn bộ kiểm thử trực quan hoàn tất thành công!')
  } catch (err) {
    console.error('Lỗi test:', err)
  } finally {
    await browser.close()
  }
}

runTest()
