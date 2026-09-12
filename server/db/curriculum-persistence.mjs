import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { validateDataset } from '../../scripts/curriculum/canonical-schema.mjs'
import { computeCanonicalDatasetHash } from '../../scripts/curriculum/normalize.mjs'

export const SQLITE_CURRICULUM_DDL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS curriculum_courses (
  course_code TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('A1', 'A2', 'N5', 'N4', 'N3', 'N2', 'N1', 'SE')),
  provider_source TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'internal' CHECK (visibility IN ('public', 'unlisted', 'private', 'internal')),
  rights_status TEXT NOT NULL DEFAULT 'unknown' CHECK (rights_status IN ('unknown', 'verified', 'public_domain', 'licensed')),
  description TEXT NOT NULL DEFAULT '',
  is_curated INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS curriculum_courses_level_idx
  ON curriculum_courses(level, visibility);

CREATE TABLE IF NOT EXISTS curriculum_units (
  unit_id TEXT PRIMARY KEY,
  course_code TEXT NOT NULL REFERENCES curriculum_courses(course_code) ON DELETE CASCADE,
  unit_key TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  title TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT '',
  is_curated INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(course_code, unit_key)
);

CREATE INDEX IF NOT EXISTS curriculum_units_course_idx
  ON curriculum_units(course_code, ordinal);

CREATE TABLE IF NOT EXISTS curriculum_terms (
  term_id TEXT PRIMARY KEY,
  normalized_key TEXT NOT NULL,
  display_word TEXT NOT NULL,
  display_reading TEXT NOT NULL DEFAULT '',
  meanings TEXT NOT NULL DEFAULT '[]',
  han_viet TEXT,
  examples TEXT NOT NULL DEFAULT '[]',
  raw_source_references TEXT NOT NULL DEFAULT '[]',
  is_curated INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS curriculum_terms_normalized_key_idx
  ON curriculum_terms(normalized_key);

CREATE INDEX IF NOT EXISTS curriculum_terms_display_reading_idx
  ON curriculum_terms(display_reading);

CREATE TABLE IF NOT EXISTS curriculum_import_runs (
  run_id TEXT PRIMARY KEY,
  source_manifest_hash TEXT NOT NULL,
  dataset_hash TEXT NOT NULL,
  importer_version TEXT NOT NULL,
  total_input_records INTEGER NOT NULL,
  total_canonical_terms INTEGER NOT NULL,
  total_course_terms INTEGER NOT NULL,
  total_courses INTEGER NOT NULL,
  total_units INTEGER NOT NULL,
  warning_count INTEGER NOT NULL,
  error_count INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'rolled_back')),
  reject_list TEXT NOT NULL DEFAULT '[]',
  warnings TEXT NOT NULL DEFAULT '[]',
  imported_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS curriculum_course_terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_code TEXT NOT NULL REFERENCES curriculum_courses(course_code) ON DELETE CASCADE,
  unit_id TEXT NOT NULL REFERENCES curriculum_units(unit_id) ON DELETE CASCADE,
  term_id TEXT NOT NULL REFERENCES curriculum_terms(term_id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  source_record_id TEXT NOT NULL,
  provenance TEXT NOT NULL DEFAULT '{}',
  import_run_id TEXT REFERENCES curriculum_import_runs(run_id) ON DELETE SET NULL,
  is_curated INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(course_code, unit_id, ordinal)
);

CREATE INDEX IF NOT EXISTS curriculum_course_terms_unit_ordinal_idx
  ON curriculum_course_terms(unit_id, ordinal);

CREATE INDEX IF NOT EXISTS curriculum_course_terms_course_term_idx
  ON curriculum_course_terms(course_code, term_id);

CREATE INDEX IF NOT EXISTS curriculum_course_terms_term_id_idx
  ON curriculum_course_terms(term_id);
