import { useEffect, useRef, useState } from 'react'
import {
  INBOX_SOURCES, INBOX_SOURCE_LABEL, LAUNCHER_APPS, LAUNCHER_LABEL, PRIORITIES, PRIORITY_LABEL, SERVICE_LABEL,
  customAppRef, inboxTitle, parseFirstUrl, parseTicketRef, resourceTypeForService, type InboxSource, type Priority
} from '@shared/data'
import { fromLocalInput } from '@renderer/lib/format'
import { openTask } from '@renderer/lib/actions'
import { useData } from '@renderer/store/data'
import { useInbox } from '@renderer/store/inbox'
import { useSettings } from '@renderer/store/settings'
import { useWeb } from '@renderer/store/web'
import { useUi } from '@renderer/store/ui'
import EndOfDayDialog from '@renderer/features/tasks/EndOfDayDialog'
import TemplatesDialog, { SaveTemplateDialog } from '@renderer/features/templates/TemplatesDialog'
import SnippetsDialog, { FillSnippetDialog } from '@renderer/features/snippets/SnippetsDialog'
import { btn, input, Modal, WS_COLORS } from './ui'

function NewTaskDialog({ workspaceId }: { workspaceId?: string | null }) {
  const { workspaces, createTask } = useData()
  const setDialog = useUi((s) => s.setDialog)
  const [title, setTitle] = useState('')
  const [ws, setWs] = useState<string>(workspaceId ?? '')
  const [priority, setPriority] = useState<Priority>('normal')
  const [due, setDue] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => ref.current?.focus(), [])

  const submit = async (): Promise<void> => {
    if (!title.trim()) return
    const id = await createTask({ title, workspaceId: ws || null, priority, dueAt: fromLocalInput(due) })
    if (id) { setDialog(null); void openTask(id) }
  }
  return (
    <Modal title="Task baru" onClose={() => setDialog(null)}>
      <div className="space-y-3">
        <input ref={ref} value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void submit()} placeholder="Apa yang perlu dikerjakan?" className={input} />
        <div className="grid grid-cols-2 gap-3">
          <label><span className="mb-1 block text-xs text-zinc-500">Workspace</span>
            <select value={ws} onChange={(e) => setWs(e.target.value)} className={input}>
              <option value="">Tanpa workspace</option>{workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select></label>
          <label><span className="mb-1 block text-xs text-zinc-500">Prioritas</span>
            <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className={input}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
            </select></label>
        </div>
        <label className="block"><span className="mb-1 block text-xs text-zinc-500">Tenggat (opsional)</span>
          <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className={input} /></label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={() => setDialog(null)} className={btn.ghost}>Batal</button>
        <button onClick={() => void submit()} disabled={!title.trim()} className={btn.primary}>Buat task</button>
      </div>
    </Modal>
  )
}

