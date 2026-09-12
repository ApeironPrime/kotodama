import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import pg from 'pg'
import {
  applyAnimeSchemaSQLite,
  applyAnimeSchemaPostgres,
  ingestAnimeDatasetSQLite,
  ingestAnimeDatasetPostgres,
  getAnimeTableCounts,
  isForbiddenNeonHost,
} from '../../server/db/anime-persistence.mjs'

const { Pool } = pg

/**
 * CLI execution entrypoint for Anime Dataset Ingestion
 */
export async function runCLI(cliArgs = process.argv.slice(2)) {
  let datasetPath = path.resolve('tmp/anime/canonical-dataset.json')
  let sqlitePath = path.resolve('tmp/anime/anime.db')
  let pgConnectionString = ''
  let customRunId = ''
  let confirmProduction = false
  let skipValidation = false

  for (let i = 0; i < cliArgs.length; i++) {
    if (cliArgs[i] === '--dataset' && cliArgs[i + 1]) datasetPath = path.resolve(cliArgs[++i])
    else if (cliArgs[i] === '--sqlite' && cliArgs[i + 1]) sqlitePath = path.resolve(cliArgs[++i])
    else if (cliArgs[i] === '--db' && cliArgs[i + 1]) pgConnectionString = cliArgs[++i]
    else if (cliArgs[i] === '--run-id' && cliArgs[i + 1]) customRunId = cliArgs[++i]
    else if (cliArgs[i] === '--confirm-production') confirmProduction = true
    else if (cliArgs[i] === '--skip-validation') skipValidation = true
  }

  // Safety guard against accidental writes to Neon production (checked immediately via URL parsing)
  if (pgConnectionString && !confirmProduction && isForbiddenNeonHost(pgConnectionString)) {
    throw new Error(
      '[Safety Guard] Direct ingest into Neon/production database is forbidden in Task T03. ' +
      'Please test using SQLite (--sqlite) or a dedicated local PostgreSQL database.'
    )
  }

  console.log(`[Anime Ingest] Reading dataset from: ${datasetPath}`)
  if (!fs.existsSync(datasetPath)) {
    throw new Error(`Canonical dataset not found at ${datasetPath}. Run 'npm run anime:import' first.`)
  }

  const fileBuffer = fs.readFileSync(datasetPath)
  const datasetSha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex')
  const dataset = JSON.parse(fileBuffer.toString('utf8'))
  console.log(`[Anime Ingest] Dataset SHA-256: ${datasetSha256}`)

  const startTime = Date.now()

  if (pgConnectionString) {
    console.log('[Anime Ingest] Target: PostgreSQL database')
    const pool = new Pool({ connectionString: pgConnectionString })
    try {
      console.log('[Anime Ingest] Applying PostgreSQL schema migrations...')
      await applyAnimeSchemaPostgres(pool)
      console.log('[Anime Ingest] Ingesting canonical dataset (transactional)...')
      const result = await ingestAnimeDatasetPostgres(pool, dataset, {
        runId: customRunId,
        datasetHash: datasetSha256,
        skipValidation,
      })
      const counts = await getAnimeTableCounts(pool)
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
      console.log(`[Anime Ingest] Succeeded in ${elapsed}s. Run ID: ${result.runId}`)
      console.log(`[Anime Ingest] Current DB counts:`, counts)
      return { result, counts }
    } finally {
      await pool.end()
    }
  } else {
    console.log(`[Anime Ingest] Target: SQLite database at ${sqlitePath}`)
    fs.mkdirSync(path.dirname(sqlitePath), { recursive: true })
    const db = new DatabaseSync(sqlitePath)
    try {
      console.log('[Anime Ingest] Applying SQLite schema...')
      applyAnimeSchemaSQLite(db)
      console.log('[Anime Ingest] Ingesting canonical dataset (transactional)...')
      const result = ingestAnimeDatasetSQLite(db, dataset, {
        runId: customRunId,
        datasetHash: datasetSha256,
        skipValidation,
        onProgress: (p) => {
          if (p.trackIndex % 25 === 0 || p.trackIndex === p.totalTracks) {
            const pct = ((p.trackIndex / p.totalTracks) * 100).toFixed(1)
            console.log(`[Anime Ingest] Tracks: ${p.trackIndex}/${p.totalTracks} (${pct}%) | Cues: ${p.cues.toLocaleString()} | Tokens: ${p.tokens.toLocaleString()}`)
          }
        },
      })
      const counts = await getAnimeTableCounts(db)
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
      console.log(`[Anime Ingest] Succeeded in ${elapsed}s. Run ID: ${result.runId}`)
      console.log(`[Anime Ingest] Current DB counts:`, counts)
      return { result, counts }
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
    console.error('[Anime Ingest Error]', err)
    process.exit(1)
  })
}