`

/**
 * Initializes curriculum schema on SQLite database
 * @param {any} db SQLite DatabaseSync instance
 */
export function applyCurriculumSchemaSQLite(db) {
  db.exec(SQLITE_CURRICULUM_DDL)
}

/**
 * Initializes curriculum schema on PostgreSQL database
 * @param {any} clientOrPool pg.Pool or pg.Client instance
 */
export async function applyCurriculumSchemaPostgres(clientOrPool) {
  const sqlPath = path.resolve('server/db/migrations/008_curriculum_tables.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')
  await clientOrPool.query(sql)
}

/**
 * Transactional ingest of Canonical Dataset into SQLite
 * @param {any} db SQLite DatabaseSync instance
 * @param {any} dataset CanonicalDataset
 * @param {{ runId?: string, skipValidation?: boolean }} [options]
 * @returns {{ runId: string, coursesCount: number, unitsCount: number, termsCount: number, courseTermsCount: number, status: string }}
 */
export function ingestCurriculumDatasetSQLite(db, dataset, options = {}) {
  // 1. Validation check
  if (!options.skipValidation) {
    const validation = validateDataset(dataset)
    if (!validation.valid) {
      throw new Error(`Dataset validation failed: ${validation.errors.join('; ')}`)
    }
  }

  const runId = options.runId || `run_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
  const now = new Date().toISOString()
  const datasetHash = options.datasetHash || computeCanonicalDatasetHash(dataset)

  const { import_run, courses, units, terms, course_terms } = dataset

  // 2. Open transaction
  db.exec('BEGIN IMMEDIATE TRANSACTION;')
  try {
    // 3. Create Import Run with status = 'pending'
    const insertRunStmt = db.prepare(`
      INSERT INTO curriculum_import_runs (
        run_id, source_manifest_hash, dataset_hash, importer_version,
        total_input_records, total_canonical_terms, total_course_terms, total_courses, total_units,
        warning_count, error_count, status, reject_list, warnings, imported_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    `)
    insertRunStmt.run(
      runId,
      import_run.source_manifest_hash,
      datasetHash,
      import_run.importer_version,
      import_run.total_input_records,
      import_run.total_canonical_terms,
      import_run.total_course_terms,
      import_run.total_courses,
      import_run.total_units,
      import_run.warning_count,
      import_run.error_count,
      JSON.stringify(import_run.reject_list || []),
      JSON.stringify(import_run.warnings || []),
      now
    )

    // 4. Upsert Courses (respects is_curated flag)
    const upsertCourseStmt = db.prepare(`
      INSERT INTO curriculum_courses (
        course_code, title, level, provider_source, visibility, rights_status, description, is_curated, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      ON CONFLICT(course_code) DO UPDATE SET
        title = CASE WHEN curriculum_courses.is_curated != 0 THEN curriculum_courses.title ELSE excluded.title END,
        level = CASE WHEN curriculum_courses.is_curated != 0 THEN curriculum_courses.level ELSE excluded.level END,
        provider_source = CASE WHEN curriculum_courses.is_curated != 0 THEN curriculum_courses.provider_source ELSE excluded.provider_source END,
        visibility = CASE WHEN curriculum_courses.is_curated != 0 THEN curriculum_courses.visibility ELSE excluded.visibility END,
        rights_status = CASE WHEN curriculum_courses.is_curated != 0 THEN curriculum_courses.rights_status ELSE excluded.rights_status END,
        description = CASE WHEN curriculum_courses.is_curated != 0 THEN curriculum_courses.description ELSE excluded.description END,
        updated_at = excluded.updated_at
    `)

    for (const c of courses) {
      upsertCourseStmt.run(
        c.course_code,
        c.title,
        c.level,
        c.provider_source,
        c.visibility || 'internal',
        c.rights_status || 'unknown',
        c.description || '',
        now,
        now
      )
    }

    // 5. Upsert Units (respects is_curated flag)
    const upsertUnitStmt = db.prepare(`
      INSERT INTO curriculum_units (
        unit_id, course_code, unit_key, ordinal, title, topic, is_curated, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
      ON CONFLICT(unit_id) DO UPDATE SET
        course_code = CASE WHEN curriculum_units.is_curated != 0 THEN curriculum_units.course_code ELSE excluded.course_code END,
        unit_key = CASE WHEN curriculum_units.is_curated != 0 THEN curriculum_units.unit_key ELSE excluded.unit_key END,
        ordinal = CASE WHEN curriculum_units.is_curated != 0 THEN curriculum_units.ordinal ELSE excluded.ordinal END,
        title = CASE WHEN curriculum_units.is_curated != 0 THEN curriculum_units.title ELSE excluded.title END,
        topic = CASE WHEN curriculum_units.is_curated != 0 THEN curriculum_units.topic ELSE excluded.topic END,
        updated_at = excluded.updated_at
    `)

    for (const u of units) {
      upsertUnitStmt.run(
        u.unit_id,
        u.course_code,
        u.unit_key,
        u.ordinal,
        u.title,
        u.topic || '',
        now,
        now
      )
    }

    // 6. Upsert Terms (respects is_curated flag)
    const upsertTermStmt = db.prepare(`
      INSERT INTO curriculum_terms (
        term_id, normalized_key, display_word, display_reading, meanings, han_viet, examples, raw_source_references, is_curated, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      ON CONFLICT(term_id) DO UPDATE SET
        normalized_key = CASE WHEN curriculum_terms.is_curated != 0 THEN curriculum_terms.normalized_key ELSE excluded.normalized_key END,
        display_word = CASE WHEN curriculum_terms.is_curated != 0 THEN curriculum_terms.display_word ELSE excluded.display_word END,
        display_reading = CASE WHEN curriculum_terms.is_curated != 0 THEN curriculum_terms.display_reading ELSE excluded.display_reading END,
        meanings = CASE WHEN curriculum_terms.is_curated != 0 THEN curriculum_terms.meanings ELSE excluded.meanings END,
        han_viet = CASE WHEN curriculum_terms.is_curated != 0 THEN curriculum_terms.han_viet ELSE excluded.han_viet END,
        examples = CASE WHEN curriculum_terms.is_curated != 0 THEN curriculum_terms.examples ELSE excluded.examples END,
        raw_source_references = CASE WHEN curriculum_terms.is_curated != 0 THEN curriculum_terms.raw_source_references ELSE excluded.raw_source_references END,
        updated_at = excluded.updated_at
    `)

    for (const t of terms) {
      upsertTermStmt.run(
        t.term_id,
        t.normalized_key,
        t.display_word,
        t.display_reading || '',
        JSON.stringify(t.meanings || []),
        t.han_viet || null,
        JSON.stringify(t.examples || []),
        JSON.stringify(t.raw_source_references || []),
        now,
        now
      )
    }

    // 7. Upsert Course Terms (respects is_curated flag)
    const upsertCourseTermStmt = db.prepare(`
      INSERT INTO curriculum_course_terms (
        course_code, unit_id, term_id, ordinal, source_record_id, provenance, import_run_id, is_curated, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      ON CONFLICT(course_code, unit_id, ordinal) DO UPDATE SET
        term_id = CASE WHEN curriculum_course_terms.is_curated != 0 THEN curriculum_course_terms.term_id ELSE excluded.term_id END,
        source_record_id = CASE WHEN curriculum_course_terms.is_curated != 0 THEN curriculum_course_terms.source_record_id ELSE excluded.source_record_id END,
        provenance = CASE WHEN curriculum_course_terms.is_curated != 0 THEN curriculum_course_terms.provenance ELSE excluded.provenance END,
        import_run_id = excluded.import_run_id,
        updated_at = excluded.updated_at
    `)

    for (const ct of course_terms) {
      upsertCourseTermStmt.run(
        ct.course_code,
        ct.unit_id,
        ct.term_id,
        ct.ordinal,
        String(ct.source_record_id),
        JSON.stringify(ct.provenance || {}),
        runId,
        now,
        now
      )
    }

    // 8. Update Import Run status = 'completed'
    db.prepare('UPDATE curriculum_import_runs SET status = ? WHERE run_id = ?').run('completed', runId)

    // 9. Commit transaction
    db.exec('COMMIT;')

    return {
      runId,
      coursesCount: courses.length,
      unitsCount: units.length,
      termsCount: terms.length,
      courseTermsCount: course_terms.length,
      status: 'completed',
    }
  } catch (error) {
    db.exec('ROLLBACK;')
    throw error
  }
}

