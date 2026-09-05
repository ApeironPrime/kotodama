import { join, resolve } from 'node:path'

function required(env, key, missing) {
  const value = env[key]?.trim()
  if (!value) missing.push(key)
  return value ?? ''
}

function boundedInteger(value, fallback, { min, max }) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback
}

function validHttpOrigin(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null
  } catch {
    return null
  }
}

export function readConfig(env = process.env) {
  const isRender = Boolean(env.RENDER || env.RENDER_EXTERNAL_URL)
  const production = env.NODE_ENV === 'production'
  const missing = []
  const databaseUrl = env.DATABASE_URL?.trim() ?? ''
  const jwtSecret = env.AUTH_JWT_SECRET?.trim() ?? ''
  const renderOrigin = env.RENDER_EXTERNAL_URL ? validHttpOrigin(env.RENDER_EXTERNAL_URL) : null
  const appOriginValue = env.APP_ORIGIN?.trim() ?? (production ? (renderOrigin ?? (isRender ? 'https://kotodama.onrender.com' : '')) : 'http://127.0.0.1:5173')
  const appOrigin = validHttpOrigin(appOriginValue)
  const smtpHost = env.SMTP_HOST?.trim() ?? (isRender ? 'smtp.example.com' : '')
  const smtpFrom = env.SMTP_FROM?.trim() ?? (isRender ? 'Kotodama <no-reply@example.com>' : '')
  const mediaStoragePathValue = env.MEDIA_STORAGE_PATH?.trim() ?? (isRender ? './var/media' : '')
  const mediaStoragePath = resolve(mediaStoragePathValue || join(process.cwd(), 'var', 'media'))
  const mediaMaxUploadBytes = boundedInteger(env.MEDIA_MAX_UPLOAD_BYTES, 2 * 1024 ** 3, {
    min: 1 * 1024 ** 2,
    max: 4 * 1024 ** 3,
  })
  const mediaWorkerPollMs = boundedInteger(env.MEDIA_WORKER_POLL_MS, 1_000, { min: 250, max: 60_000 })
  const transcriptionChunkSeconds = boundedInteger(env.TRANSCRIPTION_CHUNK_SECONDS, 180, { min: 30, max: 600 })
  const transcriptionTimeoutMs = boundedInteger(env.TRANSCRIPTION_TIMEOUT_MS, 120_000, {
    min: 10_000,
    max: 10 * 60_000,
  })
  const youtubeTimeoutMs = boundedInteger(env.YOUTUBE_DOWNLOAD_TIMEOUT_MS, 10 * 60_000, {
    min: 30_000,
    max: 60 * 60_000,
  })
  const configuredTranscriptionProvider = env.TRANSCRIPTION_PROVIDER?.trim().toLowerCase()
  const geminiApiKey = env.GEMINI_API_KEY?.trim() || undefined
  const openaiApiKey = env.OPENAI_API_KEY?.trim() || undefined
  const localAsrUrl = validHttpOrigin(env.LOCAL_ASR_URL?.trim() ?? '')
  const transcriptionProvider =
    configuredTranscriptionProvider === 'local_whisper'
      ? 'local_whisper'
      : configuredTranscriptionProvider === 'gemini' || (!configuredTranscriptionProvider && geminiApiKey)
        ? 'gemini'
        : 'openai'
  const transcriptionApiKey =
    transcriptionProvider === 'gemini' ? geminiApiKey : transcriptionProvider === 'openai' ? openaiApiKey : undefined

  if (production) {
    required(env, 'DATABASE_URL', missing)
    required(env, 'AUTH_JWT_SECRET', missing)
    if (!isRender) {
      required(env, 'CORS_ORIGINS', missing)
      required(env, 'APP_ORIGIN', missing)
      required(env, 'SMTP_HOST', missing)
      required(env, 'SMTP_FROM', missing)
      required(env, 'MEDIA_STORAGE_PATH', missing)
    }
  }
  if (appOriginValue && !appOrigin) throw new Error('APP_ORIGIN must be a valid HTTP(S) origin.')
  if (missing.length) throw new Error(`Missing required production configuration: ${missing.join(', ')}`)
  if (production && jwtSecret.length < 32)
    throw new Error('AUTH_JWT_SECRET must contain at least 32 characters in production.')

  return {
    production,
    databaseUrl: databaseUrl || undefined,
    jwtSecret: jwtSecret || 'development-only-secret-change-before-production',
    appOrigin: appOrigin ?? 'http://127.0.0.1:5173',
    trustProxy: env.TRUST_PROXY === 'true',
    smtp: {
      enabled: Boolean(smtpHost && smtpFrom),
      host: smtpHost || undefined,
      port: Number(env.SMTP_PORT ?? 587),
      secure: env.SMTP_SECURE === 'true',
      user: env.SMTP_USER?.trim() || undefined,
      password: env.SMTP_PASSWORD || undefined,
      from: smtpFrom || undefined,
    },
    media: {
      storagePath: mediaStoragePath,
      maxUploadBytes: mediaMaxUploadBytes,
      workerPollMs: mediaWorkerPollMs,
    },
    transcription: {
      enabled: transcriptionProvider === 'local_whisper' ? Boolean(localAsrUrl) : Boolean(transcriptionApiKey),
      provider: transcriptionProvider,
      apiKey: transcriptionApiKey,
      model:
        transcriptionProvider === 'local_whisper'
          ? env.LOCAL_ASR_MODEL?.trim() || 'large-v3'
          : transcriptionProvider === 'gemini'
            ? env.GEMINI_TRANSCRIPTION_MODEL?.trim() || 'gemini-3.5-flash-lite'
            : env.OPENAI_TRANSCRIPTION_MODEL?.trim() || 'gpt-4o-transcribe-diarize',
      localAsrUrl: localAsrUrl ?? undefined,
      ffmpegPath: env.FFMPEG_PATH?.trim() || 'ffmpeg',
      chunkSeconds: transcriptionChunkSeconds,
      timeoutMs: transcriptionTimeoutMs,
    },
    youtube: {
      enabled: !production && env.YOUTUBE_IMPORT_ENABLED === 'true',
      ytdlpPath: env.YTDLP_PATH?.trim() || 'yt-dlp',
      timeoutMs: youtubeTimeoutMs,
    },
    dictionary: {
      dbPath:
        env.VNJPDICT_DB_PATH?.trim() ||
        'D:/VKU/data/drive-download-20260828T102340Z-1-002/vnjpdict_scraper/vnjpdict.db',
    },
  }
}
