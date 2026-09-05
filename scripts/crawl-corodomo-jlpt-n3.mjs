import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const OUTPUT_PATH = path.resolve('data/jlpt_n3_listening_master.json')

async function crawlAllN3Exams() {
  console.log('🚀 [Fast Crawler] Bắt đầu cào toàn bộ 18 đề thi nghe JLPT N3 từ Corodomo...')

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })

  try {
    console.log('1. Truy cập https://corodomo.com/practice/exams?id=jlpt-n3 ...')
    await page.goto('https://corodomo.com/practice/exams?id=jlpt-n3', {
      waitUntil: 'networkidle',
      timeout: 30000,
    })

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

    console.log(`✅ Tìm thấy ${examCards.length} bộ đề N3!`)
    const allListeningExams = []

    for (let i = 0; i < examCards.length; i++) {
      const card = examCards[i]
      console.log(`\n⏳ [${i + 1}/${examCards.length}] Đang xử lý: ${card.title} (${card.id})...`)

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

      if (result.error || !result.sets) {
        console.error(`   ❌ Lỗi khi lấy API đề ${card.id}:`, result.error)
        continue
      }

      // Tìm link audio trong exam hoặc các sets
      let audioUrl = ''
      const rawString = JSON.stringify(result)
      const matchAudio =
        rawString.match(/https:\/\/firebasestorage\.googleapis\.com\/[^"'\s]+\.(?:m4a|mp3)\?[^"'\s]*/i) ||
        rawString.match(/https:\/\/[^"'\s]+\.(?:m4a|mp3)/i)
      if (matchAudio) {
        audioUrl = matchAudio[0].replace(/\\u0026/g, '&')
      }

      // Trích xuất các câu hỏi nghe (từ các question set có script hoặc là 5 set nghe cuối)
      const allListeningQuestions = []
      const listeningSets = result.sets.filter((set) => {
        const title = (set.question || '').toLowerCase()
        const hasScriptInQuestions = (set.questions || []).some((q) => q.script)
        return (
          hasScriptInQuestions ||
          title.includes('まず質問を聞いてください') ||
          title.includes('問題用紙に何もいんさつされていません') ||
          title.includes('えを見ながら質問を聞いてください')
        )
      })

      listeningSets.forEach((set, sIdx) => {
        const mondaiTitle = (set.question || '').replace(/<[^>]+>/g, '').trim()
        const questionsInSet = set.questions || []

        questionsInSet.forEach((q, qIdx) => {
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

          const options = (q.options || []).map((opt) => ({
            id: String(opt.id),
            text: opt.value || opt.text || String(opt.id),
          }))

          let cleanScript = q.script || ''
          if (cleanScript.startsWith('Tham khảo:')) {
            cleanScript = cleanScript.replace(/^Tham khảo:\s*/, '').trim()
          }
          cleanScript = cleanScript
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/\n\s*\n+/g, '\n\n')
            .trim()

          allListeningQuestions.push({
            id: q.id || `q_${card.id}_m${sIdx + 1}_${qIdx + 1}`,
            mondai: `Mondai ${sIdx + 1}`,
            mondaiInstruction: mondaiTitle,
            number: q.index || allListeningQuestions.length + 1,
            question: cleanQuestion || `${q.index || allListeningQuestions.length + 1} 番`,
            image,
            options,
            answer: String(q.correctAnswer || '1'),
            script: cleanScript,
            explanation: q.explanation || null,
            score: q.score || 2,
          })
        })
      })

      // Nếu không tìm thấy bằng regex, thử format url audio dự phòng theo mã năm (chuẩn Corodomo)
      if (!audioUrl) {
        // ví dụ: "JLPT-N3 12 2023" -> 202312
        const yearMatch = card.title.match(/(\d{2})\s+(\d{4})/)
        if (yearMatch) {
          const yearMonth = `${yearMatch[2]}${yearMatch[1]}`
          audioUrl = `https://firebasestorage.googleapis.com/v0/b/corodomopro.appspot.com/o/jlpt-n3-${yearMonth}.m4a?alt=media`
        }
      }

      console.log(
        `   ✅ ${card.title}: Trích xuất thành công ${allListeningQuestions.length} câu hỏi nghe (${listeningSets.length} mondai).`
      )
      console.log(`   🎧 Audio: ${audioUrl ? audioUrl.slice(0, 80) + '...' : 'Chưa có'}`)

      allListeningExams.push({
        id: `n3-listening-${card.id}`,
        originalId: card.id,
        title: `${card.title} - Phần Nghe Hiểu (聴解)`,
        year: card.title.replace('JLPT-N3', '').trim(),
        level: 'N3',
        section: 'listening',
        sectionName: '聴解 (Nghe hiểu)',
        durationMinutes: 40,
        questionCount: allListeningQuestions.length,
        audioUrl,
        questions: allListeningQuestions,
      })
    }

    // Ghi ra file JSON
    const outDir = path.dirname(OUTPUT_PATH)
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allListeningExams, null, 2), 'utf8')

    console.log(`\n🎉 HOÀN TẤT CÀO ${allListeningExams.length} BỘ ĐỀ NGHE N3!`)
    console.log(`📁 File lưu tại: ${OUTPUT_PATH}`)
  } catch (err) {
    console.error('❌ Lỗi:', err)
  } finally {
    await browser.close()
  }
}

crawlAllN3Exams()
