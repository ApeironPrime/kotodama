import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

let DatabaseSync = null
try {
  const sqlite = await import('node:sqlite')
  DatabaseSync = sqlite.DatabaseSync
} catch {
  // node:sqlite is optional if running solely on PostgreSQL
}

export const VALID_JLPT_LEVELS = Object.freeze(new Set(['N5', 'N4', 'N3', 'N2', 'N1']))
export const VALID_SUBTITLE_LANGS = Object.freeze(new Set(['all', 'ja', 'vi']))
export const APPROVED_RIGHTS_STATUSES = Object.freeze(new Set(['approved']))

export const DEFAULT_ALLOWED_ANIME_HOSTS = Object.freeze(
  new Set([
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'youtu.be',
    'akaiwa.tv',
    'www.akaiwa.tv',
  ])
)

export const ALLOWED_YOUTUBE_HOSTS = Object.freeze(
  new Set([
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'youtu.be',
  ])
)

export function isEnabled(value) {
  return String(value ?? '').trim().toLowerCase() === 'true'
}

export function isLocalLoopbackAddress(ipOrHost) {
  if (!ipOrHost || typeof ipOrHost !== 'string') return false
  let clean = ipOrHost.trim().toLowerCase()
  if (clean.startsWith('[') && clean.includes(']')) {
    clean = clean.slice(1, clean.indexOf(']'))
  } else if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$/.test(clean) || /^localhost:\d+$/.test(clean)) {
    clean = clean.split(':')[0]
  }
  return (
    clean === '127.0.0.1' ||
    clean === 'localhost' ||
    clean === '::1' ||
    clean === '::ffff:127.0.0.1' ||
    clean === '0:0:0:0:0:0:0:1' ||
    clean.startsWith('127.')
  )
}

export const PROXY_FORWARDING_HEADERS = Object.freeze([
  'x-forwarded-for',
  'forwarded',
  'x-real-ip',
  'x-forwarded-host',
  'x-forwarded-proto',
])

/**
 * Validates whether an incoming HTTP request is a direct connection from a local loopback client.
 * Fail-closed when request has ANY proxy-forwarding header (Forwarded, X-Forwarded-For, etc.).
 * Local-owner override is strictly for direct loopback connections, never supported via reverse proxy.
 * Only inspects request.socket.remoteAddress after confirming no proxy-forwarding header is present.
 * Parses Host header cleanly for bracketed IPv6 ([::1]:port) without naive split(':')[0].
 * @param {import('node:http').IncomingMessage | any} request
 * @returns {boolean}
 */
export function isRequestLocalLoopback(request) {
  if (!request) return false

  const rawHeaders = request.headers || {}
  const headerKeys = Object.keys(rawHeaders).map((k) => k.toLowerCase())

  // 1. Fail-closed if ANY proxy forwarding header is present
  for (const proxyHeader of PROXY_FORWARDING_HEADERS) {
    if (headerKeys.includes(proxyHeader)) {
      return false
    }
  }

  // 2. Only rely on request.socket.remoteAddress after confirming no proxy headers
  const remoteAddress = request.socket?.remoteAddress
  if (!remoteAddress || !isLocalLoopbackAddress(remoteAddress)) {
    return false
  }

  // 3. Parse Host header cleanly for IPv4, localhost, and bracketed IPv6 ([::1]:port)
  const rawHost = rawHeaders.host
  if (!rawHost || typeof rawHost !== 'string') {
    return false
  }

  const hostCandidate = rawHost.trim().toLowerCase()
  if (hostCandidate.startsWith('[')) {
    const closingIndex = hostCandidate.indexOf(']')
    if (closingIndex === -1) return false
    const hostIpv6 = hostCandidate.slice(1, closingIndex)
    const portPart = hostCandidate.slice(closingIndex + 1)
    if (portPart && !/^:\d+$/.test(portPart)) {
      return false
    }
    return isLocalLoopbackAddress(hostIpv6)
  }

  const colonCount = (hostCandidate.match(/:/g) || []).length
  if (colonCount === 1) {
    const [hostname, port] = hostCandidate.split(':')
    if (!/^\d+$/.test(port)) return false
    return isLocalLoopbackAddress(hostname)
  } else if (colonCount === 0) {
    return isLocalLoopbackAddress(hostCandidate)
  }

  return false
}

export function isPrivateOrLoopbackHost(hostname) {
  if (!hostname || typeof hostname !== 'string') return true
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '')

  // localhost
  if (host === 'localhost' || host.endsWith('.localhost')) return true

  // IPv4 Loopback: 127.0.0.0/8
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true

  // IPv4 0.0.0.0/8
  if (/^0\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true

  // IPv4 Private: 10.0.0.0/8
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true

  // IPv4 Private: 172.16.0.0/12
  const m172 = host.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/)
  if (m172) {
    const second = Number(m172[1])
    if (second >= 16 && second <= 31) return true
  }

  // IPv4 Private: 192.168.0.0/16
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true

  // IPv4 Link-local: 169.254.0.0/16
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(host)) return true

  // IPv6 Loopback: ::1
  if (host === '::1' || host === '0:0:0:0:0:0:0:1') return true

  // IPv6 Unspecified: ::
  if (host === '::' || host === '0:0:0:0:0:0:0:0') return true

  // IPv6 Link-local: fe80::/10
  if (/^fe[89ab]/i.test(host)) return true

  // IPv6 Unique Local Address (ULA): fc00::/7
  if (/^f[cd][0-9a-f]{2}:/i.test(host)) return true

  // IPv4-mapped IPv6: ::ffff:127.0.0.1 etc
  if (host.startsWith('::ffff:')) {
    const v4 = host.slice(7)
    return isPrivateOrLoopbackHost(v4)
  }

  return false
}

