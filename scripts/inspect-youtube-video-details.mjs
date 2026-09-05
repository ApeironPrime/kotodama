import { execSync } from 'node:child_process'

const YTDLP = 'D:\\VKU\\DoAnTN\\kotodama\\tools\\yt-dlp\\yt-dlp.exe'

async function inspectVideo(videoId) {
  console.log(`Inspecting video ${videoId}...`)
  const stdout = execSync(`"${YTDLP}" -j "https://www.youtube.com/watch?v=${videoId}"`, {
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
  })
  const info = JSON.parse(stdout)
  console.log('Title:', info.title)
  console.log('Duration:', info.duration)
  console.log('Chapters:', info.chapters?.length || 0)
  if (info.chapters && info.chapters.length > 0) {
    console.log(
      'Sample chapters:',
      info.chapters.slice(0, 10).map((c) => `${c.start_time}s: ${c.title}`)
    )
  }
  console.log('\n--- DESCRIPTION TIMESTAMPS ---')
  const desc = info.description || ''
  const lines = desc.split('\n')
  lines.forEach((line) => {
    if (/\d+:\d+/.test(line)) {
      console.log(line)
    }
  })
}

// Inspect N3 07/2024 video
inspectVideo('9LoOatdNILc').catch(console.error)
