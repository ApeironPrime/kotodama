import { createDatabasePool } from '../server/db/pool.mjs'

const pool = createDatabasePool()
const vRes = await pool.query(
  "select * from transcript_versions where media_asset_id = '6e348355-ff80-4684-90c2-d46b86091715' order by created_at desc limit 1"
)
console.log('Version:', vRes.rows[0])
const sRes = await pool.query(
  'select * from transcript_segments where transcript_version_id = $1 order by sequence_no asc limit 10',
  [vRes.rows[0].id]
)
for (const seg of sRes.rows) {
  console.log(`Segment ${seg.sequence_no}: [${seg.start_ms}ms - ${seg.end_ms}ms] text_ja: "${seg.text_ja}"`)
  console.log(`   tokens:`, JSON.stringify(seg.tokens))
}

await pool.end()
process.exit(0)
