import { Leaf } from 'lucide-react'
import { useEffect } from 'react'
import type { ViewState } from '@shared/data'
import { btn } from '@renderer/components/ui'
import { useUi } from '@renderer/store/ui'
import { useWeb } from '@renderer/store/web'

const STATE_LABEL: Record<ViewState, string> = { active: 'Terlihat', warm: 'Hidup di latar', hibernated: 'Hibernasi', idle: 'Belum dibuka' }
const STATE_STYLE: Record<ViewState, string> = {
  active: 'bg-emerald-500/15 text-emerald-300', warm: 'bg-amber-500/15 text-amber-300', hibernated: 'bg-zinc-500/15 text-zinc-400', idle: 'bg-zinc-500/10 text-zinc-500'
}

/** Pantauan RAM per view web: bukti bahwa hibernasi bekerja dan tombol hibernasi manual. */
export default function ViewsMonitor() {
  const { infos, setInfos } = useWeb()
  const setNotice = useUi((s) => s.setNotice)
  useEffect(() => {
    void window.alip.views.list().then(setInfos)
    const t = setInterval(() => void window.alip.views.list().then(setInfos), 3000) // RAM berubah tanpa memicu event
    return () => clearInterval(t)
  }, [setInfos])
  const total = infos.reduce((s, i) => s + (i.memoryMb ?? 0), 0)
  return (
    <div data-testid="views-monitor" className="mt-8 max-w-xl border-t border-white/[0.06] pt-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="ds-label">View web saat ini</h3>
          <p className="text-xs text-zinc-500">Total proses view: {total} MB (di luar proses app utama).</p>
        </div>
        <button onClick={async () => { const n = await window.alip.views.hibernateAll(); setNotice({ kind: 'ok', text: `Mode hemat: ${n} view dihibernasi.` }) }} className={`${btn.ghost} flex items-center gap-1.5`}><Leaf size={14} /> Mode hemat</button>
      </div>
      {infos.length === 0 ? <p className="text-sm text-zinc-500">Belum ada view yang dibuka.</p> : (
        <div className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] bg-white/[0.02]">
          {infos.map((i) => (
            <div key={i.profileId} className="flex items-center gap-3 px-3.5 py-2.5 text-sm">
              <span className="min-w-0 flex-1 truncate">{i.name}{i.keepAlive && <span className="ml-2 text-[11px] text-zinc-500">jaga hidup</span>}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] ${STATE_STYLE[i.state]}`}>{STATE_LABEL[i.state]}</span>
              <span className="w-16 text-right text-zinc-500">{i.memoryMb !== null ? `${i.memoryMb} MB` : '—'}</span>
              <button disabled={i.state === 'hibernated' || i.state === 'idle'} onClick={() => void window.alip.views.hibernate(i.profileId)} className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] text-zinc-300 transition hover:bg-white/[0.1] disabled:opacity-30">Hibernasi</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
