import { spawn } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export class TranscriptionProviderError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'TranscriptionProviderError'
    this.code = code
  }
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'ignore' })
    child.once('error', (error) => reject(error))
    child.once('exit', (code) => {
      if (code === 0) return resolve()
      reject(new TranscriptionProviderError('AUDIO_EXTRACTION_FAILED', `FFmpeg exited with code ${code}.`))
    })
  })
}

function parsePlaylistDurations(playlist) {
  return playlist
    .split(/\r?\n/)
    .filter((line) => line.startsWith('#EXTINF:'))
    .map((line) => Number.parseFloat(line.slice('#EXTINF:'.length)))
    .filter((duration) => Number.isFinite(duration) && duration > 0)
}

export async function convertAudioToPcmWav({ inputPath, outputPath, ffmpegPath = 'ffmpeg' }) {
  await run(ffmpegPath, [
    '-nostdin',
    '-v',
    'error',
    '-y',
    '-i',
    inputPath,
    '-ac',
    '1',
    '-ar',
    '16000',
    '-c:a',
    'pcm_s16le',
    outputPath,
  ])
  return outputPath
}

export async function extractAudioSnippet({ sourcePath, startMs, endMs, outputPath, ffmpegPath = 'ffmpeg' }) {
  const startSeconds = Math.max(0, startMs / 1000).toFixed(3)
  const durationSeconds = Math.max(0.1, (endMs - startMs) / 1000).toFixed(3)
  await run(ffmpegPath, [
    '-nostdin',
    '-v',
    'error',
    '-y',
    '-ss',
    startSeconds,
    '-t',
    durationSeconds,
    '-i',
    sourcePath,
    '-map',
    '0:a:0',
    '-vn',
    '-ac',
    '1',
    '-ar',
    '16000',
    '-c:a',
    'pcm_s16le',
    outputPath,
  ])
  return outputPath
}

/**
 * Produces mono WAV PCM chunks so Faster-Whisper always receives a portable,
 * seekable audio container. Some FFmpeg builds write fragmented M4A segments
 * that are valid only through their playlist and cannot be decoded independently.
 * A temporary directory is intentionally used: the source video remains the durable record.
 */
export async function extractAudioChunks({ sourcePath, ffmpegPath = 'ffmpeg', chunkSeconds = 180 }) {
  const directory = await mkdtemp(join(tmpdir(), 'kotodama-transcript-'))
  const playlistPath = join(directory, 'chunks.m3u8')
  try {
    await run(ffmpegPath, [
      '-nostdin',
      '-v',
      'error',
      '-y',
      '-i',
      sourcePath,
      '-map',
      '0:a:0',
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-c:a',
      'pcm_s16le',
      '-f',
      'segment',
      '-segment_time',
      String(chunkSeconds),
      '-reset_timestamps',
      '1',
      '-segment_list',
      playlistPath,
      '-segment_list_type',
      'm3u8',
      join(directory, 'chunk-%04d.wav'),
    ])
    const [names, playlist] = await Promise.all([readdir(directory), readFile(playlistPath, 'utf8')])
    const chunkNames = names.filter((name) => /^chunk-\d+\.wav$/.test(name)).sort()
    if (!chunkNames.length)
      throw new TranscriptionProviderError('AUDIO_TRACK_MISSING', 'Video does not contain an audio track.')
    const durations = parsePlaylistDurations(playlist)
    let offsetSeconds = 0
    const chunks = chunkNames.map((name, index) => {
      const chunk = { path: join(directory, name), name, offsetSeconds }
      offsetSeconds += durations[index] ?? chunkSeconds
      return chunk
    })
    return {
      directory,
      chunks,
      durationSeconds: offsetSeconds,
    }
  } catch (error) {
    await rm(directory, { recursive: true, force: true })
    if (error instanceof TranscriptionProviderError) throw error
    if (error?.code === 'ENOENT')
      throw new TranscriptionProviderError('FFMPEG_UNAVAILABLE', 'FFmpeg is unavailable on the media worker.')
    throw new TranscriptionProviderError('AUDIO_EXTRACTION_FAILED', 'Cannot extract audio from this video.')
  }
}

export async function removeExtractedAudio(directory) {
  await rm(directory, { recursive: true, force: true })
}

