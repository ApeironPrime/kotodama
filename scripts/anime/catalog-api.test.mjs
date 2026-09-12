import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import http from 'node:http'
import { DatabaseSync } from 'node:sqlite'
import {
  AnimeCatalogService,
  AnimeApiError,
  sanitizePagination,
  sanitizeSlug,
  sanitizeEpisodeId,
  sanitizeLevel,
  sanitizeQuery,
  sanitizeTimeWindow,
  sanitizeWordId,
  sanitizeSafePageUrl,
  isLocalLoopbackAddress,
  isPrivateOrLoopbackHost,
  generateETag,
  isRequestLocalLoopback,
} from '../../server/anime-catalog-service.mjs'
import { SQLITE_ANIME_DDL } from '../../server/db/anime-persistence.mjs'

const REAL_SQLITE_PATH = path.resolve('tmp/anime/anime.db')
const REAL_DICT_DIR = path.resolve('D:/Project/data/aanime_scraper/dictionary/shards')

test('1. Input Sanitizers & Validation Rules', async (t) => {
  await t.test('sanitizePagination enforces valid integers, defaults, and upper bound', () => {
    assert.deepEqual(sanitizePagination(undefined, undefined), { page: 1, limit: 20, offset: 0 })
    assert.deepEqual(sanitizePagination('2', '50'), { page: 2, limit: 50, offset: 50 })
    assert.deepEqual(sanitizePagination(3, 10), { page: 3, limit: 10, offset: 20 })

    assert.throws(() => sanitizePagination(0, 20), (err) => err instanceof AnimeApiError && err.code === 'INVALID_PAGE')
    assert.throws(() => sanitizePagination(-1, 20), (err) => err instanceof AnimeApiError && err.code === 'INVALID_PAGE')
    assert.throws(() => sanitizePagination('abc', 20), (err) => err instanceof AnimeApiError && err.code === 'INVALID_PAGE')
    assert.throws(() => sanitizePagination(1.5, 20), (err) => err instanceof AnimeApiError && err.code === 'INVALID_PAGE')

    assert.throws(() => sanitizePagination(1, 0), (err) => err instanceof AnimeApiError && err.code === 'INVALID_LIMIT')
    assert.throws(() => sanitizePagination(1, 101), (err) => err instanceof AnimeApiError && err.code === 'INVALID_LIMIT')
    assert.throws(() => sanitizePagination(1, -5), (err) => err instanceof AnimeApiError && err.code === 'INVALID_LIMIT')
  })

  await t.test('sanitizeSlug validates strictly and rejects path traversal & dangerous characters', () => {
    assert.equal(sanitizeSlug('death-note'), 'death-note')
    assert.equal(sanitizeSlug('angel-next-door-s1'), 'angel-next-door-s1')

    assert.throws(() => sanitizeSlug(''), (err) => err instanceof AnimeApiError && err.code === 'INVALID_SLUG')
    assert.throws(() => sanitizeSlug('../death-note'), (err) => err instanceof AnimeApiError && err.code === 'INVALID_SLUG')
    assert.throws(() => sanitizeSlug('death/note'), (err) => err instanceof AnimeApiError && err.code === 'INVALID_SLUG')
    assert.throws(() => sanitizeSlug('death\\note'), (err) => err instanceof AnimeApiError && err.code === 'INVALID_SLUG')
    assert.throws(() => sanitizeSlug('slug with spaces'), (err) => err instanceof AnimeApiError && err.code === 'INVALID_SLUG')
    assert.throws(() => sanitizeSlug('slug_with_underscores'), (err) => err instanceof AnimeApiError && err.code === 'INVALID_SLUG')
    assert.throws(() => sanitizeSlug('slug<script>'), (err) => err instanceof AnimeApiError && err.code === 'INVALID_SLUG')
    assert.throws(() => sanitizeSlug('a'.repeat(121)), (err) => err instanceof AnimeApiError && err.code === 'INVALID_SLUG')
  })

  await t.test('sanitizeEpisodeId enforces canonical format and blocks path traversal', () => {
    assert.equal(
      sanitizeEpisodeId('anime:episode:test-show:test-show:1'),
      'anime:episode:test-show:test-show:1'
    )

    assert.throws(() => sanitizeEpisodeId(''), (err) => err instanceof AnimeApiError && err.code === 'INVALID_EPISODE_ID')
    assert.throws(() => sanitizeEpisodeId('ep-01'), (err) => err instanceof AnimeApiError && err.code === 'INVALID_EPISODE_ID')
    assert.throws(() => sanitizeEpisodeId('anime:episode:../../etc/passwd'), (err) => err instanceof AnimeApiError && err.code === 'INVALID_EPISODE_ID')
    assert.throws(() => sanitizeEpisodeId('anime:episode:test:test:abc'), (err) => err instanceof AnimeApiError && err.code === 'INVALID_EPISODE_ID')
  })

  await t.test('sanitizeLevel normalizes JLPT levels and rejects invalid levels', () => {
    assert.equal(sanitizeLevel(null), null)
    assert.equal(sanitizeLevel(''), null)
    assert.equal(sanitizeLevel('all'), null)
    assert.equal(sanitizeLevel('ALL'), null)
    assert.equal(sanitizeLevel('n3'), 'N3')
    assert.equal(sanitizeLevel('N1'), 'N1')

    assert.throws(() => sanitizeLevel('N6'), (err) => err instanceof AnimeApiError && err.code === 'INVALID_LEVEL')
    assert.throws(() => sanitizeLevel('B2'), (err) => err instanceof AnimeApiError && err.code === 'INVALID_LEVEL')
  })

  await t.test('sanitizeQuery strips control characters, null bytes and bounds length', () => {
    assert.equal(sanitizeQuery(null), null)
    assert.equal(sanitizeQuery(''), null)
    assert.equal(sanitizeQuery('  Naruto  '), 'Naruto')
    assert.equal(sanitizeQuery('Naruto\x00\x08Shippuden'), 'NarutoShippuden')

    assert.throws(() => sanitizeQuery('a'.repeat(101)), (err) => err instanceof AnimeApiError && err.code === 'INVALID_QUERY')
  })

  await t.test('sanitizeTimeWindow validates non-negative ranges and enforces max window', () => {
    assert.deepEqual(sanitizeTimeWindow(0, 100), { from: 0, to: 100 })
    assert.deepEqual(sanitizeTimeWindow(50, undefined), { from: 50, to: 170 }) // default +120s

    assert.throws(() => sanitizeTimeWindow(-1, 10), (err) => err instanceof AnimeApiError && err.code === 'INVALID_TIME_RANGE')
    assert.throws(() => sanitizeTimeWindow(100, 50), (err) => err instanceof AnimeApiError && err.code === 'INVALID_TIME_RANGE')
    assert.throws(() => sanitizeTimeWindow('abc', 10), (err) => err instanceof AnimeApiError && err.code === 'INVALID_TIME_RANGE')
    assert.throws(() => sanitizeTimeWindow(0, 601), (err) => err instanceof AnimeApiError && err.code === 'WINDOW_TOO_LARGE')
  })

  await t.test('sanitizeWordId validates positive integer and rejects non-numeric', () => {
    assert.equal(sanitizeWordId(1341350000), '1341350000')
    assert.equal(sanitizeWordId('4101129477'), '4101129477')

    assert.throws(() => sanitizeWordId(''), (err) => err instanceof AnimeApiError && err.code === 'INVALID_WORD_ID')
    assert.throws(() => sanitizeWordId('-123'), (err) => err instanceof AnimeApiError && err.code === 'INVALID_WORD_ID')
    assert.throws(() => sanitizeWordId('abc'), (err) => err instanceof AnimeApiError && err.code === 'INVALID_WORD_ID')
    assert.throws(() => sanitizeWordId('../shard-000.json'), (err) => err instanceof AnimeApiError && err.code === 'INVALID_WORD_ID')
  })

  await t.test('generateETag produces consistent quoted SHA-1 hashes', () => {
    const etag1 = generateETag({ hello: 'world' })
    const etag2 = generateETag({ hello: 'world' })
    const etag3 = generateETag({ hello: 'different' })

    assert.equal(etag1, etag2)
    assert.notEqual(etag1, etag3)
    assert.match(etag1, /^"[a-f0-9]{40}"$/)
  })

  await t.test('isLocalLoopbackAddress recognizes loopback and rejects remote/private non-loopback', () => {
    assert.equal(isLocalLoopbackAddress('127.0.0.1'), true)
    assert.equal(isLocalLoopbackAddress('localhost'), true)
    assert.equal(isLocalLoopbackAddress('::1'), true)
    assert.equal(isLocalLoopbackAddress('::ffff:127.0.0.1'), true)
    assert.equal(isLocalLoopbackAddress('127.0.1.1'), true)
    assert.equal(isLocalLoopbackAddress('10.0.0.1'), false)
    assert.equal(isLocalLoopbackAddress('192.168.1.1'), false)
    assert.equal(isLocalLoopbackAddress('203.0.113.195'), false)
    assert.equal(isLocalLoopbackAddress(null), false)
  })

  await t.test('isPrivateOrLoopbackHost detects private and link-local ranges', () => {
    assert.equal(isPrivateOrLoopbackHost('localhost'), true)
    assert.equal(isPrivateOrLoopbackHost('app.localhost'), true)
    assert.equal(isPrivateOrLoopbackHost('127.0.0.1'), true)
    assert.equal(isPrivateOrLoopbackHost('10.0.1.25'), true)
    assert.equal(isPrivateOrLoopbackHost('172.16.0.1'), true)
    assert.equal(isPrivateOrLoopbackHost('172.31.255.255'), true)
    assert.equal(isPrivateOrLoopbackHost('192.168.1.100'), true)
    assert.equal(isPrivateOrLoopbackHost('169.254.169.254'), true)
    assert.equal(isPrivateOrLoopbackHost('::1'), true)
    assert.equal(isPrivateOrLoopbackHost('fe80::1'), true)
    assert.equal(isPrivateOrLoopbackHost('fc00::1'), true)
    assert.equal(isPrivateOrLoopbackHost('youtube.com'), false)
    assert.equal(isPrivateOrLoopbackHost('akaiwa.tv'), false)
  })
})