export function sanitizeSafePageUrl(rawUrl, { sourceType, mediaId, allowedHosts = DEFAULT_ALLOWED_ANIME_HOSTS } = {}) {
  if (!rawUrl || typeof rawUrl !== 'string') return null
  const trimmed = rawUrl.trim()
  if (!trimmed) return null

  // Must parse as a valid URL
  let parsed
  try {
    parsed = new URL(trimmed)
  } catch {
    return null
  }

  // Strictly HTTPS only (rejects http, javascript, data, file, ftp, etc.)
  if (parsed.protocol !== 'https:') {
    return null
  }

  const hostname = parsed.hostname.toLowerCase()
  if (!hostname) return null

  // Reject localhost, private/loopback/link-local IP, IPv6 nội bộ
  if (isPrivateOrLoopbackHost(hostname)) {
    return null
  }

  // Reject hostnames not in allowlist
  if (!allowedHosts.has(hostname)) {
    return null
  }

  // YouTube validation: must match mediaId
  if (sourceType === 'youtube') {
    if (!ALLOWED_YOUTUBE_HOSTS.has(hostname)) {
      return null
    }

    if (!mediaId || typeof mediaId !== 'string') {
      return null
    }
    const cleanMediaId = mediaId.trim()
    if (!/^[a-zA-Z0-9_-]{11}$/.test(cleanMediaId)) {
      return null
    }

    if (hostname === 'youtu.be') {
      const pathId = parsed.pathname.replace(/^\//, '').split('/')[0]
      if (pathId !== cleanMediaId) {
        return null
      }
    } else {
      const vParam = parsed.searchParams.get('v')
      if (vParam) {
        if (vParam !== cleanMediaId) {
          return null
        }
      } else if (parsed.pathname.startsWith('/embed/')) {
        const embedId = parsed.pathname.split('/')[2]
        if (embedId !== cleanMediaId) {
          return null
        }
      } else if (parsed.pathname.startsWith('/v/')) {
        const vId = parsed.pathname.split('/')[2]
        if (vId !== cleanMediaId) {
          return null
        }
      } else {
        return null
      }
    }

    return `https://www.youtube.com/watch?v=${cleanMediaId}`
  }

  // external_page: safe external redirect link
  if (sourceType === 'external_page') {
    return parsed.href
  }

  return parsed.href
}

/**
 * Custom application error class for Anime Catalog API
 */
export class AnimeApiError extends Error {
  /**
   * @param {number} status HTTP status code (400, 403, 404, 500, etc.)
   * @param {string} code Unique application error code
   * @param {string} message User-friendly error message
   */
  constructor(status, code, message) {
    super(message)
    this.name = 'AnimeApiError'
    this.status = status
    this.code = code
  }
}

/**
 * Validates and sanitizes pagination parameters.
 * @param {any} pageParam
 * @param {any} limitParam
 * @param {number} defaultLimit
 * @param {number} maxLimit
 * @returns {{ page: number, limit: number, offset: number }}
 */
export function sanitizePagination(pageParam, limitParam, defaultLimit = 20, maxLimit = 100) {
  let page = pageParam === undefined || pageParam === null || pageParam === '' ? 1 : Number(pageParam)
  let limit = limitParam === undefined || limitParam === null || limitParam === '' ? defaultLimit : Number(limitParam)

  if (!Number.isInteger(page) || page < 1) {
    throw new AnimeApiError(400, 'INVALID_PAGE', 'Trang yêu cầu (page) phải là số nguyên dương >= 1.')
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > maxLimit) {
    throw new AnimeApiError(400, 'INVALID_LIMIT', `Giới hạn (limit) phải là số nguyên từ 1 đến ${maxLimit}.`)
  }

  return { page, limit, offset: (page - 1) * limit }
}

/**
 * Validates and normalizes slug parameter (strictly alphanumeric + hyphens, no traversal).
 * @param {any} slugParam
 * @returns {string}
 */
export function sanitizeSlug(slugParam) {
  if (typeof slugParam !== 'string' || !slugParam.trim()) {
    throw new AnimeApiError(400, 'INVALID_SLUG', 'Slug không được để trống.')
  }
  const normalized = slugParam.trim().toLowerCase()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    throw new AnimeApiError(
      400,
      'INVALID_SLUG',
      'Slug không hợp lệ. Chỉ chấp nhận chữ cái thường (a-z), chữ số (0-9) và dấu gạch ngang (-).'
    )
  }
  if (normalized.length > 120) {
    throw new AnimeApiError(400, 'INVALID_SLUG', 'Slug không được vượt quá 120 ký tự.')
  }
  return normalized
}

/**
 * Validates and normalizes canonical episode ID.
 * @param {any} episodeIdParam
 * @returns {string}
 */
export function sanitizeEpisodeId(episodeIdParam) {
  if (typeof episodeIdParam !== 'string' || !episodeIdParam.trim()) {
    throw new AnimeApiError(400, 'INVALID_EPISODE_ID', 'Mã tập phim (episodeId) không được để trống.')
  }
  const trimmed = episodeIdParam.trim()
  if (!/^anime:episode:[a-z0-9-]+:[a-z0-9-]+:\d+$/.test(trimmed)) {
    throw new AnimeApiError(
      400,
      'INVALID_EPISODE_ID',
      'Mã tập phim (episodeId) không đúng định dạng chuẩn (anime:episode:<series>:<season>:<number>).'
    )
  }
  return trimmed
}

/**
 * Validates and normalizes JLPT level parameter.
 * @param {any} levelParam
 * @returns {string | null}
 */
export function sanitizeLevel(levelParam) {
  if (!levelParam || typeof levelParam !== 'string' || !levelParam.trim()) {
    return null
  }
  const normalized = levelParam.trim().toUpperCase()
  if (normalized === 'ALL') {
    return null
  }
  if (!VALID_JLPT_LEVELS.has(normalized)) {
    throw new AnimeApiError(
      400,
      'INVALID_LEVEL',
      `Cấp độ JLPT không hợp lệ: "${levelParam}". Các cấp độ được hỗ trợ: N5, N4, N3, N2, N1.`
    )
  }
  return normalized
}

/**
 * Sanitizes search query string.
 * @param {any} queryParam
 * @returns {string | null}
 */
export function sanitizeQuery(queryParam) {
  if (queryParam === undefined || queryParam === null) return null
  if (typeof queryParam !== 'string') {
    throw new AnimeApiError(400, 'INVALID_QUERY', 'Tham số tìm kiếm (q) phải là chuỗi văn bản.')
  }
  // Strip null bytes and control characters (ASCII < 32 and 127)
  let cleaned = ''
  for (let i = 0; i < queryParam.length; i++) {
    const code = queryParam.charCodeAt(i)
    if (code >= 32 && code !== 127) {
      cleaned += queryParam[i]
    }
  }
  cleaned = cleaned.trim()
  if (!cleaned) return null
  if (cleaned.length > 100) {
    throw new AnimeApiError(400, 'INVALID_QUERY', 'Từ khóa tìm kiếm không được vượt quá 100 ký tự.')
  }
  return cleaned
}

/**
 * Validates and sanitizes time window for subtitles.
 * @param {any} fromParam
 * @param {any} toParam
 * @param {number} defaultWindowSec
 * @param {number} maxWindowSec
 * @returns {{ from: number, to: number }}
 */
export function sanitizeTimeWindow(fromParam, toParam, defaultWindowSec = 120, maxWindowSec = 600) {
  let from = fromParam === undefined || fromParam === null || fromParam === '' ? 0 : Number(fromParam)
  if (!Number.isFinite(from) || from < 0) {
    throw new AnimeApiError(400, 'INVALID_TIME_RANGE', 'Thời điểm bắt đầu (from) phải là số thực >= 0.')
  }

  let to
  if (toParam === undefined || toParam === null || toParam === '') {
    to = from + defaultWindowSec
  } else {
    to = Number(toParam)
    if (!Number.isFinite(to) || to < 0) {
      throw new AnimeApiError(400, 'INVALID_TIME_RANGE', 'Thời điểm kết thúc (to) phải là số thực >= 0.')
    }
    if (to < from) {
      throw new AnimeApiError(400, 'INVALID_TIME_RANGE', 'Thời điểm kết thúc (to) phải lớn hơn hoặc bằng thời điểm bắt đầu (from).')
    }
    if (to - from > maxWindowSec) {
      throw new AnimeApiError(
        400,
        'WINDOW_TOO_LARGE',
        `Khoảng thời gian yêu cầu (${(to - from).toFixed(1)}s) vượt quá giới hạn tối đa cho phép (${maxWindowSec}s).`
      )
    }
  }

  return { from, to }
}

/**
 * Validates wordId parameter.
 * @param {any} wordIdParam
 * @returns {string}
 */
export function sanitizeWordId(wordIdParam) {
  if (wordIdParam === undefined || wordIdParam === null) {
    throw new AnimeApiError(400, 'INVALID_WORD_ID', 'Mã từ vựng (wordId) không được để trống.')
  }
  const str = String(wordIdParam).trim()
  if (!/^\d{1,15}$/.test(str)) {
    throw new AnimeApiError(
      400,
      'INVALID_WORD_ID',
      'Mã từ vựng (wordId) phải là số nguyên dương hợp lệ.'
    )
  }
  return str
}

/**
 * Generates an HTTP ETag string for response payloads
 * @param {any} data
 * @returns {string}
 */
