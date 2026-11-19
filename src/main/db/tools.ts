import type { LayoutRow, LayoutSlotId, ToolManifest, ToolRow } from '@shared/tools'
import { openDb } from './index'

type ToolDbRow = {
  id: string
  manifestJson: string
  installPath: string | null
  enabled: number
  dockSlot: string | null
}

const db = () => openDb()

function toTool(r: ToolDbRow): ToolRow {
  const manifest = JSON.parse(r.manifestJson) as ToolManifest
  return {
    id: manifest.id,
    manifest,
    installPath: r.installPath ?? '',
    enabled: r.enabled === 1,
    dockSlot: r.dockSlot,
    builtin: manifest.type === 'builtin'
  }
}

export function listStoredTools(): ToolRow[] {
  return (db()
    .prepare('SELECT id, manifest_json AS manifestJson, install_path AS installPath, enabled, dock_slot AS dockSlot FROM tools ORDER BY created_at')
    .all() as ToolDbRow[]).map(toTool)
}

export function getStoredTool(id: string): ToolRow | null {
  const r = db()
    .prepare('SELECT id, manifest_json AS manifestJson, install_path AS installPath, enabled, dock_slot AS dockSlot FROM tools WHERE id = ?')
    .get(id) as ToolDbRow | undefined
  return r ? toTool(r) : null
}

/** Tool terpasang menimpa manifest lama dengan id yang sama (impor ulang = update). */
export function upsertTool(manifest: ToolManifest, installPath: string): void {
  db()
    .prepare(
      `INSERT INTO tools (id, tool_id, manifest_json, install_path, enabled)
       VALUES (?, ?, ?, ?, 1)
       ON CONFLICT(tool_id) DO UPDATE SET manifest_json = excluded.manifest_json, install_path = excluded.install_path, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`
    )
    .run(manifest.id, manifest.id, JSON.stringify(manifest), installPath)
}

export function removeToolRow(id: string): void {
  db().prepare('DELETE FROM tools WHERE tool_id = ?').run(id)
}

export function setToolEnabled(id: string, enabled: boolean): void {
  db().prepare('UPDATE tools SET enabled = ?, updated_at = ? WHERE tool_id = ?').run(enabled ? 1 : 0, new Date().toISOString(), id)
}

// -------------------------------------------------------------------- layout
const DEFAULT_LAYOUT: LayoutRow[] = [
  { slotId: 'right', toolId: null, size: 340 },
  { slotId: 'bottom', toolId: null, size: 220 }
]

export function listLayout(): LayoutRow[] {
  const rows = db().prepare('SELECT slot_id AS slotId, tool_id AS toolId, COALESCE(size, 0) AS size FROM layout').all() as LayoutRow[]
  return DEFAULT_LAYOUT.map((d) => {
    const hit = rows.find((r) => r.slotId === d.slotId)
    return hit ? { slotId: hit.slotId as LayoutSlotId, toolId: hit.toolId, size: hit.size || d.size } : { ...d }
  })
}

export function setLayoutSlot(slotId: LayoutSlotId, toolId: string | null, size?: number): LayoutRow[] {
  const current = listLayout().find((l) => l.slotId === slotId)!
  const next = size && size > 0 ? Math.round(size) : current.size
  db()
    .prepare(
      `INSERT INTO layout (id, slot_id, tool_id, size) VALUES (?, ?, ?, ?)
       ON CONFLICT(slot_id) DO UPDATE SET tool_id = excluded.tool_id, size = excluded.size, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`
    )
    .run(`slot-${slotId}`, slotId, toolId, next)
  return listLayout()
}