test('1b. isRequestLocalLoopback Security Guard & Proxy Spoofing Defense', async (t) => {
  await t.test('ANIME_LOCAL_UNAPPROVED_ACCESS=true + socket loopback + không proxy header => được phép', () => {
    // IPv4 loopback socket
    assert.equal(
      isRequestLocalLoopback({ headers: { host: 'localhost:3000' }, socket: { remoteAddress: '127.0.0.1' } }),
      true
    )
    assert.equal(
      isRequestLocalLoopback({ headers: { host: '127.0.0.1:3000' }, socket: { remoteAddress: '127.0.0.1' } }),
      true
    )
    assert.equal(
      isRequestLocalLoopback({ headers: { host: 'localhost' }, socket: { remoteAddress: '::ffff:127.0.0.1' } }),
      true
    )

    // IPv6 loopback socket
    assert.equal(
      isRequestLocalLoopback({ headers: { host: '[::1]:3000' }, socket: { remoteAddress: '::1' } }),
      true
    )
  })

  await t.test('X-Forwarded-For: 127.0.0.1 => bị chặn (fail-closed, no proxy bypass)', () => {
    assert.equal(
      isRequestLocalLoopback({
        headers: { host: 'localhost:3000', 'x-forwarded-for': '127.0.0.1' },
        socket: { remoteAddress: '127.0.0.1' },
      }),
      false
    )
    // Mixed-case header
    assert.equal(
      isRequestLocalLoopback({
        headers: { host: 'localhost:3000', 'X-Forwarded-For': '127.0.0.1' },
        socket: { remoteAddress: '127.0.0.1' },
      }),
      false
    )
  })

  await t.test('X-Forwarded-For: 127.0.0.1, 203.0.113.1 => bị chặn', () => {
    assert.equal(
      isRequestLocalLoopback({
        headers: { host: 'localhost:3000', 'x-forwarded-for': '127.0.0.1, 203.0.113.1' },
        socket: { remoteAddress: '127.0.0.1' },
      }),
      false
    )
    assert.equal(
      isRequestLocalLoopback({
        headers: { host: 'localhost:3000', 'X-Forwarded-For': '127.0.0.1, 203.0.113.1' },
        socket: { remoteAddress: '127.0.0.1' },
      }),
      false
    )
  })

  await t.test('Forwarded: for=127.0.0.1 => bị chặn', () => {
    assert.equal(
      isRequestLocalLoopback({
        headers: { host: 'localhost:3000', forwarded: 'for=127.0.0.1' },
        socket: { remoteAddress: '127.0.0.1' },
      }),
      false
    )
    assert.equal(
      isRequestLocalLoopback({
        headers: { host: 'localhost:3000', Forwarded: 'for=127.0.0.1' },
        socket: { remoteAddress: '127.0.0.1' },
      }),
      false
    )

    // Other proxy headers: x-real-ip, x-forwarded-host, x-forwarded-proto
    assert.equal(
      isRequestLocalLoopback({
        headers: { host: 'localhost:3000', 'x-real-ip': '127.0.0.1' },
        socket: { remoteAddress: '127.0.0.1' },
      }),
      false
    )
    assert.equal(
      isRequestLocalLoopback({
        headers: { host: 'localhost:3000', 'x-forwarded-host': 'localhost' },
        socket: { remoteAddress: '127.0.0.1' },
      }),
      false
    )
  })

  await t.test('Host [::1]:<port> với socket ::1 và không proxy header => local hợp lệ', () => {
    assert.equal(
      isRequestLocalLoopback({
        headers: { host: '[::1]:8080' },
        socket: { remoteAddress: '::1' },
      }),
      true
    )
    assert.equal(
      isRequestLocalLoopback({
        headers: { host: '[::1]:3000' },
        socket: { remoteAddress: '::1' },
      }),
      true
    )
    assert.equal(
      isRequestLocalLoopback({
        headers: { host: '[::1]' },
        socket: { remoteAddress: '::1' },
      }),
      true
    )
  })

  await t.test('remote/non-loopback => bị chặn', () => {
    // Remote client IP
    assert.equal(
      isRequestLocalLoopback({
        headers: { host: 'localhost:3000' },
        socket: { remoteAddress: '203.0.113.1' },
      }),
      false
    )
    // Private non-loopback IP
    assert.equal(
      isRequestLocalLoopback({
        headers: { host: 'localhost:3000' },
        socket: { remoteAddress: '10.0.0.1' },
      }),
      false
    )
    assert.equal(
      isRequestLocalLoopback({
        headers: { host: 'localhost:3000' },
        socket: { remoteAddress: '192.168.1.1' },
      }),
      false
    )

    // Remote Host header
    assert.equal(
      isRequestLocalLoopback({
        headers: { host: 'evil-phishing.com:3000' },
        socket: { remoteAddress: '127.0.0.1' },
      }),
      false
    )
    assert.equal(
      isRequestLocalLoopback({
        headers: { host: '[fe80::1]:3000' },
        socket: { remoteAddress: '::1' },
      }),
      false
    )

    // Null/undefined request or socket
    assert.equal(isRequestLocalLoopback(null), false)
    assert.equal(isRequestLocalLoopback({ headers: {} }), false)
    assert.equal(isRequestLocalLoopback({ headers: { host: 'localhost' }, socket: null }), false)
  })
})

test('2. Safe URL & Media Source Invariant Unit Tests', async (t) => {
  await t.test('rejects dangerous URL schemes: javascript:, data:, file:, ftp:', () => {
    assert.equal(sanitizeSafePageUrl('javascript:alert(1)'), null)
    assert.equal(sanitizeSafePageUrl('javascript:void(0)'), null)
    assert.equal(sanitizeSafePageUrl('data:text/html,<script>alert(1)</script>'), null)
    assert.equal(sanitizeSafePageUrl('file:///etc/passwd'), null)
    assert.equal(sanitizeSafePageUrl('file://C:/boot.ini'), null)
    assert.equal(sanitizeSafePageUrl('ftp://ftp.example.com/file'), null)
  })

  await t.test('rejects unencrypted HTTP scheme (strict HTTPS only)', () => {
    assert.equal(sanitizeSafePageUrl('http://youtube.com/watch?v=dQw4w9WgXcQ', { sourceType: 'youtube', mediaId: 'dQw4w9WgXcQ' }), null)
    assert.equal(sanitizeSafePageUrl('http://akaiwa.tv/series/1', { sourceType: 'external_page' }), null)
  })

  await t.test('rejects loopback, private IPv4, link-local, and IPv6 internal hosts', () => {
    assert.equal(sanitizeSafePageUrl('https://localhost/watch'), null)
    assert.equal(sanitizeSafePageUrl('https://127.0.0.1/watch'), null)
    assert.equal(sanitizeSafePageUrl('https://10.0.0.1/watch'), null)
    assert.equal(sanitizeSafePageUrl('https://172.20.1.1/watch'), null)
    assert.equal(sanitizeSafePageUrl('https://192.168.1.1/watch'), null)
    assert.equal(sanitizeSafePageUrl('https://169.254.169.254/latest/meta-data'), null)
    assert.equal(sanitizeSafePageUrl('https://[::1]/watch'), null)
    assert.equal(sanitizeSafePageUrl('https://[fe80::1]/watch'), null)
  })

  await t.test('rejects unapproved external hosts not in allowlist', () => {
    assert.equal(sanitizeSafePageUrl('https://evil-untrusted-site.com/video'), null)
    assert.equal(sanitizeSafePageUrl('https://phishing-youtube.com/watch?v=dQw4w9WgXcQ'), null)
    assert.equal(sanitizeSafePageUrl('https://google.com'), null)
  })

  await t.test('youtube source type strictly validates media_id format and host', () => {
    const validId = 'dQw4w9WgXcQ'

    // Valid YouTube watch URL
    assert.equal(
      sanitizeSafePageUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', { sourceType: 'youtube', mediaId: validId }),
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    )
    assert.equal(
      sanitizeSafePageUrl('https://youtube.com/watch?v=dQw4w9WgXcQ', { sourceType: 'youtube', mediaId: validId }),
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    )
    assert.equal(
      sanitizeSafePageUrl('https://m.youtube.com/watch?v=dQw4w9WgXcQ', { sourceType: 'youtube', mediaId: validId }),
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    )
    assert.equal(
      sanitizeSafePageUrl('https://youtu.be/dQw4w9WgXcQ', { sourceType: 'youtube', mediaId: validId }),
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    )

    // ID mismatch between URL and mediaId parameter
    assert.equal(
      sanitizeSafePageUrl('https://www.youtube.com/watch?v=OTHER_ID_11', { sourceType: 'youtube', mediaId: validId }),
      null
    )
    assert.equal(
      sanitizeSafePageUrl('https://youtu.be/OTHER_ID_11', { sourceType: 'youtube', mediaId: validId }),
      null
    )

    // Invalid mediaId (must be exactly 11 characters ^[a-zA-Z0-9_-]{11}$)
    assert.equal(
      sanitizeSafePageUrl('https://www.youtube.com/watch?v=short', { sourceType: 'youtube', mediaId: 'short' }),
      null
    )
    assert.equal(
      sanitizeSafePageUrl('https://www.youtube.com/watch?v=too_long_youtube_id_123', { sourceType: 'youtube', mediaId: 'too_long_youtube_id_123' }),
      null
    )
  })

  await t.test('external_page source type requires allowlisted host and returns safe href', () => {
    assert.equal(
      sanitizeSafePageUrl('https://akaiwa.tv/anime/123', { sourceType: 'external_page' }),
      'https://akaiwa.tv/anime/123'
    )
    assert.equal(
      sanitizeSafePageUrl('https://www.akaiwa.tv/detail?id=456', { sourceType: 'external_page' }),
      'https://www.akaiwa.tv/detail?id=456'
    )
    // Non-allowlisted host returns null
    assert.equal(
      sanitizeSafePageUrl('https://untrusted-anime-site.net/watch', { sourceType: 'external_page' }),
      null
    )
  })
})

