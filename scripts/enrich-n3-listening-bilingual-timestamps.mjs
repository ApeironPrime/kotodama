import fs from 'node:fs'
import path from 'node:path'

const MASTER_FILE = path.resolve('data/jlpt_full_master.json')

// Timeline tiêu chuẩn của 28 câu trong đề thi nghe JLPT N3 (tổng ~35 phút = 2100s)
const N3_TIMELINE = [
  // Mondai 1 (6 câu)
  { num: 1, start: 45, end: 115 },
  { num: 2, start: 115, end: 185 },
  { num: 3, start: 185, end: 255 },
  { num: 4, start: 255, end: 325 },
  { num: 5, start: 325, end: 395 },
  { num: 6, start: 395, end: 470 },

  // Mondai 2 (6 câu)
  { num: 7, start: 505, end: 585 },
  { num: 8, start: 585, end: 665 },
  { num: 9, start: 665, end: 745 },
  { num: 10, start: 745, end: 825 },
  { num: 11, start: 825, end: 905 },
  { num: 12, start: 905, end: 990 },

  // Mondai 3 (3 câu)
  { num: 13, start: 1025, end: 1105 },
  { num: 14, start: 1105, end: 1185 },
  { num: 15, start: 1185, end: 1270 },

  // Mondai 4 (4 câu)
  { num: 16, start: 1300, end: 1360 },
  { num: 17, start: 1360, end: 1420 },
  { num: 18, start: 1420, end: 1480 },
  { num: 19, start: 1480, end: 1550 },

  // Mondai 5 (9 câu)
  { num: 20, start: 1580, end: 1635 },
  { num: 21, start: 1635, end: 1690 },
  { num: 22, start: 1690, end: 1745 },
  { num: 23, start: 1745, end: 1800 },
  { num: 24, start: 1800, end: 1855 },
  { num: 25, start: 1855, end: 1910 },
  { num: 26, start: 1910, end: 1965 },
  { num: 27, start: 1965, end: 2020 },
  { num: 28, start: 2020, end: 2085 },
]

function getEnvApiKey() {
  if (fs.existsSync('.env')) {
    const env = Object.fromEntries(
      fs
        .readFileSync('.env', 'utf8')
        .split('\n')
        .filter((l) => l.includes('='))
        .map((l) => {
          const idx = l.indexOf('=')
          return [l.substring(0, idx).trim(), l.substring(idx + 1).trim()]
        })
    )
    return env.GEMINI_API_KEY
  }
  return null
}

const apiKey = getEnvApiKey()

// Hàm dịch một đoạn hội thoại sang tiếng Việt chuẩn JLPT
async function translateScriptToVietnamese(jaScript) {
  if (!jaScript || jaScript.trim().length === 0) return ''
  if (!apiKey) return ''

  const prompt = `Bạn là chuyên gia dịch đề thi JLPT tiếng Nhật sang tiếng Việt. Hãy dịch chính xác, tự nhiên, sát nghĩa đoạn Lời thoại (Script) sau sang tiếng Việt. 
Yêu cầu:
- Chỉ trả về duy nhất nội dung bản dịch tiếng Việt, giữ nguyên cấu trúc phân vai (Nam: / Nữ: / Người dẫn chuyện:).
- Không thêm bất kỳ lời giải thích nào khác.

Đoạn tiếng Nhật:
${jaScript}`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    )
    const json = await res.json()
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    return text || ''
  } catch (err) {
    console.warn('Lỗi gọi AI dịch:', err.message)
    return ''
  }
}

// Bóc tách script thành các câu / lượt nói (turn-by-turn dialogue)
function parseDialogueSegments(jaScript, viScript, qStart, qEnd) {
  if (!jaScript) return []

  const jaLines = jaScript
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  const viLines = (viScript || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  const duration = Math.max(10, qEnd - qStart)
  const lineDuration = duration / Math.max(1, jaLines.length)

  return jaLines.map((jaLine, idx) => {
    const start = Math.round(qStart + idx * lineDuration)
    const end = Math.round(start + lineDuration)
    const viLine = viLines[idx] || ''

    return {
      start,
      end,
      ja: jaLine,
      vi: viLine,
    }
  })
}

async function main() {
  console.log('=== BẮT ĐẦU NÂNG CẤP TRANSCRIPT SONG NGỮ & MỐC THỜI GIAN ĐỀ NGHE N3 ===')
  const fullMaster = JSON.parse(fs.readFileSync(MASTER_FILE, 'utf8'))
  const n3ListeningExams = fullMaster.filter((e) => e.level === 'N3' && e.section === 'listening')

  console.log(`Tìm thấy ${n3ListeningExams.length} đề thi nghe N3 cần nâng cấp.`)

  let totalUpdatedQuestions = 0

  for (let eIdx = 0; eIdx < n3ListeningExams.length; eIdx++) {
    const exam = n3ListeningExams[eIdx]
    console.log(`\n[${eIdx + 1}/${n3ListeningExams.length}] Đang xử lý: ${exam.title}...`)

    let runningQNum = 1
    if (Array.isArray(exam.parts)) {
      for (const part of exam.parts) {
        if (Array.isArray(part.questions)) {
          for (const q of part.questions) {
            const num = runningQNum
            runningQNum++

            const timeSlot = N3_TIMELINE.find((t) => t.num === num) || {
              start: (num - 1) * 75,
              end: num * 75,
            }

            q.audioStart = timeSlot.start
            q.audioEnd = timeSlot.end

            // Nếu câu này có script và chưa có bản dịch tiếng Việt, tiến hành dịch
            if (q.script && (!q.scriptVi || q.scriptVi.length === 0)) {
              process.stdout.write(`  - Dịch câu ${num}... `)
              const vi = await translateScriptToVietnamese(q.script)
              q.scriptVi = vi
              process.stdout.write(`✓ (${vi.length} ký tự)\n`)
              // Nghỉ ngắn để tránh rate limit
              await new Promise((r) => setTimeout(r, 150))
            }

            // Tạo danh sách các phân đoạn hội thoại song ngữ kèm timestamp
            q.audioSegments = parseDialogueSegments(q.script, q.scriptVi, q.audioStart, q.audioEnd)
            totalUpdatedQuestions++
          }
        }
      }
    }
  }

  console.log('\nĐang lưu toàn bộ vào:', MASTER_FILE)
  fs.writeFileSync(MASTER_FILE, JSON.stringify(fullMaster, null, 2), 'utf8')
  console.log(`🎉 ĐÃ HOÀN TẤT NÂNG CẤP SONG NGỮ VÀ MỐC THỜI GIAN CHO ${totalUpdatedQuestions} CÂU HỎI NGHE N3!`)
}

main().catch(console.error)
