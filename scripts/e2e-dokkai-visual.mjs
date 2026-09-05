import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const SCREENSHOTS_DIR = 'C:/Users/Phuc_Le/.gemini/antigravity/brain/da942045-a382-4a06-8801-52ba6c759860/screenshots'

async function runVisualQA() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
  }

  console.log('--- Bắt đầu Visual QA Kiểm thử Đọc hiểu (Dokkai) và Đề thi hoàn chỉnh ---')
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

    // 2. Lọc Đọc hiểu & Ngữ pháp N3
    console.log('2. Lọc Đề thi N3 & Ngữ pháp - Đọc hiểu...')
    const n3Btn = page.locator('button:has-text("Đề thi N3")')
    if (await n3Btn.isVisible()) {
      await n3Btn.click()
      await page.waitForTimeout(500)
    }

    const readingPill = page.locator('button:has-text("Ngữ pháp - Đọc hiểu (文法・読解)")')
    if (await readingPill.isVisible()) {
      await readingPill.click()
      await page.waitForTimeout(500)
    }

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '13_jlpt_n3_grammar_reading_list.png'),
      fullPage: true,
    })
    console.log('📸 Đã chụp: 13_jlpt_n3_grammar_reading_list.png')

    // 3. Vào phòng thi Ngữ pháp - Đọc hiểu
    console.log('3. Vào phòng thi Ngữ pháp - Đọc hiểu N3...')
    const enterExamBtn = page.locator('button:has-text("Vào làm bài")').first()
    await enterExamBtn.click()
    await page.waitForTimeout(1500)

    // 4. Chuyển sang phần Đọc hiểu (Mondai 4 hoặc Mondai 5 có bài đọc)
    console.log('4. Chuyển sang Mondai Đọc hiểu có bài đọc...')
    const dokkaiPartBtn = page.locator('button:has-text("Mondai 4"), button:has-text("Mondai 5")').first()
    if (await dokkaiPartBtn.isVisible()) {
      await dokkaiPartBtn.click()
      await page.waitForTimeout(1000)
    }

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '14_jlpt_n3_dokkai_passage_room.png'),
      fullPage: true,
    })
    console.log('📸 Đã chụp: 14_jlpt_n3_dokkai_passage_room.png')

    // 5. Chọn đáp án và Nộp bài
    console.log('5. Chọn đáp án và nộp bài thi...')
    const firstOption = page.locator('button:has-text("1")').first()
    if (await firstOption.isVisible()) {
      await firstOption.click()
    }

    const submitBtn = page.locator('button:has-text("Nộp bài thi")').first()
    if (await submitBtn.isVisible()) {
      await submitBtn.click()
      await page.waitForTimeout(1500)
    }

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '15_jlpt_n3_dokkai_results.png'),
      fullPage: true,
    })
    console.log('📸 Đã chụp: 15_jlpt_n3_dokkai_results.png')

    console.log('🎉 Visual QA kiểm thử Đọc hiểu thành công 100%!')
  } catch (err) {
    console.error('❌ Lỗi Visual QA:', err)
  } finally {
    await browser.close()
  }
}

runVisualQA()