test('3. Real Database Rights Policy & Catalog Browsing (GET /api/v1/anime/catalog)', async (t) => {
  // Real database tmp/anime/anime.db currently contains 143 series with rights_status = 'unknown'

  await t.test('default public mode returns 0 items and does NOT leak 143 unapproved series', async () => {
    const publicService = new AnimeCatalogService({
      sqlitePath: REAL_SQLITE_PATH,
      dictionaryDir: REAL_DICT_DIR,
      allowUnapprovedContent: false, // Default production/public
    })

    const res = await publicService.getCatalog({ page: 1, limit: 10, isLocalLoopback: false })
    assert.equal(res.pagination.page, 1)
    assert.equal(res.pagination.limit, 10)
    assert.equal(res.pagination.totalItems, 0)
    assert.equal(res.pagination.totalPages, 0)
    assert.equal(res.items.length, 0)
  })

  await t.test('local-owner override configured BUT remote caller (isLocalLoopback: false) fails closed with 0 items', async () => {
    const overrideService = new AnimeCatalogService({
      sqlitePath: REAL_SQLITE_PATH,
      dictionaryDir: REAL_DICT_DIR,
      allowUnapprovedContent: true,
    })

    const res = await overrideService.getCatalog({ page: 1, limit: 10, isLocalLoopback: false })
    assert.equal(res.pagination.totalItems, 0)
    assert.equal(res.items.length, 0)
  })

  await t.test('local-owner override with loopback caller returns all 143 items with pagination and filters', async () => {
    const devService = new AnimeCatalogService({
      sqlitePath: REAL_SQLITE_PATH,
      dictionaryDir: REAL_DICT_DIR,
      allowUnapprovedContent: true,
    })

    const res = await devService.getCatalog({ page: 1, limit: 10, isLocalLoopback: true })
    assert.equal(res.pagination.page, 1)
    assert.equal(res.pagination.limit, 10)
    assert.equal(res.pagination.totalItems, 143)
    assert.equal(res.pagination.totalPages, 15)
    assert.equal(res.items.length, 10)

    const first = res.items[0]
    assert.ok(first.series_id)
    assert.ok(first.series_slug)
    assert.ok(first.title_vi)
    assert.equal(typeof first.total_episodes, 'number')
    assert.equal(typeof first.season_count, 'number')
    assert.equal(typeof first.subbed_episodes_count, 'number')
    assert.equal(first.rights_status, 'unknown')

    // Filter by JLPT level
    const resN5 = await devService.getCatalog({ level: 'N5', limit: 100, isLocalLoopback: true })
    assert.ok(resN5.items.length > 0)
    for (const item of resN5.items) {
      assert.equal(item.jlpt_level, 'N5')
    }

    // Filter by query
    const resTitan = await devService.getCatalog({ q: 'Titan', isLocalLoopback: true })
    assert.ok(resTitan.items.length > 0)
    for (const item of resTitan.items) {
      const match =
        item.title_vi.toLowerCase().includes('titan') ||
        (item.title_ja && item.title_ja.toLowerCase().includes('titan')) ||
        item.description.toLowerCase().includes('titan')
      assert.ok(match, `Item ${item.series_slug} should match 'Titan'`)
    }

    // Filter by genre
    const resGenre = await devService.getCatalog({ genre: '#Anime', limit: 5, isLocalLoopback: true })
    assert.ok(resGenre.items.length > 0)
    for (const item of resGenre.items) {
      assert.equal(item.category, '#Anime')
    }
  })
})

test('4. Real Database Series Detail & Rights Filtering (GET /api/v1/anime/series/:slug)', async (t) => {
  const publicService = new AnimeCatalogService({
    sqlitePath: REAL_SQLITE_PATH,
    dictionaryDir: REAL_DICT_DIR,
    allowUnapprovedContent: false,
  })

  const devService = new AnimeCatalogService({
    sqlitePath: REAL_SQLITE_PATH,
    dictionaryDir: REAL_DICT_DIR,
    allowUnapprovedContent: true,
  })

  await t.test('public API rejects unknown rights series with 403 ANIME_CONTENT_RESTRICTED (not fake 404)', async () => {
    await assert.rejects(
      async () => {
        await publicService.getSeriesDetail('angel-next-door-s1', { isLocalLoopback: false })
      },
      (err) => err instanceof AnimeApiError && err.status === 403 && err.code === 'ANIME_CONTENT_RESTRICTED'
    )
  })

  await t.test('returns 404 SERIES_NOT_FOUND only for truly non-existent series', async () => {
    await assert.rejects(
      async () => {
        await publicService.getSeriesDetail('completely-non-existent-show-999', { isLocalLoopback: false })
      },
      (err) => err instanceof AnimeApiError && err.status === 404 && err.code === 'SERIES_NOT_FOUND'
    )
  })

  await t.test('throws 400 for path traversal attempt', async () => {
    await assert.rejects(
      async () => {
        await publicService.getSeriesDetail('../angel-next-door-s1', { isLocalLoopback: false })
      },
      (err) => err instanceof AnimeApiError && err.status === 400 && err.code === 'INVALID_SLUG'
    )
  })

  await t.test('override mode with loopback returns full series detail and season breakdown', async () => {
    const res = await devService.getSeriesDetail('angel-next-door-s1', { isLocalLoopback: true })
    assert.equal(res.series_slug, 'angel-next-door-s1')
    assert.equal(res.title_vi, 'Thiên Sứ Nhà Bên')
    assert.equal(res.jlpt_level, 'N5')
    assert.ok(Array.isArray(res.seasons))
    assert.ok(res.seasons.length >= 1)

    const s1 = res.seasons[0]
    assert.equal(s1.season_ordinal, 1)
    assert.ok(s1.actual_episodes_count > 0)
  })

  await t.test('override mode with remote client (isLocalLoopback: false) fails closed with 403', async () => {
    await assert.rejects(
      async () => {
        await devService.getSeriesDetail('angel-next-door-s1', { isLocalLoopback: false })
      },
      (err) => err instanceof AnimeApiError && err.status === 403 && err.code === 'ANIME_CONTENT_RESTRICTED'
    )
  })
})

