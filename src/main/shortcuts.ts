import { globalShortcut, type BrowserWindow } from 'electron'
import { IPC, type ShortcutStatus } from '@shared/api'
import { getAllSettings } from './settings/repository'

let status: ShortcutStatus = { accelerator: '', registered: false, error: null, screenshot: null }

export function shortcutStatus(): ShortcutStatus {
  return status
}

function registerOne(
  win: BrowserWindow | null, accelerator: string, channel: string, payload?: unknown
): { accelerator: string; registered: boolean; error: string | null } | null {
  const acc = accelerator.trim()
  if (!acc) return null
  try {
    const registered = globalShortcut.register(acc, () => {
      if (!win || win.isDestroyed()) return
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
      if (payload === undefined) win.webContents.send(channel)
      else win.webContents.send(channel, payload)
    })
    return {
      accelerator: acc,
      registered,
      error: registered ? null : 'Pintasan tidak bisa didaftarkan (mungkin dipakai aplikasi lain, atau formatnya tidak dikenal).'
    }
  } catch (e) {
    return { accelerator: acc, registered: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Daftarkan pintasan global (Pengaturan → Pintasan). Gagal terdaftar bukan error fatal:
 * statusnya dilaporkan ke halaman Pengaturan dan app tetap bisa dipakai.
 */
export function registerShortcuts(win: BrowserWindow | null): ShortcutStatus {
  unregisterShortcuts()
  let capture = ''
  let screenshot = ''
  try {
    const s = getAllSettings().shortcuts
    capture = s.capture
    screenshot = s.screenshot
  } catch (e) {
    status = { accelerator: capture, registered: false, error: e instanceof Error ? e.message : String(e), screenshot: null }
    return status
  }
  const cap = registerOne(win, capture, IPC.captureRequest)
  const shot = registerOne(win, screenshot, IPC.toolOpen, 'screenshot-editor')
  // Pintasan capture memakai channel sendiri; screenshot mengirim id tool sebagai payload.
  status = {
    accelerator: capture,
    registered: cap?.registered ?? false,
    error: cap?.error ?? 'Pintasan kosong',
    screenshot: shot
  }
  return status
}

export function unregisterShortcuts(): void {
  try { globalShortcut.unregisterAll() } catch { /* app sedang keluar */ }
}
