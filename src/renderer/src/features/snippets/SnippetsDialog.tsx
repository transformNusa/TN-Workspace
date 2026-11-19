import { Clipboard, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fillSnippet, type SnippetRow } from '@shared/data'
import { btn, iconBtn, input, Modal } from '@renderer/components/ui'
import { useUi } from '@renderer/store/ui'

export default function SnippetsDialog() {
  const setDialog = useUi((s) => s.setDialog)
  const setNotice = useUi((s) => s.setNotice)
  const [items, setItems] = useState<SnippetRow[]>([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async (): Promise<void> => setItems(await window.alip.snippets.list())
  useEffect(() => { void load() }, [])

  const create = async (): Promise<void> => {
    if (!title.trim() || !body.trim() || busy) return
    setBusy(true)
    try {
      await window.alip.snippets.create({ title, body })
      setTitle(''); setBody('')
      await load()
      setNotice({ kind: 'ok', text: 'Snippet disimpan. Panggil lewat Ctrl+K.' })
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : String(e) })
    } finally { setBusy(false) }
  }
  const remove = async (id: string): Promise<void> => { await window.alip.snippets.remove(id); await load() }
  const copy = async (s: SnippetRow): Promise<void> => {
    if (s.variables.length) { setDialog({ type: 'snippet', id: s.id }); return }
    await window.alip.clipboard.writeText(s.body)
    setNotice({ kind: 'ok', text: `Snippet "${s.title}" disalin.` })
  }

  return (
    <Modal title="Snippet balasan" onClose={() => setDialog(null)} width="max-w-2xl">
      <p className="text-sm text-zinc-500">Snippet dipanggil dari Ctrl+K dan langsung disalin ke clipboard. Variabel ditulis <code className="text-zinc-300">{'{nama}'}</code>, <code className="text-zinc-300">{'{no_tiket}'}</code>.</p>
      <div className="mt-3 max-h-[220px] overflow-y-auto">
        {items.map((s) => (
          <div key={s.id} className="flex items-center gap-2 border-b border-white/[0.06] py-2 last:border-0">
            <button onClick={() => void copy(s)} className="min-w-0 flex-1 text-left">
              <div className="truncate text-[12.5px] text-zinc-200">{s.title}</div>
              <div className="truncate text-[10.5px] text-zinc-500">{s.body}</div>
            </button>
            <button title="Salin" onClick={() => void copy(s)} className={iconBtn}><Clipboard size={13} /></button>
            <button title="Hapus" onClick={() => void remove(s.id)} className={iconBtn}><Trash2 size={13} /></button>
          </div>
        ))}
        {items.length === 0 && <p className="py-4 text-center text-sm text-zinc-500">Belum ada snippet.</p>}
      </div>
      <div className="mt-4 border-t border-white/[0.08] pt-4">
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-[220px_1fr]">
          <label><span className="mb-1 block text-xs text-zinc-500">Judul</span>
            <input data-testid="snippet-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="mis. Balas tiket" className={input} /></label>
          <label><span className="mb-1 block text-xs text-zinc-500">Isi balasan</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder={'Halo {nama}, tiket {no_tiket} sudah kami proses…'} className={`${input} resize-none`} /></label>
        </div>
        <div className="mt-3 flex justify-end">
          <button data-testid="snippet-save" disabled={!title.trim() || !body.trim() || busy} onClick={() => void create()} className={btn.primary}><Plus size={14} /> Simpan snippet</button>
        </div>
      </div>
    </Modal>
  )
}

export function FillSnippetDialog({ id }: { id: string }) {
  const setDialog = useUi((s) => s.setDialog)
  const setNotice = useUi((s) => s.setNotice)
  const [snippet, setSnippet] = useState<SnippetRow | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void window.alip.snippets.list().then((list) => {
      const hit = list.find((s) => s.id === id) ?? null
      setSnippet(hit)
      if (hit) setValues(Object.fromEntries(hit.variables.map((v) => [v, ''])))
    })
  }, [id])

  const copy = async (): Promise<void> => {
    if (!snippet) return
    const missing = snippet.variables.filter((v) => !values[v]?.trim())
    if (missing.length) { setError(`Isi dulu: ${missing.join(', ')}`); return }
    await window.alip.clipboard.writeText(fillSnippet(snippet.body, values))
    setDialog(null)
    setNotice({ kind: 'ok', text: `Snippet "${snippet.title}" disalin.` })
  }

  return (
    <Modal title={snippet?.title ?? 'Snippet'} onClose={() => setDialog(null)}>
      {snippet ? (
        <>
          {snippet.variables.map((v) => (
            <label key={v} className="mb-2 block"><span className="mb-1 block text-xs text-zinc-500">{v}</span>
              <input autoFocus value={values[v] ?? ''} onChange={(e) => { setValues({ ...values, [v]: e.target.value }); setError(null) }} className={input} /></label>
          ))}
          {error && <p className="text-xs text-red-300">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setDialog(null)} className={btn.ghost}>Batal</button>
            <button onClick={() => void copy()} className={btn.primary}><Clipboard size={13} /> Salin</button>
          </div>
        </>
      ) : <p className="text-sm text-zinc-500">Snippet tidak ditemukan.</p>}
    </Modal>
  )
}
