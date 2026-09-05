import { chromium } from 'playwright'

async function inspectCorodomo() {
  console.log('--- Inspecting Corodomo JLPT N3 Data ---')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()

  const apiLogs = []

  page.on('response', async (response) => {
    const url = response.url()
    const contentType = response.headers()['content-type'] || ''
    if (
      url.includes('/api/') ||
      url.includes('trpc') ||
      contentType.includes('application/json') ||
      url.includes('exams') ||
      url.includes('exam')
    ) {
      try {
        const text = await response.text()
        if (text.length < 500000) {
          apiLogs.push({
            url,
            status: response.status(),
            contentType,
            snippet: text.slice(0, 500),
            fullLength: text.length,
          })
        }
      } catch {
        // ignore
      }
    }
  })

  try {
    console.log('1. Navigating to https://corodomo.com/practice/exams?id=jlpt-n3 ...')
    await page.goto('https://corodomo.com/practice/exams?id=jlpt-n3', {
      waitUntil: 'networkidle',
      timeout: 30000,
    })

    console.log('Current URL:', page.url())
    console.log('Page Title:', await page.title())

    // Find all links or buttons related to exams
    const examLinks = await page.locator('a[href*="/practice/exams/jlpt"]').evaluateAll((links) =>
      links.map((a) => ({
        href: a.href,
        text: a.innerText.trim(),
      }))
    )

    console.log('Found exam links count:', examLinks.length)
    if (examLinks.length > 0) {
      console.log('First 5 links:', examLinks.slice(0, 5))

      // Navigate to the first exam
      const firstExamHref = examLinks[0].href
      console.log('2. Navigating to first exam:', firstExamHref)
      await page.goto(firstExamHref, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForTimeout(3000)
    }

    console.log('--- Intercepted API / JSON responses ---')
    apiLogs.forEach((log, idx) => {
      console.log(`[${idx + 1}] ${log.url} (${log.status}) [${log.fullLength} bytes]`)
      console.log('Snippet:', log.snippet.slice(0, 200))
    })
  } catch (err) {
    console.error('Error during inspection:', err)
  } finally {
    await browser.close()
  }
}

inspectCorodomo()
