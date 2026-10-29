import { chromium } from 'playwright'
import path from 'path'

const ARTIFACT_DIR = 'C:/Users/ACER/.gemini/antigravity/brain/62d14a2a-af73-4782-b23b-bbff26452491'

async function run() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  console.log('Navigating to dictionary page...')
  await page.goto('http://localhost:5173/tra-tu', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)

  // 1. Capture Explore Mode (Zero state)
  const exploreScreenshotPath = path.join(ARTIFACT_DIR, 'dictionary_explore_mode.png')
  await page.screenshot({ path: exploreScreenshotPath, fullPage: false })
  console.log('Saved explore mode screenshot to:', exploreScreenshotPath)

  // 2. Search for a word, e.g. "桜" or "間"
  console.log('Searching for word...')
  const searchInput = page.getByRole('textbox', { name: 'Từ cần tra' })
  await searchInput.fill('桜')
  await page.waitForTimeout(1500)

  // Capture Active Search Mode
  const searchScreenshotPath = path.join(ARTIFACT_DIR, 'dictionary_search_editorial_spread.png')
  await page.screenshot({ path: searchScreenshotPath, fullPage: false })
  console.log('Saved active search screenshot to:', searchScreenshotPath)

  await browser.close()
  console.log('Done.')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
