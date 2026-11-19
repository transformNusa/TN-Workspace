import { execFile, spawn } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { dialog, shell, BrowserWindow } from 'electron'
import {
  CUSTOM_APP_PREFIX, LAUNCHER_LABEL, isCustomApp, isWebResource,
  type LaunchResult, type LauncherApp, type OpenAllResult, type ProfileRow, type ResourceRow, type WebTarget
} from '@shared/data'
import * as repo from '../db/repo'
import { openInBrowser, openInDefaultBrowser } from '../browser'
import { getAllSettings } from '../settings/repository'

/** Jenis file yang tidak boleh dijalankan lewat resource "File" (jalur eksekusi harus lewat resource Aplikasi yang eksplisit). */
export const BLOCKED_EXT = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.ps1', '.vbs', '.vbe', '.js', '.jse', '.wsf', '.hta', '.jar', '.reg', '.lnk', '.cpl', '.msc'
])

/** Argumen baris perintah untuk aplikasi bawaan. Fungsi murni (mudah diuji). */
export function buildLaunchArgs(app: string, target: string): string[] {
  if (app === 'godot') {
    const dir = extname(target).toLowerCase() === '.godot' ? dirname(target) : target
    return ['--editor', '--path', dir]
  }
  return [target]
}

/** Pecah templat argumen menjadi token (spasi memisahkan, tanda kutip ganda menyatukan). */
export function tokenizeArgs(template: string): string[] {
  const out: string[] = []
  const re = /"([^"]*)"|(\S+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(template))) out.push(m[1] ?? m[2])
  return out
}

/** Templat argumen Aplikasi Saya. `{target}` diganti target resource; tanpa target, token yang memuatnya dibuang. */
export function buildCustomArgs(template: string, target?: string | null): string[] {
  const tokens = tokenizeArgs(template)
  return tokens.flatMap((t) => (t.includes('{target}') ? (target ? [t.split('{target}').join(target)] : []) : [t]))
}

const SETUP_HINT = 'Atur di Pengaturan → Aplikasi & Path.'
const SPREADSHEET_EXT = new Set(['.xlsx', '.xls', '.csv'])

/** Buka file spreadsheet sesuai Pengaturan → Spreadsheet (GridCraft / Excel / web). */
export async function openSpreadsheet(target: string): Promise<LaunchResult> {
  const mode = getAllSettings().spreadsheet.mode
  if (mode === 'excel') return openWithApp('excel', target)
  if (mode === 'web') {
    const prof = repo.getProfile(getAllSettings().spreadsheet.profileId)
    if (prof && prof.homeUrl) return { ok: true, web: { profileId: prof.id } }
    return { ok: false, message: 'Mode spreadsheet web dipilih tetapi profil web belum diatur. Atur di Pengaturan → Spreadsheet.' }
  }
  return openWithApp('gridcraft', target)
}

function spawnDetached(exe: string, args: string[]): Promise<LaunchResult> {
  return new Promise((resolve) => {
    try {
      // Tanpa shell: argumen dikirim apa adanya, jadi tidak ada risiko injeksi perintah.
      const child = spawn(exe, args, { detached: true, stdio: 'ignore' })
      child.once('error', (e) => resolve({ ok: false, message: `Gagal membuka: ${e.message}` }))
      child.once('spawn', () => {
        child.unref()
        resolve({ ok: true })
      })
    } catch (e) {
      resolve({ ok: false, message: `Gagal membuka: ${e instanceof Error ? e.message : String(e)}` })
    }
  })
}

function isFile(p: string): boolean {
  try { return statSync(p).isFile() } catch { return false }
}

/** Nama tampilan sebuah rujukan aplikasi (bawaan atau "Aplikasi Saya"). */
export function appLabel(ref: string): string {
  if (isCustomApp(ref)) {
    const id = ref.slice(CUSTOM_APP_PREFIX.length)
    return getAllSettings().launchers.apps.find((a) => a.id === id)?.name ?? 'aplikasi yang sudah dihapus'
  }
  return LAUNCHER_LABEL[ref as LauncherApp] ?? ref
}

