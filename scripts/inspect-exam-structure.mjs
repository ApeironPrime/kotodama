import { chromium } from 'playwright'

async function inspectExam() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  await page.goto('https://corodomo.com/practice/exams/jlpt?id=cm2u2y69r01gd134iqiw21op8', {
    waitUntil: 'networkidle',
  })

  const details = await page.evaluate(async () => {
    const examRes = await fetch('/api/exam/cm2u2y69r01gd134iqiw21op8')
    const examJson = await examRes.json()

    // Let's check questionSets or sections in examJson.data
    const exam = examJson.data || {}

    // Fetch questions
    const qRes = await fetch('/api/exam/question?examId=cm2u2y69r01gd134iqiw21op8')
    const qJson = await qRes.json()

    return {
      examKeys: Object.keys(exam),
      sections: exam.sections || exam.parts || null,
      questionSetIds: exam.questionSetIds?.length,
      sampleQuestion: qJson.data?.[0],
      totalQuestionsReturned: qJson.data?.length,
      allQuestionsSummary: (qJson.data || []).map((q) => ({
        id: q.id,
        index: q.index,
        questionSetId: q.questionSetId,
        hasScript: !!q.script,
        hasImg: (q.question || '').includes('<img'),
        qSnippet: (q.question || '').slice(0, 50),
      })),
    }
  })

  console.log('Exam structure:', JSON.stringify(details, null, 2))
  await browser.close()
}

inspectExam()
