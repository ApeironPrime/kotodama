import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import test from 'node:test'

const port = 8895
const baseUrl = `http://127.0.0.1:${port}`
const email = 'shadowing.test@kotodama.test'
const password = 'correct-horse-battery-staple'

function cookiesFrom(response) {
  const setCookies =
    response.headers.getSetCookie?.() ?? String(response.headers.get('set-cookie') ?? '').split(/,(?=\s*kotodama_)/)
  return setCookies
    .map((cookie) => cookie.trim().split(';')[0])
    .filter(Boolean)
    .join('; ')
}

function csrfFrom(cookies) {
  return cookies.match(/(?:^|;\s*)kotodama_csrf=([^;]+)/)?.[1]
}

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  })
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      if ((await fetch(`${baseUrl}/health`)).ok) return
    } catch {
      /* server is still starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('Shadowing test server did not start.')
}

test('shadowing API creates session, evaluates attempt and advances progress', async () => {
  const server = spawn(process.execPath, ['server/index.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: '', API_PORT: String(port) },
    stdio: 'ignore',
  })
  try {
    await waitForServer()

    // 1. Register user
    const register = await request('/api/v1/auth/register', {
      method: 'POST',
      body: { name: 'Shadowing Learner', email, password },
    })
    assert.equal(register.status, 201)
    const registerPayload = await register.json()
    const accessToken = registerPayload.data.accessToken
    const cookies = cookiesFrom(register)
    const csrf = csrfFrom(cookies)
    assert.ok(accessToken)
    assert.ok(csrf)

    const authHeaders = {
      Authorization: `Bearer ${accessToken}`,
      'x-csrf-token': csrf,
      Cookie: cookies,
    }

    // 2. Create media asset
    const createAsset = await request('/api/v1/video/assets', {
      method: 'POST',
      headers: authHeaders,
      body: { sourceType: 'user_upload', title: 'Test Anime Episode', language: 'ja', rightsBasis: 'internal' },
    })
    assert.equal(createAsset.status, 201)
    const assetPayload = await createAsset.json()
    const asset = assetPayload.data

    // 3. Create Shadowing Session
    const createSession = await request('/api/v1/shadowing/sessions', {
      method: 'POST',
      headers: authHeaders,
      body: { mediaAssetId: asset.id, mode: 'sequential' },
    })
    assert.equal(createSession.status, 201)
    const sessionPayload = await createSession.json()
    const session = sessionPayload.data.session
    assert.equal(session.mediaAssetId, asset.id)
    assert.equal(session.currentSegmentSequence, 1)

    // 4. Submit a Shadowing Attempt
    const submitAttempt = await request(`/api/v1/shadowing/sessions/${session.id}/attempts`, {
      method: 'POST',
      headers: authHeaders,
      body: {
        transcriptSegmentId: '00000000-0000-0000-0000-000000000001',
        referenceText: 'こんにちは、元気ですか。',
        referenceDurationMs: 2500,
        durationMs: 2400,
        attemptNo: 1,
        audioBase64: 'dGVzdGF1ZGlvYnl0ZXM=', // dummy base64
      },
    })
    assert.equal(submitAttempt.status, 201)
    const attemptPayload = await submitAttempt.json()
    const { attempt, evaluation } = attemptPayload.data
    assert.equal(attempt.sessionId, session.id)
    assert.ok(evaluation.feedback.summary)
    assert.ok(typeof evaluation.overallScore === 'number')

    // 5. Advance session to next sequence
    const advance = await request(`/api/v1/shadowing/sessions/${session.id}/next`, {
      method: 'POST',
      headers: authHeaders,
      body: { nextSequenceNo: 2, isCompleted: false },
    })
    assert.equal(advance.status, 200)
    const advancePayload = await advance.json()
    const updatedSession = advancePayload.data.session
    assert.equal(updatedSession.currentSegmentSequence, 2)

    // 6. Fetch session with attempts history
    const getSession = await request(`/api/v1/shadowing/sessions/${session.id}`, {
      method: 'GET',
      headers: authHeaders,
    })
    assert.equal(getSession.status, 200)
    const sessionDetailsPayload = await getSession.json()
    const sessionDetails = sessionDetailsPayload.data
    assert.equal(sessionDetails.session.id, session.id)
    assert.equal(sessionDetails.attempts.length, 1)
  } finally {
    server.kill()
  }
})
