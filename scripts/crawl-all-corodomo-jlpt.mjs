import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const OUTPUT_PATH = path.resolve('data/jlpt_full_master.json')

// Helper phân loại các Set câu hỏi trong đề thi Corodomo
function classifySets(sets) {
  const vocabSets = []
  const grammarReadingSets = []
  const listeningSets = []

  sets.forEach((set, sIdx) => {
    const rawQuestion = (set.question || '').toLowerCase()

    // 1. Nhận diện phần Nghe hiểu (聴解)
    if (
      rawQuestion.includes('まず質問を聞いて') ||
      rawQuestion.includes('問題用紙に何も印刷') ||
      rawQuestion.includes('問題用紙に何もいんさつ') ||
      rawQuestion.includes('えを見ながら質問') ||
      rawQuestion.includes('絵を見ながら質問') ||
      rawQuestion.includes('長めの話を聞きます')
    ) {
      listeningSets.push({ set, sIdx })
      return
    }

    // 2. Nhận diện phần Từ vựng (文字・語彙)
    if (
      rawQuestion.includes('読み方') ||
      rawQuestion.includes('ひらがなで') ||
      rawQuestion.includes('漢字で書く') ||
      rawQuestion.includes('どう書きますか') ||
      rawQuestion.includes('どう かきますか') ||
      rawQuestion.includes('意味が最も近い') ||
      rawQuestion.includes('おなじ いみ') ||
      rawQuestion.includes('ことばの使い方') ||
      rawQuestion.includes('つかいかた') ||
      (sIdx <= 4 && (rawQuestion.includes('入れるのに最もよい') || rawQuestion.includes('なにを いれますか')))
    ) {
      vocabSets.push({ set, sIdx })
      return
    }

    // 3. Phần Ngữ pháp & Đọc hiểu (文法・読解)
    grammarReadingSets.push({ set, sIdx })
  })

  return { vocabSets, grammarReadingSets, listeningSets }
}

function parsePart(setObj, mondaiNum) {
  const set = setObj.set
  let passage = (set.content && set.content.trim()) || null
  let instruction = (set.question || '').trim()

  // Bóc tách bài đọc (Passage) nếu có trong instruction
  if (!passage && (instruction.includes('<p>') || instruction.length > 250)) {
    passage = instruction
    const pIndex = instruction.indexOf('<p>')
    if (pIndex > 0) {
      instruction = instruction
        .substring(0, pIndex)
        .replace(/<[^>]+>/g, '')
        .trim()
    }
  } else {
    instruction = instruction.replace(/<[^>]+>/g, '').trim()
  }

  const rawQuestions = set.questions || []
  rawQuestions.sort((a, b) => (a.index || 0) - (b.index || 0))

  const questions = rawQuestions.map((q, qIdx) => {
    let cleanQuestion = q.question || ''
    let image = null

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
      options = [
        { id: '1', text: '1' },
        { id: '2', text: '2' },
        { id: '3', text: '3' },
        { id: '4', text: '4' },
      ]
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

    return {
      id: q.id || `q_m${mondaiNum}_${qIdx + 1}`,
      number: q.index || qIdx + 1,
      question: cleanQuestion,
      sentence: cleanQuestion,
      image,
      options,
      answer: String(q.correctAnswer || '1'),
      correctAnswer: String(q.correctAnswer || '1'),
      script: cleanScript || null,
      explanation: q.explanation || null,
      score: q.score || 1,
    }
  })

  return {
    title: `Mondai ${mondaiNum}`,
    titleJP: `第${mondaiNum}問`,
    instruction,
    passage,
    questions,
  }
}

