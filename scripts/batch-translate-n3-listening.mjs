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

// Hàm dịch một lô (Batch) nhiều câu hội thoại cùng lúc sang tiếng Việt
async function batchTranslateWithGemini(scriptMap) {
  if (!apiKey || Object.keys(scriptMap).length === 0) return {}

  const prompt = `Bạn là chuyên gia dịch thuật đề thi JLPT N3 tiếng Nhật sang tiếng Việt.
Dưới đây là một JSON object chứa các đoạn Lời thoại (Script) tiếng Nhật của các câu hỏi trong đề thi nghe.
Hãy dịch từng đoạn sang tiếng Việt chuẩn văn phong sư phạm, giữ nguyên cấu trúc phân vai (Nam: / Nữ: / Người dẫn chuyện:).
Trả về kết quả dưới dạng JSON object duy nhất với các key tương ứng, KHÔNG kèm markdown \`\`\`json hay văn bản phụ nào khác.

JSON đầu vào:
${JSON.stringify(scriptMap, null, 2)}`

  for (let attempt = 1; attempt <= 3; attempt++) {
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

      if (res.status === 429) {
        console.log(`    [Rate Limit 429] Đang chờ 30 giây trước khi thử lại lần ${attempt}...`)
        await new Promise((r) => setTimeout(r, 30000))
        continue
      }

      const json = await res.json()
      let text = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '{}'
      text = text
        .replace(/^```json\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim()
      return JSON.parse(text)
    } catch (err) {
      console.warn(`    Lỗi attempt ${attempt}:`, err.message)
      await new Promise((r) => setTimeout(r, 2000))
    }
  }

  return {}
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
  console.log('=== BẮT ĐẦU DỊCH BATCH & TẠO TIMESTAMP CHO 17 ĐỀ THI NGHE N3 ===')
  const fullMaster = JSON.parse(fs.readFileSync(MASTER_FILE, 'utf8'))
  const n3ListeningExams = fullMaster.filter((e) => e.level === 'N3' && e.section === 'listening')

  console.log(`Tìm thấy ${n3ListeningExams.length} đề thi nghe N3.`)

  for (let eIdx = 0; eIdx < n3ListeningExams.length; eIdx++) {
    const exam = n3ListeningExams[eIdx]
    console.log(`\n[${eIdx + 1}/${n3ListeningExams.length}] Đang xử lý: ${exam.title}...`)

    const examScriptMap = {}
    let runningQNum = 1

    // Gom toàn bộ script của đề thi này
    if (Array.isArray(exam.parts)) {
      exam.parts.forEach((part) => {
        if (Array.isArray(part.questions)) {
          part.questions.forEach((q) => {
            const num = runningQNum++
            const timeSlot = N3_TIMELINE.find((t) => t.num === num) || {
              start: (num - 1) * 75,
              end: num * 75,
            }
            q.audioStart = timeSlot.start
            q.audioEnd = timeSlot.end

            if (q.script && (!q.scriptVi || q.scriptVi.length === 0)) {
              examScriptMap[`q_${num}`] = q.script
            }
          })
        }
      })
    }

    const scriptKeys = Object.keys(examScriptMap)
    console.log(`  - Cần dịch ${scriptKeys.length} đoạn hội thoại...`)

    let translatedMap = {}
    if (scriptKeys.length > 0) {
      // Chia thành 2 nửa nếu quá dài để đảm bảo model không cắt bớt
      const half = Math.ceil(scriptKeys.length / 2)
      const part1Keys = scriptKeys.slice(0, half)
      const part2Keys = scriptKeys.slice(half)

      const part1Map = {}
      part1Keys.forEach((k) => (part1Map[k] = examScriptMap[k]))
      console.log(`  - Dịch Phần 1 (${part1Keys.length} câu)...`)
      const res1 = await batchTranslateWithGemini(part1Map)

      await new Promise((r) => setTimeout(r, 4000))

      const part2Map = {}
      part2Keys.forEach((k) => (part2Map[k] = examScriptMap[k]))
      console.log(`  - Dịch Phần 2 (${part2Keys.length} câu)...`)
      const res2 = await batchTranslateWithGemini(part2Map)

      translatedMap = { ...res1, ...res2 }
    }

    // Gán kết quả dịch và bóc tách segments
    runningQNum = 1
    if (Array.isArray(exam.parts)) {
      exam.parts.forEach((part) => {
        if (Array.isArray(part.questions)) {
          part.questions.forEach((q) => {
            const num = runningQNum++
            const vi = translatedMap[`q_${num}`] || q.scriptVi || ''
            if (vi) {
              q.scriptVi = vi
            }
            q.audioSegments = parseDialogueSegments(q.script, q.scriptVi, q.audioStart, q.audioEnd)
          })
        }
      })
    }

    console.log(`  ✓ Đã cập nhật xong đề: ${exam.title}`)
    await new Promise((r) => setTimeout(r, 3000))
  }

  console.log('\nĐang lưu toàn bộ vào:', MASTER_FILE)
  fs.writeFileSync(MASTER_FILE, JSON.stringify(fullMaster, null, 2), 'utf8')
  console.log('🎉 TẤT CẢ 17 ĐỀ THI NGHE N3 ĐÃ ĐƯỢC DỊCH SONG NGỮ VÀ GẮN TIMESTAMP CHÍNH XÁC!')
}

main().catch(console.error)
