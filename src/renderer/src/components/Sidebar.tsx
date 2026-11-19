import { CalendarCheck, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock, ExternalLink, FolderOpen, Hourglass, Image as ImageIcon, Inbox, ListTodo, PenTool, Plus, Settings, Square, StickyNote, Table2, Wrench } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { defaultProfileGroup, type ProfileRow, type ViewInfo } from '@shared/data'
import { fmtClock } from '@renderer/lib/format'
import { groupToday } from '@renderer/lib/grouping'
import { openProfile, requestStop } from '@renderer/lib/actions'
import { loadJson, saveJson } from '@renderer/lib/persist'
import { useNow } from '@renderer/lib/useNow'
import { useData } from '@renderer/store/data'
import { useInbox } from '@renderer/store/inbox'
import { useSettings } from '@renderer/store/settings'
import { useTools } from '@renderer/store/tools'
import { useWeb } from '@renderer/store/web'
import { useUi, type ViewId } from '@renderer/store/ui'

const SIDEBAR_KEY = 'tn.sidebar.v1'
const MIN_W = 196
const MAX_W = 420
const COLLAPSED_W = 68

/** Preferensi sidebar: lebar, ciut, dan bagian yang dilipat (`closed[id] = true`). */
type SidebarPrefs = { width: number; collapsed: boolean; closed: Record<string, boolean> }
type LegacyPrefs = Partial<SidebarPrefs> & { workspaceOpen?: boolean }