export async function openWithApp(ref: string, target?: string | null): Promise<LaunchResult> {
  let exe: string
  let args: string[]
  let label: string
  if (isCustomApp(ref)) {
    const id = ref.slice(CUSTOM_APP_PREFIX.length)
    const app = getAllSettings().launchers.apps.find((a) => a.id === id)
    if (!app) return { ok: false, message: 'Aplikasi ini sudah dihapus dari Pengaturan → Aplikasi Saya.' }
    label = app.name
    exe = app.path.trim()
    args = buildCustomArgs(app.args, target)
  } else {
    label = LAUNCHER_LABEL[ref as LauncherApp] ?? ref
    exe = (getAllSettings().paths as Record<string, string>)[ref]?.trim() ?? ''
    args = target ? buildLaunchArgs(ref, target) : []
  }
  if (!exe) return { ok: false, message: `Path ${label} belum diisi. ${SETUP_HINT}` }
  if (!isFile(exe)) return { ok: false, message: `File ${label} tidak ditemukan: ${exe}. ${SETUP_HINT}` }
  if (target && !existsSync(target)) return { ok: false, message: `Target tidak ditemukan: ${target}` }
  return spawnDetached(exe, args)
}

export async function openNativeProfile(p: ProfileRow): Promise<LaunchResult> {
  const exe = p.nativePath?.trim() ?? ''
  if (!exe) return { ok: false, message: `${p.name} diatur "hanya luncurkan app native" tetapi path aplikasinya kosong. Atur di Pengaturan → Layanan Web.` }
  if (!isFile(exe)) return { ok: false, message: `Aplikasi ${p.name} tidak ditemukan: ${exe}` }
  return spawnDetached(exe, [])
}

