import fs from 'node:fs'

const playlist = JSON.parse(fs.readFileSync('data/youtube_playlist_n3.json', 'utf-8'))
const master = JSON.parse(fs.readFileSync('data/jlpt_full_master.json', 'utf-8'))

const n3Exams = master.filter((e) => (e.level === 'N3' || e.level === 'n3') && e.section === 'listening')

console.log(`Tìm thấy ${n3Exams.length} đề nghe N3 trong hệ thống.`)
console.log(`Tìm thấy ${playlist.length} video trong playlist YouTube.\n`)

const matched = []

for (const exam of n3Exams) {
  // Tìm video tương ứng theo năm và tháng
  // title format: JLPT-N3 07 2024 - Nghe Hiểu (聴解)
  const match = exam.title.match(/(\d{2})\s*(\d{4})/)
  if (match) {
    const session = match[1] // '07' or '12'
    const year = match[2] // '2024'

    const monthEn = session === '07' ? 'july' : 'december'
    const targetPattern1 = `${session}/${year}`
    const targetPattern2 = `${session}-${year}`
    const targetPattern3 = `${parseInt(session, 10)}/${year}`
    const targetPattern4 = `${session} ${year}`

    const foundVideo = playlist.find((v) => {
      const t = v.title.toLowerCase()
      return (
        t.includes(targetPattern1) ||
        t.includes(targetPattern2) ||
        t.includes(targetPattern3) ||
        t.includes(targetPattern4) ||
        (t.includes(monthEn) && t.includes(year)) ||
        (t.includes(year) && t.includes(session === '07' ? '7' : '12'))
      )
    })

    matched.push({
      examId: exam.id,
      examTitle: exam.title,
      year,
      session,
      video: foundVideo
        ? {
            id: foundVideo.id,
            title: foundVideo.title,
            url: foundVideo.url,
            duration: foundVideo.duration,
          }
        : null,
    })
  }
}

console.log('--- KẾT QUẢ KHỚP GIỮA DANH SÁCH ĐỀ WEB & PLAYLIST YOUTUBE ---')
matched.forEach((m, idx) => {
  if (m.video) {
    console.log(`${idx + 1}. ✅ [${m.examTitle}] -> YouTube: [${m.video.id}] ${m.video.title}`)
  } else {
    console.log(`${idx + 1}. ❌ [${m.examTitle}] -> Chưa tìm thấy trong playlist này`)
  }
})

fs.writeFileSync('data/n3_youtube_matched_exams.json', JSON.stringify(matched, null, 2))
