import { execSync } from 'node:child_process'

const YTDLP = 'D:\\VKU\\DoAnTN\\kotodama\\tools\\yt-dlp\\yt-dlp.exe'

async function search() {
  const out = execSync(`"${YTDLP}" "ytsearch3:Choukai N3 07/2019 Nghe là Đỗ" --flat-playlist -J`, { encoding: 'utf-8' })
  const json = JSON.parse(out)
  console.log(json.entries?.map((e) => ({ id: e.id, title: e.title })))
}

search().catch(console.error)
