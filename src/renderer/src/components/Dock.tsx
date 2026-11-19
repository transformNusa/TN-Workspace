import { GripHorizontal, GripVertical, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { LayoutSlotId } from '@shared/tools'
import { iconBtn } from '@renderer/components/ui'
import { useTools } from '@renderer/store/tools'
import ToolPanel from '@renderer/features/tools/ToolPanel'

const SLOT_LABEL: Record<LayoutSlotId, string> = { right: 'panel kanan', bottom: 'panel bawah' }

/** Slot dock: tarik tool dari sidebar ke sini. Mengosongkan slot = tool berhenti. */
export default function Dock({ slot }: { slot: LayoutSlotId }) {
  const { layout, tools, setLayout } = useTools()
  const row = layout.find((l) => l.slotId === slot)
  const tool = tools.find((t) => t.id === row?.toolId)
  const [over, setOver] = useState(false)
  const [size, setSize] = useState(row?.size ?? (slot === 'right' ? 340 : 220))
  const sizeRef = useRef(size)
  useEffect(() => { sizeRef.current = size }, [size])
  useEffect(() => { if (row?.size) setSize(row.size) }, [row?.size])

  const drop = (e: React.DragEvent): void => {
    e.preventDefault()
    setOver(false)
    const id = e.dataTransfer.getData('text/tn-tool')
    if (id) void setLayout(slot, id, size)
  }
  const clear = (): void => {
    if (tool && !tool.builtin) void window.alip.tools.cancel(tool.id)
    void setLayout(slot, null, size)
  }

  const startResize = (e: React.MouseEvent): void => {
    e.preventDefault()
    const start = slot === 'right' ? e.clientX : e.clientY
    const base = size
    const move = (ev: MouseEvent): void => {
      const delta = (slot === 'right' ? start - ev.clientX : start - ev.clientY)
      setSize(Math.max(180, Math.min(slot === 'right' ? 720 : 560, base + delta)))
    }
    const up = (): void => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      void setLayout(slot, tool?.id ?? null, sizeRef.current)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const dropProps = {
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setOver(true) },
    onDragLeave: () => setOver(false),
    onDrop: drop
  }

  if (!tool) {
    return slot === 'right' ? (
      <div
        {...dropProps}
        title="Tarik tool ke sini untuk dock"
        style={{ width: over ? 120 : 38 }}
        className={`flex shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed transition ${over ? 'border-accent-400/60 bg-accent-500/[0.12] text-accent-100' : 'border-white/10 text-zinc-700 hover:text-zinc-500'}`}
      >
        <Plus size={14} />
        {over && <span className="px-2 text-center text-[10px] leading-tight">Lepas tool di sini</span>}
      </div>
    ) : (
      <div
        {...dropProps}
        style={{ height: over ? 90 : 28 }}
        className={`flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-dashed transition ${over ? 'border-accent-400/60 bg-accent-500/[0.12] text-accent-100' : 'border-white/10 text-zinc-700 hover:text-zinc-500'}`}
      >
        <Plus size={12} /><span className="text-[10px]">Tarik tool ke panel bawah</span>
      </div>
    )
  }

  return (
    <section
      {...dropProps}
      className={`glass-panel flex shrink-0 flex-col overflow-hidden rounded-2xl ${slot === 'right' ? '' : ''}`}
      style={slot === 'right' ? { width: size } : { height: size }}
      data-testid={`dock-${slot}`}
    >
      <div className="flex items-center gap-1 border-b border-white/[0.06] bg-white/[0.02] px-2 py-1.5">
        <button onMouseDown={startResize} title="Geser untuk mengubah ukuran" className={`${iconBtn} h-6 w-6 ${slot === 'right' ? 'cursor-col-resize' : 'cursor-row-resize'}`}>
          {slot === 'right' ? <GripVertical size={12} /> : <GripHorizontal size={12} />}
        </button>
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-zinc-200">{tool.manifest.title}</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-600">{SLOT_LABEL[slot]}</span>
        <button title="Kosongkan slot (tool berhenti)" onClick={clear} className={`${iconBtn} h-6 w-6 hover:text-red-300`}><X size={12} /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3"><ToolPanel toolId={tool.id} /></div>
    </section>
  )
}
