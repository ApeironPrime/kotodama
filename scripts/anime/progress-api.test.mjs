import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import {
  AnimeCatalogService,
  AnimeApiError,
  sanitizeEpisodeId,
  sanitizeWordId,
} from '../../server/anime-catalog-service.mjs'
import { SrsStore, SQLITE_SRS_DDL } from '../../server/srs-store.mjs'
import { SrsService } from '../../server/srs-service.mjs'
import { applyAnimeSchemaSQLite } from '../../server/db/anime-persistence.mjs'

const REAL_SQLITE_PATH = path.resolve('tmp/anime/anime.db')
const REAL_DICT_DIR = path.resolve('D:/Project/data/aanime_scraper/dictionary/shards')

/**
 * Creates an in-memory test database seeded with minimal test series & episodes.
 */
function createTestDb() {
  const db = new DatabaseSync(':memory:')
  applyAnimeSchemaSQLite(db)

  const now = new Date().toISOString()

  // Seed Series 1: approved (publicly accessible)
  db.prepare(`
    INSERT INTO anime_series (
      series_id, series_slug, title_vi, rights_status, created_at, updated_at
    ) VALUES ('series-approved-01', 'approved-series', 'Phim Đã Duyệt', 'approved', ?, ?)
  `).run(now, now)

  // Seed Series 2: unknown (restricted without loopback override)
  db.prepare(`
    INSERT INTO anime_series (
      series_id, series_slug, title_vi, rights_status, created_at, updated_at
    ) VALUES ('series-unknown-02', 'unknown-series', 'Phim Chưa Duyệt', 'unknown', ?, ?)
  `).run(now, now)

  // Seed Season for Series 1
  db.prepare(`
    INSERT INTO anime_seasons (
      season_id, series_id, series_slug, season_slug, season_ordinal, season_label, title_vi, created_at, updated_at
    ) VALUES ('season-app-01', 'series-approved-01', 'approved-series', 'season-1', 1, 'Mùa 1', 'Mùa 1', ?, ?)
  `).run(now, now)

  // Seed Season for Series 2
  db.prepare(`
    INSERT INTO anime_seasons (
      season_id, series_id, series_slug, season_slug, season_ordinal, season_label, title_vi, created_at, updated_at
    ) VALUES ('season-unk-02', 'series-unknown-02', 'unknown-series', 'season-1', 1, 'Mùa 1', 'Mùa 1', ?, ?)
  `).run(now, now)

  // Seed Episode 1 in Series 1 (approved)
  db.prepare(`
    INSERT INTO anime_episodes (
      episode_id, series_id, season_id, series_slug, season_slug, episode_number, title, has_subtitles, created_at, updated_at
    ) VALUES ('anime:episode:approved:s1:1', 'series-approved-01', 'season-app-01', 'approved-series', 'season-1', 1, 'Tập 1', 1, ?, ?)
  `).run(now, now)

  // Seed Episode 2 in Series 1 (approved)
  db.prepare(`
    INSERT INTO anime_episodes (
      episode_id, series_id, season_id, series_slug, season_slug, episode_number, title, has_subtitles, created_at, updated_at
    ) VALUES ('anime:episode:approved:s1:2', 'series-approved-01', 'season-app-01', 'approved-series', 'season-1', 2, 'Tập 2', 1, ?, ?)
  `).run(now, now)

  // Seed Episode 1 in Series 2 (unknown / restricted)
  db.prepare(`
    INSERT INTO anime_episodes (
      episode_id, series_id, season_id, series_slug, season_slug, episode_number, title, has_subtitles, created_at, updated_at
    ) VALUES ('anime:episode:unknown:s1:1', 'series-unknown-02', 'season-unk-02', 'unknown-series', 'season-1', 1, 'Tập Chưa Duyệt', 0, ?, ?)
  `).run(now, now)

  return db
}

