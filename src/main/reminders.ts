import { BrowserWindow, Notification } from 'electron'
import { IPC } from '@shared/api'
import type { Reminder, ReminderInboxLite, ReminderTaskLite } from '@shared/data'
import * as repo from './db/repo'
import { getAllSettings } from './settings/repository'

/** Ambang dari Pengaturan → Pengingat (bible 9.11 & 10). */
export type ReminderThresholds = {
  staleDays: number
  waitingDays: number
  inboxDays: number
  fridayReminderTime: string
  workDays: number[]
}

export type CollectInput = {
  now: Date
  thresholds: ReminderThresholds
  tasks: ReminderTaskLite[]
  /** Hanya item berstatus baru/ditunda yang perlu dikirim repo. */
  inbox: ReminderInboxLite[]
  /** Jam tercatat minggu ini, untuk teks pengingat Jumat. */
  weekSeconds?: number
  /** Entri minggu ini yang belum ditandai tersalin ke Sunfish (Fase 5). */
  unsyncedEntries?: number
}

const DAY_MS = 86_400_000
const MEASURING = !!process.env['ALIP_MEASURE']

const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const daysSince = (iso: string, now: Date): number =>
  Math.max(0, Math.floor((startOfDay(now).getTime() - startOfDay(new Date(iso)).getTime()) / DAY_MS))
const hhmm = (d: Date): string => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
const dayLabel = (iso: string): string => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(iso))
const quote = (s: string, max = 80): string => {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}
const todayKey = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Rentang Senin 00:00 sampai Senin berikutnya (waktu lokal), untuk timesheet mingguan. */
export function weekBounds(now: Date): { from: string; to: string } {
  const from = new Date(now)
  from.setHours(0, 0, 0, 0)
  from.setDate(from.getDate() - ((from.getDay() + 6) % 7))
  const to = new Date(from)
  to.setDate(to.getDate() + 7)
  return { from: from.toISOString(), to: to.toISOString() }
}

/** Kunci minggu ISO (mis. 2026-W19), dipakai agar pengingat Jumat tidak berulang. */
export function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7)
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/**
 * Hitung pengingat dari data mentah (tanpa DB) supaya bisa diuji.
 * Satu task menghasilkan paling banyak satu pengingat: lewat tenggat > menunggu balasan > pending lama.
 */
export function collectReminders(input: CollectInput): Reminder[] {
  const { now, thresholds: th } = input
  const out: Reminder[] = []

  for (const t of input.tasks) {
    if (t.remindMuted) continue
    if (t.dueAt && Date.parse(t.dueAt) < now.getTime()) {
      out.push({
        key: `overdue:${t.id}`, kind: 'overdue', taskId: t.id,
        title: 'Lewat tenggat',
        body: `"${quote(t.title)}" lewat tenggat ${dayLabel(t.dueAt)}.`
      })
      continue
    }
    if (t.status === 'menunggu' && t.waitingSince) {
      const days = daysSince(t.waitingSince, now)
      if (days >= th.waitingDays) {
        out.push({
          key: `waiting:${t.id}`, kind: 'waiting', taskId: t.id,
          title: 'Menunggu balasan',
          body: `"${quote(t.title)}" menunggu balasan ${days} hari.`
        })
      }
      continue
    }
    if (t.status === 'baru' || t.status === 'proses') {
      const days = daysSince(t.lastTouchedAt ?? t.createdAt, now)
      if (days >= th.staleDays) {
        out.push({
          key: `stale:${t.id}`, kind: 'stale', taskId: t.id,
          title: 'Pending lama',
          body: `"${quote(t.title)}" tidak disentuh ${days} hari.`
        })
      }
    }
  }

  // Item inbox lama digabung jadi satu pengingat supaya tidak membanjiri notifikasi.
  const staleInbox = input.inbox.filter(
    (i) => i.status === 'baru' && (!i.snoozeUntil || Date.parse(i.snoozeUntil) <= now.getTime()) &&
      daysSince(i.receivedAt ?? i.createdAt, now) >= th.inboxDays
  )
  if (staleInbox.length) {
    const oldest = staleInbox.reduce((a, b) => (Date.parse(a.receivedAt ?? a.createdAt) <= Date.parse(b.receivedAt ?? b.createdAt) ? a : b))
    out.push({
      key: 'inbox', kind: 'inbox', inboxId: oldest.id,
      title: `${staleInbox.length} item inbox belum ditangani`,
      body: `Tertua: "${quote(oldest.preview, 70)}".`
    })
  }

  // Pengingat timesheet Jumat sore (bible 9.11). Fase 5 menambah penanda "sudah disalin".
  const friday = now.getDay() === 5 && th.workDays.includes(5)
  if (friday && hhmm(now) >= th.fridayReminderTime) {
    const week = input.weekSeconds ?? 0
    const unsynced = input.unsyncedEntries ?? (week > 0 ? 1 : 0)
    if (unsynced > 0 || week === 0) {
      out.push({
        key: `timesheet:${isoWeekKey(now)}`, kind: 'timesheet',
        title: 'Timesheet belum disalin',
        body: unsynced > 0
          ? `${unsynced} entri minggu ini belum ditandai tersalin ke Sunfish.`
          : 'Belum ada jam tercatat minggu ini. Cek timesheet sebelum pulang.'
      })
    }
  }

  const rank: Record<Reminder['kind'], number> = { overdue: 0, waiting: 1, stale: 2, inbox: 3, timesheet: 4 }
  return out.sort((a, b) => rank[a.kind] - rank[b.kind])
}

