import { app, shell } from 'electron'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { LaunchResult } from '@shared/data'
import { getAllSettings } from './settings/repository'

/**
 * Google (dan beberapa penyedia login lain) menolak login dari browser tertanam.
 * Solusi praktis: buka layanan itu di jendela Chrome/Edge asli dengan profil khusus app,
 * sehingga login berhasil, passkey/Windows Hello berfungsi, dan sesinya tetap tersimpan.
 */

const BROWSER_LABEL: Record<string, string> = { chrome: 'Chrome', msedge: 'Edge' }

function isFile(p: string): boolean {
  try { return existsSync(p) && p.toLowerCase().endsWith('.exe') } catch { return false }
}

/** Cari Chrome/Edge: path dari Pengaturan dulu, lalu lokasi instalasi umum di Windows. */
export function findBrowserPath(): string | null {
  const custom = (getAllSettings().paths as Record<string, string>)['browser']?.trim()
  if (custom && isFile(custom)) return custom
  const env = process.env
  const local = env['LOCALAPPDATA'] ?? ''
  const pf = env['ProgramFiles'] ?? ''
  const pf86 = env['ProgramFiles(x86)'] ?? ''
  const cands = [
    join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
  ]
  return cands.find(isFile) ?? null
}

export function browserName(exe: string): string {
  const base = exe.replace(/\\/g, '/').split('/').pop()?.toLowerCase() ?? ''
  return BROWSER_LABEL[base.replace('.exe', '')] ?? 'browser'
}

/** Argumen Chrome "app mode": jendela tanpa address bar, memakai profil khusus milik app. */
export function browserAppArgs(url: string, userDataDir: string): string[] {
  return [`--app=${url}`, `--user-data-dir=${userDataDir}`, '--no-first-run', '--no-default-browser-check', '--disable-features=Translate']
}

const safeKey = (s: string): string => s.replace(/[^a-z0-9_-]/gi, '_').slice(0, 60) || 'default'

export async function openInBrowser(url: string, key: string): Promise<LaunchResult> {
  if (!/^https?:\/\//i.test(url)) return { ok: false, message: 'Hanya alamat http(s) yang bisa dibuka di browser.' }
  const exe = findBrowserPath()
  if (!exe) {
    await shell.openExternal(url)
    return { ok: true, message: 'Chrome/Edge tidak ditemukan, jadi dibuka di browser bawaan.' }
  }
  const dir = join(app.getPath('userData'), 'browser-profile', safeKey(key))
  try {
    const child = spawn(exe, browserAppArgs(url, dir), { detached: true, stdio: 'ignore' })
    child.once('error', () => { void shell.openExternal(url) })
    child.unref()
    return { ok: true, message: `Dibuka di jendela ${browserName(exe)} terpisah. Login di sana akan tersimpan.` }
  } catch {
    await shell.openExternal(url)
    return { ok: true, message: 'Dibuka di browser bawaan.' }
  }
}

/**
 * Opsi paling ringan: buka di browser bawaan (Firefox/Chrome/Edge yang biasanya sudah hidup).
 * Tidak menambah instance browser baru — hanya satu tab, dan bila browser itu sudah login Google,
 * situs langsung terbuka dalam keadaan login.
 */
export async function openInDefaultBrowser(url: string): Promise<LaunchResult> {
  if (!/^https?:\/\//i.test(url)) return { ok: false, message: 'Hanya alamat http(s) yang bisa dibuka di browser.' }
  await shell.openExternal(url)
  return { ok: true, message: 'Dibuka di browser bawaan (tab baru, tanpa instance browser tambahan).' }
}
