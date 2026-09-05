import http from 'node:http'
import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import {
  hashPassword,
  randomToken,
  safeEqual,
  sha256,
  signAccessToken,
  signPlaybackToken,
  tokenTtl,
  validateEmail,
  validatePassword,
  verifyAccessToken,
  verifyPlaybackToken,
  verifyPassword,
} from './security.mjs'
import { createDatabasePool, databaseHealth } from './db/pool.mjs'
import { createAuthStore } from './auth-store.mjs'
import { readConfig } from './config.mjs'
import { createEmailService } from './email.mjs'
import { log, logError } from './logger.mjs'
import { createMediaStorage, MediaStorageError } from './media-storage.mjs'
import { normalizeYouTubeUrl } from './youtube-provider.mjs'
import { createDictionaryService } from './dictionary-service.mjs'
import { nhaiKanjiService } from './nhaikanji-service.mjs'
import { CurriculumService } from './curriculum-service.mjs'
import { SrsService } from './srs-service.mjs'
import { SrsStore } from './srs-store.mjs'
import { evaluateShadowingAttempt } from './shadowing-scorer.mjs'
import {
  comparePitchAudioWithLocalDsp,
  convertAudioToPcmWav,
  extractAudioSnippet,
  transcribeJapaneseAudioChunk,
} from './transcription-provider.mjs'
import { tmpdir } from 'node:os'
import { extname, join, resolve } from 'node:path'

const distDir = resolve('dist')
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
}

async function tryServeStatic(request, response, requestPath) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false
  const cleanPath = requestPath.split('?')[0].replace(/\.\./g, '')
  let filePath = join(distDir, cleanPath)
  try {
    let fileStat = await stat(filePath).catch(() => null)
    if (fileStat?.isDirectory()) {
      filePath = join(filePath, 'index.html')
      fileStat = await stat(filePath).catch(() => null)
    }
    if (!fileStat?.isFile()) {
      if (extname(cleanPath)) return false
      filePath = join(distDir, 'index.html')
      fileStat = await stat(filePath).catch(() => null)
    }
    if (!fileStat?.isFile()) return false

    const ext = extname(filePath).toLowerCase()
    const contentType = mimeTypes[ext] ?? 'application/octet-stream'
    response.writeHead(200, {
      'content-type': contentType,
      'content-length': fileStat.size,
      ...(ext === '.html' ? { 'cache-control': 'no-cache' } : { 'cache-control': 'public, max-age=31536000, immutable' }),
    })
    if (request.method === 'HEAD') {
      response.end()
      return true
    }
    createReadStream(filePath).pipe(response)
    return true
  } catch {
    return false
  }
}

const config = readConfig()
const port = Number(process.env.PORT ?? process.env.API_PORT ?? 8787)
const database = createDatabasePool(config.databaseUrl)
if (config.production && !database) throw new Error('DATABASE_URL is required in production.')
const authStore = createAuthStore(database)
const emailService = createEmailService(config)
const mediaStorage = createMediaStorage(config)
const dictionaryService = createDictionaryService(config.dictionary?.dbPath)
const curriculumService = new CurriculumService()
const srsStore = database ? new SrsStore(database) : null
const srsService = srsStore ? new SrsService(srsStore) : null
const production = config.production
const jwtSecret = config.jwtSecret
const configuredOrigins = process.env.CORS_ORIGINS?.split(',')
  .map((value) => value.trim())
  .filter(Boolean)
const allowedOrigins = configuredOrigins?.length
  ? configuredOrigins
  : production
    ? (Boolean(process.env.RENDER || process.env.RENDER_EXTERNAL_URL) ? ['*'] : [])
    : [
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5174',
        'http://127.0.0.1:5175',
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
      ]
if (production && !allowedOrigins.length)
  throw new Error('CORS_ORIGINS must list approved production frontend origins.')

function json(response, status, body, headers = {}) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...headers,
  })
  response.end(JSON.stringify(body))
}
function fail(response, status, message, code) {
  json(response, status, { message, code })
}
function success(response, data, status = 200, headers) {
  json(response, status, { data }, headers)
}
function parseCookies(request) {
  return Object.fromEntries(
    String(request.headers.cookie ?? '')
      .split(';')
      .map((part) => part.trim().split(/=(.*)/s))
      .filter(([key]) => key)
      .map(([key, value]) => [key, decodeURIComponent(value ?? '')])
  )
}
function serializeCookie(name, value, { maxAge = 0, httpOnly = false, path = '/api/v1' } = {}) {
  return `${name}=${encodeURIComponent(value)}; Path=${path}; Max-Age=${maxAge}; SameSite=Strict; ${production ? 'Secure; ' : ''}${httpOnly ? 'HttpOnly; ' : ''}`
}
function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
    status: user.status,
  }
}
async function audit(action, userId, request, details = {}) {
  const at = new Date().toISOString()
  const { targetUserId, ...metadata } = details
  await Promise.all([
    authStore.touchUser(userId, at),
    authStore.addAudit({
      id: randomUUID(),
      action,
      userId,
      ip: getIp(request),
      at,
      targetUserId,
      metadata,
    }),
  ])
}
function getIp(request) {
  const source = config.trustProxy ? request.headers['x-forwarded-for'] : request.socket.remoteAddress
  return String(source ?? 'unknown')
    .split(',')[0]
    .trim()
}

