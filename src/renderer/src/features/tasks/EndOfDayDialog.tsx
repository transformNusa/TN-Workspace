import { CalendarClock, CheckCircle2, Clock, Hourglass, MoveRight } from 'lucide-react'
import { useMemo } from 'react'
import { PRIORITY_LABEL } from '@shared/data'
import { btn, Modal } from '@renderer/components/ui'
import { openTask } from '@renderer/lib/actions'
import { fmtDuration } from '@renderer/lib/format'
import { useData } from '@renderer/store/data'
import { useSettings } from '@renderer/store/settings'
import { useUi } from '@renderer/store/ui'

const tomorrowMorning = (): string => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(9, 0, 0, 0)
  return d.toISOString()
}

/** Penutup hari (bible 9.9): jam hari ini, task belum selesai, geser ke besok / tandai menunggu. */
export default function EndOfDayDialog() {
  const { tasks, stats, setStatus, updateTask, refresh } = useData()
  const { dailyTargetHours } = useSettings((s) => s.settings.work)
  const setDialog = useUi((s) => s.setDialog)
  const setView = useUi((s) => s.setView)
  const setNotice = useUi((s) => s.setNotice)
  const unfinished = useMemo(
    () => tasks.filter((t) => t.status !== 'selesai').slice(0, 12),
    [tasks]
  )
  const close = (): void => setDialog(null)

  const pushTomorrow = async (id: string): Promise<void> => {
    await updateTask(id, { dueAt: tomorrowMorning() })
    setNotice({ kind: 'ok', text: 'Tenggat dipindah ke besok pagi.' })
  }
  const markWaiting = async (id: string): Promise<void> => {
    await setStatus(id, 'menunggu')
    setNotice({ kind: 'ok', text: 'Task ditandai menunggu balasan.' })
  }

  return (
    <Modal title="Penutup hari" onClose={close} width="max-w-xl">
      <p className="text-sm text-zinc-500">Ringkasan hari ini. Pindahkan yang belum selesai supaya besok tidak menumpuk.</p>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <div className="glass rounded-2xl px-3.5 py-3">
          <div className="ds-label">Jam hari ini</div>
          <div className="mt-1 font-display text-[24px] font-semibold text-emerald-200">{fmtDuration(stats.todaySeconds)}</div>
          <div className="mt-1 text-[11px] text-zinc-500">target {dailyTargetHours} jam</div>
        </div>
        <div className="glass rounded-2xl px-3.5 py-3">
          <div className="ds-label">Belum selesai</div>
          <div className="mt-1 font-display text-[24px] font-semibold text-zinc-100">{unfinished.length}</div>
          <div className="mt-1 text-[11px] text-zinc-500">task terbuka</div>
        </div>
      </div>
      {stats.todaySeconds === 0 && (
        <p data-testid="eod-empty" className="mt-3 rounded-2xl border border-amber-400/25 bg-amber-400/[0.07] px-3 py-2 text-[12.5px] text-amber-200">
          Belum ada jam tercatat hari ini. Jalankan timer atau tambah entri manual di Timesheet.
        </p>
      )}

      <div className="mt-4 max-h-[300px] overflow-y-auto">
        {unfinished.map((t) => (
          <div key={t.id} className="flex items-center gap-2 border-b border-white/[0.06] py-2 text-[12.5px] last:border-0">
            <div className="min-w-0 flex-1">
              <button onClick={() => { close(); void openTask(t.id) }} className="truncate text-left text-zinc-200 hover:text-white">{t.title}</button>
              <div className="text-[10.5px] text-zinc-500">{t.workspaceName ?? 'Tanpa workspace'} · {PRIORITY_LABEL[t.priority]}</div>
            </div>
            <button onClick={() => void pushTomorrow(t.id)} className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[10.5px] text-zinc-300 hover:bg-white/[0.08]" title="Tenggat pindah ke besok 09.00"><MoveRight size={11} /> Besok</button>
            {t.status !== 'menunggu' && (
              <button onClick={() => void markWaiting(t.id)} className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[10.5px] text-amber-200 hover:bg-white/[0.08]" title="Tandai menunggu balasan"><Hourglass size={11} /> Menunggu</button>
            )}
          </div>
        ))}
        {unfinished.length === 0 && (
          <p className="flex items-center gap-2 py-4 text-sm text-emerald-300"><CheckCircle2 size={15} /> Semua task hari ini sudah selesai.</p>
        )}
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button onClick={() => { close(); setView('timesheet') }} className={btn.ghost}><CalendarClock size={13} /> Buka Timesheet</button>
        <button onClick={() => void refresh()} className={btn.ghost}><Clock size={13} /> Segarkan</button>
        <button onClick={close} className={btn.primary}>Tutup</button>
      </div>
    </Modal>
  )
}
