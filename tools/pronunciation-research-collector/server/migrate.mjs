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
  const sql = await readFile(join(dirname(fileURLToPath(import.meta.url)), 'migrations', '001_research_collector.sql'), 'utf8')
  await pool.query(sql)
  console.log('Applied 001_research_collector.sql')
} finally {
  await pool.end()
}
