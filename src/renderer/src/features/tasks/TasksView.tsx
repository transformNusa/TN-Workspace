import { Pencil, Plus } from 'lucide-react'
import { useMemo } from 'react'
import type { TaskRow } from '@shared/data'
import CircuitField from '@renderer/components/Circuit'
import TaskCard from '@renderer/components/TaskCard'
import { iconBtn } from '@renderer/components/ui'
import { compareTasks, groupToday } from '@renderer/lib/grouping'
import { useData } from '@renderer/store/data'
import { useSettings } from '@renderer/store/settings'
import { useUi } from '@renderer/store/ui'
import Dashboard from './Dashboard'
import TaskDetailPane from './TaskDetail'

type TaskView = 'today' | 'tasks' | 'waiting' | 'done'
const TITLES: Record<TaskView, string> = { today: 'Hari Ini', tasks: 'Semua Task', waiting: 'Menunggu Balasan', done: 'Selesai' }

function Group({ title, tasks, tone, selectedId, onPick }: { title: string; tasks: TaskRow[]; tone: string; selectedId: string | null; onPick: (id: string) => void }) {
  if (!tasks.length) return null
  return (
    <div className="mb-4">
      <div className={`ds-label mb-1.5 flex items-center gap-2 px-1 ${tone}`}>
        <span>{title}</span><span className="font-mono text-[10px] text-zinc-600">{tasks.length}</span>
      </div>
      {tasks.map((t) => <TaskCard key={t.id} task={t} selected={t.id === selectedId} onClick={() => onPick(t.id)} />)}
    </div>
  )
}

export default function TasksView({ view }: { view: TaskView }) {
  const { tasks, workspaces, selectedId, select } = useData()
  const threshold = useSettings((s) => s.settings.reminders.staleDays)
  const { workspaceFilter, setDialog } = useUi()
  const ws = workspaces.find((w) => w.id === workspaceFilter)
  const pick = (id: string): void => void select(id)

  const groups = useMemo(() => groupToday(tasks, threshold), [tasks, threshold])
  const flat = useMemo(() => {
    let list = tasks.filter((t) => (workspaceFilter ? t.workspaceId === workspaceFilter : true))
    if (view === 'tasks') list = list.filter((t) => t.status !== 'selesai').sort(compareTasks)
    if (view === 'waiting') list = list.filter((t) => t.status === 'menunggu').sort((a, b) => Date.parse(a.waitingSince ?? '') - Date.parse(b.waitingSince ?? ''))
    if (view === 'done') list = list.filter((t) => t.status === 'selesai').sort((a, b) => Date.parse(b.completedAt ?? '') - Date.parse(a.completedAt ?? ''))
    return list
  }, [tasks, view, workspaceFilter])

  const count = view === 'today' ? groups.urgent.length + groups.today.length + groups.waiting.length + groups.stale.length : flat.length

  return (
    <>
      <section className="glass-panel flex w-[368px] shrink-0 flex-col overflow-hidden rounded-2xl">
        <div className="flex items-start justify-between px-4 pb-2 pt-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 truncate font-display text-[17px] font-semibold text-zinc-50">
              {ws && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: ws.color, boxShadow: `0 0 12px ${ws.color}88` }} />}
              {ws ? ws.name : TITLES[view]}
            </h2>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-accent-300/70">{count} task</p>
          </div>
          <div className="flex gap-1.5">
            {ws && (
              <button title="Ubah workspace" onClick={() => setDialog({ type: 'workspace', id: ws.id })} className={`${iconBtn} h-8 w-8 rounded-full border border-white/10 bg-white/[0.05]`}><Pencil size={13} /></button>
            )}
            <button title="Task baru" onClick={() => setDialog({ type: 'newTask', workspaceId: workspaceFilter })} className={`${iconBtn} h-8 w-8 rounded-full border border-white/10 bg-white/[0.05]`}><Plus size={14} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2.5 pb-3">
          {view === 'today' ? (
            <>
              <Group title="Urgent" tasks={groups.urgent} tone="text-red-300/90" selectedId={selectedId} onPick={pick} />
              <Group title="Hari ini" tasks={groups.today} tone="text-accent-300/90" selectedId={selectedId} onPick={pick} />
              <Group title="Menunggu balasan" tasks={groups.waiting} tone="text-amber-300/90" selectedId={selectedId} onPick={pick} />
              <Group title="Pending lama" tasks={groups.stale} tone="text-zinc-400" selectedId={selectedId} onPick={pick} />
            </>
          ) : (
            flat.map((t) => <TaskCard key={t.id} task={t} selected={t.id === selectedId} onClick={() => pick(t.id)} />)
          )}
          {count === 0 && (
            <div className="mt-10 px-4 text-center text-sm text-zinc-500">
              {view === 'today' ? 'Tidak ada task yang perlu perhatian hari ini.' : 'Belum ada task di sini.'}
              <div className="mt-1 text-xs text-zinc-600">Tekan Ctrl+K lalu ketik judul untuk menambah task cepat.</div>
            </div>
          )}
        </div>
      </section>
      <section className="min-w-0 flex-1 overflow-y-auto rounded-2xl">
        {selectedId ? <TaskDetailPane /> : view === 'today' ? <Dashboard groups={groups} /> : (
          <div className="relative grid h-full place-items-center overflow-hidden rounded-2xl bg-[#1a1512] text-sm text-zinc-600">
            <CircuitField dots={2} />
            <span className="relative">Pilih task untuk melihat detailnya.</span>
          </div>
        )}
      </section>
    </>
  )
}
