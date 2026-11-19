import { Link2, Pause, Play } from 'lucide-react'
import type { TaskRow } from '@shared/data'
import { fmtDue, startOfDay } from '@renderer/lib/format'
import { isStale, staleDays } from '@renderer/lib/grouping'
import { toggleTimer } from '@renderer/lib/actions'
import { useData } from '@renderer/store/data'
import { useSettings } from '@renderer/store/settings'
import { PriorityBadge, StatusPill } from './ui'

export default function TaskCard({ task, selected, onClick }: { task: TaskRow; selected: boolean; onClick: () => void }) {
  const running = useData((s) => s.running.some((r) => r.taskId === task.id))
  const threshold = useSettings((s) => s.settings.reminders.staleDays)
  const stale = isStale(task, threshold)
  const overdue = !!task.dueAt && task.status !== 'selesai' && Date.parse(task.dueAt) < startOfDay(new Date()).getTime()
  const meta: string[] = []
  if (task.workspaceName) meta.push(task.workspaceName)
  if (task.dueAt) meta.push(fmtDue(task.dueAt))
  else if (task.status === 'menunggu' && task.waitingSince) meta.push(`menunggu sejak ${fmtDue(task.waitingSince).split(' ')[0].toLowerCase()}`)

  return (
    <div
      data-testid="task-card" onClick={onClick}
      className={`group relative mb-1.5 cursor-pointer overflow-hidden rounded-2xl border px-3.5 py-3 transition duration-300 ${
        selected
          ? 'border-accent-400/40 bg-accent-500/[0.10] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_18px_38px_-30px_rgba(176,82,42,0.5)]'
          : 'border-accent-300/[0.08] bg-accent-300/[0.035] hover:-translate-y-px hover:border-accent-400/30 hover:bg-accent-300/[0.06] hover:shadow-[0_18px_40px_-32px_rgba(0,0,0,0.95)]'
      }`}
    >
      {selected && <span className="pointer-events-none absolute left-0 top-1/2 h-6 w-[2px] -translate-y-1/2 rounded-full bg-accent-400 shadow-[0_0_10px_2px_rgba(176,82,42,0.45)]" />}
      <div className="flex items-start gap-2">
        {task.workspaceColor && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: task.workspaceColor, boxShadow: `0 0 10px ${task.workspaceColor}66` }} />}
        <div className="min-w-0 flex-1">
          <div className={`truncate text-[13.5px] font-medium ${task.status === 'selesai' ? 'text-zinc-500 line-through' : 'text-zinc-100'}`}>{task.title}</div>
          <div className={`mt-0.5 truncate text-[11.5px] ${overdue ? 'text-red-300' : 'text-zinc-500'}`}>{meta.join(' · ') || 'Tanpa workspace'}</div>
        </div>
        {task.status !== 'selesai' && (
          <button
            data-testid="card-timer" title={running ? 'Jeda timer' : 'Mulai timer'}
            onClick={(e) => { e.stopPropagation(); toggleTimer(task.id) }}
            className={`grid h-7 w-7 shrink-0 place-items-center rounded-full transition ${
              running ? 'bg-emerald-400/20 text-emerald-200 opacity-100 shadow-[0_0_14px_-2px_rgba(52,211,153,0.8)]' : 'text-zinc-500 opacity-0 hover:bg-accent-500/20 hover:text-accent-100 group-hover:opacity-100'
            }`}
          >
            {running ? <Pause size={13} /> : <Play size={13} />}
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <StatusPill status={task.status} />
        {task.priority !== 'normal' && <PriorityBadge priority={task.priority} />}
        {stale && <span className="rounded-full border border-red-400/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-200">Pending {staleDays(task)} hari</span>}
        {task.resourceCount > 0 && <span className="flex items-center gap-1 font-mono text-[10px] text-zinc-500"><Link2 size={10} />{task.resourceCount}</span>}
        {task.subtasksTotal > 0 && <span className="font-mono text-[10px] text-zinc-500">{task.subtasksDone}/{task.subtasksTotal} subtask</span>}
      </div>
    </div>
  )
}
