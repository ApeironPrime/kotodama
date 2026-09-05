import { execSync } from 'node:child_process'
import fs from 'node:fs'

const YTDLP = 'D:\\VKU\\DoAnTN\\kotodama\\tools\\yt-dlp\\yt-dlp.exe'
const PLAYLIST_URL = 'https://www.youtube.com/playlist?list=PLN7BKhu7F6a26b5Lzpsc_kemOY6vMSCvc'

async function run() {
  console.log('Fetching playlist video list...')
  const stdout = execSync(`"${YTDLP}" --flat-playlist -J "${PLAYLIST_URL}"`, {
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
  })

  const playlist = JSON.parse(stdout)
  console.log(`Playlist Title: ${playlist.title}`)
  console.log(`Channel: ${playlist.channel || playlist.uploader}`)
  console.log(`Total videos in playlist: ${playlist.entries?.length || 0}`)

  const entries = (playlist.entries || []).map((e) => ({
    id: e.id,
    title: e.title,
    url: e.url || `https://www.youtube.com/watch?v=${e.id}`,
    duration: e.duration,
  }))

  console.log('\n--- DANH SÁCH VIDEO TRONG PLAYLIST ---')
  entries.forEach((e, idx) => {
    console.log(
      `${idx + 1}. [${e.id}] ${e.title} (${e.duration ? Math.floor(e.duration / 60) + 'm' + (e.duration % 60) + 's' : 'N/A'})`
    )
  })

  fs.writeFileSync('data/youtube_playlist_n3.json', JSON.stringify(entries, null, 2))
}

run().catch(console.error)
