import { X } from 'lucide-react'
import { useTools } from '@renderer/store/tools'
import { iconBtn } from '@renderer/components/ui'
import ToolPanel from './ToolPanel'

/** Jendela tool dari sidebar / Pengaturan → Tool Saya. */
export default function ToolWindow() {
  const activeTool = useTools((s) => s.activeTool)
  const tool = useTools((s) => s.tools.find((t) => t.id === activeTool))
  const openTool = useTools((s) => s.openTool)
  const setLayout = useTools((s) => s.setLayout)
  if (!activeTool || !tool) return null
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/55 p-6" onMouseDown={() => openTool(null)}>
      <div className="glass-strong animate-rise flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/[0.08] bg-white/[0.02] px-5 py-3">
          <div>
            <h2 className="font-display text-[15px] font-semibold text-zinc-50">{tool.manifest.title}</h2>
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-accent-300/70">{tool.builtin ? 'tool bawaan' : tool.manifest.type}</p>
          </div>
          <div className="flex items-center gap-1.5">
            {tool.manifest.dockable && (
              <>
                <button data-testid="tool-dock-right" onClick={() => { void setLayout('right', tool.id); openTool(null) }} className="rounded-full border border-white/10 px-2.5 py-1 text-[11.5px] text-zinc-300 transition hover:border-accent-400/35 hover:bg-accent-500/10 hover:text-white">Panel kanan</button>
                <button data-testid="tool-dock-bottom" onClick={() => { void setLayout('bottom', tool.id); openTool(null) }} className="rounded-full border border-white/10 px-2.5 py-1 text-[11.5px] text-zinc-300 transition hover:border-accent-400/35 hover:bg-accent-500/10 hover:text-white">Panel bawah</button>
              </>
            )}
            <button onClick={() => openTool(null)} className={iconBtn} title="Tutup"><X size={15} /></button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5"><ToolPanel toolId={tool.id} /></div>
      </div>
    </div>
  )
}