/** Buka layanan web di jendela Chrome/Edge asli (login Google berfungsi di sana). */
export async function openProfileInBrowser(p: ProfileRow, url?: string): Promise<LaunchResult> {
  const target = (url && /^https?:\/\//i.test(url) ? url : p.homeUrl) ?? ''
  if (!target) return { ok: false, message: `URL ${p.name} belum diatur. Atur di Pengaturan → Layanan Web.` }
  return openInBrowser(target, p.partitionId)
}

/** Opsi ringan: buka layanan di browser bawaan (satu tab, tanpa instance browser baru). */
export async function openProfileExternally(p: ProfileRow): Promise<LaunchResult> {
  if (!p.homeUrl) return { ok: false, message: `URL ${p.name} belum diatur. Atur di Pengaturan → Layanan Web.` }
  return openInDefaultBrowser(p.homeUrl)
}

export async function openResource(r: ResourceRow): Promise<LaunchResult> {
  const target = r.target ?? ''
  if (isWebResource(r.type) && r.profileId) {
    const prof = repo.getProfile(r.profileId)
    if (!prof) return { ok: false, message: 'Layanan web untuk resource ini sudah dihapus.' }
    if (prof.nativeOnly) return openNativeProfile(prof)
    if (prof.external) {
      const url = target || prof.homeUrl
      if (!url) return { ok: false, message: `URL ${prof.name} belum diatur. Atur di Pengaturan → Layanan Web.` }
      return openInDefaultBrowser(url)
    }
    if (!target && !prof.homeUrl) return { ok: false, message: `URL ${prof.name} belum diatur. Atur di Pengaturan → Layanan Web.` }
    return { ok: true, web: { profileId: prof.id, url: target || undefined } }
  }
  if (isWebResource(r.type) && r.type !== 'url') return { ok: false, message: 'Layanan web untuk resource ini sudah dihapus.' }
  switch (r.type) {
    case 'folder': {
      if (!existsSync(target)) return { ok: false, message: `Folder tidak ditemukan: ${target}` }
      const err = await shell.openPath(target)
      return err ? { ok: false, message: err } : { ok: true }
    }
    case 'file': {
      if (BLOCKED_EXT.has(extname(target).toLowerCase())) {
        return { ok: false, message: 'File program tidak dibuka langsung demi keamanan. Pakai resource tipe Aplikasi.' }
      }
      if (!existsSync(target)) return { ok: false, message: `File tidak ditemukan: ${target}` }
      if (SPREADSHEET_EXT.has(extname(target).toLowerCase())) return openSpreadsheet(target)
      const err = await shell.openPath(target)
      return err ? { ok: false, message: err } : { ok: true }
    }
    case 'tool': {
      if (!target) return { ok: false, message: 'Resource tool ini tidak punya file hasil.' }
      if (BLOCKED_EXT.has(extname(target).toLowerCase())) return { ok: false, message: 'File program tidak dibuka langsung demi keamanan.' }
      if (!existsSync(target)) return { ok: false, message: `File tidak ditemukan: ${target}` }
      const err = await shell.openPath(target)
      return err ? { ok: false, message: err } : { ok: true }
    }
    case 'launcher':
      return r.launcherApp ? openWithApp(r.launcherApp, target) : { ok: false, message: 'Aplikasi belum dipilih' }
    case 'url': // resource lama tanpa profil: buka di browser bawaan
      if (!/^https?:\/\//i.test(target)) return { ok: false, message: 'Link tidak valid' }
      await shell.openExternal(target)
      return { ok: true, message: 'Dibuka di browser bawaan. Pilih layanan web agar terbuka di dalam app.' }
    default:
      return { ok: false, message: `Jenis resource ${r.type} belum didukung.` }
  }
}

export async function openResourceWith(r: ResourceRow, app: string): Promise<LaunchResult> {
  if (r.type !== 'folder' && r.type !== 'file') return { ok: false, message: 'Hanya folder atau file yang bisa dibuka dengan aplikasi.' }
  return openWithApp(app, r.target)
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
const MAX_WEB_PANELS = 2

/** "Buka semua": aplikasi native dibuka berurutan; resource web dikumpulkan (maks 2 panel berdampingan). */
export async function openAll(taskId: string): Promise<OpenAllResult> {
  const out: OpenAllResult = { opened: 0, failed: [], web: [], webSkipped: 0 }
  for (const r of repo.listResources(taskId)) {
    const res = await openResource(r)
    if (!res.ok) {
      out.failed.push({ title: r.title, message: res.message ?? 'Gagal' })
    } else if (res.web) {
      const w: WebTarget = res.web
      if (out.web.some((x) => x.profileId === w.profileId)) out.opened++ // profil sama sudah ada di panel
      else if (out.web.length < MAX_WEB_PANELS) { out.web.push(w); out.opened++ }
      else out.webSkipped++
    } else {
      out.opened++
      await sleep(350) // beri jeda agar jendela tidak berebut fokus
    }
  }
  if (out.opened > 0) repo.noteResourcesOpened(taskId, out.opened)
  return out
}

/** Tes path dari kolom Pengaturan (nilai draft). */
export async function testPath(app: string, path: string): Promise<LaunchResult> {
  const p = path.trim()
  if (!p) return { ok: false, message: 'Path masih kosong.' }
  if (!isFile(p)) return { ok: false, message: `File tidak ditemukan: ${p}` }
  if (app === 'python') {
    return new Promise((resolve) => {
      execFile(p, ['--version'], { timeout: 8000, windowsHide: true }, (err, stdout, stderr) => {
        const text = `${stdout}${stderr}`.trim()
        if (err && !text) resolve({ ok: false, message: `Gagal dijalankan: ${err.message}` })
        else resolve({ ok: true, message: text ? `Terdeteksi: ${text}` : 'Dapat dijalankan.' })
      })
    })
  }
  const res = await spawnDetached(p, [])
  return res.ok ? { ok: true, message: `Perintah buka ${LAUNCHER_LABEL[app as LauncherApp] ?? 'aplikasi'} dikirim. Jendelanya seharusnya muncul.` } : res
}

/** Tebakan lokasi instalasi umum di Windows. Hasilnya hanya mengisi kolom, tetap perlu Simpan. */
export function detectPaths(): Record<string, string> {
  const env = process.env
  const local = env['LOCALAPPDATA'] ?? ''
  const pf = env['ProgramFiles'] ?? ''
  const pf86 = env['ProgramFiles(x86)'] ?? ''
  const cands: Record<string, string[]> = {
    vscode: [join(local, 'Programs', 'Microsoft VS Code', 'Code.exe'), join(pf, 'Microsoft VS Code', 'Code.exe')],
    kiro: [join(local, 'Programs', 'Kiro', 'Kiro.exe'), join(pf, 'Kiro', 'Kiro.exe')],
    excel: ['Office16', 'Office15'].flatMap((o) => [join(pf, 'Microsoft Office', 'root', o, 'EXCEL.EXE'), join(pf86, 'Microsoft Office', 'root', o, 'EXCEL.EXE')]),
    browser: [
      join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
    ]
  }
  const found: Record<string, string> = {}
  for (const [k, list] of Object.entries(cands)) {
    const hit = list.find((c) => c && isFile(c))
    if (hit) found[k] = hit
  }
  return found
}

export async function pickPath(kind: 'file' | 'folder'): Promise<string | null> {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const opts = { properties: [kind === 'folder' ? 'openDirectory' : 'openFile'] as ('openDirectory' | 'openFile')[] }
  const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
  return res.canceled || !res.filePaths[0] ? null : res.filePaths[0]
}

/** Pilih beberapa file (mis. banyak gambar) atau beberapa folder. */
export async function pickPaths(kind: 'file' | 'folder'): Promise<string[]> {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const opts = {
    properties: [kind === 'folder' ? 'openDirectory' : 'openFile', 'multiSelections'] as ('openDirectory' | 'openFile' | 'multiSelections')[]
  }
  const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
  return res.canceled ? [] : res.filePaths
}
