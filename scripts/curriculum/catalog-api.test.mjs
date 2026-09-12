import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { DatabaseSync } from 'node:sqlite'
import {
  CurriculumCatalogService,
  CatalogApiError,
  sanitizePagination,
  sanitizeLevel,
  isCoursePublicAndApproved,
  PUBLIC_VISIBILITIES,
  APPROVED_RIGHTS_STATUSES,
} from '../../server/curriculum-catalog-service.mjs'
import { applyCurriculumSchemaSQLite } from '../../server/db/curriculum-persistence.mjs'

describe('Curriculum Catalog & Reading API Contract Tests (Task T04)', () => {
  const realSqlitePath = path.resolve('tmp/curriculum/curriculum.db')
  const hasRealDb = fs.existsSync(realSqlitePath)

  function createMockDatabase() {
    const db = new DatabaseSync(':memory:')
    applyCurriculumSchemaSQLite(db)

    const now = new Date().toISOString()

    // --- 1. Approved Courses (Should appear in /catalog and be readable) ---

    // Course 1: public + verified (N5)
    db.prepare(`
      INSERT INTO curriculum_courses (course_code, title, level, provider_source, visibility, rights_status, description, created_at, updated_at)
      VALUES ('course-n5-verified', 'Khóa học Tiếng Nhật N5 Cơ Bản', 'N5', 'verified_source', 'public', 'verified', 'Mô tả N5 chuẩn', ?, ?)
    `).run(now, now)

    // Course 2: public + licensed (N4)
    db.prepare(`
      INSERT INTO curriculum_courses (course_code, title, level, provider_source, visibility, rights_status, description, created_at, updated_at)
      VALUES ('course-n4-licensed', 'Khóa học Tiếng Nhật N4 Giao Tiếp', 'N4', 'licensed_source', 'public', 'licensed', 'Mô tả N4 giao tiếp thực tế', ?, ?)
    `).run(now, now)

    // Course 3: unlisted + public_domain (A1)
    db.prepare(`
      INSERT INTO curriculum_courses (course_code, title, level, provider_source, visibility, rights_status, description, created_at, updated_at)
      VALUES ('course-a1-pd', 'Khóa học A1 Public Domain', 'A1', 'pd_source', 'unlisted', 'public_domain', 'Mô tả A1 cộng đồng', ?, ?)
    `).run(now, now)

    // --- 2. Unapproved Courses (MUST BE EXCLUDED from /catalog and return 403 on direct access) ---

    // Course 4: internal + unknown (like raw unverified imports)
    db.prepare(`
      INSERT INTO curriculum_courses (course_code, title, level, provider_source, visibility, rights_status, description, created_at, updated_at)
      VALUES ('course-internal-unknown', 'Khóa học Nội bộ N3 Chưa Thẩm Định', 'N3', 'crawl_source', 'internal', 'unknown', 'Mô tả N3 nội bộ', ?, ?)
    `).run(now, now)

    // Course 5: public + unknown (public visibility but unknown rights -> MUST BE BLOCKED)
    db.prepare(`
      INSERT INTO curriculum_courses (course_code, title, level, provider_source, visibility, rights_status, description, created_at, updated_at)
      VALUES ('course-public-unknown', 'Khóa học Public Chưa Duyệt Quyền N2', 'N2', 'crawl_source', 'public', 'unknown', 'Mô tả N2', ?, ?)
    `).run(now, now)

    // Course 6: internal + verified (verified rights but internal visibility -> MUST BE BLOCKED)
    db.prepare(`
      INSERT INTO curriculum_courses (course_code, title, level, provider_source, visibility, rights_status, description, created_at, updated_at)
      VALUES ('course-internal-verified', 'Khóa học Nội Bộ Đã Duyệt N1', 'N1', 'internal_source', 'internal', 'verified', 'Mô tả N1 nội bộ', ?, ?)
    `).run(now, now)

    // Course 7: private + unknown (private visibility -> MUST BE BLOCKED)
    db.prepare(`
      INSERT INTO curriculum_courses (course_code, title, level, provider_source, visibility, rights_status, description, created_at, updated_at)
      VALUES ('course-private-restricted', 'Khóa học Bí Mật SE', 'SE', 'restricted_source', 'private', 'unknown', 'Mô tả bí mật', ?, ?)
    `).run(now, now)

    // --- Units ---
    db.prepare(`
      INSERT INTO curriculum_units (unit_id, course_code, unit_key, ordinal, title, topic, created_at, updated_at)
      VALUES ('course-n5-verified:u1', 'course-n5-verified', 'u1', 1, 'Bài 1 Chào hỏi', 'Giao tiếp cơ bản', ?, ?)
    `).run(now, now)
    db.prepare(`
      INSERT INTO curriculum_units (unit_id, course_code, unit_key, ordinal, title, topic, created_at, updated_at)
      VALUES ('course-n4-licensed:u1', 'course-n4-licensed', 'u1', 1, 'Bài 1 Mua sắm', 'Hội thoại', ?, ?)
    `).run(now, now)
    db.prepare(`
      INSERT INTO curriculum_units (unit_id, course_code, unit_key, ordinal, title, topic, created_at, updated_at)
      VALUES ('course-a1-pd:u1', 'course-a1-pd', 'u1', 1, 'Bài 1 Chữ cái', 'Nhập môn', ?, ?)
    `).run(now, now)
    db.prepare(`
      INSERT INTO curriculum_units (unit_id, course_code, unit_key, ordinal, title, topic, created_at, updated_at)
      VALUES ('course-internal-unknown:u1', 'course-internal-unknown', 'u1', 1, 'Bài 1 Nội bộ', 'Nội bộ', ?, ?)
    `).run(now, now)
    db.prepare(`
      INSERT INTO curriculum_units (unit_id, course_code, unit_key, ordinal, title, topic, created_at, updated_at)
      VALUES ('course-public-unknown:u1', 'course-public-unknown', 'u1', 1, 'Bài 1 Public Chưa Duyệt', 'Khám phá', ?, ?)
    `).run(now, now)
    db.prepare(`
      INSERT INTO curriculum_units (unit_id, course_code, unit_key, ordinal, title, topic, created_at, updated_at)
      VALUES ('course-internal-verified:u1', 'course-internal-verified', 'u1', 1, 'Bài 1 Thử nghiệm', 'Thử nghiệm', ?, ?)
    `).run(now, now)
    db.prepare(`
      INSERT INTO curriculum_units (unit_id, course_code, unit_key, ordinal, title, topic, created_at, updated_at)
      VALUES ('course-private-restricted:u1', 'course-private-restricted', 'u1', 1, 'Bài 1 Tối mật', 'Tối mật', ?, ?)
    `).run(now, now)

    // --- Terms ---
    db.prepare(`
      INSERT INTO curriculum_terms (term_id, normalized_key, display_word, display_reading, meanings, han_viet, examples, raw_source_references, created_at, updated_at)
      VALUES ('term-01', 'こんにちは', 'こんにちは', '', '["xin chào"]', NULL, '[{"ja":"こんにちは、元気ですか","vi":"Xin chào, bạn khỏe không?"}]', '[{"source":"raw"}]', ?, ?)
    `).run(now, now)
    db.prepare(`
      INSERT INTO curriculum_terms (term_id, normalized_key, display_word, display_reading, meanings, han_viet, examples, raw_source_references, created_at, updated_at)
      VALUES ('term-02', 'いくら', '幾ら', 'いくら', '["bao nhiêu tiền"]', 'CƠ', '[{"ja":"これはいくらですか","vi":"Cái này bao nhiêu tiền?"}]', '[{"source":"raw"}]', ?, ?)
    `).run(now, now)
    db.prepare(`
      INSERT INTO curriculum_terms (term_id, normalized_key, display_word, display_reading, meanings, han_viet, examples, raw_source_references, created_at, updated_at)
      VALUES ('term-03', 'さようなら', 'さようなら', '', '["tạm biệt"]', NULL, '[]', '[{"source":"raw"}]', ?, ?)
    `).run(now, now)
    db.prepare(`
      INSERT INTO curriculum_terms (term_id, normalized_key, display_word, display_reading, meanings, han_viet, examples, raw_source_references, created_at, updated_at)
      VALUES ('term-secret', 'ひみつ', '秘密', 'ひみつ', '["bí mật"]', 'BÍ MẬT', '[{"ja":"これは秘密です","vi":"Đây là bí mật"}]', '[{"source":"raw"}]', ?, ?)
    `).run(now, now)

    // --- Course Terms ---
    db.prepare(`
      INSERT INTO curriculum_course_terms (course_code, unit_id, term_id, ordinal, source_record_id, created_at, updated_at)
      VALUES ('course-n5-verified', 'course-n5-verified:u1', 'term-01', 1, '1', ?, ?)
    `).run(now, now)
    db.prepare(`
      INSERT INTO curriculum_course_terms (course_code, unit_id, term_id, ordinal, source_record_id, created_at, updated_at)
      VALUES ('course-n4-licensed', 'course-n4-licensed:u1', 'term-02', 1, '2', ?, ?)
    `).run(now, now)
    db.prepare(`
      INSERT INTO curriculum_course_terms (course_code, unit_id, term_id, ordinal, source_record_id, created_at, updated_at)
      VALUES ('course-a1-pd', 'course-a1-pd:u1', 'term-03', 1, '3', ?, ?)
    `).run(now, now)
    db.prepare(`
      INSERT INTO curriculum_course_terms (course_code, unit_id, term_id, ordinal, source_record_id, created_at, updated_at)
      VALUES ('course-internal-unknown', 'course-internal-unknown:u1', 'term-secret', 1, '4', ?, ?)
    `).run(now, now)
    db.prepare(`
      INSERT INTO curriculum_course_terms (course_code, unit_id, term_id, ordinal, source_record_id, created_at, updated_at)
      VALUES ('course-public-unknown', 'course-public-unknown:u1', 'term-secret', 1, '5', ?, ?)
    `).run(now, now)
    db.prepare(`
      INSERT INTO curriculum_course_terms (course_code, unit_id, term_id, ordinal, source_record_id, created_at, updated_at)
      VALUES ('course-internal-verified', 'course-internal-verified:u1', 'term-secret', 1, '6', ?, ?)
    `).run(now, now)
    db.prepare(`
      INSERT INTO curriculum_course_terms (course_code, unit_id, term_id, ordinal, source_record_id, created_at, updated_at)
      VALUES ('course-private-restricted', 'course-private-restricted:u1', 'term-secret', 1, '7', ?, ?)
    `).run(now, now)

    return db
  }

  // --- Parameter Sanitation & Rights Helper Unit Tests ---

  test('isCoursePublicAndApproved helper strictly evaluates public visibility and approved rights', () => {
    assert.deepEqual([...PUBLIC_VISIBILITIES], ['public', 'unlisted'])
    assert.deepEqual([...APPROVED_RIGHTS_STATUSES], ['verified', 'public_domain', 'licensed'])

    assert.equal(isCoursePublicAndApproved(null), false)
    assert.equal(isCoursePublicAndApproved(undefined), false)

    // Allowed combinations
    assert.equal(isCoursePublicAndApproved({ visibility: 'public', rights_status: 'verified' }), true)
    assert.equal(isCoursePublicAndApproved({ visibility: 'public', rights_status: 'licensed' }), true)
    assert.equal(isCoursePublicAndApproved({ visibility: 'public', rights_status: 'public_domain' }), true)
    assert.equal(isCoursePublicAndApproved({ visibility: 'unlisted', rights_status: 'verified' }), true)
    assert.equal(isCoursePublicAndApproved({ visibility: 'unlisted', rights_status: 'licensed' }), true)
    assert.equal(isCoursePublicAndApproved({ visibility: 'unlisted', rights_status: 'public_domain' }), true)

    // Blocked combinations
    assert.equal(isCoursePublicAndApproved({ visibility: 'internal', rights_status: 'unknown' }), false)
    assert.equal(isCoursePublicAndApproved({ visibility: 'public', rights_status: 'unknown' }), false)
    assert.equal(isCoursePublicAndApproved({ visibility: 'unlisted', rights_status: 'unknown' }), false)
    assert.equal(isCoursePublicAndApproved({ visibility: 'internal', rights_status: 'verified' }), false)
    assert.equal(isCoursePublicAndApproved({ visibility: 'private', rights_status: 'verified' }), false)
    assert.equal(isCoursePublicAndApproved({ visibility: 'private', rights_status: 'restricted' }), false)
  })

  test('sanitizePagination correctly parses and validates pagination', () => {
    assert.deepEqual(sanitizePagination(undefined, undefined, 20), { page: 1, limit: 20, offset: 0 })
    assert.deepEqual(sanitizePagination('2', '50'), { page: 2, limit: 50, offset: 50 })

    // Invalid limit > 100
    assert.throws(() => sanitizePagination('1', '101'), (err) => {
      return err instanceof CatalogApiError && err.status === 400 && err.code === 'INVALID_LIMIT'
    })

    // Invalid limit <= 0
    assert.throws(() => sanitizePagination('1', '0'), (err) => {
      return err instanceof CatalogApiError && err.status === 400 && err.code === 'INVALID_LIMIT'
    })
    assert.throws(() => sanitizePagination('1', '-5'), (err) => err.code === 'INVALID_LIMIT')
    assert.throws(() => sanitizePagination('1', 'invalid'), (err) => err.code === 'INVALID_LIMIT')

    // Invalid page <= 0
    assert.throws(() => sanitizePagination('0', '20'), (err) => {
      return err instanceof CatalogApiError && err.status === 400 && err.code === 'INVALID_PAGE'
    })
    assert.throws(() => sanitizePagination('-1', '20'), (err) => err.code === 'INVALID_PAGE')
    assert.throws(() => sanitizePagination('abc', '20'), (err) => err.code === 'INVALID_PAGE')
  })

  test('sanitizeLevel validates JLPT and standard levels strictly', () => {
    assert.equal(sanitizeLevel(''), null)
    assert.equal(sanitizeLevel(null), null)
    assert.equal(sanitizeLevel('ALL'), null)
    assert.equal(sanitizeLevel('n5'), 'N5')
    assert.equal(sanitizeLevel('N1'), 'N1')
    assert.equal(sanitizeLevel('se'), 'SE')
    assert.equal(sanitizeLevel('A1'), 'A1')

    assert.throws(() => sanitizeLevel('B2'), (err) => {
      return err instanceof CatalogApiError && err.status === 400 && err.code === 'INVALID_LEVEL'
    })
    assert.throws(() => sanitizeLevel('N6'), (err) => err.code === 'INVALID_LEVEL')
  })

  // --- Mock DB Catalog & Search Contract Tests ---

  test('Catalog public browse only returns approved courses (visibility public/unlisted AND rights verified/licensed/public_domain)', async () => {
    const db = createMockDatabase()
    try {
      const service = new CurriculumCatalogService({ db })
      const res = await service.getCatalog({ page: 1, limit: 10 })

      // Out of 7 courses seeded in mock DB, exactly 3 approved courses must be returned
      assert.equal(res.pagination.total, 3, 'Total public courses must be exactly 3')
      assert.equal(res.items.length, 3)
      assert.equal(res.pagination.page, 1)
      assert.equal(res.pagination.totalPages, 1)

      const returnedCodes = res.items.map((c) => c.course_code)
      assert.ok(returnedCodes.includes('course-n5-verified'))
      assert.ok(returnedCodes.includes('course-n4-licensed'))
      assert.ok(returnedCodes.includes('course-a1-pd'))

      // Strictly verify unapproved courses are NOT in catalog
      assert.ok(!returnedCodes.includes('course-internal-unknown'), 'internal+unknown course must NOT appear in catalog')
      assert.ok(!returnedCodes.includes('course-public-unknown'), 'public+unknown course must NOT appear in catalog')
      assert.ok(!returnedCodes.includes('course-internal-verified'), 'internal+verified course must NOT appear in catalog')
      assert.ok(!returnedCodes.includes('course-private-restricted'), 'private+restricted course must NOT appear in catalog')

      // Check aggregated counts (single query, no N+1)
      for (const item of res.items) {
        assert.equal(item.unit_count, 1)
        assert.equal(item.term_count, 1)
      }
    } finally {
      db.close()
    }
  })

  test('Catalog pagination on approved courses fixture', async () => {
    const db = createMockDatabase()
    try {
      const service = new CurriculumCatalogService({ db })

      // Page 1 with limit 2
      const page1 = await service.getCatalog({ page: 1, limit: 2 })
      assert.equal(page1.items.length, 2)
      assert.equal(page1.pagination.page, 1)
      assert.equal(page1.pagination.limit, 2)
      assert.equal(page1.pagination.total, 3)
      assert.equal(page1.pagination.totalPages, 2)

      // Page 2 with limit 2
      const page2 = await service.getCatalog({ page: 2, limit: 2 })
      assert.equal(page2.items.length, 1)
      assert.equal(page2.pagination.page, 2)
      assert.equal(page2.pagination.total, 3)

      // Verify no duplicate courses across page 1 and page 2
      const page1Codes = page1.items.map((c) => c.course_code)
      const page2Codes = page2.items.map((c) => c.course_code)
      for (const code of page2Codes) {
        assert.ok(!page1Codes.includes(code), `Duplicate item across pages: ${code}`)
      }
    } finally {
      db.close()
    }
  })

  test('Catalog level filtering and keyword search on approved courses', async () => {
    const db = createMockDatabase()
    try {
      const service = new CurriculumCatalogService({ db })

      // Filter level N5
      const resN5 = await service.getCatalog({ level: 'N5' })
      assert.equal(resN5.items.length, 1)
      assert.equal(resN5.items[0].course_code, 'course-n5-verified')

      // Filter level N4
      const resN4 = await service.getCatalog({ level: 'N4' })
      assert.equal(resN4.items.length, 1)
      assert.equal(resN4.items[0].course_code, 'course-n4-licensed')

      // Filter level N3 (only unapproved course has N3 -> result must be 0)
      const resN3 = await service.getCatalog({ level: 'N3' })
      assert.equal(resN3.items.length, 0)
      assert.equal(resN3.pagination.total, 0)

      // Keyword search q = "Giao Tiếp"
      const resQ = await service.getCatalog({ q: 'Giao Tiếp' })
      assert.equal(resQ.items.length, 1)
      assert.equal(resQ.items[0].course_code, 'course-n4-licensed')

      // Keyword search for something in unapproved course -> must return 0
      const resSecret = await service.getCatalog({ q: 'Nội bộ' })
      assert.equal(resSecret.items.length, 0)
      assert.equal(resSecret.pagination.total, 0)
    } finally {
      db.close()
    }
  })

  // --- Contract Tests: Direct Endpoint Access on Approved vs Unapproved Courses ---

  test('Approved courses allow course detail, unit detail, and unit terms with examples', async () => {
    const db = createMockDatabase()
    try {
      const service = new CurriculumCatalogService({ db })

      // 1. Course detail
      const courseRes = await service.getCourseDetail('course-n5-verified')
      assert.equal(courseRes.course.course_code, 'course-n5-verified')
      assert.equal(courseRes.course.rights_status, 'verified')
      assert.equal(courseRes.units.length, 1)
      assert.equal(courseRes.units[0].unit_key, 'u1')
      assert.equal(courseRes.units[0].term_count, 1)

      // 2. Unit detail (returns unit metadata only, no terms)
      const unitRes = await service.getUnitDetail('course-n5-verified', 'u1')
      assert.equal(unitRes.course.course_code, 'course-n5-verified')
      assert.equal(unitRes.unit.unit_key, 'u1')
      assert.equal(unitRes.unit.title, 'Bài 1 Chào hỏi')
      assert.equal(unitRes.unit.term_count, 1)
      assert.equal(unitRes.terms, undefined)
      assert.equal(unitRes.items, undefined)

      // 3. Unit terms (delivers terms and examples for verified rights)
      const termsRes = await service.getUnitTerms('course-n5-verified', 'u1')
      assert.equal(termsRes.items.length, 1)
      const term = termsRes.items[0]
      assert.equal(term.display_word, 'こんにちは')
      assert.deepEqual(term.meanings, ['xin chào'])
      assert.equal(term.examples.length, 1)
      assert.equal(term.examples[0].ja, 'こんにちは、元気ですか')
      assert.equal(term.raw_source_references, undefined, 'raw_source_references must never be exposed')

      // 4. Term search within unit
      const searchRes = await service.getUnitTerms('course-n5-verified', 'u1', { q: 'xin chào' })
      assert.equal(searchRes.items.length, 1)
      const searchResNone = await service.getUnitTerms('course-n5-verified', 'u1', { q: 'không có từ này' })
      assert.equal(searchResNone.items.length, 0)
    } finally {
      db.close()
    }
  })

  test('Course/unit/terms endpoints STRICTLY return 403 COURSE_RESTRICTED for internal + unknown course', async () => {
    const db = createMockDatabase()
    try {
      const service = new CurriculumCatalogService({ db })

      // 1. getCourseDetail
      await assert.rejects(
        async () => {
          await service.getCourseDetail('course-internal-unknown')
        },
        (err) => {
          return (
            err instanceof CatalogApiError &&
            err.status === 403 &&
            err.code === 'COURSE_RESTRICTED' &&
            err.message.includes('chưa được cấp phép công khai')
          )
        }
      )

      // 2. getUnitDetail
      await assert.rejects(
        async () => {
          await service.getUnitDetail('course-internal-unknown', 'u1')
        },
        (err) => {
          return err instanceof CatalogApiError && err.status === 403 && err.code === 'COURSE_RESTRICTED'
        }
      )

      // 3. getUnitTerms (NEVER leak display_word, meanings, or terms)
      await assert.rejects(
        async () => {
          await service.getUnitTerms('course-internal-unknown', 'u1')
        },
        (err) => {
          return err instanceof CatalogApiError && err.status === 403 && err.code === 'COURSE_RESTRICTED'
        }
      )
    } finally {
      db.close()
    }
  })

  test('Course/unit/terms endpoints return 403 for public+unknown, internal+verified, and private+restricted', async () => {
    const db = createMockDatabase()
    try {
      const service = new CurriculumCatalogService({ db })

      const restrictedCodes = [
        'course-public-unknown', // public visibility but unknown rights
        'course-internal-verified', // verified rights but internal visibility
        'course-private-restricted', // private visibility and restricted rights
      ]

      for (const code of restrictedCodes) {
        // Course detail must 403
        await assert.rejects(
          async () => {
            await service.getCourseDetail(code)
          },
          (err) => err instanceof CatalogApiError && err.status === 403 && err.code === 'COURSE_RESTRICTED'
        )

        // Unit detail must 403
        await assert.rejects(
          async () => {
            await service.getUnitDetail(code, 'u1')
          },
          (err) => err instanceof CatalogApiError && err.status === 403 && err.code === 'COURSE_RESTRICTED'
        )

        // Unit terms must 403
        await assert.rejects(
          async () => {
            await service.getUnitTerms(code, 'u1')
          },
          (err) => err instanceof CatalogApiError && err.status === 403 && err.code === 'COURSE_RESTRICTED'
        )
      }
    } finally {
      db.close()
    }
  })

  test('Non-existent course and unit return 404', async () => {
    const db = createMockDatabase()
    try {
      const service = new CurriculumCatalogService({ db })

      await assert.rejects(
        async () => {
          await service.getCourseDetail('non-existent-course')
        },
        (err) => err instanceof CatalogApiError && err.status === 404 && err.code === 'COURSE_NOT_FOUND'
      )

      await assert.rejects(
        async () => {
          await service.getUnitDetail('course-n5-verified', 'non-existent-unit')
        },
        (err) => err instanceof CatalogApiError && err.status === 404 && err.code === 'UNIT_NOT_FOUND'
      )

      await assert.rejects(
        async () => {
          await service.getUnitTerms('course-n5-verified', 'non-existent-unit')
        },
        (err) => err instanceof CatalogApiError && err.status === 404 && err.code === 'UNIT_NOT_FOUND'
      )
    } finally {
      db.close()
    }
  })

  // --- Real Database Contract Tests ---

  test('Real database: all 19 imported courses are internal/unknown -> catalog returns 0 courses, direct access returns 403', async () => {
    if (!hasRealDb) return

    const service = new CurriculumCatalogService({ sqlitePath: realSqlitePath })

    // 1. Catalog public browse must return 0 courses because none have visibility public/unlisted with approved rights
    const catalogRes = await service.getCatalog({ page: 1, limit: 20 })
    assert.equal(catalogRes.items.length, 0, 'Real database catalog items must be empty')
    assert.equal(catalogRes.pagination.total, 0, 'Real database catalog total must be 0')
    assert.equal(catalogRes.pagination.totalPages, 0)

    // 2. Direct course access to minna-n5-standard must reject with 403 COURSE_RESTRICTED
    await assert.rejects(
      async () => {
        await service.getCourseDetail('minna-n5-standard')
      },
      (err) => {
        return (
          err instanceof CatalogApiError &&
          err.status === 403 &&
          err.code === 'COURSE_RESTRICTED' &&
          err.message.includes('chưa được cấp phép công khai')
        )
      }
    )

    // 3. Direct unit access to minna-n5-standard bai-01 must reject with 403 COURSE_RESTRICTED
    await assert.rejects(
      async () => {
        await service.getUnitDetail('minna-n5-standard', 'bai-01')
      },
      (err) => {
        return err instanceof CatalogApiError && err.status === 403 && err.code === 'COURSE_RESTRICTED'
      }
    )

    // 4. Direct unit terms access to minna-n5-standard bai-01 must reject with 403 COURSE_RESTRICTED (ZERO LEAK)
    await assert.rejects(
      async () => {
        await service.getUnitTerms('minna-n5-standard', 'bai-01')
      },
      (err) => {
        return err instanceof CatalogApiError && err.status === 403 && err.code === 'COURSE_RESTRICTED'
      }
    )

    // 5. Test another imported course (e.g. soumatome-goi-n3)
    await assert.rejects(
      async () => {
        await service.getCourseDetail('soumatome-goi-n3')
      },
      (err) => err instanceof CatalogApiError && err.status === 403 && err.code === 'COURSE_RESTRICTED'
    )
  })

  // --- End-to-End HTTP Contract Server Tests ---

  test('HTTP Contract Server: public browse, approved reading, strict 403 restriction, and legacy non-regression', async () => {
    const db = createMockDatabase()
    const service = new CurriculumCatalogService({ db })

    // Minimal lightweight HTTP handler matching server/index.mjs logic
    const server = http.createServer(async (req, res) => {
      const host = req.headers.host || 'localhost'
      const url = new URL(req.url, `http://${host}`)
      const path = url.pathname

      const json = (status, body) => {
        res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify(body))
      }

      if (req.method === 'GET' && path === '/api/v1/curriculum/catalog') {
        try {
          const level = url.searchParams.get('level')
          const q = url.searchParams.get('q')
          const page = url.searchParams.get('page')
          const limit = url.searchParams.get('limit')
          const data = await service.getCatalog({ level, q, page, limit })
          return json(200, { data })
        } catch (err) {
          return json(err.status || 500, { message: err.message, code: err.code })
        }
      }

      const termsMatch = path.match(/^\/api\/v1\/curriculum\/courses\/([^/]+)\/units\/([^/]+)\/terms$/)
      if (req.method === 'GET' && termsMatch) {
        try {
          const courseCode = decodeURIComponent(termsMatch[1])
          const unitKey = decodeURIComponent(termsMatch[2])
          const q = url.searchParams.get('q')
          const page = url.searchParams.get('page')
          const limit = url.searchParams.get('limit')
          const data = await service.getUnitTerms(courseCode, unitKey, { page, limit, q })
          return json(200, { data })
        } catch (err) {
          return json(err.status || 500, { message: err.message, code: err.code })
        }
      }

      const unitMatch = path.match(/^\/api\/v1\/curriculum\/courses\/([^/]+)\/units\/([^/]+)$/)
      if (req.method === 'GET' && unitMatch) {
        try {
          const courseCode = decodeURIComponent(unitMatch[1])
          const unitKey = decodeURIComponent(unitMatch[2])
          const data = await service.getUnitDetail(courseCode, unitKey)
          return json(200, { data })
        } catch (err) {
          return json(err.status || 500, { message: err.message, code: err.code })
        }
      }

      const courseMatch = path.match(/^\/api\/v1\/curriculum\/courses\/([^/]+)$/)
      if (req.method === 'GET' && courseMatch) {
        try {
          const courseCode = decodeURIComponent(courseMatch[1])
          const data = await service.getCourseDetail(courseCode)
          return json(200, { data })
        } catch (err) {
          return json(err.status || 500, { message: err.message, code: err.code })
        }
      }

      // Legacy endpoint non-regression mock
      if (req.method === 'GET' && path === '/api/v1/curriculum/words') {
        return json(200, { data: { items: [], total: 0 } })
      }

      return json(404, { message: 'Not found', code: 'NOT_FOUND' })
    })

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    const baseUrl = `http://127.0.0.1:${address.port}`

    try {
      // 1. GET /catalog?limit=2
      const res1 = await fetch(`${baseUrl}/api/v1/curriculum/catalog?limit=2`)
      assert.equal(res1.status, 200)
      const body1 = await res1.json()
      assert.equal(body1.data.items.length, 2)
      assert.equal(body1.data.pagination.page, 1)
      assert.equal(body1.data.pagination.total, 3)

      // 2. GET /catalog?limit=150 (invalid limit -> 400)
      const resInvalidLimit = await fetch(`${baseUrl}/api/v1/curriculum/catalog?limit=150`)
      assert.equal(resInvalidLimit.status, 400)
      const bodyInvalidLimit = await resInvalidLimit.json()
      assert.equal(bodyInvalidLimit.code, 'INVALID_LIMIT')

      // 3. GET /catalog?level=INVALID (invalid level -> 400)
      const resInvalidLevel = await fetch(`${baseUrl}/api/v1/curriculum/catalog?level=INVALID`)
      assert.equal(resInvalidLevel.status, 400)
      const bodyInvalidLevel = await resInvalidLevel.json()
      assert.equal(bodyInvalidLevel.code, 'INVALID_LEVEL')

      // 4. GET /courses/:courseCode (approved course -> 200)
      const resCourse = await fetch(`${baseUrl}/api/v1/curriculum/courses/course-n5-verified`)
      assert.equal(resCourse.status, 200)
      const bodyCourse = await resCourse.json()
      assert.equal(bodyCourse.data.course.course_code, 'course-n5-verified')
      assert.equal(bodyCourse.data.units.length, 1)

      // 5. GET /courses/:courseCode (internal/unknown course -> 403 COURSE_RESTRICTED)
      const resRestricted = await fetch(`${baseUrl}/api/v1/curriculum/courses/course-internal-unknown`)
      assert.equal(resRestricted.status, 403)
      const bodyRestricted = await resRestricted.json()
      assert.equal(bodyRestricted.code, 'COURSE_RESTRICTED')

      // 6. GET /courses/:courseCode/units/:unitKey (internal/unknown -> 403 COURSE_RESTRICTED)
      const resUnitRestricted = await fetch(`${baseUrl}/api/v1/curriculum/courses/course-internal-unknown/units/u1`)
      assert.equal(resUnitRestricted.status, 403)
      const bodyUnitRestricted = await resUnitRestricted.json()
      assert.equal(bodyUnitRestricted.code, 'COURSE_RESTRICTED')

      // 7. GET /courses/:courseCode/units/:unitKey/terms (internal/unknown -> 403 COURSE_RESTRICTED)
      const resTermsRestricted = await fetch(`${baseUrl}/api/v1/curriculum/courses/course-internal-unknown/units/u1/terms`)
      assert.equal(resTermsRestricted.status, 403)
      const bodyTermsRestricted = await resTermsRestricted.json()
      assert.equal(bodyTermsRestricted.code, 'COURSE_RESTRICTED')

      // 8. GET /courses/:courseCode (unknown -> 404)
      const resUnknownCourse = await fetch(`${baseUrl}/api/v1/curriculum/courses/non-existent-course`)
      assert.equal(resUnknownCourse.status, 404)
      const bodyUnknown = await resUnknownCourse.json()
      assert.equal(bodyUnknown.code, 'COURSE_NOT_FOUND')

      // 9. GET /courses/:courseCode/units/:unitKey (approved course -> 200)
      const resUnit = await fetch(`${baseUrl}/api/v1/curriculum/courses/course-n5-verified/units/u1`)
      assert.equal(resUnit.status, 200)
      const bodyUnit = await resUnit.json()
      assert.equal(bodyUnit.data.unit.unit_key, 'u1')
      assert.equal(bodyUnit.data.items, undefined)

      // 10. GET /courses/:courseCode/units/:unitKey/terms (approved course -> 200)
      const resTerms = await fetch(`${baseUrl}/api/v1/curriculum/courses/course-n5-verified/units/u1/terms`)
      assert.equal(resTerms.status, 200)
      const bodyTerms = await resTerms.json()
      assert.equal(bodyTerms.data.items.length, 1)
      assert.equal(bodyTerms.data.items[0].display_word, 'こんにちは')

      // 11. Legacy /api/v1/curriculum/words returns 200
      const resLegacy = await fetch(`${baseUrl}/api/v1/curriculum/words`)
      assert.equal(resLegacy.status, 200)
    } finally {
      server.close()
      db.close()
    }
  })

  test('HTTP Contract Server with Real DB: catalog returns 0, minna endpoints return 403', async () => {
    if (!hasRealDb) return

    const service = new CurriculumCatalogService({ sqlitePath: realSqlitePath })

    const server = http.createServer(async (req, res) => {
      const host = req.headers.host || 'localhost'
      const url = new URL(req.url, `http://${host}`)
      const path = url.pathname

      const json = (status, body) => {
        res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify(body))
      }

      if (req.method === 'GET' && path === '/api/v1/curriculum/catalog') {
        try {
          const level = url.searchParams.get('level')
          const q = url.searchParams.get('q')
          const page = url.searchParams.get('page')
          const limit = url.searchParams.get('limit')
          const data = await service.getCatalog({ level, q, page, limit })
          return json(200, { data })
        } catch (err) {
          return json(err.status || 500, { message: err.message, code: err.code })
        }
      }

      const termsMatch = path.match(/^\/api\/v1\/curriculum\/courses\/([^/]+)\/units\/([^/]+)\/terms$/)
      if (req.method === 'GET' && termsMatch) {
        try {
          const courseCode = decodeURIComponent(termsMatch[1])
          const unitKey = decodeURIComponent(termsMatch[2])
          const data = await service.getUnitTerms(courseCode, unitKey)
          return json(200, { data })
        } catch (err) {
          return json(err.status || 500, { message: err.message, code: err.code })
        }
      }

      const unitMatch = path.match(/^\/api\/v1\/curriculum\/courses\/([^/]+)\/units\/([^/]+)$/)
      if (req.method === 'GET' && unitMatch) {
        try {
          const courseCode = decodeURIComponent(unitMatch[1])
          const unitKey = decodeURIComponent(unitMatch[2])
          const data = await service.getUnitDetail(courseCode, unitKey)
          return json(200, { data })
        } catch (err) {
          return json(err.status || 500, { message: err.message, code: err.code })
        }
      }

      const courseMatch = path.match(/^\/api\/v1\/curriculum\/courses\/([^/]+)$/)
      if (req.method === 'GET' && courseMatch) {
        try {
          const courseCode = decodeURIComponent(courseMatch[1])
          const data = await service.getCourseDetail(courseCode)
          return json(200, { data })
        } catch (err) {
          return json(err.status || 500, { message: err.message, code: err.code })
        }
      }

      return json(404, { message: 'Not found', code: 'NOT_FOUND' })
    })

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    const baseUrl = `http://127.0.0.1:${address.port}`

    try {
      // 1. GET /catalog on real DB -> 200 with 0 items
      const resCatalog = await fetch(`${baseUrl}/api/v1/curriculum/catalog`)
      assert.equal(resCatalog.status, 200)
      const bodyCatalog = await resCatalog.json()
      assert.equal(bodyCatalog.data.items.length, 0)
      assert.equal(bodyCatalog.data.pagination.total, 0)

      // 2. GET /courses/minna-n5-standard -> 403 COURSE_RESTRICTED
      const resCourse = await fetch(`${baseUrl}/api/v1/curriculum/courses/minna-n5-standard`)
      assert.equal(resCourse.status, 403)
      const bodyCourse = await resCourse.json()
      assert.equal(bodyCourse.code, 'COURSE_RESTRICTED')

      // 3. GET /courses/minna-n5-standard/units/bai-01 -> 403 COURSE_RESTRICTED
      const resUnit = await fetch(`${baseUrl}/api/v1/curriculum/courses/minna-n5-standard/units/bai-01`)
      assert.equal(resUnit.status, 403)
      const bodyUnit = await resUnit.json()
      assert.equal(bodyUnit.code, 'COURSE_RESTRICTED')

      // 4. GET /courses/minna-n5-standard/units/bai-01/terms -> 403 COURSE_RESTRICTED
      const resTerms = await fetch(`${baseUrl}/api/v1/curriculum/courses/minna-n5-standard/units/bai-01/terms`)
      assert.equal(resTerms.status, 403)
      const bodyTerms = await resTerms.json()
      assert.equal(bodyTerms.code, 'COURSE_RESTRICTED')
    } finally {
      server.close()
    }
  })

  test('Storage configuration: strictly isolates SQLite and PostgreSQL without silent fallback', async () => {
    const memoryDb = createMockDatabase()

    // Create a dummy PostgreSQL pool that simulates a Postgres connection without curriculum tables
    let pgQueryCallCount = 0
    const mockPgPool = {
      query: async () => {
        pgQueryCallCount++
        const error = new Error('relation "curriculum_courses" does not exist')
        error.code = '42P01'
        throw error
      },
    }

    // 1. With storage = 'sqlite' (or default): strictly uses SQLite, NEVER calls Postgres pool
    const sqliteService = new CurriculumCatalogService({
      storage: 'sqlite',
      db: memoryDb,
      pool: mockPgPool,
    })
    assert.equal(sqliteService.getStorageType(), 'sqlite')
    assert.equal(sqliteService.isAvailable(), true)

    const catalog = await sqliteService.getCatalog()
    assert.equal(pgQueryCallCount, 0, 'PostgreSQL pool should NEVER be called when storage is sqlite')
    assert.equal(catalog.items.length, 3, 'Should read approved courses from SQLite')

    // 2. With storage = 'postgres': strictly calls Postgres, NEVER silently falls back to SQLite
    const pgService = new CurriculumCatalogService({
      storage: 'postgres',
      db: memoryDb,
      pool: mockPgPool,
    })
    assert.equal(pgService.getStorageType(), 'postgres')
    assert.equal(pgService.isAvailable(), true)

    await assert.rejects(
      async () => {
        await pgService.getCatalog()
      },
      (err) => {
        assert.equal(err.code, '42P01')
        assert.match(err.message, /curriculum_courses/i)
        return true
      },
      'Should throw Postgres error directly and NOT silently fallback to SQLite'
    )
    assert.equal(pgQueryCallCount, 1, 'PostgreSQL pool must have been called exactly once')

    // 3. Storage rejection on invalid input
    assert.throws(
      () => new CurriculumCatalogService({ storage: 'dynamodb' }),
      /Invalid CURRICULUM_STORAGE/
    )
  })

  test('Local dev integration: /api/v1/curriculum/catalog returns 200 with empty audit notice from SQLite even when PostgreSQL pool lacks curriculum tables', async () => {
    // This test directly verifies the user's issue:
    // When local dev runs with a PostgreSQL pool for auth/users that DOES NOT have curriculum tables,
    // the curriculum catalog must use SQLite at CURRICULUM_SQLITE_PATH and return 200 (not 500!).

    // Dummy PG pool without curriculum tables
    const mockPgPoolWithoutCurriculum = {
      query: async () => {
        const error = new Error('relation "curriculum_courses" does not exist')
        error.code = '42P01'
        throw error
      },
    }

    // Local dev service configured with CURRICULUM_STORAGE=sqlite and real SQLite path
    const localDevCatalogService = new CurriculumCatalogService({
      storage: 'sqlite',
      pool: mockPgPoolWithoutCurriculum,
      sqlitePath: realSqlitePath,
    })

    assert.equal(localDevCatalogService.getStorageType(), 'sqlite')

    // Spin up an actual HTTP server matching server/index.mjs routing
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1')
      const json = (status, body) => {
        res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify(body))
      }

      if (req.method === 'GET' && url.pathname === '/api/v1/curriculum/catalog') {
        try {
          const level = url.searchParams.get('level')
          const q = url.searchParams.get('q')
          const page = url.searchParams.get('page')
          const limit = url.searchParams.get('limit')
          const result = await localDevCatalogService.getCatalog({ level, q, page, limit })
          return json(200, result)
        } catch (err) {
          if (err instanceof CatalogApiError) {
            return json(err.status, { message: err.message, code: err.code })
          }
          return json(500, { message: 'Lỗi hệ thống khi tải danh mục giáo trình.', code: 'SERVER_ERROR' })
        }
      }

      return json(404, { message: 'Not found', code: 'NOT_FOUND' })
    })

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    const baseUrl = `http://127.0.0.1:${address.port}`

    try {
      const response = await fetch(`${baseUrl}/api/v1/curriculum/catalog`)
      assert.equal(response.status, 200, 'HTTP status must be 200, NOT 500!')

      const body = await response.json()
      assert.ok(Array.isArray(body.items), 'Response items must be an array')
      assert.equal(body.items.length, 0, 'Items should be empty in real DB pending audit approval')
      assert.equal(body.pagination.total, 0, 'Pagination total must be 0')
    } finally {
      server.close()
    }
  })
})