function WorkspaceDialog({ id }: { id?: string }) {
  const { workspaces, createWorkspace, updateWorkspace, archiveWorkspace } = useData()
  const { setDialog, workspaceFilter, setView } = useUi()
  const existing = workspaces.find((w) => w.id === id)
  const [name, setName] = useState(existing?.name ?? '')
  const [color, setColor] = useState(existing?.color ?? WS_COLORS[0])
  const submit = async (): Promise<void> => {
    if (!name.trim()) return
    if (existing) await updateWorkspace(existing.id, { name, color })
    else await createWorkspace({ name, color })
    setDialog(null)
  }
  return (
    <Modal title={existing ? 'Ubah workspace' : 'Workspace baru'} onClose={() => setDialog(null)}>
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void submit()} placeholder="Nama workspace" className={input} />
      <div className="mt-3 flex gap-2">
        {WS_COLORS.map((c) => (
          <button key={c} onClick={() => setColor(c)} style={{ background: c }} className={`h-7 w-7 rounded-full transition ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#242120]' : 'opacity-80 hover:opacity-100'}`} />
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between">
        {existing ? (
          <button onClick={async () => { await archiveWorkspace(existing.id); if (workspaceFilter === existing.id) setView('tasks'); setDialog(null) }} className={btn.danger}>Arsipkan</button>
        ) : <span />}
        <div className="flex gap-2">
          <button onClick={() => setDialog(null)} className={btn.ghost}>Batal</button>
          <button onClick={() => void submit()} disabled={!name.trim()} className={btn.primary}>Simpan</button>
        </div>
      </div>
    </Modal>
  )
}

type Kind = 'folder' | 'file' | 'launcher' | 'web'
const KIND_LABEL: Record<Kind, string> = { folder: 'Folder', file: 'File', launcher: 'Aplikasi', web: 'Layanan web' }
const baseName = (p: string): string => p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? p

function ResourceDialog({ taskId }: { taskId: string }) {
  const setDialog = useUi((s) => s.setDialog)
  const setNotice = useUi((s) => s.setNotice)
  const refresh = useData((s) => s.refresh)
  const profiles = useWeb((s) => s.profiles).filter((p) => !p.nativeOnly)
  const customApps = useSettings((s) => s.settings.launchers.apps)
  const [kind, setKind] = useState<Kind>('folder')
  const [target, setTarget] = useState('')
  const [title, setTitle] = useState('')
  const [app, setApp] = useState<string>('vscode')
  const [profileId, setProfileId] = useState<string>(profiles[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const profile = profiles.find((p) => p.id === profileId)

  const appName = (ref: string): string => (ref in LAUNCHER_LABEL ? LAUNCHER_LABEL[ref as keyof typeof LAUNCHER_LABEL] : customApps.find((a) => customAppRef(a.id) === ref)?.name ?? ref)
  const browse = async (what: 'file' | 'folder'): Promise<void> => {
    const p = await window.alip.launcher.pick(what)
    if (p) setTarget(p)
  }
  const autoTitle = (): string => {
    if (title.trim()) return title.trim()
    if (kind === 'launcher') return target.trim() ? `${appName(app)}: ${baseName(target)}` : appName(app)
    if (kind === 'web') return profile?.name ?? 'Layanan web'
    return baseName(target)
  }
  const canSubmit = kind === 'web' ? !!profile : kind === 'launcher' ? !!app : !!target.trim()
  const submit = async (): Promise<void> => {
    if (!canSubmit || busy) return
    setBusy(true)
    try {
      const input = kind === 'web'
        ? { type: resourceTypeForService(profile!.service), title: autoTitle(), target: target.trim() || undefined, profileId: profile!.id }
        : { type: kind, title: autoTitle(), target: kind === 'launcher' ? target.trim() || undefined : target.trim(), launcherApp: kind === 'launcher' ? app : undefined }
      await window.alip.resources.add(taskId, input)
      await refresh()
      setDialog(null)
    } catch (e) {
      setNotice({ kind: 'error', text: (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '') })
    } finally { setBusy(false) }
  }
  return (
    <Modal title="Tambah resource" onClose={() => setDialog(null)} width="max-w-lg">
      <div className="mb-4 flex flex-wrap gap-1.5">
        {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
          <button key={k} data-testid={`kind-${k}`} onClick={() => { setKind(k); setTarget('') }} className={`rounded-full px-3 py-1.5 text-[13px] transition ${kind === k ? 'border border-accent-400/45 bg-accent-500/[0.18] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]' : 'border border-white/10 bg-white/[0.05] text-zinc-400 hover:bg-white/[0.09] hover:text-zinc-200'}`}>{KIND_LABEL[k]}</button>
        ))}
      </div>
      <div className="space-y-3">
        {kind === 'launcher' && (
          <label className="block"><span className="mb-1 block text-xs text-zinc-500">Buka dengan</span>
            <select data-testid="launcher-app" value={app} onChange={(e) => setApp(e.target.value)} className={input}>
              {LAUNCHER_APPS.map((a) => <option key={a} value={a}>{LAUNCHER_LABEL[a]}</option>)}
              {customApps.map((a) => <option key={a.id} value={customAppRef(a.id)}>{a.name} (Aplikasi Saya)</option>)}
            </select></label>
        )}
        {kind === 'web' && (
          <label className="block"><span className="mb-1 block text-xs text-zinc-500">Layanan</span>
            <select data-testid="web-profile" value={profileId} onChange={(e) => setProfileId(e.target.value)} className={input}>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.name} · {SERVICE_LABEL[p.service]}{p.homeUrl ? '' : ' (URL belum diatur)'}</option>)}
            </select></label>
        )}
        <label className="block">
          <span className="mb-1 block text-xs text-zinc-500">
            {kind === 'web' ? 'Alamat khusus (opsional, mis. tiket atau chat tertentu)' : kind === 'folder' ? 'Lokasi folder' : kind === 'file' ? 'Lokasi file' : 'Folder/file target (opsional — kosongkan untuk membuka aplikasinya saja)'}
          </span>
          <div className="flex gap-2">
            <input autoFocus value={target} onChange={(e) => setTarget(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void submit()}
              placeholder={kind === 'web' ? 'Kosong = halaman awal layanan' : 'D:\\Proyek\\game-kampung'} className={input} />
            {(kind === 'folder' || kind === 'launcher') && <button onClick={() => void browse('folder')} className={`${btn.ghost} shrink-0`}>Folder…</button>}
            {(kind === 'file' || kind === 'launcher') && <button onClick={() => void browse('file')} className={`${btn.ghost} shrink-0`}>File…</button>}
          </div>
        </label>
        <label className="block"><span className="mb-1 block text-xs text-zinc-500">Nama (opsional)</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void submit()} placeholder={canSubmit ? autoTitle() : 'Diisi otomatis'} className={input} /></label>
        {kind === 'launcher' && <p className="text-xs text-zinc-500">Path aplikasi diatur di Pengaturan → Aplikasi & Path. Aplikasi lain (mis. box.exe) didaftarkan di bagian Aplikasi Saya.</p>}
        {kind === 'file' && <p className="text-xs text-zinc-500">File program (.exe, .bat, dll.) tidak dibuka lewat resource File. Pakai jenis Aplikasi.</p>}
        {kind === 'web' && profiles.length === 0 && <p className="text-xs text-amber-300">Belum ada layanan web. Tambahkan di Pengaturan → Layanan Web.</p>}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={() => setDialog(null)} className={btn.ghost}>Batal</button>
        <button onClick={() => void submit()} disabled={!canSubmit || busy} className={btn.primary}>Tambah</button>
      </div>
    </Modal>
  )
}

