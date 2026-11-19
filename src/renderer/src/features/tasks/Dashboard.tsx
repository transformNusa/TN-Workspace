import { CalendarClock, Plus } from 'lucide-react'
import CircuitField from '@renderer/components/Circuit'
import { btn } from '@renderer/components/ui'
import { daysSince, fmtDuration, fmtLongDate, greeting } from '@renderer/lib/format'
import { staleDays, type Groups } from '@renderer/lib/grouping'
import { useSpotlight } from '@renderer/lib/spotlight'
import { useData } from '@renderer/store/data'
import { useSettings } from '@renderer/store/settings'
import { useUi } from '@renderer/store/ui'

function Card({ label, value, sub, tone = '' }: { label: string; value: string | number; sub: string; tone?: string }) {
  const { onMouseMove } = useSpotlight<HTMLDivElement>()
  return (
    <div onMouseMove={onMouseMove} className="card spot px-4 py-3.5">
      <span className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-accent-400/45 to-transparent" />
      <div className="ds-label">{label}</div>
      <div className={`nums mt-1.5 font-display text-[28px] font-semibold leading-none tracking-tight ${tone || 'text-zinc-50'}`}>{value}</div>
      <div className="mt-1.5 text-[11.5px] text-zinc-500">{sub}</div>
    </div>
  )
}

export default function Dashboard({ groups }: { groups: Groups }) {
  const stats = useData((s) => s.stats)
  const setDialog = useUi((s) => s.setDialog)
  const { general, work, reminders } = useSettings((s) => s.settings)
  const attention = groups.urgent.length + groups.today.length
  const oldestWaiting = groups.waiting.length ? Math.max(...groups.waiting.map((t) => daysSince(t.waitingSince))) : 0
  const oldestStale = groups.stale.length ? Math.max(...groups.stale.map((t) => staleDays(t))) : 0
  const weekTarget = work.weeklyTargetHours * 3600
  const pct = Math.min(100, Math.round((stats.weekSeconds / weekTarget) * 100))

  return (
    <div className="flex h-full flex-col p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="ds-label flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-500 animate-pulseGlow" />
            {fmtLongDate()}
          </p>
          <h1 className="mt-1.5 font-display text-[26px] font-semibold tracking-tight text-zinc-50">{greeting()}, <span className="text-accent-300">{general.userName}</span></h1>
          <p className="mt-1 text-[13px] text-zinc-500">{attention} task perlu perhatian hari ini</p>
        </div>
        <div className="flex gap-2">
          <button data-testid="btn-end-of-day" onClick={() => setDialog({ type: 'endOfDay' })} className={btn.ghost}><CalendarClock size={15} /> Tutup hari</button>
          <button onClick={() => setDialog({ type: 'newTask' })} className={btn.primary}><Plus size={15} /> Task Baru</button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        <Card label="Task hari ini" value={attention} sub={`${groups.urgent.length} urgent`} tone={groups.urgent.length ? 'text-red-300' : ''} />
        <Card label="Menunggu balasan" value={groups.waiting.length} sub={groups.waiting.length ? `terlama ${oldestWaiting} hari` : 'tidak ada'} tone="text-amber-200" />
        <Card label="Pending lama" value={groups.stale.length} sub={groups.stale.length ? `hingga ${oldestStale} hari` : `ambang ${reminders.staleDays} hari`} />
        <Card label="Jam hari ini" value={fmtDuration(stats.todaySeconds)} sub={`target ${work.dailyTargetHours} jam`} tone="text-emerald-200" />
      </div>

      <div className="glass mt-2.5 overflow-hidden rounded-2xl">
        <div className="grid md:grid-cols-[1.55fr_1fr]">
          <div className="p-5">
            <div className="ds-label">Progres minggu ini</div>
            <div className="mt-2 flex items-end gap-2.5">
              <span className="nums font-display text-[34px] font-semibold leading-none tracking-tight text-zinc-50">{fmtDuration(stats.weekSeconds)}</span>
              <span className="nums mb-0.5 font-mono text-[11px] text-zinc-500">/ {work.weeklyTargetHours} jam · {pct}%</span>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-accent-950/60 ring-1 ring-inset ring-accent-300/10">
              <div
                className="h-full rounded-full bg-accent-600 transition-[width] duration-700 ease-glass"
                style={{ width: `${Math.max(pct, 1.5)}%` }}
              />
            </div>
          </div>

          <div className="border-t border-white/[0.07] p-5 md:border-l md:border-t-0">
            <dl className="space-y-2.5 text-[12px]">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-zinc-500">Hari ini</dt>
                <dd className="nums font-mono text-zinc-200">{fmtDuration(stats.todaySeconds)} / {work.dailyTargetHours} jam</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-zinc-500">Perlu perhatian</dt>
                <dd className="nums font-mono text-zinc-200">{attention} task</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-zinc-500">Sisa target</dt>
                <dd className="nums font-mono text-accent-300">{fmtDuration(Math.max(0, weekTarget - stats.weekSeconds))}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/*
        Sisa ruang di bawah memang kosong: di sinilah hiasan sirkuit ditaruh.
        Kartu-kartu di atas tidak memakai garis berjalan sama sekali.
      */}
      <div className="relative mt-4 min-h-[150px] flex-1 overflow-hidden rounded-2xl bg-[#1a1512]">
        <CircuitField />
        <p className="absolute inset-x-6 bottom-6 max-w-lg text-[12.5px] leading-relaxed text-zinc-600">
          Pilih task di sebelah kiri untuk membuka detailnya, atau tekan{' '}
          <kbd className="rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">Ctrl K</kbd>{' '}
          untuk mencari dan menambah task cepat.
        </p>
      </div>
    </div>
  )
}
