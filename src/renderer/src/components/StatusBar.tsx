import { Leaf } from 'lucide-react'
import { useEffect } from 'react'
import { fmtDuration } from '@renderer/lib/format'
import { useData } from '@renderer/store/data'
import { useMetrics } from '@renderer/store/metrics'
import { useSettings } from '@renderer/store/settings'
import { useUi } from '@renderer/store/ui'

export default function StatusBar() {
  const { metrics, set } = useMetrics()
  const week = useData((s) => s.stats.weekSeconds)
  const target = useSettings((s) => s.settings.work.weeklyTargetHours)
  const { view, notice, setNotice } = useUi()
  useEffect(() => {
    void window.alip.metrics.get().then(set)
    return window.alip.metrics.subscribe(set)
  }, [set])

  const mb = metrics?.totalMb
  const ram = mb === undefined ? '…' : mb >= 1024 ? `${(mb / 1024).toFixed(1).replace('.', ',')} GB` : `${mb} MB`
  const saveMode = async (): Promise<void> => {
    const n = await window.alip.views.hibernateAll()
    setNotice({ kind: 'ok', text: n ? `Mode hemat: ${n} view dihibernasi.` : 'Mode hemat: tidak ada view yang perlu dihibernasi.' })
  }
  // Di layar web, toast melayang akan tertutup view asli, jadi pesannya ditampilkan di status bar.
  const inline = view === 'web' && notice
  return (
    <footer className="flex h-8 shrink-0 items-center justify-between px-4 font-mono text-[10.5px] tracking-tight text-zinc-500">
      <span className="flex min-w-0 items-center gap-3">
        {inline ? (
          <span data-testid="statusbar-notice" onClick={() => setNotice(null)} className={`min-w-0 cursor-pointer truncate ${notice.kind === 'error' ? 'text-red-300' : 'text-emerald-300'}`}>{notice.text}</span>
        ) : (
          <span className="flex shrink-0 items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-400 shadow-[0_0_8px_2px_rgba(176,82,42,0.4)] animate-pulseGlow" />
            <span className="nums">RAM {ram} · {metrics?.activeViews ?? 0} view · {metrics?.hibernatedViews ?? 0} hibernasi</span>
          </span>
        )}
        <button data-testid="btn-save-mode" onClick={() => void saveMode()} title="Hibernasi semua view yang tidak terlihat dan tidak ditandai jaga hidup" className="flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-emerald-300/80 transition hover:bg-emerald-400/10 hover:text-emerald-200">
          <Leaf size={10} /> Mode hemat
        </button>
      </span>
      <span className="nums shrink-0 pl-4">Minggu ini {fmtDuration(week)} / {target} jam · Data lokal · <span title="Dibuat oleh TransformNusa — Alip T. S." className="text-accent-300/80">TransformNusa</span></span>
    </footer>
  )
}
