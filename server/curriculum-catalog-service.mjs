import fs from 'node:fs'
import path from 'node:path'

let DatabaseSync = null
try {
  const sqlite = await import('node:sqlite')
  DatabaseSync = sqlite.DatabaseSync
} catch {
  // node:sqlite is optional if running solely on PostgreSQL
}

export const VALID_LEVELS = Object.freeze(new Set(['A1', 'A2', 'N5', 'N4', 'N3', 'N2', 'N1', 'SE']))
export const APPROVED_RIGHTS_STATUSES = Object.freeze(new Set(['verified', 'public_domain', 'licensed']))
export const PUBLIC_VISIBILITIES = Object.freeze(new Set(['public', 'unlisted']))

function isEnabled(value) {
  return String(value ?? '').trim().toLowerCase() === 'true'
}

/**
 * Checks if a course is allowed for public browsing/reading.
 * Strict contract: Visibility must be 'public' or 'unlisted',
 * AND rights_status must be 'verified', 'public_domain', or 'licensed'.
 * @param {{ visibility?: string, rights_status?: string } | null | undefined} course
 * @returns {boolean}
 */
export function isCoursePublicAndApproved(course) {
  if (!course) return false
  return PUBLIC_VISIBILITIES.has(course.visibility) && APPROVED_RIGHTS_STATUSES.has(course.rights_status)
}

export class CatalogApiError extends Error {
  /**
   * @param {number} status HTTP status code (400, 403, 404, etc.)
   * @param {string} code Unique application error code
   * @param {string} message User-friendly error message
   */
  constructor(status, code, message) {
    super(message)
    this.name = 'CatalogApiError'
    this.status = status
    this.code = code
  }
}

/**
 * Safely parses JSON string or returns the value if already parsed.
 * @param {any} val
 * @param {any} fallback
 */
function safeParseJson(val, fallback = []) {
  if (!val) return fallback
  if (typeof val === 'object') return val
  try {
    return JSON.parse(val)
  } catch {
    return fallback
  }
}

/**
 * Validates and sanitizes pagination parameters.
 * @param {any} pageParam
 * @param {any} limitParam
 * @param {number} defaultLimit
 * @returns {{ page: number, limit: number, offset: number }}
 */
export function sanitizePagination(pageParam, limitParam, defaultLimit = 20) {
  let page = pageParam === undefined || pageParam === null || pageParam === '' ? 1 : Number(pageParam)
  let limit = limitParam === undefined || limitParam === null || limitParam === '' ? defaultLimit : Number(limitParam)

  if (!Number.isInteger(page) || page < 1) {
    throw new CatalogApiError(400, 'INVALID_PAGE', 'Trang yêu cầu (page) phải là số nguyên dương >= 1.')
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new CatalogApiError(400, 'INVALID_LIMIT', 'Giới hạn (limit) phải là số nguyên từ 1 đến 100.')
  }

  return { page, limit, offset: (page - 1) * limit }
}

