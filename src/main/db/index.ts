import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'node:path'
import init001 from '../../../migrations/001_init.sql?raw'
import profilesNativePath002 from '../../../migrations/002_profiles_native_path.sql?raw'
import profilesExternal003 from '../../../migrations/003_profiles_external.sql?raw'
import inboxReminders004 from '../../../migrations/004_inbox_reminders.sql?raw'
import timesheetTools005 from '../../../migrations/005_timesheet_tools.sql?raw'
import profilesGroup006 from '../../../migrations/006_profiles_group.sql?raw'
import quickNote007 from '../../../migrations/007_quick_note.sql?raw'

/** Daftar migrasi berurutan. Tambah berkas baru di `migrations/` lalu daftarkan di sini. */
const MIGRATIONS: { version: string; sql: string }[] = [
  { version: '001_init', sql: init001 },
  { version: '002_profiles_native_path', sql: profilesNativePath002 },
  { version: '003_profiles_external', sql: profilesExternal003 },
  { version: '004_inbox_reminders', sql: inboxReminders004 },
  { version: '005_timesheet_tools', sql: timesheetTools005 },
  { version: '006_profiles_group', sql: profilesGroup006 },
  { version: '007_quick_note', sql: quickNote007 }
]

let db: Database.Database | null = null

export function getDbPath(): string {
  return join(app.getPath('userData'), 'alip-workspace.db')
}

export function openDb(): Database.Database {
  if (db) return db
  db = new Database(getDbPath())
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  return db
}

function runMigrations(conn: Database.Database): void {
  conn.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
     )`
  )
  const applied = new Set(
    conn.prepare('SELECT version FROM schema_migrations').all().map((r) => (r as { version: string }).version)
  )
  for (const m of MIGRATIONS) {
    if (applied.has(m.version)) continue
    conn.transaction(() => {
      conn.exec(m.sql)
      conn.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(m.version)
    })()
  }
}

export function closeDb(): void {
  db?.close()
  db = null
}