export function generateETag(data) {
  const content = typeof data === 'string' ? data : JSON.stringify(data)
  const hash = crypto.createHash('sha1').update(content).digest('hex')
  return `"${hash}"`
}

/**
 * Service class implementing all Catalog, Series, Episode, Subtitles, and Dictionary business logic
 */
export class AnimeCatalogService {
  /**
   * @param {{
   *   storage?: 'sqlite' | 'postgres' | 'postgresql',
   *   db?: any,
   *   pool?: any,
   *   sqlitePath?: string,
   *   dictionaryDir?: string,
   *   allowUnapprovedContent?: boolean,
   *   allowedHosts?: Set<string>
   * }} [options]
   */
  constructor(options = {}) {
    const rawStorage = options.storage || process.env.ANIME_STORAGE || 'sqlite'
    const normalizedStorage = String(rawStorage).trim().toLowerCase()

    this.dictionaryDir = options.dictionaryDir || path.resolve('D:/Project/data/aanime_scraper/dictionary/shards')
    this._shardCache = new Map() // simple LRU cache for dictionary shards
    this._maxShardCacheSize = 40

    // Fail-closed local owner override for reviewing unapproved anime imports
    this.allowUnapprovedContent =
      options.allowUnapprovedContent === true ||
      (process.env.NODE_ENV !== 'production' && isEnabled(process.env.ANIME_LOCAL_UNAPPROVED_ACCESS))
    this.allowedHosts = options.allowedHosts || DEFAULT_ALLOWED_ANIME_HOSTS

    if (normalizedStorage === 'postgres' || normalizedStorage === 'postgresql') {
      this.storage = 'postgres'
      this.pool = options.pool || null
      this.db = null
      this.sqlitePath = null
    } else if (normalizedStorage === 'sqlite') {
      this.storage = 'sqlite'
      this.pool = null
      this.sqlitePath = options.sqlitePath || process.env.ANIME_SQLITE_PATH || path.resolve('tmp/anime/anime.db')

      if (options.db) {
        this.db = options.db
      } else if (DatabaseSync) {
        if (fs.existsSync(this.sqlitePath)) {
          try {
            this.db = new DatabaseSync(this.sqlitePath, { readOnly: true })
          } catch (err) {
            console.warn(`[AnimeCatalogService] Could not open SQLite at ${this.sqlitePath}:`, err.message)
            this.db = null
          }
        } else {
          this.db = null
        }
      } else {
        this.db = null
      }
    } else {
      throw new Error(`[AnimeCatalogService] Invalid ANIME_STORAGE '${rawStorage}'. Supported: 'sqlite' | 'postgres'.`)
    }
  }

  /**
   * Evaluates if a series is readable under current rights policy.
   * Public users can only read approved series.
   * Local owner override requires explicit switch AND loopback request.
   * @param {{ rights_status?: string } | null | undefined} series
   * @param {{ isLocalLoopback?: boolean }} [context]
   * @returns {boolean}
   */
  canReadSeries(series, { isLocalLoopback = false } = {}) {
    if (!series) return false
    if (series.rights_status === 'approved') return true
    if (this.allowUnapprovedContent && isLocalLoopback) return true
    return false
  }

  /**
   * Returns current active storage type ('sqlite' | 'postgres').
   */
  getStorageType() {
    return this.storage
  }

  /**
   * Returns true if database connection is available.
   */
  isAvailable() {
    if (this.storage === 'postgres') return Boolean(this.pool)
    if (this.storage === 'sqlite') return Boolean(this.db)
    return false
  }

  /**
   * Internal query runner for multiple rows without N+1.
   * @param {string} sqlSQLite
   * @param {string} sqlPostgres
   * @param {any[]} params
   * @returns {Promise<any[]>}
   */
  async queryAll(sqlSQLite, sqlPostgres, params = [], paramsPG = null) {
    if (this.storage === 'sqlite') {
      if (!this.db) {
        throw new AnimeApiError(
          503,
          'ANIME_STORAGE_UNAVAILABLE',
          `Cơ sở dữ liệu Anime SQLite chưa sẵn sàng tại ${this.sqlitePath || 'tmp/anime/anime.db'}. Vui lòng chạy 'npm run anime:ingest' trước.`
        )
      }
      const stmt = this.db.prepare(sqlSQLite)
      return stmt.all(...params)
    }

    if (this.storage === 'postgres') {
      if (!this.pool) {
        throw new AnimeApiError(503, 'ANIME_STORAGE_UNAVAILABLE', 'Cơ sở dữ liệu Anime PostgreSQL chưa được kết nối.')
      }
      const res = await this.pool.query(sqlPostgres, paramsPG || params)
      return res.rows
    }

    throw new AnimeApiError(503, 'SERVICE_UNAVAILABLE', 'Cơ sở dữ liệu Anime chưa sẵn sàng.')
  }

  /**
   * Internal single row query runner.
   * @param {string} sqlSQLite
   * @param {string} sqlPostgres
   * @param {any[]} params
   * @param {any[] | null} paramsPG
   * @returns {Promise<any | null>}
   */
  async queryOne(sqlSQLite, sqlPostgres, params = [], paramsPG = null) {
    const rows = await this.queryAll(sqlSQLite, sqlPostgres, params, paramsPG)
    return rows.length > 0 ? rows[0] : null
  }

