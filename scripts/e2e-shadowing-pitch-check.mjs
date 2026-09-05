import path from 'node:path'
import { chromium } from 'playwright'

const SCREENSHOTS_DIR = 'C:/Users/Phuc_Le/.gemini/antigravity/brain/da942045-a382-4a06-8801-52ba6c759860/screenshots'

async function checkShadowingPitch() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
  })
  const page = await context.newPage()

  // 1. Đăng nhập
  await page.goto('http://127.0.0.1:5173/dang-nhap', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1000)

  const emailInput = page.locator('input[type="email"]')
  const passInput = page.locator('input[type="password"]')
  if (await emailInput.isVisible()) {
    await emailInput.fill('learner@kotodama.local')
    await passInput.fill('Learner@123456')
    await page.locator('button:has-text("Đăng nhập")').click()
    await page.waitForTimeout(1500)
  }

  // 2. Vào trang Video AI (/video-ai)
  console.log('Vào trang Video AI...')
  await page.goto('http://127.0.0.1:5173/video-ai', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)

  // Bấm vào video học đầu tiên nếu có
  const startBtns = page.locator('button:has-text("Luyện"), button:has-text("Bắt đầu"), button:has-text("Học ngay")')
  if ((await startBtns.count()) > 0) {
    await startBtns.first().click()
    await page.waitForTimeout(2000)
  }

  // Chụp ảnh màn hình
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, '25_shadowing_pitch_contour_live.png'),
    fullPage: true,
  })
  console.log('📸 Đã chụp: 25_shadowing_pitch_contour_live.png')

  await browser.close()
}

checkShadowingPitch().catch(console.error)