/**
 * Transactional ingest of Canonical Dataset into PostgreSQL
 * @param {any} clientOrPool pg.Pool or pg.Client instance
 * @param {any} dataset CanonicalDataset
 * @param {{ runId?: string, skipValidation?: boolean }} [options]
 * @returns {Promise<{ runId: string, coursesCount: number, unitsCount: number, termsCount: number, courseTermsCount: number, status: string }>}
 */
export async function ingestCurriculumDatasetPostgres(clientOrPool, dataset, options = {}) {
  // 1. Validation check
  if (!options.skipValidation) {
    const validation = validateDataset(dataset)
    if (!validation.valid) {
      throw new Error(`Dataset validation failed: ${validation.errors.join('; ')}`)
    }
  }

  const runId = options.runId || `run_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
  const datasetHash = options.datasetHash || computeCanonicalDatasetHash(dataset)

  const { import_run, courses, units, terms, course_terms } = dataset

  const client = typeof clientOrPool.connect === 'function' ? await clientOrPool.connect() : clientOrPool
  const isDedicatedClient = client !== clientOrPool

  try {
    await client.query('BEGIN')

    // 2. Insert Import Run
    await client.query(
      `INSERT INTO curriculum_import_runs (
        run_id, source_manifest_hash, dataset_hash, importer_version,
        total_input_records, total_canonical_terms, total_course_terms, total_courses, total_units,
        warning_count, error_count, status, reject_list, warnings
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', $12::jsonb, $13::jsonb)`,
      [
        runId,
        import_run.source_manifest_hash,
        datasetHash,
        import_run.importer_version,
        import_run.total_input_records,
        import_run.total_canonical_terms,
        import_run.total_course_terms,
        import_run.total_courses,
        import_run.total_units,
        import_run.warning_count,
        import_run.error_count,
        JSON.stringify(import_run.reject_list || []),
        JSON.stringify(import_run.warnings || []),
      ]
    )

    // 3. Upsert Courses
    for (const c of courses) {
      await client.query(
        `INSERT INTO curriculum_courses (
          course_code, title, level, provider_source, visibility, rights_status, description, is_curated, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, false, now(), now())
        ON CONFLICT(course_code) DO UPDATE SET
          title = CASE WHEN curriculum_courses.is_curated IS TRUE THEN curriculum_courses.title ELSE excluded.title END,
          level = CASE WHEN curriculum_courses.is_curated IS TRUE THEN curriculum_courses.level ELSE excluded.level END,
          provider_source = CASE WHEN curriculum_courses.is_curated IS TRUE THEN curriculum_courses.provider_source ELSE excluded.provider_source END,
          visibility = CASE WHEN curriculum_courses.is_curated IS TRUE THEN curriculum_courses.visibility ELSE excluded.visibility END,
          rights_status = CASE WHEN curriculum_courses.is_curated IS TRUE THEN curriculum_courses.rights_status ELSE excluded.rights_status END,
          description = CASE WHEN curriculum_courses.is_curated IS TRUE THEN curriculum_courses.description ELSE excluded.description END,
          updated_at = now()`,
        [c.course_code, c.title, c.level, c.provider_source, c.visibility || 'internal', c.rights_status || 'unknown', c.description || '']
      )
    }

    // 4. Upsert Units
    for (const u of units) {
      await client.query(
        `INSERT INTO curriculum_units (
          unit_id, course_code, unit_key, ordinal, title, topic, is_curated, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, false, now(), now())
        ON CONFLICT(unit_id) DO UPDATE SET
          course_code = CASE WHEN curriculum_units.is_curated IS TRUE THEN curriculum_units.course_code ELSE excluded.course_code END,
          unit_key = CASE WHEN curriculum_units.is_curated IS TRUE THEN curriculum_units.unit_key ELSE excluded.unit_key END,
          ordinal = CASE WHEN curriculum_units.is_curated IS TRUE THEN curriculum_units.ordinal ELSE excluded.ordinal END,
          title = CASE WHEN curriculum_units.is_curated IS TRUE THEN curriculum_units.title ELSE excluded.title END,
          topic = CASE WHEN curriculum_units.is_curated IS TRUE THEN curriculum_units.topic ELSE excluded.topic END,
          updated_at = now()`,
        [u.unit_id, u.course_code, u.unit_key, u.ordinal, u.title, u.topic || '']
      )
    }

    // 5. Upsert Terms
    for (const t of terms) {
      await client.query(
        `INSERT INTO curriculum_terms (
          term_id, normalized_key, display_word, display_reading, meanings, han_viet, examples, raw_source_references, is_curated, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8::jsonb, false, now(), now())
        ON CONFLICT(term_id) DO UPDATE SET
          normalized_key = CASE WHEN curriculum_terms.is_curated IS TRUE THEN curriculum_terms.normalized_key ELSE excluded.normalized_key END,
          display_word = CASE WHEN curriculum_terms.is_curated IS TRUE THEN curriculum_terms.display_word ELSE excluded.display_word END,
          display_reading = CASE WHEN curriculum_terms.is_curated IS TRUE THEN curriculum_terms.display_reading ELSE excluded.display_reading END,
          meanings = CASE WHEN curriculum_terms.is_curated IS TRUE THEN curriculum_terms.meanings ELSE excluded.meanings END,
          han_viet = CASE WHEN curriculum_terms.is_curated IS TRUE THEN curriculum_terms.han_viet ELSE excluded.han_viet END,
          examples = CASE WHEN curriculum_terms.is_curated IS TRUE THEN curriculum_terms.examples ELSE excluded.examples END,
          raw_source_references = CASE WHEN curriculum_terms.is_curated IS TRUE THEN curriculum_terms.raw_source_references ELSE excluded.raw_source_references END,
          updated_at = now()`,
        [
          t.term_id,
          t.normalized_key,
          t.display_word,
          t.display_reading || '',
          JSON.stringify(t.meanings || []),
          t.han_viet || null,
          JSON.stringify(t.examples || []),
          JSON.stringify(t.raw_source_references || []),
        ]
      )
    }

    // 6. Upsert Course Terms
    for (const ct of course_terms) {
      await client.query(
        `INSERT INTO curriculum_course_terms (
          course_code, unit_id, term_id, ordinal, source_record_id, provenance, import_run_id, is_curated, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, false, now(), now())
        ON CONFLICT(course_code, unit_id, ordinal) DO UPDATE SET
          term_id = CASE WHEN curriculum_course_terms.is_curated IS TRUE THEN curriculum_course_terms.term_id ELSE excluded.term_id END,
          source_record_id = CASE WHEN curriculum_course_terms.is_curated IS TRUE THEN curriculum_course_terms.source_record_id ELSE excluded.source_record_id END,
          provenance = CASE WHEN curriculum_course_terms.is_curated IS TRUE THEN curriculum_course_terms.provenance ELSE excluded.provenance END,
          import_run_id = excluded.import_run_id,
          updated_at = now()`,
        [
          ct.course_code,
          ct.unit_id,
          ct.term_id,
          ct.ordinal,
          String(ct.source_record_id),
          JSON.stringify(ct.provenance || {}),
          runId,
        ]
      )
    }

    // 7. Update Import Run status = 'completed'
    await client.query('UPDATE curriculum_import_runs SET status = $1 WHERE run_id = $2', ['completed', runId])

    await client.query('COMMIT')

    return {
      runId,
      coursesCount: courses.length,
      unitsCount: units.length,
      termsCount: terms.length,
      courseTermsCount: course_terms.length,
      status: 'completed',
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    if (isDedicatedClient) client.release()
  }
}

