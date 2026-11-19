import type { ViewId } from '@renderer/store/ui'

const INFO: Partial<Record<ViewId, { title: string; phase: number; text: string }>> = {
  timesheet: { title: 'Timesheet', phase: 5, text: 'Grid mingguan dan draft ringkasan untuk Sunfish.' }
}

export default function Placeholder({ view }: { view: ViewId }) {
  const { title, phase, text } = INFO[view] ?? { title: view, phase: 0, text: '' }
  return (
    <>
      <section className="glass-panel w-[368px] shrink-0 overflow-hidden rounded-2xl p-5">
        <h2 className="font-display text-[17px] font-semibold text-zinc-50">{title}</h2>
        <p className="mt-2 text-sm text-zinc-500">Daftar masih kosong.</p>
      </section>
      <section className="grid flex-1 place-items-center p-8">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-3 inline-block rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-300">Fase {phase}</div>
          <p className="text-sm text-zinc-400">{text}</p>
        </div>
      </section>
    </>
  )
}
