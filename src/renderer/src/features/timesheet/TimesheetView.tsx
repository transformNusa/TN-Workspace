import { CalendarDays, CheckCheck, ChevronLeft, ChevronRight, Clipboard, ExternalLink, Pencil, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ProfileRow, TimeEntryWithTask } from '@shared/data'
import { btn, iconBtn, input, Modal } from '@renderer/components/ui'
import { openProfile } from '@renderer/lib/actions'
import { fmtDateTime, fmtDuration, fromLocalInput, toLocalInput } from '@renderer/lib/format'
import { useData } from '@renderer/store/data'
import { useSettings } from '@renderer/store/settings'
import { useUi } from '@renderer/store/ui'

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const DAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const DAY_LONG = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

function mondayOf(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}
const addDays = (d: Date, n: number): Date => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
const dateForDay = (weekStart: Date, day: number): Date => addDays(weekStart, (day + 6) % 7)
const cellSeconds = (entries: TimeEntryWithTask[], taskId: string, date: Date): number => {
  const day = date.toDateString()
  return entries.filter((e) => e.taskId === taskId && new Date(e.startedAt).toDateString() === day)
    .reduce((sum, e) => sum + (e.durationSeconds ?? 0), 0)
}

function EntryDialog({ entry, taskId, date, onClose, onSaved }: {
  entry?: TimeEntryWithTask
  taskId?: string
  date?: Date
  onClose: () => void
  onSaved: () => void
}) {
  const { tasks } = useData()
  const setNotice = useUi((s) => s.setNotice)
  const [pickTask, setPickTask] = useState(entry?.taskId ?? taskId ?? tasks.find((t) => t.status !== 'selesai')?.id ?? '')
  const defaultStart = date ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0) : new Date()
  const defaultEnd = new Date(defaultStart.getTime() + 3600_000)
  const [start, setStart] = useState(toLocalInput(entry?.startedAt ?? defaultStart.toISOString()))
  const [end, setEnd] = useState(toLocalInput(entry?.endedAt ?? defaultEnd.toISOString()))
  const [note, setNote] = useState(entry?.note ?? '')
  const [busy, setBusy] = useState(false)

  const save = async (): Promise<void> => {
    const startedAt = fromLocalInput(start)
    const endedAt = fromLocalInput(end)
    if (!startedAt || !endedAt || !pickTask) return
    setBusy(true)
    try {
      if (entry) await window.alip.time.updateEntry(entry.id, { startedAt, endedAt, note: note.trim() || null })
      else await window.alip.time.addEntry(pickTask, { startedAt, endedAt, note: note.trim() || null })
      onSaved()
      onClose()
    } catch (e) {
      setNotice({ kind: 'error', text: (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '') })
    } finally { setBusy(false) }
  }

  return (
    <Modal title={entry ? 'Edit entri waktu' : 'Tambah entri waktu'} onClose={onClose} width="max-w-lg">
      {!entry && (
        <label className="mb-3 block"><span className="mb-1 block text-xs text-zinc-500">Task</span>
          <select data-testid="entry-task" value={pickTask} onChange={(e) => setPickTask(e.target.value)} className={input}>
            <option value="">Pilih task…</option>
            {tasks.filter((t) => t.status !== 'selesai').map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select></label>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label><span className="mb-1 block text-xs text-zinc-500">Mulai</span>
          <input data-testid="entry-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={input} /></label>
        <label><span className="mb-1 block text-xs text-zinc-500">Selesai</span>
          <input data-testid="entry-end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className={input} /></label>
      </div>
      <label className="mt-3 block"><span className="mb-1 block text-xs text-zinc-500">Catatan (opsional)</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. revisi laporan" className={input} /></label>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className={btn.ghost}>Batal</button>
        <button data-testid="entry-save" disabled={busy || !pickTask || !start || !end} onClick={() => void save()} className={btn.primary}>Simpan</button>
      </div>
    </Modal>
  )
}

export default function TimesheetView() {
  const { work } = useSettings((s) => s.settings)
  const { tasks, refresh: refreshData } = useData()
  const setNotice = useUi((s) => s.setNotice)
  const setView = useUi((s) => s.setView)
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()))
  const [entries, setEntries] = useState<TimeEntryWithTask[]>([])
  const [unsynced, setUnsynced] = useState(0)
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [editing, setEditing] = useState<{ entry?: TimeEntryWithTask; taskId?: string; date?: Date } | null>(null)

  const weekEnd = addDays(weekStart, 7)
  const days = useMemo(() => DAY_ORDER.filter((d) => work.workDays.includes(d)), [work.workDays])

  const load = useCallback(async (): Promise<void> => {
    const [list, n] = await Promise.all([
      window.alip.time.entries(weekStart.toISOString(), weekEnd.toISOString()),
      window.alip.timesheet.unsynced(weekStart.toISOString(), weekEnd.toISOString())
    ])
    setEntries(list)
    setUnsynced(n)
  }, [weekStart, weekEnd])

  useEffect(() => { void load() }, [load])
  useEffect(() => { void window.alip.profiles.list().then(setProfiles) }, [])

  const rows = useMemo(() => {
    const map = new Map<string, { taskId: string; title: string; workspaceName: string | null; color: string | null }>()
    for (const e of entries) {
      if (!map.has(e.taskId)) map.set(e.taskId, { taskId: e.taskId, title: e.taskTitle, workspaceName: e.workspaceName, color: e.workspaceColor })
    }
    return [...map.values()]
  }, [entries])

  const dayTotals = useMemo(() => days.map((d) => {
    const date = dateForDay(weekStart, d).toDateString()
    return entries.filter((e) => new Date(e.startedAt).toDateString() === date).reduce((s, e) => s + (e.durationSeconds ?? 0), 0)
  }), [days, entries, weekStart])
  const weekTotal = dayTotals.reduce((a, b) => a + b, 0)
  const target = work.weeklyTargetHours * 3600
  const pct = target ? Math.min(100, Math.round((weekTotal / target) * 100)) : 0
  const emptyDays = days.filter((d, i) => dayTotals[i] === 0 && dateForDay(weekStart, d) <= new Date())
  const sunfish = profiles.find((p) => p.service === 'sunfish' && p.homeUrl && !p.nativeOnly)

  const rangeLabel = `${weekStart.getDate()} ${weekStart.toLocaleString('id-ID', { month: 'short' })} – ${addDays(weekStart, 6).getDate()} ${addDays(weekStart, 6).toLocaleString('id-ID', { month: 'short' })} ${weekStart.getFullYear()}`

  const draft = useMemo(() => {
    const lines: string[] = [`Timesheet ${rangeLabel}`]
    for (const d of days) {
      const date = dateForDay(weekStart, d)
      const dayEntries = entries.filter((e) => new Date(e.startedAt).toDateString() === date.toDateString())
      if (!dayEntries.length) continue
      lines.push('', `${DAY_LONG[d]}, ${date.getDate()}/${date.getMonth() + 1}`)
      for (const e of dayEntries) lines.push(`- ${e.taskTitle}: ${fmtDuration(e.durationSeconds ?? 0)}${e.note ? ` (${e.note})` : ''}`)
    }
    lines.push('', `Total minggu ini: ${fmtDuration(weekTotal)} dari target ${work.weeklyTargetHours} jam`)
    return lines.join('\n')
  }, [days, entries, weekStart, weekTotal, work.weeklyTargetHours, rangeLabel])

  const copyDraft = async (): Promise<void> => {
    await window.alip.clipboard.writeText(draft)
    setNotice({ kind: 'ok', text: 'Draft timesheet disalin. Tempel di Sunfish.' })
  }
  const markSynced = async (synced: boolean): Promise<void> => {
    const n = await window.alip.timesheet.markSynced(weekStart.toISOString(), weekEnd.toISOString(), synced)
    await load()
    await refreshData()
    setNotice({ kind: 'ok', text: synced ? `${n} entri ditandai sudah disalin ke Sunfish.` : `${n} entri dibuka kembali sebagai belum disalin.` })
  }
  const openSunfish = async (): Promise<void> => {
    if (!sunfish) { setNotice({ kind: 'error', text: 'Profil Sunfish belum diatur. Atur di Pengaturan → Layanan Web.' }); return }
    await openProfile(sunfish.id)
  }

  return (
    <section className="min-w-0 flex-1 overflow-y-auto rounded-2xl px-6 py-5" data-testid="timesheet">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="ds-label">Timesheet</p>
            <h1 className="mt-1 font-display text-[22px] font-semibold tracking-tight text-zinc-50">{rangeLabel}</h1>
            <p className="mt-1 text-[12.5px] text-zinc-500">{fmtDuration(weekTotal)} dari target {work.weeklyTargetHours} jam · {unsynced > 0 ? `${unsynced} entri belum disalin` : 'semua entri minggu ini sudah ditandai'}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button data-testid="week-prev" onClick={() => setWeekStart(addDays(weekStart, -7))} className={`${iconBtn} h-8 w-8 rounded-full border border-white/10 bg-white/[0.05]`} title="Minggu sebelumnya"><ChevronLeft size={15} /></button>
            <button onClick={() => setWeekStart(mondayOf(new Date()))} className={btn.ghost}><CalendarDays size={13} /> Minggu ini</button>
            <button data-testid="week-next" onClick={() => setWeekStart(addDays(weekStart, 7))} className={`${iconBtn} h-8 w-8 rounded-full border border-white/10 bg-white/[0.05]`} title="Minggu berikutnya"><ChevronRight size={15} /></button>
            <button data-testid="entry-add" onClick={() => setEditing({})} className={btn.primary}><Plus size={14} /> Entri</button>
          </div>
        </div>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <div className="h-full rounded-full bg-accent-600 transition-[width] duration-700 ease-glass" style={{ width: `${Math.max(pct, 1)}%` }} />
        </div>

        {emptyDays.length > 0 && (
          <div data-testid="empty-days" className="mt-4 rounded-2xl border border-amber-400/25 bg-amber-400/[0.07] px-4 py-2.5 text-[12.5px] text-amber-200">
            Hari kerja tanpa jam tercatat: {emptyDays.map((d) => DAY_SHORT[d]).join(', ')}.
          </div>
        )}

        <div className="glass mt-4 overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[720px] border-collapse text-[12px]">
            <thead>
              <tr className="text-zinc-500">
                <th className="sticky left-0 z-10 min-w-[220px] bg-[#201d1b] px-3 py-2 text-left font-medium">Task</th>
                {days.map((d) => <th key={d} className="px-2 py-2 text-right font-medium">{DAY_SHORT[d]}<div className="font-mono text-[9.5px] text-zinc-600">{dateForDay(weekStart, d).getDate()}/{dateForDay(weekStart, d).getMonth() + 1}</div></th>)}
                <th className="px-3 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.taskId} className="border-t border-white/[0.06]">
                  <td className="sticky left-0 z-10 bg-[#201d1b] px-3 py-2 text-zinc-200">
                    <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full" style={{ background: r.color ?? '#52525b' }} /><span className="truncate">{r.title}</span></div>
                    <div className="pl-3.5 text-[10.5px] text-zinc-600">{r.workspaceName ?? 'Tanpa workspace'}</div>
                  </td>
                  {days.map((d) => {
                    const sec = cellSeconds(entries, r.taskId, dateForDay(weekStart, d))
                    return <td key={d} className={`px-2 py-2 text-right font-mono ${sec ? 'text-zinc-300' : 'text-zinc-700'}`}>{sec ? fmtDuration(sec) : '·'}</td>
                  })}
                  <td className="px-3 py-2 text-right font-mono text-emerald-200">{fmtDuration(days.reduce((s, d) => s + cellSeconds(entries, r.taskId, dateForDay(weekStart, d)), 0))}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={days.length + 2} className="px-4 py-8 text-center text-sm text-zinc-500">Belum ada jam tercatat minggu ini.</td></tr>}
            </tbody>
            <tfoot>
              <tr className="border-t border-white/10 text-zinc-300">
                <td className="sticky left-0 z-10 bg-[#201d1b] px-3 py-2 font-medium">Total harian</td>
                {dayTotals.map((s, i) => <td key={days[i]} className="px-2 py-2 text-right font-mono">{s ? fmtDuration(s) : '·'}</td>)}
                <td className="px-3 py-2 text-right font-mono text-emerald-200">{fmtDuration(weekTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_360px]">
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[15px] font-semibold text-zinc-50">Entri minggu ini</h2>
              <span className="font-mono text-[10px] text-zinc-500">{entries.length} entri</span>
            </div>
            <div className="mt-2 divide-y divide-white/[0.06]">
              {entries.map((e) => (
                <div key={e.id} data-testid="time-entry" className="flex items-center gap-2 py-2 text-[12.5px]">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-zinc-200">{e.taskTitle}</div>
                    <div className="text-[10.5px] text-zinc-500">{fmtDateTime(e.startedAt)} · {e.source === 'auto' ? 'otomatis' : 'manual'}{e.note ? ` · ${e.note}` : ''}{e.durationSeconds !== null && e.durationSeconds >= 0 ? '' : ''}</div>
                  </div>
                  <span className="font-mono text-[11px] text-zinc-400">{fmtDuration(e.durationSeconds ?? 0)}</span>
                  <button title="Edit entri" onClick={() => setEditing({ entry: e })} className={iconBtn}><Pencil size={13} /></button>
                </div>
              ))}
              {entries.length === 0 && <p className="py-6 text-center text-sm text-zinc-500">Tambahkan entri manual atau jalankan timer.</p>}
            </div>
          </div>

          <div className="glass rounded-2xl p-4">
            <h2 className="font-display text-[15px] font-semibold text-zinc-50">Draft untuk Sunfish</h2>
            <pre data-testid="sunfish-draft" className="mt-2 max-h-[260px] overflow-auto whitespace-pre-wrap rounded-xl border border-white/[0.07] bg-black/20 p-3 font-mono text-[11px] leading-relaxed text-zinc-300">{draft}</pre>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button data-testid="draft-copy" onClick={() => void copyDraft()} className={btn.primary}><Clipboard size={13} /> Salin draft</button>
              <button onClick={() => void openSunfish()} className={btn.ghost}><ExternalLink size={13} /> Buka Sunfish</button>
              <button data-testid="mark-synced" onClick={() => void markSynced(true)} className={`${btn.ghost} text-emerald-200`}><CheckCheck size={13} /> Tandai tersalin</button>
              {unsynced === 0 && entries.length > 0 && <button onClick={() => void markSynced(false)} className={btn.ghost}>Batalkan tanda</button>}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">Tandai tersalin setelah draft ditempel di Sunfish. Pengingat Jumat memakai tanda ini.</p>
          </div>
        </div>

        <button onClick={() => setView('today')} className={`${btn.ghost} mt-5`}>Kembali ke Hari Ini</button>
      </div>

      {editing && <EntryDialog entry={editing.entry} taskId={editing.taskId} date={editing.date} onClose={() => setEditing(null)} onSaved={() => void load()} />}
    </section>
  )
}