  /**
   * GET /api/v1/anime/catalog?q=&level=&genre=&page=&limit=
   * Paginated anime catalog browsing and search with index usage.
   * Public users can only see approved anime; unapproved anime require explicit local owner override.
   */
  async getCatalog({ q, level, genre, page = 1, limit = 20, isLocalLoopback = false } = {}) {
    const { page: validPage, limit: validLimit, offset } = sanitizePagination(page, limit, 20, 100)
    const validLevel = sanitizeLevel(level)
    const validQuery = sanitizeQuery(q)
    const validGenre = typeof genre === 'string' && genre.trim() ? genre.trim().slice(0, 50) : null

    const conditionsSQLite = []
    const conditionsPG = []
    const params = []

    // Public API only returns series with approved rights.
    // Local owner/dev override requires explicit switch AND loopback request.
    const isOverrideActive = this.allowUnapprovedContent && isLocalLoopback
    if (!isOverrideActive) {
      conditionsSQLite.push("s.rights_status = 'approved'")
      conditionsPG.push("s.rights_status = 'approved'")
    }

    if (validLevel) {
      params.push(validLevel)
      conditionsSQLite.push('s.jlpt_level = ?')
      conditionsPG.push(`s.jlpt_level = $${params.length}`)
    }

    if (validGenre) {
      params.push(validGenre)
      conditionsSQLite.push('s.category = ?')
      conditionsPG.push(`s.category = $${params.length}`)
    }

    if (validQuery) {
      const qPattern = `%${validQuery}%`
      const p1 = params.length + 1
      const p2 = params.length + 2
      const p3 = params.length + 3
      params.push(qPattern, qPattern, qPattern)
      conditionsSQLite.push('(s.title_vi LIKE ? OR s.title_ja LIKE ? OR s.description LIKE ?)')
      conditionsPG.push(`(s.title_vi ILIKE $${p1} OR s.title_ja ILIKE $${p2} OR s.description ILIKE $${p3})`)
    }

    const whereClauseSQLite = conditionsSQLite.length ? `WHERE ${conditionsSQLite.join(' AND ')}` : ''
    const whereClausePG = conditionsPG.length ? `WHERE ${conditionsPG.join(' AND ')}` : ''

    const countSqlSQLite = `SELECT count(*) as total FROM anime_series s ${whereClauseSQLite}`
    const countSqlPG = `SELECT count(*) as total FROM anime_series s ${whereClausePG}`
    const countRow = await this.queryOne(countSqlSQLite, countSqlPG, params)
    const totalItems = Number(countRow?.total || 0)
    const totalPages = Math.ceil(totalItems / validLimit) || 0

    if (totalItems === 0) {
      return {
        items: [],
        pagination: {
          page: validPage,
          limit: validLimit,
          totalItems: 0,
          totalPages: 0,
        },
      }
    }

    const selectParams = [...params]
    const selectSqlSQLite = `
      SELECT
        s.series_id,
        s.series_slug,
        s.master_slug,
        s.title_vi,
        s.title_ja,
        s.description,
        s.poster_url,
        s.category,
        s.jlpt_level,
        s.channel,
        s.video_source,
        s.total_episodes,
        s.rights_status,
        s.updated_at,
        (SELECT count(*) FROM anime_seasons sn WHERE sn.series_id = s.series_id) AS season_count,
        (SELECT count(*) FROM anime_episodes ep WHERE ep.series_id = s.series_id AND ep.has_subtitles = 1) AS subbed_episodes_count
      FROM anime_series s
      ${whereClauseSQLite}
      ORDER BY s.series_slug ASC
      LIMIT ? OFFSET ?
    `

    const limitParamIdx = selectParams.length + 1
    const offsetParamIdx = selectParams.length + 2
    const selectSqlPG = `
      SELECT
        s.series_id,
        s.series_slug,
        s.master_slug,
        s.title_vi,
        s.title_ja,
        s.description,
        s.poster_url,
        s.category,
        s.jlpt_level,
        s.channel,
        s.video_source,
        s.total_episodes,
        s.rights_status,
        s.updated_at,
        (SELECT count(*) FROM anime_seasons sn WHERE sn.series_id = s.series_id) AS season_count,
        (SELECT count(*) FROM anime_episodes ep WHERE ep.series_id = s.series_id AND ep.has_subtitles = 1) AS subbed_episodes_count
      FROM anime_series s
      ${whereClausePG}
      ORDER BY s.series_slug ASC
      LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}
    `

    const items = await this.queryAll(selectSqlSQLite, selectSqlPG, [...selectParams, validLimit, offset])

    return {
      items: items.map((r) => ({
        series_id: r.series_id,
        series_slug: r.series_slug,
        master_slug: r.master_slug || null,
        title_vi: r.title_vi,
        title_ja: r.title_ja || null,
        description: r.description || '',
        poster_url: r.poster_url || null,
        category: r.category || null,
        jlpt_level: r.jlpt_level || null,
        channel: r.channel || null,
        video_source: r.video_source || null,
        total_episodes: Number(r.total_episodes || 0),
        season_count: Number(r.season_count || 0),
        subbed_episodes_count: Number(r.subbed_episodes_count || 0),
        rights_status: r.rights_status,
        updated_at: r.updated_at,
      })),
      pagination: {
        page: validPage,
        limit: validLimit,
        totalItems,
        totalPages,
      },
    }
  }

  /**
   * GET /api/v1/anime/series/:slug
   * Full metadata and season breakdown for a single anime series.
   */
  async getSeriesDetail(slug, { isLocalLoopback = false } = {}) {
    const validSlug = sanitizeSlug(slug)

    const seriesSqlSQLite = `SELECT * FROM anime_series WHERE series_slug = ?`
    const seriesSqlPG = `SELECT * FROM anime_series WHERE series_slug = $1`
    const series = await this.queryOne(seriesSqlSQLite, seriesSqlPG, [validSlug])

    if (!series) {
      throw new AnimeApiError(404, 'SERIES_NOT_FOUND', `Không tìm thấy anime series với slug '${validSlug}'.`)
    }

    if (!this.canReadSeries(series, { isLocalLoopback })) {
      throw new AnimeApiError(
        403,
        'ANIME_CONTENT_RESTRICTED',
        'Bộ anime này đang bị hạn chế truy cập do chưa được duyệt bản quyền.'
      )
    }

    const seasonsSqlSQLite = `
      SELECT
        sn.season_id,
        sn.series_id,
        sn.series_slug,
        sn.season_slug,
        sn.season_ordinal,
        sn.season_label,
        sn.title_vi,
        sn.total_episodes,
        (SELECT count(*) FROM anime_episodes ep WHERE ep.season_id = sn.season_id) AS actual_episodes_count,
        (SELECT count(*) FROM anime_episodes ep WHERE ep.season_id = sn.season_id AND ep.has_subtitles = 1) AS subbed_episodes_count
      FROM anime_seasons sn
      WHERE sn.series_id = ?
      ORDER BY sn.season_ordinal ASC
    `
    const seasonsSqlPG = `
      SELECT
        sn.season_id,
        sn.series_id,
        sn.series_slug,
        sn.season_slug,
        sn.season_ordinal,
        sn.season_label,
        sn.title_vi,
        sn.total_episodes,
        (SELECT count(*) FROM anime_episodes ep WHERE ep.season_id = sn.season_id) AS actual_episodes_count,
        (SELECT count(*) FROM anime_episodes ep WHERE ep.season_id = sn.season_id AND ep.has_subtitles = 1) AS subbed_episodes_count
      FROM anime_seasons sn
      WHERE sn.series_id = $1
      ORDER BY sn.season_ordinal ASC
    `
    const seasons = await this.queryAll(seasonsSqlSQLite, seasonsSqlPG, [series.series_id])

    return {
      series_id: series.series_id,
      series_slug: series.series_slug,
      master_slug: series.master_slug || null,
      title_vi: series.title_vi,
      title_ja: series.title_ja || null,
      description: series.description || '',
      poster_url: series.poster_url || null,
      category: series.category || null,
      jlpt_level: series.jlpt_level || null,
      channel: series.channel || null,
      video_source: series.video_source || null,
      total_episodes: Number(series.total_episodes || 0),
      rights_status: series.rights_status,
      created_at: series.created_at,
      updated_at: series.updated_at,
      seasons: seasons.map((sn) => ({
        season_id: sn.season_id,
        series_slug: sn.series_slug,
        season_slug: sn.season_slug,
        season_ordinal: Number(sn.season_ordinal),
        season_label: sn.season_label || null,
        title_vi: sn.title_vi,
        total_episodes: Number(sn.total_episodes || 0),
        actual_episodes_count: Number(sn.actual_episodes_count || 0),
        subbed_episodes_count: Number(sn.subbed_episodes_count || 0),
      })),
    }
  }

