import http from 'node:http'
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, open, readFile, rename, rm, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const root = dirname(fileURLToPath(import.meta.url))
const publicRoot = resolve(root, '..', 'public')
const storageRoot = resolve(process.env.RESEARCH_STORAGE_PATH || join(root, '..', 'var', 'pronunciation-research'))
const port = Number(process.env.PORT || 8790)
const generatedReviewKey = randomBytes(24).toString('base64url')
const reviewKey = process.env.RESEARCH_REVIEW_KEY || generatedReviewKey
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.')
if (process.env.NODE_ENV === 'production' && !process.env.RESEARCH_REVIEW_KEY)
  throw new Error('RESEARCH_REVIEW_KEY is required in production.')
if (reviewKey.length < 24) throw new Error('RESEARCH_REVIEW_KEY must be at least 24 characters.')
const usesLocalDatabase = /@(localhost|127\.0\.0\.1)(:|\/)/i.test(process.env.DATABASE_URL)
const ssl = process.env.DATABASE_SSL === 'true' || (!usesLocalDatabase && process.env.DATABASE_SSL !== 'false')
  ? { rejectUnauthorized: false }
  : undefined
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl })

const scenarios = new Map([
  ['tsu_chu', { textJa: '私はつくえを使います。', targetPhone: 'ts', targetError: 'tsu_to_chu' }],
  ['sokuon', { textJa: '切手を買いました。', targetPhone: 'cl', targetError: 'sokuon' }],
  ['long_vowel', { textJa: 'ケーキを食べました。', targetPhone: 'e', targetError: 'long_vowel' }],
  ['mora_n', { textJa: '新聞を読みます。', targetPhone: 'N', targetError: 'mora_n' }],
])
const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' }