/**
 * Universal Ingest helper that auto-routes to SQLite or PostgreSQL
 */
export async function ingestCurriculumDataset(target, dataset, options = {}) {
  if (target && typeof target.exec === 'function' && typeof target.prepare === 'function') {
    return ingestCurriculumDatasetSQLite(target, dataset, options)
  }
  return ingestCurriculumDatasetPostgres(target, dataset, options)
}

/**
 * Retrieves aggregate table counts from database
 * @param {any} db SQLite or PostgreSQL instance
 * @returns {Promise<{ courses: number, units: number, terms: number, courseTerms: number, importRuns: number }>}
 */
export async function getCurriculumTableCounts(db) {
  if (db && typeof db.prepare === 'function') {
    return {
      courses: db.prepare('SELECT count(*) as count FROM curriculum_courses').get().count,
      units: db.prepare('SELECT count(*) as count FROM curriculum_units').get().count,
      terms: db.prepare('SELECT count(*) as count FROM curriculum_terms').get().count,
      courseTerms: db.prepare('SELECT count(*) as count FROM curriculum_course_terms').get().count,
      importRuns: db.prepare('SELECT count(*) as count FROM curriculum_import_runs').get().count,
    }
  }

  const [courses, units, terms, courseTerms, importRuns] = await Promise.all([
    db.query('SELECT count(*) FROM curriculum_courses'),
    db.query('SELECT count(*) FROM curriculum_units'),
    db.query('SELECT count(*) FROM curriculum_terms'),
    db.query('SELECT count(*) FROM curriculum_course_terms'),
    db.query('SELECT count(*) FROM curriculum_import_runs'),
  ])

  return {
    courses: Number(courses.rows[0].count),
    units: Number(units.rows[0].count),
    terms: Number(terms.rows[0].count),
    courseTerms: Number(courseTerms.rows[0].count),
    importRuns: Number(importRuns.rows[0].count),
  }
}