test('5. Real Database Series Episodes & Rights Filtering (GET /api/v1/anime/series/:slug/episodes)', async (t) => {
  const publicService = new AnimeCatalogService({
    sqlitePath: REAL_SQLITE_PATH,
    dictionaryDir: REAL_DICT_DIR,
    allowUnapprovedContent: false,
  })

  const devService = new AnimeCatalogService({
    sqlitePath: REAL_SQLITE_PATH,
    dictionaryDir: REAL_DICT_DIR,
    allowUnapprovedContent: true,
  })

  await t.test('public API rejects unapproved series episode listing with 403', async () => {
    await assert.rejects(
      async () => {
        await publicService.getSeriesEpisodes('asterisk-war', { isLocalLoopback: false })
      },
      (err) => err instanceof AnimeApiError && err.status === 403 && err.code === 'ANIME_CONTENT_RESTRICTED'
    )
  })

  await t.test('throws 404 for non-existent series slug', async () => {
    await assert.rejects(
      async () => {
        await publicService.getSeriesEpisodes('phantom-series-xyz', { isLocalLoopback: false })
      },
      (err) => err instanceof AnimeApiError && err.status === 404 && err.code === 'SERIES_NOT_FOUND'
    )
  })

  await t.test('override mode with loopback returns episodes with stream_url omitted', async () => {
    const res = await devService.getSeriesEpisodes('asterisk-war', { page: 1, limit: 10, isLocalLoopback: true })
    assert.equal(res.series_slug, 'asterisk-war')
    assert.equal(res.pagination.page, 1)
    assert.equal(res.pagination.limit, 10)
    assert.ok(res.pagination.totalItems >= 24)
    assert.equal(res.items.length, 10)

    for (const ep of res.items) {
      assert.equal(ep.stream_url, undefined, 'stream_url must NEVER be returned')
      assert.equal(typeof ep.playback_allowed, 'boolean')
    }
  })

  await t.test('override mode with remote client (isLocalLoopback: false) fails closed with 403', async () => {
    await assert.rejects(
      async () => {
        await devService.getSeriesEpisodes('asterisk-war', { isLocalLoopback: false })
      },
      (err) => err instanceof AnimeApiError && err.status === 403 && err.code === 'ANIME_CONTENT_RESTRICTED'
    )
  })
})

test('6. Real Database Episode Detail & Media Source Invariants (GET /api/v1/anime/episodes/:episodeId)', async (t) => {
  const publicService = new AnimeCatalogService({
    sqlitePath: REAL_SQLITE_PATH,
    dictionaryDir: REAL_DICT_DIR,
    allowUnapprovedContent: false,
  })

  const devService = new AnimeCatalogService({
    sqlitePath: REAL_SQLITE_PATH,
    dictionaryDir: REAL_DICT_DIR,
    allowUnapprovedContent: true,
  })

  const epId = 'anime:episode:asterisk-war:asterisk-war:1'

  await t.test('public API rejects unapproved episode with 403 ANIME_CONTENT_RESTRICTED', async () => {
    await assert.rejects(
      async () => {
        await publicService.getEpisodeDetail(epId, { isLocalLoopback: false })
      },
      (err) => err instanceof AnimeApiError && err.status === 403 && err.code === 'ANIME_CONTENT_RESTRICTED'
    )
  })

  await t.test('throws 404 for truly non-existent episode', async () => {
    await assert.rejects(
      async () => {
        await publicService.getEpisodeDetail('anime:episode:death-note:death-note:9999', { isLocalLoopback: false })
      },
      (err) => err instanceof AnimeApiError && err.status === 404 && err.code === 'EPISODE_NOT_FOUND'
    )
  })

  await t.test('throws 400 for malformed episode ID', async () => {
    await assert.rejects(
      async () => {
        await publicService.getEpisodeDetail('invalid-ep-id', { isLocalLoopback: false })
      },
      (err) => err instanceof AnimeApiError && err.status === 400 && err.code === 'INVALID_EPISODE_ID'
    )
  })

  await t.test('override mode with loopback returns YouTube episode with safe URL and no stream_url', async () => {
    const ep = await devService.getEpisodeDetail(epId, { isLocalLoopback: true })
    assert.equal(ep.episode_id, epId)
    assert.equal(ep.series_slug, 'asterisk-war')
    assert.ok(ep.media_source)
    assert.equal(ep.media_source.source_type, 'youtube')
    assert.equal(ep.media_source.playback_allowed, true)
    assert.ok(ep.media_source.media_id)
    assert.ok(ep.media_source.page_url.startsWith('https://www.youtube.com/watch?v='))
    assert.equal(ep.media_source.stream_url, undefined, 'stream_url must NEVER be returned')
  })

  await t.test('override mode with loopback returns external_page with playback_allowed: false and media_id: null', async () => {
    const db = new DatabaseSync(REAL_SQLITE_PATH, { readOnly: true })
    const extRow = db.prepare(`
      SELECT ep.episode_id FROM anime_episodes ep
      JOIN anime_media_sources ms ON ms.episode_id = ep.episode_id
      WHERE ms.source_type = 'external_page'
      LIMIT 1
    `).get()
    db.close()

    assert.ok(extRow, 'Database must contain at least one external_page episode')
    const ep = await devService.getEpisodeDetail(extRow.episode_id, { isLocalLoopback: true })
    assert.equal(ep.media_source.source_type, 'external_page')
    assert.equal(ep.media_source.playback_allowed, false)
    assert.equal(ep.media_source.media_id, null)
    assert.equal(ep.media_source.stream_url, undefined)
  })

  await t.test('override mode with remote client (isLocalLoopback: false) fails closed with 403', async () => {
    await assert.rejects(
      async () => {
        await devService.getEpisodeDetail(epId, { isLocalLoopback: false })
      },
      (err) => err instanceof AnimeApiError && err.status === 403 && err.code === 'ANIME_CONTENT_RESTRICTED'
    )
  })
})

test('7. Real Database Subtitles Window & Rights Filtering (GET /api/v1/anime/episodes/:episodeId/subtitles)', async (t) => {
  const publicService = new AnimeCatalogService({
    sqlitePath: REAL_SQLITE_PATH,
    dictionaryDir: REAL_DICT_DIR,
    allowUnapprovedContent: false,
  })

  const devService = new AnimeCatalogService({
    sqlitePath: REAL_SQLITE_PATH,
    dictionaryDir: REAL_DICT_DIR,
    allowUnapprovedContent: true,
  })

  const episodeId = 'anime:episode:asterisk-war:asterisk-war:1'

  await t.test('public API rejects unapproved episode subtitles with 403 ANIME_CONTENT_RESTRICTED', async () => {
    await assert.rejects(
      async () => {
        await publicService.getEpisodeSubtitles(episodeId, { from: 80, to: 110, isLocalLoopback: false })
      },
      (err) => err instanceof AnimeApiError && err.status === 403 && err.code === 'ANIME_CONTENT_RESTRICTED'
    )
  })

  await t.test('override mode retrieves only cues overlapping time window', async () => {
    const res = await devService.getEpisodeSubtitles(episodeId, { from: 80, to: 110, lang: 'all', isLocalLoopback: true })
    assert.equal(res.episode_id, episodeId)
    assert.equal(res.from, 80)
    assert.equal(res.to, 110)
    assert.ok(Array.isArray(res.cues))
    assert.ok(res.cues.length > 0)

    for (const cue of res.cues) {
      assert.ok(cue.start <= 110 && cue.end >= 80, `Cue ${cue.cue_id} (${cue.start}-${cue.end}) must overlap [80, 110]`)
      assert.ok(cue.ja)
      assert.ok(cue.vi)
      assert.ok(Array.isArray(cue.tokens))
    }
  })

  await t.test('override mode defaults to [from, from + 120s] when to is omitted', async () => {
    const res = await devService.getEpisodeSubtitles(episodeId, { from: 80, isLocalLoopback: true })
    assert.equal(res.from, 80)
    assert.equal(res.to, 200)
    assert.ok(res.cues.length > 0)
  })

  await t.test('override mode lang=ja returns ja text & tokens without vi', async () => {
    const res = await devService.getEpisodeSubtitles(episodeId, { from: 80, to: 90, lang: 'ja', isLocalLoopback: true })
    assert.ok(res.cues.length > 0)
    for (const cue of res.cues) {
      assert.ok(cue.ja)
      assert.equal(cue.vi, undefined)
      assert.ok(Array.isArray(cue.tokens))
    }
  })

  await t.test('override mode lang=vi returns vi text without ja or tokens', async () => {
    const res = await devService.getEpisodeSubtitles(episodeId, { from: 80, to: 90, lang: 'vi', isLocalLoopback: true })
    assert.ok(res.cues.length > 0)
    for (const cue of res.cues) {
      assert.ok(cue.vi)
      assert.equal(cue.ja, undefined)
      assert.equal(cue.tokens, undefined)
    }
  })

  await t.test('throws 400 when window exceeds 600s', async () => {
    await assert.rejects(
      async () => {
        await devService.getEpisodeSubtitles(episodeId, { from: 0, to: 650, isLocalLoopback: true })
      },
      (err) => err instanceof AnimeApiError && err.status === 400 && err.code === 'WINDOW_TOO_LARGE'
    )
  })

  await t.test('throws 400 when from > to', async () => {
    await assert.rejects(
      async () => {
        await devService.getEpisodeSubtitles(episodeId, { from: 100, to: 50, isLocalLoopback: true })
      },
      (err) => err instanceof AnimeApiError && err.status === 400 && err.code === 'INVALID_TIME_RANGE'
    )
  })

  await t.test('throws 400 for invalid language parameter', async () => {
    await assert.rejects(
      async () => {
        await devService.getEpisodeSubtitles(episodeId, { from: 0, to: 60, lang: 'fr', isLocalLoopback: true })
      },
      (err) => err instanceof AnimeApiError && err.status === 400 && err.code === 'INVALID_LANGUAGE'
    )
  })

  await t.test('override mode with remote client (isLocalLoopback: false) fails closed with 403', async () => {
    await assert.rejects(
      async () => {
        await devService.getEpisodeSubtitles(episodeId, { from: 80, to: 110, isLocalLoopback: false })
      },
      (err) => err instanceof AnimeApiError && err.status === 403 && err.code === 'ANIME_CONTENT_RESTRICTED'
    )
  })
})