function NavItem({ id, label, icon, count, collapsed }: { id: ViewId; label: string; icon: ReactNode; count?: number; collapsed: boolean }) {
  const { view, workspaceFilter, setView } = useUi()
  const select = useData((s) => s.select)
  const active = view === id && !(id === 'tasks' && workspaceFilter)
  return (
    <button
      data-testid={`nav-${id}`} title={collapsed ? label : undefined}
      onClick={() => { void select(null); setView(id) }}
      className={`group relative flex w-full items-center gap-2.5 rounded-full ${collapsed ? 'justify-center px-2' : 'px-3'} py-1.5 text-[13px] transition ${
        active
          ? 'bg-accent-500/[0.15] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_12px_28px_-22px_rgba(176,82,42,0.55)]'
          : 'text-zinc-400 hover:bg-accent-500/[0.07] hover:text-zinc-100'
      }`}
    >
      <span
        className={`pointer-events-none absolute left-0 top-1/2 w-[2px] -translate-y-1/2 rounded-full bg-accent-400 shadow-[0_0_10px_2px_rgba(176,82,42,0.45)] transition-all duration-300 ${
          active ? 'h-4 opacity-100' : 'h-2 opacity-0 group-hover:h-3 group-hover:opacity-70'
        }`}
      />
      <span className={`transition ${active ? 'text-accent-200' : 'text-zinc-500 group-hover:text-accent-300'}`}>{icon}</span>
      {!collapsed && <span className="flex-1 text-left">{label}</span>}
      {!collapsed && !!count && (
        <span className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] ${active ? 'bg-accent-500/25 text-accent-100' : 'bg-white/[0.08] text-zinc-300'}`}>{count}</span>
      )}
    </button>
  )
}

/** Judul bagian sidebar yang bisa dilipat. `sub` = sub-kelompok (mis. Core/Web) dengan gaya lebih kecil. */
function SectionHeader({ label, open, count, onToggle, onAdd, addTitle, sub = false, tight = false }: {
  label: string
  open: boolean
  count?: number
  onToggle: () => void
  onAdd?: () => void
  addTitle?: string
  sub?: boolean
  tight?: boolean
}) {
  return (
    <div data-testid={`section-${label.toLowerCase()}`} className={`flex items-center justify-between ${sub ? 'px-3.5 pb-1 pt-1.5' : `${tight ? 'mt-2' : 'mt-4'} px-3.5 pb-1`}`}>
      <button
        type="button" onClick={onToggle} title={`${open ? 'Sembunyikan' : 'Tampilkan'} ${label}`}
        aria-expanded={open}
        className="-ml-1 flex min-w-0 items-center gap-1 rounded-full px-1 py-0.5 text-zinc-500 transition hover:text-zinc-300"
      >
        <ChevronDown size={sub ? 10 : 12} className={`shrink-0 transition-transform ${open ? '' : '-rotate-90'}`} />
        {sub
          ? <span className="truncate font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-500">{label}</span>
          : <span className="ds-label truncate">{label}</span>}
        {!open && !sub && count !== undefined && <span className="font-mono text-[9px] text-zinc-600">{count}</span>}
      </button>
      {sub
        ? <span className="font-mono text-[9px] text-zinc-700">{count}</span>
        : onAdd && <button title={addTitle} onClick={onAdd} className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-zinc-500 transition hover:bg-white/[0.08] hover:text-zinc-200"><Plus size={12} /></button>}
    </div>
  )
}

function TimerWidget({ collapsed }: { collapsed: boolean }) {
  const running = useData((s) => s.running)
  const now = useNow(running.length > 0)
  if (running.length === 0) {
    return collapsed
      ? <div className="mx-auto mb-1 h-1.5 w-1.5 rounded-full bg-zinc-700" title="Tidak ada timer berjalan" />
      : <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] px-3 py-2 text-xs text-zinc-500">Tidak ada timer berjalan</div>
  }
  if (collapsed) {
    return (
      <div data-testid="timer-widget" title={`${running.length} timer berjalan`} className="mx-auto mb-1 grid h-8 w-8 place-items-center rounded-full border border-emerald-400/25 bg-emerald-400/10 font-mono text-[11px] text-emerald-200">
        {running.length}
      </div>
    )
  }
  return (
    <div data-testid="timer-widget" className="rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.07] px-3 py-2 shadow-[0_16px_34px_-26px_rgba(52,211,153,0.6)]">
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.7)]" />
        <span className="ds-label text-emerald-300/80">Timer berjalan</span>
        <span className="ml-auto font-mono text-[10px] text-emerald-300/70">{running.length}</span>
      </div>
      <div className="mt-1 max-h-36 space-y-0.5 overflow-y-auto pr-0.5">
        {running.map((t) => (
          <div key={t.entryId} className="flex items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-zinc-200" title={t.taskTitle}>{t.taskTitle}</span>
            <span className="nums font-mono text-[11.5px] text-emerald-200">{fmtClock((now - Date.parse(t.startedAt)) / 1000)}</span>
            <button
              data-testid="timer-stop" title={`Jeda: ${t.taskTitle}`} onClick={() => requestStop(t.taskId)}
              className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-400/15 text-emerald-200 transition hover:bg-emerald-400/25"
            >
              <Square size={9} />
            </button>
          </div>
        ))}
      </div>
      {running.length > 1 && (
        <button
          data-testid="timer-stop-all" onClick={() => void useData.getState().stopAllTimers()}
          className="mt-1.5 w-full rounded-full border border-emerald-400/20 py-0.5 text-[10.5px] text-emerald-200/80 transition hover:bg-emerald-400/10"
        >
          Jeda semua
        </button>
      )}
    </div>
  )
}

/** Satu baris layanan: titik status (hidup/hibernasi), nama, dan penanda buka di browser luar. */
function ServiceRow({ profile, info, shown }: { profile: ProfileRow; info: ViewInfo | undefined; shown: boolean }) {
  const p = profile
  const alive = info?.state === 'active' || info?.state === 'warm'
  return (
    <button
      data-testid={`svc-${p.name}`} onClick={() => void openProfile(p.id)}
      title={p.nativeOnly ? 'Membuka aplikasi native' : p.external ? 'Membuka di browser bawaan (login Google berfungsi di sana)' : alive ? 'Hidup di latar' : info?.state === 'hibernated' ? 'Hibernasi (dibangunkan saat dibuka)' : 'Belum dibuka'}
      className={`flex w-full items-center gap-2.5 rounded-full px-3 py-1.5 text-[13px] transition ${
        shown ? 'bg-accent-500/[0.15] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]' : 'text-zinc-400 hover:bg-accent-500/[0.07] hover:text-zinc-100'
      }`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${p.external ? 'bg-sky-400/80' : alive ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : info?.state === 'hibernated' ? 'bg-zinc-500' : 'bg-zinc-700'}`} />
      <span className="flex-1 truncate text-left">{p.name}</span>
      {p.external && <ExternalLink size={10} className="shrink-0 text-zinc-600" />}
      {!!info?.badge && <span className="rounded-full bg-emerald-400/20 px-1.5 font-mono text-[10px] text-emerald-200">{info.badge}</span>}
    </button>
  )
}

