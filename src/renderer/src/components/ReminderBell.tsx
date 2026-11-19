import { Bell, BellOff, CalendarClock, Clock, Hourglass, Inbox } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { Reminder } from '@shared/data'
import { openReminder } from '@renderer/lib/actions'
import { useData } from '@renderer/store/data'
import { useReminders } from '@renderer/store/reminders'
import { useUi } from '@renderer/store/ui'

const ICON: Record<Reminder['kind'], React.ReactNode> = {
  overdue: <Clock size={13} className="text-red-300" />,
  waiting: <Hourglass size={13} className="text-amber-300" />,
  stale: <CalendarClock size={13} className="text-accent-300" />,
  inbox: <Inbox size={13} className="text-sky-300" />,
  timesheet: <CalendarClock size={13} className="text-emerald-300" />
}

/** Lonceng pengingat di title bar: jumlah, daftar, dan aksi buka/tunda/bisukan. */
export default function ReminderBell() {
  const { list, dismiss, mute } = useReminders()
  const refresh = useData((s) => s.refresh)
  const setNotice = useUi((s) => s.setNotice)
  const open = useUi((s) => s.reminderPanelOpen)
  const setOpen = useUi((s) => s.setReminderPanel)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const go = async (r: Reminder): Promise<void> => {
    setOpen(false)
    await openReminder(r)
  }
  const later = async (r: Reminder): Promise<void> => {
    await dismiss(r.key)
    setNotice({ kind: 'ok', text: 'Pengingat ditunda sampai besok.' })
  }
  const muteTask = async (r: Reminder): Promise<void> => {
    if (!r.taskId) return
    await mute(r.taskId, true)
    await refresh()
    setNotice({ kind: 'ok', text: 'Pengingat task ini dibisukan. Bisa dinyalakan lagi di detail task.' })
  }

  return (
    <div ref={ref} className="no-drag relative">
      <button
        data-testid="btn-reminders" onClick={() => setOpen(!open)}
        title={list.length ? `${list.length} pengingat` : 'Tidak ada pengingat'}
        className={`relative grid h-7 w-8 place-items-center rounded-lg transition ${list.length ? 'text-amber-300 hover:bg-white/[0.08]' : 'text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-100'}`}
      >
        <Bell size={14} />
        {list.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-3.5 min-w-[14px] place-items-center rounded-full bg-amber-400 px-1 font-mono text-[9px] font-bold text-[#17110c]">{list.length}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-50 w-[360px] overflow-hidden rounded-2xl border border-white/[0.13] bg-[#171514] shadow-float">
          <div className="flex items-center justify-between border-b border-white/[0.08] px-3.5 py-2.5">
            <span className="ds-label">Pengingat</span>
            <span className="font-mono text-[10px] text-zinc-500">{list.length} aktif</span>
          </div>
          <div className="max-h-[380px] overflow-y-auto p-1.5">
            {list.map((r) => (
              <div key={r.key} data-testid="reminder-item" className="rounded-xl px-2 py-2 transition hover:bg-white/[0.04]">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">{ICON[r.kind]}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium text-zinc-200">{r.title}</div>
                    <div className="mt-0.5 text-[11.5px] leading-snug text-zinc-500">{r.body}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <button onClick={() => void go(r)} className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10.5px] text-zinc-200 transition hover:bg-white/[0.12]">Buka</button>
                      <button onClick={() => void later(r)} className="rounded-full border border-white/10 px-2 py-0.5 text-[10.5px] text-zinc-400 transition hover:bg-white/[0.08] hover:text-zinc-200">Tunda</button>
                      {r.taskId && (
                        <button title="Bisukan pengingat untuk task ini" onClick={() => void muteTask(r)} className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[10.5px] text-zinc-400 transition hover:bg-white/[0.08] hover:text-zinc-200"><BellOff size={10} /> Bisukan</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {list.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-zinc-500">Tidak ada pengingat. Ambang diatur di Pengaturan → Pengingat.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