async function crawlAllCorodomo() {
  console.log('=== BẮT ĐẦU CÀO TOÀN BỘ NGÂN HÀNG ĐỀ THI JLPT N1 - N5 TỪ CORODOMO ===')

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  const levels = ['jlpt-n1', 'jlpt-n2', 'jlpt-n3', 'jlpt-n4', 'jlpt-n5']
  const allMasterExams = []

  for (const lvlKey of levels) {
    const levelUpper = lvlKey.replace('jlpt-', '').toUpperCase()
    console.log(`\n================== [ CẤP ĐỘ ${levelUpper} ] ==================`)

    try {
      await page.goto(`https://corodomo.com/practice/exams?id=${lvlKey}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })
      await page.waitForTimeout(2500)

      const examCards = await page.evaluate(() => {
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
            const title = lines.find((l) => l.includes('JLPT') && l.includes('20')) || lines[0] || 'JLPT Exam'
            list.push({ id: m[1], title })
          }
        }
        return list
      })

      console.log(`Tìm thấy ${examCards.length} đề thi cấp độ ${levelUpper}`)

      for (let i = 0; i < examCards.length; i++) {
        const card = examCards[i]
        try {
          const result = await page.evaluate(async (examId) => {
            const r1 = await fetch('/api/exam/' + examId)
            const j1 = await r1.json()
            const r2 = await fetch('/api/exam/question?examId=' + examId)
            const j2 = await r2.json()
            return { exam: j1.data, sets: j2.data || [] }
          }, card.id)

          const sets = result.sets || []
          if (sets.length === 0) continue

          // Lấy Audio URL
          let audioUrl = ''
          const rawString = JSON.stringify(result)
          const matchAudio =
            rawString.match(/https:\/\/firebasestorage\.googleapis\.com\/[^"'\s]+\.(?:m4a|mp3)\?[^"'\s]*/i) ||
            rawString.match(/https:\/\/[^"'\s]+\.(?:m4a|mp3)/i)
          if (matchAudio) {
            audioUrl = matchAudio[0].replace(/\\u0026/g, '&')
          }

          const { vocabSets, grammarReadingSets, listeningSets } = classifySets(sets, levelUpper)

          // 1. Tạo Đề Từ Vựng (文字・語彙)
          if (vocabSets.length > 0) {
            const parts = vocabSets.map((s, idx) => parsePart(s, idx + 1))
            const totalQ = parts.reduce((acc, p) => acc + p.questions.length, 0)
            if (totalQ > 0) {
              allMasterExams.push({
                id: `${card.id}-vocab`,
                title: `${card.title} - Từ Vựng (文字・語彙)`,
                level: levelUpper,
                year: card.title.replace(/JLPT-N\d/i, '').trim(),
                section: 'vocab',
                sectionLabel: 'Từ vựng',
                sectionLabelJP: '文字・語彙',
                timeLimit: levelUpper === 'N1' ? 30 : levelUpper === 'N2' ? 30 : levelUpper === 'N3' ? 30 : 25,
                questionCount: totalQ,
                parts,
              })
            }
          }

          // 2. Tạo Đề Ngữ Pháp - Đọc Hiểu (文法・読解)
          if (grammarReadingSets.length > 0) {
            const parts = grammarReadingSets.map((s, idx) => parsePart(s, idx + 1))
            const totalQ = parts.reduce((acc, p) => acc + p.questions.length, 0)
            if (totalQ > 0) {
              allMasterExams.push({
                id: `${card.id}-grammar-reading`,
                title: `${card.title} - Ngữ Pháp & Đọc Hiểu (文法・読解)`,
                level: levelUpper,
                year: card.title.replace(/JLPT-N\d/i, '').trim(),
                section: 'grammar-reading',
                sectionLabel: 'Ngữ pháp - Đọc hiểu',
                sectionLabelJP: '文法・読解',
                timeLimit: levelUpper === 'N1' ? 80 : levelUpper === 'N2' ? 75 : levelUpper === 'N3' ? 70 : 50,
                questionCount: totalQ,
                parts,
              })
            }
          }

          // 3. Tạo Đề Nghe Hiểu (聴解)
          if (listeningSets.length > 0) {
            const parts = listeningSets.map((s, idx) => parsePart(s, idx + 1))
            const totalQ = parts.reduce((acc, p) => acc + p.questions.length, 0)
            if (totalQ > 0) {
              allMasterExams.push({
                id: `${card.id}-listening`,
                title: `${card.title} - Nghe Hiểu (聴解)`,
                level: levelUpper,
                year: card.title.replace(/JLPT-N\d/i, '').trim(),
                section: 'listening',
                sectionLabel: 'Nghe hiểu',
                sectionLabelJP: '聴解',
                timeLimit: levelUpper === 'N1' ? 60 : levelUpper === 'N2' ? 50 : levelUpper === 'N3' ? 40 : 30,
                questionCount: totalQ,
                audioUrl,
                parts,
              })
            }
          }

          console.log(
            `  ✓ [${i + 1}/${examCards.length}] ${card.title}: Vocab (${vocabSets.length} mondai) | Grammar-Reading (${grammarReadingSets.length} mondai) | Listening (${listeningSets.length} mondai) • Audio: ${audioUrl ? 'OK' : 'Không có'}`
          )
        } catch (cardErr) {
          console.warn(`  x Lỗi đề ${card.title}:`, cardErr.message)
        }
      }
    } catch (lvlErr) {
      console.error(`Lỗi cào cấp độ ${levelUpper}:`, lvlErr.message)
    }
  }

  await browser.close()

  console.log(`\n🎉 TỔNG CỘNG ĐÃ TỔNG HỢP ${allMasterExams.length} ĐỀ THI ĐẦY ĐỦ CHO TẤT CẢ CÁC CẤP ĐỘ N1 - N5!`)
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allMasterExams, null, 2), 'utf8')
  console.log(`Đã lưu vào file master: ${OUTPUT_PATH}`)
}

crawlAllCorodomo()