function StopPrompt() {
  const { stopPrompt, setStopPrompt } = useUi()
  const { running, stopTimer } = useData()
  const [note, setNote] = useState('')
  const timer = stopPrompt ? running.find((r) => r.taskId === stopPrompt.taskId) : undefined
  const finish = async (save: boolean): Promise<void> => {
    const taskId = stopPrompt?.taskId
    setStopPrompt(null)
    if (taskId) await stopTimer(taskId, save ? note : undefined)
  }
  if (!stopPrompt || !timer) { // timer sudah berhenti di tempat lain
    queueMicrotask(() => setStopPrompt(null))
    return null
  }
  return (
    <Modal title="Terakhir sampai mana?" onClose={() => setStopPrompt(null)}>
      <p className="mb-3 text-sm text-zinc-500">Satu baris saja, supaya mudah lanjut saat task ini dibuka lagi.<br />Timer: <span className="text-zinc-300">{timer.taskTitle}</span></p>
      <input autoFocus data-testid="resume-input" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void finish(true)} placeholder="Contoh: tinggal kirim balasan ke klien" className={input} />
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={() => void finish(false)} className={btn.ghost}>Lewati</button>
        <button onClick={() => void finish(true)} className={btn.primary}>Simpan & jeda</button>
      </div>
    </Modal>
  )
}

