import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const SCREENSHOTS_DIR = 'C:/Users/Phuc_Le/.gemini/antigravity/brain/da942045-a382-4a06-8801-52ba6c759860/screenshots'

async function runVisualQA() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
  }

  console.log('--- Bắt đầu Visual QA Kiểm thử Mondai 5 layout 1 cột & Thang điểm chuẩn JLPT ---')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })
  const page = await context.newPage()

  try {
    // 1. Mở trang /jlpt
    console.log('1. Mở trang /jlpt...')
    await page.goto('http://127.0.0.1:5173/jlpt', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)

    // 2. Lọc Từ vựng N3
    console.log('2. Lọc Từ vựng N3...')
    const n3Btn = page.locator('button:has-text("Đề thi N3")')
    if (await n3Btn.isVisible()) {
      await n3Btn.click()
      await page.waitForTimeout(500)
    }

    const vocabPill = page.locator('button:has-text("Từ vựng (文字・語彙)")')
    if (await vocabPill.isVisible()) {
      await vocabPill.click()
      await page.waitForTimeout(500)
    }

    // 3. Vào phòng thi Từ vựng N3
    console.log('3. Vào làm bài Từ vựng N3...')
    const enterExamBtn = page.locator('button:has-text("Vào làm bài")').first()
    await enterExamBtn.click()
    await page.waitForTimeout(1500)

    // 4. Chuyển sang Mondai 5 (Cách dùng từ)
    console.log('4. Chuyển sang Mondai 5...')
    const mondai5Btn = page.locator('button:has-text("Mondai 5")').first()
    if (await mondai5Btn.isVisible()) {
      await mondai5Btn.click()
      await page.waitForTimeout(1000)
    }

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '16_jlpt_n3_mondai5_single_column.png'),
      fullPage: true,
    })
    console.log('📸 Đã chụp: 16_jlpt_n3_mondai5_single_column.png')

    // 5. Chọn đáp án cho vài câu và Nộp bài để xem Bảng điểm chi tiết
    console.log('5. Chọn đáp án và nộp bài thi...')
    const firstOption = page.locator('button:has-text("4")').first()
    if (await firstOption.isVisible()) {
      await firstOption.click()
    }

    const submitBtn = page.locator('button:has-text("Nộp bài thi")').first()
    if (await submitBtn.isVisible()) {
      await submitBtn.click()
      await page.waitForTimeout(1500)
    }

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '17_jlpt_scoring_sectional_breakdown.png'),
      fullPage: true,
    })
    console.log('📸 Đã chụp: 17_jlpt_scoring_sectional_breakdown.png')

    console.log('🎉 Visual QA kiểm thử Mondai 5 và Bảng điểm chuẩn hoàn tất 100%!')
  } catch (err) {
    console.error('❌ Lỗi Visual QA:', err)
  } finally {
    await browser.close()
  }
}

runVisualQA()