  /**
   * GET /api/v1/anime/series/:slug/episodes?page=&limit=
   * Paginated episode list for a series with media source & subtitle track overview.
   */
  async getSeriesEpisodes(slug, { page = 1, limit = 50, isLocalLoopback = false } = {}) {
    const validSlug = sanitizeSlug(slug)
    const { page: validPage, limit: validLimit, offset } = sanitizePagination(page, limit, 50, 100)

    // Verify series exists and is readable under rights policy
    const seriesSqlSQLite = `SELECT series_id, series_slug, rights_status FROM anime_series WHERE series_slug = ?`
    const seriesSqlPG = `SELECT series_id, series_slug, rights_status FROM anime_series WHERE series_slug = $1`
    const series = await this.queryOne(seriesSqlSQLite, seriesSqlPG, [validSlug])
    if (!series) {
      throw new AnimeApiError(404, 'SERIES_NOT_FOUND', `Không tìm thấy anime series với slug '${validSlug}'.`)
    }

    if (!this.canReadSeries(series, { isLocalLoopback })) {
      throw new AnimeApiError(
        403,
        'ANIME_CONTENT_RESTRICTED',
        'Danh sách tập của anime này đang bị hạn chế truy cập do chưa được duyệt bản quyền.'
      )
    }

    const countSqlSQLite = `SELECT count(*) as total FROM anime_episodes WHERE series_slug = ?`
    const countSqlPG = `SELECT count(*) as total FROM anime_episodes WHERE series_slug = $1`
    const countRow = await this.queryOne(countSqlSQLite, countSqlPG, [validSlug])
    const totalItems = Number(countRow?.total || 0)
    const totalPages = Math.ceil(totalItems / validLimit) || (totalItems === 0 ? 0 : 1)

    const episodesSqlSQLite = `
      SELECT
        ep.episode_id,
        ep.series_id,
        ep.season_id,
        ep.series_slug,
        ep.season_slug,
        ep.episode_number,
        ep.title,
        ep.has_subtitles,
        sn.season_ordinal,
        sn.season_label,
        ms.source_type,
        ms.media_id,
        ms.playback_allowed,
        ms.rights_status as media_rights_status,
        st.cue_count,
        st.token_count,
        st.languages
      FROM anime_episodes ep
      LEFT JOIN anime_seasons sn ON sn.season_id = ep.season_id
      LEFT JOIN anime_media_sources ms ON ms.episode_id = ep.episode_id
      LEFT JOIN anime_subtitle_tracks st ON st.episode_id = ep.episode_id
      WHERE ep.series_slug = ?
      ORDER BY sn.season_ordinal ASC, ep.episode_number ASC
      LIMIT ? OFFSET ?
    `
    const episodesSqlPG = `
      SELECT
        ep.episode_id,
        ep.series_id,
        ep.season_id,
        ep.series_slug,
        ep.season_slug,
        ep.episode_number,
        ep.title,
        ep.has_subtitles,
        sn.season_ordinal,
        sn.season_label,
        ms.source_type,
        ms.media_id,
        ms.playback_allowed,
        ms.rights_status as media_rights_status,
        st.cue_count,
        st.token_count,
        st.languages
      FROM anime_episodes ep
      LEFT JOIN anime_seasons sn ON sn.season_id = ep.season_id
      LEFT JOIN anime_media_sources ms ON ms.episode_id = ep.episode_id
      LEFT JOIN anime_subtitle_tracks st ON st.episode_id = ep.episode_id
      WHERE ep.series_slug = $1
      ORDER BY sn.season_ordinal ASC, ep.episode_number ASC
      LIMIT $2 OFFSET $3
    `
    const rows = await this.queryAll(episodesSqlSQLite, episodesSqlPG, [validSlug, validLimit, offset])

    const items = rows.map((r) => {
      const isPlayable = Boolean(r.playback_allowed) && (r.source_type === 'youtube' || r.source_type === 'authorized_local')
      return {
        episode_id: r.episode_id,
        series_slug: r.series_slug,
        season_slug: r.season_slug,
        season_ordinal: Number(r.season_ordinal || 1),
        season_label: r.season_label || null,
        episode_number: Number(r.episode_number),
        title: r.title || null,
        has_subtitles: Boolean(r.has_subtitles),
        source_type: r.source_type || 'unavailable',
        playback_allowed: isPlayable,
        cue_count: Number(r.cue_count || 0),
        token_count: Number(r.token_count || 0),
      }
    })

    return {
      series_slug: validSlug,
      items,
      pagination: {
        page: validPage,
        limit: validLimit,
        totalItems,
        totalPages,
      },
    }
  }

  /**
   * GET /api/v1/anime/episodes/:episodeId
   * Episode detail with safe media source & subtitle track metadata.
   */
  async getEpisodeDetail(episodeId, { isLocalLoopback = false } = {}) {
    const validId = sanitizeEpisodeId(episodeId)

    const sqlSQLite = `
      SELECT
        ep.episode_id,
        ep.series_id,
        ep.season_id,
        ep.series_slug,
        ep.season_slug,
        ep.episode_number,
        ep.title,
        ep.has_subtitles,
        s.rights_status as series_rights_status,
        s.title_vi as series_title_vi,
        s.title_ja as series_title_ja,
        sn.season_ordinal,
        sn.season_label,
        sn.title_vi as season_title_vi,
        ms.source_id,
        ms.source_type,
        ms.media_id,
        ms.page_url,
        ms.playback_allowed,
        ms.rights_status as media_rights_status,
        st.track_id,
        st.languages,
        st.cue_count,
        st.token_count,
        st.word_linked_token_count
      FROM anime_episodes ep
      JOIN anime_series s ON s.series_id = ep.series_id
      LEFT JOIN anime_seasons sn ON sn.season_id = ep.season_id
      LEFT JOIN anime_media_sources ms ON ms.episode_id = ep.episode_id
      LEFT JOIN anime_subtitle_tracks st ON st.episode_id = ep.episode_id
      WHERE ep.episode_id = ?
    `
    const sqlPG = `
      SELECT
        ep.episode_id,
        ep.series_id,
        ep.season_id,
        ep.series_slug,
        ep.season_slug,
        ep.episode_number,
        ep.title,
        ep.has_subtitles,
        s.rights_status as series_rights_status,
        s.title_vi as series_title_vi,
        s.title_ja as series_title_ja,
        sn.season_ordinal,
        sn.season_label,
        sn.title_vi as season_title_vi,
        ms.source_id,
        ms.source_type,
        ms.media_id,
        ms.page_url,
        ms.playback_allowed,
        ms.rights_status as media_rights_status,
        st.track_id,
        st.languages,
        st.cue_count,
        st.token_count,
        st.word_linked_token_count
      FROM anime_episodes ep
      JOIN anime_series s ON s.series_id = ep.series_id
      LEFT JOIN anime_seasons sn ON sn.season_id = ep.season_id
      LEFT JOIN anime_media_sources ms ON ms.episode_id = ep.episode_id
      LEFT JOIN anime_subtitle_tracks st ON st.episode_id = ep.episode_id
      WHERE ep.episode_id = $1
    `
    const r = await this.queryOne(sqlSQLite, sqlPG, [validId])
    if (!r) {
      throw new AnimeApiError(404, 'EPISODE_NOT_FOUND', `Không tìm thấy tập phim với mã ID '${validId}'.`)
    }

    if (!this.canReadSeries({ rights_status: r.series_rights_status }, { isLocalLoopback })) {
      throw new AnimeApiError(
        403,
        'ANIME_CONTENT_RESTRICTED',
        'Tập phim này đang bị hạn chế truy cập do chưa được duyệt bản quyền.'
      )
    }

    // Streaming policy & Safe URL enforcement:
    // 1. stream_url is NEVER returned (null/omitted).
    // 2. external_page is strictly playback_allowed: false and media_id: null; unsafe page_url becomes null.
    // 3. youtube/authorized_local only playback_allowed if explicitly allowed and url is safe.
    let mediaSource = null
    if (r.source_type) {
      const safePageUrl = sanitizeSafePageUrl(r.page_url, {
        sourceType: r.source_type,
        mediaId: r.media_id,
        allowedHosts: this.allowedHosts,
      })

      if (r.source_type === 'youtube') {
        const isPlayable = Boolean(r.playback_allowed) && Boolean(safePageUrl)
        mediaSource = {
          source_type: 'youtube',
          media_id: isPlayable ? r.media_id : null,
          page_url: safePageUrl,
          playback_allowed: isPlayable,
          rights_status: r.media_rights_status || 'unknown',
        }
      } else if (r.source_type === 'authorized_local') {
        const isPlayable = Boolean(r.playback_allowed)
        mediaSource = {
          source_type: 'authorized_local',
          media_id: r.media_id || null,
          page_url: safePageUrl,
          playback_allowed: isPlayable,
          rights_status: r.media_rights_status || 'approved',
        }
      } else if (r.source_type === 'external_page') {
        mediaSource = {
          source_type: 'external_page',
          media_id: null,
          page_url: safePageUrl,
          playback_allowed: false,
          rights_status: r.media_rights_status || 'unknown',
        }
      } else {
        mediaSource = {
          source_type: r.source_type || 'unavailable',
          media_id: null,
          page_url: null,
          playback_allowed: false,
          rights_status: r.media_rights_status || 'unknown',
        }
      }
    }

    return {
      episode_id: r.episode_id,
      series_id: r.series_id,
      season_id: r.season_id,
      series_slug: r.series_slug,
      season_slug: r.season_slug,
      series_title_vi: r.series_title_vi,
      series_title_ja: r.series_title_ja || null,
      season_ordinal: Number(r.season_ordinal),
      season_label: r.season_label || null,
      season_title_vi: r.season_title_vi,
      episode_number: Number(r.episode_number),
      title: r.title || null,
      has_subtitles: Boolean(r.has_subtitles),
      media_source: mediaSource,
      subtitle_track: r.track_id
        ? {
            track_id: r.track_id,
            languages: typeof r.languages === 'string' ? JSON.parse(r.languages) : (r.languages || ['ja', 'vi']),
            cue_count: Number(r.cue_count || 0),
            token_count: Number(r.token_count || 0),
            word_linked_token_count: Number(r.word_linked_token_count || 0),
          }
        : null,
    }
  }