function CaptureDialog({ initial }: { initial: string }) {
  const setDialog = useUi((s) => s.setDialog)
  const setNotice = useUi((s) => s.setNotice)
  const { add, makeTask } = useInbox()
  const [text, setText] = useState(initial)
  const [source, setSource] = useState<InboxSource>('manual')
  const [sender, setSender] = useState('')
  const [busy, setBusy] = useState(false)
  const ticket = parseTicketRef(text)
  const url = parseFirstUrl(text)

  const save = async (asTask: boolean): Promise<void> => {
    if (!text.trim() || busy) return
    setBusy(true)
    try {
      const row = await add({ source, sender: sender.trim() || null, preview: text })
      if (!row) return
      if (asTask) {
        const task = await makeTask(row.id, {})
        setDialog(null)
        if (task) { setNotice({ kind: 'ok', text: `Task "${task.title}" dibuat dari inbox.` }); await openTask(task.id) }
      } else {
        setDialog(null)
        setNotice({ kind: 'ok', text: 'Item masuk ke inbox.' })
      }
    } finally { setBusy(false) }
  }

  return (
    <Modal title="Tangkap cepat" onClose={() => setDialog(null)} width="max-w-lg">
      <p className="mb-3 text-sm text-zinc-500">Isi clipboard sudah dibaca. Sunting bila perlu, lalu simpan ke Inbox atau langsung jadi task.</p>
      <textarea
        autoFocus data-testid="capture-text" value={text} maxLength={4000}
        onChange={(e) => setText(e.target.value)} rows={6} spellCheck={false}
        placeholder="Clipboard kosong. Tempel atau ketik isi pesan, tautan tiket, atau ide…"
        className={`${input} resize-none font-mono text-[12.5px] leading-relaxed`}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void save(false) }}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {ticket && <span className="rounded-full border border-accent-400/30 bg-accent-400/[0.08] px-2 py-0.5 font-mono text-[11px] text-accent-200">Tiket #{ticket} terdeteksi</span>}
        {url && <span className="max-w-full truncate rounded-full border border-sky-400/30 bg-sky-400/[0.08] px-2 py-0.5 text-[11px] text-sky-200">Tautan: {url}</span>}
        {!text.trim() && <span className="text-[11px] text-zinc-600">Clipboard kosong.</span>}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label><span className="mb-1 block text-xs text-zinc-500">Sumber</span>
          <select data-testid="capture-source" value={source} onChange={(e) => setSource(e.target.value as InboxSource)} className={input}>
            {INBOX_SOURCES.map((s) => <option key={s} value={s}>{INBOX_SOURCE_LABEL[s]}</option>)}
          </select></label>
        <label><span className="mb-1 block text-xs text-zinc-500">Dari (opsional)</span>
          <input value={sender} onChange={(e) => setSender(e.target.value)} placeholder="Nama pengirim" className={input} /></label>
      </div>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button onClick={() => setDialog(null)} className={btn.ghost}>Batal</button>
        <button data-testid="capture-save" disabled={!text.trim() || busy} onClick={() => void save(false)} className={btn.ghost}>Simpan ke Inbox</button>
        <button data-testid="capture-task" disabled={!text.trim() || busy} onClick={() => void save(true)} className={btn.primary}>Simpan & jadikan task</button>
      </div>
    </Modal>
  )
}

