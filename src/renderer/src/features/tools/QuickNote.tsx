import { Check, Copy, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { iconBtn } from '@renderer/components/ui'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/**
 * Tool bawaan "Catatan": satu textarea besar yang tersimpan otomatis di app
 * (tabel `quick_notes`). Dipakai di jendela tool maupun slot dock panel bawah.
 */
export default function QuickNote() {
  const [text, setText] = useState('')
  const [ready, setReady] = useState(false)
  const [state, setState] = useState<SaveState>('idle')
  const [savedAt, setSavedAt] = useState('')
  const [copied, setCopied] = useState(false)
  const latest = useRef('')
  const dirty = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let alive = true
    void window.alip.quickNote.get()
      .then((body) => {
        if (!alive) return
        setText(body)
        latest.current = body
        setReady(true)
      })
      .catch(() => {
        if (!alive) return
        setReady(true)
        setState('error')
      })
    return () => { alive = false }
  }, [])

  const flush = async (): Promise<void> => {
    if (!dirty.current) return
    dirty.current = false
    setState('saving')
    try {
      await window.alip.quickNote.save(latest.current)
      setState('saved')
      setSavedAt(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }))
    } catch {
      dirty.current = true
      setState('error')
    }
  }

  // Ketikan yang belum tersimpan disimpan saat panel ditutup / pindah slot.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
    if (dirty.current) void window.alip.quickNote.save(latest.current)
  }, [])

  const change = (v: string): void => {
    setText(v)
    latest.current = v
    dirty.current = true
    setState('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), 700)
  }

  const copy = async (): Promise<void> => {
    await window.alip.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  const clear = (): void => {
    if (!text.trim() || !window.confirm('Kosongkan catatan ini?')) return
    change('')
  }

  return (
    <div className="flex h-full min-h-[140px] flex-col">
      <div className="mb-1.5 flex items-center gap-1">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-zinc-600">Tersimpan otomatis</span>
        <span className="ml-auto truncate font-mono text-[9.5px] text-zinc-600">
          {state === 'saving' ? 'menyimpan…' : state === 'saved' ? `tersimpan ${savedAt}` : state === 'error' ? 'gagal menyimpan' : ''}
        </span>
        <button title={copied ? 'Tersalin' : 'Salin semua'} onClick={() => void copy()} className={iconBtn}>
          {copied ? <Check size={12} className="text-emerald-300" /> : <Copy size={12} />}
        </button>
        <button title="Kosongkan catatan" onClick={clear} className={`${iconBtn} hover:text-red-300`}><Trash2 size={12} /></button>
      </div>
      <textarea
        value={text} disabled={!ready} rows={12} spellCheck={false}
        onChange={(e) => change(e.target.value)} onBlur={() => void flush()}
        placeholder="Ketik bebas: daftar tugas, ide, nomor tiket, langkah berikutnya…"
        className="min-h-0 w-full flex-1 resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-[13px] leading-relaxed text-zinc-200 outline-none transition placeholder:text-zinc-600 focus:border-accent-400/50 focus:bg-white/[0.05]"
      />
    </div>
  )
}
