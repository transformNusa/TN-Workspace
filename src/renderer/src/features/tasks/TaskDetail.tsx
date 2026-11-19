import { AppWindow, Bell, BellOff, CheckCircle2, FileText, Folder, Globe, Hourglass, Mail, MessageCircle, Pause, Play, Plus, RotateCcw, Rocket, Ticket, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CUSTOM_APP_PREFIX, LAUNCHER_LABEL, PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL, describeRecurrence, parseRecurrence, type ActivityRow, type LauncherApp, type ResourceRow, type Priority, type Status, type TaskDetail } from '@shared/data'
import { btn, iconBtn, input } from '@renderer/components/ui'
import { fmtDateTime, fmtDuration, fmtTime, fromLocalInput, toLocalInput } from '@renderer/lib/format'
import { openAllResources, openResource, openResourceWith, toggleTimer } from '@renderer/lib/actions'
import { useNow } from '@renderer/lib/useNow'
import { useData } from '@renderer/store/data'
import { useReminders } from '@renderer/store/reminders'
import { useSettings } from '@renderer/store/settings'
import { useUi } from '@renderer/store/ui'

type Tab = 'ringkasan' | 'catatan' | 'aktivitas'

function activityText(a: ActivityRow): string {
  const p = a.payload ?? {}
  switch (a.type) {
    case 'dibuat': return 'Task dibuat'
    case 'status_changed': return `Status: ${STATUS_LABEL[p.from as Status] ?? p.from} → ${STATUS_LABEL[p.to as Status] ?? p.to}`
    case 'timer_started': return 'Timer dimulai'
    case 'timer_stopped': return `Timer dijeda · ${fmtDuration(Number(p.seconds ?? 0))}`
    case 'resource_dibuka': return `Buka semua resource (${String(p.count ?? 0)})`
    case 'subtask_done': return `Subtask selesai: ${String(p.title ?? '')}`
    case 'timer_idle': return `Timer dijeda otomatis setelah idle · ${fmtDuration(Number(p.seconds ?? 0))}`
    case 'time_entry_updated': return 'Entri waktu diedit'
    case 'time_entry_added': return 'Entri waktu ditambahkan'
    case 'recurrence_created': return `Task berulang berikutnya dibuat${p.dueAt ? ` (tenggat ${fmtDateTime(String(p.dueAt))})` : ''}`
    case 'inbox_dijadikan_task': return 'Dibuat dari item inbox'
    case 'inbox_ditautkan': return 'Item inbox ditautkan ke task ini'
    case 'dari_template': return 'Dibuat dari template'
    default: return a.type
  }
}

/** Input satu baris yang menyimpan saat fokus hilang atau Enter. */
function InlineText({ value, onSave, className = '', placeholder }: { value: string; onSave: (v: string) => void; className?: string; placeholder?: string }) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  const commit = (): void => { if (v.trim() !== value) onSave(v) }
  return (
    <input
      value={v} placeholder={placeholder} className={className}
      onChange={(e) => setV(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setV(value); (e.target as HTMLInputElement).blur() } }}
    />
  )
}

function ResumeNote({ task }: { task: TaskDetail }) {
  const update = useData((s) => s.updateTask)
  return (
    <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.07] px-4 py-3">
      <div className="ds-label text-amber-300/80">Terakhir sampai mana</div>
      <InlineText
        value={task.resumeNote ?? ''} placeholder="Tulis satu baris supaya mudah lanjut nanti…"
        className="mt-1 w-full bg-transparent text-[13.5px] text-zinc-100 outline-none placeholder:text-zinc-600"
        onSave={(v) => void update(task.id, { resumeNote: v })}
      />
    </div>
  )
}