async function readJson(request, { maxSize = 32_768 } = {}) {
  let size = 0
  const chunks = []
  for await (const chunk of request) {
    size += chunk.length
    if (size > maxSize) throw new Error('PAYLOAD_TOO_LARGE')
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new Error('INVALID_JSON')
  }
}
async function rateLimit(request, response, scope, limit = 8, windowMs = 15 * 60 * 1000) {
  const result = await authStore.consumeRateLimit(scope, getIp(request), { limit, windowMs })
  if (!result.allowed) {
    response.setHeader('retry-after', String(result.retryAfter))
    fail(response, 429, 'Bạn đang thao tác quá nhanh. Vui lòng thử lại sau.', 'RATE_LIMITED')
    return false
  }
  return true
}
async function authenticate(request) {
  const token = String(request.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  const claims = verifyAccessToken(token, jwtSecret)
  const user = claims && (await authStore.findUserById(claims.sub))
  return user?.status === 'active' && claims.ver === (user.tokenVersion ?? 0) ? user : null
}
async function requireUser(request, response) {
  const user = await authenticate(request)
  if (!user) {
    fail(response, 401, 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'UNAUTHENTICATED')
    return null
  }
  return user
}
async function requireAdmin(request, response) {
  const user = await requireUser(request, response)
  if (!user) return null
  if (user.role !== 'admin') {
    fail(response, 403, 'Bạn không có quyền thực hiện thao tác này.', 'FORBIDDEN')
    return null
  }
  return user
}

function parseRange(header, byteSize) {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(String(header ?? ''))
  if (!match) return null
  const start = match[1] ? Number(match[1]) : undefined
  const end = match[2] ? Number(match[2]) : undefined
  if (
    (start !== undefined && (!Number.isInteger(start) || start < 0)) ||
    (end !== undefined && (!Number.isInteger(end) || end < 0))
  )
    return null
  const safeEnd = Math.min(end ?? byteSize - 1, byteSize - 1)
  const safeStart = start ?? Math.max(0, byteSize - (end ?? 0))
  return safeStart <= safeEnd && safeStart < byteSize ? { start: safeStart, end: safeEnd } : null
}

async function streamMediaContent(request, response, asset) {
  const processingAsset = await authStore.findMediaAssetForProcessing(asset.id)
  if (!processingAsset?.storageKey) return fail(response, 404, 'Tệp video chưa sẵn sàng.', 'MEDIA_NOT_READY')
  let file
  try {
    file = await stat(mediaStorage.absolutePath(processingAsset.storageKey))
  } catch {
    return fail(response, 404, 'Không tìm thấy tệp video.', 'MEDIA_NOT_FOUND')
  }
  const range = request.headers.range ? parseRange(request.headers.range, file.size) : null
  if (request.headers.range && !range) {
    response.writeHead(416, { 'content-range': `bytes */${file.size}` })
    return response.end()
  }
  const start = range?.start ?? 0
  const end = range?.end ?? file.size - 1
  response.writeHead(range ? 206 : 200, {
    'content-type': asset.mimeType || 'video/mp4',
    'content-length': end - start + 1,
    'accept-ranges': 'bytes',
    ...(range ? { 'content-range': `bytes ${start}-${end}/${file.size}` } : {}),
    'cache-control': 'private, no-store',
    'x-content-type-options': 'nosniff',
  })
  const stream = createReadStream(mediaStorage.absolutePath(processingAsset.storageKey), { start, end })
  stream.once('error', () => response.destroy())
  stream.pipe(response)
}
async function getRefreshSession(request) {
  const token = parseCookies(request).kotodama_refresh
  return token ? authStore.findRefreshSession(sha256(token)) : null
}
async function getRefreshSessionRecord(request) {
  const token = parseCookies(request).kotodama_refresh
  return token ? authStore.findRefreshSessionRecord(sha256(token)) : null
}
function requireCsrf(request, response, session) {
  const cookie = parseCookies(request).kotodama_csrf
  const header = request.headers['x-csrf-token']
  if (!session || !safeEqual(cookie, header) || !safeEqual(sha256(String(header ?? '')), session.csrfHash)) {
    fail(response, 403, 'Yêu cầu không hợp lệ. Vui lòng tải lại trang và thử lại.', 'CSRF_INVALID')
    return false
  }
  return true
}
function buildSession(user, request, familyId) {
  const refreshToken = randomToken(48)
  const csrfToken = randomToken(24)
  const session = {
    userId: user.id,
    csrfHash: sha256(csrfToken),
    ...(familyId ? { familyId } : {}),
    expiresAt: Date.now() + tokenTtl.refresh * 1000,
    ip: getIp(request),
    userAgent: request.headers['user-agent'],
  }
  const headers = {
    'set-cookie': [
      serializeCookie('kotodama_refresh', refreshToken, { maxAge: tokenTtl.refresh, httpOnly: true }),
      serializeCookie('kotodama_csrf', csrfToken, { maxAge: tokenTtl.refresh, path: '/' }),
    ],
  }
  return {
    accessToken: signAccessToken({
      userId: user.id,
      role: user.role,
      tokenVersion: user.tokenVersion ?? 0,
      secret: jwtSecret,
    }),
    headers,
    refreshToken,
    session,
  }
}
async function issueSession(user, request) {
  const next = buildSession(user, request)
  await authStore.createRefreshSession(sha256(next.refreshToken), next.session)
  return next
}
async function rotateSession(user, request, currentToken, familyId) {
  const next = buildSession(user, request, familyId)
  const result = await authStore.rotateRefreshSession(sha256(currentToken), sha256(next.refreshToken), next.session)
  return { ...result, next }
}
function clearSessionCookies() {
  return [
    serializeCookie('kotodama_refresh', '', { maxAge: 0, httpOnly: true }),
    serializeCookie('kotodama_csrf', '', { maxAge: 0, path: '/' }),
  ]
}
async function createOneTimeToken(userId, purpose, ttlMs) {
  const token = randomToken(32)
  await authStore.createOneTimeToken({
    tokenHash: sha256(token),
    userId,
    purpose,
    expiresAt: Date.now() + ttlMs,
  })
  return token
}
async function consumeOneTimeToken(token, purpose) {
  return authStore.consumeOneTimeToken(sha256(String(token ?? '')), purpose)
}
async function sendOneTimeEmail(user, purpose, ttlMs) {
  const token = await createOneTimeToken(user.id, purpose, ttlMs)
  if (!emailService.enabled) {
    log('warn', 'email.delivery-skipped', { purpose, userId: user.id, reason: 'smtp_not_configured' })
    return false
  }
  try {
    if (purpose === 'email_verification') await emailService.sendVerificationEmail(user, token)
    else await emailService.sendPasswordResetEmail(user, token)
    log('info', 'email.delivered', { purpose, userId: user.id })
    return true
  } catch (error) {
    logError('email.delivery-failed', error, { purpose, userId: user.id })
    return false
  }
}
function emailFrom(body) {
  return typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
}
const preferenceKeys = new Set([
  'dailyWords',
  'reviewLimit',
  'autoPronounce',
  'furigana',
  'romaji',
  'pitchAccent',
  'reminders',
  'streakReminders',
  'publicProfile',
  'analytics',
  'accent',
  'background',
])
const allowedAccents = new Set(['rose', 'blue', 'violet', 'orange', 'emerald', 'white'])
const allowedBackgrounds = new Set(['midnight', 'ocean', 'sakura', 'forest', 'ivory', 'sky'])
const allowedLevels = new Set(['beginner', 'elementary', 'intermediate', 'advanced'])
const allowedWordGoals = new Set([10, 20, 30, 50])
const allowedMinuteGoals = new Set([10, 20, 30, 45])
const allowedReviewLimits = new Set([50, 100, 200, 'unlimited'])
const mediaSourceTypes = new Set(['user_upload', 'catalog', 'youtube'])
const mediaRightsBases = new Set(['owned', 'licensed', 'internal', 'unknown'])

function validPreferencesPatch(body) {
  if (!body || typeof body !== 'object') return null
  const entries = Object.entries(body)
  if (!entries.length || entries.some(([key]) => !preferenceKeys.has(key))) return null
  for (const [key, value] of entries) {
    if (key === 'dailyWords' && (!Number.isInteger(value) || !allowedWordGoals.has(value))) return null
    if (key === 'reviewLimit' && !allowedReviewLimits.has(value)) return null
    if (['accent', 'background'].includes(key)) {
      if (typeof value !== 'string' || (key === 'accent' ? !allowedAccents.has(value) : !allowedBackgrounds.has(value)))
        return null
    }
    if (!['dailyWords', 'reviewLimit', 'accent', 'background'].includes(key) && typeof value !== 'boolean') return null
  }
  return body
}

function validLearningPlan(body) {
  if (!body || typeof body !== 'object') return null
  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
  if (
    body.language !== 'jp' ||
    typeof body.level !== 'string' ||
    !allowedLevels.has(body.level) ||
    !Number.isInteger(body.dailyWords) ||
    !allowedWordGoals.has(body.dailyWords) ||
    !Number.isInteger(body.dailyMinutes) ||
    !allowedMinuteGoals.has(body.dailyMinutes) ||
    reason.length > 1000
  )
    return null
  return {
    language: body.language,
    level: body.level,
    dailyWords: body.dailyWords,
    dailyMinutes: body.dailyMinutes,
    reason,
  }
}

function validMediaAssetDraft(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const allowedKeys = new Set(['sourceType', 'title', 'language', 'rightsBasis', 'sourceReference', 'originalFilename'])
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) return null
  const sourceType = typeof body.sourceType === 'string' ? body.sourceType : ''
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const language = typeof body.language === 'string' ? body.language : 'ja'
  const rightsBasis = typeof body.rightsBasis === 'string' ? body.rightsBasis : ''
  const sourceReference = typeof body.sourceReference === 'string' ? body.sourceReference.trim() : ''
  const originalFilename = typeof body.originalFilename === 'string' ? body.originalFilename.trim() : ''
  if (
    !mediaSourceTypes.has(sourceType) ||
    !title ||
    title.length > 200 ||
    language !== 'ja' ||
    !mediaRightsBases.has(rightsBasis) ||
    sourceReference.length > 500 ||
    originalFilename.length > 255
  )
    return null
  if (sourceType === 'catalog' && !sourceReference) return null
  if (sourceType === 'youtube' && (!normalizeYouTubeUrl(sourceReference) || rightsBasis !== 'owned')) return null
  return {
    sourceType,
    title,
    language,
    rightsBasis,
    sourceReference: sourceReference || null,
    originalFilename: originalFilename || null,
  }
}

function uploadFailure(error) {
  if (error instanceof MediaStorageError) {
    if (error.code === 'UPLOAD_TOO_LARGE')
      return { status: 413, message: 'Video vượt quá dung lượng cho phép.', code: error.code }
    if (error.code === 'UPLOAD_FORMAT_UNSUPPORTED')
      return { status: 415, message: 'Chỉ hỗ trợ video MP4, WebM, MOV hoặc OGV.', code: error.code }
    if (['UPLOAD_EMPTY', 'UPLOAD_LENGTH_INVALID'].includes(error.code))
      return { status: 422, message: 'Tệp video không hợp lệ hoặc trống.', code: error.code }
  }
  return { status: 500, message: 'Không thể lưu video lúc này. Vui lòng thử lại.', code: 'UPLOAD_FAILED' }
}

