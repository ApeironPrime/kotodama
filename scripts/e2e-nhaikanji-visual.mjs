import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import { chromium } from 'playwright'

const API_PORT = 8787
const VITE_PORT = 5173
const API_URL = `http://127.0.0.1:${API_PORT}`
const VITE_URL = `http://127.0.0.1:${VITE_PORT}`

const outputDir = path.resolve('C:/Users/Phuc_Le/.gemini/antigravity/brain/da942045-a382-4a06-8801-52ba6c759860')
const screenshotDir = path.join(outputDir, 'screenshots')
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true })
}

async function waitForUrl(url, timeoutMs = 45000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok || res.status === 404 || res.status === 200) return
    } catch {
      // server starting
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`Timeout waiting for ${url}`)
}

async function main() {
  console.log('--- Starting Autonomous E2E & Visual QA Test ---')

  // 1. Start backend server
  const server = spawn(process.execPath, ['server/index.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      API_PORT: String(API_PORT),
      DATABASE_URL: '',
      NHAIKANJI_DATA_PATH: 'D:/VKU/data/drive-download-20260828T102340Z-1-002/nhaikanji_data',
    },
    stdio: 'inherit',
  })

  // 2. Start Vite server
  const vite = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(VITE_PORT), '--strictPort'], {
    cwd: process.cwd(),
    shell: true,
    env: {
      ...process.env,
      VITE_API_BASE_URL: API_URL,
    },
    stdio: 'inherit',
  })

  try {
    console.log('Waiting for API and Vite servers to be ready...')
    await waitForUrl(`${API_URL}/health`)
    await waitForUrl(VITE_URL)
    console.log('Servers are ready!')

    // 3. Launch Playwright
    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    })
    const page = await context.newPage()
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log('[BROWSER ERROR]:', msg.text())
      }
    })
    page.on('pageerror', (err) => console.error('[BROWSER PAGE ERROR]:', err.message))

    // 3.1 Test Homepage
    console.log('Visiting Homepage...')
    await page.goto(`${VITE_URL}/`, { waitUntil: 'networkidle' })
    await page.screenshot({ path: path.join(screenshotDir, '01_homepage.png') })

    // 3.2 Test Kanji Page
    console.log('Visiting Kanji Hub (/kanji)...')
    await page.goto(`${VITE_URL}/kanji`, { waitUntil: 'networkidle' })
    await page.waitForSelector('.kanji-card', { timeout: 10000 })
    await page.screenshot({ path: path.join(screenshotDir, '02_kanji_grid.png') })

    // 3.3 Test Kanji Detail Modal & Vocabulary / Pitch Accent
    console.log('Opening Kanji Detail Modal for 土...')
    // Click on the first kanji card
    const firstCard = page.locator('.kanji-card').first()
    await firstCard.click()
    await page.waitForSelector('.nhaikanji-modal', { timeout: 10000 })
    await page.waitForTimeout(1000)
    await page.screenshot({ path: path.join(screenshotDir, '03_kanji_detail_modal.png') })

    // Switch to practice canvas tab
    console.log('Switching to Canvas tab...')
    const practiceTab = page.getByRole('button', { name: /Luyện viết nét/i })
    await practiceTab.click()
    await page.waitForTimeout(1000)
    await page.screenshot({ path: path.join(screenshotDir, '04_kanji_canvas_practice.png') })

    // Close modal
    const closeBtn = page.getByLabel('Đóng modal')
    await closeBtn.click()
    await page.waitForTimeout(500)

    // 3.4 Test Bunpo (Grammar) Page
    console.log('Visiting Bunpo Hub (/bunpo)...')
    await page.goto(`${VITE_URL}/bunpo`, { waitUntil: 'networkidle' })
    await page.waitForSelector('.bunpo-card', { timeout: 10000 })
    await page.screenshot({ path: path.join(screenshotDir, '05_bunpo_page.png') })

    // 3.5 Test JLPT Exams Hub
    console.log('Visiting JLPT Hub (/jlpt)...')
    await page.goto(`${VITE_URL}/jlpt`, { waitUntil: 'networkidle' })
    await page.waitForSelector('.jlpt-card', { timeout: 10000 })
    await page.screenshot({ path: path.join(screenshotDir, '06_jlpt_exams_list.png') })

    // 3.6 Test JLPT Exam Taking Page
    console.log('Entering JLPT Exam Room...')
    const startExamBtn = page.getByRole('button', { name: /Vào làm bài/i }).first()
    if (await startExamBtn.isVisible()) {
      await startExamBtn.click()
      await page.waitForTimeout(1500)
      await page.screenshot({ path: path.join(screenshotDir, '07_jlpt_exam_taking.png') })

      // Select an option and submit
      const optionButtons = page.locator('div[id^="question-"] button')
      const optCount = await optionButtons.count()
      if (optCount > 0) {
        await optionButtons.first().click()
      }
      const submitBtn = page.getByRole('button', { name: /Nộp bài thi/i }).first()
      if (await submitBtn.isVisible()) {
        await submitBtn.click()
        await page.waitForTimeout(1500)
        await page.screenshot({ path: path.join(screenshotDir, '08_jlpt_exam_results.png') })
      }
    }

    // 3.7 Mobile Responsive Test (390px)
    console.log('Testing Mobile 390px layout...')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${VITE_URL}/kanji`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
    await page.screenshot({ path: path.join(screenshotDir, '09_kanji_mobile_390px.png') })

    await browser.close()
    console.log('--- E2E & Visual QA Test Complete! All screenshots captured! ---')
  } finally {
    server.kill('SIGTERM')
    vite.kill('SIGTERM')
  }
}

main()