export function normalizeDiarizedTranscript(payload, offsetSeconds = 0) {
  const segments = Array.isArray(payload?.segments) ? payload.segments : []
  const rawNormalized = segments
    .map((segment) => {
      let start = Number(segment.start)
      let end = Number(segment.end)
      const text = typeof segment.text === 'string' ? segment.text.trim() : ''
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !text) return null
      if (start > 500 && end > 500) {
        start = start / 1000
        end = end / 1000
      }
      const words = normalizeTranscriptWords(segment.words, offsetSeconds, start, end)
      // Token-aware boundary snapping with slight cushion to prevent clipping
      let startMs = Math.round((offsetSeconds + start) * 1_000)
      let endMs = Math.round((offsetSeconds + end) * 1_000)
      if (words.length > 0) {
        const firstTokenStart = words[0].startMs
        const lastTokenEnd = words[words.length - 1].endMs
        startMs = Math.max(0, Math.min(startMs, firstTokenStart - 60))
        endMs = Math.max(endMs, lastTokenEnd + 120)
      }

      return {
        startMs,
        endMs,
        textJa: text,
        speakerLabel: typeof segment.speaker === 'string' && segment.speaker.trim() ? segment.speaker.trim() : null,
        speakerConfidence: null,
        confidence: null,
        tokens: words,
      }
    })
    .filter(Boolean)

  if (!rawNormalized.length)
    throw new TranscriptionProviderError(
      'TRANSCRIPT_EMPTY',
      'The transcription provider did not return usable timed segments.'
    )

  // Preserve natural phrase lines: only stitch accidental tiny 1-2 char fragments with tiny gaps
  const stitched = []
  for (let i = 0; i < rawNormalized.length; i++) {
    const current = { ...rawNormalized[i] }
    while (i + 1 < rawNormalized.length) {
      const next = rawNormalized[i + 1]
      const gapMs = next.startMs - current.endMs
      const isTinyFragment = current.textJa.length <= 2 || next.textJa.length <= 2
      const sameSpeaker = current.speakerLabel === next.speakerLabel

      // Only merge if accidental tiny fragment with small gap (< 350ms)
      if (sameSpeaker && isTinyFragment && gapMs < 350 && current.textJa.length + next.textJa.length <= 40) {
        current.textJa = `${current.textJa}${/[a-zA-Z0-9]$/.test(current.textJa) ? ' ' : ''}${next.textJa}`
        current.endMs = Math.max(current.endMs, next.endMs)
        current.tokens = [...current.tokens, ...next.tokens].map((tok, idx) => ({ ...tok, sequenceNo: idx + 1 }))
        i++ // consume next
      } else {
        break
      }
    }
    stitched.push(current)
  }

  // Ensure strict monotonic non-overlapping bounds
  for (let i = 0; i < stitched.length - 1; i++) {
    if (stitched[i].endMs > stitched[i + 1].startMs) {
      stitched[i].endMs = Math.max(stitched[i].startMs + 400, stitched[i + 1].startMs - 20)
    }
  }

  return stitched
}

