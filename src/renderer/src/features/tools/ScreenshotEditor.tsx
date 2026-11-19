import { Clipboard, RotateCcw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { btn, input } from '@renderer/components/ui'
import { useUi } from '@renderer/store/ui'

type Shape = { type: 'arrow' | 'rect' | 'circle' | 'text' | 'blur'; x1: number; y1: number; x2: number; y2: number; text?: string }
const TOOLS: { id: Shape['type']; label: string }[] = [
  { id: 'arrow', label: 'Panah' }, { id: 'rect', label: 'Kotak' }, { id: 'circle', label: 'Lingkaran' },
  { id: 'text', label: 'Teks' }, { id: 'blur', label: 'Blur' }
]

/** Screenshot Editor bawaan: anotasi di kanvas, salin PNG ke clipboard. */
export default function ScreenshotEditor() {
  const setNotice = useUi((s) => s.setNotice)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [hasImage, setHasImage] = useState(false)
  const [shapes, setShapes] = useState<Shape[]>([])
  const [tool, setTool] = useState<Shape['type']>('arrow')
  const [color, setColor] = useState('#ef4444')
  const [text, setText] = useState('Teks')
  const drag = useRef<{ x: number; y: number } | null>(null)

  const loadClipboard = useCallback(async (): Promise<void> => {
    const dataUrl = await window.alip.clipboard.readImage()
    if (!dataUrl) { setNotice({ kind: 'error', text: 'Clipboard tidak berisi gambar. Salin screenshot dulu (Win+Shift+S).' }); return }
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      const canvas = canvasRef.current
      if (canvas) { canvas.width = img.width; canvas.height = img.height }
      setHasImage(true)
      setShapes([])
    }
    img.src = dataUrl
  }, [setNotice])

  useEffect(() => { void loadClipboard() }, [loadClipboard])

  useEffect(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img || !hasImage) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const lw = Math.max(2, Math.round(canvas.width / 320))
    for (const s of shapes) {
      const x = Math.min(s.x1, s.x2); const y = Math.min(s.y1, s.y2)
      const w = Math.abs(s.x2 - s.x1); const h = Math.abs(s.y2 - s.y1)
      ctx.save()
      ctx.strokeStyle = color
      ctx.fillStyle = color
      ctx.lineWidth = lw
      ctx.lineCap = 'round'
      if (s.type === 'rect') ctx.strokeRect(x, y, w, h)
      else if (s.type === 'circle') { ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, Math.max(1, w / 2), Math.max(1, h / 2), 0, 0, Math.PI * 2); ctx.stroke() }
      else if (s.type === 'text') { ctx.font = `${Math.max(14, Math.round(canvas.width / 42))}px "DM Sans", sans-serif`; ctx.fillText(s.text ?? '', s.x1, s.y1) }
      else if (s.type === 'blur') {
        ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip()
        ctx.filter = 'blur(12px)'; ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      } else {
        ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke()
        const angle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1)
        const head = Math.max(10, lw * 5)
        ctx.beginPath(); ctx.moveTo(s.x2, s.y2)
        ctx.lineTo(s.x2 - head * Math.cos(angle - Math.PI / 6), s.y2 - head * Math.sin(angle - Math.PI / 6))
        ctx.lineTo(s.x2 - head * Math.cos(angle + Math.PI / 6), s.y2 - head * Math.sin(angle + Math.PI / 6))
        ctx.closePath(); ctx.fill()
      }
      ctx.restore()
    }
  }, [shapes, hasImage, color])

  const point = (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = e.currentTarget
    const rect = canvas.getBoundingClientRect()
    return { x: (e.clientX - rect.left) * (canvas.width / rect.width), y: (e.clientY - rect.top) * (canvas.height / rect.height) }
  }
  const down = (e: React.MouseEvent<HTMLCanvasElement>): void => { drag.current = point(e) }
  const up = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    const start = drag.current
    drag.current = null
    if (!start) return
    const p = point(e)
    if (tool === 'text') { setShapes([...shapes, { type: 'text', x1: p.x, y1: p.y, x2: p.x, y2: p.y, text }]); return }
    if (Math.abs(p.x - start.x) < 3 && Math.abs(p.y - start.y) < 3) return
    setShapes([...shapes, { type: tool, x1: start.x, y1: start.y, x2: p.x, y2: p.y }])
  }

  const copy = async (): Promise<void> => {
    const canvas = canvasRef.current
    if (!canvas || !hasImage) return
    await window.alip.clipboard.writeImage(canvas.toDataURL('image/png'))
    setNotice({ kind: 'ok', text: 'Hasil anotasi disalin ke clipboard. Tempel di chat klien.' })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {TOOLS.map((t) => (
          <button key={t.id} onClick={() => setTool(t.id)} className={`rounded-full px-2.5 py-1 text-[11.5px] transition ${tool === t.id ? 'border border-accent-400/45 bg-accent-500/[0.18] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]' : 'border border-white/10 bg-white/[0.05] text-zinc-400 hover:text-zinc-200'}`}>{t.label}</button>
        ))}
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} title="Warna anotasi" className="h-7 w-8 rounded-lg border border-white/10 bg-transparent" />
        {tool === 'text' && <input value={text} onChange={(e) => setText(e.target.value)} className={`${input} w-32`} placeholder="Teks" />}
        <button onClick={() => setShapes(shapes.slice(0, -1))} disabled={!shapes.length} className={`${btn.ghost} px-2 py-1 text-[11.5px]`}><RotateCcw size={11} /> Undo</button>
        <button onClick={() => setShapes([])} disabled={!shapes.length} className={`${btn.ghost} px-2 py-1 text-[11.5px]`}><Trash2 size={11} /> Hapus</button>
        <button onClick={() => void loadClipboard()} className={`${btn.ghost} px-2 py-1 text-[11.5px]`}>Muat clipboard</button>
      </div>

      {hasImage ? (
        <div className="max-h-[440px] overflow-auto rounded-xl border border-white/[0.08] bg-black/30 p-2">
          <canvas data-testid="screenshot-canvas" ref={canvasRef} onMouseDown={down} onMouseUp={up} className="mx-auto max-h-[420px] max-w-full cursor-crosshair rounded-lg" />
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-zinc-500">
          Belum ada gambar. Tekan Win+Shift+S untuk screenshot, lalu buka tool ini lagi.
        </div>
      )}

      <div className="flex items-center gap-2">
        <button data-testid="screenshot-copy" onClick={() => void copy()} disabled={!hasImage} className={btn.primary}><Clipboard size={13} /> Salin ke clipboard</button>
        <span className="text-[11px] text-zinc-600">{shapes.length} anotasi</span>
      </div>
    </div>
  )
}
