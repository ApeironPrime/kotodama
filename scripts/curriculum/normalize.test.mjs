import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {
  normalizeText,
  normalizePunctuation,
  extractMeanings,
  deriveCourseCode,
  deriveUnitInfo,
  generateTermId,
  normalizeDataset,
} from './normalize.mjs'
import { validateDataset } from './canonical-schema.mjs'

describe('normalize.mjs pipeline', () => {
  test('Helper functions normalize strings, extract meanings, derive codes and term IDs', () => {
    assert.equal(normalizeText('  こんにちは \u3000 日本  '), 'こんにちは 日本')
    assert.equal(normalizePunctuation('~さん'), '～さん')
    assert.deepEqual(extractMeanings('Tôi; Bản thân; tôi'), ['Tôi', 'Bản thân'])

    const course = deriveCourseCode('Minna no Nihongo N5', 'N5')
    assert.equal(course.courseCode, 'minna-n5-standard')
    assert.equal(course.level, 'N5')

    const unit = deriveUnitInfo('minna-n5-standard', 'Minna Bài 5')
    assert.equal(unit.unitId, 'minna-n5-standard:bai-05')
    assert.equal(unit.ordinal, 5)

    const termId1 = generateTermId('本', 'ほん', 'Sách')
    const termId2 = generateTermId('本', 'ほん', 'Sách')
    const termId3 = generateTermId('本', 'もと', 'Gốc')
    assert.equal(termId1, termId2)
    assert.notEqual(termId1, termId3)
  })

  test('NFC normalization converts decomposed characters to precomposed', () => {
    const fixturePath = path.resolve('scripts/curriculum/fixtures/nfc-test.json')
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
    const dataset = normalizeDataset(raw, 'test-manifest-hash')

    assert.equal(dataset.terms.length, 1)
    const term = dataset.terms[0]
    // \u304B\u3099\u3063\u3053\u3046 should become がっこう (\u304C\u3063\u3053\u3046)
    assert.equal(term.normalized_key, 'がっこう')
    assert.equal(term.display_reading, 'がっこう')
    assert.equal(term.han_viet, 'HỌC HIỆU')
    assert.equal(term.meanings[0], 'Trường học')
  })

  test('Explicit course metadata preserves one source course per stable course code', () => {
    const dataset = normalizeDataset(
      [
        {
          word: '日本語',
          reading: '',
          han_viet: '',
          meaning: 'tiếng Nhật',
          level: 'N5',
          lesson: 'Bài 1',
          source: 'Mazii course export',
          course_code: 'mazii-5163517-jlpt-n5',
          course_title: 'JLPT N5',
          course_level: 'N5',
          course_provider_source: 'Mazii · Premium Mazii',
          example: '',
          example_vi: '',
        },
      ],
      'test-manifest-hash'
    )

    assert.equal(dataset.courses.length, 1)
    assert.deepEqual(dataset.courses[0], {
      course_code: 'mazii-5163517-jlpt-n5',
      title: 'JLPT N5',
      level: 'N5',
      provider_source: 'Mazii · Premium Mazii',
      visibility: 'internal',
      rights_status: 'unknown',
    })
    assert.equal(dataset.units[0].course_code, 'mazii-5163517-jlpt-n5')
  })

  test('Missing fields are flagged as warnings and corrupt entries rejected', () => {
    const fixturePath = path.resolve('scripts/curriculum/fixtures/missing-fields.json')
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
    const dataset = normalizeDataset(raw, 'test-manifest-hash')

    // Record (ミルク) with no reading and no meaning must be rejected
    assert.equal(dataset.import_run.error_count, 1)
    assert.equal(dataset.import_run.reject_list[0].word, '(ミルク)')

    // 3 valid terms accepted (こんにちは, 吸います, 止 まれ)
    assert.equal(dataset.terms.length, 3)

    // Warnings must record missing reading, missing meaning, and vietnamese reading
    const warnings = dataset.import_run.warnings
    assert.ok(warnings.some((w) => w.code === 'MISSING_READING'))
    assert.ok(warnings.some((w) => w.code === 'MISSING_MEANING'))
    assert.ok(warnings.some((w) => w.code === 'READING_CONTAINS_VIETNAMESE'))
  })

  test('Valid identical duplicates are merged into 1 canonical term with multiple source refs', () => {
    const fixturePath = path.resolve('scripts/curriculum/fixtures/identical-duplicates.json')
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
    const dataset = normalizeDataset(raw, 'test-manifest-hash')

    // 3 records of "私", "わたし", "Tôi" from different courses
    assert.equal(dataset.terms.length, 1)
    const term = dataset.terms[0]
    assert.equal(term.normalized_key, '私')
    assert.equal(term.display_reading, 'わたし')
    assert.equal(term.raw_source_references.length, 3)

    // Course terms must preserve individual course memberships (3 course terms)
    assert.equal(dataset.course_terms.length, 3)
    assert.equal(dataset.stats.exactDuplicatesMerged, 2)
  })

  test('Conflicting duplicates (homonyms) with different readings or meanings are kept distinct', () => {
    const fixturePath = path.resolve('scripts/curriculum/fixtures/homonym-duplicates.json')
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
    const dataset = normalizeDataset(raw, 'test-manifest-hash')

    // "角" (かど vs つの) and "かける" (Đeo kính vs Treo áo) must yield 4 distinct terms
    assert.equal(dataset.terms.length, 4)

    const kadoTerm = dataset.terms.find((t) => t.normalized_key === '角' && t.display_reading === 'かど')
    const tsunoTerm = dataset.terms.find((t) => t.normalized_key === '角' && t.display_reading === 'つの')
    assert.ok(kadoTerm, 'Should contain 角 (かど)')
    assert.ok(tsunoTerm, 'Should contain 角 (つの)')
    assert.notEqual(kadoTerm.term_id, tsunoTerm.term_id)

    const kakeruDeo = dataset.terms.find((t) => t.normalized_key === 'かける' && t.meanings.some((m) => m.includes('Đeo')))
    const kakeruTreo = dataset.terms.find((t) => t.normalized_key === 'かける' && t.meanings.some((m) => m.includes('Treo')))
    assert.ok(kakeruDeo, 'Should contain かける (Đeo)')
    assert.ok(kakeruTreo, 'Should contain かける (Treo)')
    assert.notEqual(kakeruDeo.term_id, kakeruTreo.term_id)
  })

  test('All courses and course_terms enforce rights_status unknown', () => {
    const fixturePath = path.resolve('scripts/curriculum/fixtures/valid-mini.json')
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
    const dataset = normalizeDataset(raw, 'manifest-hash-123')

    assert.ok(dataset.courses.length > 0)
    for (const c of dataset.courses) {
      assert.equal(c.rights_status, 'unknown')
      assert.equal(c.visibility, 'internal')
    }

    for (const ct of dataset.course_terms) {
      assert.equal(ct.provenance.rights_status, 'unknown')
    }
  })

  test('Output strictly complies with Canonical Dataset Schema', () => {
    const fixturePath = path.resolve('scripts/curriculum/fixtures/valid-mini.json')
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
    const dataset = normalizeDataset(raw, 'test-manifest-hash')

    const validation = validateDataset(dataset)
    assert.equal(validation.valid, true, `Validation errors: ${validation.errors.join(', ')}`)
  })

  test('Vietnamese readings are transferred to meanings and display_reading is empty string', () => {
    const raw = [
      {
        word: '_おじぎをする',
        reading: 'cúi chào',
        han_viet: '',
        meaning: 'cúi chào',
        level: 'N2',
        lesson: 'Bài 29 - Động từ ①',
        source: 'VNJPClub (SPEED_MASTER)',
        example: '',
        example_vi: '',
      },
      {
        word: '止 まれ',
        reading: 'dừng lại',
        han_viet: '',
        meaning: '',
        level: 'N5',
        lesson: 'Bài 23',
        source: 'VNJPClub (MINNA)',
        example: '',
        example_vi: '',
      },
    ]

    const dataset = normalizeDataset(raw, 'test-manifest-hash')
    assert.equal(dataset.terms.length, 2)

    const ojigi = dataset.terms.find((t) => t.display_word === 'おじぎをする')
    assert.ok(ojigi, 'Should normalize _おじぎをする to おじぎをする')
    assert.equal(ojigi.display_reading, '')
    assert.deepEqual(ojigi.meanings, ['cúi chào'])

    const tomare = dataset.terms.find((t) => t.display_word === '止 まれ')
    assert.ok(tomare)
    assert.equal(tomare.display_reading, '')
    assert.deepEqual(tomare.meanings, ['dừng lại'])

    assert.equal(dataset.import_run.warnings.filter((w) => w.code === 'READING_CONTAINS_VIETNAMESE').length, 2)
  })

  test('Canonical dataset never contains imported_at timestamp metadata', () => {
    const fixturePath = path.resolve('scripts/curriculum/fixtures/valid-mini.json')
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
    const dataset = normalizeDataset(raw, 'test-manifest-hash')

    assert.equal(dataset.import_run.imported_at, undefined)
    assert.ok(!('imported_at' in dataset.import_run))
  })

  test('Schema validator checks 100% of items and catches corruption beyond index 100', () => {
    const rawItems = []
    for (let i = 0; i < 110; i++) {
      rawItems.push({
        word: `単語_${i}`,
        reading: `たんご_${i}`,
        han_viet: 'ĐƠN NGỮ',
        meaning: `Từ thứ ${i}`,
        level: 'N5',
        lesson: 'Bài 1',
        source: 'Minna no Nihongo N5',
        example: '',
        example_vi: '',
      })
    }

    const dataset = normalizeDataset(rawItems, 'test-manifest-hash')
    assert.ok(dataset.terms.length >= 105)

    // Baseline validation should pass
    const baseline = validateDataset(dataset)
    assert.equal(baseline.valid, true)

    // Corrupt term 101 with invalid Vietnamese reading
    const corruptDataset = JSON.parse(JSON.stringify(dataset))
    corruptDataset.terms[101].display_reading = 'tiếng việt sai'
    const res = validateDataset(corruptDataset)
    assert.equal(res.valid, false)
    assert.ok(res.errors.some((err) => err.includes('terms[101]') && err.includes('invalid display_reading')))
  })

  test('Schema validator strictly enforces referential integrity', () => {
    const fixturePath = path.resolve('scripts/curriculum/fixtures/valid-mini.json')
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
    const dataset = normalizeDataset(raw, 'test-manifest-hash')

    // 1. Broken course_code
    const badCourse = JSON.parse(JSON.stringify(dataset))
    badCourse.course_terms[0].course_code = 'non-existent-course'
    const resCourse = validateDataset(badCourse)
    assert.equal(resCourse.valid, false)
    assert.ok(resCourse.errors.some((e) => e.includes('non-existent course_code')))

    // 2. Broken unit_id
    const badUnit = JSON.parse(JSON.stringify(dataset))
    badUnit.course_terms[0].unit_id = 'non-existent-unit'
    const resUnit = validateDataset(badUnit)
    assert.equal(resUnit.valid, false)
    assert.ok(resUnit.errors.some((e) => e.includes('non-existent unit_id')))

    // 3. Broken term_id
    const badTerm = JSON.parse(JSON.stringify(dataset))
    badTerm.course_terms[0].term_id = 'non-existent-term'
    const resTerm = validateDataset(badTerm)
    assert.equal(resTerm.valid, false)
    assert.ok(resTerm.errors.some((e) => e.includes('non-existent term_id')))

    // 4. Mismatched unit and course
    const mismatch = JSON.parse(JSON.stringify(dataset))
    mismatch.course_terms[0].course_code = 'speed-master-n5'
    mismatch.courses.push({
      course_code: 'speed-master-n5',
      title: 'Speed Master N5',
      level: 'N5',
      provider_source: 'Speed Master',
      visibility: 'internal',
      rights_status: 'unknown',
    })
    const resMismatch = validateDataset(mismatch)
    assert.equal(resMismatch.valid, false)
    assert.ok(resMismatch.errors.some((e) => e.includes('belongs to course')))

    // 5. Rejects dataset with imported_at in import_run
    const datasetWithTs = JSON.parse(JSON.stringify(dataset))
    datasetWithTs.import_run.imported_at = '2026-09-10T19:00:00Z'
    const resTs = validateDataset(datasetWithTs)
    assert.equal(resTs.valid, false)
    assert.ok(resTs.errors.some((e) => e.includes('import_run.imported_at must not be present')))
  })

  test('Schema validator enforces uniqueness of course_code, unit_id, term_id, and course_term position', () => {
    const fixturePath = path.resolve('scripts/curriculum/fixtures/valid-mini.json')
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
    const dataset = normalizeDataset(raw, 'test-manifest-hash')

    // 1. Duplicate course_code
    const dupCourse = JSON.parse(JSON.stringify(dataset))
    dupCourse.courses.push({ ...dupCourse.courses[0] })
    dupCourse.import_run.total_courses = dupCourse.courses.length
    const resCourse = validateDataset(dupCourse)
    assert.equal(resCourse.valid, false)
    assert.ok(resCourse.errors.some((e) => e.includes('duplicate course_code')))

    // 2. Duplicate unit_id
    const dupUnit = JSON.parse(JSON.stringify(dataset))
    dupUnit.units.push({ ...dupUnit.units[0] })
    dupUnit.import_run.total_units = dupUnit.units.length
    const resUnit = validateDataset(dupUnit)
    assert.equal(resUnit.valid, false)
    assert.ok(resUnit.errors.some((e) => e.includes('duplicate unit_id')))

    // 3. Duplicate term_id
    const dupTerm = JSON.parse(JSON.stringify(dataset))
    dupTerm.terms.push({ ...dupTerm.terms[0] })
    dupTerm.import_run.total_canonical_terms = dupTerm.terms.length
    const resTerm = validateDataset(dupTerm)
    assert.equal(resTerm.valid, false)
    assert.ok(resTerm.errors.some((e) => e.includes('duplicate term_id')))

    // 4. Duplicate position (course_code + unit_id + ordinal)
    const dupPos = JSON.parse(JSON.stringify(dataset))
    dupPos.course_terms.push({ ...dupPos.course_terms[0] })
    dupPos.import_run.total_course_terms = dupPos.course_terms.length
    const resPos = validateDataset(dupPos)
    assert.equal(resPos.valid, false)
    assert.ok(resPos.errors.some((e) => e.includes('duplicate position')))
  })

  test('Schema validator reconciles import_run counts against actual array lengths', () => {
    const fixturePath = path.resolve('scripts/curriculum/fixtures/valid-mini.json')
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
    const dataset = normalizeDataset(raw, 'test-manifest-hash')

    // 1. Modifying total_canonical_terms to 999 must fail
    const badTermsCount = JSON.parse(JSON.stringify(dataset))
    badTermsCount.import_run.total_canonical_terms = 999
    const resTerms = validateDataset(badTermsCount)
    assert.equal(resTerms.valid, false)
    assert.ok(resTerms.errors.some((e) => e.includes('total_canonical_terms (999) does not match terms.length')))

    // 2. Modifying total_courses must fail
    const badCoursesCount = JSON.parse(JSON.stringify(dataset))
    badCoursesCount.import_run.total_courses = 999
    const resCourses = validateDataset(badCoursesCount)
    assert.equal(resCourses.valid, false)
    assert.ok(resCourses.errors.some((e) => e.includes('total_courses (999) does not match courses.length')))

    // 3. Modifying total_units must fail
    const badUnitsCount = JSON.parse(JSON.stringify(dataset))
    badUnitsCount.import_run.total_units = 999
    const resUnits = validateDataset(badUnitsCount)
    assert.equal(resUnits.valid, false)
    assert.ok(resUnits.errors.some((e) => e.includes('total_units (999) does not match units.length')))

    // 4. Modifying total_course_terms must fail
    const badCtCount = JSON.parse(JSON.stringify(dataset))
    badCtCount.import_run.total_course_terms = 999
    const resCt = validateDataset(badCtCount)
    assert.equal(resCt.valid, false)
    assert.ok(resCt.errors.some((e) => e.includes('total_course_terms (999) does not match course_terms.length')))

    // 5. Modifying warning_count must fail
    const badWarnCount = JSON.parse(JSON.stringify(dataset))
    badWarnCount.import_run.warning_count = 999
    const resWarn = validateDataset(badWarnCount)
    assert.equal(resWarn.valid, false)
    assert.ok(resWarn.errors.some((e) => e.includes('warning_count (999) does not match warnings.length')))

    // 6. Modifying error_count must fail
    const badErrCount = JSON.parse(JSON.stringify(dataset))
    badErrCount.import_run.error_count = 999
    const resErr = validateDataset(badErrCount)
    assert.equal(resErr.valid, false)
    assert.ok(resErr.errors.some((e) => e.includes('error_count (999) does not match reject_list.length')))
  })

  test('Schema validator validates nested objects in terms (examples, raw_source_references)', () => {
    const fixturePath = path.resolve('scripts/curriculum/fixtures/valid-mini.json')
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
    const dataset = normalizeDataset(raw, 'test-manifest-hash')

    // 1. raw_source_references[0].source = 42 must fail
    const badSourceRef = JSON.parse(JSON.stringify(dataset))
    badSourceRef.terms[0].raw_source_references[0].source = 42
    const resSource = validateDataset(badSourceRef)
    assert.equal(resSource.valid, false)
    assert.ok(resSource.errors.some((e) => e.includes('raw_source_references[0].source must be a non-empty string')))

    // 2. raw_source_references[0].raw_record_id = {} must fail
    const badRecId = JSON.parse(JSON.stringify(dataset))
    badRecId.terms[0].raw_source_references[0].raw_record_id = {}
    const resRecId = validateDataset(badRecId)
    assert.equal(resRecId.valid, false)
    assert.ok(resRecId.errors.some((e) => e.includes('raw_record_id must be a string or number')))

    // 3. examples[0].ja = '' must fail
    const badExample = JSON.parse(JSON.stringify(dataset))
    badExample.terms[0].examples = [{ ja: '', vi: 'Học sinh' }]
    const resEx = validateDataset(badExample)
    assert.equal(resEx.valid, false)
    assert.ok(resEx.errors.some((e) => e.includes('examples[0].ja must be a non-empty string')))
  })

  test('Schema validator validates nested objects in course_terms (source_record_id, provenance)', () => {
    const fixturePath = path.resolve('scripts/curriculum/fixtures/valid-mini.json')
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
    const dataset = normalizeDataset(raw, 'test-manifest-hash')

    // 1. course_terms[0].source_record_id = {} must fail
    const badCtRecId = JSON.parse(JSON.stringify(dataset))
    badCtRecId.course_terms[0].source_record_id = {}
    const resCtRecId = validateDataset(badCtRecId)
    assert.equal(resCtRecId.valid, false)
    assert.ok(resCtRecId.errors.some((e) => e.includes('source_record_id must be a string or number')))

    // 2. course_terms[0].provenance.source = '' must fail
    const badProvSource = JSON.parse(JSON.stringify(dataset))
    badProvSource.course_terms[0].provenance.source = ''
    const resProv = validateDataset(badProvSource)
    assert.equal(resProv.valid, false)
    assert.ok(resProv.errors.some((e) => e.includes('provenance.source must be a non-empty string')))

    // 3. course_terms[0].provenance.rights_status invalid must fail
    const badRights = JSON.parse(JSON.stringify(dataset))
    badRights.course_terms[0].provenance.rights_status = 'unverified_license'
    const resRights = validateDataset(badRights)
    assert.equal(resRights.valid, false)
    assert.ok(resRights.errors.some((e) => e.includes("provenance.rights_status 'unverified_license' is invalid")))

    // 4. course_terms[0].ordinal = 0 or negative must fail
    const badOrdinal = JSON.parse(JSON.stringify(dataset))
    badOrdinal.course_terms[0].ordinal = 0
    const resOrdinal = validateDataset(badOrdinal)
    assert.equal(resOrdinal.valid, false)
    assert.ok(resOrdinal.errors.some((e) => e.includes('ordinal must be a positive number')))
  })

  test('Normalization is 100% deterministic (reproducible SHA-256)', () => {
    const fixturePath = path.resolve('scripts/curriculum/fixtures/identical-duplicates.json')
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))

    const dataset1 = normalizeDataset(raw, 'test-hash-fixed', '1.0.0')
    const dataset2 = normalizeDataset(raw, 'test-hash-fixed', '1.0.0')

    const json1 = JSON.stringify(dataset1, null, 2)
    const json2 = JSON.stringify(dataset2, null, 2)
    const hash1 = crypto.createHash('sha256').update(json1).digest('hex')
    const hash2 = crypto.createHash('sha256').update(json2).digest('hex')

    assert.equal(hash1, hash2)
    assert.equal(json1, json2)
  })
})
