import { DEFAULT_SETTINGS, settingsSchemas, type Settings, type SettingsSectionKey } from '@shared/settings'
import { openDb } from '../db'

/** Baca semua seksi. Nilai tersimpan digabung ke default; seksi rusak kembali ke default. */
export function getAllSettings(): Settings {
  const rows = openDb().prepare('SELECT key, value_json FROM settings').all() as {
    key: string
    value_json: string
  }[]
  const out: Settings = structuredClone(DEFAULT_SETTINGS)
  for (const row of rows) {
    const key = row.key as SettingsSectionKey
    if (!(key in settingsSchemas)) continue
    try {
      const merged = { ...DEFAULT_SETTINGS[key], ...JSON.parse(row.value_json) }
      const parsed = settingsSchemas[key].safeParse(merged)
      if (parsed.success) (out[key] as unknown) = parsed.data
    } catch {
      // JSON rusak: pakai default
    }
  }
  return out
}

export type SetResult = { ok: true; settings: Settings } | { ok: false; error: string }

export function setSection(section: SettingsSectionKey, value: unknown): SetResult {
  const parsed = settingsSchemas[section].safeParse(value)
  if (!parsed.success) {
    const error = parsed.error.issues.map((i) => `${i.path.join('.') || section}: ${i.message}`).join('; ')
    return { ok: false, error }
  }
  openDb()
    .prepare(
      `INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`
    )
    .run(section, JSON.stringify(parsed.data))
  return { ok: true, settings: getAllSettings() }
}
