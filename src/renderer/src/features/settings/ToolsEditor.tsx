import { FolderOpen, Play, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { btn, iconBtn } from '@renderer/components/ui'
import { useTools } from '@renderer/store/tools'
import { useUi } from '@renderer/store/ui'

export default function ToolsEditor() {
  const { tools, loaded, error, load, install, remove, setEnabled, openTool } = useTools()
  const setNotice = useUi((s) => s.setNotice)
  const [busy, setBusy] = useState(false)

  useEffect(() => { void load() }, [load])

  const doInstall = async (kind: 'file' | 'folder'): Promise<void> => {
    const path = kind === 'folder' ? await window.alip.launcher.pick('folder') : await window.alip.launcher.pick('file')
    if (!path) return
    if (!window.confirm('Tool ini dapat mengakses file dan jaringan di komputer ini. Hanya impor tool milikmu sendiri. Lanjutkan?')) return
    setBusy(true)
    const ok = await install(path)
    setBusy(false)
    if (ok) setNotice({ kind: 'ok', text: 'Tool diimpor dan siap dipakai tanpa restart.' })
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button data-testid="tool-import-file" disabled={busy} onClick={() => void doInstall('file')} className={btn.primary}><Plus size={14} /> Impor file tool</button>
        <button data-testid="tool-import-folder" disabled={busy} onClick={() => void doInstall('folder')} className={btn.ghost}><FolderOpen size={14} /> Impor folder (tool.json)</button>
        <a href="#python" onClick={(e) => { e.preventDefault(); setNotice({ kind: 'ok', text: 'Python portable disiapkan lewat `npm run setup:python` di folder app. Path bisa diisi di Aplikasi & Path.' }) }} className="text-[11.5px] text-zinc-500 underline decoration-white/20 hover:text-zinc-300">Python portable…</a>
      </div>
      <p className="mb-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-[12px] leading-relaxed text-amber-200/90">
        Tool script berjalan sebagai proses anak dari folder app, tidak pernah di renderer. Tool yang tidak dipakai tidak memakan RAM.
      </p>
      {error && <p className="mb-3 rounded-2xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}

      <div className="space-y-2">
        {tools.map((t) => (
          <div key={t.id} data-testid={`tool-row-${t.id}`} className="glass flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13.5px] font-medium text-zinc-100">{t.manifest.title}</span>
                {t.builtin && <span className="rounded-full border border-white/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-500">bawaan</span>}
                {!t.enabled && <span className="rounded-full border border-amber-400/25 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-amber-300">mati</span>}
              </div>
              <div className="truncate text-[11px] text-zinc-500">{t.manifest.description ?? t.installPath ?? t.manifest.type}</div>
            </div>
            <button data-testid={`tool-open-${t.id}`} onClick={() => openTool(t.id)} disabled={!t.enabled} className={`${btn.ghost} px-2.5 py-1 text-[12px]`}><Play size={12} /> Buka</button>
            {!t.builtin && (
              <>
                <button onClick={() => void setEnabled(t.id, !t.enabled)} className={`${btn.ghost} px-2.5 py-1 text-[12px]`}>{t.enabled ? 'Matikan' : 'Aktifkan'}</button>
                <button title="Hapus tool" onClick={() => { if (window.confirm(`Hapus tool "${t.manifest.title}" dari app?`)) void remove(t.id) }} className={iconBtn}><Trash2 size={13} /></button>
              </>
            )}
          </div>
        ))}
        {loaded && tools.length === 0 && <p className="py-6 text-center text-sm text-zinc-500">Belum ada tool. Impor script atau folder tool.json.</p>}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
        Kontrak manifest: <code className="text-zinc-400">tool.json</code> berisi id, title, type (script/web/launcher), runtime, entry, inputs, dan output. Tool muncul di sidebar TOOLS dan halaman ini tanpa restart.
      </p>
    </div>
  )
}
