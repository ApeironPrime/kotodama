import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import pg from 'pg'
import {
  applyCurriculumSchemaSQLite,
  applyCurriculumSchemaPostgres,
  ingestCurriculumDatasetSQLite,
  ingestCurriculumDatasetPostgres,
  getCurriculumTableCounts,
} from '../../server/db/curriculum-persistence.mjs'

const { Pool } = pg

/**
 * CLI execution entrypoint for Curriculum Dataset Ingestion
 */
async function runCLI() {
  const args = process.argv.slice(2)
  let datasetPath = path.resolve('tmp/curriculum/canonical-dataset.json')
  let sqlitePath = path.resolve('tmp/curriculum/curriculum.db')
  let pgConnectionString = ''
  let customRunId = ''
  let confirmProduction = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dataset' && args[i + 1]) datasetPath = path.resolve(args[++i])
    else if (args[i] === '--sqlite' && args[i + 1]) sqlitePath = path.resolve(args[++i])
    else if (args[i] === '--db' && args[i + 1]) pgConnectionString = args[++i]
    else if (args[i] === '--run-id' && args[i + 1]) customRunId = args[++i]
    else if (args[i] === '--confirm-production') confirmProduction = true
  }

  console.log(`[Ingest] Reading dataset from: ${datasetPath}`)
  if (!fs.existsSync(datasetPath)) {
    throw new Error(`Canonical dataset not found at ${datasetPath}. Run 'npm run curriculum:normalize' first.`)
  }

  const fileBuffer = fs.readFileSync(datasetPath)
  const datasetSha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex')
  const dataset = JSON.parse(fileBuffer.toString('utf8'))
  console.log(`[Ingest] Dataset SHA-256: ${datasetSha256}`)

  const startTime = Date.now()

  if (pgConnectionString) {
    // Safety guard against accidental writes to Neon production
    if (pgConnectionString.includes('neon.tech') && !confirmProduction) {
      throw new Error(
        '[Safety Guard] Direct ingest into Neon/production database is forbidden in Task T03. ' +
        'Please test using SQLite (--sqlite) or a dedicated local PostgreSQL database.'
      )
    }

    console.log('[Ingest] Target: PostgreSQL database')
    const pool = new Pool({ connectionString: pgConnectionString })
    try {
      console.log('[Ingest] Applying PostgreSQL schema migrations...')
      await applyCurriculumSchemaPostgres(pool)
      console.log('[Ingest] Ingesting canonical dataset (transactional)...')
      const result = await ingestCurriculumDatasetPostgres(pool, dataset, {
        runId: customRunId,
        datasetHash: datasetSha256,
      })
      const counts = await getCurriculumTableCounts(pool)
      console.log(`[Ingest] Succeeded in ${Date.now() - startTime}ms. Run ID: ${result.runId}`)
      console.log(`[Ingest] Current DB counts:`, counts)
    } finally {
      await pool.end()
    }
  } else {
    console.log(`[Ingest] Target: SQLite database at ${sqlitePath}`)
    fs.mkdirSync(path.dirname(sqlitePath), { recursive: true })
    const db = new DatabaseSync(sqlitePath)
    try {
      console.log('[Ingest] Applying SQLite schema...')
      applyCurriculumSchemaSQLite(db)
      console.log('[Ingest] Ingesting canonical dataset (transactional)...')
      const result = ingestCurriculumDatasetSQLite(db, dataset, {
        runId: customRunId,
        datasetHash: datasetSha256,
      })
      const counts = await getCurriculumTableCounts(db)
      console.log(`[Ingest] Succeeded in ${Date.now() - startTime}ms. Run ID: ${result.runId}`)
      console.log(`[Ingest] Current DB counts:`, counts)
    } finally {
      db.close()
    }
  }
}

const isDirectExecution = () => {
  if (!process.argv[1]) return false
  const scriptPath = path.resolve(process.argv[1]).toLowerCase()
  const currentPath = path.resolve(new URL(import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, '$1')).toLowerCase()
  return scriptPath === currentPath
}

if (isDirectExecution()) {
  runCLI().catch((err) => {
    console.error('[Ingest Error]:', err.message || err)
    process.exit(1)
  })
}
