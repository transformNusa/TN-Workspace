import { useEffect, useState } from 'react'
import { SPREADSHEET_LABEL, SPREADSHEET_MODES, type SpreadsheetMode } from '@shared/tools'
import type { ProfileRow } from '@shared/data'
import { btn, input } from '@renderer/components/ui'
import { useSettings } from '@renderer/store/settings'

/** Pengaturan → Spreadsheet: GridCraft (default), launcher Excel, atau profil web. */
export default function SpreadsheetEditor() {
  const { settings, save } = useSettings()
  const [mode, setMode] = useState<SpreadsheetMode>(settings.spreadsheet.mode)
  const [profileId, setProfileId] = useState(settings.spreadsheet.profileId ?? '')
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => { void window.alip.profiles.list().then(setProfiles) }, [])
  useEffect(() => { setMode(settings.spreadsheet.mode); setProfileId(settings.spreadsheet.profileId ?? '') }, [settings.spreadsheet])

  const saveIt = async (): Promise<void> => {
    const err = await save('spreadsheet', { mode, profileId: mode === 'web' ? profileId || null : null })
    setMsg(err ? { ok: false, text: err } : { ok: true, text: 'Tersimpan' })
  }

  return (
    <div className="max-w-xl">
      <div className="space-y-2">
        {SPREADSHEET_MODES.map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${mode === m ? 'border-white/20 bg-white/[0.08]' : 'border-white/10 bg-white/[0.035] hover:bg-white/[0.06]'}`}>
            <span className="text-[13px] text-zinc-100">{SPREADSHEET_LABEL[m]}</span>
            <span className={`h-2 w-2 rounded-full ${mode === m ? 'bg-emerald-400' : 'bg-zinc-700'}`} />
          </button>
        ))}
      </div>
      {mode === 'web' && (
        <label className="mt-3 block"><span className="ds-label mb-1 block">Profil web</span>
          <select value={profileId} onChange={(e) => setProfileId(e.target.value)} className={input}>
            <option value="">Pilih profil…</option>
            {profiles.filter((p) => !p.nativeOnly && p.homeUrl).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></label>
      )}
      <p className="mt-3 text-[12px] leading-relaxed text-zinc-500">
        File .xlsx/.xls/.csv dari task dibuka lewat pilihan ini. GridCraft dan Excel path-nya diatur di <span className="text-zinc-300">Aplikasi &amp; Path</span>.
      </p>
      {msg && <p className={`mt-3 text-sm ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</p>}
      <button onClick={() => void saveIt()} className={`${btn.primary} mt-4`}>Simpan</button>
    </div>
  )
}
