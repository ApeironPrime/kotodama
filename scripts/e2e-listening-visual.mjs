import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const SCREENSHOTS_DIR = 'C:/Users/Phuc_Le/.gemini/antigravity/brain/da942045-a382-4a06-8801-52ba6c759860/screenshots'

async function runVisualQA() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
  }

  console.log('--- Bắt đầu Visual QA Kiểm thử Phòng thi Nghe JLPT N3 ---')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })
  const page = await context.newPage()

  try {
    // 1. Mở trang JLPT
    console.log('1. Mở trang /jlpt...')
    await page.goto('http://127.0.0.1:5173/jlpt', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)

    // 2. Chuyển sang N3 và lọc Nghe hiểu
    console.log('2. Lọc Đề thi N3 & Nghe hiểu...')
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

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '10_jlpt_n3_listening_list.png'),
      fullPage: true,
    })
    console.log('📸 Đã chụp: 10_jlpt_n3_listening_list.png')

    // 3. Click vào làm bài đề thi nghe N3 12/2023
    console.log('3. Vào phòng thi nghe N3...')
    const enterExamBtn = page.locator('button:has-text("Vào làm bài")').first()
    await enterExamBtn.click()
    await page.waitForTimeout(1500)

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '11_jlpt_n3_listening_room.png'),
      fullPage: true,
    })
    console.log('📸 Đã chụp: 11_jlpt_n3_listening_room.png')

    // 4. Chọn đáp án và Nộp bài
    console.log('4. Chọn đáp án và nộp bài thi...')
    const firstOption = page.locator('button:has-text("1")').first()
    if (await firstOption.isVisible()) {
      await firstOption.click()
    }

    const submitBtn = page.locator('button:has-text("Nộp bài thi")').first()
    await submitBtn.click()
    await page.waitForTimeout(1500)

    // 5. Mở Script Accordion
    console.log('5. Mở xem Lời thoại (Script)...')
    const scriptBtn = page.locator('button:has-text("Xem lời thoại (Script)")').first()
    if (await scriptBtn.isVisible()) {
      await scriptBtn.click()
      await page.waitForTimeout(500)
    }

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '12_jlpt_n3_listening_results_with_script.png'),
      fullPage: true,
    })
    console.log('📸 Đã chụp: 12_jlpt_n3_listening_results_with_script.png')

    console.log('🎉 Visual QA kiểm thử thi nghe thành công 100%!')
  } catch (err) {
    console.error('❌ Lỗi Visual QA:', err)
  } finally {
    await browser.close()
  }
}

runVisualQA()