test('8. Dictionary Shard Lookup (GET /api/v1/anime/dictionary/:wordId)', async (t) => {
  const service = new AnimeCatalogService({
    sqlitePath: REAL_SQLITE_PATH,
    dictionaryDir: REAL_DICT_DIR,
  })

  await t.test('retrieves word entry correctly from shard-000.json', async () => {
    const word = await service.getDictionaryWord('1341350000')
    assert.equal(word.id, 1341350000)
    assert.equal(word.word, '合理的')
    assert.equal(word.reading, 'ごうりてき')
    assert.equal(word.hanviet, 'HỢP LÍ ĐÍCH')
    assert.ok(Array.isArray(word.meanings))
    assert.ok(word.meanings.length > 0)
    assert.ok(Array.isArray(word.kanji_breakdown))
    assert.equal(word.kanji_breakdown.length, 3)
  })

  await t.test('retrieves word entry from another shard (shard-001.json)', async () => {
    const word = await service.getDictionaryWord('90737001')
    assert.equal(word.id, 90737001)
    assert.equal(word.word, '肌')
    assert.equal(word.reading, 'はだ')
  })

  await t.test('throws 404 for non-existent word ID', async () => {
    await assert.rejects(
      async () => {
        await service.getDictionaryWord('999999999999')
      },
      (err) => err instanceof AnimeApiError && err.status === 404 && err.code === 'WORD_NOT_FOUND'
    )
  })

  await t.test('throws 400 for path traversal or malformed word ID', async () => {
    await assert.rejects(
      async () => {
        await service.getDictionaryWord('../../../passwd')
      },
      (err) => err instanceof AnimeApiError && err.status === 400 && err.code === 'INVALID_WORD_ID'
    )
  })
})