export default function Sidebar() {
  const { workspaceFilter, openWorkspace, setDialog, setView, setSettingsSection } = useUi()
  const { tools, openTool } = useTools()
  const { tasks, workspaces, select } = useData()
  const { general, reminders } = useSettings((s) => s.settings)
  const { profiles, infos } = useWeb()
  const inboxBaru = useInbox((s) => s.items.filter((i) => i.status === 'baru').length)
  const web = useUi((s) => s.web)
  const view = useUi((s) => s.view)
  const g = useMemo(() => groupToday(tasks, reminders.staleDays), [tasks, reminders.staleDays])
  const todayCount = g.urgent.length + g.today.length
  /** Kelompok layanan dari `groupName` profil (kosong = otomatis dari jenis layanan); "Core" selalu paling atas. */
  const groups = useMemo(() => {
    const map = new Map<string, ProfileRow[]>()
    for (const p of profiles) {
      const name = p.groupName || defaultProfileGroup(p.service)
      const list = map.get(name)
      if (list) list.push(p)
      else map.set(name, [p])
    }
    return [...map.entries()]
      .map(([name, items]) => ({ id: name, label: name, items }))
      .sort((a, b) => (a.id === 'Core' ? -1 : b.id === 'Core' ? 1 : 0))
  }, [profiles])

  const [prefs, setPrefs] = useState<SidebarPrefs>(() => {
    const p = loadJson<LegacyPrefs>(SIDEBAR_KEY, {})
    const width = typeof p.width === 'number' ? p.width : 240
    // `workspaceOpen` versi lama dipetakan ke `closed.workspace`.
    const closed = p.closed && typeof p.closed === 'object'
      ? p.closed
      : p.workspaceOpen === false ? { workspace: true } : {}
    return { width: Math.min(MAX_W, Math.max(MIN_W, width)), collapsed: !!p.collapsed, closed }
  })
  useEffect(() => { saveJson(SIDEBAR_KEY, prefs) }, [prefs])
  /** Bagian dilipat? `id` = 'tasks' | 'workspace' | 'tools' | `group:<nama>`. */
  const isOpen = (id: string): boolean => !prefs.closed[id]
  const toggle = (id: string): void => setPrefs((p) => ({ ...p, closed: { ...p.closed, [id]: !p.closed[id] } }))

  const dragging = useRef(false)
  const startDrag = (e: React.MouseEvent): void => {
    e.preventDefault()
    dragging.current = true
    document.body.style.cursor = 'col-resize'
    const move = (ev: MouseEvent): void => {
      const next = Math.min(MAX_W, Math.max(MIN_W, ev.clientX))
      setPrefs((p) => ({ ...p, width: next, collapsed: false }))
    }
    const up = (): void => {
      dragging.current = false
      document.body.style.cursor = ''
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const collapsed = prefs.collapsed
  const width = collapsed ? COLLAPSED_W : prefs.width
  const enabledTools = tools.filter((t) => t.enabled)

  return (
    <aside style={{ width }} className="glass-panel relative flex shrink-0 flex-col overflow-hidden rounded-2xl transition-[width] duration-150 ease-glass">
      <div className={`flex items-center ${collapsed ? 'justify-center px-2' : 'px-3.5'} pt-3 pb-2`}>
        {!collapsed && <span className="ds-label">Ruang kerja</span>}
        <button
          title={collapsed ? 'Tampilkan sidebar' : 'Sembunyikan sidebar'}
          onClick={() => setPrefs((p) => ({ ...p, collapsed: !p.collapsed }))}
          className={`grid h-6 w-6 place-items-center rounded-full text-zinc-500 transition hover:bg-white/[0.08] hover:text-zinc-200 ${collapsed ? '' : 'ml-auto'}`}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
      <div className="hairline mx-3.5 mb-2" />

      <div className={`pb-1 ${collapsed ? 'px-2' : 'px-2.5'}`}>
        <button
          data-testid="btn-new-task" onClick={() => setDialog({ type: 'newTask' })} title="Task baru (Ctrl N)"
          className={`btn-primary sheen w-full py-2 text-[13px] ${collapsed ? 'px-2' : 'px-3'}`}
        >
          <Plus size={15} />{!collapsed && 'Task Baru'}
        </button>
      </div>

      {!collapsed && <SectionHeader label="Tugas" open={isOpen('tasks')} onToggle={() => toggle('tasks')} tight />}
      {(collapsed || isOpen('tasks')) && (
        <nav className={`space-y-0.5 ${collapsed ? 'px-2' : 'px-2'}`}>
          <NavItem id="today" label="Hari Ini" icon={<CalendarCheck size={16} />} count={todayCount} collapsed={collapsed} />
          <NavItem id="inbox" label="Inbox" icon={<Inbox size={16} />} count={inboxBaru} collapsed={collapsed} />
          <NavItem id="tasks" label="Semua Task" icon={<ListTodo size={16} />} collapsed={collapsed} />
          <NavItem id="waiting" label="Menunggu Balasan" icon={<Hourglass size={16} />} count={g.waiting.length} collapsed={collapsed} />
          <NavItem id="timesheet" label="Timesheet" icon={<Clock size={16} />} collapsed={collapsed} />
          <NavItem id="done" label="Selesai" icon={<CheckCircle2 size={16} />} collapsed={collapsed} />
        </nav>
      )}

      {!collapsed && (
        <div className="min-h-0 flex-1 overflow-y-auto pb-2">
          <SectionHeader
            label="Workspace" open={isOpen('workspace')} count={workspaces.length} onToggle={() => toggle('workspace')}
            onAdd={() => setDialog({ type: 'workspace' })} addTitle="Workspace baru"
          />
          {isOpen('workspace') && (
            <div className="space-y-0.5 px-2">
              {workspaces.length === 0 && <p className="px-2 py-2 text-xs text-zinc-600">Belum ada workspace.</p>}
              {workspaces.map((w) => (
                <button
                  key={w.id} onClick={() => { void select(null); openWorkspace(w.id) }}
                  className={`relative flex w-full items-center gap-2.5 rounded-full px-3 py-1.5 text-[13px] transition ${
                    workspaceFilter === w.id ? 'bg-accent-500/[0.15] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]' : 'text-zinc-400 hover:bg-accent-500/[0.07] hover:text-zinc-100'
                  }`}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: w.color, boxShadow: `0 0 10px ${w.color}66` }} /><span className="truncate">{w.name}</span>
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between px-3.5 pb-1">
            <span className="ds-label">Layanan</span>
            <button title="Atur layanan & kelompoknya" onClick={() => { setView('settings'); setSettingsSection('services') }} className="grid h-5 w-5 place-items-center rounded-full text-zinc-500 hover:bg-white/[0.08] hover:text-zinc-200"><Plus size={12} /></button>
          </div>
          {profiles.length === 0 && <p className="px-4 py-1 text-xs text-zinc-600">Belum ada layanan.</p>}
          {groups.map((group) => {
            const open = isOpen(`group:${group.id}`)
            return (
              <div key={group.id}>
                <SectionHeader sub label={group.label} open={open} count={group.items.length} onToggle={() => toggle(`group:${group.id}`)} />
                {open && (
                  <div className="space-y-0.5 px-2">
                    {group.items.map((p) => {
                      const shown = view === 'web' && (web.full ? web.full === p.id : web.panels.some((panel) => panel.tabs.includes(p.id)))
                      return <ServiceRow key={p.id} profile={p} info={infos.find((i) => i.profileId === p.id)} shown={shown} />
                    })}
                  </div>
                )}
              </div>
            )
          })}

          <SectionHeader
            label="Tools" open={isOpen('tools')} count={enabledTools.length} onToggle={() => toggle('tools')}
            onAdd={() => { setView('settings'); setSettingsSection('tools') }} addTitle="Kelola tool"
          />
          {isOpen('tools') && (
            <div className="space-y-0.5 px-2">
              {enabledTools.map((t) => {
                const Icon = t.id === 'image-resizer' ? ImageIcon : t.id === 'screenshot-editor' ? PenTool : t.id === 'file-manager' ? FolderOpen : t.id === 'gridcraft' ? Table2 : t.id === 'catatan' ? StickyNote : Wrench
                return (
                  <button
                    key={t.id} draggable data-testid={`tool-${t.id}`}
                    onDragStart={(e) => { e.dataTransfer.setData('text/tn-tool', t.id); e.dataTransfer.effectAllowed = 'copy' }}
                    onClick={() => openTool(t.id)} title={`${t.manifest.title} — klik untuk membuka, tarik ke panel kanan/bawah untuk dock`}
                    className="group flex w-full items-center gap-2.5 rounded-full px-3 py-1.5 text-[13px] text-zinc-400 transition hover:bg-accent-500/[0.07] hover:text-zinc-100"
                  >
                    <Icon size={14} className="shrink-0 text-zinc-500 transition group-hover:text-accent-300" />
                    <span className="flex-1 truncate text-left">{t.manifest.title}</span>
                    {!t.builtin && <span className="font-mono text-[9px] uppercase text-zinc-600">{t.manifest.type}</span>}
                  </button>
                )
              })}
              {enabledTools.length === 0 && <p className="px-2 py-1 text-xs text-zinc-600">Belum ada tool.</p>}
            </div>
          )}
        </div>
      )}

      <div className={`mt-auto space-y-2 ${collapsed ? 'p-2' : 'p-2.5'}`}>
        <div className={collapsed ? 'flex justify-center' : ''}><TimerWidget collapsed={collapsed} /></div>
        <NavItem id="settings" label="Pengaturan" icon={<Settings size={16} />} collapsed={collapsed} />
        {!collapsed && (
          <div className="flex items-center gap-2 px-2 pt-0.5 text-[13px] text-zinc-400">
            <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-600 font-display text-[11px] font-bold text-white">{general.userName.slice(0, 1).toUpperCase()}</div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate">{general.userName}</div>
              <div className="ds-label truncate" title="Dibuat oleh TransformNusa — Alip T. S.">TransformNusa</div>
            </div>
          </div>
        )}
      </div>

      {!collapsed && (
        <div data-testid="sidebar-resize" onMouseDown={startDrag} title="Geser untuk mengubah lebar sidebar" className="absolute inset-y-0 right-0 w-1 cursor-col-resize bg-transparent transition hover:bg-accent-400/50" />
      )}
    </aside>
  )
}
