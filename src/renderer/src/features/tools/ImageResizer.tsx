import { FolderOpen, Image as ImageIcon, Play, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { btn, iconBtn, input } from '@renderer/components/ui'
import { useData } from '@renderer/store/data'
import { useTools } from '@renderer/store/tools'
import { useUi } from '@renderer/store/ui'

type LoadedImage = { name: string; path: string; dataUrl: string; width: number; height: number }

const PRESETS = [64, 128, 256, 512]

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Gambar tidak bisa dibaca'))
    img.src = src
  })
}

/** Tool bawaan: resize banyak gambar dengan kanvas (PNG/JPG/WebP), lalu salin hasil ke folder pilihan. */
export default function ImageResizer() {
  const { attachOutputs } = useTools()
  const selectedId = useData((s) => s.selectedId)
  const setNotice = useUi((s) => s.setNotice)
  const [images, setImages] = useState<{ path: string; data: LoadedImage }[]>([])
  const [preset, setPreset] = useState('256')
  const [width, setWidth] = useState(256)
  const [height, setHeight] = useState(0)
  const [format, setFormat] = useState<'png' | 'jpg' | 'webp'>('png')
  const [keepRatio, setKeepRatio] = useState(true)
  const [outputDir, setOutputDir] = useState('')
  const [attaching, setAttaching] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string[]>([])

  const pickImages = async (): Promise<void> => {
    const files = await window.alip.launcher.pickMany('file')
    if (!files.length) return
    const loaded = await window.alip.tools.readImages(files)
    setImages((prev) => [...prev, ...loaded.map((d) => ({ path: d.path, data: d }))])
    setDone([])
    if (!outputDir && files[0]) setOutputDir(files[0].replace(/[\\/][^\\/]+$/, ''))
  }
  const pickOut = async (): Promise<void> => { const p = await window.alip.launcher.pick('folder'); if (p) setOutputDir(p) }

  const applyPreset = (v: string): void => {
    setPreset(v)
    if (v !== 'kustom') { const n = Number(v); setWidth(n); setHeight(0) }
  }

  const run = async (): Promise<void> => {
    if (!images.length || !outputDir.trim() || busy) return
    setBusy(true)
    try {
      const items: { path: string; dataUrl: string }[] = []
      for (const { path, data } of images) {
        const img = await loadImage(data.dataUrl)
        let tw = Math.max(1, Math.round(width || img.width))
        let th = Math.max(1, Math.round(height || (keepRatio ? (img.height * tw) / img.width : img.height)))
        if (keepRatio) {
          const scale = Math.min(tw / img.width, th / img.height)
          tw = Math.max(1, Math.round(img.width * scale))
          th = Math.max(1, Math.round(img.height * scale))
        }
        const canvas = document.createElement('canvas')
        canvas.width = tw
        canvas.height = th
        const ctx = canvas.getContext('2d')
        if (!ctx) continue
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, tw, th)
        const mime = format === 'jpg' ? 'image/jpeg' : `image/${format}`
        const base = data.name.replace(/\.[^.]+$/, '')
        const ext = format === 'jpg' ? 'jpg' : format
        items.push({ path: `${outputDir.replace(/[\\/]+$/, '')}\\${base}-${tw}x${th}.${ext}`, dataUrl: canvas.toDataURL(mime, 0.92) })
      }
      const res = await window.alip.tools.writeFiles(items)
      setDone(res.outputs)
      if (res.ok) {
        setNotice({ kind: 'ok', text: `${res.outputs.length} gambar disimpan ke ${outputDir}.` })
        if (attaching && selectedId && res.outputs.length) await attachOutputs(selectedId, 'image-resizer', res.outputs)
      } else setNotice({ kind: 'error', text: res.message ?? 'Gagal menulis hasil.' })
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : String(e) })
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button data-testid="imgr-pick" onClick={() => void pickImages()} className={btn.primary}><ImageIcon size={13} /> Pilih gambar</button>
        <span className="font-mono text-[10.5px] text-zinc-500">{images.length} gambar</span>
        {images.length > 0 && <button onClick={() => { setImages([]); setDone([]) }} className={btn.ghost}><Trash2 size={12} /> Kosongkan</button>}
      </div>

      {images.length > 0 && (
        <div className="flex max-h-[120px] flex-wrap gap-1.5 overflow-y-auto">
          {images.map((im) => (
            <div key={im.path} className="relative">
              <img src={im.data.dataUrl} alt={im.data.name} className="h-14 w-14 rounded-lg border border-white/10 object-cover" />
              <button title="Buang" onClick={() => setImages(images.filter((x) => x.path !== im.path))} className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-black/80 text-zinc-300"><X size={9} /></button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <label><span className="ds-label mb-1 block">Ukuran</span>
          <select value={preset} onChange={(e) => applyPreset(e.target.value)} className={input}>
            {PRESETS.map((p) => <option key={p} value={String(p)}>{p} px</option>)}
            <option value="kustom">Kustom</option>
          </select></label>
        <label><span className="ds-label mb-1 block">Format</span>
          <select value={format} onChange={(e) => setFormat(e.target.value as 'png' | 'jpg' | 'webp')} className={input}>
            <option value="png">PNG</option><option value="jpg">JPG</option><option value="webp">WebP</option>
          </select></label>
        <label><span className="ds-label mb-1 block">Lebar (px)</span>
          <input type="number" min={1} max={8000} value={width} onChange={(e) => { setWidth(Number(e.target.value)); setPreset('kustom') }} className={input} /></label>
        <label><span className="ds-label mb-1 block">Tinggi (px, 0 = otomatis)</span>
          <input type="number" min={0} max={8000} value={height} onChange={(e) => setHeight(Number(e.target.value))} className={input} /></label>
      </div>
      <label className="flex items-center gap-2 text-[12.5px] text-zinc-400">
        <input type="checkbox" checked={keepRatio} onChange={(e) => setKeepRatio(e.target.checked)} className="h-4 w-4 accent-emerald-400" /> Jaga rasio gambar
      </label>
      <div className="flex gap-2">
        <input value={outputDir} onChange={(e) => setOutputDir(e.target.value)} placeholder="Folder keluaran" className={`${input} min-w-0 flex-1`} />
        <button onClick={() => void pickOut()} className={btn.ghost}><FolderOpen size={13} /> Folder…</button>
      </div>
      {selectedId && (
        <label className="flex items-center gap-2 text-[12.5px] text-zinc-400">
          <input type="checkbox" checked={attaching} onChange={(e) => setAttaching(e.target.checked)} className="h-4 w-4 accent-emerald-400" /> Lampirkan hasil ke task yang dipilih
        </label>
      )}
      <button data-testid="imgr-run" disabled={!images.length || !outputDir.trim() || busy} onClick={() => void run()} className={btn.primary}><Play size={13} /> {busy ? 'Memproses…' : 'Resize & simpan'}</button>
      {done.length > 0 && (
        <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.06] px-3 py-2 text-[11.5px] text-emerald-200">
          {done.map((d) => <button key={d} onClick={() => void window.alip.tools.openPath(d)} className="block max-w-full truncate text-left underline decoration-white/20 hover:text-white">{d}</button>)}
        </div>
      )}
      <p className="text-[11px] leading-relaxed text-zinc-600">Gambar diproses di dalam app tanpa internet. Format WebP memakai encoder bawaan Chromium.</p>
    </div>
  )
}
