import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import test from 'node:test'

const port = 8893
const baseUrl = `http://127.0.0.1:${port}`
const email = 'session.integration@kotodama.test'
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
  throw new Error('Session test server did not start.')
}

test('rotating a refresh token detects replay and password changes revoke old access tokens', async () => {
  const server = spawn(process.execPath, ['server/index.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: '', API_PORT: String(port) },
    stdio: 'ignore',
  })
  try {
    await waitForServer()
    const register = await request('/api/v1/auth/register', {
      method: 'POST',
      body: { name: 'Session Integration', email, password },
    })
    assert.equal(register.status, 201)
    const firstPayload = await register.json()
    const firstCookies = cookiesFrom(register)
    const firstCsrf = csrfFrom(firstCookies)
    assert.ok(firstCsrf)

    const refresh = await request('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { cookie: firstCookies, 'x-csrf-token': firstCsrf },
    })
    assert.equal(refresh.status, 200)
    const refreshedPayload = await refresh.json()
    assert.ok(refreshedPayload.data.accessToken)
    const refreshedCookies = cookiesFrom(refresh)
    const refreshedCsrf = csrfFrom(refreshedCookies)
    assert.ok(refreshedCsrf)

    const replay = await request('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { cookie: firstCookies, 'x-csrf-token': firstCsrf },
    })
    assert.equal(replay.status, 401)
    assert.equal((await replay.json()).code, 'SESSION_REUSED')

    const familyRevoked = await request('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { cookie: refreshedCookies, 'x-csrf-token': refreshedCsrf },
    })
    assert.equal(familyRevoked.status, 401)

    const login = await request('/api/v1/auth/login', { method: 'POST', body: { email, password } })
    assert.equal(login.status, 200)
    const loginPayload = await login.json()
    const loginCookies = cookiesFrom(login)
    const loginCsrf = csrfFrom(loginCookies)
    const nextPassword = 'a-different-correct-horse-battery-staple'
    const change = await request('/api/v1/auth/password/change', {
      method: 'POST',
      body: { currentPassword: password, password: nextPassword },
      headers: {
        authorization: `Bearer ${loginPayload.data.accessToken}`,
        cookie: loginCookies,
        'x-csrf-token': loginCsrf,
      },
    })
    assert.equal(change.status, 200)
    const changedPayload = await change.json()

    const oldAccess = await request('/api/v1/auth/me', {
      headers: { authorization: `Bearer ${loginPayload.data.accessToken}` },
    })
    assert.equal(oldAccess.status, 401)
    const newAccess = await request('/api/v1/auth/me', {
      headers: { authorization: `Bearer ${changedPayload.data.accessToken}` },
    })
    assert.equal(newAccess.status, 200)
    assert.equal((await newAccess.json()).data.id, firstPayload.data.user.id)
  } finally {
    server.kill('SIGTERM')
  }
})
