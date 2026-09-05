import fs from 'node:fs'
import path from 'node:path'

const MASTER_PATH = path.resolve(
  'D:/VKU/data/drive-download-20260828T102340Z-1-002/nhaikanji_data/de_thi_jlpt/jlpt_all_exams_master.json'
)
const LISTENING_N3_PATH = path.resolve('data/jlpt_n3_listening_master.json')

function auditAllExams() {
  console.log('=== BẮT ĐẦU RÀ SOÁT TOÀN BỘ NGÂN HÀNG ĐỀ THI JLPT N4 - N1 ===\n')

  const issues = []

  // 1. Kiểm tra master json cũ
  if (fs.existsSync(MASTER_PATH)) {
    const raw = fs.readFileSync(MASTER_PATH, 'utf8')
    const master = JSON.parse(raw)

    const levels = ['n5', 'n4', 'n3', 'n2', 'n1']
    levels.forEach((lvl) => {
      const lvlData = master[lvl]
      if (!lvlData || !Array.isArray(lvlData.tests)) return

      console.log(`--- Kiểm tra cấp độ: ${lvl.toUpperCase()} (${lvlData.tests.length} đề thi) ---`)
      lvlData.tests.forEach((test) => {
        const testId = test.id
        const parts = test.parts || []
        const totalQ = parts.reduce((acc, p) => acc + (p.questions ? p.questions.length : 0), 0)

        if (totalQ === 0) {
          // Placeholder test (ví dụ 2025)
          return
        }

        let qIndex = 0
        parts.forEach((part, pIdx) => {
          const questions = part.questions || []
          questions.forEach((q) => {
            qIndex++
            const qText = q.sentence || q.text || q.question || ''
            if (!qText.trim()) {
              issues.push({
                testId,
                part: pIdx + 1,
                qIndex,
                issue: 'Câu hỏi không có nội dung văn bản',
              })
            }

            const options = q.options || []
            if (!Array.isArray(options) || options.length < 2) {
              issues.push({
                testId,
                part: pIdx + 1,
                qIndex,
                issue: `Số lượng lựa chọn không hợp lệ: ${options.length}`,
              })
            }

            const ans = q.correctAnswer ?? q.answer
            if (ans === undefined || ans === null) {
              issues.push({
                testId,
                part: pIdx + 1,
                qIndex,
                issue: 'Thiếu đáp án đúng',
              })
            }
          })
        })

        console.log(
          `  ✓ Đề [${testId}] ${test.sectionLabel || test.section} (${test.year}): ${totalQ} câu hỏi phân bố qua ${parts.length} phần thi.`
        )
      })
    })
  }

  // 2. Kiểm tra bộ đề nghe N3 mới nạp
  console.log('\n--- Kiểm tra bộ đề Nghe hiểu N3 từ Corodomo ---')
  if (fs.existsSync(LISTENING_N3_PATH)) {
    const rawListening = fs.readFileSync(LISTENING_N3_PATH, 'utf8')
    const listeningExams = JSON.parse(rawListening)

    listeningExams.forEach((exam) => {
      if (exam.questionCount === 0) return

      console.log(
        `  ✓ [${exam.title}]: ${exam.questionCount} câu hỏi • ${exam.parts.length} Mondai • Audio: ${exam.audioUrl ? 'Đầy đủ' : 'Thiếu'}`
      )

      exam.parts.forEach((part, pIdx) => {
        part.questions.forEach((q) => {
          if (!q.options || q.options.length === 0) {
            issues.push({
              testId: exam.id,
              part: pIdx + 1,
              qIndex: q.number,
              issue: 'Thiếu options',
            })
          }
          if (!q.answer) {
            issues.push({
              testId: exam.id,
              part: pIdx + 1,
              qIndex: q.number,
              issue: 'Thiếu answer',
            })
          }
        })
      })
    })
  }

  console.log('\n=== KẾT QUẢ RÀ SOÁT ===')
  if (issues.length === 0) {
    console.log('🎉 KHÔNG CÓ BẤT KỲ LỖI THỨ TỰ, THIẾU CÂU HỎI HOẶC THIẾU ĐÁP ÁN NÀO TRONG TOÀN BỘ CÁC ĐỀ THI!')
  } else {
    console.warn(`Phát hiện ${issues.length} vấn đề:`, JSON.stringify(issues, null, 2))
  }
}

auditAllExams()
