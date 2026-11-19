import { useEffect, type CSSProperties, type ReactElement, type ReactNode } from 'react'
import { PRIORITY_LABEL, STATUS_LABEL, type Priority, type Status } from '@shared/data'

const STATUS_STYLE: Record<Status, { wrap: string; dot: string }> = {
  baru: { wrap: 'border-white/12 text-zinc-300', dot: 'bg-zinc-400' },
  // "Proses" memakai biru laut (bukan warna merek) supaya warna aksen tetap khas aksi.
  proses: { wrap: 'border-plum-400/35 text-plum-200', dot: 'bg-plum-400' },
  menunggu: { wrap: 'border-amber-400/30 text-amber-200', dot: 'bg-amber-400' },
  selesai: { wrap: 'border-emerald-400/30 text-emerald-200', dot: 'bg-emerald-400' }
}
const PRIORITY_STYLE: Record<Priority, { wrap: string; dot: string }> = {
  urgent: { wrap: 'border-red-400/40 text-red-200', dot: 'bg-red-400' },
  tinggi: { wrap: 'border-amber-500/35 text-amber-200', dot: 'bg-amber-500' },
  normal: { wrap: 'border-white/10 text-zinc-400', dot: 'bg-zinc-500' },
  rendah: { wrap: 'border-white/[0.08] text-zinc-500', dot: 'bg-zinc-600' }
}

const tag = (s: { wrap: string; dot: string }, label: string): ReactElement => (
  <span className={`inline-flex items-center gap-1.5 rounded-full border bg-white/[0.035] px-2 py-0.5 text-[11px] font-medium ${s.wrap}`}>
    <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{label}
  </span>
)

export const StatusPill = ({ status }: { status: Status }): ReactElement => tag(STATUS_STYLE[status], STATUS_LABEL[status])
export const PriorityBadge = ({ priority }: { priority: Priority }): ReactElement => tag(PRIORITY_STYLE[priority], PRIORITY_LABEL[priority])

export const btn = {
  // Aksi utama: satu warna padat terracotta (tanpa gradasi).
  primary: 'btn-primary sheen',
  ghost: 'btn-ghost',
  danger: 'btn-danger'
}
export const input = 'field w-full rounded-xl px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600'
/** Tombol ikon persegi untuk toolbar. */
export const iconBtn =
  'grid h-7 w-7 place-items-center rounded-lg text-zinc-400 transition hover:bg-accent-500/15 hover:text-accent-100 disabled:opacity-30'

const noDrag: CSSProperties = { WebkitAppRegion: 'no-drag' } as CSSProperties

export function Modal({ title, onClose, children, width = 'max-w-md' }: { title: string; onClose: () => void; children: ReactNode; width?: string }) {
  useEffect(() => {
    const h = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/55 p-6 backdrop-blur-[1px]" onMouseDown={onClose} style={noDrag}>
      <div className={`glass-strong animate-rise w-full ${width} rounded-3xl p-5`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center gap-2.5">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-500" />
          <h3 className="font-display text-base font-semibold text-zinc-100">{title}</h3>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Warna penanda workspace: warna bumi yang tetap mudah dibedakan. */
export const WS_COLORS = ['#c9632f', '#d9a441', '#8fae6b', '#5f9ea0', '#c9632f', '#a98bc4', '#c97f9e', '#8d8378']
