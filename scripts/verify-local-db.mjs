import pg from 'pg'

const value = process.env.DATABASE_URL
if (!value) throw new Error('Thiếu DATABASE_URL trong .env.local.')

const url = new URL(value)
if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(url.hostname)) {
  throw new Error('Chế độ local chỉ chấp nhận PostgreSQL trên máy này.')
}
if (!url.pathname || url.pathname === '/') throw new Error('DATABASE_URL cần có tên database.')

// The target database may not exist yet. Check the local server through the
// maintenance database before the migration script creates the target.
url.pathname = '/postgres'
const client = new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 3_000 })
try {
  await client.connect()
  await client.query('select 1')
  console.log('PostgreSQL local đã sẵn sàng.')
} catch (error) {
  throw new Error(`Không kết nối được PostgreSQL local: ${error.message}`, { cause: error })
} finally {
  await client.end().catch(() => {})
}
