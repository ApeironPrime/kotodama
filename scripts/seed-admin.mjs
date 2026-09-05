import { randomUUID } from 'node:crypto'
import { hashPassword } from '../server/security.mjs'
import { createDatabasePool } from '../server/db/pool.mjs'
import { createAuthStore } from '../server/auth-store.mjs'

const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() || 'admin@kotodama.local'
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'Admin@12345678'
const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || 'Kotodama Admin'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL is missing in .env')
  process.exit(1)
}

const pool = createDatabasePool(connectionString)
const store = createAuthStore(pool)

try {
  const existing = await store.findUserByEmail(email)
  if (existing) {
    console.log(`Tài khoản ${email} đã tồn tại. Đang cập nhật quyền Admin...`)
    const passwordHash = await hashPassword(password)
    await pool.query(
      `update users
       set role = $1, password_hash = $2, email_verified = true, status = $3, name = $4, updated_at = now()
       where id = $5`,
      ['admin', passwordHash, 'active', name, existing.id]
    )
    console.log(`Đã cập nhật thành công tài khoản Admin: ${email}`)
  } else {
    console.log(`Đang tạo tài khoản Admin mới: ${email}...`)
    const user = {
      id: randomUUID(),
      name,
      email,
      passwordHash: await hashPassword(password),
      role: 'admin',
      emailVerified: true,
      status: 'active',
      createdAt: new Date().toISOString(),
      lastActivityAt: null,
    }
    await store.createUser(user)
    console.log(`Đã tạo thành công tài khoản Admin: ${email}`)
  }
} catch (error) {
  console.error('Lỗi khi cấp tài khoản Admin:', error)
  process.exitCode = 1
} finally {
  await pool.end()
}