function InboxTaskDialog({ itemId }: { itemId: string }) {
  const item = useInbox((s) => s.items.find((i) => i.id === itemId))
  const makeTask = useInbox((s) => s.makeTask)
  const { workspaces } = useData()
  const setDialog = useUi((s) => s.setDialog)
  const setNotice = useUi((s) => s.setNotice)
  const [title, setTitle] = useState(item ? inboxTitle(item.preview) : '')
  const [ws, setWs] = useState('')
  const [priority, setPriority] = useState<Priority>('normal')
  const [busy, setBusy] = useState(false)
  useEffect(() => { setTitle(item ? inboxTitle(item.preview) : '') }, [item?.id])

  if (!item) return null
  const submit = async (): Promise<void> => {
    if (!title.trim() || busy) return
    setBusy(true)
    try {
      const task = await makeTask(item.id, { title, workspaceId: ws || null, priority })
      setDialog(null)
      if (task) { setNotice({ kind: 'ok', text: `Task "${task.title}" dibuat.` }); await openTask(task.id) }
    } finally { setBusy(false) }
  }
  return (
    <Modal title="Jadikan task" onClose={() => setDialog(null)}>
      <div className="space-y-3">
        <label className="block"><span className="mb-1 block text-xs text-zinc-500">Judul task</span>
          <input autoFocus data-testid="inbox-task-title" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void submit()} className={input} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label><span className="mb-1 block text-xs text-zinc-500">Workspace</span>
            <select value={ws} onChange={(e) => setWs(e.target.value)} className={input}>
              <option value="">Tanpa workspace</option>{workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select></label>
          <label><span className="mb-1 block text-xs text-zinc-500">Prioritas</span>
            <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className={input}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
            </select></label>
        </div>
        <p className="text-xs leading-relaxed text-zinc-500">Isi lengkap item disalin ke deskripsi task, termasuk sumber{item.ticketRef ? ` dan nomor tiket #${item.ticketRef}` : ''}.</p>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={() => setDialog(null)} className={btn.ghost}>Batal</button>
        <button data-testid="inbox-task-submit" disabled={!title.trim() || busy} onClick={() => void submit()} className={btn.primary}>Buat task</button>
      </div>
    </Modal>
  )
}

function LinkInboxDialog({ itemId }: { itemId: string }) {
  const item = useInbox((s) => s.items.find((i) => i.id === itemId))
  const link = useInbox((s) => s.link)
  const { tasks } = useData()
  const setDialog = useUi((s) => s.setDialog)
  const setNotice = useUi((s) => s.setNotice)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  if (!item) return null
  const list = tasks
    .filter((t) => t.status !== 'selesai' && (!q.trim() || t.title.toLowerCase().includes(q.trim().toLowerCase())))
    .slice(0, 20)
  const pick = async (taskId: string): Promise<void> => {
    setBusy(true)
    try {
      if (await link(item.id, taskId)) setDialog(null)
      else setNotice({ kind: 'error', text: 'Gagal menautkan item. Coba lagi.' })
    } finally { setBusy(false) }
  }
  return (
    <Modal title="Tautkan ke task" onClose={() => setDialog(null)}>
      <input autoFocus data-testid="inbox-link-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari task…" className={input} />
      <div className="mt-2 max-h-[320px] overflow-y-auto">
        {list.map((t) => (
          <button key={t.id} disabled={busy} onClick={() => void pick(t.id)} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[13px] text-zinc-300 transition hover:bg-white/[0.06] hover:text-zinc-100">
            <span className="truncate">{t.title}</span>
            <span className="ml-3 shrink-0 font-mono text-[10px] text-zinc-500">{t.workspaceName ?? '—'}</span>
          </button>
        ))}
        {list.length === 0 && <p className="px-3 py-6 text-center text-sm text-zinc-500">Tidak ada task yang cocok.</p>}
      </div>
    </Modal>
  )
}

export default function Dialogs() {
  const { dialog, stopPrompt } = useUi()
  return (
    <>
      {dialog?.type === 'newTask' && <NewTaskDialog workspaceId={dialog.workspaceId} />}
      {dialog?.type === 'workspace' && <WorkspaceDialog id={dialog.id} />}
      {dialog?.type === 'resource' && <ResourceDialog taskId={dialog.taskId} />}
      {dialog?.type === 'capture' && <CaptureDialog initial={dialog.text} />}
      {dialog?.type === 'inboxTask' && <InboxTaskDialog itemId={dialog.itemId} />}
      {dialog?.type === 'linkInbox' && <LinkInboxDialog itemId={dialog.itemId} />}
      {dialog?.type === 'endOfDay' && <EndOfDayDialog />}
      {dialog?.type === 'templates' && <TemplatesDialog />}
      {dialog?.type === 'saveTemplate' && <SaveTemplateDialog taskId={dialog.taskId} />}
      {dialog?.type === 'snippets' && <SnippetsDialog />}
      {dialog?.type === 'snippet' && <FillSnippetDialog id={dialog.id} />}
      {stopPrompt && <StopPrompt />}
    </>
  )
}
