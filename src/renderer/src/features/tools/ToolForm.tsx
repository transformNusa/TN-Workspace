import { FolderOpen, Play, Square } from 'lucide-react'
import { useState } from 'react'
import type { ToolManifest, ToolRunResult } from '@shared/tools'
import { btn, input } from '@renderer/components/ui'
import { useData } from '@renderer/store/data'
import { useTools } from '@renderer/store/tools'
import { useUi } from '@renderer/store/ui'

type Value = string | number | boolean | string[]

function initialValues(m: ToolManifest): Record<string, Value> {
  const out: Record<string, Value> = {}
  for (const f of m.inputs) {
    if (f.kind === 'checkbox') out[f.name] = f.default === true
    else if (f.kind === 'number') out[f.name] = typeof f.default === 'number' ? f.default : 0
    else if (f.kind === 'select') out[f.name] = String(f.default ?? f.options?.[0] ?? '')
    else if (f.kind === 'file' && f.multiple) out[f.name] = []
    else out[f.name] = typeof f.default === 'string' ? f.default : ''
  }
  return out
}

/** Form otomatis dari manifest `inputs` (bible 11.4). */
export function ToolForm({ tool }: { tool: { id: string; manifest: ToolManifest } }) {
  const m = tool.manifest
  const setNotice = useUi((s) => s.setNotice)
  const selectedId = useData((s) => s.selectedId)
  const { attachOutputs } = useTools()
  const [values, setValues] = useState<Record<string, Value>>(() => initialValues(m))
  const [attaching, setAttaching] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ToolRunResult | null>(null)

  const set = (name: string, v: Value): void => setValues((prev) => ({ ...prev, [name]: v }))
  const browse = async (name: string, kind: 'file' | 'folder', multiple?: boolean): Promise<void> => {
    if (multiple) {
      const list = await window.alip.launcher.pickMany(kind)
      if (list.length) set(name, list)
      return
    }
    const p = await window.alip.launcher.pick(kind)
    if (p) set(name, p)
  }

  const run = async (): Promise<void> => {
    setBusy(true)
    setResult(null)
    try {
      const payload: Record<string, unknown> = { ...values }
      if (attaching && selectedId) payload.__taskId = selectedId
      const res = await window.alip.tools.run(tool.id, payload)
      setResult(res)
      if (res.ok) {
        setNotice({ kind: 'ok', text: res.message ?? 'Tool selesai.' })
        if (attaching && selectedId && res.outputs.length) await attachOutputs(selectedId, tool.id, res.outputs)
      } else {
        setNotice({ kind: 'error', text: res.message ?? 'Tool gagal dijalankan.' })
      }
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : String(e), outputs: [], log: '' })
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-3">
      {m.description && <p className="text-[12.5px] leading-relaxed text-zinc-500">{m.description}</p>}
      {m.inputs.map((f) => (
        <div key={f.name}>
          <label className="ds-label mb-1 block">{f.label}{f.required ? ' *' : ''}</label>
          {f.kind === 'checkbox' ? (
            <button type="button" onClick={() => set(f.name, !values[f.name])} className={`rounded-full border px-3 py-1.5 text-[13px] transition ${values[f.name] ? 'border-emerald-400/30 bg-emerald-400/[0.12] text-emerald-200' : 'border-white/10 bg-white/[0.05] text-zinc-400'}`}>
              {values[f.name] ? 'Aktif' : 'Mati'}
            </button>
          ) : f.kind === 'select' ? (
            <select value={String(values[f.name] ?? '')} onChange={(e) => set(f.name, e.target.value)} className={input}>
              {(f.options ?? []).map((o) => <option key={String(o)} value={String(o)}>{String(o)}</option>)}
            </select>
          ) : f.kind === 'number' ? (
            <input type="number" value={Number(values[f.name] ?? 0)} onChange={(e) => set(f.name, Number(e.target.value))} className={`${input} w-40`} />
          ) : f.kind === 'file' || f.kind === 'folder' ? (
            <div className="flex flex-wrap gap-2">
              <input
                value={Array.isArray(values[f.name]) ? (values[f.name] as string[]).join('; ') : String(values[f.name] ?? '')}
                onChange={(e) => set(f.name, e.target.value)} placeholder={f.kind === 'file' ? 'Pilih file…' : 'Pilih folder…'}
                className={`${input} min-w-0 flex-1`}
              />
              <button type="button" onClick={() => void browse(f.name, f.kind === 'folder' ? 'folder' : 'file', f.multiple)} className={btn.ghost}><FolderOpen size={13} /> {f.kind === 'file' ? 'File…' : 'Folder…'}</button>
            </div>
          ) : (
            <input value={String(values[f.name] ?? '')} onChange={(e) => set(f.name, e.target.value)} placeholder={f.placeholder} className={input} />
          )}
        </div>
      ))}

      {m.attachableToTask && m.output === 'files' && selectedId && (
        <label className="flex items-center gap-2 text-[12.5px] text-zinc-400">
          <input type="checkbox" checked={attaching} onChange={(e) => setAttaching(e.target.checked)} className="h-4 w-4 accent-emerald-400" />
          Lampirkan hasil ke task yang sedang dipilih
        </label>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button data-testid={`tool-run-${tool.id}`} onClick={() => void run()} disabled={busy} className={btn.primary}><Play size={13} /> {busy ? 'Menjalankan…' : m.type === 'launcher' ? 'Buka' : 'Jalankan'}</button>
        {busy && <button onClick={() => void window.alip.tools.cancel(tool.id)} className={btn.ghost}><Square size={12} /> Hentikan</button>}
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-600">{m.type}{m.runtime ? ` · ${m.runtime}` : ''}</span>
      </div>

      {result && (
        <div className={`rounded-2xl border px-3 py-2 text-[12px] ${result.ok ? 'border-emerald-400/25 bg-emerald-400/[0.06] text-emerald-200' : 'border-red-400/25 bg-red-500/10 text-red-200'}`}>
          <div>{result.message}</div>
          {result.outputs.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {result.outputs.map((o) => <button key={o} onClick={() => void window.alip.tools.openPath(o)} className="block truncate text-left text-[11px] text-zinc-300 underline decoration-white/20 hover:text-white">{o}</button>)}
            </div>
          )}
          {!result.ok && result.log && <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[10.5px] text-red-200/80">{result.log}</pre>}
        </div>
      )}
    </div>
  )
}