function ResourceIcon({ r }: { r: ResourceRow }) {
  const cls = 'shrink-0 text-zinc-400'
  if (r.type === 'folder') return <Folder size={16} className={cls} />
  if (r.type === 'file') return <FileText size={16} className={cls} />
  if (r.type === 'whatsapp' || r.type === 'telegram') return <MessageCircle size={16} className={cls} />
  if (r.type === 'email') return <Mail size={16} className={cls} />
  if (r.type === 'ticket') return <Ticket size={16} className={cls} />
  if (r.type === 'url') return <Globe size={16} className={cls} />
  if (r.launcherApp === 'godot' || r.launcherApp === 'kiro') return <Rocket size={16} className={cls} />
  return <AppWindow size={16} className={cls} />
}

function Resources({ task }: { task: TaskDetail }) {
  const setDialog = useUi((s) => s.setDialog)
  const paths = useSettings((s) => s.settings.paths)
  const customApps = useSettings((s) => s.settings.launchers.apps)
  const refresh = useData((s) => s.refresh)
  const chipsFor = (r: ResourceRow): LauncherApp[] => {
    const cands: LauncherApp[] = r.type === 'folder' ? ['vscode', 'kiro', 'godot'] : r.type === 'file' ? ['excel', 'gridcraft'] : []
    return cands.filter((a) => paths[a].trim() !== '')
  }
  const appName = (ref: string | null): string => {
    if (!ref) return ''
    if (ref.startsWith(CUSTOM_APP_PREFIX)) return customApps.find((a) => a.id === ref.slice(CUSTOM_APP_PREFIX.length))?.name ?? 'aplikasi dihapus'
    return LAUNCHER_LABEL[ref as LauncherApp] ?? ref
  }
  const subtitle = (r: ResourceRow): string => {
    if (r.type === 'launcher') return `${appName(r.launcherApp)} · ${r.target}`
    if (r.profileId !== null || ['whatsapp', 'telegram', 'email', 'ticket'].includes(r.type)) return `${r.profileName ?? 'layanan dihapus'}${r.target ? ` · ${r.target}` : ''}`
    return r.target ?? ''
  }
  const remove = async (id: string): Promise<void> => { await window.alip.resources.remove(id); await refresh() }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="ds-label">Resource terkait</h3>
        <div className="flex gap-2">
          {task.resources.length > 0 && <button data-testid="open-all" onClick={() => void openAllResources(task.id)} className={btn.primary}><Rocket size={13} /> Buka semua</button>}
          <button data-testid="btn-add-resource" onClick={() => setDialog({ type: 'resource', taskId: task.id })} className={btn.ghost}><Plus size={13} /> Tambah</button>
        </div>
      </div>
      {task.resources.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-4 py-4 text-sm text-zinc-500">
          Belum ada resource. Tambahkan folder proyek, file, aplikasi, atau link supaya task ini bisa dibuka dengan satu klik.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {task.resources.map((r) => (
            <div key={r.id} data-testid="resource-card" onClick={() => void openResource(r.id)} className="group cursor-pointer rounded-2xl border border-white/[0.07] bg-white/[0.035] px-3.5 py-2.5 transition duration-300 hover:-translate-y-px hover:border-accent-400/30 hover:bg-accent-500/[0.07] hover:shadow-[0_16px_34px_-28px_rgba(176,82,42,0.45)]">
              <div className="flex items-center gap-2.5">
                <ResourceIcon r={r} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-zinc-100">{r.title}</div>
                  <div className="truncate text-[11.5px] text-zinc-500">{subtitle(r)}</div>
                </div>
                <button title="Hapus resource" onClick={(e) => { e.stopPropagation(); void remove(r.id) }} className="text-zinc-600 opacity-0 transition hover:text-red-300 group-hover:opacity-100"><X size={14} /></button>
              </div>
              {chipsFor(r).length > 0 && (
                <div className="mt-2 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {chipsFor(r).map((a) => (
                    <button key={a} onClick={() => void openResourceWith(r.id, a)} className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-zinc-400 transition hover:bg-white/[0.09] hover:text-zinc-200">Buka di {LAUNCHER_LABEL[a]}</button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Subtasks({ task }: { task: TaskDetail }) {
  const { addSubtask, setSubtaskDone, renameSubtask, removeSubtask } = useData()
  const [text, setText] = useState('')
  const pct = task.subtasks.length ? Math.round((task.subtasks.filter((s) => s.done).length / task.subtasks.length) * 100) : 0
  const submit = (): void => { if (text.trim()) { void addSubtask(task.id, text); setText('') } }
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="ds-label">Subtask</h3>
        {task.subtasks.length > 0 && <span className="font-mono text-[10px] text-zinc-500">{task.subtasks.filter((s) => s.done).length} / {task.subtasks.length}</span>}
      </div>
      {task.subtasks.length > 0 && <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-black/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"><div className="h-full rounded-full bg-accent-600 transition-[width]" style={{ width: `${pct}%` }} /></div>}
      <div className="space-y-0.5">
        {task.subtasks.map((s) => (
          <div key={s.id} className="group flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-white/[0.04]">
            <input type="checkbox" checked={s.done} onChange={(e) => void setSubtaskDone(s.id, e.target.checked)} className="h-4 w-4 accent-emerald-400" />
            <InlineText
              value={s.title} onSave={(v) => void renameSubtask(s.id, v)}
              className={`flex-1 bg-transparent text-[13px] outline-none ${s.done ? 'text-zinc-600 line-through' : 'text-zinc-200'}`}
            />
            <button onClick={() => void removeSubtask(s.id)} className="text-zinc-600 opacity-0 transition hover:text-red-300 group-hover:opacity-100"><X size={14} /></button>
          </div>
        ))}
      </div>
      <input
        value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="+ Tambah subtask lalu tekan Enter" className={`${input} mt-2`}
      />
    </div>
  )
}

function NotesTab({ task }: { task: TaskDetail }) {
  const save = useData((s) => s.saveNote)
  const [text, setText] = useState(task.note)
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const latest = useRef(text)
  const dirty = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = async (): Promise<void> => {
    if (!dirty.current) return
    dirty.current = false
    await save(task.id, latest.current)
    setState('saved')
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); if (dirty.current) void save(task.id, latest.current) }, [])  // simpan saat tab ditutup
  return (
    <div>
      <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-500">
        <span>Markdown · tersimpan otomatis</span>
        <span>{state === 'saving' ? 'menyimpan…' : state === 'saved' ? 'tersimpan' : ''}</span>
      </div>
      <textarea
        data-testid="note-editor" value={text} spellCheck={false}
        onChange={(e) => {
          setText(e.target.value); latest.current = e.target.value; dirty.current = true; setState('saving')
          if (timer.current) clearTimeout(timer.current)
          timer.current = setTimeout(() => void flush(), 700)
        }}
        onBlur={() => void flush()}
        placeholder="Catatan untuk task ini…"
        className="h-[420px] w-full resize-none rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 font-mono text-[12.5px] leading-relaxed text-zinc-200 outline-none transition placeholder:text-zinc-600 focus:border-accent-400/50 focus:bg-white/[0.05]"
      />
    </div>
  )
}

function ActivityTab({ task }: { task: TaskDetail }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="ds-label mb-2">Sesi waktu</h3>
        {task.entries.length === 0 ? <p className="text-sm text-zinc-500">Belum ada waktu tercatat.</p> : (
          <div className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] bg-white/[0.02]">
            {task.entries.map((e) => (
              <div key={e.id} className="flex items-center justify-between px-3.5 py-2 text-[13px]">
                <span className="text-zinc-300">{fmtDateTime(e.startedAt)}{e.endedAt ? ` – ${fmtTime(e.endedAt)}` : ' – berjalan'}</span>
                <span className="font-mono text-[11px] text-zinc-500">{e.durationSeconds !== null ? fmtDuration(e.durationSeconds) : '…'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <h3 className="ds-label mb-2">Riwayat</h3>
        <div className="space-y-2.5 border-l border-white/10 pl-4">
          {task.activity.map((a) => (
            <div key={a.id} className="relative text-[13px]">
              <span className="absolute -left-[21px] top-1.5 h-1.5 w-1.5 rounded-full bg-accent-400 shadow-[0_0_10px_rgba(91,124,250,0.9)]" />
              <div className="text-zinc-300">{activityText(a)}</div>
              <div className="font-mono text-[10px] text-zinc-600">{fmtDateTime(a.at)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DetailBody({ task }: { task: TaskDetail }) {
  const { workspaces, running: runningTimers, updateTask, setStatus, removeTask, refresh } = useData()
  const muteReminder = useReminders((s) => s.mute)
  const setNotice = useUi((s) => s.setNotice)
  const setDialog = useUi((s) => s.setDialog)
  const [tab, setTab] = useState<Tab>('ringkasan')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const activeEntry = runningTimers.find((r) => r.taskId === task.id)
  const running = !!activeEntry
  const now = useNow(running)
  const live = activeEntry ? Math.max(0, Math.floor((now - Date.parse(activeEntry.startedAt)) / 1000)) : 0
  const closed = task.status === 'selesai'
  const toggleMute = async (): Promise<void> => {
    const muted = !task.remindMuted
    await muteReminder(task.id, muted)
    await refresh()
    setNotice({ kind: 'ok', text: muted ? 'Pengingat task ini dibisukan.' : 'Pengingat task ini dinyalakan lagi.' })
  }

  return (
    <div className="mx-auto max-w-3xl px-7 py-6">
      <div className="ds-label">{task.workspaceName ?? 'Tanpa workspace'} / Task</div>
      <InlineText value={task.title} onSave={(v) => void updateTask(task.id, { title: v })} className="mt-1 w-full bg-transparent font-display text-[26px] font-semibold tracking-tight text-zinc-50 outline-none placeholder:text-zinc-600" />

      <div className="mt-4 flex items-center gap-1">
        {(['ringkasan', 'catatan', 'aktivitas'] as Tab[]).map((t) => (
          <button key={t} data-testid={`tab-${t}`} onClick={() => setTab(t)} className={`rounded-full px-3 py-1.5 text-[12.5px] capitalize transition ${
            tab === t ? 'bg-accent-500/[0.15] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]' : 'text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-300'
          }`}>{t}</button>
        ))}
        <div className="ml-auto pr-1 font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-500">Waktu <span className="text-zinc-300">{fmtDuration(task.trackedSeconds + live)}</span></div>
      </div>
      <div className="mt-2 h-px bg-white/[0.07]" />

      <div className="mt-4">
        {tab === 'ringkasan' && (
          <div className="space-y-6">
            <Resources task={task} />
            <Subtasks task={task} />
            <ResumeNote task={task} />

            <div className="flex flex-wrap items-center gap-2">
              <button data-testid="detail-timer" disabled={closed} onClick={() => toggleTimer(task.id)} className={running ? `${btn.ghost} text-emerald-200` : btn.primary}>
                {running ? <><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /><Pause size={13} /> Jeda timer</> : <><Play size={13} /> Mulai timer</>}
              </button>
              {task.status === 'menunggu' ? (
                <button onClick={() => void setStatus(task.id, 'proses')} className={btn.ghost}><Play size={13} /> Lanjutkan</button>
              ) : !closed && (
                <button onClick={() => void setStatus(task.id, 'menunggu')} className={btn.ghost}><Hourglass size={13} /> Tandai menunggu balasan</button>
              )}
              {closed ? (
                <button onClick={() => void setStatus(task.id, 'proses')} className={btn.ghost}><RotateCcw size={13} /> Buka kembali</button>
              ) : (
                <button onClick={() => void setStatus(task.id, 'selesai')} className={`${btn.ghost} text-emerald-200`}><CheckCircle2 size={13} /> Selesai</button>
              )}
              <button
                data-testid="btn-mute-reminder" onClick={() => void toggleMute()}
                title={task.remindMuted ? 'Nyalakan lagi pengingat task ini' : 'Bisukan pengingat task ini'}
                className={`${btn.ghost} ${task.remindMuted ? 'text-zinc-500' : 'text-zinc-300'}`}
              >
                {task.remindMuted ? <><BellOff size={13} /> Pengingat mati</> : <><Bell size={13} /> Bisukan pengingat</>}
              </button>
              <button data-testid="btn-save-template" onClick={() => setDialog({ type: 'saveTemplate', taskId: task.id })} className={btn.ghost}>Simpan sebagai template</button>
              <div className="ml-auto">
                {confirmDelete ? (
                  <span className="flex items-center gap-2 text-[13px]">
                    <span className="text-zinc-400">Hapus task ini?</span>
                    <button onClick={() => void removeTask(task.id)} className={btn.danger}>Ya, hapus</button>
                    <button onClick={() => setConfirmDelete(false)} className={btn.ghost}>Batal</button>
                  </span>
                ) : (
                  <button title="Hapus task" onClick={() => setConfirmDelete(true)} className={`${iconBtn} rounded-full`}><Trash2 size={15} /></button>
                )}
              </div>
            </div>

            <div>
              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-5">
                {([
                  ['Status', <select key="s" value={task.status} onChange={(e) => void setStatus(task.id, e.target.value as Status)} className={input}>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>],
                  ['Prioritas', <select key="p" value={task.priority} onChange={(e) => void updateTask(task.id, { priority: e.target.value as Priority })} className={input}>{PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}</select>],
                  ['Tenggat', <input key="d" type="datetime-local" value={toLocalInput(task.dueAt)} onChange={(e) => void updateTask(task.id, { dueAt: fromLocalInput(e.target.value) })} className={input} />],
                  ['Workspace', <select key="w" value={task.workspaceId ?? ''} onChange={(e) => void updateTask(task.id, { workspaceId: e.target.value || null })} className={input}><option value="">Tanpa workspace</option>{workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>],
                  ['Berulang', <select key="r" data-testid="recurrence-select" value={parseRecurrence(task.recurrenceRule)?.freq ?? 'none'} onChange={(e) => {
                    const mode = e.target.value
                    if (mode === 'none') void updateTask(task.id, { recurrenceRule: null })
                    else if (mode === 'weekly') {
                      const day = task.dueAt ? new Date(task.dueAt).getDay() : new Date().getDay()
                      void updateTask(task.id, { recurrenceRule: JSON.stringify({ freq: 'weekly', interval: 1, weekdays: [day] }) })
                    } else void updateTask(task.id, { recurrenceRule: JSON.stringify({ freq: 'monthly', interval: 1, weekdays: [] }) })
                  }} className={input}><option value="none">Tidak berulang</option><option value="weekly">Mingguan</option><option value="monthly">Bulanan</option></select>]
                ] as [string, React.ReactNode][]).map(([label, el]) => (
                  <label key={label} className="block"><span className="ds-label mb-1 block">{label}</span>{el}</label>
                ))}
              </div>
              {parseRecurrence(task.recurrenceRule) && (
                <p className="mt-1.5 text-[11px] text-zinc-500">Task berikutnya dibuat otomatis saat task ini ditandai selesai.</p>
              )}
            </div>
          </div>
        )}
        {tab === 'catatan' && <NotesTab task={task} />}
        {tab === 'aktivitas' && <ActivityTab task={task} />}
      </div>
    </div>
  )
}

export default function TaskDetailPane() {
  const detail = useData((s) => s.detail)
  if (!detail) return null
  return <DetailBody key={detail.id} task={detail} />
}
