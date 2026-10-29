import { chromium } from 'playwright'
import path from 'node:path'

const artifactDir = 'C:/Users/ACER/.gemini/antigravity/brain/85bc17d9-3e02-4c5a-aed2-911f58a4e5cd'

async function run() {
  console.log('Launching browser...')
  const browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()

  console.log('Navigating to Kotodama Kanji Galaxy...')
  await page.goto('http://localhost:5173/tra-tu?tab=kanji', { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)

  const canvas = page.locator('.sumi-e-canvas').first()
  await canvas.waitFor({ state: 'visible', timeout: 10000 })
  const canvasBox = await canvas.boundingBox()
  console.log('Canvas box:', canvasBox)

  // Scan for 日 on the galaxy:
  // In 1440x900, Row 1 has 日 with Hanko seal around x: 810-870, y: 580-640
  console.log('Scanning for 日...')
  let foundX = 0
  let foundY = 0

  outer: for (let y = canvasBox.y + 120; y <= canvasBox.y + canvasBox.height - 80; y += 22) {
    for (let x = canvasBox.x + 80; x <= canvasBox.x + canvasBox.width - 80; x += 22) {
      await page.mouse.move(x, y)
      // Check if any links appeared or cursor is pointer
      const cur = await canvas.evaluate((el) => window.getComputedStyle(el).cursor)
      if (cur === 'pointer') {
        // Let's check which kanji is hovered by checking if subtitle has 'NHẬT' or 'Ngày'
        // Or wait 300ms and check screenshot
        foundX = x
        foundY = y
        console.log(`Found particle candidate at (${x}, ${y})`)
        // Let's see if this is 日:
        await page.waitForTimeout(1200)
        // If it's 日, it will have pulled 4 partners and drawn links!
        // We can check if it has links or keep scanning
        // Let's test if this coordinate is around x: 800-880, y: 560-640 (where 日 sits in row 1)
        if (x >= canvasBox.x + 750 && x <= canvasBox.x + 890 && y >= canvasBox.y + 130 && y <= canvasBox.y + 260) {
          console.log(`Matched 日 at (${x}, ${y})!`)
          break outer
        }
      }
    }
  }

  // If found 日, hover steadily for 2.5s for springs to settle
  await page.mouse.move(foundX, foundY)
  await page.waitForTimeout(2500)

  const outPath = path.join(artifactDir, 'kanji_nichi_anti_collision.png')
  await page.screenshot({ path: outPath, fullPage: false })
  console.log(`Saved screenshot to ${outPath}`)

  await browser.close()
  console.log('Verification finished!')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
