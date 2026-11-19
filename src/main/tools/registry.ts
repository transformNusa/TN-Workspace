import { app } from 'electron'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, extname, join, resolve, sep } from 'node:path'
import { BUILTIN_TOOLS, toolManifestSchema, type ToolManifest, type ToolRow } from '@shared/tools'
import * as dbTools from '../db/tools'

/** Folder tool milik app: hanya script dari sini yang boleh dijalankan (bible 11.7). */
export function toolsRoot(): string {
  return join(app.getPath('userData'), 'tools')
}

const RUNTIME_BY_EXT: Record<string, ToolManifest['runtime']> = {
  '.py': 'python', '.js': 'node', '.bat': 'bat', '.cmd': 'bat', '.ps1': 'powershell'
}

export function safeToolId(raw: string): string {
  const id = raw.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48)
  return /^[a-z0-9][a-z0-9-]{1,48}$/.test(id) ? id : `tool-${Date.now().toString(36)}`
}

/** Manifest dasar saat pengguna mengimpor script tanpa tool.json (bible 11.5). */
export function inferManifest(sourcePath: string, overrides: Partial<ToolManifest> = {}): ToolManifest {
  const isDir = statSync(sourcePath).isDirectory()
  const base = isDir ? basename(sourcePath) : basename(sourcePath, extname(sourcePath))
  const entry = isDir ? '' : basename(sourcePath)
  const ext = isDir ? '' : extname(sourcePath).toLowerCase()
  const manifest = toolManifestSchema.parse({
    id: safeToolId(overrides.id ?? base),
    title: overrides.title?.trim() || base.replace(/[-_]+/g, ' '),
    type: overrides.type ?? (isDir ? 'script' : 'script'),
    runtime: overrides.runtime ?? RUNTIME_BY_EXT[ext] ?? 'node',
    entry: overrides.entry ?? entry,
    ui: overrides.ui ?? 'auto-form',
    inputs: overrides.inputs ?? [],
    output: overrides.output ?? 'none',
    dockable: overrides.dockable ?? true,
    attachableToTask: overrides.attachableToTask ?? true,
    ...overrides
  })
  return manifest
}

function readManifestFromDir(dir: string, overrides: Partial<ToolManifest>): ToolManifest {
  const file = join(dir, 'tool.json')
  if (!existsSync(file)) throw new Error('Folder tidak berisi tool.json. Tambahkan manifest atau impor file script langsung.')
  const raw: unknown = JSON.parse(readFileSync(file, 'utf8'))
  const merged = { ...(raw as object), ...overrides }
  return toolManifestSchema.parse(merged)
}

/** Salin tool ke folder app lalu daftarkan. Impor ulang id yang sama = perbarui. */
export function installTool(sourcePath: string, overrides: Partial<ToolManifest> = {}): ToolRow {
  if (!existsSync(sourcePath)) throw new Error('File tool tidak ditemukan')
  const isDir = statSync(sourcePath).isDirectory()
  const manifest = isDir ? readManifestFromDir(sourcePath, overrides) : inferManifest(sourcePath, overrides)
  if (manifest.type === 'builtin') throw new Error('Tool bawaan tidak perlu diimpor')
  if (BUILTIN_TOOLS.some((b) => b.id === manifest.id)) throw new Error(`id "${manifest.id}" dipakai tool bawaan. Ganti id di tool.json.`)
  const dest = join(toolsRoot(), manifest.id)
  mkdirSync(toolsRoot(), { recursive: true })
  rmSync(dest, { recursive: true, force: true })
  if (isDir) {
    cpSync(sourcePath, dest, { recursive: true })
  } else {
    mkdirSync(dest, { recursive: true })
    cpSync(sourcePath, join(dest, manifest.entry || basename(sourcePath)))
  }
  writeFileSync(join(dest, 'tool.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  dbTools.upsertTool(manifest, dest)
  return dbTools.getStoredTool(manifest.id)!
}

export function listTools(): ToolRow[] {
  const imported = dbTools.listStoredTools()
  const builtins: ToolRow[] = BUILTIN_TOOLS.map((m) => ({
    id: m.id, manifest: m, installPath: '', enabled: true, dockSlot: null, builtin: true
  }))
  return [...builtins, ...imported]
}

export function getTool(id: string): ToolRow | null {
  return listTools().find((t) => t.id === id) ?? null
}

/** Pastikan path yang dihapus benar-benar di dalam folder tools milik app. */
function assertInsideTools(p: string): void {
  const root = resolve(toolsRoot())
  const target = resolve(p)
  if (target !== root && !target.startsWith(`${root}${sep}`)) throw new Error('Path tool di luar folder app')
}

export function removeTool(id: string): void {
  const tool = getTool(id)
  if (!tool) throw new Error('Tool tidak ditemukan')
  if (tool.builtin) throw new Error('Tool bawaan tidak bisa dihapus')
  if (tool.installPath) {
    assertInsideTools(tool.installPath)
    rmSync(tool.installPath, { recursive: true, force: true })
  }
  dbTools.removeToolRow(id)
  for (const slot of dbTools.listLayout()) if (slot.toolId === id) dbTools.setLayoutSlot(slot.slotId, null)
}

export function setToolEnabled(id: string, enabled: boolean): ToolRow[] {
  const tool = getTool(id)
  if (!tool) throw new Error('Tool tidak ditemukan')
  if (tool.builtin) throw new Error('Tool bawaan selalu aktif')
  dbTools.setToolEnabled(id, enabled)
  return listTools()
}
