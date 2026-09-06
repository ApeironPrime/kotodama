import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { normalizeDiarizedTranscript, transcribeJapaneseAudioChunk } from './transcription-provider.mjs'

test('normalizes diarized Japanese segments with a chunk offset', () => {
  const segments = normalizeDiarizedTranscript(
    {
      segments: [
        { start: 0.2, end: 1.8, text: ' こんにちは。 ', speaker: 'A' },
        { start: 2, end: 3.1, text: 'はい。', speaker: 'B' },
      ],
    },
    180
  )
  assert.deepEqual(segments, [
    {
      startMs: 180200,
      endMs: 181800,
      textJa: 'こんにちは。',
      speakerLabel: 'A',
      speakerConfidence: null,
      confidence: null,
      tokens: [],
    },
    {
      startMs: 182000,
      endMs: 183100,
      textJa: 'はい。',
      speakerLabel: 'B',
      speakerConfidence: null,
      confidence: null,
      tokens: [],
    },
  ])
})

test('preserves real word timestamps from local ASR with the chunk offset', () => {
  const [segment] = normalizeDiarizedTranscript(
    {
      segments: [
        {
          start: 0.5,
          end: 2,
          text: '日本語です。',
          words: [
            { word: '日本語', start: 0.5, end: 1.2 },
            { word: 'です。', start: 1.2, end: 2 },
          ],
        },
      ],
    },
    180
  )
  assert.deepEqual(segment.tokens, [
    {
      sequenceNo: 1,
      surface: '日本語',
      reading: null,
      lemma: null,
      partOfSpeech: null,
      startMs: 180500,
      endMs: 181200,
    },
    {
      sequenceNo: 2,
      surface: 'です。',
      reading: null,
      lemma: null,
      partOfSpeech: null,
      startMs: 181200,
      endMs: 182000,
    },
  ])
})

test('sends diarization settings to the transcription provider', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kotodama-transcription-provider-'))
  const filePath = join(directory, 'chunk.m4a')
  await writeFile(filePath, Buffer.from('audio'))
  try {
    const payload = await transcribeJapaneseAudioChunk({
      filePath,
      fileName: 'chunk.m4a',
      config: { apiKey: 'test-key', model: 'gpt-4o-transcribe-diarize', timeoutMs: 10_000 },
      fetchImpl: async (url, options) => {
        assert.equal(url, 'https://api.openai.com/v1/audio/transcriptions')
        assert.equal(options.headers.Authorization, 'Bearer test-key')
        assert.equal(options.body.get('model'), 'gpt-4o-transcribe-diarize')
        assert.equal(options.body.get('language'), 'ja')
        assert.equal(options.body.get('response_format'), 'diarized_json')
        assert.equal(options.body.get('chunking_strategy'), 'auto')
        return Response.json({ text: 'こんにちは', segments: [{ start: 0, end: 1, text: 'こんにちは', speaker: 'A' }] })
      },
    })
    assert.equal(payload.segments[0].speaker, 'A')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('sends an audio chunk to Gemini and parses its structured transcript', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kotodama-transcription-provider-'))
  const filePath = join(directory, 'chunk.m4a')
  await writeFile(filePath, Buffer.from('audio'))
  try {
    const payload = await transcribeJapaneseAudioChunk({
      filePath,
      fileName: 'chunk.m4a',
      config: { provider: 'gemini', apiKey: 'test-key', model: 'gemini-3.5-flash-lite', timeoutMs: 10_000 },
      fetchImpl: async (url, options) => {
        assert.match(String(url), /models\/gemini-3\.5-flash-lite:generateContent$/)
        assert.equal(options.headers['x-goog-api-key'], 'test-key')
        const body = JSON.parse(options.body)
        assert.equal(body.generationConfig.responseMimeType, 'application/json')
        assert.equal(body.contents[0].parts[1].inline_data.mime_type, 'audio/mp4')
        return Response.json({
          candidates: [{ content: { parts: [{ text: '{"segments":[{"start":0,"end":1.2,"text":"こんにちは"}]}' }] } }],
        })
      },
    })
    assert.deepEqual(payload.segments, [{ start: 0, end: 1.2, text: 'こんにちは' }])
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('sends audio to the local ASR service without exposing an API key', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kotodama-transcription-provider-'))
  const filePath = join(directory, 'chunk.m4a')
  await writeFile(filePath, Buffer.from('audio'))
  try {
    const payload = await transcribeJapaneseAudioChunk({
      filePath,
      fileName: 'chunk.m4a',
      config: {
        provider: 'local_whisper',
        localAsrUrl: 'http://127.0.0.1:8788',
        timeoutMs: 10_000,
      },
      fetchImpl: async (url, options) => {
        assert.equal(url, 'http://127.0.0.1:8788/v1/transcribe/japanese')
        assert.equal(options.method, 'POST')
        assert.equal(options.body.get('file').name, 'chunk.m4a')
        return Response.json({
          language: 'ja',
          segments: [{ start: 0, end: 1.2, text: 'こんにちは', words: [{ word: 'こんにちは', start: 0, end: 1.2 }] }],
        })
      },
    })
    assert.equal(payload.segments[0].words[0].word, 'こんにちは')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
