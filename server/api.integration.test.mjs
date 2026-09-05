import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const port = 8891
const baseUrl = `http://127.0.0.1:${port}`
const testId = Date.now().toString(36)
const adminEmail = `admin.${testId}@kotodama.test`
const learnerEmail = `learner.${testId}@kotodama.test`
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
  throw new Error('API test server did not start.')
}

test('admin API enforces role, CSRF, audit actions and last-admin protection', async () => {
  const storageRoot = await mkdtemp(join(tmpdir(), 'kotodama-media-api-'))
  const server = spawn(process.execPath, ['server/index.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      // Keep this suite isolated from a developer or CI PostgreSQL database.
      // PostgreSQL persistence is verified by postgres.integration.test.mjs.
      DATABASE_URL: '',
      API_PORT: String(port),
      BOOTSTRAP_ADMIN_EMAIL: adminEmail,
      BOOTSTRAP_ADMIN_PASSWORD: password,
      BOOTSTRAP_ADMIN_NAME: 'Integration Admin',
      MEDIA_STORAGE_PATH: storageRoot,
    },
    stdio: 'ignore',
  })
  try {
    await waitForServer()
    const adminLogin = await request('/api/v1/auth/login', { method: 'POST', body: { email: adminEmail, password } })
    assert.equal(adminLogin.status, 200)
    const adminPayload = await adminLogin.json()
    const cookies = cookiesFrom(adminLogin)
    const csrf = csrfFrom(cookies)
    assert.ok(csrf)
    const adminHeaders = {
      authorization: `Bearer ${adminPayload.data.accessToken}`,
      cookie: cookies,
      'x-csrf-token': csrf,
    }

    const learner = await request('/api/v1/auth/register', {
      method: 'POST',
      body: { name: 'Integration Learner', email: learnerEmail, password },
    })
    const learnerPayload = await learner.json()
    const learnerCookies = cookiesFrom(learner)
    const learnerCsrf = csrfFrom(learnerCookies)
    assert.ok(learnerCsrf)
    const learnerHeaders = {
      authorization: `Bearer ${learnerPayload.data.accessToken}`,
      cookie: learnerCookies,
      'x-csrf-token': learnerCsrf,
    }
    const preferences = await request('/api/v1/account/preferences', {
      method: 'POST',
      body: { dailyWords: 30, background: 'sakura', reminders: true },
      headers: learnerHeaders,
    })
    assert.equal(preferences.status, 200)
    assert.deepEqual(await preferences.json(), {
      data: {
        dailyWords: 30,
        reviewLimit: 100,
        autoPronounce: true,
        furigana: true,
        romaji: false,
        pitchAccent: true,
        reminders: true,
        streakReminders: true,
        publicProfile: false,
        analytics: true,
        accent: 'rose',
        background: 'sakura',
      },
    })
    const learningPlan = await request('/api/v1/account/learning-plan', {
      method: 'POST',
      body: {
        language: 'jp',
        level: 'beginner',
        dailyWords: 30,
        dailyMinutes: 20,
        reason: 'Luyện nghe tiếng Nhật',
      },
      headers: learnerHeaders,
    })
    assert.equal(learningPlan.status, 200)
    assert.equal((await learningPlan.json()).data.language, 'jp')
    const profile = await request('/api/v1/account/profile', { headers: learnerHeaders })
    assert.equal(profile.status, 200)
    assert.equal((await profile.json()).data.learningPlan.dailyWords, 30)

    const rejectedVideoDraft = await request('/api/v1/video/assets', {
      method: 'POST',
      body: { sourceType: 'user_upload', title: 'Không có CSRF', language: 'ja', rightsBasis: 'owned' },
      headers: { authorization: `Bearer ${learnerPayload.data.accessToken}` },
    })
    assert.equal(rejectedVideoDraft.status, 403)
    const videoDraft = await request('/api/v1/video/assets', {
      method: 'POST',
      body: {
        sourceType: 'user_upload',
        title: 'Hội thoại tại nhà hàng',
        language: 'ja',
        rightsBasis: 'owned',
        originalFilename: 'restaurant-dialogue.mp4',
      },
      headers: learnerHeaders,
    })
    assert.equal(videoDraft.status, 201)
    const video = (await videoDraft.json()).data
    assert.equal(video.processingStatus, 'draft')
    assert.equal(video.title, 'Hội thoại tại nhà hàng')
    const videoList = await request('/api/v1/video/assets?limit=20', { headers: learnerHeaders })
    assert.equal(videoList.status, 200)
    assert.equal((await videoList.json()).data.items[0].id, video.id)
    const videoDetail = await request(`/api/v1/video/assets/${video.id}`, { headers: learnerHeaders })
    assert.equal(videoDetail.status, 200)
    assert.equal((await videoDetail.json()).data.originalFilename, 'restaurant-dialogue.mp4')
    const invalidCatalog = await request('/api/v1/video/assets', {
      method: 'POST',
      body: { sourceType: 'catalog', title: 'Missing provenance', language: 'ja', rightsBasis: 'licensed' },
      headers: learnerHeaders,
    })
    assert.equal(invalidCatalog.status, 422)
    const uploadSession = await request(`/api/v1/video/assets/${video.id}/upload-session`, {
      method: 'POST',
      headers: learnerHeaders,
    })
    assert.equal(uploadSession.status, 200)
    assert.equal((await uploadSession.json()).data.method, 'PUT')
    const mp4 = Buffer.concat([Buffer.alloc(4), Buffer.from('ftypisom'), Buffer.alloc(24)])
    const upload = await fetch(`${baseUrl}/api/v1/video/assets/${video.id}/upload`, {
      method: 'PUT',
      headers: { ...learnerHeaders, 'content-type': 'video/mp4' },
      body: mp4,
    })
    assert.equal(upload.status, 202)
    const uploadData = (await upload.json()).data
    assert.equal(uploadData.asset.processingStatus, 'queued')
    assert.equal(uploadData.asset.mimeType, 'video/mp4')
    const playbackSession = await request(`/api/v1/video/assets/${video.id}/playback-session`, {
      method: 'POST',
      headers: learnerHeaders,
    })
    assert.equal(playbackSession.status, 200)
    const playback = (await playbackSession.json()).data
    assert.equal(playback.expiresInSeconds, 300)
    const mediaRange = await fetch(`${baseUrl}${playback.contentUrl}`, { headers: { range: 'bytes=0-7' } })
    assert.equal(mediaRange.status, 206)
    assert.equal(mediaRange.headers.get('content-range'), `bytes 0-7/${mp4.byteLength}`)
    assert.equal((await mediaRange.arrayBuffer()).byteLength, 8)
    const jobs = await request(`/api/v1/video/assets/${video.id}/jobs`, { headers: learnerHeaders })
    assert.equal(jobs.status, 200)
    assert.equal((await jobs.json()).data.items[0].jobType, 'upload_verify')
    const users = await request(`/api/v1/admin/users?query=${encodeURIComponent(testId)}&page=1&pageSize=10`, {
      headers: adminHeaders,
    })
    assert.equal(users.status, 200)
    assert.equal((await users.json()).data.total, 2)

    const suspend = await request(`/api/v1/admin/users/${learnerPayload.data.user.id}/status`, {
      method: 'POST',
      body: { status: 'suspended' },
      headers: adminHeaders,
    })
    assert.equal(suspend.status, 200)
    assert.equal((await suspend.json()).data.status, 'suspended')

    const _demoteLastAdmin = await request(`/api/v1/admin/users/${adminPayload.data.user.id}/role`, {
      method: 'POST',
      body: JSON.stringify({ role: 'learner' }),
      headers: adminHeaders,
    })
    // NhaiKanji API endpoints
    const kanjiListRes = await request('/api/v1/nhaikanji/kanji?level=N5&limit=5')
    assert.equal(kanjiListRes.status, 200)
    const kanjiListData = (await kanjiListRes.json()).data
    assert.ok(kanjiListData.items.length > 0)

    const kanjiDetailRes = await request(`/api/v1/nhaikanji/kanji/${encodeURIComponent('土')}`)
    assert.equal(kanjiDetailRes.status, 200)
    const kanjiDetailData = (await kanjiDetailRes.json()).data
    assert.equal(kanjiDetailData.kanji, '土')

    const bunpoRes = await request('/api/v1/nhaikanji/bunpo?level=N4&limit=5')
    assert.equal(bunpoRes.status, 200)
    const bunpoData = (await bunpoRes.json()).data
    assert.ok(bunpoData.items.length > 0)

    const jlptRes = await request('/api/v1/nhaikanji/jlpt/exams?level=N4')
    assert.equal(jlptRes.status, 200)
    const jlptData = (await jlptRes.json()).data
    assert.ok(Array.isArray(jlptData.exams))
  } finally {
    server.kill('SIGTERM')
    await rm(storageRoot, { recursive: true, force: true })
  }
})
