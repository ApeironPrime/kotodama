import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const OUTPUT_PATH = path.resolve('data/jlpt_n3_listening_master.json')

async function auditAndCrawlListening() {
  console.log('--- 1. AUDIT & CRAWL CHÍNH XÁC PHẦN NGHE JLPT N3 TỪ CORODOMO ---')

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()

  try {
    await page.goto('https://corodomo.com/practice/exams?id=jlpt-n3', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })
    await page.waitForTimeout(3000)

    const examCards = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/practice/exams/jlpt?id="]'))
      const seen = new Set()
      const list = []
      for (const a of links) {
        const href = a.href
        const match = href.match(/id=([a-z0-9]+)/i)
        if (match && !seen.has(match[1])) {
          seen.add(match[1])
          const rawText = a.innerText.trim()
          const lines = rawText
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
          const title = lines.find((l) => l.includes('JLPT-N3') && l.includes('20')) || lines[0] || 'JLPT N3'
          list.push({ id: match[1], url: href, title })
        }
      }
      return list
    })

    console.log(`Tìm thấy ${examCards.length} đề thi N3 trên Corodomo:`)

    const cleanedListeningExams = []

    for (let i = 0; i < examCards.length; i++) {
      const card = examCards[i]

      const result = await page.evaluate(async (examId) => {
        try {
          const r1 = await fetch('/api/exam/' + examId)
          const j1 = await r1.json()
          const r2 = await fetch('/api/exam/question?examId=' + examId)
          const j2 = await r2.json()
          return { exam: j1.data, sets: j2.data || [] }
        } catch (e) {
          return { error: e.message }
        }
      }, card.id)

      if (!result.sets || result.sets.length === 0) {
        console.warn(`[${card.title}] Không lấy được câu hỏi!`)
        continue
      }

      // Tìm Audio URL chuẩn
      let audioUrl = ''
      const rawString = JSON.stringify(result)
      const matchAudio =
        rawString.match(/https:\/\/firebasestorage\.googleapis\.com\/[^"'\s]+\.(?:m4a|mp3)\?[^"'\s]*/i) ||
        rawString.match(/https:\/\/[^"'\s]+\.(?:m4a|mp3)/i)
      if (matchAudio) {
        audioUrl = matchAudio[0].replace(/\\u0026/g, '&')
      }

      // LỌC CHÍNH XÁC CHỈ CÁC QUESTION SET THUỘC PHẦN NGHE (MONDAI 1 ĐẾN 5)
      // Các question set nghe của JLPT N3 luôn bắt đầu bằng chỉ dẫn Mondai nghe:
      const listeningSets = result.sets.filter((set) => {
        const t = (set.question || '').toLowerCase()
        return (
          t.includes('問題1では、まず質問') ||
          t.includes('問題2では、まず質問') ||
          t.includes('問題3では、問題用紙') ||
          (t.includes('問題4') && t.includes('えを見')) ||
          t.includes('問題5では、問題用紙')
        )
      })

      // Nếu bộ lọc theo text không đủ 5 set, fallback lấy 5 set cuối cùng nếu tổng sets >= 17
      let finalSets = listeningSets
      if (finalSets.length < 5 && result.sets.length >= 17) {
        finalSets = result.sets.slice(12)
      }

      let globalQuestionNumber = 1
      const examQuestions = []
      const parts = []

      finalSets.forEach((set, sIdx) => {
        const mondaiNum = sIdx + 1
        const rawMondaiTitle = (set.question || '').replace(/<[^>]+>/g, '').trim()
        const questionsInSet = set.questions || []
        const partQuestions = []

        // Sắp xếp câu hỏi trong set theo index tăng dần
        questionsInSet.sort((a, b) => (a.index || 0) - (b.index || 0))

        questionsInSet.forEach((q) => {
          let image = null
          let cleanQuestion = q.question || ''
          const imgMatch = cleanQuestion.match(/<img[^>]+src=["']([^"']+)["']/i)
          if (imgMatch) {
            image = imgMatch[1]
            cleanQuestion = cleanQuestion
              .replace(/<img[^>]+>/gi, '')
              .replace(/<br\s*\/?>/gi, '')
              .trim()
          }

          // Options
          let options = []
          if (Array.isArray(q.options) && q.options.length > 0) {
            options = q.options.map((opt) => ({
              id: String(opt.id),
              text: opt.value || opt.text || String(opt.id),
            }))
          } else {
            // Đối với Mondai 3, 4, 5 khi không in phương án thì hiển thị lựa chọn 1, 2, 3 (hoặc 4)
            const count = mondaiNum === 4 || mondaiNum === 5 ? 3 : 4
            options = Array.from({ length: count }, (_, oIdx) => ({
              id: String(oIdx + 1),
              text: `${oIdx + 1}`,
            }))
          }

          // Script
          let cleanScript = q.script || ''
          if (cleanScript.startsWith('Tham khảo:')) {
            cleanScript = cleanScript.replace(/^Tham khảo:\s*/, '').trim()
          }
          cleanScript = cleanScript
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/\n\s*\n+/g, '\n\n')
            .trim()

          const questionObj = {
            id: q.id || `q_${card.id}_m${mondaiNum}_${globalQuestionNumber}`,
            mondai: `Mondai ${mondaiNum}`,
            mondaiInstruction: rawMondaiTitle,
            number: globalQuestionNumber,
            question: cleanQuestion.replace(/番$/, '').trim()
              ? `${globalQuestionNumber} 番: ${cleanQuestion}`
              : `${globalQuestionNumber} 番`,
            sentence: cleanQuestion.replace(/番$/, '').trim()
              ? `${globalQuestionNumber} 番: ${cleanQuestion}`
              : `${globalQuestionNumber} 番`,
            image,
            options,
            answer: String(q.correctAnswer || '1'),
            correctAnswer: String(q.correctAnswer || '1'),
            script: cleanScript,
            explanation: q.explanation || null,
            score: q.score || (mondaiNum <= 2 ? 3 : 2),
          }

          examQuestions.push(questionObj)
          partQuestions.push(questionObj)
          globalQuestionNumber++
        })

        parts.push({
          title: `Mondai ${mondaiNum}`,
          titleJP: `第${mondaiNum}問`,
          instruction: rawMondaiTitle,
          questions: partQuestions,
        })
      })

      const totalImages = examQuestions.filter((q) => q.image).length
      console.log(
        `✅ [${i + 1}/${examCards.length}] ${card.title}: ${examQuestions.length} câu hỏi (${parts.length} Mondai) • ${totalImages} ảnh minh họa • Audio: ${audioUrl ? 'OK' : 'Thiếu'}`
      )

      cleanedListeningExams.push({
        id: `n3-listening-${card.id}`,
        originalId: card.id,
        title: `${card.title} - Phần Nghe Hiểu (聴解)`,
        year: card.title.replace('JLPT-N3', '').trim(),
        level: 'N3',
        section: 'listening',
        sectionLabel: 'Nghe hiểu',
        sectionLabelJP: '聴解',
        timeLimit: 40,
        questionCount: examQuestions.length,
        audioUrl,
        parts,
        questions: examQuestions,
      })
    }

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(cleanedListeningExams, null, 2), 'utf8')
    console.log(`\n🎉 Đã lưu ${cleanedListeningExams.length} đề thi nghe N3 chuẩn xác vào: ${OUTPUT_PATH}`)
  } catch (err) {
    console.error('❌ Lỗi:', err)
  } finally {
    await browser.close()
  }
}

auditAndCrawlListening()
