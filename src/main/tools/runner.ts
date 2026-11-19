import { app, shell } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ToolManifest, ToolRunInputs, ToolRunResult } from '@shared/tools'
import { tokenizeArgs } from '../launcher'
import { getAllSettings } from '../settings/repository'
import { getTool } from './registry'

const active = new Map<string, ChildProcess>()
const TIMEOUT_MS = 10 * 60_000

export function cancelTool(id: string): void {
  const child = active.get(id)
  if (child && !child.killed) {
    child.kill()
    active.delete(id)
  }
}

function pythonPath(): string {
  const configured = getAllSettings().paths.python.trim()
  if (configured) return configured
  const base = app.isPackaged ? process.resourcesPath : app.getAppPath()
  const bundled = join(base, 'runtime', 'python', 'python.exe')
  return existsSync(bundled) ? bundled : 'python'
}

function commandFor(m: ToolManifest, entry: string): { exe: string; args: string[]; env: NodeJS.ProcessEnv } {
  if (m.runtime === 'python') return { exe: pythonPath(), args: [entry], env: process.env }
  if (m.runtime === 'node') return { exe: process.execPath, args: [entry], env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } }
  if (m.runtime === 'bat') return { exe: process.env['ComSpec'] ?? 'cmd.exe', args: ['/c', entry], env: process.env }
  return {
    exe: join(process.env['SystemRoot'] ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', entry],
    env: process.env
  }
}

/** Jalankan script di folder tool (bukan path acak) dan kembalikan log + file keluaran. */
function runScript(toolId: string, m: ToolManifest, inputs: ToolRunInputs): Promise<ToolRunResult> {
  const tool = getTool(toolId)
  if (!tool?.installPath) return Promise.resolve({ ok: false, message: 'Folder tool tidak ditemukan', outputs: [], log: '' })
  const entry = join(tool.installPath, m.entry ?? '')
  if (!m.entry || !existsSync(entry)) return Promise.resolve({ ok: false, message: `Entry tool tidak ditemukan: ${m.entry ?? '(kosong)'}`, outputs: [], log: '' })
  const inputFile = join(tool.installPath, '.alip-input.json')
  writeFileSync(inputFile, JSON.stringify(inputs ?? {}, null, 2))
  const { exe, args, env } = commandFor(m, entry)
  return new Promise((resolve) => {
    let log = ''
    let done = false
    const child = spawn(exe, [...args, inputFile], {
      cwd: tool.installPath,
      env: { ...env, ALIP_TOOL_ID: toolId, ALIP_INPUT_FILE: inputFile },
      windowsHide: true
    })
    active.set(toolId, child)
    const finish = (ok: boolean, message?: string): void => {
      if (done) return
      done = true
      active.delete(toolId)
      const outputs = parseOutputs(log, m)
      resolve({ ok, message: message ?? (outputs.length ? `${outputs.length} file dihasilkan.` : 'Selesai.'), outputs, log: log.slice(-20000) })
    }
    child.stdout?.on('data', (d: Buffer) => { log += d.toString() })
    child.stderr?.on('data', (d: Buffer) => { log += d.toString() })
    child.once('error', (e) => finish(false, `Gagal menjalankan tool: ${e.message}`))
    child.once('close', (code) => finish(code === 0, code === 0 ? undefined : `Tool keluar dengan kode ${code}.`))
    const timer = setTimeout(() => {
      if (!child.killed) child.kill()
      finish(false, 'Tool dihentikan karena melewati batas 10 menit.')
    }, TIMEOUT_MS)
    child.once('close', () => clearTimeout(timer))
  })
}

/** Script boleh mencetak JSON {"outputs":[...],"message":"..."} atau satu path per baris. */
function parseOutputs(log: string, m: ToolManifest): string[] {
  if (m.output !== 'files') return []
  const trimmed = log.trim()
  try {
    const parsed = JSON.parse(trimmed) as { outputs?: unknown }
    if (Array.isArray(parsed.outputs)) return parsed.outputs.filter((p): p is string => typeof p === 'string' && existsSync(p))
  } catch { /* bukan JSON */ }
  return trimmed.split(/\r?\n/).map((s) => s.trim()).filter((s) => s && existsSync(s))
}

function runLauncher(m: ToolManifest, inputs: ToolRunInputs): Promise<ToolRunResult> {
  const settings = getAllSettings()
  const exe = (m.exe?.trim() || (settings.paths as Record<string, string>)[m.id] || '').trim()
  if (!exe) return Promise.resolve({ ok: false, message: `Path ${m.title} belum diisi. Atur di Pengaturan → Aplikasi & Path.`, outputs: [], log: '' })
  if (!existsSync(exe)) return Promise.resolve({ ok: false, message: `File tidak ditemukan: ${exe}`, outputs: [], log: '' })
  const target = typeof inputs['target'] === 'string' ? inputs['target'] : ''
  const template = m.args ?? ''
  const args = template
    ? tokenizeArgs(template).flatMap((t) => (t.includes('{target}') ? (target ? [t.split('{target}').join(target)] : []) : [t]))
    : target ? [target] : []
  return new Promise((resolve) => {
    try {
      const child = spawn(exe, args, { detached: true, stdio: 'ignore' })
      child.once('error', (e) => resolve({ ok: false, message: `Gagal membuka: ${e.message}`, outputs: [], log: '' }))
      child.once('spawn', () => { child.unref(); resolve({ ok: true, message: `${m.title} dibuka.`, outputs: [], log: '' }) })
    } catch (e) {
      resolve({ ok: false, message: e instanceof Error ? e.message : String(e), outputs: [], log: '' })
    }
  })
}

export async function runTool(id: string, inputs: ToolRunInputs): Promise<ToolRunResult> {
  const tool = getTool(id)
  if (!tool) return { ok: false, message: 'Tool tidak ditemukan', outputs: [], log: '' }
  if (!tool.enabled) return { ok: false, message: 'Tool sedang dimatikan', outputs: [], log: '' }
  const m = tool.manifest
  if (m.type === 'launcher') return runLauncher(m, inputs)
  if (m.type === 'script') return runScript(id, m, inputs)
  if (m.type === 'web') {
    if (!m.url) return { ok: false, message: 'URL tool belum diisi', outputs: [], log: '' }
    if (/^https?:\/\//i.test(m.url)) await shell.openExternal(m.url)
    else if (/^file:\/\//i.test(m.url)) await shell.openPath(decodeURIComponent(m.url.replace(/^file:\/\//i, '')))
    else return { ok: false, message: 'URL tool harus http(s) atau file://', outputs: [], log: '' }
    return { ok: true, message: `${m.title} dibuka.`, outputs: [], log: '' }
  }
  return { ok: false, message: 'Tool bawaan dijalankan dari panelnya sendiri.', outputs: [], log: '' }
}

/** Lampiran hasil tool: file keluaran dicatat sebagai resource task bertipe `tool`. */
export function outputTitle(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}