  /**
   * GET /api/v1/anime/episodes/:episodeId/subtitles?from=&to=&lang=
   * Window-filtered subtitle cues with parsed tokens (no N+1).
   */
  async getEpisodeSubtitles(episodeId, { from = 0, to, lang = 'all', isLocalLoopback = false } = {}) {
    const validId = sanitizeEpisodeId(episodeId)
    const { from: validFrom, to: validTo } = sanitizeTimeWindow(from, to, 120, 600)
    const validLang = String(lang || 'all').toLowerCase()
    if (!VALID_SUBTITLE_LANGS.has(validLang)) {
      throw new AnimeApiError(
        400,
        'INVALID_LANGUAGE',
        `Ngôn ngữ phụ đề không hợp lệ: "${lang}". Các giá trị hợp lệ: 'all', 'ja', 'vi'.`
      )
    }

    // Check episode exists and series rights
    const epSqlSQLite = `
      SELECT ep.episode_id, ep.has_subtitles, s.rights_status as series_rights_status, st.track_id
      FROM anime_episodes ep
      JOIN anime_series s ON s.series_id = ep.series_id
      LEFT JOIN anime_subtitle_tracks st ON st.episode_id = ep.episode_id
      WHERE ep.episode_id = ?
    `
    const epSqlPG = `
      SELECT ep.episode_id, ep.has_subtitles, s.rights_status as series_rights_status, st.track_id
      FROM anime_episodes ep
      JOIN anime_series s ON s.series_id = ep.series_id
      LEFT JOIN anime_subtitle_tracks st ON st.episode_id = ep.episode_id
      WHERE ep.episode_id = $1
    `
    const ep = await this.queryOne(epSqlSQLite, epSqlPG, [validId])
    if (!ep) {
      throw new AnimeApiError(404, 'EPISODE_NOT_FOUND', `Không tìm thấy tập phim với mã ID '${validId}'.`)
    }

    if (!this.canReadSeries({ rights_status: ep.series_rights_status }, { isLocalLoopback })) {
      throw new AnimeApiError(
        403,
        'ANIME_CONTENT_RESTRICTED',
        'Phụ đề của tập phim này đang bị hạn chế truy cập do chưa được duyệt bản quyền.'
      )
    }

    if (!ep.has_subtitles || !ep.track_id) {
      return {
        episode_id: validId,
        track_id: null,
        from: validFrom,
        to: validTo,
        cues: [],
      }
    }

    // Query cues within time window using index (episode_id, start_time, end_time)
    const cuesSqlSQLite = `
      SELECT
        id,
        track_id,
        cue_id,
        start_time,
        end_time,
        ja_text,
        vi_text,
        compounds
      FROM anime_subtitle_cues
      WHERE episode_id = ?
        AND start_time <= ?
        AND end_time >= ?
      ORDER BY start_time ASC, cue_id ASC
    `
    const cuesSqlPG = `
      SELECT
        id,
        track_id,
        cue_id,
        start_time,
        end_time,
        ja_text,
        vi_text,
        compounds
      FROM anime_subtitle_cues
      WHERE episode_id = $1
        AND start_time <= $2
        AND end_time >= $3
      ORDER BY start_time ASC, cue_id ASC
    `
    const cueRows = await this.queryAll(cuesSqlSQLite, cuesSqlPG, [validId, validTo, validFrom])

    if (!cueRows.length) {
      return {
        episode_id: validId,
        track_id: ep.track_id,
        from: validFrom,
        to: validTo,
        cues: [],
      }
    }

    // Single batched query for tokens belonging to retrieved cues (zero N+1)
    const cueRowIds = cueRows.map((c) => c.id)
    const tokensByCueId = new Map()

    if (validLang !== 'vi') {
      const placeholdersSQLite = cueRowIds.map(() => '?').join(',')
      const placeholdersPG = cueRowIds.map((_, i) => `$${i + 1}`).join(',')

      const tokensSqlSQLite = `
        SELECT
          cue_row_id,
          token_ordinal,
          surface,
          char_start,
          char_end,
          word_id
        FROM anime_subtitle_tokens
        WHERE cue_row_id IN (${placeholdersSQLite})
        ORDER BY cue_row_id ASC, token_ordinal ASC
      `
      const tokensSqlPG = `
        SELECT
          cue_row_id,
          token_ordinal,
          surface,
          char_start,
          char_end,
          word_id
        FROM anime_subtitle_tokens
        WHERE cue_row_id IN (${placeholdersPG})
        ORDER BY cue_row_id ASC, token_ordinal ASC
      `
      const tokenRows = await this.queryAll(tokensSqlSQLite, tokensSqlPG, cueRowIds)
      for (const t of tokenRows) {
        if (!tokensByCueId.has(t.cue_row_id)) {
          tokensByCueId.set(t.cue_row_id, [])
        }
        tokensByCueId.get(t.cue_row_id).push({
          token_ordinal: Number(t.token_ordinal),
          surface: t.surface,
          char_start: Number(t.char_start),
          char_end: Number(t.char_end),
          word_id: typeof t.word_id === 'number' ? t.word_id : null,
        })
      }
    }

    const cues = cueRows.map((c) => {
      const result = {
        cue_id: Number(c.cue_id),
        start: Number(c.start_time),
        end: Number(c.end_time),
      }

      if (validLang === 'all' || validLang === 'ja') {
        result.ja = c.ja_text
        result.compounds = typeof c.compounds === 'string' ? JSON.parse(c.compounds) : (c.compounds || [])
        result.tokens = tokensByCueId.get(c.id) || []
      }

      if (validLang === 'all' || validLang === 'vi') {
        result.vi = c.vi_text
      }

      return result
    })

    return {
      episode_id: validId,
      track_id: ep.track_id,
      from: validFrom,
      to: validTo,
      cues,
    }
  }

