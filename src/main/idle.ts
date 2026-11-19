import { powerMonitor, type BrowserWindow } from 'electron'
import { IPC } from '@shared/api'
import * as repo from './db/repo'
import { getAllSettings } from './settings/repository'

let timer: NodeJS.Timeout | null = null
const POLL_MS = 30_000

/**
 * Timer berhenti otomatis setelah `work.idleMinutes` tanpa aktivitas (bible 9.3).
 * Durasi dipotong sampai detik terakhir aktif, bukan sampai waktu pemeriksaan.
 */
export function startIdleWatcher(win: BrowserWindow): void {
  stopIdleWatcher()
  timer = setInterval(() => {
    if (win.isDestroyed()) return
    // Semua timer berjalan (bisa lebih dari satu task) dijeda saat idle.
    if (repo.listActiveTimers().length === 0) return
    let minutes = 10
    try { minutes = getAllSettings().work.idleMinutes } catch { /* default */ }
    const idleSeconds = powerMonitor.getSystemIdleTime()
    if (idleSeconds < minutes * 60) return
    const cutoff = new Date(Date.now() - idleSeconds * 1000)
    const stopped = repo.stopTimerIdle(cutoff)
    if (stopped.length) {
      try { win.webContents.send(IPC.timerIdle, stopped) } catch { /* jendela ditutup */ }
    }
  }, POLL_MS)
}

export function stopIdleWatcher(): void {
  if (timer) clearInterval(timer)
  timer = null
}
