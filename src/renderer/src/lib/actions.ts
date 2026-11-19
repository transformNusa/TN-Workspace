import type { Reminder } from '@shared/data'
import { useData } from '@renderer/store/data'
import { useInbox } from '@renderer/store/inbox'
import { useSettings } from '@renderer/store/settings'
import { useUi } from '@renderer/store/ui'

/** Mulai timer task ini, atau jeda timernya sendiri. Timer task lain tetap berjalan. */
export function toggleTimer(taskId: string): void {
  const { running, startTimer } = useData.getState()
  if (running.some((r) => r.taskId === taskId)) requestStop(taskId)
  else void startTimer(taskId)
}

export function requestStop(taskId: string): void {
  useUi.getState().setStopPrompt({ taskId })
}

export async function openTask(id: string, view: 'today' | 'tasks' = 'tasks'): Promise<void> {
  const ui = useUi.getState()
  if (ui.view !== 'today' && ui.view !== 'tasks' && ui.view !== 'waiting' && ui.view !== 'done') ui.setView(view)
  await useData.getState().select(id)
  // Fase 5: timer mulai sendiri saat task dibuka (bisa dimatikan di Pengaturan → Waktu Kerja).
  const st = useData.getState()
  const detail = st.detail
  const alreadyRunning = st.running.some((r) => r.taskId === id)
  if (!alreadyRunning && detail?.status !== 'selesai' && detail?.status !== 'menunggu' && useSettings.getState().settings.work.autoStartTimer) {
    await st.startTimer(id)
  }
}

const notify = (kind: 'ok' | 'error', text: string): void => useUi.getState().setNotice({ kind, text })

/** Buka panel web (maks 2 berdampingan). URL tujuan dikirim ke view sebelum panel ditampilkan. */
export async function openWebPanel(targets: { profileId: string; url?: string }[], fromTaskId: string | null): Promise<void> {
  for (const t of targets) {
    if (!t.url) continue
    try { await window.alip.views.open(t.profileId, t.url) } catch (e) { notify('error', e instanceof Error ? e.message : String(e)) }
  }
  useUi.getState().openWeb(targets.map((t) => ({ profileId: t.profileId })), fromTaskId)
}

/** Buka sebuah layanan dari sidebar/palette. Native → app; external → browser bawaan; sisanya panel tertanam. */
export async function openProfile(profileId: string): Promise<void> {
  const p = (await window.alip.profiles.list()).find((x) => x.id === profileId)
  if (!p) return notify('error', 'Layanan tidak ditemukan')
  if (p.nativeOnly) {
    const r = await window.alip.profiles.openNative(profileId)
    if (!r.ok) notify('error', r.message ?? 'Gagal membuka aplikasi')
    return
  }
  if (!p.homeUrl) {
    notify('error', `URL ${p.name} belum diatur. Atur di Pengaturan → Layanan Web.`)
    return
  }
  if (p.external) {
    // Login layanan ini tidak bisa di dalam app (mis. Google): buka langsung di browser bawaan.
    const r = await window.alip.profiles.openExternal(profileId)
    if (!r.ok) notify('error', r.message ?? 'Gagal membuka browser')
    else notify('ok', `${p.name} dibuka di browser bawaan.`)
    return
  }
  await openWebPanel([{ profileId }], null)
}

/** Buka satu resource lalu tampilkan hasilnya (galat jadi pesan yang bisa ditindaklanjuti). */
export async function openResource(id: string): Promise<void> {
  const r = await window.alip.resources.open(id)
  if (!r.ok) notify('error', r.message ?? 'Gagal membuka resource')
  else if (r.web) await openWebPanel([r.web], useData.getState().selectedId)
  else if (r.message) notify('ok', r.message)
  void useData.getState().refresh()
}

export async function openResourceWith(id: string, app: string): Promise<void> {
  const r = await window.alip.resources.openWith(id, app)
  if (!r.ok) notify('error', r.message ?? 'Gagal membuka resource')
  void useData.getState().refresh()
}

export async function openAllResources(taskId: string): Promise<void> {
  const r = await window.alip.resources.openAll(taskId)
  const extra = r.webSkipped ? ` ${r.webSkipped} resource web tidak dibuka bersamaan (maks 2 panel).` : ''
  if (r.failed.length) {
    notify('error', `${r.opened} dibuka, ${r.failed.length} gagal: ${r.failed.map((f) => `${f.title} (${f.message})`).join('; ')}.${extra}`)
  } else if (r.opened === 0 && r.web.length === 0) {
    notify('error', 'Task ini belum punya resource.')
  } else {
    notify('ok', `${r.opened} resource dibuka.${extra}`)
  }
  if (r.web.length) await openWebPanel(r.web, taskId)
  void useData.getState().refresh()
}

/** Tangkap cepat: baca clipboard lewat main process lalu buka dialog (juga dipakai pintasan global). */
export async function openCapture(): Promise<void> {
  let text = ''
  try { text = await window.alip.inbox.readClipboard() } catch { /* clipboard kosong */ }
  useUi.getState().setDialog({ type: 'capture', text })
}

/** Buka sasaran pengingat (task, inbox, atau timesheet). */
export async function openReminder(r: Reminder): Promise<void> {
  const ui = useUi.getState()
  if (r.taskId) {
    await openTask(r.taskId)
    return
  }
  if (r.kind === 'inbox') {
    ui.setView('inbox')
    if (r.inboxId) useInbox.getState().select(r.inboxId)
    return
  }
  ui.setView('timesheet')
}