function normalizeTranscriptWords(words, offsetSeconds, segmentStart, segmentEnd) {
  if (!Array.isArray(words)) return []
  return words
    .map((word, index) => {
      const start = Number(word?.start)
      const end = Number(word?.end)
      const surface = typeof word?.word === 'string' ? word.word.trim() : ''
      if (!surface || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null
      const boundedStart = Math.max(segmentStart, start)
      const boundedEnd = Math.min(segmentEnd, end)
      if (boundedEnd <= boundedStart) return null
      return {
        sequenceNo: index + 1,
        surface,
        reading: null,
        lemma: null,
        partOfSpeech: null,
        startMs: Math.round((offsetSeconds + boundedStart) * 1_000),
        endMs: Math.round((offsetSeconds + boundedEnd) * 1_000),
      }
    })
    .filter(Boolean)
}

export async function transcribeJapaneseAudioChunk({ filePath, fileName, config, prompt = null, fetchImpl = fetch }) {
  if (config?.provider === 'local_whisper')
    return transcribeJapaneseAudioWithLocalAsr({ filePath, fileName, config, prompt, fetchImpl })
  if (!config?.apiKey)
    throw new TranscriptionProviderError(
      'TRANSCRIPTION_PROVIDER_UNAVAILABLE',
      'The configured transcription provider is unavailable.'
    )
  if (config.provider === 'gemini') return transcribeJapaneseAudioWithGemini({ filePath, config, fetchImpl })
  return transcribeJapaneseAudioWithOpenAI({ filePath, fileName, config, prompt, fetchImpl })
}

async function transcribeJapaneseAudioWithLocalAsr({ filePath, fileName, config, prompt = null, fetchImpl }) {
  if (!config.localAsrUrl)
    throw new TranscriptionProviderError(
      'TRANSCRIPTION_PROVIDER_UNAVAILABLE',
      'Local ASR service URL is not configured.'
    )
  const audio = await readFile(filePath)
  const form = new FormData()
  form.set('file', new Blob([audio], { type: fileName.endsWith('.wav') ? 'audio/wav' : 'audio/mp4' }), fileName)
  if (prompt) form.set('prompt', prompt)
  const response = await fetchImpl(`${config.localAsrUrl}/v1/transcribe/japanese`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(config.timeoutMs),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new TranscriptionProviderError(
      'TRANSCRIPTION_PROVIDER_FAILED',
      `Local ASR request failed (${response.status}): ${detail.slice(0, 300)}`
    )
  }
  return response.json()
}

async function transcribeJapaneseAudioWithOpenAI({ filePath, fileName, config, fetchImpl }) {
  const audio = await readFile(filePath)
  const form = new FormData()
  form.set('model', config.model)
  form.set('language', 'ja')
  form.set('response_format', 'diarized_json')
  form.set('chunking_strategy', 'auto')
  form.set('file', new Blob([audio], { type: 'audio/mp4' }), fileName)
  const response = await fetchImpl('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}` },
    body: form,
    signal: AbortSignal.timeout(config.timeoutMs),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new TranscriptionProviderError(
      response.status === 429 ? 'TRANSCRIPTION_RATE_LIMITED' : 'TRANSCRIPTION_PROVIDER_FAILED',
      `OpenAI transcription request failed (${response.status}): ${detail.slice(0, 300)}`
    )
  }
  return response.json()
}

const geminiTranscriptSchema = {
  type: 'OBJECT',
  properties: {
    segments: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          start: { type: 'NUMBER' },
          end: { type: 'NUMBER' },
          text: { type: 'STRING' },
        },
        required: ['start', 'end', 'text'],
      },
    },
  },
  required: ['segments'],
}

function geminiResponseText(payload) {
  return payload?.candidates?.[0]?.content?.parts
    ?.map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim()
}

async function transcribeJapaneseAudioWithGemini({ filePath, config, fetchImpl }) {
  const audio = await readFile(filePath)
  const mimeType = filePath.endsWith('.wav') ? 'audio/wav' : filePath.endsWith('.mp3') ? 'audio/mp3' : 'audio/mp4'
  const response = await fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: [
                  'Transcribe this Japanese audio chunk accurately.',
                  'Return only JSON conforming to the schema with segments.',
                  'Split into natural sentences or phrases (under 12 seconds per segment).',
                  'start and end MUST be floating point seconds relative to this chunk start (e.g. 5.4, 12.8, not milliseconds).',
                  'Use verbatim Japanese text exactly as spoken without translation or summary.',
                ].join(' '),
              },
              { inline_data: { mime_type: mimeType, data: audio.toString('base64') } },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: geminiTranscriptSchema,
          temperature: 0,
        },
      }),
      signal: AbortSignal.timeout(config.timeoutMs),
    }
  )
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new TranscriptionProviderError(
      response.status === 429 ? 'TRANSCRIPTION_RATE_LIMITED' : 'TRANSCRIPTION_PROVIDER_FAILED',
      `Gemini transcription request failed (${response.status}): ${detail.slice(0, 300)}`
    )
  }
  try {
    return JSON.parse(geminiResponseText(await response.json()) || '')
  } catch {
    throw new TranscriptionProviderError(
      'TRANSCRIPTION_PROVIDER_FAILED',
      'Gemini did not return valid transcript JSON.'
    )
  }
}

export async function comparePitchAudioWithLocalDsp({
  referenceAudioPath,
  userAudioPath,
  localAsrUrl = 'http://127.0.0.1:8788',
  timeoutMs = 15000,
  fetchImpl = fetch,
}) {
  const [refAudio, userAudio] = await Promise.all([readFile(referenceAudioPath), readFile(userAudioPath)])

  const form = new FormData()
  form.set('reference_file', new Blob([refAudio], { type: 'audio/wav' }), 'ref.wav')
  form.set('user_file', new Blob([userAudio], { type: 'audio/wav' }), 'user.wav')

  const response = await fetchImpl(`${localAsrUrl}/v1/dsp/compare`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new TranscriptionProviderError(
      'DSP_COMPARISON_FAILED',
      `DSP pitch comparison failed (${response.status}): ${detail.slice(0, 300)}`
    )
  }

  return response.json()
}
