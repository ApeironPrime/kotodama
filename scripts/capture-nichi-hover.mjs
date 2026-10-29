import { chromium } from 'playwright'
import path from 'node:path'

const artifactDir = 'C:/Users/ACER/.gemini/antigravity/brain/85bc17d9-3e02-4c5a-aed2-911f58a4e5cd'

async function run() {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()

  await page.goto('http://localhost:5173/tra-tu?tab=kanji', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)

  // Move mouse directly to 日 at (835, 448)
  console.log('Hovering directly on 日 at (835, 448)...')
  await page.mouse.move(835, 448)
  await page.waitForTimeout(3000) // let magnetic pull & spring physics fully settle

  const outPath = path.join(artifactDir, 'kanji_nichi_anti_collision.png')
  await page.screenshot({ path: outPath, fullPage: false })
  console.log(`Saved screenshot to ${outPath}`)

  await browser.close()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