/**
 * Validates and normalizes course level parameter.
 * @param {string | null | undefined} levelParam
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
  if (!VALID_LEVELS.has(normalized)) {
    throw new CatalogApiError(
      400,
      'INVALID_LEVEL',
      `Cấp độ không hợp lệ: "${levelParam}". Các cấp độ được hỗ trợ: A1, A2, N5, N4, N3, N2, N1, SE.`
    )
  }
  return normalized
}

export class CurriculumCatalogService {
  /**
   * @param {{
   *   storage?: 'sqlite' | 'postgres' | 'postgresql',
   *   db?: any,
   *   pool?: any,
   *   sqlitePath?: string,
   *   allowUnverifiedContent?: boolean
   * }} [options]
   */
  constructor(options = {}) {
    const rawStorage = options.storage || process.env.CURRICULUM_STORAGE || 'sqlite'
    const normalizedStorage = String(rawStorage).trim().toLowerCase()
    // This switch exists only for the owner's local review environment.  It
    // must never silently make unverified curriculum public in production.
    this.allowUnverifiedContent =
      options.allowUnverifiedContent === true ||
      (process.env.NODE_ENV !== 'production' && isEnabled(process.env.CURRICULUM_LOCAL_UNVERIFIED_ACCESS))

    if (normalizedStorage === 'postgres' || normalizedStorage === 'postgresql') {
      this.storage = 'postgres'
      this.pool = options.pool || null
      this.db = null
      this.sqlitePath = null

      if (!this.pool) {
        console.warn('[CurriculumCatalogService] Storage is configured as postgres, but PostgreSQL connection pool was not provided.')
      }
    } else if (normalizedStorage === 'sqlite') {
      this.storage = 'sqlite'
      this.pool = null
      this.sqlitePath = options.sqlitePath || process.env.CURRICULUM_SQLITE_PATH || path.resolve('tmp/curriculum/curriculum.db')

      if (options.db) {
        this.db = options.db
      } else if (DatabaseSync) {
        if (fs.existsSync(this.sqlitePath)) {
          try {
            this.db = new DatabaseSync(this.sqlitePath, { readOnly: true })
          } catch (err) {
            console.warn(`[CurriculumCatalogService] Could not open SQLite at ${this.sqlitePath}:`, err.message)
            this.db = null
          }
        } else {
          console.warn(`[CurriculumCatalogService] SQLite database not found at ${this.sqlitePath}. Run 'npm run curriculum:ingest' first.`)
          this.db = null
        }
      } else {
        console.warn('[CurriculumCatalogService] node:sqlite DatabaseSync is not available in this Node runtime.')
        this.db = null
      }
    } else {
      throw new Error(`[CurriculumCatalogService] Invalid CURRICULUM_STORAGE '${rawStorage}'. Supported values: 'sqlite' | 'postgres'.`)
    }
  }

  /**
   * Returns current active storage type ('sqlite' | 'postgres').
   */
  getStorageType() {
    return this.storage
  }

  /**
   * Returns true if active storage database connection is available.
   */
  isAvailable() {
    if (this.storage === 'postgres') return Boolean(this.pool)
    if (this.storage === 'sqlite') return Boolean(this.db)
    return false
  }

  canReadCourse(course) {
    return this.allowUnverifiedContent || isCoursePublicAndApproved(course)
  }

  /**
   * Internal query runner strictly executing against the configured storage without silent fallback.
   * @param {string} sqlSQLite
   * @param {string} sqlPostgres
   * @param {any[]} params
   * @returns {Promise<any[]>}
   */
  async queryAll(sqlSQLite, sqlPostgres, params = []) {
    if (this.storage === 'sqlite') {
      if (!this.db) {
        throw new CatalogApiError(
          503,
          'CURRICULUM_STORAGE_UNAVAILABLE',
          `Cơ sở dữ liệu giáo trình SQLite chưa sẵn sàng tại ${this.sqlitePath || 'tmp/curriculum/curriculum.db'}. Vui lòng kiểm tra file SQLite hoặc chạy 'npm run curriculum:ingest'.`
        )
      }
      const stmt = this.db.prepare(sqlSQLite)
      return stmt.all(...params)
    }

    if (this.storage === 'postgres') {
      if (!this.pool) {
        throw new CatalogApiError(
          503,
          'CURRICULUM_STORAGE_UNAVAILABLE',
          'Cơ sở dữ liệu giáo trình PostgreSQL chưa được kết nối.'
        )
      }
      const res = await this.pool.query(sqlPostgres, params)
      return res.rows
    }

    throw new CatalogApiError(503, 'SERVICE_UNAVAILABLE', 'Cơ sở dữ liệu giáo trình chưa sẵn sàng.')
  }

  /**
   * Internal single row query runner.
   * @param {string} sqlSQLite
   * @param {string} sqlPostgres
   * @param {any[]} params
   * @returns {Promise<any | null>}
   */
  async queryOne(sqlSQLite, sqlPostgres, params = []) {
    const rows = await this.queryAll(sqlSQLite, sqlPostgres, params)
    return rows.length > 0 ? rows[0] : null
  }

  /**
   * GET /api/v1/curriculum/catalog?level=&q=&page=&limit=
   * Returns paginated course cards with unit_count and term_count in a single query (no N+1).
   */
  async getCatalog({ level, q, page = 1, limit = 20 } = {}) {
    const { page: validPage, limit: validLimit, offset } = sanitizePagination(page, limit, 20)
    const validLevel = sanitizeLevel(level)
    const queryTerm = typeof q === 'string' && q.trim() ? q.trim() : null

    // Public is strict by default. The explicit local-owner switch is useful
    // for reviewing an imported private corpus before rights are approved.
    const conditionsPg = this.allowUnverifiedContent
      ? []
      : ["c.visibility IN ('public', 'unlisted')", "c.rights_status IN ('verified', 'public_domain', 'licensed')"]
    const conditionsSqlite = this.allowUnverifiedContent
      ? []
      : ["c.visibility IN ('public', 'unlisted')", "c.rights_status IN ('verified', 'public_domain', 'licensed')"]
    const params = []

    if (validLevel) {
      params.push(validLevel)
      conditionsPg.push(`c.level = $${params.length}`)
      conditionsSqlite.push('c.level = ?')
    }

    if (queryTerm) {
      const qVal = `%${queryTerm.toLowerCase()}%`
      params.push(qVal, qVal)
      const p1 = params.length - 1
      const p2 = params.length
      conditionsPg.push(`(LOWER(c.title) LIKE $${p1} OR LOWER(c.description) LIKE $${p2})`)
      conditionsSqlite.push('(LOWER(c.title) LIKE ? OR LOWER(c.description) LIKE ?)')
    }

    const wherePg = conditionsPg.length ? conditionsPg.join(' AND ') : 'TRUE'
    const whereSqlite = conditionsSqlite.length ? conditionsSqlite.join(' AND ') : '1 = 1'

    // 2. Count total courses
    const countSqlPg = `SELECT COUNT(*)::int as total FROM curriculum_courses c WHERE ${wherePg}`
    const countSqlSqlite = `SELECT COUNT(*) as total FROM curriculum_courses c WHERE ${whereSqlite}`
    const countRow = await this.queryOne(countSqlSqlite, countSqlPg, params)
    const total = Number(countRow?.total ?? 0)

    if (total === 0) {
      return {
        items: [],
        pagination: {
          page: validPage,
          limit: validLimit,
          total: 0,
          totalPages: 0,
        },
      }
    }

    // 3. Query items with aggregated unit_count and term_count (Single fast query, NO N+1)
    const queryParams = [...params, validLimit, offset]
    const limitIdx = params.length + 1
    const offsetIdx = params.length + 2

    const itemsSqlPg = `
      SELECT
        c.course_code,
        c.title,
        c.level,
        c.provider_source,
        c.visibility,
        c.rights_status,
        c.description,
        COALESCE(u.unit_count, 0)::int as unit_count,
        COALESCE(ct.term_count, 0)::int as term_count
      FROM curriculum_courses c
      LEFT JOIN (
        SELECT course_code, COUNT(*)::int as unit_count
        FROM curriculum_units
        GROUP BY course_code
      ) u ON u.course_code = c.course_code
      LEFT JOIN (
        SELECT course_code, COUNT(*)::int as term_count
        FROM curriculum_course_terms
        GROUP BY course_code
      ) ct ON ct.course_code = c.course_code
      WHERE ${wherePg}
      ORDER BY c.level ASC, c.course_code ASC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `
    const itemsSqlSqlite = `
      SELECT
        c.course_code,
        c.title,
        c.level,
        c.provider_source,
        c.visibility,
        c.rights_status,
        c.description,
        COALESCE(u.unit_count, 0) as unit_count,
        COALESCE(ct.term_count, 0) as term_count
      FROM curriculum_courses c
      LEFT JOIN (
        SELECT course_code, COUNT(*) as unit_count
        FROM curriculum_units
        GROUP BY course_code
      ) u ON u.course_code = c.course_code
      LEFT JOIN (
        SELECT course_code, COUNT(*) as term_count
        FROM curriculum_course_terms
        GROUP BY course_code
      ) ct ON ct.course_code = c.course_code
      WHERE ${whereSqlite}
      ORDER BY c.level ASC, c.course_code ASC
      LIMIT ? OFFSET ?
    `
    const rows = await this.queryAll(itemsSqlSqlite, itemsSqlPg, queryParams)

    const items = rows.map((r) => ({
      course_code: r.course_code,
      title: r.title,
      level: r.level,
      provider_source: r.provider_source,
      visibility: r.visibility,
      rights_status: r.rights_status,
      description: r.description || '',
      unit_count: Number(r.unit_count || 0),
      term_count: Number(r.term_count || 0),
    }))

    return {
      items,
      pagination: {
        page: validPage,
        limit: validLimit,
        total,
        totalPages: Math.ceil(total / validLimit),
      },
    }
  }

  /**
   * GET /api/v1/curriculum/courses/:courseCode
   * Returns course metadata and unit summaries with term_count (no terms list).
   */
  async getCourseDetail(courseCode) {
    if (!courseCode || typeof courseCode !== 'string' || !courseCode.trim()) {
      throw new CatalogApiError(404, 'COURSE_NOT_FOUND', 'Không tìm thấy khóa học này.')
    }
    const cleanCourseCode = courseCode.trim()

    // 1. Query course
    const courseSqlPg = `
      SELECT course_code, title, level, provider_source, visibility, rights_status, description
      FROM curriculum_courses
      WHERE course_code = $1
    `
    const courseSqlSqlite = courseSqlPg.replace('$1', '?')
    const course = await this.queryOne(courseSqlSqlite, courseSqlPg, [cleanCourseCode])

    if (!course) {
      throw new CatalogApiError(404, 'COURSE_NOT_FOUND', 'Không tìm thấy khóa học này.')
    }

    if (!this.canReadCourse(course)) {
      throw new CatalogApiError(
        403,
        'COURSE_RESTRICTED',
        'Khóa học này đang bị hạn chế truy cập do chưa được cấp phép công khai.'
      )
    }

    // 2. Query unit summaries with term_count (Single fast query, NO N+1)
    const unitsSqlPg = `
      SELECT
        u.unit_id,
        u.unit_key,
        u.ordinal,
        u.title,
        u.topic,
        COUNT(ct.id)::int as term_count
      FROM curriculum_units u
      LEFT JOIN curriculum_course_terms ct ON ct.unit_id = u.unit_id
      WHERE u.course_code = $1
      GROUP BY u.unit_id, u.unit_key, u.ordinal, u.title, u.topic
      ORDER BY u.ordinal ASC
    `
    const unitsSqlSqlite = unitsSqlPg.replace('$1', '?').replace('::int', '')
    const unitRows = await this.queryAll(unitsSqlSqlite, unitsSqlPg, [cleanCourseCode])

    const units = unitRows.map((u) => ({
      unit_id: u.unit_id,
      unit_key: u.unit_key,
      ordinal: Number(u.ordinal),
      title: u.title,
      topic: u.topic || '',
      term_count: Number(u.term_count || 0),
    }))

    const totalTerms = units.reduce((sum, u) => sum + u.term_count, 0)

    return {
      course: {
        course_code: course.course_code,
        title: course.title,
        level: course.level,
        provider_source: course.provider_source,
        visibility: course.visibility,
        rights_status: course.rights_status,
        description: course.description || '',
        unit_count: units.length,
        term_count: totalTerms,
      },
      units,
    }
  }

  /**
   * GET /api/v1/curriculum/courses/:courseCode/units/:unitKey
   * Returns unit metadata only (does NOT return term list).
   */
  async getUnitDetail(courseCode, unitKey) {
    if (!courseCode || !unitKey || typeof courseCode !== 'string' || typeof unitKey !== 'string') {
      throw new CatalogApiError(404, 'COURSE_NOT_FOUND', 'Không tìm thấy khóa học này.')
    }
    const cleanCourseCode = courseCode.trim()
    const cleanUnitKey = unitKey.trim()

    // 1. Verify course exists and is not private
    const courseSqlPg = `
      SELECT course_code, title, level, visibility, rights_status
      FROM curriculum_courses
      WHERE course_code = $1
    `
    const courseSqlSqlite = courseSqlPg.replace('$1', '?')
    const course = await this.queryOne(courseSqlSqlite, courseSqlPg, [cleanCourseCode])

    if (!course) {
      throw new CatalogApiError(404, 'COURSE_NOT_FOUND', 'Không tìm thấy khóa học này.')
    }
    if (!this.canReadCourse(course)) {
      throw new CatalogApiError(
        403,
        'COURSE_RESTRICTED',
        'Khóa học này đang bị hạn chế truy cập do chưa được cấp phép công khai.'
      )
    }

    // 2. Query unit metadata with term_count
    const unitSqlPg = `
      SELECT
        u.unit_id,
        u.course_code,
        u.unit_key,
        u.ordinal,
        u.title,
        u.topic,
        COUNT(ct.id)::int as term_count
      FROM curriculum_units u
      LEFT JOIN curriculum_course_terms ct ON ct.unit_id = u.unit_id
      WHERE u.course_code = $1 AND u.unit_key = $2
      GROUP BY u.unit_id, u.course_code, u.unit_key, u.ordinal, u.title, u.topic
    `
    const unitSqlSqlite = unitSqlPg.replace('$1', '?').replace('$2', '?').replace('::int', '')
    const unit = await this.queryOne(unitSqlSqlite, unitSqlPg, [cleanCourseCode, cleanUnitKey])

    if (!unit) {
      throw new CatalogApiError(404, 'UNIT_NOT_FOUND', 'Không tìm thấy bài học này.')
    }

    return {
      course: {
        course_code: course.course_code,
        title: course.title,
        level: course.level,
      },
      unit: {
        unit_id: unit.unit_id,
        course_code: unit.course_code,
        unit_key: unit.unit_key,
        ordinal: Number(unit.ordinal),
        title: unit.title,
        topic: unit.topic || '',
        term_count: Number(unit.term_count || 0),
      },
    }
  }

  /**
   * GET /api/v1/curriculum/courses/:courseCode/units/:unitKey/terms?page=&limit=&q=
   * Returns paginated term cards for the unit.
   * Protects unapproved rights: if rights_status is unknown, examples are empty [] and raw references are withheld.
   */
  async getUnitTerms(courseCode, unitKey, { page = 1, limit = 50, q } = {}) {
    const { page: validPage, limit: validLimit, offset } = sanitizePagination(page, limit, 50)
    const cleanCourseCode = typeof courseCode === 'string' ? courseCode.trim() : ''
    const cleanUnitKey = typeof unitKey === 'string' ? unitKey.trim() : ''
    const queryTerm = typeof q === 'string' && q.trim() ? q.trim() : null

    // 1. Verify course
    const courseSqlPg = `
      SELECT course_code, title, level, visibility, rights_status
      FROM curriculum_courses
      WHERE course_code = $1
    `
    const courseSqlSqlite = courseSqlPg.replace('$1', '?')
    const course = await this.queryOne(courseSqlSqlite, courseSqlPg, [cleanCourseCode])

    if (!course) {
      throw new CatalogApiError(404, 'COURSE_NOT_FOUND', 'Không tìm thấy khóa học này.')
    }
    if (!this.canReadCourse(course)) {
      throw new CatalogApiError(
        403,
        'COURSE_RESTRICTED',
        'Khóa học này đang bị hạn chế truy cập do chưa được cấp phép công khai.'
      )
    }

    // 2. Verify unit
    const unitSqlPg = `
      SELECT unit_id, course_code, unit_key, ordinal, title
      FROM curriculum_units
      WHERE course_code = $1 AND unit_key = $2
    `
    const unitSqlSqlite = unitSqlPg.replace('$1', '?').replace('$2', '?')
    const unit = await this.queryOne(unitSqlSqlite, unitSqlPg, [cleanCourseCode, cleanUnitKey])

    if (!unit) {
      throw new CatalogApiError(404, 'UNIT_NOT_FOUND', 'Không tìm thấy bài học này.')
    }

    // 3. Build terms query
    const conditionsPg = ['ct.course_code = $1', 'ct.unit_id = $2']
    const conditionsSqlite = ['ct.course_code = ?', 'ct.unit_id = ?']
    const params = [cleanCourseCode, unit.unit_id]

    if (queryTerm) {
      const qVal = `%${queryTerm.toLowerCase()}%`
      params.push(qVal, qVal, qVal, qVal, qVal)
      const p1 = params.length - 4
      const p2 = params.length - 3
      const p3 = params.length - 2
      const p4 = params.length - 1
      const p5 = params.length
      conditionsPg.push(`(
        LOWER(t.display_word) LIKE $${p1} OR
        LOWER(t.display_reading) LIKE $${p2} OR
        LOWER(t.normalized_key) LIKE $${p3} OR
        LOWER(COALESCE(t.han_viet, '')) LIKE $${p4} OR
        LOWER(t.meanings) LIKE $${p5}
      )`)
      conditionsSqlite.push(`(
        LOWER(t.display_word) LIKE ? OR
        LOWER(t.display_reading) LIKE ? OR
        LOWER(t.normalized_key) LIKE ? OR
        LOWER(COALESCE(t.han_viet, '')) LIKE ? OR
        LOWER(t.meanings) LIKE ?
      )`)
    }

    const wherePg = conditionsPg.join(' AND ')
    const whereSqlite = conditionsSqlite.join(' AND ')

    // 4. Count total matching terms
    const countSqlPg = `
      SELECT COUNT(*)::int as total
      FROM curriculum_course_terms ct
      JOIN curriculum_terms t ON t.term_id = ct.term_id
      WHERE ${wherePg}
    `
    const countSqlSqlite = `
      SELECT COUNT(*) as total
      FROM curriculum_course_terms ct
      JOIN curriculum_terms t ON t.term_id = ct.term_id
      WHERE ${whereSqlite}
    `
    const countRow = await this.queryOne(countSqlSqlite, countSqlPg, params)
    const total = Number(countRow?.total ?? 0)

    if (total === 0) {
      return {
        course: {
          course_code: course.course_code,
          title: course.title,
          level: course.level,
          rights_status: course.rights_status,
        },
        unit: {
          unit_id: unit.unit_id,
          unit_key: unit.unit_key,
          ordinal: Number(unit.ordinal),
          title: unit.title,
        },
        items: [],
        pagination: {
          page: validPage,
          limit: validLimit,
          total: 0,
          totalPages: 0,
        },
      }
    }

    // 5. Query paginated terms
    const limitIdx = params.length + 1
    const offsetIdx = params.length + 2
    const queryParams = [...params, validLimit, offset]

    const itemsSqlPg = `
      SELECT
        ct.ordinal,
        t.term_id,
        t.normalized_key,
        t.display_word,
        t.display_reading,
        t.meanings,
        t.han_viet,
        t.examples
      FROM curriculum_course_terms ct
      JOIN curriculum_terms t ON t.term_id = ct.term_id
      WHERE ${wherePg}
      ORDER BY ct.ordinal ASC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `
    const itemsSqlSqlite = `
      SELECT
        ct.ordinal,
        t.term_id,
        t.normalized_key,
        t.display_word,
        t.display_reading,
        t.meanings,
        t.han_viet,
        t.examples
      FROM curriculum_course_terms ct
      JOIN curriculum_terms t ON t.term_id = ct.term_id
      WHERE ${whereSqlite}
      ORDER BY ct.ordinal ASC
      LIMIT ? OFFSET ?
    `
    const termRows = await this.queryAll(itemsSqlSqlite, itemsSqlPg, queryParams)

    // Rights protection check:
    // "Browse public chỉ trả field được rights_status=approved; item unknown/restricted không lộ nội dung."
    const isApprovedRights = this.allowUnverifiedContent || APPROVED_RIGHTS_STATUSES.has(course.rights_status)

    const items = termRows.map((r) => {
      const parsedMeanings = safeParseJson(r.meanings, [])
      // If rights_status is approved ('verified', 'public_domain', 'licensed'), deliver verified examples.
      // If unknown or restricted, strictly withhold copyrighted textbook sentences (empty array).
      const parsedExamples = isApprovedRights ? safeParseJson(r.examples, []) : []

      return {
        term_id: r.term_id,
        ordinal: Number(r.ordinal),
        normalized_key: r.normalized_key,
        display_word: r.display_word,
        display_reading: r.display_reading || '',
        meanings: parsedMeanings,
        han_viet: r.han_viet || null,
        examples: parsedExamples,
      }
    })

    return {
      course: {
        course_code: course.course_code,
        title: course.title,
        level: course.level,
        rights_status: course.rights_status,
      },
      unit: {
        unit_id: unit.unit_id,
        unit_key: unit.unit_key,
        ordinal: Number(unit.ordinal),
        title: unit.title,
      },
      items,
      pagination: {
        page: validPage,
        limit: validLimit,
        total,
        totalPages: Math.ceil(total / validLimit),
      },
    }
  }
}