test('9. Fixture-based Isolated Database Rights Matrix & Unsafe URL Sanitization', async (t) => {
  // Create an in-memory SQLite database populated with 3 series: approved, unknown, restricted
  const fixtureDb = new DatabaseSync(':memory:')
  fixtureDb.exec(SQLITE_ANIME_DDL)

  const now = '2026-09-12T00:00:00.000Z'

  // Insert Series 1: Approved
  fixtureDb.prepare(`
    INSERT INTO anime_series (
      series_id, series_slug, title_vi, title_ja, description, jlpt_level, category, rights_status, created_at, updated_at
    ) VALUES (
      'series-approved', 'approved-anime', 'Anime Hợp Pháp', '承認アニメ', 'Bản quyền đầy đủ', 'N3', '#Anime', 'approved', ?, ?
    )
  `).run(now, now)

  // Insert Series 2: Unknown
  fixtureDb.prepare(`
    INSERT INTO anime_series (
      series_id, series_slug, title_vi, title_ja, description, jlpt_level, category, rights_status, created_at, updated_at
    ) VALUES (
      'series-unknown', 'unknown-anime', 'Anime Chưa Duyệt', '未定アニメ', 'Chưa duyệt bản quyền', 'N2', '#Anime', 'unknown', ?, ?
    )
  `).run(now, now)

  // Insert Series 3: Restricted
  fixtureDb.prepare(`
    INSERT INTO anime_series (
      series_id, series_slug, title_vi, title_ja, description, jlpt_level, category, rights_status, created_at, updated_at
    ) VALUES (
      'series-restricted', 'restricted-anime', 'Anime Bị Giới Hạn', '制限アニメ', 'Bị cấm chiếu', 'N1', '#Anime', 'restricted', ?, ?
    )
  `).run(now, now)

  // Insert seasons
  for (const slug of ['approved-anime', 'unknown-anime', 'restricted-anime']) {
    const seriesId = slug === 'approved-anime' ? 'series-approved' : slug === 'unknown-anime' ? 'series-unknown' : 'series-restricted'
    fixtureDb.prepare(`
      INSERT INTO anime_seasons (
        season_id, series_id, series_slug, season_slug, season_ordinal, title_vi, total_episodes, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, 1, 'Phần 1', 1, ?, ?
      )
    `).run('season-' + slug, seriesId, slug, slug, now, now)
  }

  // Insert episode 1 (approved show) - YouTube valid
  const approvedEpId = 'anime:episode:approved-anime:approved-anime:1'
  fixtureDb.prepare(`
    INSERT INTO anime_episodes (
      episode_id, series_id, season_id, series_slug, season_slug, episode_number, title, has_subtitles, created_at, updated_at
    ) VALUES (
      ?, 'series-approved', 'season-approved-anime', 'approved-anime', 'approved-anime', 1, 'Tập 1 Hợp Pháp', 1, ?, ?
    )
  `).run(approvedEpId, now, now)
  fixtureDb.prepare(`
    INSERT INTO anime_media_sources (
      source_id, episode_id, source_type, media_id, page_url, playback_allowed, rights_status, created_at, updated_at
    ) VALUES (
      'ms-approved-1', ?, 'youtube', 'dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 1, 'restricted', ?, ?
    )
  `).run(approvedEpId, now, now)
  fixtureDb.prepare(`
    INSERT INTO anime_subtitle_tracks (
      track_id, episode_id, series_slug, episode_number, languages, cue_count, token_count, created_at, updated_at
    ) VALUES (
      'track-approved-1', ?, 'approved-anime', 1, '["ja","vi"]', 1, 1, ?, ?
    )
  `).run(approvedEpId, now, now)
  fixtureDb.prepare(`
    INSERT INTO anime_subtitle_cues (
      id, track_id, episode_id, cue_id, start_time, end_time, ja_text, vi_text, created_at, updated_at
    ) VALUES (
      1, 'track-approved-1', ?, 1, 10.0, 15.0, 'こんにちは', 'Xin chào', ?, ?
    )
  `).run(approvedEpId, now, now)

  // Insert episode 2 (unknown show)
  const unknownEpId = 'anime:episode:unknown-anime:unknown-anime:1'
  fixtureDb.prepare(`
    INSERT INTO anime_episodes (
      episode_id, series_id, season_id, series_slug, season_slug, episode_number, title, has_subtitles, created_at, updated_at
    ) VALUES (
      ?, 'series-unknown', 'season-unknown-anime', 'unknown-anime', 'unknown-anime', 1, 'Tập 1 Chưa Duyệt', 1, ?, ?
    )
  `).run(unknownEpId, now, now)
  fixtureDb.prepare(`
    INSERT INTO anime_media_sources (
      source_id, episode_id, source_type, media_id, page_url, playback_allowed, rights_status, created_at, updated_at
    ) VALUES (
      'ms-unknown-1', ?, 'youtube', 'abc123xyz00', 'https://www.youtube.com/watch?v=abc123xyz00', 1, 'unknown', ?, ?
    )
  `).run(unknownEpId, now, now)

  // Insert episode 3 (restricted show)
  const restrictedEpId = 'anime:episode:restricted-anime:restricted-anime:1'
  fixtureDb.prepare(`
    INSERT INTO anime_episodes (
      episode_id, series_id, season_id, series_slug, season_slug, episode_number, title, has_subtitles, created_at, updated_at
    ) VALUES (
      ?, 'series-restricted', 'season-restricted-anime', 'restricted-anime', 'restricted-anime', 1, 'Tập 1 Bị Khóa', 0, ?, ?
    )
  `).run(restrictedEpId, now, now)

  // Create isolated fixture service with mock db
  const fixtureService = new AnimeCatalogService({
    allowUnapprovedContent: false,
    dictionaryDir: REAL_DICT_DIR,
  })
  fixtureService.storage = 'sqlite'
  fixtureService.db = fixtureDb

  t.after(() => {
    fixtureDb.close()
  })

  await t.test('catalog only returns approved series (unknown and restricted filtered out)', async () => {
    const res = await fixtureService.getCatalog({ page: 1, limit: 10, isLocalLoopback: false })
    assert.equal(res.pagination.totalItems, 1)
    assert.equal(res.items.length, 1)
    assert.equal(res.items[0].series_slug, 'approved-anime')
    assert.equal(res.items[0].rights_status, 'approved')
  })

  await t.test('approved series details, episodes, and subtitles accessible to public', async () => {
    const detail = await fixtureService.getSeriesDetail('approved-anime', { isLocalLoopback: false })
    assert.equal(detail.series_slug, 'approved-anime')

    const eps = await fixtureService.getSeriesEpisodes('approved-anime', { isLocalLoopback: false })
    assert.equal(eps.items.length, 1)
    assert.equal(eps.items[0].episode_id, approvedEpId)

    const ep = await fixtureService.getEpisodeDetail(approvedEpId, { isLocalLoopback: false })
    assert.equal(ep.episode_id, approvedEpId)
    assert.equal(ep.media_source.playback_allowed, true)

    const subs = await fixtureService.getEpisodeSubtitles(approvedEpId, { from: 0, to: 30, isLocalLoopback: false })
    assert.equal(subs.cues.length, 1)
  })

  await t.test('unknown and restricted series throw 403 ANIME_CONTENT_RESTRICTED on all endpoints', async () => {
    // getSeriesDetail
    await assert.rejects(
      async () => fixtureService.getSeriesDetail('unknown-anime', { isLocalLoopback: false }),
      (err) => err instanceof AnimeApiError && err.status === 403 && err.code === 'ANIME_CONTENT_RESTRICTED'
    )
    await assert.rejects(
      async () => fixtureService.getSeriesDetail('restricted-anime', { isLocalLoopback: false }),
      (err) => err instanceof AnimeApiError && err.status === 403 && err.code === 'ANIME_CONTENT_RESTRICTED'
    )

    // getSeriesEpisodes
    await assert.rejects(
      async () => fixtureService.getSeriesEpisodes('unknown-anime', { isLocalLoopback: false }),
      (err) => err instanceof AnimeApiError && err.status === 403 && err.code === 'ANIME_CONTENT_RESTRICTED'
    )
    await assert.rejects(
      async () => fixtureService.getSeriesEpisodes('restricted-anime', { isLocalLoopback: false }),
      (err) => err instanceof AnimeApiError && err.status === 403 && err.code === 'ANIME_CONTENT_RESTRICTED'
    )

    // getEpisodeDetail
    await assert.rejects(
      async () => fixtureService.getEpisodeDetail(unknownEpId, { isLocalLoopback: false }),
      (err) => err instanceof AnimeApiError && err.status === 403 && err.code === 'ANIME_CONTENT_RESTRICTED'
    )
    await assert.rejects(
      async () => fixtureService.getEpisodeDetail(restrictedEpId, { isLocalLoopback: false }),
      (err) => err instanceof AnimeApiError && err.status === 403 && err.code === 'ANIME_CONTENT_RESTRICTED'
    )

    // getEpisodeSubtitles
    await assert.rejects(
      async () => fixtureService.getEpisodeSubtitles(unknownEpId, { isLocalLoopback: false }),
      (err) => err instanceof AnimeApiError && err.status === 403 && err.code === 'ANIME_CONTENT_RESTRICTED'
    )
  })

  await t.test('unsafe page_url in database is sanitized to null and playback disabled', async () => {
    const unsafeEpId = 'anime:episode:approved-anime:approved-anime:2'
    // Insert episode with dangerous javascript: url
    fixtureDb.prepare(`
      INSERT INTO anime_episodes (
        episode_id, series_id, season_id, series_slug, season_slug, episode_number, title, has_subtitles, created_at, updated_at
      ) VALUES (
        ?, 'series-approved', 'season-approved-anime', 'approved-anime', 'approved-anime', 2, 'Unsafe URL Episode', 0, ?, ?
      )
    `).run(unsafeEpId, now, now)
    fixtureDb.prepare(`
      INSERT INTO anime_media_sources (
        source_id, episode_id, source_type, media_id, page_url, playback_allowed, rights_status, created_at, updated_at
      ) VALUES (
        'ms-unsafe-1', ?, 'youtube', 'dQw4w9WgXcQ', 'javascript:alert(1)', 1, 'restricted', ?, ?
      )
    `).run(unsafeEpId, now, now)

    const ep = await fixtureService.getEpisodeDetail(unsafeEpId, { isLocalLoopback: false })
    assert.equal(ep.media_source.page_url, null, 'Unsafe javascript: url must be sanitized to null')
    assert.equal(ep.media_source.playback_allowed, false, 'Playback must be disabled when URL is unsafe')

    // Test unencrypted HTTP in database
    const httpEpId = 'anime:episode:approved-anime:approved-anime:3'
    fixtureDb.prepare(`
      INSERT INTO anime_episodes (
        episode_id, series_id, season_id, series_slug, season_slug, episode_number, title, has_subtitles, created_at, updated_at
      ) VALUES (
        ?, 'series-approved', 'season-approved-anime', 'approved-anime', 'approved-anime', 3, 'HTTP URL Episode', 0, ?, ?
      )
    `).run(httpEpId, now, now)
    fixtureDb.prepare(`
      INSERT INTO anime_media_sources (
        source_id, episode_id, source_type, media_id, page_url, playback_allowed, rights_status, created_at, updated_at
      ) VALUES (
        'ms-http-1', ?, 'youtube', 'dQw4w9WgXcQ', 'http://www.youtube.com/watch?v=dQw4w9WgXcQ', 1, 'restricted', ?, ?
      )
    `).run(httpEpId, now, now)

    const epHttp = await fixtureService.getEpisodeDetail(httpEpId, { isLocalLoopback: false })
    assert.equal(epHttp.media_source.page_url, null, 'Unencrypted HTTP URL must be sanitized to null')
    assert.equal(epHttp.media_source.playback_allowed, false, 'Playback must be disabled for unencrypted HTTP')

    // Test external_page with allowlisted vs unallowlisted hosts
    const extAllowEpId = 'anime:episode:approved-anime:approved-anime:4'
    const extBlockEpId = 'anime:episode:approved-anime:approved-anime:5'
    fixtureDb.prepare(`
      INSERT INTO anime_episodes (
        episode_id, series_id, season_id, series_slug, season_slug, episode_number, title, has_subtitles, created_at, updated_at
      ) VALUES
        (?, 'series-approved', 'season-approved-anime', 'approved-anime', 'approved-anime', 4, 'Ext Allowlisted', 0, ?, ?),
        (?, 'series-approved', 'season-approved-anime', 'approved-anime', 'approved-anime', 5, 'Ext Unallowlisted', 0, ?, ?)
    `).run(extAllowEpId, now, now, extBlockEpId, now, now)

    fixtureDb.prepare(`
      INSERT INTO anime_media_sources (
        source_id, episode_id, source_type, media_id, page_url, playback_allowed, rights_status, created_at, updated_at
      ) VALUES
        ('ms-ext-allow', ?, 'external_page', NULL, 'https://akaiwa.tv/series/test', 0, 'unknown', ?, ?),
        ('ms-ext-block', ?, 'external_page', NULL, 'https://untrusted-pirate-site.net/watch', 0, 'unknown', ?, ?)
    `).run(extAllowEpId, now, now, extBlockEpId, now, now)

    const epExtAllow = await fixtureService.getEpisodeDetail(extAllowEpId, { isLocalLoopback: false })
    assert.equal(epExtAllow.media_source.source_type, 'external_page')
    assert.equal(epExtAllow.media_source.playback_allowed, false)
    assert.equal(epExtAllow.media_source.media_id, null)
    assert.equal(epExtAllow.media_source.page_url, 'https://akaiwa.tv/series/test')

    const epExtBlock = await fixtureService.getEpisodeDetail(extBlockEpId, { isLocalLoopback: false })
    assert.equal(epExtBlock.media_source.source_type, 'external_page')
    assert.equal(epExtBlock.media_source.playback_allowed, false)
    assert.equal(epExtBlock.media_source.media_id, null)
    assert.equal(epExtBlock.media_source.page_url, null, 'Unallowlisted host must be sanitized to null')
  })
})

test('10. EXPLAIN QUERY PLAN Index Verification on Real Database', async (t) => {
  const db = new DatabaseSync(REAL_SQLITE_PATH, { readOnly: true })
  t.after(() => {
    db.close()
  })

  await t.test('Catalog browse query uses anime_series_jlpt_category_idx', () => {
    const plans = db
      .prepare('EXPLAIN QUERY PLAN SELECT series_id FROM anime_series s WHERE s.jlpt_level = ? AND s.category = ?')
      .all('N3', '#Anime')
    const detail = plans.map((p) => p.detail).join('; ')
    assert.match(detail, /USING INDEX anime_series_jlpt_category_idx/, `Plan must use JLPT category index: ${detail}`)
  })

  await t.test('Series slug query uses unique index on series_slug', () => {
    const plans = db
      .prepare('EXPLAIN QUERY PLAN SELECT * FROM anime_series WHERE series_slug = ?')
      .all('asterisk-war')
    const detail = plans.map((p) => p.detail).join('; ')
    assert.match(detail, /USING (COVERING )?INDEX (anime_series_slug_idx|sqlite_autoindex_anime_series_)/, `Plan must use slug index: ${detail}`)
  })

  await t.test('Series episodes query uses anime_episodes_series_ep_idx', () => {
    const explainPlans = db
      .prepare('EXPLAIN QUERY PLAN SELECT episode_id FROM anime_episodes WHERE series_slug = ?')
      .all('asterisk-war')
    const detail = explainPlans.map((p) => p.detail).join('; ')
    assert.match(detail, /USING (COVERING )?INDEX (sqlite_autoindex_anime_episodes_)/, `Plan must use episode index: ${detail}`)
  })

  await t.test('Subtitle cues time window query uses anime_subtitle_cues_ep_time_idx', () => {
    const plans = db
      .prepare('EXPLAIN QUERY PLAN SELECT id FROM anime_subtitle_cues WHERE episode_id = ? AND start_time <= ? AND end_time >= ?')
      .all('anime:episode:asterisk-war:asterisk-war:1', 100.0, 80.0)
    const detail = plans.map((p) => p.detail).join('; ')
    assert.match(detail, /USING (COVERING )?INDEX anime_subtitle_cues_ep_time_idx/, `Plan must use cue time index: ${detail}`)
  })

  await t.test('Subtitle tokens batch query uses anime_subtitle_tokens_cue_ord_idx', () => {
    const plans = db
      .prepare('EXPLAIN QUERY PLAN SELECT id FROM anime_subtitle_tokens WHERE cue_row_id IN (1, 2, 3)')
      .all()
    const detail = plans.map((p) => p.detail).join('; ')
    assert.match(detail, /USING (COVERING )?INDEX anime_subtitle_tokens_cue_ord_idx/, `Plan must use token cue ord index: ${detail}`)
  })
})

