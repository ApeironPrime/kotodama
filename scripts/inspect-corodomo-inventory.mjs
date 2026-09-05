import { chromium } from 'playwright'

async function inspectInventory() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  const levels = ['jlpt-n1', 'jlpt-n2', 'jlpt-n3', 'jlpt-n4', 'jlpt-n5']
  const summary = {}

  for (const lvl of levels) {
    await page.goto('https://corodomo.com/practice/exams?id=' + lvl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })
    await page.waitForTimeout(2000)

    const exams = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/practice/exams/jlpt?id="]'))
      const seen = new Set()
      const list = []
      for (const a of links) {
        const m = a.href.match(/id=([a-z0-9]+)/i)
        if (m && !seen.has(m[1])) {
          seen.add(m[1])
          const lines = a.innerText
            .trim()
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
          list.push({ id: m[1], title: lines[0] || 'Exam' })
        }
      }
      return list
    })

    summary[lvl] = { count: exams.length, sample: exams.slice(0, 3) }
  }

  console.log('Corodomo Exam Inventory:', JSON.stringify(summary, null, 2))

  // Inspect 1 sample exam structure from N1, N2, N3, N4, N5
  for (const lvl of levels) {
    const sampleExam = summary[lvl]?.sample?.[0]
    if (sampleExam) {
      const sets = await page.evaluate(async (examId) => {
        const r = await fetch('/api/exam/question?examId=' + examId)
        const j = await r.json()
        return (j.data || []).map((s, idx) => ({
          idx: idx + 1,
          qCount: s.questions?.length,
          title: (s.question || '').slice(0, 60),
        }))
      }, sampleExam.id)
      console.log(`\n--- [${lvl.toUpperCase()}] ${sampleExam.title} (${sets.length} Sets) ---`)
      sets.forEach((s) => console.log(`  Set ${s.idx}: ${s.qCount} questions | ${s.title}`))
    }
  }

  await browser.close()
}

inspectInventory()