  /**
   * GET /api/v1/anime/dictionary/:wordId
   * Lookup dictionary entry directly from sharded dictionary with LRU cache (no monolith in memory).
   */
  async getDictionaryWord(wordId) {
    const validWordId = sanitizeWordId(wordId)
    const bigId = BigInt(validWordId)
    const shardIndex = Number(bigId % 1000n)
    const shardFileName = `shard-${String(shardIndex).padStart(3, '0')}.json`
    const shardFilePath = path.resolve(this.dictionaryDir, shardFileName)

    // Path traversal defense
    const resolvedDir = path.resolve(this.dictionaryDir)
    if (!shardFilePath.startsWith(resolvedDir)) {
      throw new AnimeApiError(400, 'INVALID_WORD_ID', 'Yêu cầu không hợp lệ (path traversal).')
    }

    // Read shard with LRU cache
    let shard = this._shardCache.get(shardFileName)
    if (!shard) {
      if (!fs.existsSync(shardFilePath)) {
        throw new AnimeApiError(404, 'WORD_NOT_FOUND', `Không tìm thấy từ vựng có mã ID ${validWordId}.`)
      }
      try {
        const rawContent = fs.readFileSync(shardFilePath, 'utf8')
        shard = JSON.parse(rawContent)
        // Manage LRU cache size
        if (this._shardCache.size >= this._maxShardCacheSize) {
          const firstKey = this._shardCache.keys().next().value
          this._shardCache.delete(firstKey)
        }
        this._shardCache.set(shardFileName, shard)
      } catch (err) {
        throw new AnimeApiError(500, 'DICTIONARY_READ_ERROR', `Không thể đọc shard từ điển: ${err.message}`)
      }
    }

    const entry = shard[validWordId]
    if (!entry) {
      throw new AnimeApiError(404, 'WORD_NOT_FOUND', `Không tìm thấy từ vựng có mã ID ${validWordId}.`)
    }

    return {
      id: Number(entry.id || validWordId),
      type: entry.type || 'vocab',
      word: entry.word,
      reading: entry.reading || null,
      pos_vi: entry.pos_vi || [],
      jlpt: entry.jlpt || null,
      hanviet: entry.hanviet || '',
      meanings: entry.meanings || [],
      examples: entry.examples || [],
      kanji_breakdown: entry.kanji_breakdown || [],
      related_words: entry.related_words || [],
      synonyms: entry.synonyms || [],
      source: entry.source || 'dictionary',
      total_freq: Number(entry.total_freq || 0),
    }
  }

  /**
   * GET /api/v1/anime/progress?episodeId=
   * Get watch progress for the current authenticated user on a specific episode.
   * Fail-closed if episode does not exist (404) or is rights-restricted (403).
   */
  async getProgress(episodeId, userId, { isLocalLoopback = false } = {}) {
    if (!userId || typeof userId !== 'string') {
      throw new AnimeApiError(401, 'UNAUTHENTICATED', 'Yêu cầu đăng nhập để truy cập tiến độ xem.')
    }
    const validId = sanitizeEpisodeId(episodeId)

    const checkSqlSQLite = `
      SELECT ep.episode_id, s.rights_status as series_rights_status
      FROM anime_episodes ep
      JOIN anime_series s ON s.series_id = ep.series_id
      WHERE ep.episode_id = ?
    `
    const checkSqlPG = `
      SELECT ep.episode_id, s.rights_status as series_rights_status
      FROM anime_episodes ep
      JOIN anime_series s ON s.series_id = ep.series_id
      WHERE ep.episode_id = $1
    `
    const ep = await this.queryOne(checkSqlSQLite, checkSqlPG, [validId])
    if (!ep) {
      throw new AnimeApiError(404, 'EPISODE_NOT_FOUND', `Không tìm thấy tập phim với mã ID '${validId}'.`)
    }

    if (!this.canReadSeries({ rights_status: ep.series_rights_status }, { isLocalLoopback })) {
      throw new AnimeApiError(
        403,
        'ANIME_CONTENT_RESTRICTED',
        'Tập phim này đang bị hạn chế truy cập do chưa được duyệt bản quyền.'
      )
    }

    const sqlSQLite = `
      SELECT
        episode_id,
        last_playback_position,
        max_playback_position,
        duration,
        is_completed,
        playback_count,
        last_watched_at
      FROM anime_watch_progress
      WHERE user_id = ? AND episode_id = ?
    `
    const sqlPG = `
      SELECT
        episode_id,
        last_playback_position,
        max_playback_position,
        duration,
        is_completed,
        playback_count,
        last_watched_at
      FROM anime_watch_progress
      WHERE user_id = $1 AND episode_id = $2
    `
    const row = await this.queryOne(sqlSQLite, sqlPG, [userId, validId])
    if (!row) {
      return null
    }

    return {
      episode_id: row.episode_id,
      last_playback_position: Number(row.last_playback_position || 0),
      max_playback_position: Number(row.max_playback_position || 0),
      duration: Number(row.duration || 0),
      is_completed: Boolean(row.is_completed),
      playback_count: Number(row.playback_count || 1),
      last_watched_at: String(row.last_watched_at || ''),
    }
  }

