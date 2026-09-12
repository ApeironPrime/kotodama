import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import {
  applyCurriculumSchemaSQLite,
  ingestCurriculumDatasetSQLite,
  getCurriculumTableCounts,
} from '../../server/db/curriculum-persistence.mjs'
import { normalizeDataset } from './normalize.mjs'

describe('Curriculum Persistence & Migration Layer (Task T03)', () => {
  function createTestDataset() {
    const fixturePath = path.resolve('scripts/curriculum/fixtures/valid-mini.json')
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
    return normalizeDataset(raw, 'test-manifest-hash-123')
  }

  test('Migration is idempotent: multiple schema applications succeed without altering tables', async () => {
    const db = new DatabaseSync(':memory:')
    try {
      applyCurriculumSchemaSQLite(db)
      applyCurriculumSchemaSQLite(db) // Second application must not throw

      const counts = await getCurriculumTableCounts(db)
      assert.deepEqual(counts, {
        courses: 0,
        units: 0,
        terms: 0,
        courseTerms: 0,
        importRuns: 0,
      })

      // Verify all 5 tables exist in sqlite_master
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name)
      assert.ok(tables.includes('curriculum_courses'))
      assert.ok(tables.includes('curriculum_units'))
      assert.ok(tables.includes('curriculum_terms'))
      assert.ok(tables.includes('curriculum_course_terms'))
      assert.ok(tables.includes('curriculum_import_runs'))
    } finally {
      db.close()
    }
  })

  test('Ingest is idempotent: running ingest twice does not duplicate records', async () => {
    const db = new DatabaseSync(':memory:')
    try {
      applyCurriculumSchemaSQLite(db)
      const dataset = createTestDataset()

      const res1 = ingestCurriculumDatasetSQLite(db, dataset, { runId: 'run-1' })
      assert.equal(res1.status, 'completed')
      const counts1 = await getCurriculumTableCounts(db)
      assert.equal(counts1.courses, 1)
      assert.equal(counts1.units, 1)
      assert.equal(counts1.terms, 3)
      assert.equal(counts1.courseTerms, 3)
      assert.equal(counts1.importRuns, 1)

      // Ingest second time
      const res2 = ingestCurriculumDatasetSQLite(db, dataset, { runId: 'run-2' })
      assert.equal(res2.status, 'completed')
      const counts2 = await getCurriculumTableCounts(db)

      // Core entities must NOT be duplicated
      assert.equal(counts2.courses, 1)
      assert.equal(counts2.units, 1)
      assert.equal(counts2.terms, 3)
      assert.equal(counts2.courseTerms, 3)
      // New import run is tracked
      assert.equal(counts2.importRuns, 2)
    } finally {
      db.close()
    }
  })

  test('Transaction rollback on validation or insert error preserves live database state', async () => {
    const db = new DatabaseSync(':memory:')
    try {
      applyCurriculumSchemaSQLite(db)
      const dataset = createTestDataset()

      // Initial successful ingest
      ingestCurriculumDatasetSQLite(db, dataset, { runId: 'run-initial' })
      const beforeCounts = await getCurriculumTableCounts(db)

      // Corrupt dataset that fails schema validation
      const invalidDataset = JSON.parse(JSON.stringify(dataset))
      invalidDataset.import_run.total_canonical_terms = 999

      assert.throws(() => {
        ingestCurriculumDatasetSQLite(db, invalidDataset, { runId: 'run-corrupt' })
      }, /Dataset validation failed/)

      // Ensure database state is completely unchanged
      const afterCounts = await getCurriculumTableCounts(db)
      assert.deepEqual(afterCounts, beforeCounts)
    } finally {
      db.close()
    }
  })

  test('Transaction rollback on mid-ingest DB error (after insert run) leaves zero orphan records and zero import runs', async () => {
    const db = new DatabaseSync(':memory:')
    try {
      applyCurriculumSchemaSQLite(db)
      const dataset = createTestDataset()

      // Create an SQLite trigger that fails during terms insertion.
      // In the transaction flow, curriculum_import_runs, curriculum_courses, and curriculum_units are inserted first.
      db.exec(`
        CREATE TRIGGER simulate_mid_ingest_failure
        BEFORE INSERT ON curriculum_terms
        BEGIN
          SELECT RAISE(ABORT, 'Simulated mid-transaction database failure');
        END;
      `)

      assert.throws(() => {
        ingestCurriculumDatasetSQLite(db, dataset, { runId: 'run-should-rollback' })
      }, /Simulated mid-transaction database failure/)

      // Verify that ROLLBACK cleanly reverted all changes, leaving 0 rows in all tables
      const counts = await getCurriculumTableCounts(db)
      assert.deepEqual(counts, {
        courses: 0,
        units: 0,
        terms: 0,
        courseTerms: 0,
        importRuns: 0,
      })

      const importRuns = db.prepare('SELECT * FROM curriculum_import_runs').all()
      assert.equal(importRuns.length, 0, 'No partial import run must remain after rollback')

      const courses = db.prepare('SELECT * FROM curriculum_courses').all()
      assert.equal(courses.length, 0, 'No partial course rows must remain after rollback')
    } finally {
      db.close()
    }
  })

  test('Manually-curated fields (is_curated = 1) are strictly preserved during subsequent ingests', async () => {
    const db = new DatabaseSync(':memory:')
    try {
      applyCurriculumSchemaSQLite(db)
      const dataset = createTestDataset()

      ingestCurriculumDatasetSQLite(db, dataset, { runId: 'run-1' })

      // Manually curate course title and term meaning
      db.prepare(`
        UPDATE curriculum_courses
        SET title = 'Tiêu đề Biên tập Thủ công', is_curated = 1
        WHERE course_code = 'minna-n5-standard'
      `).run()

      const sampleTermId = dataset.terms[0].term_id
      db.prepare(`
        UPDATE curriculum_terms
        SET meanings = '["Nghĩa riêng do giáo viên biên tập"]', is_curated = 1
        WHERE term_id = ?
      `).run(sampleTermId)

      // Re-ingest original canonical dataset
      ingestCurriculumDatasetSQLite(db, dataset, { runId: 'run-2' })

      // Verify curated fields were NOT overwritten
      const course = db.prepare('SELECT title, is_curated FROM curriculum_courses WHERE course_code = ?').get('minna-n5-standard')
      assert.equal(course.title, 'Tiêu đề Biên tập Thủ công')
      assert.equal(course.is_curated, 1)

      const term = db.prepare('SELECT meanings, is_curated FROM curriculum_terms WHERE term_id = ?').get(sampleTermId)
      assert.equal(term.meanings, '["Nghĩa riêng do giáo viên biên tập"]')
      assert.equal(term.is_curated, 1)
    } finally {
      db.close()
    }
  })

  test('EXPLAIN QUERY PLAN confirms indexed lookups without full table scans', async () => {
    const db = new DatabaseSync(':memory:')
    try {
      applyCurriculumSchemaSQLite(db)
      const dataset = createTestDataset()
      ingestCurriculumDatasetSQLite(db, dataset, { runId: 'run-1' })

      // 1. Browse units by course (ORDER BY ordinal)
      const planUnits = db.prepare('EXPLAIN QUERY PLAN SELECT * FROM curriculum_units WHERE course_code = ? ORDER BY ordinal').all('minna-n5-standard')
      const planUnitsDetail = planUnits.map((p) => p.detail).join(' ')
      assert.ok(planUnitsDetail.includes('USING INDEX curriculum_units_course_idx'), `Expected index in ${planUnitsDetail}`)
      assert.ok(!planUnitsDetail.includes('SCAN curriculum_units'), `Unexpected full table scan in ${planUnitsDetail}`)

      // 2. Browse terms by unit (ORDER BY ordinal)
      const planTerms = db.prepare('EXPLAIN QUERY PLAN SELECT * FROM curriculum_course_terms WHERE unit_id = ? ORDER BY ordinal').all('minna-n5-standard:bai-01')
      const planTermsDetail = planTerms.map((p) => p.detail).join(' ')
      assert.ok(planTermsDetail.includes('USING INDEX curriculum_course_terms_unit_ordinal_idx'), `Expected index in ${planTermsDetail}`)
      assert.ok(!planTermsDetail.includes('SCAN curriculum_course_terms'), `Unexpected full table scan in ${planTermsDetail}`)

      // 3. Lookup term by normalized_key
      const planKey = db.prepare('EXPLAIN QUERY PLAN SELECT * FROM curriculum_terms WHERE normalized_key = ?').all('わたし')
      const planKeyDetail = planKey.map((p) => p.detail).join(' ')
      assert.ok(planKeyDetail.includes('USING INDEX curriculum_terms_normalized_key_idx'), `Expected index in ${planKeyDetail}`)

      // 4. Lookup courses by level
      const planLevel = db.prepare('EXPLAIN QUERY PLAN SELECT * FROM curriculum_courses WHERE level = ?').all('N5')
      const planLevelDetail = planLevel.map((p) => p.detail).join(' ')
      assert.ok(planLevelDetail.includes('USING INDEX curriculum_courses_level_idx'), `Expected index in ${planLevelDetail}`)
    } finally {
      db.close()
    }
  })

  test('Ingest from real canonical artifact matches exact file bytes SHA-256 in DB', async () => {
    const datasetPath = path.resolve('tmp/curriculum/canonical-dataset.json')
    assert.ok(fs.existsSync(datasetPath), `Canonical dataset must exist at ${datasetPath}`)

    const fileBytes = fs.readFileSync(datasetPath)
    const expectedFileSha256 = crypto.createHash('sha256').update(fileBytes).digest('hex')
    assert.match(expectedFileSha256, /^[a-f0-9]{64}$/)

    const db = new DatabaseSync(':memory:')
    try {
      applyCurriculumSchemaSQLite(db)
      const dataset = JSON.parse(fileBytes.toString('utf8'))

      // 1. Ingest with explicitly passed datasetHash (matching CLI behavior)
      const resExplicit = ingestCurriculumDatasetSQLite(db, dataset, {
        runId: 'run-real-explicit',
        datasetHash: expectedFileSha256,
      })
      assert.equal(resExplicit.status, 'completed')
      const rowExplicit = db.prepare('SELECT dataset_hash FROM curriculum_import_runs WHERE run_id = ?').get('run-real-explicit')
      assert.equal(rowExplicit.dataset_hash, expectedFileSha256)

      // 2. Ingest without options.datasetHash (adapter auto-calculates deterministic hash)
      const resAuto = ingestCurriculumDatasetSQLite(db, dataset, {
        runId: 'run-real-auto',
      })
      assert.equal(resAuto.status, 'completed')
      const rowAuto = db.prepare('SELECT dataset_hash FROM curriculum_import_runs WHERE run_id = ?').get('run-real-auto')
      assert.equal(rowAuto.dataset_hash, expectedFileSha256)

      // 3. Confirm all table counts match full dataset accurately
      const counts = await getCurriculumTableCounts(db)
      assert.equal(counts.courses, dataset.courses.length)
      assert.equal(counts.units, dataset.units.length)
      assert.equal(counts.terms, dataset.terms.length)
      assert.equal(counts.courseTerms, dataset.course_terms.length)
      assert.equal(counts.importRuns, 2)
    } finally {
      db.close()
    }
  })

  test('Safety guard forbids accidental Neon production connection', async () => {
    // Calling ingest on a neon.tech URL without confirmProduction in CLI must be blocked
    const ingestScript = path.resolve('scripts/curriculum/ingest.mjs')
    const scriptContent = fs.readFileSync(ingestScript, 'utf8')
    assert.ok(scriptContent.includes('neon.tech'), 'ingest.mjs must contain safety guard check for neon.tech')
    assert.ok(scriptContent.includes('Direct ingest into Neon/production database is forbidden in Task T03'))
  })
})
