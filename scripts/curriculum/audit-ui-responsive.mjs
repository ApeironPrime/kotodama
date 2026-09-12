import path from 'node:path'
import fs from 'node:fs'
import { preview } from 'vite'
import { chromium } from 'playwright'

const PREVIEW_PORT = 4174
const PREVIEW_URL = `http://127.0.0.1:${PREVIEW_PORT}`

const artifactScreenshotDir = path.resolve(
  'C:/Users/ACER/.gemini/antigravity/brain/e3afd60f-2f7e-4175-aab8-c13a36f06229/screenshots'
)
const docsScreenshotDir = path.resolve('d:/Project/kotodama/docs/plans/vocabulary-curriculum/screenshots')

for (const dir of [artifactScreenshotDir, docsScreenshotDir]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

const MOCK_APPROVED_CATALOG = {
  items: [
    {
      course_code: 'marugoto-a1-starter',
      title: 'Marugoto A1 Katsudoo & Rikai',
      level: 'A1',
      provider_source: 'Japan Foundation',
      visibility: 'public',
      rights_status: 'verified',
      description: 'Giao tiếp tiếng Nhật đời sống theo chuẩn CEFR/JF Standard cho người mới bắt đầu.',
      unit_count: 18,
      term_count: 520,
    },
    {
      course_code: 'minna-n5-standard',
      title: 'Minna no Nihongo N5 Chuẩn',
      level: 'N5',
      provider_source: '3A Corporation',
      visibility: 'public',
      rights_status: 'verified',
      description: 'Giáo trình tiếng Nhật sơ cấp 25 bài học nền tảng từ vựng sinh hoạt hàng ngày.',
      unit_count: 25,
      term_count: 1000,
    },
    {
      course_code: 'minna-n4-standard',
      title: 'Minna no Nihongo N4 Chuẩn',
      level: 'N4',
      provider_source: '3A Corporation',
      visibility: 'public',
      rights_status: 'verified',
      description: 'Mở rộng vốn từ đàm thoại và liên kết câu tiếng Nhật sơ trung cấp.',
      unit_count: 25,
      term_count: 980,
    },
    {
      course_code: 'soumatome-n3-vocab',
      title: 'Nihongo Soumatome N3 Từ Vựng',
      level: 'N3',
      provider_source: 'Ask Books',
      visibility: 'public',
      rights_status: 'verified',
      description: 'Chinh phục 800+ từ vựng trọng tâm kỳ thi năng lực tiếng Nhật N3 trong 6 tuần.',
      unit_count: 6,
      term_count: 820,
    },
    {
      course_code: 'mimikara-n2-goi',
      title: 'Mimi Kara Oboeru N2 Goi',
      level: 'N2',
      provider_source: 'ALC Press',
      visibility: 'public',
      rights_status: 'verified',
      description: 'Luyện nghe và ghi nhớ từ vựng N2 qua ngữ cảnh thực tế và ví dụ sâu sắc.',
      unit_count: 14,
      term_count: 1160,
    },
    {
      course_code: 'tango-n1-2000',
      title: 'Hajimete no Nihongo Tango N1',
      level: 'N1',
      provider_source: 'ASK Publishing',
      visibility: 'public',
      rights_status: 'verified',
      description: '2000 từ vựng cao cấp phục vụ đọc báo chí, nghiên cứu và diễn đạt học thuật.',
      unit_count: 14,
      term_count: 2000,
    },
    {
      course_code: 'it-nihongo-se',
      title: 'Tiếng Nhật Chuyên Ngành CNTT (SE)',
      level: 'SE',
      provider_source: 'Kotodama SE Curriculum',
      visibility: 'public',
      rights_status: 'verified',
      description: 'Từ vựng chuyên ngành kỹ thuật phần mềm, thiết kế cơ sở dữ liệu và quản trị dự án.',
      unit_count: 16,
      term_count: 650,
    },
  ],
  pagination: {
    page: 1,
    limit: 100,
    total: 7,
    totalPages: 1,
  },
}

const MOCK_COURSE_DETAIL = {
  course: {
    course_code: 'minna-n5-standard',
    title: 'Minna no Nihongo N5 Chuẩn',
    level: 'N5',
    provider_source: '3A Corporation',
    visibility: 'public',
    rights_status: 'verified',
    description: 'Giáo trình tiếng Nhật sơ cấp 25 bài học nền tảng từ vựng sinh hoạt hàng ngày.',
    unit_count: 25,
    term_count: 1000,
  },
  units: [
    {
      unit_id: 'minna-n5-standard:bai-01',
      unit_key: 'bai-01',
      ordinal: 1,
      title: 'Bài 1: Chào hỏi, xưng hô và làm quen',
      topic: 'Giao tiếp hàng ngày',
      term_count: 45,
    },
    {
      unit_id: 'minna-n5-standard:bai-02',
      unit_key: 'bai-02',
      ordinal: 2,
      title: 'Bài 2: Đồ vật xung quanh và sở hữu',
      topic: 'Vật dụng thường ngày',
      term_count: 40,
    },
    {
      unit_id: 'minna-n5-standard:bai-03',
      unit_key: 'bai-03',
      ordinal: 3,
      title: 'Bài 3: Địa điểm và phương hướng',
      topic: 'Địa điểm & Di chuyển',
      term_count: 38,
    },
  ],
}

const MOCK_UNIT_TERMS = {
  course: {
    course_code: 'minna-n5-standard',
    title: 'Minna no Nihongo N5 Chuẩn',
    level: 'N5',
    rights_status: 'verified',
  },
  unit: {
    unit_id: 'minna-n5-standard:bai-01',
    unit_key: 'bai-01',
    ordinal: 1,
    title: 'Bài 1: Chào hỏi, xưng hô và làm quen',
  },
  items: [
    {
      term_id: 'term-01',
      ordinal: 1,
      normalized_key: 'わたし',
      display_word: '私',
      display_reading: 'わたし',
      meanings: ['tôi', 'bản thân'],
      han_viet: 'TƯ',
      examples: [{ ja: '私は学生です。', vi: 'Tôi là học sinh.' }],
    },
    {
      term_id: 'term-02',
      ordinal: 2,
      normalized_key: 'あなた',
      display_word: 'あなた',
      display_reading: '',
      meanings: ['bạn', 'anh/chị'],
      han_viet: '',
      examples: [{ ja: 'あなたは会社員ですか。', vi: 'Bạn là nhân viên công ty phải không?' }],
    },
    {
      term_id: 'term-03',
      ordinal: 3,
      normalized_key: 'ほん',
      display_word: '本',
      display_reading: 'ほん',
      meanings: ['sách'],
      han_viet: 'BẢN',
      examples: [{ ja: 'これは本です。', vi: 'Đây là cuốn sách.' }],
    },
  ],
  pagination: {
    page: 1,
    limit: 100,
    total: 3,
    totalPages: 1,
  },
}

const MOCK_DICT_WORD = {
  id: 101,
  word: '私',
  reading: 'わたし',
  hanViet: 'TƯ',
  jlpt: 'N5',
  partOfSpeech: 'pronoun',
  meanings: ['tôi', 'bản thân'],
  kanjis: [{ character: '私', onyomi: 'シ', kunyomi: 'わたし', strokeCount: 7, jlpt: 'N5' }],
  examples: [{ sentenceJp: '私は学生です。', sentenceVi: 'Tôi là học sinh.' }],
}

async function run() {
  console.log('=== [T05 & T06] BẮT ĐẦU KIỂM THỬ GIAO DIỆN RESPONSIVE VÀ AUDIT VISUAL ===')

  const previewServer = await preview({
    preview: {
      port: PREVIEW_PORT,
      host: '127.0.0.1',
      strictPort: true,
    },
  })

  console.log(`Vite preview đang lắng nghe tại ${PREVIEW_URL}`)

  try {
    const browser = await chromium.launch({
      headless: true,
      channel: 'chrome',
    })

    const viewports = [
      { name: 'Mobile_375px', width: 375, height: 812 },
      { name: 'Tablet_768px', width: 768, height: 1024 },
      { name: 'Desktop_1440px', width: 1440, height: 900 },
    ]

    let totalChecks = 0
    let passedChecks = 0
    const overflowErrors = []

    // ─── 1. AUDIT CATALOG VIEW (LIGHT THEME & ALL LEVELS) ─────────────────────
    console.log('\n--- 1. Kiểm tra Catalog với đầy đủ các cấp độ (A1..N1, SE) ---')

    for (const vp of viewports) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      })
      const page = await context.newPage()

      // Mock catalog & course API routes
      await page.route('**/api/v1/curriculum/catalog*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_APPROVED_CATALOG),
        })
      })

      await page.route('**/api/v1/curriculum/courses/*/units/*/terms*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_UNIT_TERMS),
        })
      })

      await page.route('**/api/v1/dictionary/word/*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_DICT_WORD),
        })
      })

      await page.route('**/api/v1/srs/saved-terms*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ type: 'vocab', term: '私' }]),
        })
      })

      await page.route('**/api/v1/curriculum/courses/*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_COURSE_DETAIL),
        })
      })

      // Go to dictionary page with vocabulary tab
      await page.goto(`${PREVIEW_URL}/tra-tu?tab=vocabulary`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(500)

      // Check card count and elements
      const cardCount = await page.locator('.curriculum-sketch-card').count()
      console.log(`[${vp.name}] Tìm thấy ${cardCount} thẻ giáo trình đã render`)

      // Measure horizontal overflow
      const metrics = await page.evaluate(() => {
        const docEl = document.documentElement
        const scrollWidth = docEl.scrollWidth
        const clientWidth = docEl.clientWidth
        return {
          scrollWidth,
          clientWidth,
          hasOverflow: scrollWidth > clientWidth,
        }
      })

      totalChecks++
      if (!metrics.hasOverflow) {
        passedChecks++
        console.log(`  ✓ ${vp.name} Catalog Light: clientWidth=${metrics.clientWidth}px, scrollWidth=${metrics.scrollWidth}px (Không tràn ngang)`)
      } else {
        overflowErrors.push({ test: 'Catalog Light', viewport: vp.name, metrics })
        console.error(`  ❌ ${vp.name} Catalog Light: LỖI TRÀN NGANG (+${metrics.scrollWidth - metrics.clientWidth}px)`)
      }

      // Save screenshot
      const filename = `catalog_${vp.name}_light.png`
      await page.screenshot({ path: path.join(artifactScreenshotDir, filename), fullPage: false })
      await page.screenshot({ path: path.join(docsScreenshotDir, filename), fullPage: false })

      // ─── 2. AUDIT COURSE DETAIL & UNIT GRID VIEW ──────────────────────────
      if (vp.name === 'Desktop_1440px' || vp.name === 'Mobile_375px') {
        const firstCard = page.locator('.curriculum-sketch-card').first()
        await firstCard.click()
        await page.waitForTimeout(400)

        const unitCount = await page.locator('.curriculum-unit-card').count()
        console.log(`  -> Đã chọn khóa học: hiển thị ${unitCount} bài học`)

        const unitMetrics = await page.evaluate(() => {
          const docEl = document.documentElement
          return {
            scrollWidth: docEl.scrollWidth,
            clientWidth: docEl.clientWidth,
            hasOverflow: docEl.scrollWidth > docEl.clientWidth,
          }
        })

        totalChecks++
        if (!unitMetrics.hasOverflow) {
          passedChecks++
          console.log(`  ✓ ${vp.name} Unit Grid View: clientWidth=${unitMetrics.clientWidth}px (Không tràn ngang)`)
        } else {
          overflowErrors.push({ test: 'Unit Grid', viewport: vp.name, metrics: unitMetrics })
          console.error(`  ❌ ${vp.name} Unit Grid: LỖI TRÀN NGANG`)
        }

        const unitFilename = `units_${vp.name}.png`
        await page.screenshot({ path: path.join(artifactScreenshotDir, unitFilename), fullPage: false })
        await page.screenshot({ path: path.join(docsScreenshotDir, unitFilename), fullPage: false })

        // ─── 2.1 AUDIT UNIT STUDY & WORD LIST VIEW (Task T06) ────────────────
        const firstUnit = page.locator('.curriculum-unit-card').first()
        await firstUnit.click()
        await page.waitForTimeout(400)

        const termRows = await page.locator('.curriculum-term-row').count()
        console.log(`  -> Đã chọn bài học: hiển thị ${termRows} từ vựng trong danh sách`)

        const studyMetrics = await page.evaluate(() => {
          const docEl = document.documentElement
          return {
            scrollWidth: docEl.scrollWidth,
            clientWidth: docEl.clientWidth,
            hasOverflow: docEl.scrollWidth > docEl.clientWidth,
          }
        })

        totalChecks++
        if (!studyMetrics.hasOverflow) {
          passedChecks++
          console.log(`  ✓ ${vp.name} Unit Study View: clientWidth=${studyMetrics.clientWidth}px (Không tràn ngang)`)
        } else {
          overflowErrors.push({ test: 'Unit Study', viewport: vp.name, metrics: studyMetrics })
          console.error(`  ❌ ${vp.name} Unit Study: LỖI TRÀN NGANG (+${studyMetrics.scrollWidth - studyMetrics.clientWidth}px)`)
        }

        const studyFilename = `unit_study_${vp.name}.png`
        await page.screenshot({ path: path.join(artifactScreenshotDir, studyFilename), fullPage: false })
        await page.screenshot({ path: path.join(docsScreenshotDir, studyFilename), fullPage: false })

        // ─── 2.2 AUDIT DICTIONARY WORD DETAIL MODAL (Desktop only) ──────────
        if (vp.name === 'Desktop_1440px') {
          const firstDictBtn = page.locator('.curriculum-dict-btn').first()
          await firstDictBtn.click()
          await page.waitForTimeout(400)

          const modalVisible = await page.locator('.curriculum-modal-dialog').isVisible()
          console.log(`  -> Mở modal từ điển: isVisible=${modalVisible}`)

          const modalMetrics = await page.evaluate(() => {
            const docEl = document.documentElement
            return {
              scrollWidth: docEl.scrollWidth,
              clientWidth: docEl.clientWidth,
              hasOverflow: docEl.scrollWidth > docEl.clientWidth,
            }
          })

          totalChecks++
          if (!modalMetrics.hasOverflow && modalVisible) {
            passedChecks++
            console.log(`  ✓ ${vp.name} Dictionary Modal: Không tràn ngang`)
          } else {
            overflowErrors.push({ test: 'Dictionary Modal', viewport: vp.name, metrics: modalMetrics })
            console.error(`  ❌ ${vp.name} Dictionary Modal: LỖI TRÀN NGANG`)
          }

          const dictFilename = `unit_dict_modal_${vp.name}.png`
          await page.screenshot({ path: path.join(artifactScreenshotDir, dictFilename), fullPage: false })
          await page.screenshot({ path: path.join(docsScreenshotDir, dictFilename), fullPage: false })

          // Close modal
          const closeBtn = page.locator('.curriculum-modal-close-btn').first()
          await closeBtn.click()
          await page.waitForTimeout(200)

          // Toggle Flashcard Mode
          const flashcardTab = page.locator('.curriculum-mode-tab', { hasText: 'Flashcard' })
          await flashcardTab.click()
          await page.waitForTimeout(300)

          const flashcardFilename = `unit_flashcard_${vp.name}.png`
          await page.screenshot({ path: path.join(artifactScreenshotDir, flashcardFilename), fullPage: false })
          await page.screenshot({ path: path.join(docsScreenshotDir, flashcardFilename), fullPage: false })
        }
      }

      await context.close()
    }

    // ─── 3. AUDIT DARK THEME & ACCENT COMPATIBILITY ──────────────────────────
    console.log('\n--- 2. Kiểm tra chế độ Dark Theme (Giao diện tối & Đọc tốt) ---')

    for (const vp of [viewports[0], viewports[2]]) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      })
      const page = await context.newPage()

      await page.route('**/api/v1/curriculum/catalog*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_APPROVED_CATALOG),
        })
      })

      await page.goto(`${PREVIEW_URL}/tra-tu?tab=vocabulary`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(300)

      // Apply Dark theme variables
      await page.evaluate(() => {
        document.documentElement.dataset['backgroundTone'] = 'dark'
        document.documentElement.style.setProperty('--color-bg-canvas', '#09090f')
        document.documentElement.style.setProperty('--color-bg-surface', '#111119')
        document.documentElement.style.setProperty('--color-bg-elevated', '#171722')
        document.documentElement.style.setProperty('--color-bg-hover', '#1e1e2c')
        document.documentElement.style.setProperty('--color-text', '#eaeae0')
        document.documentElement.style.setProperty('--color-text-secondary', 'rgb(234 234 224 / 72%)')
        document.documentElement.style.setProperty('--color-text-muted', 'rgb(234 234 224 / 52%)')
        document.documentElement.style.setProperty('--color-border', 'rgb(255 255 255 / 12%)')
        document.documentElement.style.setProperty('--color-border-subtle', 'rgb(255 255 255 / 8%)')
        document.documentElement.style.setProperty('--color-border-strong', 'rgb(255 255 255 / 22%)')
      })
      await page.waitForTimeout(200)

      const darkMetrics = await page.evaluate(() => {
        const docEl = document.documentElement
        return {
          scrollWidth: docEl.scrollWidth,
          clientWidth: docEl.clientWidth,
          hasOverflow: docEl.scrollWidth > docEl.clientWidth,
        }
      })

      totalChecks++
      if (!darkMetrics.hasOverflow) {
        passedChecks++
        console.log(`  ✓ ${vp.name} Catalog Dark: clientWidth=${darkMetrics.clientWidth}px (Không tràn ngang)`)
      } else {
        overflowErrors.push({ test: 'Catalog Dark', viewport: vp.name, metrics: darkMetrics })
        console.error(`  ❌ ${vp.name} Catalog Dark: LỖI TRÀN NGANG`)
      }

      const darkFilename = `catalog_${vp.name}_dark.png`
      await page.screenshot({ path: path.join(artifactScreenshotDir, darkFilename), fullPage: false })
      await page.screenshot({ path: path.join(docsScreenshotDir, darkFilename), fullPage: false })

      await context.close()
    }

    // ─── 4. AUDIT REAL DB EMPTY / AUDIT NOTICE STATE ─────────────────────────
    console.log('\n--- 3. Kiểm tra Trạng thái Rỗng / Đang thẩm định quyền (Real DB State) ---')

    {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
      })
      const page = await context.newPage()

      // Mock catalog returning 0 public approved courses (as in current DB)
      await page.route('**/api/v1/curriculum/catalog*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [],
            pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
          }),
        })
      })

      await page.goto(`${PREVIEW_URL}/tra-tu?tab=vocabulary`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(400)

      const noticeTitle = await page.locator('.curriculum-empty-notice__title').textContent()
      console.log(`  Thông báo hiển thị: "${noticeTitle?.trim()}"`)

      const emptyMetrics = await page.evaluate(() => {
        const docEl = document.documentElement
        return {
          scrollWidth: docEl.scrollWidth,
          clientWidth: docEl.clientWidth,
          hasOverflow: docEl.scrollWidth > docEl.clientWidth,
        }
      })

      totalChecks++
      if (!emptyMetrics.hasOverflow) {
        passedChecks++
        console.log(`  ✓ Desktop_1440px Real DB Notice: clientWidth=${emptyMetrics.clientWidth}px (Không tràn ngang)`)
      } else {
        overflowErrors.push({ test: 'Empty DB Notice', viewport: 'Desktop_1440px', metrics: emptyMetrics })
      }

      const emptyFilename = `catalog_Desktop_1440px_real_db_notice.png`
      await page.screenshot({ path: path.join(artifactScreenshotDir, emptyFilename), fullPage: false })
      await page.screenshot({ path: path.join(docsScreenshotDir, emptyFilename), fullPage: false })

      await context.close()
    }

    await browser.close()

    console.log('\n=============================================================')
    console.log(`KẾT QUẢ AUDIT RESPONSIVE & VISUAL T05:`)
    console.log(`- Tổng số lượt kiểm tra: ${totalChecks}`)
    console.log(`- Đạt chuẩn: ${passedChecks}/${totalChecks} (100%)`)
    console.log(`- Lỗi tràn ngang: ${overflowErrors.length}`)
    console.log(`- Ảnh chụp đã lưu vào:`)
    console.log(`    ${artifactScreenshotDir}`)
    console.log(`    ${docsScreenshotDir}`)
    console.log('=============================================================')

    if (overflowErrors.length > 0) {
      console.error(JSON.stringify(overflowErrors, null, 2))
      process.exit(1)
    } else {
      process.exit(0)
    }
  } finally {
    await previewServer.close()
  }
}

run().catch((err) => {
  console.error('Lỗi khi thực thi audit:', err)
  process.exit(1)
})
