import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

const env = fs.readFileSync('.env', 'utf-8')
const apiKey = env.match(/GEMINI_API_KEY=([^\r\n]+)/)[1].trim()

// 1. Run Python to slice the audio into chunks
const pySlicer = `
import os

path = r'public/audio/jlpt/jlpt-n3-2023-12.mp3'
with open(path, 'rb') as f:
    data = f.read()

bitrates = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0]
samplerates = [44100, 48000, 32000, 0]

pos = 0
frame_idx = 0
frame_positions = []

while pos < len(data) - 4:
    if data[pos] == 0xFF and (data[pos+1] & 0xE0) == 0xE0:
        version = (data[pos+1] >> 3) & 0x03
        layer = (data[pos+1] >> 1) & 0x03
        bitrate_idx = (data[pos+2] >> 4) & 0x0F
        sr_idx = (data[pos+2] >> 2) & 0x03
        padding = (data[pos+2] >> 1) & 0x01
        
        if version == 3 and layer == 1 and bitrate_idx in range(1, 15) and sr_idx in range(3):
            br = bitrates[bitrate_idx] * 1000
            sr = samplerates[sr_idx]
            frame_len = int((144 * br / sr) + padding)
            if frame_len > 0:
                sec = frame_idx * 1152 / sr
                frame_positions.append((sec, pos, frame_len))
                frame_idx += 1
                pos += frame_len
                continue
    pos += 1

os.makedirs('scratch/chunks', exist_ok=True)
chunk_duration = 120 # 2 minutes
overlap = 15 # 15 seconds
total_sec = frame_positions[-1][0]

chunks_info = []
start = 0
chunk_id = 0

while start < total_sec:
    end = min(total_sec, start + chunk_duration)
    
    start_pos = None
    end_pos = None
    for sec, p, flen in frame_positions:
        if start_pos is None and sec >= start:
            start_pos = p
        if sec >= end:
            end_pos = p + flen
            break
    if end_pos is None:
        end_pos = len(data)
        
    if start_pos is not None:
        chunk_file = f'scratch/chunks/chunk_{chunk_id:03d}_{int(start)}_{int(end)}.mp3'
        with open(chunk_file, 'wb') as f:
            f.write(data[start_pos:end_pos])
        chunks_info.append({'id': chunk_id, 'file': chunk_file, 'start': start, 'end': end})
        chunk_id += 1
        
    start += (chunk_duration - overlap)

import json
print(json.dumps(chunks_info))
`

console.log('1. Slicing audio into 2-minute chunks...')
const sliceRes = spawnSync('python', ['-c', pySlicer], { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 })
if (sliceRes.error) throw sliceRes.error
const chunks = JSON.parse(sliceRes.stdout.trim())
console.log(`Created ${chunks.length} chunks.`)

async function transcribeChunk(chunk) {
  const data = fs.readFileSync(chunk.file)
  const base64 = data.toString('base64')

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: 'audio/mp3',
                  data: base64,
                },
              },
              {
                text: `Transcribe this Japanese audio chunk with relative seconds timestamps from 0.0s. Look especially for Question markers like "問題1", "問題2", "問題3", "問題4", "問題5", "1番", "2番", "3番", "4番", "5番", "6番", "7番", "8番", "9番", "例".`,
              },
            ],
          },
        ],
      }),
    }
  )

  const json = await res.json()
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text || ''
  return text
}

async function main() {
  const transcripts = []
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    console.log(`[${i + 1}/${chunks.length}] Transcribing chunk ${chunk.start}s - ${chunk.end}s...`)
    try {
      const text = await transcribeChunk(chunk)
      transcripts.push({
        chunkId: chunk.id,
        startSec: chunk.start,
        endSec: chunk.end,
        text,
      })
      await new Promise((r) => setTimeout(r, 4000)) // rate limit protection
    } catch (e) {
      console.warn(`Error chunk ${i}:`, e)
    }
  }

  fs.writeFileSync('data/n3_202312_full_transcripts.json', JSON.stringify(transcripts, null, 2), 'utf-8')
  console.log('Saved all chunk transcriptions to data/n3_202312_full_transcripts.json!')
}

main().catch(console.error)
