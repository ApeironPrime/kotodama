import { execSync } from 'node:child_process'

const YTDLP = 'D:\\VKU\\DoAnTN\\kotodama\\tools\\yt-dlp\\yt-dlp.exe'

async function run() {
  console.log('Listing subs...')
  const out = execSync(`"${YTDLP}" --list-subs "https://www.youtube.com/watch?v=9LoOatdNILc"`, { encoding: 'utf-8' })
  console.log(out)

  console.log('Downloading auto subtitles...')
  execSync(
    `"${YTDLP}" --write-auto-sub --sub-lang ja --skip-download -o "tmp/yt_n3_202407" "https://www.youtube.com/watch?v=9LoOatdNILc"`,
    { encoding: 'utf-8' }
  )
}

run().catch(console.error)