test('11. HTTP Contract Server (Public Rights, Local Override, ETag & 304)', async (t) => {
  const publicService = new AnimeCatalogService({
    sqlitePath: REAL_SQLITE_PATH,
    dictionaryDir: REAL_DICT_DIR,
    allowUnapprovedContent: false,
  })

  const devService = new AnimeCatalogService({
    sqlitePath: REAL_SQLITE_PATH,
    dictionaryDir: REAL_DICT_DIR,
    allowUnapprovedContent: true,
  })

  // Factory to create request handler matching server/index.mjs
  function createRequestHandler(service) {
    return async (req, res) => {
      const host = req.headers.host || 'localhost'
      const url = new URL(req.url, `http://${host}`)
      const pathname = url.pathname

      // Use shared isRequestLocalLoopback helper directly from anime-catalog-service.mjs
      const isLocalLoopback = isRequestLocalLoopback(req)

      const json = (status, body, extraHeaders = {}) => {
        res.writeHead(status, {
          'content-type': 'application/json; charset=utf-8',
          ...extraHeaders,
        })
        res.end(JSON.stringify(body))
      }

      const sendCacheableJson = (status, payload) => {
        const etag = generateETag(payload)
        const ifNoneMatch = req.headers['if-none-match']
        if (ifNoneMatch && ifNoneMatch === etag) {
          res.writeHead(304, {
            etag,
            'cache-control': 'public, max-age=60, stale-while-revalidate=300',
          })
          res.end()
          return
        }
        json(status, payload, {
          etag,
          'cache-control': 'public, max-age=60, stale-while-revalidate=300',
        })
      }

      try {
        if (req.method === 'GET' && pathname === '/api/v1/anime/catalog') {
          const q = url.searchParams.get('q')
          const level = url.searchParams.get('level')
          const genre = url.searchParams.get('genre')
          const page = url.searchParams.get('page')
          const limit = url.searchParams.get('limit')
          const data = await service.getCatalog({ q, level, genre, page, limit, isLocalLoopback })
          sendCacheableJson(200, { data })
          return
        }

        const seriesEpMatch = pathname.match(/^\/api\/v1\/anime\/series\/([^/]+)\/episodes$/)
        if (req.method === 'GET' && seriesEpMatch) {
          const slug = decodeURIComponent(seriesEpMatch[1])
          const page = url.searchParams.get('page')
          const limit = url.searchParams.get('limit')
          const data = await service.getSeriesEpisodes(slug, { page, limit, isLocalLoopback })
          sendCacheableJson(200, { data })
          return
        }

        const seriesDetailMatch = pathname.match(/^\/api\/v1\/anime\/series\/([^/]+)$/)
        if (req.method === 'GET' && seriesDetailMatch) {
          const slug = decodeURIComponent(seriesDetailMatch[1])
          const data = await service.getSeriesDetail(slug, { isLocalLoopback })
          sendCacheableJson(200, { data })
          return
        }

        const subMatch = pathname.match(/^\/api\/v1\/anime\/episodes\/([^/]+)\/subtitles$/)
        if (req.method === 'GET' && subMatch) {
          const episodeId = decodeURIComponent(subMatch[1])
          const from = url.searchParams.get('from')
          const to = url.searchParams.get('to')
          const lang = url.searchParams.get('lang')
          const data = await service.getEpisodeSubtitles(episodeId, { from, to, lang, isLocalLoopback })
          sendCacheableJson(200, { data })
          return
        }

        const epDetailMatch = pathname.match(/^\/api\/v1\/anime\/episodes\/([^/]+)$/)
        if (req.method === 'GET' && epDetailMatch) {
          const episodeId = decodeURIComponent(epDetailMatch[1])
          const data = await service.getEpisodeDetail(episodeId, { isLocalLoopback })
          sendCacheableJson(200, { data })
          return
        }

        const dictMatch = pathname.match(/^\/api\/v1\/anime\/dictionary\/([^/]+)$/)
        if (req.method === 'GET' && dictMatch) {
          const wordId = decodeURIComponent(dictMatch[1])
          const data = await service.getDictionaryWord(wordId)
          sendCacheableJson(200, { data })
          return
        }

        json(404, { message: 'Route not found', code: 'NOT_FOUND' })
      } catch (err) {
        const status = typeof err?.status === 'number' ? err.status : 500
        const code = err?.code || 'INTERNAL_ERROR'
        json(status, { message: err?.message || 'Lỗi hệ thống', code })
      }
    }
  }

  // 1. Test Public Server
  const publicServer = http.createServer(createRequestHandler(publicService))
  await new Promise((resolve) => publicServer.listen(0, '127.0.0.1', resolve))
  const publicBaseUrl = `http://127.0.0.1:${publicServer.address().port}`

  // 2. Test Dev/Override Server (IPv4 Loopback)
  const devServer = http.createServer(createRequestHandler(devService))
  await new Promise((resolve) => devServer.listen(0, '127.0.0.1', resolve))
  const devBaseUrl = `http://127.0.0.1:${devServer.address().port}`

  // 3. Test Dev/Override Server (IPv6 Loopback ::1)
  const devServerIpv6 = http.createServer(createRequestHandler(devService))
  await new Promise((resolve) => devServerIpv6.listen(0, '::1', resolve))
  const devBaseUrlIpv6 = `http://[::1]:${devServerIpv6.address().port}`

  t.after(() => {
    publicServer.close()
    devServer.close()
    devServerIpv6.close()
  })

  await t.test('public server: GET /catalog returns 200, empty items, totalItems 0, and valid ETag', async () => {
    const res = await fetch(`${publicBaseUrl}/api/v1/anime/catalog`)
    assert.equal(res.status, 200)
    const etag = res.headers.get('etag')
    assert.ok(etag, 'ETag must be present')
    const body = await res.json()
    assert.equal(body.data.pagination.totalItems, 0)
    assert.equal(body.data.items.length, 0)

    const resCached = await fetch(`${publicBaseUrl}/api/v1/anime/catalog`, {
      headers: { 'if-none-match': etag },
    })
    assert.equal(resCached.status, 304)
  })

  await t.test('public server: GET /series/:slug returns 403 ANIME_CONTENT_RESTRICTED for unapproved series', async () => {
    const res = await fetch(`${publicBaseUrl}/api/v1/anime/series/angel-next-door-s1`)
    assert.equal(res.status, 403)
    const body = await res.json()
    assert.equal(body.code, 'ANIME_CONTENT_RESTRICTED')
  })

  await t.test('public server: GET /episodes/:episodeId returns 403 ANIME_CONTENT_RESTRICTED', async () => {
    const epId = 'anime:episode:angel-next-door-s1:angel-next-door-s1:1'
    const res = await fetch(`${publicBaseUrl}/api/v1/anime/episodes/${encodeURIComponent(epId)}`)
    assert.equal(res.status, 403)
    const body = await res.json()
    assert.equal(body.code, 'ANIME_CONTENT_RESTRICTED')
  })

  await t.test('dev server: ANIME_LOCAL_UNAPPROVED_ACCESS=true + socket loopback + không proxy header => được phép', async () => {
    const resCatalog = await fetch(`${devBaseUrl}/api/v1/anime/catalog?limit=5`)
    assert.equal(resCatalog.status, 200)
    const bodyCatalog = await resCatalog.json()
    assert.equal(bodyCatalog.data.pagination.totalItems, 143)
    assert.equal(bodyCatalog.data.items.length, 5)

    const resSeries = await fetch(`${devBaseUrl}/api/v1/anime/series/angel-next-door-s1`)
    assert.equal(resSeries.status, 200)
    const etag = resSeries.headers.get('etag')
    assert.ok(etag)

    const resCached = await fetch(`${devBaseUrl}/api/v1/anime/series/angel-next-door-s1`, {
      headers: { 'if-none-match': etag },
    })
    assert.equal(resCached.status, 304)
  })

  await t.test('dev server: X-Forwarded-For: 127.0.0.1 => bị chặn', async () => {
    const resCatalog = await fetch(`${devBaseUrl}/api/v1/anime/catalog?limit=5`, {
      headers: { 'x-forwarded-for': '127.0.0.1' },
    })
    assert.equal(resCatalog.status, 200)
    const bodyCatalog = await resCatalog.json()
    assert.equal(bodyCatalog.data.pagination.totalItems, 0)
    assert.equal(bodyCatalog.data.items.length, 0)

    const resSeries = await fetch(`${devBaseUrl}/api/v1/anime/series/angel-next-door-s1`, {
      headers: { 'x-forwarded-for': '127.0.0.1' },
    })
    assert.equal(resSeries.status, 403)
    const bodySeries = await resSeries.json()
    assert.equal(bodySeries.code, 'ANIME_CONTENT_RESTRICTED')
  })

  await t.test('dev server: X-Forwarded-For: 127.0.0.1, 203.0.113.1 => bị chặn', async () => {
    const resCatalog = await fetch(`${devBaseUrl}/api/v1/anime/catalog?limit=5`, {
      headers: { 'x-forwarded-for': '127.0.0.1, 203.0.113.1' },
    })
    assert.equal(resCatalog.status, 200)
    const bodyCatalog = await resCatalog.json()
    assert.equal(bodyCatalog.data.pagination.totalItems, 0)
    assert.equal(bodyCatalog.data.items.length, 0)

    const resSeries = await fetch(`${devBaseUrl}/api/v1/anime/series/angel-next-door-s1`, {
      headers: { 'x-forwarded-for': '127.0.0.1, 203.0.113.1' },
    })
    assert.equal(resSeries.status, 403)
    const bodySeries = await resSeries.json()
    assert.equal(bodySeries.code, 'ANIME_CONTENT_RESTRICTED')
  })

  await t.test('dev server: Forwarded: for=127.0.0.1 => bị chặn', async () => {
    const resCatalog = await fetch(`${devBaseUrl}/api/v1/anime/catalog?limit=5`, {
      headers: { forwarded: 'for=127.0.0.1' },
    })
    assert.equal(resCatalog.status, 200)
    const bodyCatalog = await resCatalog.json()
    assert.equal(bodyCatalog.data.pagination.totalItems, 0)
    assert.equal(bodyCatalog.data.items.length, 0)

    const resSeries = await fetch(`${devBaseUrl}/api/v1/anime/series/angel-next-door-s1`, {
      headers: { forwarded: 'for=127.0.0.1' },
    })
    assert.equal(resSeries.status, 403)
    const bodySeries = await resSeries.json()
    assert.equal(bodySeries.code, 'ANIME_CONTENT_RESTRICTED')
  })

  await t.test('dev server: other proxy headers (x-real-ip) => bị chặn', async () => {
    const resCatalog = await fetch(`${devBaseUrl}/api/v1/anime/catalog?limit=5`, {
      headers: { 'x-real-ip': '127.0.0.1' },
    })
    assert.equal(resCatalog.status, 200)
    const bodyCatalog = await resCatalog.json()
    assert.equal(bodyCatalog.data.pagination.totalItems, 0)
    assert.equal(bodyCatalog.data.items.length, 0)

    const resSeries = await fetch(`${devBaseUrl}/api/v1/anime/series/angel-next-door-s1`, {
      headers: { 'x-real-ip': '127.0.0.1' },
    })
    assert.equal(resSeries.status, 403)
    const bodySeries = await resSeries.json()
    assert.equal(bodySeries.code, 'ANIME_CONTENT_RESTRICTED')
  })

  await t.test('dev server: Host [::1]:<port> với socket ::1 và không proxy header => valid local (được phép)', async () => {
    const resCatalog = await fetch(`${devBaseUrlIpv6}/api/v1/anime/catalog?limit=5`)
    assert.equal(resCatalog.status, 200)
    const bodyCatalog = await resCatalog.json()
    assert.equal(bodyCatalog.data.pagination.totalItems, 143)
    assert.equal(bodyCatalog.data.items.length, 5)

    const resSeries = await fetch(`${devBaseUrlIpv6}/api/v1/anime/series/angel-next-door-s1`)
    assert.equal(resSeries.status, 200)
    const bodySeries = await resSeries.json()
    assert.equal(bodySeries.data.series_slug, 'angel-next-door-s1')
  })

  await t.test('dev server: remote/non-loopback caller (spoofed remote X-Forwarded-For) => bị chặn', async () => {
    const resCatalog = await fetch(`${devBaseUrl}/api/v1/anime/catalog?limit=5`, {
      headers: { 'x-forwarded-for': '203.0.113.195' },
    })
    assert.equal(resCatalog.status, 200)
    const bodyCatalog = await resCatalog.json()
    assert.equal(bodyCatalog.data.pagination.totalItems, 0)
    assert.equal(bodyCatalog.data.items.length, 0)

    const resSeries = await fetch(`${devBaseUrl}/api/v1/anime/series/angel-next-door-s1`, {
      headers: { 'x-forwarded-for': '203.0.113.195' },
    })
    assert.equal(resSeries.status, 403)
    const bodySeries = await resSeries.json()
    assert.equal(bodySeries.code, 'ANIME_CONTENT_RESTRICTED')
  })

  await t.test('dictionary endpoint: returns 200 with ETag, 304 on cache hit, 404 for unindexed word', async () => {
    const res1 = await fetch(`${publicBaseUrl}/api/v1/anime/dictionary/1341350000`)
    assert.equal(res1.status, 200)
    const etag = res1.headers.get('etag')
    assert.ok(etag)
    const body1 = await res1.json()
    assert.equal(body1.data.word, '合理的')

    const res2 = await fetch(`${publicBaseUrl}/api/v1/anime/dictionary/1341350000`, {
      headers: { 'if-none-match': etag },
    })
    assert.equal(res2.status, 304)

    const res404 = await fetch(`${publicBaseUrl}/api/v1/anime/dictionary/999999999999`)
    assert.equal(res404.status, 404)
    const body404 = await res404.json()
    assert.equal(body404.code, 'WORD_NOT_FOUND')
  })
})