async function bootstrapAdmin() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD
  if (!email || !password) return
  if (!validateEmail(email) || !validatePassword(password)) throw new Error('Bootstrap admin credentials are invalid.')
  if (await authStore.findUserByEmail(email)) return
  const user = {
    id: randomUUID(),
    name: process.env.BOOTSTRAP_ADMIN_NAME?.trim() || 'Kotodama Admin',
    email,
    passwordHash: await hashPassword(password),
    role: 'admin',
    emailVerified: true,
    status: 'active',
    createdAt: new Date().toISOString(),
    lastActivityAt: null,
  }
  await authStore.createUser(user)
  await authStore.addAudit({
    id: randomUUID(),
    action: 'admin.bootstrap',
    userId: user.id,
    ip: 'server',
    at: new Date().toISOString(),
  })
}

async function route(request, response) {
  const host = request.headers.host || 'localhost'
  const url = new URL(request.url, `http://${host}`)
  const path = url.pathname

  // Serve static assets and SPA routes without CORS restrictions
  if (!path.startsWith('/api/') && path !== '/health' && path !== '/ready') {
    const served = await tryServeStatic(request, response, path)
    if (served) return
    return fail(response, 404, 'Không tìm thấy endpoint.', 'NOT_FOUND')
  }

  const origin = request.headers.origin
  const isSameOrigin = origin && (origin === `http://${host}` || origin === `https://${host}`)
  const isAllowed = !origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin) || isSameOrigin
  if (!isAllowed) return fail(response, 403, 'Origin không được phép.', 'CORS_DENIED')

  const cors = origin
    ? {
        'access-control-allow-origin': origin,
        'access-control-allow-credentials': 'true',
        vary: 'Origin',
        'access-control-allow-headers': 'Authorization, Content-Type, X-CSRF-Token',
        'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
      }
    : {}
  for (const [header, value] of Object.entries(cors)) response.setHeader(header, value)
  if (request.method === 'OPTIONS') {
    response.writeHead(204, cors)
    return response.end()
  }

  if (request.method === 'GET' && path === '/health') {
    try {
      const persistence = await databaseHealth(database)
      return json(response, 200, { data: { status: 'ok', persistence } }, cors)
    } catch {
      return json(
        response,
        503,
        { data: { status: 'degraded', persistence: { mode: 'postgresql', connected: false } } },
        cors
      )
    }
  }
  if (request.method === 'GET' && path === '/ready') {
    try {
      const persistence = await databaseHealth(database)
      if (production && !emailService.enabled) throw new Error('SMTP is not configured.')
      return json(
        response,
        200,
        { data: { status: 'ready', persistence, emailConfigured: emailService.enabled } },
        cors
      )
    } catch (error) {
      logError('readiness.failed', error)
      return json(response, 503, { data: { status: 'not_ready' } }, cors)
    }
  }

  if (
    !path.startsWith('/api/v1/auth/') &&
    !path.startsWith('/api/v1/admin/') &&
    !path.startsWith('/api/v1/account/') &&
    !path.startsWith('/api/v1/video/') &&
    !path.startsWith('/api/v1/dictionary/') &&
    !path.startsWith('/api/v1/shadowing/') &&
    !path.startsWith('/api/v1/nhaikanji/') &&
    !path.startsWith('/api/v1/curriculum/') &&
    !path.startsWith('/api/v1/srs/')
  )
    return fail(response, 404, 'Không tìm thấy endpoint.', 'NOT_FOUND')

  let body = {}
  if (request.method === 'POST') {
    // Shadowing attempts include base64-encoded audio → allow up to 10 MB
    const isShadowingAttempt = path.match(/^\/api\/v1\/shadowing\/sessions\/[0-9a-f-]+\/attempts$/i)
    const maxBodySize = isShadowingAttempt ? 10 * 1024 * 1024 : 32_768
    try {
      body = await readJson(request, { maxSize: maxBodySize })
    } catch (error) {
      return fail(
        response,
        error.message === 'PAYLOAD_TOO_LARGE' ? 413 : 400,
        error.message === 'PAYLOAD_TOO_LARGE' ? 'Dữ liệu gửi lên quá lớn.' : 'Dữ liệu JSON không hợp lệ.',
        error.message
      )
    }
  }
  const respond = (data, status, headers) => success(response, data, status, { ...cors, ...headers })

  // --- NhaiKanji Endpoints ---
  if (request.method === 'GET' && path === '/api/v1/nhaikanji/kanji') {
    const level = url.searchParams.get('level') || 'ALL'
    const query = url.searchParams.get('q') || url.searchParams.get('query') || ''
    const page = Number.parseInt(url.searchParams.get('page') || '1', 10) || 1
    const limit = Number.parseInt(url.searchParams.get('limit') || '50', 10) || 50
    const result = nhaiKanjiService.getKanjiList({ level, query, page, limit })
    return respond(result)
  }

  const nhaikanjiDetailMatch = path.match(/^\/api\/v1\/nhaikanji\/kanji\/(.+)$/)
  if (request.method === 'GET' && nhaikanjiDetailMatch) {
    const char = decodeURIComponent(nhaikanjiDetailMatch[1])
    const detail = nhaiKanjiService.getKanjiDetail(char)
    if (!detail) return fail(response, 404, 'Không tìm thấy Hán tự này.', 'KANJI_NOT_FOUND')
    return respond(detail)
  }

  if (request.method === 'GET' && path === '/api/v1/nhaikanji/bunpo') {
    const level = url.searchParams.get('level') || 'ALL'
    const bookId = url.searchParams.get('bookId') || 'all'
    const query = url.searchParams.get('q') || url.searchParams.get('query') || ''
    const page = Number.parseInt(url.searchParams.get('page') || '1', 10) || 1
    const limit = Number.parseInt(url.searchParams.get('limit') || '50', 10) || 50
    const result = nhaiKanjiService.getBunpoList({ level, bookId, query, page, limit })
    return respond(result)
  }

  if (request.method === 'GET' && path === '/api/v1/nhaikanji/jlpt/exams') {
    const level = url.searchParams.get('level') || 'ALL'
    const section = url.searchParams.get('section') || 'all'
    const result = nhaiKanjiService.getJlptExams({ level, section })
    return respond(result)
  }

  const jlptDetailMatch = path.match(/^\/api\/v1\/nhaikanji\/jlpt\/exams\/(.+)$/)
  if (request.method === 'GET' && jlptDetailMatch) {
    const examId = decodeURIComponent(jlptDetailMatch[1])
    const exam = nhaiKanjiService.getJlptExamDetail(examId)
    if (!exam) return fail(response, 404, 'Không tìm thấy đề thi này.', 'EXAM_NOT_FOUND')
    return respond(exam)
  }

  if (request.method === 'POST' && path === '/api/v1/nhaikanji/jlpt/submit') {
    const { examId, answers } = body
    if (!examId) return fail(response, 400, 'Thiếu thông tin examId.', 'MISSING_EXAM_ID')
    const result = nhaiKanjiService.submitJlptExam(examId, answers || {})
    if (!result) return fail(response, 404, 'Không tìm thấy đề thi này để chấm.', 'EXAM_NOT_FOUND')
    return respond(result)
  }

  // --- Curriculum Endpoints ---
  if (request.method === 'GET' && path === '/api/v1/curriculum/words') {
    const curriculum = url.searchParams.get('curriculum') || 'all'
    const level = url.searchParams.get('level') || 'ALL'
    const unit = url.searchParams.get('unit') || null
    const query = url.searchParams.get('q') || url.searchParams.get('query') || ''
    const page = Number.parseInt(url.searchParams.get('page') || '1', 10) || 1
    const limit = Number.parseInt(url.searchParams.get('limit') || '50', 10) || 50
    const result = curriculumService.getCurriculumWords({ curriculum, level, unit, query, page, limit })
    return respond(result)
  }

  if (request.method === 'GET' && path === '/api/v1/curriculum/grammar') {
    const curriculum = url.searchParams.get('curriculum') || 'all'
    const level = url.searchParams.get('level') || 'ALL'
    const lesson = url.searchParams.get('lesson') || null
    const query = url.searchParams.get('q') || url.searchParams.get('query') || ''
    const page = Number.parseInt(url.searchParams.get('page') || '1', 10) || 1
    const limit = Number.parseInt(url.searchParams.get('limit') || '50', 10) || 50
    const result = curriculumService.getCurriculumGrammar({ curriculum, level, lesson, query, page, limit })
    return respond(result)
  }

  if (request.method === 'GET' && path === '/api/v1/curriculum/units') {
    const curriculum = url.searchParams.get('curriculum') || 'all'
    const units = curriculumService.getCurriculumUnits(curriculum)
    return respond(units)
  }

  if (request.method === 'GET' && path === '/api/v1/curriculum/lessons') {
    const curriculum = url.searchParams.get('curriculum') || 'all'
    const lessons = curriculumService.getGrammarLessons(curriculum)
    return respond(lessons)
  }

  if (request.method === 'GET' && path === '/api/v1/curriculum/stats') {
    const stats = curriculumService.getCurriculumStats()
    return respond(stats)
  }

  // --- SRS Flashcard Endpoints (REQUIRE AUTHENTICATION) ---
  if (request.method === 'GET' && path === '/api/v1/srs/deck') {
    const user = await requireUser(request, response)
    if (!user) return
    if (!srsService) return fail(response, 503, 'Dịch vụ SRS hiện không khả dụng (yêu cầu Database).', 'SERVICE_UNAVAILABLE')
    const type = url.searchParams.get('type') || 'all'
    const status = url.searchParams.get('status') || 'all'
    const level = url.searchParams.get('level') || 'ALL'
    const query = url.searchParams.get('q') || url.searchParams.get('query') || ''
    const page = Number.parseInt(url.searchParams.get('page') || '1', 10) || 1
    const limit = Number.parseInt(url.searchParams.get('limit') || '50', 10) || 50
    try {
      const result = await srsService.getCards(user.id, { type, status, level, query, page, limit })
      return respond(result)
    } catch (err) {
      return fail(response, 500, err.message, 'SRS_ERROR')
    }
  }

  if (request.method === 'GET' && path === '/api/v1/srs/stats') {
    const user = await requireUser(request, response)
    if (!user) return
    if (!srsService) return fail(response, 503, 'Dịch vụ SRS hiện không khả dụng (yêu cầu Database).', 'SERVICE_UNAVAILABLE')
    const type = url.searchParams.get('type') || 'all'
    try {
      const stats = await srsService.getStats(user.id, { type })
      return respond(stats)
    } catch (err) {
      return fail(response, 500, err.message, 'SRS_ERROR')
    }
  }

  if (request.method === 'POST' && path === '/api/v1/srs/review') {
    const user = await requireUser(request, response)
    if (!user) return
    if (!srsService) return fail(response, 503, 'Dịch vụ SRS hiện không khả dụng (yêu cầu Database).', 'SERVICE_UNAVAILABLE')
    const { cardId, rating } = body
    if (!cardId || !rating) return fail(response, 400, 'Thiếu cardId hoặc rating.', 'MISSING_PARAMS')
    if (!['again', 'hard', 'good', 'easy'].includes(rating)) {
      return fail(response, 422, 'Rating không hợp lệ (phải là again, hard, good, easy).', 'INVALID_RATING')
    }
    try {
      const card = await srsService.submitReview(user.id, cardId, rating)
      if (!card) return fail(response, 404, 'Không tìm thấy thẻ này.', 'CARD_NOT_FOUND')
      return respond(card)
    } catch (err) {
      return fail(response, 500, err.message, 'SRS_ERROR')
    }
  }

  if (request.method === 'POST' && path === '/api/v1/srs/add') {
    const user = await requireUser(request, response)
    if (!user) return
    if (!srsService) return fail(response, 503, 'Dịch vụ SRS hiện không khả dụng (yêu cầu Database).', 'SERVICE_UNAVAILABLE')
    const cardData = body
    if (!cardData || (!cardData.term && !cardData.word)) {
      return fail(response, 400, 'Thiếu dữ liệu từ vựng/Hán tự/ngữ pháp.', 'MISSING_TERM')
    }
    try {
      const card = await srsService.addCard(user.id, cardData)
      return respond(card, 201)
    } catch (err) {
      return fail(response, 500, err.message, 'SRS_ERROR')
    }
  }

  if (request.method === 'GET' && path === '/api/v1/srs/saved-terms') {
    const user = await requireUser(request, response)
    if (!user) return
    if (!srsService) return fail(response, 503, 'Dịch vụ SRS hiện không khả dụng (yêu cầu Database).', 'SERVICE_UNAVAILABLE')
    try {
      const terms = await srsService.getSavedTerms(user.id)
      return respond(terms)
    } catch (err) {
      return fail(response, 500, err.message, 'SRS_ERROR')
    }
  }

  if (request.method === 'GET' && path === '/api/v1/dictionary/search') {
    const keyword = url.searchParams.get('keyword') ?? url.searchParams.get('q') ?? ''
    const limit = Number.parseInt(url.searchParams.get('limit') ?? '20', 10) || 20
    const jlpt = url.searchParams.get('jlpt') ?? null
    const results = await dictionaryService.search(keyword, { limit, jlpt })
    return respond({ results, count: results.length })
  }

  const wordDetailMatch = path.match(/^\/api\/v1\/dictionary\/word\/(.+)$/)
  if (request.method === 'GET' && wordDetailMatch) {
    const word = decodeURIComponent(wordDetailMatch[1])
    const detail = await dictionaryService.getWordDetail(word)
    if (!detail) return fail(response, 404, 'Không tìm thấy từ này trong từ điển.', 'WORD_NOT_FOUND')
    return respond(detail)
  }

  const kanjiDetailMatch = path.match(/^\/api\/v1\/dictionary\/kanji\/(.+)$/)
  if (request.method === 'GET' && kanjiDetailMatch) {
    const char = decodeURIComponent(kanjiDetailMatch[1])
    const detail = dictionaryService.getKanjiDetail(char)
    if (!detail) return fail(response, 404, 'Không tìm thấy Hán tự này.', 'KANJI_NOT_FOUND')
    return respond(detail)
  }

  if (request.method === 'POST' && path === '/api/v1/auth/register') {
    if (!(await rateLimit(request, response, 'register', 5))) return
    const email = emailFrom(body)
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!validateEmail(email) || !name || name.length > 100 || !validatePassword(body.password))
      return fail(response, 422, 'Thông tin đăng ký chưa hợp lệ.', 'VALIDATION_ERROR')
    if (await authStore.findUserByEmail(email)) return fail(response, 409, 'Email này đã được sử dụng.', 'EMAIL_EXISTS')
    const user = {
      id: randomUUID(),
      name,
      email,
      passwordHash: await hashPassword(body.password),
      role: 'learner',
      emailVerified: false,
      status: 'active',
      createdAt: new Date().toISOString(),
      lastActivityAt: null,
    }
    try {
      await authStore.createUser(user)
    } catch (error) {
      if (error.code === '23505') return fail(response, 409, 'Email này đã được sử dụng.', 'EMAIL_EXISTS')
      throw error
    }
    await audit('auth.register', user.id, request)
    await sendOneTimeEmail(user, 'email_verification', 24 * 60 * 60 * 1000)
    const session = await issueSession(user, request)
    return respond({ accessToken: session.accessToken, user: publicUser(user) }, 201, session.headers)
  }
  if (request.method === 'POST' && path === '/api/v1/auth/login') {
    if (!(await rateLimit(request, response, 'login', 10))) return
    const user = await authStore.findUserByEmail(emailFrom(body))
    const valid = user && (await verifyPassword(body.password, user.passwordHash))
    if (!valid || user.status !== 'active')
      return fail(response, 401, 'Email hoặc mật khẩu không chính xác.', 'INVALID_CREDENTIALS')
    const session = await issueSession(user, request)
    await audit('auth.login', user.id, request)
    return respond({ accessToken: session.accessToken, user: publicUser(user) }, 200, session.headers)
  }
  if (request.method === 'POST' && path === '/api/v1/auth/refresh') {
    const currentToken = parseCookies(request).kotodama_refresh
    const session = await getRefreshSessionRecord(request)
    if (!session) return fail(response, 401, 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'UNAUTHENTICATED')
    if (!requireCsrf(request, response, session)) return
    const user = await authStore.findUserById(session.userId)
    if (!user || user.status !== 'active')
      return fail(response, 401, 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'UNAUTHENTICATED')
    const rotation = await rotateSession(user, request, currentToken, session.familyId)
    if (rotation.status === 'reused') {
      await audit('auth.refresh-token-reused', user.id, request)
      return fail(response, 401, 'Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.', 'SESSION_REUSED')
    }
    if (rotation.status !== 'rotated')
      return fail(response, 401, 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'UNAUTHENTICATED')
    await audit('auth.refresh', user.id, request)
    return respond({ accessToken: rotation.next.accessToken, user: publicUser(user) }, 200, rotation.next.headers)
  }
  if (request.method === 'POST' && path === '/api/v1/auth/logout') {
    const session = await getRefreshSession(request)
    if (session && !requireCsrf(request, response, session)) return
    const token = parseCookies(request).kotodama_refresh
    if (token) await authStore.deleteRefreshSession(sha256(token))
    if (session) await audit('auth.logout', session.userId, request)
    return respond(undefined, 200, { 'set-cookie': clearSessionCookies() })
  }
  if (request.method === 'GET' && path === '/api/v1/auth/me') {
    const user = await requireUser(request, response)
    if (!user) return
    return respond(publicUser(user))
  }
  if (request.method === 'POST' && path === '/api/v1/auth/password/forgot') {
    if (!(await rateLimit(request, response, 'forgot', 5))) return
    const user = await authStore.findUserByEmail(emailFrom(body))
    if (user) {
      await audit('auth.password-reset-requested', user.id, request)
      await sendOneTimeEmail(user, 'password_reset', 30 * 60 * 1000)
    }
    return respond(undefined, 202)
  }
  if (request.method === 'POST' && path === '/api/v1/auth/password/reset') {
    const record = await consumeOneTimeToken(body.token, 'password_reset')
    if (!record || !validatePassword(body.password))
      return fail(response, 422, 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.', 'RESET_INVALID')
    const user = await authStore.findUserById(record.userId)
    if (!user) return fail(response, 422, 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.', 'RESET_INVALID')
    await authStore.updateUser(user.id, { passwordHash: await hashPassword(body.password) })
    await authStore.incrementTokenVersion(user.id)
    await authStore.revokeUserSessions(user.id)
    await audit('auth.password-reset', user.id, request)
    return respond(undefined)
  }
  if (request.method === 'POST' && path === '/api/v1/auth/password/change') {
    const user = await requireUser(request, response)
    if (!user) return
    const session = await getRefreshSession(request)
    if (!requireCsrf(request, response, session)) return
    if (!(await verifyPassword(body.currentPassword, user.passwordHash)) || !validatePassword(body.password))
      return fail(response, 422, 'Mật khẩu hiện tại hoặc mật khẩu mới không hợp lệ.', 'PASSWORD_CHANGE_INVALID')
    await authStore.updateUser(user.id, { passwordHash: await hashPassword(body.password) })
    const securedUser = await authStore.incrementTokenVersion(user.id)
    await authStore.revokeUserSessions(user.id)
    await audit('auth.password-change', user.id, request)
    const next = await issueSession(securedUser, request)
    return respond({ accessToken: next.accessToken, user: publicUser(securedUser) }, 200, next.headers)
  }
  if (request.method === 'POST' && path === '/api/v1/auth/email/resend') {
    if (!(await rateLimit(request, response, 'verify', 5))) return
    const user = await authStore.findUserByEmail(emailFrom(body))
    if (user && !user.emailVerified) {
      await audit('auth.email-verification-requested', user.id, request)
      await sendOneTimeEmail(user, 'email_verification', 24 * 60 * 60 * 1000)
    }
    return respond(undefined, 202)
  }
  if (request.method === 'POST' && path === '/api/v1/auth/email/verify') {
    const record = await consumeOneTimeToken(body.token, 'email_verification')
    if (!record) return fail(response, 422, 'Liên kết xác minh không hợp lệ hoặc đã hết hạn.', 'VERIFICATION_INVALID')
    const user = await authStore.findUserById(record.userId)
    await authStore.updateUser(user.id, { emailVerified: true })
    await audit('auth.email-verified', user.id, request)
    return respond(undefined)
  }
  if (request.method === 'GET' && path === '/api/v1/account/profile') {
    const user = await requireUser(request, response)
    if (!user) return
    const [preferences, learningPlan] = await Promise.all([
      authStore.getPreferences(user.id),
      authStore.getLearningPlan(user.id),
    ])
    return respond({ user: publicUser(user), preferences, learningPlan })
  }
  if (request.method === 'POST' && path === '/api/v1/account/profile') {
    const user = await requireUser(request, response)
    if (!user) return
    const session = await getRefreshSession(request)
    if (!requireCsrf(request, response, session)) return
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name || name.length > 100) return fail(response, 422, 'Tên hồ sơ không hợp lệ.', 'VALIDATION_ERROR')
    const updated = await authStore.updateUser(user.id, { name })
    await audit('account.profile-updated', user.id, request)
    return respond(publicUser(updated))
  }
  if (request.method === 'GET' && path === '/api/v1/account/preferences') {
    const user = await requireUser(request, response)
    if (!user) return
    return respond(await authStore.getPreferences(user.id))
  }
  if (request.method === 'POST' && path === '/api/v1/account/preferences') {
    const user = await requireUser(request, response)
    if (!user) return
    const session = await getRefreshSession(request)
    if (!requireCsrf(request, response, session)) return
    const patch = validPreferencesPatch(body)
    if (!patch) return fail(response, 422, 'Cài đặt không hợp lệ.', 'VALIDATION_ERROR')
    const preferences = await authStore.updatePreferences(user.id, patch)
    await audit('account.preferences-updated', user.id, request, { fields: Object.keys(patch) })
    return respond(preferences)
  }
  if (request.method === 'GET' && path === '/api/v1/account/learning-plan') {
    const user = await requireUser(request, response)
    if (!user) return
    return respond(await authStore.getLearningPlan(user.id))
  }
  if (request.method === 'POST' && path === '/api/v1/account/learning-plan') {
    const user = await requireUser(request, response)
    if (!user) return
    const session = await getRefreshSession(request)
    if (!requireCsrf(request, response, session)) return
    const plan = validLearningPlan(body)
    if (!plan) return fail(response, 422, 'Lộ trình học không hợp lệ.', 'VALIDATION_ERROR')
    const learningPlan = await authStore.saveLearningPlan(user.id, plan)
    await audit('account.learning-plan-updated', user.id, request, { level: plan.level })
    return respond(learningPlan)
  }
  if (request.method === 'GET' && path === '/api/v1/video/assets') {
    const user = await requireUser(request, response)
    if (!user) return
    const limit = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '20', 10) || 20))
    return respond({ items: await authStore.listMediaAssets(user.id, limit) })
  }
  if (request.method === 'POST' && path === '/api/v1/video/assets') {
    const user = await requireUser(request, response)
    if (!user) return
    const session = await getRefreshSession(request)
    if (!requireCsrf(request, response, session)) return
    if (!(await rateLimit(request, response, 'video-asset-draft', 20, 60 * 60 * 1000))) return
    const draft = validMediaAssetDraft(body)
    if (!draft) return fail(response, 422, 'Thông tin video chưa hợp lệ.', 'VALIDATION_ERROR')
    const asset = await authStore.createMediaAsset({ id: randomUUID(), ownerUserId: user.id, ...draft })
    await audit('video.asset-draft-created', user.id, request, {
      sourceType: draft.sourceType,
      rightsBasis: draft.rightsBasis,
    })
    return respond(asset, 201)
  }
  if (request.method === 'POST' && path === '/api/v1/video/youtube-imports') {
    const user = await requireUser(request, response)
    if (!user) return
    const session = await getRefreshSession(request)
    if (!requireCsrf(request, response, session)) return
    if (!config.youtube.enabled)
      return fail(response, 409, 'Nhập YouTube chỉ được bật trong môi trường local.', 'YOUTUBE_IMPORT_DISABLED')
    if (!(await rateLimit(request, response, 'youtube-import', 6, 60 * 60 * 1000))) return
    const sourceUrl = normalizeYouTubeUrl(body?.sourceUrl)
    if (!sourceUrl) return fail(response, 422, 'URL YouTube không hợp lệ.', 'YOUTUBE_URL_INVALID')
    const asset = await authStore.createMediaAsset({
      id: randomUUID(),
      ownerUserId: user.id,
      sourceType: 'youtube',
      title: 'Đang nhập video YouTube',
      language: 'ja',
      rightsBasis: 'owned',
      sourceReference: sourceUrl,
      originalFilename: null,
    })
    const job = await authStore.enqueueMediaProcessingJob(asset.id, 'youtube_download', {
      input: { sourceUrl },
      provider: 'yt-dlp',
    })
    await audit('video.youtube-import-created', user.id, request, { mediaAssetId: asset.id })
    return respond({ asset, job }, 202)
  }
  const videoAssetUploadSessionMatch = path.match(/^\/api\/v1\/video\/assets\/([0-9a-f-]{36})\/upload-session$/i)
  if (request.method === 'POST' && videoAssetUploadSessionMatch) {
    const user = await requireUser(request, response)
    if (!user) return
    const session = await getRefreshSession(request)
    if (!requireCsrf(request, response, session)) return
    const asset = await authStore.findMediaAssetForUser(videoAssetUploadSessionMatch[1], user.id)
    if (!asset) return fail(response, 404, 'Không tìm thấy video.', 'VIDEO_NOT_FOUND')
    if (asset.sourceType !== 'user_upload')
      return fail(response, 409, 'Video catalogue không thể tải tệp từ phiên này.', 'UPLOAD_NOT_ALLOWED')
    if (!['draft', 'failed'].includes(asset.processingStatus))
      return fail(response, 409, 'Video này đang được xử lý hoặc đã tải lên.', 'UPLOAD_STATE_CONFLICT')
    return respond({
      uploadUrl: `/api/v1/video/assets/${asset.id}/upload`,
      method: 'PUT',
      maxUploadBytes: config.media.maxUploadBytes,
      acceptedMimeTypes: ['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg'],
    })
  }
  const videoAssetUploadMatch = path.match(/^\/api\/v1\/video\/assets\/([0-9a-f-]{36})\/upload$/i)
  if (request.method === 'PUT' && videoAssetUploadMatch) {
    const user = await requireUser(request, response)
    if (!user) return
    const session = await getRefreshSession(request)
    if (!requireCsrf(request, response, session)) return
    if (!(await rateLimit(request, response, 'video-upload', 8, 60 * 60 * 1000))) return
    const asset = await authStore.findMediaAssetForUser(videoAssetUploadMatch[1], user.id)
    if (!asset) return fail(response, 404, 'Không tìm thấy video.', 'VIDEO_NOT_FOUND')
    if (asset.sourceType !== 'user_upload')
      return fail(response, 409, 'Video catalogue không thể tải tệp từ phiên này.', 'UPLOAD_NOT_ALLOWED')
    const started = await authStore.markMediaAssetUploading(asset.id, user.id)
    if (!started) return fail(response, 409, 'Video không còn sẵn sàng để tải lên.', 'UPLOAD_STATE_CONFLICT')
    try {
      const upload = await mediaStorage.writeUpload(asset.id, request)
      const completed = await authStore.completeMediaAssetUpload(asset.id, user.id, upload)
      if (!completed) throw new MediaStorageError('UPLOAD_STATE_CONFLICT', 'The upload state changed unexpectedly.')
      await audit('video.asset-uploaded', user.id, request, {
        mediaAssetId: asset.id,
        byteSize: upload.byteSize,
        mimeType: upload.mimeType,
      })
      return respond({ asset: completed.asset, job: completed.job }, 202)
    } catch (error) {
      const failure = uploadFailure(error)
      await authStore.failMediaAssetUpload(asset.id, user.id, failure.code, failure.message).catch(() => undefined)
      logError('media.upload-failed', error, { mediaAssetId: asset.id, userId: user.id })
      return fail(response, failure.status, failure.message, failure.code)
    }
  }
  const videoAssetJobsMatch = path.match(/^\/api\/v1\/video\/assets\/([0-9a-f-]{36})\/jobs$/i)
  if (request.method === 'GET' && videoAssetJobsMatch) {
    const user = await requireUser(request, response)
    if (!user) return
    const asset = await authStore.findMediaAssetForUser(videoAssetJobsMatch[1], user.id)
    if (!asset) return fail(response, 404, 'Không tìm thấy video.', 'VIDEO_NOT_FOUND')
    const jobs = await authStore.listMediaProcessingJobsForAsset(asset.id, user.id)
    return respond({ items: jobs })
  }
  const videoAssetRetryMatch = path.match(/^\/api\/v1\/video\/assets\/([0-9a-f-]{36})\/retry$/i)
  if (request.method === 'POST' && videoAssetRetryMatch) {
    const user = await requireUser(request, response)
    if (!user) return
    const session = await getRefreshSession(request)
    if (!requireCsrf(request, response, session)) return
    if (!(await rateLimit(request, response, 'video-processing-retry', 10, 60 * 60 * 1000))) return
    const retried = await authStore.retryFailedMediaProcessingJob(videoAssetRetryMatch[1], user.id)
    if (!retried) return fail(response, 409, 'Không có tác vụ thất bại để thử lại.', 'VIDEO_RETRY_UNAVAILABLE')
    await audit('video.processing-retried', user.id, request, {
      mediaAssetId: retried.asset.id,
      jobType: retried.job.jobType,
    })
    return respond(retried, 202)
  }
  const videoPlaybackSessionMatch = path.match(/^\/api\/v1\/video\/assets\/([0-9a-f-]{36})\/playback-session$/i)
  if (request.method === 'POST' && videoPlaybackSessionMatch) {
    const user = await requireUser(request, response)
    if (!user) return
    const session = await getRefreshSession(request)
    if (!requireCsrf(request, response, session)) return
    if (!(await rateLimit(request, response, 'video-playback-session', 60, 60 * 1000))) return
    const asset = await authStore.findMediaAssetForUser(videoPlaybackSessionMatch[1], user.id)
    if (!asset) return fail(response, 404, 'Không tìm thấy video.', 'VIDEO_NOT_FOUND')
    if (!asset.mimeType || !['queued', 'processing', 'ready'].includes(asset.processingStatus))
      return fail(response, 409, 'Video chưa sẵn sàng để phát.', 'VIDEO_NOT_READY')
    const token = signPlaybackToken({
      userId: user.id,
      assetId: asset.id,
      tokenVersion: user.tokenVersion ?? 0,
      secret: jwtSecret,
    })
    return respond({
      contentUrl: `/api/v1/video/assets/${asset.id}/content?token=${encodeURIComponent(token)}`,
      expiresInSeconds: 300,
    })
  }
  const videoContentMatch = path.match(/^\/api\/v1\/video\/assets\/([0-9a-f-]{36})\/content$/i)
  if (request.method === 'GET' && videoContentMatch) {
    const claims = verifyPlaybackToken(url.searchParams.get('token'), jwtSecret)
    if (!claims || claims.assetId !== videoContentMatch[1])
      return fail(response, 401, 'Liên kết phát video không hợp lệ hoặc đã hết hạn.', 'PLAYBACK_TOKEN_INVALID')
    const user = await authStore.findUserById(claims.sub)
    if (!user || user.status !== 'active' || claims.ver !== (user.tokenVersion ?? 0))
      return fail(response, 401, 'Liên kết phát video không còn hiệu lực.', 'PLAYBACK_TOKEN_INVALID')
    const asset = await authStore.findMediaAssetForUser(videoContentMatch[1], user.id)
    if (!asset || !asset.mimeType || !['queued', 'processing', 'ready'].includes(asset.processingStatus))
      return fail(response, 404, 'Video chưa sẵn sàng để phát.', 'VIDEO_NOT_READY')
    return streamMediaContent(request, response, asset)
  }
  const videoAssetTranscriptMatch = path.match(/^\/api\/v1\/video\/assets\/([0-9a-f-]{36})\/transcript$/i)
  if (request.method === 'GET' && videoAssetTranscriptMatch) {
    const user = await requireUser(request, response)
    if (!user) return
    const transcript = await authStore.findCurrentTranscript(videoAssetTranscriptMatch[1], user.id)
    if (!transcript) return fail(response, 404, 'Transcript chưa sẵn sàng.', 'TRANSCRIPT_NOT_READY')
    return respond(transcript)
  }
  const videoAssetMatch = path.match(/^\/api\/v1\/video\/assets\/([0-9a-f-]{36})$/i)
  if (request.method === 'GET' && videoAssetMatch) {
    const user = await requireUser(request, response)
    if (!user) return
    const asset = await authStore.findMediaAssetForUser(videoAssetMatch[1], user.id)
    if (!asset) return fail(response, 404, 'Không tìm thấy video.', 'VIDEO_NOT_FOUND')
    return respond(asset)
  }

  // ── Shadowing Routes ──
  if (request.method === 'POST' && path === '/api/v1/shadowing/sessions') {
    const user = await requireUser(request, response)
    if (!user) return
    const session = await getRefreshSession(request)
    if (!requireCsrf(request, response, session)) return
    const mediaAssetId = typeof body.mediaAssetId === 'string' ? body.mediaAssetId.trim() : ''
    if (!mediaAssetId) return fail(response, 422, 'mediaAssetId là bắt buộc.', 'VALIDATION_ERROR')
    const asset = await authStore.findMediaAssetForUser(mediaAssetId, user.id)
    if (!asset) return fail(response, 404, 'Không tìm thấy video.', 'VIDEO_NOT_FOUND')
    const shadowingSession = await authStore.createShadowingSession({
      userId: user.id,
      mediaAssetId,
      transcriptVersionId: typeof body.transcriptVersionId === 'string' ? body.transcriptVersionId.trim() : null,
      mode: ['sequential', 'random', 'roleplay'].includes(body.mode) ? body.mode : 'sequential',
      selectedSpeakerLabel: typeof body.selectedSpeakerLabel === 'string' ? body.selectedSpeakerLabel.trim() : null,
    })
    if (!shadowingSession)
      return fail(response, 409, 'Không thể tạo phiên luyện tập shadowing.', 'SESSION_CREATE_FAILED')
    return respond({ session: shadowingSession }, 201)
  }

  const shadowingSessionMatch = path.match(/^\/api\/v1\/shadowing\/sessions\/([0-9a-f-]{36})$/i)
  if (request.method === 'GET' && shadowingSessionMatch) {
    const user = await requireUser(request, response)
    if (!user) return
    const session = await authStore.findShadowingSession(shadowingSessionMatch[1], user.id)
    if (!session) return fail(response, 404, 'Không tìm thấy phiên shadowing.', 'SESSION_NOT_FOUND')
    const attempts = await authStore.listShadowingAttemptsForSession(session.id, user.id)
    return respond({ session, attempts })
  }

  const shadowingSessionNextMatch = path.match(/^\/api\/v1\/shadowing\/sessions\/([0-9a-f-]{36})\/next$/i)
  if (request.method === 'POST' && shadowingSessionNextMatch) {
    const user = await requireUser(request, response)
    if (!user) return
    const session = await getRefreshSession(request)
    if (!requireCsrf(request, response, session)) return
    const nextSequenceNo = Math.max(1, Number(body.nextSequenceNo) || 1)
    const isCompleted = Boolean(body.isCompleted)
    const updatedSession = await authStore.advanceShadowingSession(
      shadowingSessionNextMatch[1],
      user.id,
      nextSequenceNo,
      isCompleted
    )
    if (!updatedSession) return fail(response, 404, 'Không tìm thấy phiên shadowing.', 'SESSION_NOT_FOUND')
    return respond({ session: updatedSession })
  }

  const shadowingSessionAttemptMatch = path.match(/^\/api\/v1\/shadowing\/sessions\/([0-9a-f-]{36})\/attempts$/i)
  if (request.method === 'POST' && shadowingSessionAttemptMatch) {
    const user = await requireUser(request, response)
    if (!user) return
    const session = await getRefreshSession(request)
    if (!requireCsrf(request, response, session)) return
    const shadowingSession = await authStore.findShadowingSession(shadowingSessionAttemptMatch[1], user.id)
    if (!shadowingSession) return fail(response, 404, 'Không tìm thấy phiên shadowing.', 'SESSION_NOT_FOUND')

    const transcriptSegmentId = typeof body.transcriptSegmentId === 'string' ? body.transcriptSegmentId.trim() : ''
    const referenceText = typeof body.referenceText === 'string' ? body.referenceText.trim() : ''
    const audioBase64 = typeof body.audioBase64 === 'string' ? body.audioBase64 : ''
    const durationMs = Math.max(0, Number(body.durationMs) || 0)
    const attemptNo = Math.max(1, Number(body.attemptNo) || 1)

    if (!transcriptSegmentId || !audioBase64) {
      return fail(response, 422, 'Thiếu thông tin đoạn thoại hoặc âm thanh ghi âm.', 'VALIDATION_ERROR')
    }

    let recognizedText = ''
    let dspComparison = null

    if (audioBase64.length > 50) {
      const tempDir = await mkdtemp(join(tmpdir(), 'kotodama-shadowing-'))
      const rawAudioPath = join(tempDir, 'raw_attempt.webm')
      const tempAudioPath = join(tempDir, 'attempt.wav')
      const refAudioPath = join(tempDir, 'reference.wav')
      try {
        const rawBase64 = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64
        const audioBuffer = Buffer.from(rawBase64, 'base64')
        await writeFile(rawAudioPath, audioBuffer)

        // Convert incoming web audio format to standard 16kHz mono WAV PCM
        const ffmpegPath = config.transcription?.ffmpegPath || 'ffmpeg'
        log('shadowing.audio-received', { rawSize: audioBuffer.length, ffmpegPath })
        try {
          await convertAudioToPcmWav({
            inputPath: rawAudioPath,
            outputPath: tempAudioPath,
            ffmpegPath,
          })
          const { stat } = await import('node:fs/promises')
          const wavStat = await stat(tempAudioPath).catch(() => null)
          log('shadowing.audio-converted', { wavSize: wavStat?.size ?? 0 })
        } catch (convertError) {
          logError('shadowing.audio-convert-failed', convertError)
          // Do NOT fallback to raw WebM — it will break Whisper and DSP
          // Instead, just copy as-is and let downstream handle gracefully
          await writeFile(tempAudioPath, audioBuffer)
        }

        // 1. Japanese Speech Recognition (Try fast local Whisper first, fallback to Gemini Cloud ASR)
        const localAsrUrl = config.transcription?.localAsrUrl || 'http://127.0.0.1:8788'
        let localSuccess = false
        try {
          const localAsrResult = await transcribeJapaneseAudioChunk({
            filePath: tempAudioPath,
            fileName: 'attempt.wav',
            config: { ...config.transcription, provider: 'local_whisper', localAsrUrl, timeoutMs: 4000 },
            prompt: referenceText,
          })
          const segments = Array.isArray(localAsrResult?.segments) ? localAsrResult.segments : []
          recognizedText = segments
            .map((s) => s.text)
            .join(' ')
            .trim()
          if (recognizedText) localSuccess = true
        } catch (localAsrError) {
          log('info', 'shadowing.local-asr-unavailable-fallback-to-gemini', { error: localAsrError.message })
        }

        if (!localSuccess && (config.transcription?.apiKey || process.env.GEMINI_API_KEY)) {
          try {
            const fallbackKey = config.transcription?.apiKey || process.env.GEMINI_API_KEY
            const cloudResult = await transcribeJapaneseAudioChunk({
              filePath: tempAudioPath,
              fileName: 'attempt.wav',
              config: {
                ...config.transcription,
                provider: 'gemini',
                apiKey: fallbackKey,
                model: process.env.GEMINI_TRANSCRIPTION_MODEL || 'gemini-3.5-flash-lite',
                timeoutMs: 15000,
              },
              prompt: referenceText,
            })
            const segments = Array.isArray(cloudResult?.segments) ? cloudResult.segments : []
            recognizedText = segments
              .map((s) => s.text)
              .join(' ')
              .trim()
          } catch (cloudError) {
            logError('shadowing.cloud-transcribe-failed', cloudError)
          }
        }

        // 2. DSP Pitch & Rhythm Comparison with Native Reference Audio
        try {
          const mediaAsset = await authStore.findMediaAssetForProcessing(shadowingSession.mediaAssetId)
          if (mediaAsset?.storageKey) {
            const transcript = await authStore.findCurrentTranscript(shadowingSession.mediaAssetId, user.id)
            const targetSegment = transcript?.segments?.find(
              (s) => s.id === transcriptSegmentId || transcriptSegmentId.startsWith(s.id)
            )
            if (targetSegment && targetSegment.endMs > targetSegment.startMs) {
              const sourceFilePath = mediaStorage.absolutePath(mediaAsset.storageKey)
              await extractAudioSnippet({
                sourcePath: sourceFilePath,
                startMs: targetSegment.startMs,
                endMs: targetSegment.endMs,
                outputPath: refAudioPath,
                ffmpegPath: config.transcription?.ffmpegPath,
              })
              dspComparison = await comparePitchAudioWithLocalDsp({
                referenceAudioPath: refAudioPath,
                userAudioPath: tempAudioPath,
                localAsrUrl: localAsrUrl,
                timeoutMs: 30000,
              })
            }
          }
        } catch (dspError) {
          logError('shadowing.dsp-compare-failed', dspError)
          dspComparison = null
        }
      } finally {
        await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
      }
    }

    const evaluation = evaluateShadowingAttempt({
      referenceText,
      recognizedText,
      referenceDurationMs: Math.max(0, Number(body.referenceDurationMs) || durationMs),
      userDurationMs: durationMs,
      dspComparison,
    })

    try {
      const attempt = await authStore.saveShadowingAttempt({
        sessionId: shadowingSession.id,
        transcriptSegmentId,
        attemptNo,
        audioStorageKey: null,
        durationMs,
        recognizedText,
        alignment: evaluation.alignment,
        evaluatorProvider: `${config.transcription?.provider || 'local'}:dsp_pitch_dtw`,
        evaluationStatus: 'scored',
        score: {
          overallScore: evaluation.overallScore,
          contentScore: evaluation.contentScore,
          pronunciationScore: evaluation.pronunciationScore,
          timingScore: evaluation.timingScore,
          prosodyScore: evaluation.pitchScore,
          confidence: evaluation.confidence,
          feedback: evaluation.feedback,
          scoringVersion: evaluation.scoringVersion,
        },
      })

      return respond({ attempt, evaluation }, 201)
    } catch (saveError) {
      logError('shadowing.save-attempt-failed', saveError)
      // Still return the evaluation result even if DB save failed
      return respond(
        {
          attempt: {
            id: null,
            sessionId: shadowingSession.id,
            transcriptSegmentId,
            attemptNo,
            durationMs,
            recognizedText,
            alignment: evaluation.alignment,
            evaluatorProvider: 'local:dsp_pitch_dtw',
            evaluationStatus: 'scored',
            createdAt: new Date().toISOString(),
            score: {
              overallScore: evaluation.overallScore,
              contentScore: evaluation.contentScore,
              pronunciationScore: evaluation.pronunciationScore,
              timingScore: evaluation.timingScore,
              prosodyScore: evaluation.pitchScore,
              confidence: evaluation.confidence,
              feedback: evaluation.feedback,
              scoringVersion: evaluation.scoringVersion,
            },
          },
          evaluation,
        },
        201
      )
    }
  }

  const shadowingAttemptMatch = path.match(/^\/api\/v1\/shadowing\/attempts\/([0-9a-f-]{36})$/i)
  if (request.method === 'GET' && shadowingAttemptMatch) {
    const user = await requireUser(request, response)
    if (!user) return
    const attempt = await authStore.findShadowingAttempt(shadowingAttemptMatch[1], user.id)
    if (!attempt) return fail(response, 404, 'Không tìm thấy kết quả luyện tập.', 'ATTEMPT_NOT_FOUND')
    return respond({ attempt })
  }

  if (request.method === 'GET' && path === '/api/v1/admin/users') {
    if (!(await requireAdmin(request, response))) return
    const query = String(url.searchParams.get('query') ?? '')
      .trim()
      .toLowerCase()
    const role = url.searchParams.get('role')
    const status = url.searchParams.get('status')
    const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
    const pageSize = Math.min(50, Math.max(5, Number.parseInt(url.searchParams.get('pageSize') ?? '10', 10) || 10))
    const result = await authStore.listUsers({ query, role, status, page, pageSize })
    return respond({
      ...result,
      items: result.items.map((user) => ({
        ...publicUser(user),
        createdAt: user.createdAt,
        lastActivityAt: user.lastActivityAt,
      })),
    })
  }
  const userMatch = path.match(/^\/api\/v1\/admin\/users\/([^/]+)\/(status|role)$/)
  if (request.method === 'POST' && userMatch) {
    const admin = await requireAdmin(request, response)
    if (!admin) return
    const session = await getRefreshSession(request)
    if (!requireCsrf(request, response, session)) return
    const target = await authStore.findUserById(userMatch[1])
    if (!target) return fail(response, 404, 'Không tìm thấy người dùng.', 'USER_NOT_FOUND')
    const action = userMatch[2]
    if (action === 'status') {
      if (!['active', 'suspended'].includes(body.status))
        return fail(response, 422, 'Trạng thái tài khoản không hợp lệ.', 'VALIDATION_ERROR')
      if (target.id === admin.id && body.status === 'suspended')
        return fail(response, 409, 'Bạn không thể tự khóa tài khoản của mình.', 'SELF_LOCK_FORBIDDEN')
      const change = await authStore.updateUserAccess(target.id, { status: body.status })
      if (change.conflict)
        return fail(response, 409, 'Không thể khóa quản trị viên hoạt động cuối cùng.', 'LAST_ADMIN_PROTECTED')
      const updated = change.user
      await audit(`admin.user-${body.status}`, admin.id, request, { targetUserId: target.id })
      return respond(publicUser(updated))
    }
    if (!['learner', 'admin'].includes(body.role))
      return fail(response, 422, 'Vai trò không hợp lệ.', 'VALIDATION_ERROR')
    if (target.id === admin.id && body.role !== 'admin')
      return fail(response, 409, 'Bạn không thể tự hạ quyền quản trị của mình.', 'SELF_DEMOTION_FORBIDDEN')
    const change = await authStore.updateUserAccess(target.id, { role: body.role })
    if (change.conflict)
      return fail(response, 409, 'Không thể hạ quyền quản trị viên hoạt động cuối cùng.', 'LAST_ADMIN_PROTECTED')
    const updated = change.user
    await audit('admin.user-role-changed', admin.id, request, { targetUserId: target.id, role: body.role })
    return respond(publicUser(updated))
  }
  if (request.method === 'GET' && path === '/api/v1/admin/audit') {
    if (!(await requireAdmin(request, response))) return
    return respond({ items: await authStore.listAudit(100) })
  }
  return fail(response, 404, 'Không tìm thấy endpoint.', 'NOT_FOUND')
}

await bootstrapAdmin()
await authStore.cleanupExpiredData()
const cleanupInterval = setInterval(
  () => authStore.cleanupExpiredData().catch((error) => logError('maintenance.cleanup-failed', error)),
  6 * 60 * 60 * 1000
)
cleanupInterval.unref()

const server = http.createServer((request, response) => {
  const requestId = /^[a-zA-Z0-9_-]{8,120}$/.test(String(request.headers['x-request-id'] ?? ''))
    ? String(request.headers['x-request-id'])
    : randomUUID()
  response.setHeader('x-request-id', requestId)
  route(request, response).catch((error) => {
    logError('request.failed', error, { requestId, method: request.method, path: request.url })
    fail(response, 500, 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.', 'INTERNAL_ERROR')
  })
})
const host = process.env.HOST ?? '0.0.0.0'
server.listen(port, host, () => log('info', 'server.started', { port, host, persistence: authStore.mode }))

async function shutdown() {
  clearInterval(cleanupInterval)
  server.close()
  if (database) await database.end()
}

process.once('SIGTERM', shutdown)
process.once('SIGINT', shutdown)
