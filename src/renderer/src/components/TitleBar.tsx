import { ClipboardPaste, Copy, Minus, Plus, Search, Square, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { openCapture } from '@renderer/lib/actions'
import { useUi } from '@renderer/store/ui'
import ReminderBell from './ReminderBell'

function WindowButton({ title, onClick, children, danger = false }: { title: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      title={title} onClick={onClick}
      className={`no-drag grid h-7 w-8 place-items-center rounded-lg text-zinc-400 transition ${
        danger ? 'hover:bg-red-500/80 hover:text-white' : 'hover:bg-accent-500/15 hover:text-accent-100'
      }`}
    >
      {children}
    </button>
  )
}

/** Title bar kaca: merek, pencarian, aksi utama, dan tombol jendela (jendela frameless). */
export default function TitleBar() {
  const { setPalette, setDialog } = useUi()
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    void window.alip.win.state().then((s) => setMaximized(s.maximized))
    return window.alip.win.onState((s) => setMaximized(s.maximized))
  }, [])

  return (
    <header className="drag relative z-30 flex h-[52px] shrink-0 items-center px-3 pt-2.5">
      <div className="glass flex h-10 w-full items-center gap-2.5 rounded-full px-2 pl-2.5">
        <div className="no-drag flex items-center gap-2.5">
          <div className="relative grid h-6 w-6 place-items-center rounded-[8px] bg-accent-600 font-display text-[12px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]">
            T
          </div>
          <span title="TN-Workspace — dibuat oleh TransformNusa (Alip T. S.)" className="font-display text-[13.5px] font-semibold tracking-tight text-zinc-100">TN-Workspace</span>
        </div>

        <button
          onClick={() => setPalette(true)} title="Cari (Ctrl K)"
          className="no-drag group flex h-7 w-[min(420px,34vw)] items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 text-xs text-zinc-500 transition hover:border-accent-400/35 hover:bg-accent-500/[0.08] hover:text-zinc-200"
        >
          <Search size={13} className="text-zinc-500 transition group-hover:text-accent-300" />
          <span className="truncate">Cari task, workspace, layanan…</span>
          <kbd className="ml-auto shrink-0 rounded-md border border-white/10 bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 transition group-hover:border-accent-400/30 group-hover:text-accent-200">Ctrl K</kbd>
        </button>

        <div className="no-drag ml-auto flex items-center gap-1.5">
          <button data-testid="btn-title-capture" onClick={() => void openCapture()} title="Tangkap cepat dari clipboard (Ctrl Shift N)" className="grid h-7 w-8 place-items-center rounded-lg text-zinc-400 transition hover:bg-accent-500/15 hover:text-accent-100">
            <ClipboardPaste size={14} />
          </button>
          <ReminderBell />
          <button onClick={() => setDialog({ type: 'newTask' })} title="Task baru (Ctrl N)" className="btn-primary sheen h-7 px-3 text-[13px]">
            <Plus size={14} /> Task Baru
          </button>
          <span className="mx-1 h-5 w-px bg-white/10" />
          <WindowButton title="Perkecil" onClick={() => void window.alip.win.minimize()}><Minus size={14} /></WindowButton>
          <WindowButton title={maximized ? 'Pulihkan' : 'Perbesar'} onClick={() => void window.alip.win.toggleMaximize()}>
            {maximized ? <Copy size={13} /> : <Square size={12} />}
          </WindowButton>
          <WindowButton title="Tutup" danger onClick={() => void window.alip.win.close()}><X size={15} /></WindowButton>
        </div>
      </div>
    </header>
  )
}
