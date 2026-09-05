import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createDatabasePool } from '../server/db/pool.mjs'
import { readConfig } from '../server/config.mjs'

const config = readConfig()
const pool = createDatabasePool(config.databaseUrl)

if (!pool) {
  console.error('Database connection required!')
  process.exit(1)
}

async function main() {
  console.log('=== BẮT ĐẦU IMPORT DATASET TSUNAGARU ===')

  // 1. Tìm user admin làm owner
  const userRes = await pool.query("SELECT id, email, name FROM users WHERE role = 'admin' LIMIT 1")
  let ownerUserId
  if (userRes.rows.length > 0) {
    ownerUserId = userRes.rows[0].id
    console.log(`Tìm thấy user: ${userRes.rows[0].name} (${userRes.rows[0].email})`)
  } else {
    const anyUser = await pool.query('SELECT id FROM users LIMIT 1')
    if (anyUser.rows.length === 0) {
      console.error('Chưa có user nào trong database!')
      process.exit(1)
    }
    ownerUserId = anyUser.rows[0].id
  }

  const baseDir = 'D:/VKU/data/drive-download-20260828T102340Z-1-002/tsunagaru_crawler/downloads/videos'
  if (!fs.existsSync(baseDir)) {
    console.error(`Không tìm thấy thư mục: ${baseDir}`)
    process.exit(1)
  }

  // Quét đệ quy tìm các file .mp4
  function findMp4(dir) {
    let files = []
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, item.name)
      if (item.isDirectory()) {
        files = files.concat(findMp4(full))
      } else if (item.name.toLowerCase().endsWith('.mp4')) {
        files.push(full)
      }
    }
    return files
  }

  const mp4Files = findMp4(baseDir)
  console.log(`Tìm thấy ${mp4Files.length} file MP4 từ Tsunagaru Nihongo!`)

  const mediaStorageDir = path.resolve('var/media')
  if (!fs.existsSync(mediaStorageDir)) {
    fs.mkdirSync(mediaStorageDir, { recursive: true })
  }

  let importedCount = 0
  for (const file of mp4Files) {
    const rel = path.relative(baseDir, file)
    const parts = rel.split(path.sep)
    const levelName = parts[0] || 'Tsunagaru'
    const fileName = path.basename(file, '.mp4')
    const title = `[${levelName.replace('_', ' ')}] ${fileName}`

    // Kiểm tra xem đã import chưa
    const existing = await pool.query(
      'SELECT id FROM media_assets WHERE original_filename = $1 AND deleted_at IS NULL',
      [rel]
    )
    if (existing.rows.length > 0) {
      continue
    }

    const assetId = randomUUID()
    const stat = fs.statSync(file)
    const assetFolder = path.join(mediaStorageDir, assetId)
    fs.mkdirSync(assetFolder, { recursive: true })

    // Copy video vào storage
    const targetPath = path.join(assetFolder, 'original.mp4')
    fs.copyFileSync(file, targetPath)

    const storageKey = `${assetId}/original.mp4`

    await pool.query(
      `INSERT INTO media_assets 
       (id, owner_user_id, source_type, title, language, rights_basis, source_reference, original_filename, 
        processing_status, storage_key, mime_type, byte_size, created_at, updated_at)
       VALUES ($1, $2, 'catalog', $3, 'ja', 'licensed', $4, $5, 'ready', $6, 'video/mp4', $7, NOW(), NOW())`,
      [assetId, ownerUserId, title, `Tsunagaru ${levelName}`, rel, storageKey, stat.size]
    )

    importedCount++
    if (importedCount % 10 === 0 || importedCount === mp4Files.length) {
      console.log(`Đã nạp ${importedCount}/${mp4Files.length} video...`)
    }
  }

  console.log(`✅ HOÀN TẤT: Đã nạp thành công ${importedCount} video vào kho bài học Kotodama!`)
  await pool.end()
}

main().catch((err) => {
  console.error('Import error:', err)
  process.exit(1)
})