  /**
   * POST /api/v1/anime/progress
   * Atomically upsert watch progress for current authenticated user.
   * position is clamped to [0, duration] when duration > 0.
   * is_completed is true strictly when duration > 0 and position >= duration * 0.9.
   * playback_count is determined strictly by the server (idle timeout >= 30 mins or replay from beginning after completion).
   */
  async saveProgress({ episodeId, position, duration }, userId, { isLocalLoopback = false, now = new Date() } = {}) {
    if (!userId || typeof userId !== 'string') {
      throw new AnimeApiError(401, 'UNAUTHENTICATED', 'Yêu cầu đăng nhập để lưu tiến độ xem.')
    }
    const validId = sanitizeEpisodeId(episodeId)

    if (
      typeof position !== 'number' ||
      !Number.isFinite(position) ||
      position < 0
    ) {
      throw new AnimeApiError(400, 'INVALID_POSITION', 'Vị trí phát (position) phải là số thực hữu hạn >= 0.')
    }

    if (
      typeof duration !== 'number' ||
      !Number.isFinite(duration) ||
      duration < 0
    ) {
      throw new AnimeApiError(400, 'INVALID_DURATION', 'Thời lượng (duration) phải là số thực hữu hạn >= 0.')
    }

    let clampedPosition = position
    if (duration > 0) {
      clampedPosition = Math.min(position, duration)
    }

    const checkSqlSQLite = `
      SELECT ep.episode_id, s.rights_status as series_rights_status
      FROM anime_episodes ep
      JOIN anime_series s ON s.series_id = ep.series_id
      WHERE ep.episode_id = ?
    `
    const checkSqlPG = `
      SELECT ep.episode_id, s.rights_status as series_rights_status
      FROM anime_episodes ep
      JOIN anime_series s ON s.series_id = ep.series_id
      WHERE ep.episode_id = $1
    `
    const ep = await this.queryOne(checkSqlSQLite, checkSqlPG, [validId])
    if (!ep) {
      throw new AnimeApiError(404, 'EPISODE_NOT_FOUND', `Không tìm thấy tập phim với mã ID '${validId}'.`)
    }

    if (!this.canReadSeries({ rights_status: ep.series_rights_status }, { isLocalLoopback })) {
      throw new AnimeApiError(
        403,
        'ANIME_CONTENT_RESTRICTED',
        'Tập phim này đang bị hạn chế truy cập do chưa được duyệt bản quyền.'
      )
    }

    const existingSqlSQLite = `
      SELECT playback_count, last_watched_at, is_completed, last_playback_position
      FROM anime_watch_progress
      WHERE user_id = ? AND episode_id = ?
    `
    const existingSqlPG = `
      SELECT playback_count, last_watched_at, is_completed, last_playback_position
      FROM anime_watch_progress
      WHERE user_id = $1 AND episode_id = $2
    `
    const existing = await this.queryOne(existingSqlSQLite, existingSqlPG, [userId, validId])

    const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
    const currentTime = now instanceof Date ? now.getTime() : (typeof now === 'number' ? now : Date.now())
    const nowIso = new Date(currentTime).toISOString()

    let nextPlaybackCount = 1
    if (existing) {
      const lastWatchedTime = existing.last_watched_at ? new Date(existing.last_watched_at).getTime() : 0
      const isIdleTimeout = Number.isFinite(lastWatchedTime) && (currentTime - lastWatchedTime) >= SESSION_IDLE_TIMEOUT_MS
      const isReplayAfterCompleted = Boolean(existing.is_completed) && clampedPosition <= 30 && Number(existing.last_playback_position || 0) > 30
      const isNewSession = isIdleTimeout || isReplayAfterCompleted
      nextPlaybackCount = isNewSession ? Number(existing.playback_count || 1) + 1 : Number(existing.playback_count || 1)
    }

    const isCompletedNum = duration > 0 && clampedPosition >= duration * 0.9 ? 1 : 0

    const upsertSqlSQLite = `
      INSERT INTO anime_watch_progress (
        user_id,
        episode_id,
        last_playback_position,
        max_playback_position,
        duration,
        is_completed,
        playback_count,
        last_watched_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, episode_id) DO UPDATE SET
        last_playback_position = excluded.last_playback_position,
        max_playback_position = MAX(anime_watch_progress.max_playback_position, excluded.max_playback_position),
        duration = CASE WHEN excluded.duration > 0 THEN excluded.duration ELSE anime_watch_progress.duration END,
        is_completed = CASE 
          WHEN excluded.duration > 0 AND excluded.last_playback_position >= excluded.duration * 0.9 THEN 1 
          ELSE anime_watch_progress.is_completed 
        END,
        playback_count = excluded.playback_count,
        last_watched_at = excluded.last_watched_at,
        updated_at = excluded.updated_at
      RETURNING
        episode_id,
        last_playback_position,
        max_playback_position,
        duration,
        is_completed,
        playback_count,
        last_watched_at
    `

    const upsertSqlPG = `
      INSERT INTO anime_watch_progress (
        user_id,
        episode_id,
        last_playback_position,
        max_playback_position,
        duration,
        is_completed,
        playback_count,
        last_watched_at,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT(user_id, episode_id) DO UPDATE SET
        last_playback_position = EXCLUDED.last_playback_position,
        max_playback_position = GREATEST(anime_watch_progress.max_playback_position, EXCLUDED.max_playback_position),
        duration = CASE WHEN EXCLUDED.duration > 0 THEN EXCLUDED.duration ELSE anime_watch_progress.duration END,
        is_completed = CASE 
          WHEN EXCLUDED.duration > 0 AND EXCLUDED.last_playback_position >= EXCLUDED.duration * 0.9 THEN true 
          ELSE anime_watch_progress.is_completed 
        END,
        playback_count = EXCLUDED.playback_count,
        last_watched_at = EXCLUDED.last_watched_at,
        updated_at = EXCLUDED.updated_at
      RETURNING
        episode_id,
        last_playback_position,
        max_playback_position,
        duration,
        is_completed,
        playback_count,
        last_watched_at
    `

    const paramsSQLite = [
      userId,
      validId,
      clampedPosition,
      clampedPosition,
      duration,
      isCompletedNum,
      nextPlaybackCount,
      nowIso,
      nowIso,
      nowIso,
    ]

    const paramsPG = [
      userId,
      validId,
      clampedPosition,
      clampedPosition,
      duration,
      Boolean(isCompletedNum),
      nextPlaybackCount,
      nowIso,
      nowIso,
      nowIso,
    ]

    const row = await this.queryOne(upsertSqlSQLite, upsertSqlPG, paramsSQLite, paramsPG)
    return {
      episode_id: row.episode_id,
      last_playback_position: Number(row.last_playback_position || 0),
      max_playback_position: Number(row.max_playback_position || 0),
      duration: Number(row.duration || 0),
      is_completed: Boolean(row.is_completed),
      playback_count: Number(row.playback_count || 1),
      last_watched_at: String(row.last_watched_at || ''),
    }
  }

  /**
   * GET /api/v1/anime/progress/continue
   * Returns up to 10 newest watch progress items for current user.
   * Only returns episodes that are readable under Anime rights policy.
   * Only returns essential metadata needed for Continue Watching card (no stream URLs, no subtitle bodies).
   */
  async getContinueWatching(userId, { isLocalLoopback = false } = {}) {
    if (!userId || typeof userId !== 'string') {
      throw new AnimeApiError(401, 'UNAUTHENTICATED', 'Yêu cầu đăng nhập.')
    }

    const sqlSQLite = `
      SELECT
        p.episode_id,
        p.last_playback_position,
        p.max_playback_position,
        p.duration,
        p.is_completed,
        p.last_watched_at,
        ep.series_id,
        ep.series_slug,
        ep.season_slug,
        ep.episode_number,
        ep.title as episode_title,
        s.title_vi as series_title_vi,
        s.rights_status as series_rights_status,
        sn.season_label
      FROM anime_watch_progress p
      JOIN anime_episodes ep ON ep.episode_id = p.episode_id
      JOIN anime_series s ON s.series_id = ep.series_id
      LEFT JOIN anime_seasons sn ON sn.season_id = ep.season_id
      WHERE p.user_id = ?
      ORDER BY p.last_watched_at DESC
      LIMIT 50
    `

    const sqlPG = `
      SELECT
        p.episode_id,
        p.last_playback_position,
        p.max_playback_position,
        p.duration,
        p.is_completed,
        p.last_watched_at,
        ep.series_id,
        ep.series_slug,
        ep.season_slug,
        ep.episode_number,
        ep.title as episode_title,
        s.title_vi as series_title_vi,
        s.rights_status as series_rights_status,
        sn.season_label
      FROM anime_watch_progress p
      JOIN anime_episodes ep ON ep.episode_id = p.episode_id
      JOIN anime_series s ON s.series_id = ep.series_id
      LEFT JOIN anime_seasons sn ON sn.season_id = ep.season_id
      WHERE p.user_id = $1
      ORDER BY p.last_watched_at DESC
      LIMIT 50
    `

    const rows = await this.queryAll(sqlSQLite, sqlPG, [userId])
    const readableItems = []
    for (const row of rows) {
      if (!this.canReadSeries({ rights_status: row.series_rights_status }, { isLocalLoopback })) {
        continue
      }
      readableItems.push({
        episode_id: row.episode_id,
        series_id: row.series_id,
        series_slug: row.series_slug,
        series_title_vi: row.series_title_vi,
        season_slug: row.season_slug,
        season_label: row.season_label || null,
        episode_number: Number(row.episode_number),
        episode_title: row.episode_title || null,
        last_playback_position: Number(row.last_playback_position || 0),
        max_playback_position: Number(row.max_playback_position || 0),
        duration: Number(row.duration || 0),
        is_completed: Boolean(row.is_completed),
        last_watched_at: String(row.last_watched_at || ''),
      })
      if (readableItems.length >= 10) {
        break
      }
    }

    return {
      items: readableItems,
      count: readableItems.length,
    }
  }
}
