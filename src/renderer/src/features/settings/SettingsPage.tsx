import { useEffect, useState } from 'react'
import type { ShortcutStatus } from '@shared/api'
import { SETTINGS_SECTIONS, type FieldDef, type SectionDef } from '@shared/settings-ui'
import { btn, input } from '@renderer/components/ui'
import { useSettings } from '@renderer/store/settings'
import { useUi } from '@renderer/store/ui'
import CustomAppsEditor from './CustomAppsEditor'
import ServicesEditor from './ServicesEditor'
import SpreadsheetEditor from './SpreadsheetEditor'
import ToolsEditor from './ToolsEditor'
import ViewsMonitor from './ViewsMonitor'

const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

type Draft = Record<string, unknown>

function PathField({ def, value, onChange }: { def: FieldDef; value: string; onChange: (v: string) => void }) {
  const [result, setResult] = useState<{ ok: boolean; message?: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const browse = async (): Promise<void> => {
    const p = await window.alip.launcher.pick('file')
    if (p) { onChange(p); setResult(null) }
  }
  const test = async (): Promise<void> => {
    setBusy(true)
    setResult(await window.alip.launcher.test(def.appKey!, value))
    setBusy(false)
  }
  return (
    <>
      <div className="flex gap-2">
        <input data-testid={`path-${def.key}`} value={value} onChange={(e) => { onChange(e.target.value); setResult(null) }} placeholder={String.raw`C:\...\aplikasi.exe`} className={`${input} flex-1`} />
        <button type="button" onClick={() => void browse()} className={btn.ghost}>Telusuri</button>
        <button type="button" disabled={busy || !value.trim()} onClick={() => void test()} className={btn.ghost}>{def.appKey === 'python' ? 'Tes versi' : 'Tes buka'}</button>
      </div>
      {result && <p className={`mt-1.5 text-xs ${result.ok ? 'text-emerald-300' : 'text-red-300'}`}>{result.message ?? (result.ok ? 'OK' : 'Gagal')}</p>}
    </>
  )
}

function Field({ def, value, onChange }: { def: FieldDef; value: unknown; onChange: (v: unknown) => void }) {
  const days = Array.isArray(value) ? (value as number[]) : []
  return (
    <div className="py-3">
      <label className="ds-label mb-1.5 block">{def.label}</label>
      {def.type === 'number' && (
        <div className="flex items-center gap-2">
          <input
            type="number" className={`${input} w-28`} min={def.min} max={def.max} step={def.step ?? 1}
            value={Number.isFinite(value as number) ? (value as number) : ''}
            onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))}
          />
          {def.unit && <span className="text-sm text-zinc-500">{def.unit}</span>}
        </div>
      )}
      {def.type === 'path' && <PathField def={def} value={String(value ?? '')} onChange={onChange} />}
      {def.type === 'text' && (
        <input type="text" className={`${input} w-64`} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
      )}
      {def.type === 'time' && (
        <input type="time" className={`${input} w-32`} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
      )}
      {def.type === 'bool' && (
        <button
          type="button" onClick={() => onChange(!value)}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
            value === true ? 'border-emerald-400/30 bg-emerald-400/[0.12] text-emerald-200' : 'border-white/10 bg-white/[0.05] text-zinc-400 hover:bg-white/[0.09]'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${value === true ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
          {value === true ? 'Aktif' : 'Mati'}
        </button>
      )}
      {def.type === 'days' && (
        <div className="flex gap-1.5">
          {DAY_ORDER.map((d) => {
            const on = days.includes(d)
            return (
              <button
                key={d} type="button"
                onClick={() => onChange(on ? days.filter((x) => x !== d) : [...days, d].sort((a, b) => a - b))}
                className={`rounded-full px-3 py-1.5 text-[13px] transition ${on ? 'border border-accent-400/45 bg-accent-500/[0.18] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_10px_24px_-18px_rgba(176,82,42,0.5)]' : 'border border-white/10 bg-white/[0.05] text-zinc-400 hover:bg-white/[0.09] hover:text-zinc-200'}`}
              >
                {DAY_LABELS[d]}
              </button>
            )
          })}
        </div>
      )}
      {def.hint && <p className="mt-1.5 max-w-lg text-xs leading-relaxed text-zinc-500">{def.hint}</p>}
    </div>
  )
}