test('1. Dictionary Validation & Shard Boundary Tests', async (t) => {
  await t.test('sanitizeWordId rejects negative numbers, strings, and path traversal attempts', () => {
    assert.throws(() => sanitizeWordId('-10'), (err) => err instanceof AnimeApiError && err.code === 'INVALID_WORD_ID')
    assert.throws(() => sanitizeWordId('abc'), (err) => err instanceof AnimeApiError && err.code === 'INVALID_WORD_ID')
    assert.throws(() => sanitizeWordId('../shard-001.json'), (err) => err instanceof AnimeApiError && err.code === 'INVALID_WORD_ID')
    assert.throws(() => sanitizeWordId(''), (err) => err instanceof AnimeApiError && err.code === 'INVALID_WORD_ID')
  })

  await t.test('sanitizeWordId accepts positive integer string or number', () => {
    assert.equal(sanitizeWordId(12345), '12345')
    assert.equal(sanitizeWordId('9876543210'), '9876543210')
  })
})

test('2. Watch Progress API & Policy Enforcement (T07)', async (t) => {
  const db = createTestDb()
  const service = new AnimeCatalogService({
    allowUnapprovedContent: false,
    dictionaryDir: REAL_DICT_DIR,
  })
  // Inject in-memory sqlite db for test
  service.db = db
  service.storage = 'sqlite'

  const epApproved1 = 'anime:episode:approved:s1:1'
  const epApproved2 = 'anime:episode:approved:s1:2'
  const epRestricted = 'anime:episode:unknown:s1:1'

  await t.test('Progress endpoints reject unauthenticated guest (401)', async () => {
    await assert.rejects(
      () => service.getProgress(epApproved1, null),
      (err) => err instanceof AnimeApiError && err.status === 401
    )
    await assert.rejects(
      () => service.saveProgress({ episodeId: epApproved1, position: 10, duration: 100 }, ''),
      (err) => err instanceof AnimeApiError && err.status === 401
    )
    await assert.rejects(
      () => service.getContinueWatching(undefined),
      (err) => err instanceof AnimeApiError && err.status === 401
    )
  })

  await t.test('saveProgress rejects invalid position and duration inputs (400)', async () => {
    // Negative position
    await assert.rejects(
      () => service.saveProgress({ episodeId: epApproved1, position: -5, duration: 100 }, 'user-01'),
      (err) => err instanceof AnimeApiError && err.code === 'INVALID_POSITION'
    )
    // Non-finite position (NaN, Infinity)
    await assert.rejects(
      () => service.saveProgress({ episodeId: epApproved1, position: Number.NaN, duration: 100 }, 'user-01'),
      (err) => err instanceof AnimeApiError && err.code === 'INVALID_POSITION'
    )
    // String position
    await assert.rejects(
      () => service.saveProgress({ episodeId: epApproved1, position: '50', duration: 100 }, 'user-01'),
      (err) => err instanceof AnimeApiError && err.code === 'INVALID_POSITION'
    )
    // Negative duration
    await assert.rejects(
      () => service.saveProgress({ episodeId: epApproved1, position: 10, duration: -100 }, 'user-01'),
      (err) => err instanceof AnimeApiError && err.code === 'INVALID_DURATION'
    )
    // Invalid episode ID
    await assert.rejects(
      () => service.saveProgress({ episodeId: 'invalid-ep', position: 10, duration: 100 }, 'user-01'),
      (err) => err instanceof AnimeApiError && err.code === 'INVALID_EPISODE_ID'
    )
  })

  await t.test('Rights policy fail-closed (403) on restricted episode for public caller', async () => {
    // getProgress on restricted episode throws 403
    await assert.rejects(
      () => service.getProgress(epRestricted, 'user-01', { isLocalLoopback: false }),
      (err) => err instanceof AnimeApiError && err.code === 'ANIME_CONTENT_RESTRICTED' && err.status === 403
    )

    // saveProgress on restricted episode throws 403
    await assert.rejects(
      () => service.saveProgress({ episodeId: epRestricted, position: 20, duration: 1200 }, 'user-01', { isLocalLoopback: false }),
      (err) => err instanceof AnimeApiError && err.code === 'ANIME_CONTENT_RESTRICTED' && err.status === 403
    )
  })

  await t.test('getProgress returns null when user has no watch progress yet', async () => {
    const res = await service.getProgress(epApproved1, 'user-new', { isLocalLoopback: false })
    assert.equal(res, null)
  })

  await t.test('saveProgress performs atomic upsert and clamps position to duration', async () => {
    // Save position 125 on duration 100 -> clamped to 100
    const saved = await service.saveProgress(
      { episodeId: epApproved1, position: 125, duration: 100 },
      'user-clamp',
      { isLocalLoopback: false }
    )

    assert.equal(saved.last_playback_position, 100)
    assert.equal(saved.max_playback_position, 100)
    assert.equal(saved.duration, 100)
    assert.equal(saved.is_completed, true)
    assert.equal(saved.playback_count, 1)

    const retrieved = await service.getProgress(epApproved1, 'user-clamp', { isLocalLoopback: false })
    assert.equal(retrieved.last_playback_position, 100)
    assert.equal(retrieved.is_completed, true)
  })

  await t.test('Completion calculation: 89.9% is false, 90.0% is true; duration 0 is false', async () => {
    // 89.9% of 1000s = 899s -> is_completed: false
    const progress89 = await service.saveProgress(
      { episodeId: epApproved1, position: 899, duration: 1000 },
      'user-comp-89',
      { isLocalLoopback: false }
    )
    assert.equal(progress89.is_completed, false, '89.9% must not be marked completed')

    // 90.0% of 1000s = 900s -> is_completed: true
    const progress90 = await service.saveProgress(
      { episodeId: epApproved1, position: 900, duration: 1000 },
      'user-comp-90',
      { isLocalLoopback: false }
    )
    assert.equal(progress90.is_completed, true, '90.0% must be marked completed')

    // duration 0 -> is_completed: false
    const progressZero = await service.saveProgress(
      { episodeId: epApproved1, position: 0, duration: 0 },
      'user-comp-zero',
      { isLocalLoopback: false }
    )
    assert.equal(progressZero.is_completed, false, 'duration 0 must not be marked completed')
  })

  await t.test('max_playback_position is monotonic (does not decrease on seek backward)', async () => {
    const user = 'user-monotonic'

    // Play to 60s
    await service.saveProgress({ episodeId: epApproved1, position: 60, duration: 300 }, user)
    let p = await service.getProgress(epApproved1, user)
    assert.equal(p.last_playback_position, 60)
    assert.equal(p.max_playback_position, 60)

    // Seek back to 15s (heartbeat)
    await service.saveProgress({ episodeId: epApproved1, position: 15, duration: 300 }, user)
    p = await service.getProgress(epApproved1, user)
    assert.equal(p.last_playback_position, 15, 'last position should update to 15s')
    assert.equal(p.max_playback_position, 60, 'max position should remain 60s')

    // Advance to 120s
    await service.saveProgress({ episodeId: epApproved1, position: 120, duration: 300 }, user)
    p = await service.getProgress(epApproved1, user)
    assert.equal(p.last_playback_position, 120)
    assert.equal(p.max_playback_position, 120)
  })

  await t.test('playback_count is determined by server session rules and redundant client isSessionStart is ignored', async () => {
    const user = 'user-playback-count'
    const baseTime = Date.now()

    // Session 1 start -> count = 1
    const p1 = await service.saveProgress(
      { episodeId: epApproved1, position: 0, duration: 300 },
      user,
      { now: new Date(baseTime) }
    )
    assert.equal(p1.playback_count, 1)

    // Heartbeat with redundant client isSessionStart: true -> ignored, count remains 1
    const p2 = await service.saveProgress(
      { episodeId: epApproved1, position: 10, duration: 300, isSessionStart: true },
      user,
      { now: new Date(baseTime + 5000) }
    )
    assert.equal(p2.playback_count, 1, 'Client isSessionStart must be ignored and not increment playback_count')

    // Normal heartbeat after 10 seconds -> count remains 1
    const p3 = await service.saveProgress(
      { episodeId: epApproved1, position: 20, duration: 300 },
      user,
      { now: new Date(baseTime + 10000) }
    )
    assert.equal(p3.playback_count, 1)

    // Session timeout (>= 30 minutes idle) -> increments to 2
    const thirtyOneMinLater = baseTime + 31 * 60 * 1000
    const p4 = await service.saveProgress(
      { episodeId: epApproved1, position: 25, duration: 300 },
      user,
      { now: new Date(thirtyOneMinLater) }
    )
    assert.equal(p4.playback_count, 2, 'Idle timeout >= 30m should trigger a new session')

    // Complete the episode (90% of 300s = 270s)
    const p5 = await service.saveProgress(
      { episodeId: epApproved1, position: 280, duration: 300 },
      user,
      { now: new Date(thirtyOneMinLater + 60000) }
    )
    assert.equal(p5.is_completed, true)
    assert.equal(p5.playback_count, 2)

    // Replay from beginning (position <= 30) after completion within same window -> increments to 3
    const p6 = await service.saveProgress(
      { episodeId: epApproved1, position: 5, duration: 300 },
      user,
      { now: new Date(thirtyOneMinLater + 70000) }
    )
    assert.equal(p6.playback_count, 3, 'Replay from start after completion should increment playback_count')

    // Subsequent heartbeat during replay -> remains 3
    const p7 = await service.saveProgress(
      { episodeId: epApproved1, position: 15, duration: 300 },
      user,
      { now: new Date(thirtyOneMinLater + 80000) }
    )
    assert.equal(p7.playback_count, 3, 'Subsequent heartbeat during replay should not increment playback_count')
  })

  await t.test('User isolation: progress of User A does not leak or affect User B', async () => {
    const userA = 'user-isolation-A'
    const userB = 'user-isolation-B'

    await service.saveProgress({ episodeId: epApproved1, position: 75, duration: 600 }, userA)
    await service.saveProgress({ episodeId: epApproved1, position: 25, duration: 600 }, userB)

    const progA = await service.getProgress(epApproved1, userA)
    const progB = await service.getProgress(epApproved1, userB)

    assert.equal(progA.last_playback_position, 75)
    assert.equal(progB.last_playback_position, 25)
  })

  await t.test('getContinueWatching returns max 10 newest items, excludes restricted episodes, and has no media URLs', async () => {
    const user = 'user-continue-test'

    // Watch Episode 1 (approved)
    await service.saveProgress({ episodeId: epApproved1, position: 35, duration: 300 }, user)
    await new Promise((r) => setTimeout(r, 15))

    // Watch Episode 2 (approved)
    await service.saveProgress({ episodeId: epApproved2, position: 90, duration: 300 }, user)
    await new Promise((r) => setTimeout(r, 15))

    // Watch restricted episode in override mode
    service.allowUnapprovedContent = true
    await service.saveProgress({ episodeId: epRestricted, position: 50, duration: 500 }, user, { isLocalLoopback: true })
    service.allowUnapprovedContent = false

    // Public caller: should see Episode 2 and Episode 1, but NOT restricted episode
    const continuePublic = await service.getContinueWatching(user, { isLocalLoopback: false })
    assert.equal(continuePublic.count, 2)
    assert.equal(continuePublic.items.length, 2)
    assert.equal(continuePublic.items[0].episode_id, epApproved2, 'Newest episode watched must be first')
    assert.equal(continuePublic.items[1].episode_id, epApproved1)

    // Verify metadata purity: NO stream_url, NO page_url, NO subtitle tokens or cues
    for (const item of continuePublic.items) {
      assert.equal(item.stream_url, undefined)
      assert.equal(item.page_url, undefined)
      assert.equal(item.cues, undefined)
      assert.equal(item.tokens, undefined)
      assert.ok(item.series_slug)
      assert.ok(item.episode_number)
      assert.ok(item.duration)
    }

    // Other user has empty continue watching (no history leak)
    const continueOther = await service.getContinueWatching('user-clean-new', { isLocalLoopback: false })
    assert.equal(continueOther.count, 0)
    assert.equal(continueOther.items.length, 0)
  })
})

