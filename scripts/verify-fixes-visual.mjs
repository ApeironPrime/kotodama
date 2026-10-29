import { chromium } from 'playwright'
import path from 'node:path'

const artifactDir = 'C:/Users/ACER/.gemini/antigravity/brain/85bc17d9-3e02-4c5a-aed2-911f58a4e5cd'

async function run() {
  console.log('Launching browser (msedge)...')
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()

  try {
    console.log('Navigating to http://localhost:5173/tra-tu?tab=kanji...')
    await page.goto('http://localhost:5173/tra-tu?tab=kanji', { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)

    // ── TEST 1: Open KanjiDetailModal for 信 (TÍN) ──────────────────────────
    console.log('Opening modal for 信...')
    // Use page.evaluate to trigger selection or force click the accessible button
    const openedTin = await page.evaluate(async () => {
      // Find button in accessible list for 信
      const buttons = Array.from(document.querySelectorAll('button'))
      const btn = buttons.find(b => b.textContent && b.textContent.includes('信'))
      if (btn) {
        btn.click()
        return true
      }
      return false
    })
    console.log('Triggered 信 modal click:', openedTin)
    await page.waitForTimeout(2500)

    // Capture screenshot of KanjiDetailModal for 信
    const tinModalPath = path.join(artifactDir, 'modal_tin_stroke_player_no_english.png')
    await page.screenshot({ path: tinModalPath, fullPage: false })
    console.log('Saved screenshot of 信:', tinModalPath)

    // Close modal
    const closeBtn = page.locator('button[title*="Đóng"]')
    if (await closeBtn.count() > 0) {
      await closeBtn.click()
      await page.waitForTimeout(1000)
    }

    // ── TEST 2: Open KanjiDetailModal for 回 (HỒI) ──────────────────────────
    console.log('Opening modal for 回...')
    const openedHoi = await page.evaluate(async () => {
      const buttons = Array.from(document.querySelectorAll('button'))
      const btn = buttons.find(b => b.textContent && b.textContent.includes('回'))
      if (btn) {
        btn.click()
        return true
      }
      return false
    })
    console.log('Triggered 回 modal click:', openedHoi)
    await page.waitForTimeout(2500)

    // Capture screenshot of KanjiDetailModal for 回
    const hoiModalPath = path.join(artifactDir, 'modal_hoi_stroke_player_no_english.png')
    await page.screenshot({ path: hoiModalPath, fullPage: false })
    console.log('Saved screenshot of 回:', hoiModalPath)

  } catch (err) {
    console.error('Error during verification:', err)
  } finally {
    await browser.close()
  }
}

run()
