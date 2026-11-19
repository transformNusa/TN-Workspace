import { ArrowUp, File, Folder, FolderOpen, Pencil, RefreshCw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { BuiltinFileEntry } from '@shared/tools'
import { btn, iconBtn, input } from '@renderer/components/ui'
import { useData } from '@renderer/store/data'
import { useUi } from '@renderer/store/ui'

const KEY = 'tn.filemanager.dir.v1'

/** File Manager bawaan: panel file untuk folder task/workspace (bukan pengganti Explorer). */
export default function FileManager() {
  const { detail } = useData()
  const setNotice = useUi((s) => s.setNotice)
  const folderResource = detail?.resources.find((r) => r.type === 'folder' && r.target)?.target ?? ''
  const [dir, setDir] = useState(() => localStorage.getItem(KEY) ?? folderResource)
  const [entries, setEntries] = useState<BuiltinFileEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<{ path: string; name: string } | null>(null)

  const load = useCallback(async (target: string): Promise<void> => {
    if (!target.trim()) { setEntries([]); return }
    try {
      setEntries(await window.alip.tools.listFiles(target))
      setError(null)
      localStorage.setItem(KEY, target)
    } catch (e) {
      setError((e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
      setEntries([])
    }
  }, [])

  useEffect(() => { setDir((d) => d || folderResource) }, [folderResource])
  useEffect(() => { void load(dir) }, [dir, load])

  const choose = async (): Promise<void> => {
    const p = await window.alip.launcher.pick('folder')
    if (p) setDir(p)
  }
  const up = (): void => {
    const parts = dir.replace(/[\\/]+$/, '').split(/[\\/]/)
    if (parts.length <= 1) return
    parts.pop()
    setDir(parts.join('\\') || parts[0])
  }
  const open = async (e: BuiltinFileEntry): Promise<void> => {
    if (e.dir) { setDir(e.path); return }
    try { await window.alip.tools.openPath(e.path) } catch (err) { setNotice({ kind: 'error', text: err instanceof Error ? err.message : String(err) }) }
  }
  const trash = async (e: BuiltinFileEntry): Promise<void> => {
    try {
      await window.alip.tools.trashFile(e.path)
      await load(dir)
      setNotice({ kind: 'ok', text: `${e.name} dipindah ke Recycle Bin.` })
    } catch (err) { setNotice({ kind: 'error', text: err instanceof Error ? err.message : String(err) }) }
  }
  const commitRename = async (): Promise<void> => {
    if (!renaming) return
    try {
      await window.alip.tools.renameFile(renaming.path, renaming.name)
      setRenaming(null)
      await load(dir)
    } catch (err) { setNotice({ kind: 'error', text: err instanceof Error ? err.message : String(err) }) }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => void choose()} className={btn.ghost}><FolderOpen size={13} /> Folder…</button>
        <button onClick={up} className={btn.ghost}><ArrowUp size={13} /> Naik</button>
        <button onClick={() => void load(dir)} className={btn.ghost}><RefreshCw size={13} /></button>
        {folderResource && folderResource !== dir && <button onClick={() => setDir(folderResource)} className={`${btn.ghost} text-emerald-200`}>Folder task ini</button>}
      </div>
      <div className="truncate rounded-xl border border-white/[0.07] bg-black/20 px-3 py-1.5 font-mono text-[11px] text-zinc-400">{dir || 'Belum ada folder dipilih'}</div>
      {error && <p className="rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">{error}</p>}
      <div className="max-h-[360px] overflow-y-auto rounded-xl border border-white/[0.07]">
        {entries.map((e) => (
          <div key={e.path} className="group flex items-center gap-2 border-b border-white/[0.05] px-2.5 py-1.5 text-[12px] last:border-0 hover:bg-white/[0.04]">
            {e.dir ? <Folder size={14} className="shrink-0 text-amber-200/80" /> : <File size={14} className="shrink-0 text-zinc-500" />}
            {renaming?.path === e.path ? (
              <input autoFocus value={renaming.name} onChange={(ev) => setRenaming({ ...renaming, name: ev.target.value })} onKeyDown={(ev) => { if (ev.key === 'Enter') void commitRename(); if (ev.key === 'Escape') setRenaming(null) }} onBlur={() => void commitRename()} className={`${input} h-7 flex-1 py-0.5 text-[12px]`} />
            ) : (
              <button onClick={() => void open(e)} className="min-w-0 flex-1 truncate text-left text-zinc-300 hover:text-white">{e.name}</button>
            )}
            <span className="shrink-0 font-mono text-[10px] text-zinc-600">{e.dir ? 'folder' : e.size > 1024 * 1024 ? `${(e.size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(e.size / 1024))} KB`}</span>
            <button title="Ganti nama" onClick={() => setRenaming({ path: e.path, name: e.name })} className={`${iconBtn} h-6 w-6 opacity-0 group-hover:opacity-100`}><Pencil size={11} /></button>
            <button title="Hapus ke Recycle Bin" onClick={() => void trash(e)} className={`${iconBtn} h-6 w-6 opacity-0 hover:text-red-300 group-hover:opacity-100`}><Trash2 size={11} /></button>
          </div>
        ))}
        {entries.length === 0 && !error && <p className="px-3 py-8 text-center text-sm text-zinc-500">Folder kosong atau belum dipilih.</p>}
      </div>
      <p className="text-[11px] text-zinc-600">Hapus memakai Recycle Bin Windows, bukan hapus permanen.</p>
    </div>
  )
}