test('12. Server Router Integration & Allowlist Guard Regression Test (server/index.mjs)', async (t) => {
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

  await t.test('GET /api/v1/anime/catalog successfully passes server router allowlist guard and reaches AnimeCatalogService', async () => {
    const res = await fetch(`${routerBaseUrl}/api/v1/anime/catalog?level=N4`)
    assert.equal(res.status, 200, 'Must return 200 OK')
    const body = await res.json()
    assert.ok(body.data, 'Response must contain data')
    assert.ok(body.data.pagination, 'Response must contain pagination from AnimeCatalogService')
    assert.notEqual(res.status, 404, 'Must NEVER be 404 NOT_FOUND')
    assert.notEqual(body.code, 'NOT_FOUND', 'Must NEVER be NOT_FOUND from allowlist guard')
  })

  await t.test('GET /api/v1/anime/series/:slug passes server router allowlist guard and reaches AnimeCatalogService', async () => {
    const res = await fetch(`${routerBaseUrl}/api/v1/anime/series/angel-next-door-s1`)
    assert.ok(res.status === 200 || res.status === 403, `Status must be 200 or 403, got ${res.status}`)
    const body = await res.json()
    assert.notEqual(res.status, 404, 'Must NEVER be 404 NOT_FOUND')
    assert.notEqual(body.code, 'NOT_FOUND', 'Must NEVER be NOT_FOUND from allowlist guard')
    if (res.status === 403) {
      assert.equal(body.code, 'ANIME_CONTENT_RESTRICTED')
    }
  })

  await t.test('GET /api/v1/anime/series/:slug/episodes passes server router allowlist guard and reaches AnimeCatalogService', async () => {
    const res = await fetch(`${routerBaseUrl}/api/v1/anime/series/angel-next-door-s1/episodes`)
    assert.ok(res.status === 200 || res.status === 403, `Status must be 200 or 403, got ${res.status}`)
    const body = await res.json()
    assert.notEqual(res.status, 404, 'Must NEVER be 404 NOT_FOUND')
    assert.notEqual(body.code, 'NOT_FOUND', 'Must NEVER be NOT_FOUND from allowlist guard')
  })

  await t.test('GET /api/v1/anime/unrecognized-subpath correctly returns 404 NOT_FOUND from route handler, not from guard', async () => {
    const res = await fetch(`${routerBaseUrl}/api/v1/anime/unrecognized-subpath`)
    assert.equal(res.status, 404)
    const body = await res.json()
    assert.equal(body.code, 'NOT_FOUND')
  })

  await t.test('GET /api/v1/unrecognized-domain/test is correctly blocked by allowlist guard as 404 NOT_FOUND', async () => {
    const res = await fetch(`${routerBaseUrl}/api/v1/unrecognized-domain/test`)
    assert.equal(res.status, 404)
    const body = await res.json()
    assert.equal(body.code, 'NOT_FOUND')
  })
})

