import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { btn, input } from '@renderer/components/ui'
import { useSettings } from '@renderer/store/settings'

type App = { id: string; name: string; path: string; args: string }
const newId = (): string => Math.random().toString(36).slice(2, 10)

function AppRow({ app, onChange, onRemove }: { app: App; onChange: (a: App) => void; onRemove: () => void }) {
  const [result, setResult] = useState<{ ok: boolean; message?: string } | null>(null)
  const browse = async (): Promise<void> => { const p = await window.alip.launcher.pick('file'); if (p) { onChange({ ...app, path: p }); setResult(null) } }
  const test = async (): Promise<void> => setResult(await window.alip.launcher.test(app.id, app.path))
  return (
    <div data-testid="custom-app" className="glass rounded-2xl p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[180px_1fr]">
        <label className="block"><span className="ds-label mb-1 block">Nama</span><input data-testid="custom-name" value={app.name} onChange={(e) => onChange({ ...app, name: e.target.value })} placeholder="mis. Box" className={input} /></label>
        <label className="block"><span className="ds-label mb-1 block">Lokasi .exe</span>
          <div className="flex gap-2">
            <input data-testid="custom-path" value={app.path} onChange={(e) => { onChange({ ...app, path: e.target.value }); setResult(null) }} placeholder={String.raw`C:\Aplikasi\contoh.exe`} className={input} />
            <button type="button" onClick={() => void browse()} className={`${btn.ghost} shrink-0`}>Telusuri</button>
            <button type="button" disabled={!app.path.trim()} onClick={() => void test()} className={`${btn.ghost} shrink-0`}>Tes buka</button>
          </div></label>
      </div>
      <label className="mt-3 block"><span className="ds-label mb-1 block">Argumen (opsional)</span>
        <input value={app.args} onChange={(e) => onChange({ ...app, args: e.target.value })} placeholder={'{target}'} className={input} /></label>
      <p className="mt-2 max-w-xl text-[11.5px] leading-relaxed text-zinc-500">{'{target}'} diganti folder/file resource. Gunakan tanda kutip untuk nilai yang berspasi, mis. <code className="text-zinc-400">--open "{'{target}'}"</code>. Tanpa target, bagian itu dilewati.</p>
      {result && <p className={`mt-2 text-xs ${result.ok ? 'text-emerald-400' : 'text-red-300'}`}>{result.message}</p>}
      <div className="mt-3 flex justify-end"><button title="Hapus aplikasi" onClick={onRemove} className="grid h-8 w-8 place-items-center rounded-full text-zinc-600 transition hover:bg-red-500/10 hover:text-red-300"><Trash2 size={14} /></button></div>
    </div>
  )
}

/** Daftar aplikasi .exe pribadi (mis. box.exe) yang bisa dipilih pada resource Aplikasi. */
export default function CustomAppsEditor() {
  const { settings, save } = useSettings()
  const [apps, setApps] = useState<App[]>(settings.launchers.apps)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  useEffect(() => setApps(settings.launchers.apps), [settings.launchers.apps])
  const dirty = JSON.stringify(apps) !== JSON.stringify(settings.launchers.apps)
  const onSave = async (): Promise<void> => {
    const err = await save('launchers', { apps })
    setMsg(err ? { ok: false, text: err } : { ok: true, text: 'Tersimpan' })
  }
  return (
    <div data-testid="custom-apps" className="mt-10 max-w-2xl border-t border-white/[0.06] pt-6">
      <h3 className="font-display text-[15px] font-semibold text-zinc-50">Aplikasi Saya</h3>
      <p className="mb-4 mt-1 max-w-xl text-[12.5px] leading-relaxed text-zinc-500">Daftarkan aplikasi lain milikmu (mis. alat kerja <span className="text-zinc-400">box.exe</span>). Setelah disimpan, aplikasi muncul di pilihan "Buka dengan" saat menambah resource Aplikasi.</p>
      <div className="space-y-3">
        {apps.map((a, i) => <AppRow key={a.id} app={a} onChange={(n) => { setApps(apps.map((x, j) => (j === i ? n : x))); setMsg(null) }} onRemove={() => { setApps(apps.filter((_, j) => j !== i)); setMsg(null) }} />)}
      </div>
      {msg && <p className={`mt-3 text-sm ${msg.ok ? 'text-emerald-400' : 'text-red-300'}`}>{msg.text}</p>}
      <div className="mt-4 flex items-center gap-3">
        <button data-testid="btn-add-custom-app" onClick={() => { setApps([...apps, { id: newId(), name: '', path: '', args: '{target}' }]); setMsg(null) }} className={`${btn.ghost} flex items-center gap-1.5`}><Plus size={14} /> Tambah aplikasi</button>
        <button data-testid="btn-save-custom-apps" onClick={() => void onSave()} disabled={!dirty} className={btn.primary}>Simpan aplikasi</button>
      </div>
    </div>
  )
}
