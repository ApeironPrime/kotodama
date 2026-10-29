import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'

try {
  const db = new DatabaseSync('data/master_dictionary.db')
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
  console.log('Tables in master_dictionary.db:', tables)
  for (const t of tables) {
    const info = db.prepare(`PRAGMA table_info(${t.name})`).all()
    console.log(t.name, info.map(c => c.name))
  }
} catch (e) {
  console.error('Error reading db:', e)
}