function SectionForm({ section }: { section: SectionDef }) {
  const { settings, save } = useSettings()
  const key = section.settingsKey!
  const [draft, setDraft] = useState<Draft>(settings[key] as Draft)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setDraft(settings[key] as Draft)
    setError(null)
    setSaved(false)
  }, [key, settings])

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings[key])
  const [shortcut, setShortcut] = useState<ShortcutStatus | null>(null)
  useEffect(() => {
    if (section.id !== 'shortcuts') return
    let alive = true
    void window.alip.shortcuts.status().then((s) => { if (alive) setShortcut(s) })
    return () => { alive = false }
  }, [section.id])
  const onSave = async (): Promise<void> => {
    const err = await save(key, draft)
    setError(err)
    setSaved(!err)
    if (!err && section.id === 'shortcuts') setShortcut(await window.alip.shortcuts.status())
  }

  const [detectMsg, setDetectMsg] = useState<string | null>(null)
  const detect = async (): Promise<void> => {
    const found = await window.alip.launcher.detect()
    const keys = Object.keys(found).filter((k) => !String((draft as Record<string, unknown>)[k] ?? '').trim())
    setDraft({ ...draft, ...Object.fromEntries(keys.map((k) => [k, found[k as keyof typeof found]])) })
    setDetectMsg(keys.length ? `Terisi otomatis: ${keys.join(', ')}. Periksa lalu Simpan.` : 'Tidak ada lokasi baru yang ditemukan. Isi manual dengan Telusuri.')
    setSaved(false)
  }

  return (
    <div className={section.id === 'paths' ? 'max-w-2xl' : 'max-w-xl'}>
      {section.id === 'paths' && (
        <div className="mb-3 flex items-center gap-3">
          <button type="button" data-testid="btn-detect" onClick={() => void detect()} className={btn.ghost}>Deteksi otomatis</button>
          {detectMsg && <span className="text-xs text-zinc-500">{detectMsg}</span>}
        </div>
      )}
      <div className="divide-y divide-white/[0.06]">
        {section.fields!.map((f) => (
          <Field key={f.key} def={f} value={draft[f.key]} onChange={(v) => { setDraft({ ...draft, [f.key]: v }); setSaved(false) }} />
        ))}
      </div>
      {section.id === 'shortcuts' && shortcut && (
        <div data-testid="shortcut-status" className="mt-3 space-y-1 text-xs">
          <p className={shortcut.registered ? 'text-emerald-300' : 'text-amber-300'}>
            {shortcut.registered
              ? `Pintasan aktif: ${shortcut.accelerator}`
              : `Belum aktif (${shortcut.accelerator || '—'}): ${shortcut.error ?? 'tidak diketahui'}`}
          </p>
          {shortcut.screenshot && (
            <p className={shortcut.screenshot.registered ? 'text-emerald-300' : 'text-amber-300'}>
              {shortcut.screenshot.registered
                ? `Screenshot Editor aktif: ${shortcut.screenshot.accelerator}`
                : `Screenshot Editor belum aktif: ${shortcut.screenshot.error ?? 'tidak diketahui'}`}
            </p>
          )}
        </div>
      )}
      {error && <p className="mt-3 rounded-2xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
      <div className="mt-5 flex items-center gap-3">
        <button onClick={onSave} disabled={!dirty} className={btn.primary}>Simpan</button>
        {saved && !dirty && <span className="text-sm text-emerald-300">Tersimpan</span>}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const { settingsSection, setSettingsSection } = useUi()
  const load = useSettings((s) => s.load)
  const loaded = useSettings((s) => s.loaded)
  const [version, setVersion] = useState<string | null>(null)
  useEffect(() => { void load() }, [load])
  useEffect(() => { void window.alip.app.info().then((i) => setVersion(i.version)).catch(() => undefined) }, [])

  const section = SETTINGS_SECTIONS.find((s) => s.id === settingsSection) ?? SETTINGS_SECTIONS[0]

  return (
    <>
      <section className="glass-panel w-[300px] shrink-0 overflow-y-auto rounded-2xl p-2.5">
        <h2 className="px-2.5 pb-1 pt-2 font-display text-[17px] font-semibold text-zinc-50">Pengaturan</h2>
        <div className="mt-1 space-y-0.5">
          {SETTINGS_SECTIONS.map((s) => (
            <button
              key={s.id} data-testid={`settings-sec-${s.id}`} onClick={() => setSettingsSection(s.id)}
              className={`flex w-full items-center justify-between rounded-full px-3 py-2 text-left text-[13px] transition ${
                s.id === section.id ? 'bg-accent-500/[0.15] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]' : 'text-zinc-400 hover:bg-accent-500/[0.07] hover:text-zinc-100'
              }`}
            >
              <span>{s.title}</span>
              {!s.ready && <span className="rounded-full border border-white/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-500">Fase {s.phase}</span>}
            </button>
          ))}
        </div>
      </section>
      <section className="min-w-0 flex-1 overflow-y-auto rounded-2xl px-7 py-6">
        <h1 className="font-display text-[22px] font-semibold tracking-tight text-zinc-50">{section.title}</h1>
        <p className="mb-6 mt-1 max-w-xl text-[13px] leading-relaxed text-zinc-500">{section.description}</p>
        {section.id === 'services' ? (
          <ServicesEditor />
        ) : section.id === 'tools' ? (
          <ToolsEditor />
        ) : section.id === 'spreadsheet' ? (
          <SpreadsheetEditor />
        ) : section.ready && loaded ? (
          <>
            <SectionForm key={section.id} section={section} />
            {section.id === 'paths' && <CustomAppsEditor />}
            {section.id === 'performance' && <ViewsMonitor />}
          </>
        ) : !section.ready ? (
          <div className="max-w-md rounded-2xl border border-dashed border-white/10 p-6 text-sm text-zinc-500">
            Seksi ini aktif di Fase {section.phase}. Mesin pengaturan sudah siap, tinggal menambahkan isinya.
          </div>
        ) : null}

        <div className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] pt-4">
          <span className="ds-label">TN-Workspace{version ? ` v${version}` : ''}</span>
          <span className="ds-label" title="Atribusi pembuat aplikasi">Dibuat oleh TransformNusa — Alip T. S.</span>
        </div>
      </section>
    </>
  )
}
