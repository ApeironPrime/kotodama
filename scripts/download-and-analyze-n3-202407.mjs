import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const AUDIO_URL =
  'https://firebasestorage.googleapis.com/v0/b/corodomopro.appspot.com/o/jlpt-n3-202407.MP3?alt=media&token=8b8bc5f9-a721-439d-a6af-3ff26e7cca55'
const TARGET_AUDIO_PATH = path.resolve('public/audio/jlpt/jlpt-n3-2024-07.mp3')
const CHUNKS_DIR = path.resolve('tmp/n3_202407_chunks')
const FFMPEG = 'D:\\VKU\\DoAnTN\\kotodama\\tools\\ffmpeg\\ffmpeg.exe'
const FFPROBE = 'D:\\VKU\\DoAnTN\\kotodama\\tools\\ffmpeg\\ffprobe.exe'

async function run() {
  console.log('1. Tải file âm thanh JLPT-N3 07/2024...')
  fs.mkdirSync(path.dirname(TARGET_AUDIO_PATH), { recursive: true })

  if (!fs.existsSync(TARGET_AUDIO_PATH) || fs.statSync(TARGET_AUDIO_PATH).size < 1000000) {
    const res = await fetch(AUDIO_URL)
    if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`)
    const arrayBuffer = await res.arrayBuffer()
    fs.writeFileSync(TARGET_AUDIO_PATH, Buffer.from(arrayBuffer))
    console.log(`Đã tải xong: ${(arrayBuffer.byteLength / 1048576).toFixed(2)} MB`)
  } else {
    console.log(`File đã tồn tại sẵn: ${(fs.statSync(TARGET_AUDIO_PATH).size / 1048576).toFixed(2)} MB`)
  }

  // Get duration
  let totalDuration = 2400
  try {
    const probe = execSync(
      `"${FFPROBE}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${TARGET_AUDIO_PATH}"`,
      { encoding: 'utf-8' }
    )
    totalDuration = parseFloat(probe.trim())
  } catch {
    // fallback with ffmpeg
  }
  console.log(`Thời lượng tệp âm thanh: ${totalDuration.toFixed(2)} giây (~${(totalDuration / 60).toFixed(1)} phút)`)

  // Slice into 120s chunks with 10s overlap
  fs.mkdirSync(CHUNKS_DIR, { recursive: true })
  const chunkSize = 120
  const overlap = 10
  const chunks = []

  for (let start = 0; start < totalDuration; start += chunkSize - overlap) {
    const end = Math.min(totalDuration, start + chunkSize)
    const dur = end - start
    const chunkFile = path.join(CHUNKS_DIR, `chunk_${Math.floor(start)}_${Math.floor(end)}.mp3`)
    if (!fs.existsSync(chunkFile)) {
      execSync(
        `"${FFMPEG}" -y -ss ${start} -t ${dur} -i "${TARGET_AUDIO_PATH}" -ac 1 -ar 16000 -b:a 64k "${chunkFile}"`,
        { stdio: 'pipe' }
      )
    }
    chunks.push({ chunkFile, start, end, dur })
  }

  console.log(`Đã cắt thành ${chunks.length} phân đoạn để phân tích nhận diện ASR.`)
  fs.writeFileSync('data/n3_202407_chunks_meta.json', JSON.stringify(chunks, null, 2))
}

run().catch(console.error)
