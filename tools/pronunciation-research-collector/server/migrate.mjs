import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.')
const databaseUrl = process.env.DATABASE_URL
const usesLocalDatabase = /@(localhost|127\.0\.0\.1)(:|\/)/i.test(databaseUrl)
const ssl = process.env.DATABASE_SSL === 'true' || (!usesLocalDatabase && process.env.DATABASE_SSL !== 'false')
  ? { rejectUnauthorized: false }
  : undefined
const pool = new pg.Pool({ connectionString: databaseUrl, ssl })
try {
  const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'migrations')
  for (const name of ['001_research_collector.sql', '002_audio_in_postgres.sql', '003_guided_sessions.sql']) {
    await pool.query(await readFile(join(migrationsDir, name), 'utf8'))
    console.log(`Applied ${name}`)
  }
} finally {
  await pool.end()
}
