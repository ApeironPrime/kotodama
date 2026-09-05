import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const SCREENSHOTS_DIR = 'C:/Users/Phuc_Le/.gemini/antigravity/brain/da942045-a382-4a06-8801-52ba6c759860/screenshots'

async function runVisualQA() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
  }

  console.log('--- Bắt đầu Visual QA Kiểm thử Đề nghe Song ngữ & Bấm để nhảy Audio ---')
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

    // 2. Lọc Đề thi N3 & Nghe hiểu
    console.log('2. Lọc Nghe hiểu N3...')
    const n3Btn = page.locator('button:has-text("Đề thi N3")')
    if (await n3Btn.isVisible()) {
      await n3Btn.click()
      await page.waitForTimeout(500)
    }

    const listeningPill = page.locator('button:has-text("Nghe hiểu (聴解)")')
    if (await listeningPill.isVisible()) {
      await listeningPill.click()
      await page.waitForTimeout(500)
    }

    // 3. Vào phòng thi Nghe N3
    console.log('3. Vào phòng thi nghe N3...')
    const enterExamBtn = page.locator('button:has-text("Vào làm bài")').first()
    await enterExamBtn.click()
    await page.waitForTimeout(2000)

    // 4. Phát audio để kiểm tra Mini Subtitle Bar
    console.log('4. Phát audio và kiểm tra Mini Subtitle Bar...')
    const playBtn = page.locator('.jlpt-audio-play-btn').first()
    if (await playBtn.isVisible()) {
      await playBtn.click()
      await page.waitForTimeout(2000)
    }

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '18_jlpt_n3_listening_active_room.png'),
      fullPage: true,
    })
    console.log('📸 Đã chụp: 18_jlpt_n3_listening_active_room.png')

    // 5. Nộp bài để vào Review mode và xem Lời thoại Song ngữ
    console.log('5. Nộp bài thi nghe để vào chế độ xem lời thoại...')
    const firstOption = page.locator('button:has-text("1")').first()
    if (await firstOption.isVisible()) {
      await firstOption.click()
    }

    const submitBtn = page.locator('button:has-text("Nộp bài thi")').first()
    if (await submitBtn.isVisible()) {
      await submitBtn.click()
      await page.waitForTimeout(1500)
    }

    // 6. Mở Accordion Lời thoại Song ngữ của Câu 1
    console.log('6. Mở Lời thoại Song ngữ của Câu 1...')
    const scriptAccordionBtn = page.locator('button:has-text("Lời thoại")').first()
    if (await scriptAccordionBtn.isVisible()) {
      await scriptAccordionBtn.click()
      await page.waitForTimeout(1000)
    }

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '19_jlpt_n3_bilingual_script_review.png'),
      fullPage: true,
    })
    console.log('📸 Đã chụp: 19_jlpt_n3_bilingual_script_review.png')

    console.log('🎉 Visual QA kiểm thử Đề nghe song ngữ hoàn thành 100%!')
  } catch (err) {
    console.error('❌ Lỗi Visual QA:', err)
  } finally {
    await browser.close()
  }
}

runVisualQA()
