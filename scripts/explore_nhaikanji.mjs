import { chromium } from 'playwright'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  await page.goto('https://nhaikanji.com/', { waitUntil: 'commit' })
  await page.waitForTimeout(4000)

  const html = await page.content()
  console.log('HTML Length:', html.length)

  const textSummary = await page.evaluate(() => {
    return {
      title: document.title,
      headings: Array.from(
        document.querySelectorAll(
          'h1, h2, h3, h4, h5, h6, nav, header, main, [class*="nav"], [class*="menu"], [class*="item"]'
        )
      )
        .map((el) => el.innerText.trim())
        .filter((t) => t.length > 0 && t.length < 200)
        .slice(0, 50),
    }
  })

  console.log('Summary:', JSON.stringify(textSummary, null, 2))

  await browser.close()
}

main()