// ------------------------------------------------------------- penjadwal
let timer: NodeJS.Timeout | null = null
let firstTimer: NodeJS.Timeout | null = null
let latest: Reminder[] = []
/** key → tanggal lokal saat notifikasi terakhir dikirim. */
const notified = new Map<string, string>()
/** key → tanggal lokal saat pengingat ditunda ("nanti saja"). */
const dismissed = new Map<string, string>()

export function currentReminders(): Reminder[] {
  return latest
}

/** Hitung ulang, kirim ke renderer, dan (bila `notify`) tampilkan notifikasi untuk yang baru. */
export function refreshReminders(win: BrowserWindow | null, notify = false): Reminder[] {
  const s = getAllSettings()
  const now = new Date()
  const today = todayKey(now)
  let list: Reminder[]
  try {
    const week = weekBounds(now)
    list = collectReminders({
      now,
      thresholds: { ...s.reminders, workDays: s.work.workDays },
      tasks: repo.listTasksForReminders(),
      inbox: repo.listInboxForReminders(),
      weekSeconds: repo.dayStats().weekSeconds,
      unsyncedEntries: repo.unsyncedEntriesCount(week.from, week.to)
    })
  } catch (e) {
    console.error('[TN] pengingat gagal dihitung:', e)
    return latest
  }
  const visible = list.filter((r) => dismissed.get(r.key) !== today)
  latest = visible
  if (win && !win.isDestroyed()) win.webContents.send(IPC.remindersUpdate, visible)
  if (notify) {
    for (const r of visible) {
      if (notified.get(r.key) === today) continue
      notified.set(r.key, today)
      if (s.reminders.notifySystem) showSystemNotification(win, r)
      if (win && !win.isDestroyed()) win.webContents.send(IPC.remindersNew, r)
    }
  }
  return visible
}

/** Tunda pengingat ini sampai besok (tidak mengubah data task). */
export function dismissReminder(key: string): Reminder[] {
  dismissed.set(key, todayKey(new Date()))
  latest = latest.filter((r) => r.key !== key)
  return latest
}

function showSystemNotification(win: BrowserWindow | null, r: Reminder): void {
  if (MEASURING) return
  try {
    if (!Notification.isSupported()) return
    const n = new Notification({ title: r.title, body: r.body })
    n.on('click', () => {
      if (!win || win.isDestroyed()) return
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
      win.webContents.send(IPC.remindersOpen, r)
    })
    n.show()
  } catch (e) {
    console.error('[TN] notifikasi Windows gagal:', e instanceof Error ? e.message : String(e))
  }
}

/** Mulai pemeriksaan berkala. Interval mengikuti Pengaturan → Pengingat (periksa tiap N menit). */
export function startReminderScheduler(win: BrowserWindow): void {
  stopReminderScheduler()
  let last = 0
  const tick = (): void => {
    if (win.isDestroyed()) return
    let minutes = 5
    try { minutes = getAllSettings().reminders.checkMinutes } catch { /* pakai default */ }
    if (Date.now() - last < minutes * 60_000) return
    last = Date.now()
    refreshReminders(win, true)
  }
  // Pemeriksaan pertama setelah jendela siap, lalu tiap 30 detik (murah: hanya query kecil).
  firstTimer = setTimeout(tick, 4000)
  timer = setInterval(tick, 30_000)
}

export function stopReminderScheduler(): void {
  if (firstTimer) clearTimeout(firstTimer)
  if (timer) clearInterval(timer)
  firstTimer = null
  timer = null
}