test('3. SRS Anime Source-Context Idempotency & Provenance Tests', async (t) => {
  const db = new DatabaseSync(':memory:')
  db.exec(SQLITE_SRS_DDL)
  const srsStore = new SrsStore({ db })
  const srsService = new SrsService(srsStore)

  // Seed user
  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role)
    VALUES ('learner-srs-01', 'Test Learner', 'learner@kotodama.test', 'hash', 'learner')
  `).run()

  const userId = 'learner-srs-01'

  await t.test('Adding anime word card creates SRS card with versioned deterministic sourceContext', async () => {
    const wordContext = 'anime:v1:episode:ep-test-01:cue:10:token:4101129477'
    const cardData = {
      type: 'vocab',
      term: '約束',
      reading: 'やくそく',
      hanViet: 'ƯỚC THÚC',
      meaning: 'lời hứa, giao ước',
      jlptLevel: 'N4',
      sourceRecordId: '4101129477',
      sourceContext: wordContext,
    }

    const created = await srsService.addCard(userId, cardData)
    assert.ok(created.id)
    assert.equal(created.term, '約束')
    assert.equal(created.sourceContext, wordContext)
    assert.equal(created.sourceRecordId, '4101129477')
  })

  await t.test('Adding same card with identical sourceContext is idempotent and does not create duplicate row', async () => {
    const wordContext = 'anime:v1:episode:ep-test-01:cue:10:token:4101129477'
    const cardData = {
      type: 'vocab',
      term: '約束',
      reading: 'やくそく',
      hanViet: 'ƯỚC THÚC',
      meaning: 'lời hứa đã cập nhật nghĩa',
      jlptLevel: 'N4',
      sourceRecordId: '4101129477',
      sourceContext: wordContext,
    }

    const updated = await srsService.addCard(userId, cardData)
    assert.equal(updated.term, '約束')
    assert.equal(updated.meaning, 'lời hứa đã cập nhật nghĩa')

    // Verify row count in srs_cards: must be exactly 1 card (+ starter card if any)
    const rows = db.prepare('SELECT count(*) as count FROM srs_cards WHERE user_id = ? AND source_context = ?').get(userId, wordContext)
    assert.equal(rows.count, 1, 'Duplicate sourceContext must not create extra rows')
  })

  await t.test('Sentence card creates SRS card with sentence sourceContext format', async () => {
    const sentenceContext = 'anime:v1:episode:ep-test-01:cue:10:sentence'
    const sentenceCard = {
      type: 'vocab',
      term: '約束を守ってください。',
      meaning: 'Xin hãy giữ lời hứa.',
      sourceRecordId: '10',
      sourceContext: sentenceContext,
    }

    const createdSentence = await srsService.addCard(userId, sentenceCard)
    assert.ok(createdSentence.id)
    assert.equal(createdSentence.term, '約束を守ってください。')
    assert.equal(createdSentence.meaning, 'Xin hãy giữ lời hứa.')
    assert.equal(createdSentence.sourceContext, sentenceContext)

    // Both word card and sentence card exist side-by-side without conflict
    const savedTerms = await srsService.getSavedTerms(userId)
    const contexts = savedTerms.map((t) => t.sourceContext)
    assert.ok(contexts.includes('anime:v1:episode:ep-test-01:cue:10:token:4101129477'))
    assert.ok(contexts.includes('anime:v1:episode:ep-test-01:cue:10:sentence'))
  })
})

test('4. HTTP Server Router Integration for Watch Progress Endpoints (server/index.mjs)', async (t) => {
  const http = await import('node:http')
  const { route } = await import('../../server/index.mjs')

  const realHttpServer = http.createServer((req, res) => {
    route(req, res).catch((err) => {
      res.writeHead(500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ message: err.message, code: 'SERVER_ERROR' }))
    })
  })

  await new Promise((resolve) => realHttpServer.listen(0, '127.0.0.1', resolve))
  const routerBaseUrl = `http://127.0.0.1:${realHttpServer.address().port}`

  t.after(() => {
    realHttpServer.close()
  })

  await t.test('GET /api/v1/anime/progress without token returns 401 UNAUTHENTICATED', async () => {
    const res = await fetch(`${routerBaseUrl}/api/v1/anime/progress?episodeId=anime:episode:approved:s1:1`)
    assert.equal(res.status, 401)
    const body = await res.json()
    assert.equal(body.code, 'UNAUTHENTICATED')
  })

  await t.test('POST /api/v1/anime/progress without token returns 401 UNAUTHENTICATED', async () => {
    const res = await fetch(`${routerBaseUrl}/api/v1/anime/progress`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ episodeId: 'anime:episode:approved:s1:1', position: 10, duration: 100 }),
    })
    assert.equal(res.status, 401)
    const body = await res.json()
    assert.equal(body.code, 'UNAUTHENTICATED')
  })

  await t.test('GET /api/v1/anime/progress/continue without token returns 401 UNAUTHENTICATED', async () => {
    const res = await fetch(`${routerBaseUrl}/api/v1/anime/progress/continue`)
    assert.equal(res.status, 401)
    const body = await res.json()
    assert.equal(body.code, 'UNAUTHENTICATED')
  })
})
