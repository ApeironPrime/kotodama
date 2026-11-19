import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5173'
const out = new URL('../reports/fe-second-pass/', import.meta.url)
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const results = []
try {
  for (const width of process.env.QA_JOURNEYS_ONLY ? [] : [320, 390, 768, 1440]) {
    for (const theme of ['ivory', 'midnight', 'forest']) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })
      await context.addInitScript((background) => {
        localStorage.setItem('kotodama.settings.background', JSON.stringify(background))
        localStorage.setItem('kotodama.settings.auto-pronounce', 'false')
      }, theme)
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      for (const [name, path, selector] of [
        ['home', '/', '.showcase-home'],
        ['login', '/dang-nhap', '.auth-washi'],
        ['grammar', '/tra-tu?tab=grammar', '.dictionary-page'],
        ['kanji', '/tra-tu?tab=kanji&view=grid', '.dictionary-page'],
      ]) {
        await page.goto(base + path, { waitUntil: 'networkidle' })
        await page.locator(selector).waitFor()
        const state = await page.evaluate((selector) => {
          const root = getComputedStyle(document.documentElement)
          const element = getComputedStyle(document.querySelector(selector))
          return {
            tone: document.documentElement.dataset.theme,
            rootBackground: root.getPropertyValue('--color-bg-canvas').trim(),
            pageBackground: element.getPropertyValue('--color-bg-canvas').trim(),
            rootText: root.getPropertyValue('--color-text').trim(),
            pageText: element.getPropertyValue('--color-text').trim(),
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
          }
        }, selector)
        await page.screenshot({
          path: new URL(`${name}-${theme}-${width}.png`, out).pathname.replace(/^\/(\w:)/, '$1'),
        })
        results.push({ name, theme, width, ...state, errors: [...errors] })
      }
      await context.close()
    }
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  await page.goto(base + '/tra-tu?tab=grammar&q=' + encodeURIComponent('みたいだ'), { waitUntil: 'networkidle' })
  await page.getByRole('link', { name: 'Mở bài học', exact: true }).first().click()
  await page.getByText(/chạm để lật xem ý nghĩa/).waitFor()
  results.push({
    journey: 'grammar-search-to-full-lesson',
    passed: new URL(page.url()).searchParams.has('lesson'),
    url: page.url(),
  })
  await page.screenshot({ path: new URL('grammar-lesson-mobile.png', out).pathname.replace(/^\/(\w:)/, '$1') })
  // These accounts and cards are isolated QA fixtures on the local API only.
  if (['localhost', '127.0.0.1'].includes(new URL(base).hostname)) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
    const account = await context.request.post(base + '/api/v1/auth/register', {
      data: {
        name: 'Kiểm thử giao diện',
        email: `qa-${randomUUID()}@kotodama.test`,
        password: `QaLocal!${randomUUID()}A8`,
      },
    })
    const session = (await account.json()).data
    if (!account.ok() || !session?.accessToken) throw new Error('Local QA account could not be created')
    await context.addInitScript((token) => localStorage.setItem('kotodama.access-token', token), session.accessToken)
    const learner = await context.newPage()
    await learner.goto(base + '/cai-dat', { waitUntil: 'networkidle' })
    const sound = learner.getByRole('switch', { name: 'Âm thanh giao diện' })
    await sound.click()
    if ((await sound.getAttribute('aria-checked')) !== 'true') throw new Error('Sound setting did not enable')
    await learner.reload({ waitUntil: 'networkidle' })
    if ((await sound.getAttribute('aria-checked')) !== 'true') throw new Error('Sound setting did not persist')
    await learner.getByLabel('Giới hạn ôn tập mỗi ngày').selectOption('50')
    await learner.getByRole('button', { name: 'Đen Sumi', exact: true }).click()
    await learner.screenshot({ path: fileURLToPath(new URL('settings-mobile.png', out)) })
    const csrf = (await context.cookies(base)).find((cookie) => cookie.name === 'kotodama_csrf')?.value
    const added = await context.request.post(base + '/api/v1/srs/add', {
      headers: { Authorization: `Bearer ${session.accessToken}`, ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
      data: { type: 'vocab', term: '森', reading: 'もり', meaning: 'rừng' },
    })
    results.push({ journey: 'local-settings-persistence', passed: true })
    await learner.goto(base + '/on-tap', { waitUntil: 'networkidle' })
    if (added.status() === 503) {
      await learner.getByText('Chưa tải được kho thẻ. Kiểm tra kết nối và thử lại.').waitFor()
      await learner.getByRole('button', { name: 'Thử lại', exact: true }).waitFor()
      await learner.screenshot({ path: fileURLToPath(new URL('review-error-mobile.png', out)) })
      results.push({ journey: 'local-srs-service-unavailable-recovery', passed: true })
      results.push({
        journey: 'persisted-srs-keyboard-review',
        status: 'blocked',
        reason:
          'Local memory API has no SRS database; PostgreSQL quota prevented the database-backed API from starting.',
      })
      // Browser layout and keyboard checks use an explicit fixture when persistence is unavailable.
      await learner.route('**/api/v1/srs/**', (route) => {
        const path = new URL(route.request().url()).pathname
        const card = {
          id: 'qa-card',
          type: 'vocab',
          term: '森',
          reading: 'もり',
          meaning: 'rừng',
          jlptLevel: 'N5',
          stage: 'due',
          masteryPercentage: 0,
          repetition: 0,
          intervalDays: 0,
          easeFactor: 2.5,
          nextReviewDate: new Date().toISOString(),
        }
        const data = path.endsWith('/deck')
          ? { items: [card], total: 1, totalPages: 1, page: 1, limit: 100 }
          : path.endsWith('/saved-terms')
            ? []
            : {
                totalCards: 1,
                masteredCount: 0,
                dueTodayCount: 1,
                averageMastery: 0,
                vocabCount: 1,
                grammarCount: 0,
                kanjiCount: 0,
                reviewedToday: 0,
                heatmap: [],
              }
        return route.fulfill({ json: { data } })
      })
      await learner.reload({ waitUntil: 'networkidle' })
      for (const width of [320, 390]) {
        await learner.setViewportSize({ width, height: 844 })
        const layout = await learner.locator('.review-page').evaluate((el) => {
          const bounds = el.getBoundingClientRect()
          return {
            overflow: el.scrollWidth > el.clientWidth + 1,
            offenders: Array.from(el.querySelectorAll('*'))
              .filter((node) => node.getBoundingClientRect().right > bounds.right + 1)
              .slice(0, 8)
              .map((node) => ({
                tag: node.tagName,
                text: node.textContent?.slice(0, 70),
                width: node.getBoundingClientRect().width,
                style: node.getAttribute('style'),
              })),
          }
        })
        results.push({
          journey: 'review-responsive-fixture',
          width,
          passed: !layout.overflow,
          ...(layout.overflow ? { offenders: layout.offenders } : {}),
        })
      }
      const card = learner.getByRole('button', { name: 'Ôn tập 森', exact: true })
      await card.focus()
      await learner.keyboard.press('Enter')
      await learner.getByRole('dialog', { name: 'Ôn tập thẻ', exact: true }).waitFor()
      await learner.screenshot({ path: fileURLToPath(new URL('review-keyboard-fixture-mobile.png', out)) })
      results.push({ journey: 'review-keyboard-fixture', passed: true })
    } else {
      if (!added.ok()) throw new Error(`Local QA card could not be created: ${added.status()}`)
      const card = learner.getByRole('button', { name: 'Ôn tập 森', exact: true })
      await card.focus()
      await learner.keyboard.press('Enter')
      await learner.getByRole('dialog', { name: 'Ôn tập thẻ', exact: true }).waitFor()
      await learner.screenshot({ path: fileURLToPath(new URL('review-keyboard-mobile.png', out)) })
      results.push({ journey: 'persisted-srs-keyboard-review', passed: true })
    }
    await context.close()
  }
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'no-preference' })
    const normal = await context.newPage()
    await normal.goto(base, { waitUntil: 'networkidle' })
    const stages = await normal.locator('.showcase-hero__webgl-stage').count()
    results.push({ journey: 'responsive-artwork-mount', width, passed: stages === (width > 600 ? 1 : 0) })
    await context.close()
  }
  await writeFile(new URL('results.json', out), JSON.stringify(results, null, 2))
  const failed = results.filter(
    (result) =>
      result.overflow ||
      result.errors?.length ||
      result.pageText !== result.rootText ||
      result.pageBackground !== result.rootBackground ||
      result.passed === false
  )
  const blocked = results.filter((result) => result.status === 'blocked')
  console.log(JSON.stringify({ checks: results.length - blocked.length, failed, blocked }, null, 2))
  if (failed.length) process.exitCode = 1
} finally {
  await browser.close()
}