function json(response, status, data) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' })
  response.end(JSON.stringify(data))
}
function fail(response, status, message) { return json(response, status, { error: { message } }) }
async function readJson(request) {
  let size = 0; const chunks = []
  for await (const chunk of request) { size += chunk.length; if (size > 16_384) throw new Error('Payload too large.'); chunks.push(chunk) }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new Error('Invalid JSON.') }
}
function authorised(request) {
  const value = String(request.headers['x-research-review-key'] || '')
  const left = Buffer.from(value); const right = Buffer.from(reviewKey)
  return left.length === right.length && timingSafeEqual(left, right)
}
function validParticipantCode(value) { return typeof value === 'string' && /^[a-zA-Z0-9_-]{3,60}$/.test(value) ? value : null }
function safeAudioKey(value) { return /^attempts\/[0-9a-f-]{36}\/recording-[0-9a-f-]{36}\.(webm|ogg|wav|m4a)$/i.test(value) ? value : null }
function detectAudio(header) {
  if (header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return { mimeType: 'audio/webm', ext: 'webm' }
  if (header.subarray(0, 4).equals(Buffer.from('OggS'))) return { mimeType: 'audio/ogg', ext: 'ogg' }
  if (header.subarray(0, 4).equals(Buffer.from('RIFF')) && header.subarray(8, 12).equals(Buffer.from('WAVE'))) return { mimeType: 'audio/wav', ext: 'wav' }
  if (header.subarray(4, 8).equals(Buffer.from('ftyp'))) return { mimeType: 'audio/mp4', ext: 'm4a' }
  return null
}
function rowAttempt(row) {
  return { id: row.id, participantCode: row.participant_code, collectionMode: row.collection_mode, scenarioKey: row.scenario_key, textJa: row.text_ja, targetPhone: row.target_phone, targetError: row.target_error, instructedVariant: row.instructed_variant, durationMs: row.duration_ms, status: row.status, createdAt: row.created_at, submittedAt: row.submitted_at }
}
function validAttempt(body) {
  const participantCode = validParticipantCode(body?.participantCode)
  const textJa = typeof body?.textJa === 'string' ? body.textJa.trim() : ''
  const mode = body?.collectionMode
  if (!participantCode || !textJa || textJa.length > 1000 || body?.consent !== true || !['scripted', 'free'].includes(mode)) return null
  if (mode === 'free') return { participantCode, collectionMode: mode, textJa, scenarioKey: null, targetPhone: null, targetError: null, instructedVariant: 'natural' }
  const scenario = scenarios.get(body?.scenarioKey)
  const instructedVariant = body?.instructedVariant
  if (!scenario || !['standard', 'intentional_error'].includes(instructedVariant) || textJa !== scenario.textJa) return null
  return { participantCode, collectionMode: mode, textJa, scenarioKey: body.scenarioKey, ...scenario, instructedVariant }
}
async function saveAudio(attemptId, request) {
  const length = Number(request.headers['content-length'] || 0)
  if (!Number.isSafeInteger(length) || length < 1 || length > 20 * 1024 ** 2) throw new Error('Bản ghi phải có dung lượng từ 1 byte đến 20 MB.')
  const directory = join(storageRoot, 'attempts', attemptId); await mkdir(directory, { recursive: true })
  const temporary = join(directory, `.upload-${randomUUID()}.part`); const handle = await open(temporary, 'wx'); let size = 0
  try { for await (const chunk of request) { size += chunk.length; if (size > 20 * 1024 ** 2) throw new Error('Bản ghi vượt quá 20 MB.'); await handle.write(chunk) } } catch (error) { await handle.close(); await rm(temporary, { force: true }); throw error }
  await handle.close()
  const headerHandle = await open(temporary, 'r'); const header = Buffer.alloc(32); const { bytesRead } = await headerHandle.read(header, 0, 32, 0); await headerHandle.close()
  const detected = detectAudio(header.subarray(0, bytesRead)); if (!detected) { await rm(temporary, { force: true }); throw new Error('Chỉ nhận WebM, OGG, WAV hoặc M4A.') }
  const key = `attempts/${attemptId}/recording-${randomUUID()}.${detected.ext}`; await rename(temporary, join(storageRoot, ...key.split('/')))
  return { key, ...detected, size }
}
async function serveStatic(response, pathname) {
  const filename = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '')
  if (!/^[a-zA-Z0-9._/-]+$/.test(filename)) return fail(response, 404, 'Not found.')
  const path = resolve(publicRoot, filename); if (!path.startsWith(publicRoot)) return fail(response, 404, 'Not found.')
  try { const data = await readFile(path); response.writeHead(200, { 'content-type': contentTypes[path.slice(path.lastIndexOf('.'))] || 'application/octet-stream', 'cache-control': filename === 'index.html' ? 'no-store' : 'public, max-age=300', 'x-content-type-options': 'nosniff' }); response.end(data) } catch { fail(response, 404, 'Not found.') }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host}`); const path = url.pathname
  try {
    if (request.method === 'GET' && path === '/health') { await pool.query('select 1'); return json(response, 200, { status: 'ok' }) }
    if (request.method === 'POST' && path === '/api/attempts') {
      const input = validAttempt(await readJson(request)); if (!input) return fail(response, 422, 'Thông tin, mã người tham gia hoặc đồng ý nghiên cứu chưa hợp lệ.')
      const id = randomUUID(); const result = await pool.query(
        `insert into research_collector_attempts (id, participant_code, collection_mode, scenario_key, text_ja, target_phone, target_error, instructed_variant, consented_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,now()) returning *`, [id, input.participantCode, input.collectionMode, input.scenarioKey, input.textJa, input.targetPhone, input.targetError, input.instructedVariant])
      return json(response, 201, { attempt: rowAttempt(result.rows[0]), uploadUrl: `/api/attempts/${id}/audio`, maxUploadBytes: 20 * 1024 ** 2 })
    }
    const uploadMatch = path.match(/^\/api\/attempts\/([0-9a-f-]{36})\/audio$/i)
    if (request.method === 'PUT' && uploadMatch) {
      const durationMs = Math.round(Number(url.searchParams.get('durationMs'))); if (!Number.isInteger(durationMs) || durationMs < 250 || durationMs > 120_000) return fail(response, 422, 'Thời lượng bản ghi không hợp lệ.')
      const found = await pool.query("select id from research_collector_attempts where id = $1 and status = 'draft'", [uploadMatch[1]]); if (!found.rows[0]) return fail(response, 409, 'Lượt ghi âm không còn hợp lệ.')
      const audio = await saveAudio(uploadMatch[1], request)
      const result = await pool.query("update research_collector_attempts set audio_storage_key=$1,audio_mime_type=$2,audio_byte_size=$3,duration_ms=$4,status='submitted',submitted_at=now(),updated_at=now() where id=$5 and status='draft' returning *", [audio.key, audio.mimeType, audio.size, durationMs, uploadMatch[1]])
      if (!result.rows[0]) return fail(response, 409, 'Lượt ghi âm không còn hợp lệ.'); return json(response, 202, { attempt: rowAttempt(result.rows[0]) })
    }
    if (request.method === 'GET' && path === '/api/review-queue') {
      if (!authorised(request)) return fail(response, 401, 'Mã người chấm không hợp lệ.')
      const rows = await pool.query("select * from research_collector_attempts where status='submitted' order by submitted_at asc limit 50"); return json(response, 200, { items: rows.rows.map(rowAttempt) })
    }
    const audioMatch = path.match(/^\/api\/attempts\/([0-9a-f-]{36})\/audio\/content$/i)
    if (request.method === 'GET' && audioMatch) {
      if (!authorised(request)) return fail(response, 401, 'Mã người chấm không hợp lệ.')
      const result = await pool.query('select audio_storage_key,audio_mime_type,audio_byte_size from research_collector_attempts where id=$1', [audioMatch[1]]); const item = result.rows[0]; const key = safeAudioKey(item?.audio_storage_key)
      if (!key) return fail(response, 404, 'Không tìm thấy bản ghi.'); const file = join(storageRoot, ...key.split('/')); await stat(file)
      response.writeHead(200, { 'content-type': item.audio_mime_type, 'content-length': item.audio_byte_size, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' }); return createReadStream(file).pipe(response)
    }
    const labelMatch = path.match(/^\/api\/attempts\/([0-9a-f-]{36})\/labels$/i)
    if (request.method === 'POST' && labelMatch) {
      if (!authorised(request)) return fail(response, 401, 'Mã người chấm không hợp lệ.'); const body = await readJson(request)
      if (!['sentence','mora','phoneme'].includes(body?.unitType) || !['correct','near_correct','incorrect','unscorable'].includes(body?.label) || !Number.isInteger(body?.confidence) || body.confidence < 1 || body.confidence > 5) return fail(response, 422, 'Nhãn chưa hợp lệ.')
      const errorType = typeof body.errorType === 'string' && ['substitution','deletion','insertion','too_short','too_long','unclear','other'].includes(body.errorType) ? body.errorType : null
      const unitReference = typeof body.unitReference === 'string' ? body.unitReference.trim().slice(0,80) || null : null; const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0,1000) || null : null
      const client = await pool.connect(); try { await client.query('begin'); await client.query('insert into research_collector_labels (id,attempt_id,rater_code,unit_type,unit_reference,label,error_type,confidence,notes) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [randomUUID(), labelMatch[1], 'reviewer', body.unitType, unitReference, body.label, errorType, body.confidence, notes]); const status = body.label === 'unscorable' ? 'unscorable' : 'reviewed'; const updated = await client.query("update research_collector_attempts set status=$1,updated_at=now() where id=$2 and status='submitted' returning id", [status,labelMatch[1]]); if (!updated.rows[0]) throw new Error('Lượt này đã được chấm.'); await client.query('commit') } catch (error) { await client.query('rollback'); throw error } finally { client.release() }
      return json(response, 201, { ok: true })
    }
    if (path.startsWith('/api/')) return fail(response, 404, 'Không tìm thấy API.')
    return serveStatic(response, path)
  } catch (error) { console.error(error); return fail(response, 500, error instanceof Error ? error.message : 'Lỗi máy chủ.') }
})
server.listen(port, '0.0.0.0', () => {
  console.log(`Research collector listening on port ${port}`)
  if (!process.env.RESEARCH_REVIEW_KEY) console.log(`Development review key (changes on restart): ${generatedReviewKey}`)
})
