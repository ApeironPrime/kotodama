import { createDatabasePool } from '../server/db/pool.mjs'

const pool = createDatabasePool()
const res = await pool.query(
  "select id, title, storage_key, processing_status from media_assets where title ilike '%ヒグチアイ%' or title ilike '%悪魔の子%' or title ilike '%Akuma%' or title ilike '%Higuchi%' or title ilike '%Silhouette%' or title ilike '%シルエット%'"
)
console.log('Matching assets:', res.rows)
await pool.end()
process.exit(0)
