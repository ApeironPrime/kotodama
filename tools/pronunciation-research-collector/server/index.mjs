import http from 'node:http'
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const root = dirname(fileURLToPath(import.meta.url))
const publicRoot = resolve(root, '..', 'public')
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

const guidedScenarios = [
  ['warmup_01', '今日は日本語の発音を練習します。ゆっくり、はっきり、最後まで話します。', null, 'baseline', 'standard'],
  ['warmup_02', '朝、私は駅の近くの店で、温かいコーヒーを買いました。', null, 'baseline', 'standard'],
  ['tsu_01', '私はつくえを使って、次の週末の予定を書きます。', 'ts', 'tsu_to_chu', 'standard'],
  ['tsu_02_intentional', '私はつくえを使って、次の週末の予定を書きます。', 'ts', 'tsu_to_chu', 'intentional_error'],
  ['tsu_03', '次の月曜日に、父と一緒に小さな図書館へ行きました。', 'ts', 'tsu_to_chu', 'standard'],
  ['tsu_04', 'いつも使っているかばんに、二つの本を入れました。', 'ts', 'tsu_to_chu', 'standard'],
  ['sokuon_01', '昨日、私は切手を買って、友達に手紙を書きました。', 'cl', 'sokuon', 'standard'],
  ['sokuon_02_intentional', '昨日、私は切手を買って、友達に手紙を書きました。', 'cl', 'sokuon', 'intentional_error'],
  ['sokuon_03', '学校の近くにある小さな店で、ゆっくり待っていました。', 'cl', 'sokuon', 'standard'],
  ['sokuon_04', '朝、家を出る前に、ちょっとだけ音楽を聞きました。', 'cl', 'sokuon', 'standard'],
  ['long_01', '午後、私はケーキとコーヒーをゆっくり食べました。', 'e', 'long_vowel', 'standard'],
  ['long_02_intentional', '午後、私はケーキとコーヒーをゆっくり食べました。', 'e', 'long_vowel', 'intentional_error'],
  ['long_03', '先生と一緒に、駅の近くのケーキ屋さんへ行きました。', 'e', 'long_vowel', 'standard'],
  ['long_04', '旅行のあとで、弟とゲームをして遊びました。', 'e', 'long_vowel', 'standard'],
  ['mora_n_01', '新聞を読んでから、銀行へ行きました。', 'N', 'mora_n', 'standard'],
  ['mora_n_02_intentional', '新聞を読んでから、銀行へ行きました。', 'N', 'mora_n', 'intentional_error'],
  ['mora_n_03', '今晩、家族と一緒にご飯を食べます。', 'N', 'mora_n', 'standard'],
  ['mora_n_04', '天気がいいので、友人と公園を散歩しました。', 'N', 'mora_n', 'standard'],
  ['mixed_01', '今朝、駅で切手を買い、電車の中で新聞を読みました。', null, 'mixed', 'standard'],
  ['closing_01', '私は日本語を勉強しています。これからも毎日少しずつ練習したいです。', null, 'mixed', 'standard'],
]
const scenarios = new Map(guidedScenarios.map(([key, textJa, targetPhone, targetError, instructedVariant]) => [key, { textJa, targetPhone, targetError, instructedVariant }]))
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
function detectAudio(header) {
  if (header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return { mimeType: 'audio/webm', ext: 'webm' }
  if (header.subarray(0, 4).equals(Buffer.from('OggS'))) return { mimeType: 'audio/ogg', ext: 'ogg' }
  if (header.subarray(0, 4).equals(Buffer.from('RIFF')) && header.subarray(8, 12).equals(Buffer.from('WAVE'))) return { mimeType: 'audio/wav', ext: 'wav' }
  if (header.subarray(4, 8).equals(Buffer.from('ftyp'))) return { mimeType: 'audio/mp4', ext: 'm4a' }
  return null
}
function rowAttempt(row) {
  return { id: row.id, participantCode: row.participant_code, collectionMode: row.collection_mode, scenarioKey: row.scenario_key, sessionId: row.session_id, sessionStep: row.session_step, textJa: row.text_ja, targetPhone: row.target_phone, targetError: row.target_error, instructedVariant: row.instructed_variant, durationMs: row.duration_ms, status: row.status, createdAt: row.created_at, submittedAt: row.submitted_at }
}
function validAttempt(body) {
  const participantCode = validParticipantCode(body?.participantCode)
  const textJa = typeof body?.textJa === 'string' ? body.textJa.trim() : ''
  const mode = body?.collectionMode
  if (!participantCode || !textJa || textJa.length > 1000 || body?.consent !== true || !['scripted', 'guided', 'free'].includes(mode)) return null
  if (mode === 'free') return { participantCode, collectionMode: mode, textJa, scenarioKey: null, targetPhone: null, targetError: null, instructedVariant: 'natural' }
  const scenario = scenarios.get(body?.scenarioKey)
  const instructedVariant = body?.instructedVariant
  if (!scenario || !['standard', 'intentional_error'].includes(instructedVariant) || textJa !== scenario.textJa) return null
  if (mode !== 'guided') return { participantCode, collectionMode: mode, textJa, scenarioKey: body.scenarioKey, ...scenario, instructedVariant }
  const sessionId = typeof body?.sessionId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.sessionId) ? body.sessionId : null
  const sessionStep = Number(body?.sessionStep)
  if (!sessionId || !Number.isInteger(sessionStep) || sessionStep < 1 || sessionStep > guidedScenarios.length || guidedScenarios[sessionStep - 1][0] !== body.scenarioKey || scenario.instructedVariant !== instructedVariant) return null
  return { participantCode, collectionMode: mode, textJa, scenarioKey: body.scenarioKey, ...scenario, instructedVariant, sessionId, sessionStep }
}
async function readAudio(request) {
  const length = Number(request.headers['content-length'] || 0)
  if (!Number.isSafeInteger(length) || length < 1 || length > 20 * 1024 ** 2) throw new Error('Bản ghi phải có dung lượng từ 1 byte đến 20 MB.')
  const chunks = []; let size = 0
  for await (const chunk of request) { size += chunk.length; if (size > 20 * 1024 ** 2) throw new Error('Bản ghi vượt quá 20 MB.'); chunks.push(chunk) }
  const content = Buffer.concat(chunks)
  const detected = detectAudio(content.subarray(0, 32)); if (!detected) throw new Error('Chỉ nhận WebM, OGG, WAV hoặc M4A.')
  return { ...detected, content, size }
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
        `insert into research_collector_attempts (id, participant_code, collection_mode, scenario_key, session_id, session_step, text_ja, target_phone, target_error, instructed_variant, consented_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now()) returning *`, [id, input.participantCode, input.collectionMode, input.scenarioKey, input.sessionId || null, input.sessionStep || null, input.textJa, input.targetPhone, input.targetError, input.instructedVariant])
      return json(response, 201, { attempt: rowAttempt(result.rows[0]), uploadUrl: `/api/attempts/${id}/audio`, maxUploadBytes: 20 * 1024 ** 2 })
    }
    const uploadMatch = path.match(/^\/api\/attempts\/([0-9a-f-]{36})\/audio$/i)
    if (request.method === 'PUT' && uploadMatch) {
      const durationMs = Math.round(Number(url.searchParams.get('durationMs'))); if (!Number.isInteger(durationMs) || durationMs < 250 || durationMs > 120_000) return fail(response, 422, 'Thời lượng bản ghi không hợp lệ.')
      const audio = await readAudio(request); const client = await pool.connect()
      try {
        await client.query('begin')
        const locked = await client.query("select id from research_collector_attempts where id = $1 and status = 'draft' for update", [uploadMatch[1]])
        if (!locked.rows[0]) { await client.query('rollback'); return fail(response, 409, 'Lượt ghi âm không còn hợp lệ.') }
        await client.query('insert into research_collector_audio (attempt_id,mime_type,byte_size,content) values ($1,$2,$3,$4)', [uploadMatch[1], audio.mimeType, audio.size, audio.content])
        const result = await client.query("update research_collector_attempts set audio_mime_type=$1,audio_byte_size=$2,duration_ms=$3,status='submitted',submitted_at=now(),updated_at=now() where id=$4 returning *", [audio.mimeType, audio.size, durationMs, uploadMatch[1]])
        await client.query('commit'); return json(response, 202, { attempt: rowAttempt(result.rows[0]) })
      } catch (error) { await client.query('rollback'); throw error } finally { client.release() }
    }
    if (request.method === 'GET' && path === '/api/review-queue') {
      if (!authorised(request)) return fail(response, 401, 'Mã người chấm không hợp lệ.')
      const rows = await pool.query("select * from research_collector_attempts where status='submitted' order by submitted_at asc limit 50"); return json(response, 200, { items: rows.rows.map(rowAttempt) })
    }
    const audioMatch = path.match(/^\/api\/attempts\/([0-9a-f-]{36})\/audio\/content$/i)
    if (request.method === 'GET' && audioMatch) {
      if (!authorised(request)) return fail(response, 401, 'Mã người chấm không hợp lệ.')
      const result = await pool.query('select mime_type,byte_size,content from research_collector_audio where attempt_id=$1', [audioMatch[1]]); const item = result.rows[0]
      if (!item) return fail(response, 404, 'Không tìm thấy bản ghi.')
      response.writeHead(200, { 'content-type': item.mime_type, 'content-length': item.byte_size, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' }); return response.end(item.content)
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
