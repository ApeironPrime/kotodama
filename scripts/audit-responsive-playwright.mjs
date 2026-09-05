import path from 'node:path'
import fs from 'node:fs'
import { preview } from 'vite'
import { chromium } from 'playwright'

const PREVIEW_PORT = 4173
const PREVIEW_URL = `http://127.0.0.1:${PREVIEW_PORT}`
const outputDir = path.resolve('C:/Users/Phuc_Le/.gemini/antigravity/brain/cdb66d03-7155-4480-9ca3-fb44acca1545')
const screenshotDir = path.join(outputDir, 'screenshots')

if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true })
}

async function run() {
  console.log('--- Khởi động Vite Preview Server bằng API nội bộ ---')
  const previewServer = await preview({
    preview: {
      port: PREVIEW_PORT,
      host: '127.0.0.1',
      strictPort: true,
    },
  })

  console.log(`Vite preview đang lắng nghe tại ${PREVIEW_URL}`)

  try {
    const browser = await chromium.launch({ headless: true })
    const viewports = [
      { name: 'Mobile_375px', width: 375, height: 667 },
      { name: 'Mobile_390px', width: 390, height: 844 },
      { name: 'Tablet_768px', width: 768, height: 1024 },
      { name: 'Laptop_1024px', width: 1024, height: 768 },
      { name: 'Desktop_1440px', width: 1440, height: 900 },
      { name: 'Desktop_1920px', width: 1920, height: 1080 },
    ]

    const routes = [
      { path: '/', name: 'home' },
      { path: '/tu-vung', name: 'vocabulary' },
      { path: '/ngu-phap', name: 'bunpo' },
      { path: '/han-tu', name: 'kanji' },
      { path: '/tu-dien', name: 'dictionary' },
      { path: '/on-tap', name: 'review' },
      { path: '/thi-jlpt', name: 'jlpt' },
      { path: '/dang-nhap', name: 'login' },
    ]

    let totalTests = 0
    let passedTests = 0
    let overflowIssues = []

    for (const vp of viewports) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        userAgent:
          vp.width < 768
            ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
            : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      })
      const page = await context.newPage()

      console.log(`\n[Viewport: ${vp.name} (${vp.width}x${vp.height})]`)

      for (const r of routes) {
        totalTests++
        const targetUrl = `${PREVIEW_URL}${r.path}`
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(300)

        const metrics = await page.evaluate(() => {
          const docEl = document.documentElement
          const scrollWidth = docEl.scrollWidth
          const clientWidth = docEl.clientWidth
          const innerWidth = window.innerWidth
          const hasHorizontalOverflow = scrollWidth > clientWidth

          let overflowingElements = []
          if (hasHorizontalOverflow) {
            const all = document.querySelectorAll('*')
            for (const el of all) {
              const rect = el.getBoundingClientRect()
              if (rect.right > innerWidth + 1) {
                overflowingElements.push({
                  tag: el.tagName,
                  className: el.className ? String(el.className).slice(0, 50) : '',
                  right: Math.round(rect.right),
                  width: Math.round(rect.width),
                })
                if (overflowingElements.length >= 3) break
              }
            }
          }

          return {
            scrollWidth,
            clientWidth,
            innerWidth,
            hasHorizontalOverflow,
            overflowingElements,
          }
        })

        if (!metrics.hasHorizontalOverflow) {
          passedTests++
          console.log(`  ✓ ${r.path.padEnd(12)} -> clientWidth: ${metrics.clientWidth}px, scrollWidth: ${metrics.scrollWidth}px (OK)`)
        } else {
          overflowIssues.push({
            viewport: vp.name,
            route: r.path,
            scrollWidth: metrics.scrollWidth,
            clientWidth: metrics.clientWidth,
            overflowingElements: metrics.overflowingElements,
          })
          console.log(`  ❌ ${r.path.padEnd(12)} -> LỖI TRÀN: clientWidth=${metrics.clientWidth}px, scrollWidth=${metrics.scrollWidth}px (+${metrics.scrollWidth - metrics.clientWidth}px)`)
        }

        // Chụp screenshot cho Mobile 375px và Desktop 1440px
        if (vp.name === 'Mobile_375px' || vp.name === 'Desktop_1440px') {
          const screenshotPath = path.join(screenshotDir, `${vp.name}_${r.name}.png`)
          await page.screenshot({ path: screenshotPath, fullPage: false })
        }
      }

      await context.close()
    }

    await browser.close()

    console.log(`\n==========================================`)
    console.log(`TỔNG KẾT KIỂM THỬ RESPONSIVE:`)
    console.log(`Tổng số bài test: ${totalTests}`)
    console.log(`Thành công: ${passedTests}/${totalTests}`)
    console.log(`Lỗi tràn ngang: ${overflowIssues.length}`)

    if (overflowIssues.length > 0) {
      console.log('\nDANH SÁCH LỖI:')
      console.log(JSON.stringify(overflowIssues, null, 2))
      process.exit(1)
    } else {
      console.log('🎉 TẤT CẢ CÁC TRANG TRÊN MỌI KÍCH THƯỚC ĐỀU ĐẠT CHUẨN RESPONSIVE 100%!')
      process.exit(0)
    }
  } finally {
    await previewServer.close()
  }
}

run().catch((err) => {
  console.error('Lỗi kiểm thử:', err)
  process.exit(1)
})
