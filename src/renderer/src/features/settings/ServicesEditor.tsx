import { ExternalLink, Info, Plus, SquareArrowOutUpRight, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PROFILE_SERVICES, SERVICE_LABEL, type ProfileRow, type ProfileService } from '@shared/data'
import { btn, input } from '@renderer/components/ui'
import { useUi } from '@renderer/store/ui'
import { useWeb } from '@renderer/store/web'

type Draft = { name: string; service: ProfileService; groupName: string; homeUrl: string; keepAlive: boolean; nativeOnly: boolean; nativePath: string; external: boolean }
const toDraft = (p: ProfileRow): Draft => ({ name: p.name, service: p.service, groupName: p.groupName, homeUrl: p.homeUrl ?? '', keepAlive: p.keepAlive, nativeOnly: p.nativeOnly, nativePath: p.nativePath ?? '', external: p.external })
const clean = (e: unknown): string => (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

function ProfileCard({ profile, groups }: { profile: ProfileRow; groups: string[] }) {
  const load = useWeb((s) => s.loadProfiles)
  const setNotice = useUi((s) => s.setNotice)
  const [d, setD] = useState<Draft>(toDraft(profile))
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [confirm, setConfirm] = useState(false)
  useEffect(() => setD(toDraft(profile)), [profile])
  const dirty = JSON.stringify(d) !== JSON.stringify(toDraft(profile))
  const set = <K extends keyof Draft>(k: K, v: Draft[K]): void => { setD({ ...d, [k]: v }); setMsg(null) }

  const save = async (): Promise<void> => {
    try { await window.alip.profiles.update(profile.id, d); await load(); setMsg({ ok: true, text: 'Tersimpan' }) } catch (e) { setMsg({ ok: false, text: clean(e) }) }
  }
  const remove = async (): Promise<void> => {
    try { await window.alip.profiles.remove(profile.id); await load() } catch (e) { setMsg({ ok: false, text: clean(e) }) }
  }
  const browse = async (): Promise<void> => { const p = await window.alip.launcher.pick('file'); if (p) set('nativePath', p) }
  const openBrowser = async (): Promise<void> => {
    const res = await window.alip.profiles.openInBrowser(profile.id)
    setNotice({ kind: res.ok ? 'ok' : 'error', text: res.message ?? (res.ok ? 'Dibuka di browser.' : 'Gagal membuka browser.') })
  }
  const openExternal = async (): Promise<void> => {
    const res = await window.alip.profiles.openExternal(profile.id)
    setNotice({ kind: res.ok ? 'ok' : 'error', text: res.message ?? (res.ok ? 'Dibuka di browser bawaan.' : 'Gagal membuka browser.') })
  }

  return (
    <div data-testid="profile-card" className="glass rounded-2xl p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_170px_150px]">
        <label className="block"><span className="ds-label mb-1 block">Nama</span><input value={d.name} onChange={(e) => set('name', e.target.value)} className={input} /></label>
        <label className="block"><span className="ds-label mb-1 block">Jenis</span>
          <select value={d.service} onChange={(e) => set('service', e.target.value as ProfileService)} className={input}>
            {PROFILE_SERVICES.map((s) => <option key={s} value={s}>{SERVICE_LABEL[s]}</option>)}
          </select></label>
        <label className="block" title="Kelompok di sidebar. Kosong = otomatis (Core untuk WhatsApp/Telegram/Sunfish, Web untuk lainnya)">
          <span className="ds-label mb-1 block">Grup</span>
          <input data-testid="profile-group" value={d.groupName} onChange={(e) => set('groupName', e.target.value)} list="profile-groups" placeholder="Core / Web / …" className={input} />
        </label>
      </div>
      <label className="mt-3 block"><span className="ds-label mb-1 block">URL awal</span>
        <input value={d.homeUrl} onChange={(e) => set('homeUrl', e.target.value)} placeholder="https://…  (kosong = belum diatur)" className={input} /></label>
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-zinc-300">
        <label className="flex items-center gap-2" title="Klik layanan ini langsung membuka browser bawaan (satu tab, paling ringan)">
          <input data-testid="profile-external" type="checkbox" checked={d.external} onChange={(e) => set('external', e.target.checked)} className="h-4 w-4 accent-accent-400" /> Buka di browser luar (ringan)
        </label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={d.keepAlive} onChange={(e) => set('keepAlive', e.target.checked)} className="h-4 w-4 accent-accent-400" /> Jaga hidup (tidak dihibernasi otomatis)</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={d.nativeOnly} onChange={(e) => set('nativeOnly', e.target.checked)} className="h-4 w-4 accent-accent-400" /> Hanya luncurkan app native</label>
      </div>
      {d.external && !d.nativeOnly && (
        <p className="mt-2 text-[11.5px] leading-relaxed text-zinc-500">
          Klik layanan ini membuka <span className="text-zinc-300">satu tab di browser bawaan</span>, bukan panel di dalam app — pilihan tepat untuk layanan yang login-nya lewat Google.
        </p>
      )}
      {d.nativeOnly && (
        <div className="mt-3 flex gap-2">
          <input value={d.nativePath} onChange={(e) => set('nativePath', e.target.value)} placeholder={String.raw`C:\...\Telegram.exe`} className={input} />
          <button onClick={() => void browse()} className={`${btn.ghost} shrink-0`}>Telusuri</button>
        </div>
      )}
      {msg && <p className={`mt-3 text-sm ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</p>}
      <div className="mt-4 flex items-center justify-between gap-2">
        {confirm ? (
          <span className="flex items-center gap-2 text-sm"><span className="text-zinc-400">Hapus profil dan data login-nya?</span>
            <button onClick={() => void remove()} className={btn.danger}>Ya, hapus</button><button onClick={() => setConfirm(false)} className={btn.ghost}>Batal</button></span>
        ) : (
          <button title="Hapus profil" onClick={() => setConfirm(true)} className="grid h-8 w-8 place-items-center rounded-full text-zinc-600 transition hover:bg-red-500/10 hover:text-red-300"><Trash2 size={14} /></button>
        )}
        <div className="flex items-center gap-2">
          <button title="Buka di browser bawaan: satu tab, paling ringan, biasanya sudah dalam keadaan login" onClick={() => void openExternal()} className={btn.ghost}><ExternalLink size={13} /> Buka di browser</button>
          <button title="Jendela Chrome terpisah dengan profil khusus app (lebih berat, sesi terpisah)" onClick={() => void openBrowser()} className={btn.ghost}><SquareArrowOutUpRight size={13} /> Jendela Chrome</button>
          <button onClick={() => void save()} disabled={!dirty} className={btn.primary}>Simpan</button>
        </div>
      </div>
    </div>
  )
}

export default function ServicesEditor() {
  const { profiles, loadProfiles } = useWeb()
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { void loadProfiles() }, [loadProfiles])
  const groups = [...new Set(profiles.map((p) => p.groupName).filter(Boolean))]
  const add = async (): Promise<void> => {
    try {
      await window.alip.profiles.create({ name: 'Profil baru', service: 'generic', groupName: '', homeUrl: '', keepAlive: false, nativeOnly: false, nativePath: '' })
      await loadProfiles()
    } catch (e) { setErr(clean(e)) }
  }
  return (
    <div className="max-w-2xl space-y-3">
      <p className="text-[13px] leading-relaxed text-zinc-500">
        Tiap profil punya sesi login sendiri, jadi beberapa akun (mis. akun Kiro A/B/C) tidak bercampur dan tidak perlu logout-login.
        Isi URL Sunfish, tiket, dan Zimbra milikmu di sini.
      </p>
      <p className="text-[12.5px] leading-relaxed text-zinc-500">
        <span className="text-zinc-300">Grup</span> menentukan kelompok layanan di sidebar (mis. <span className="text-zinc-300">Core</span>, <span className="text-zinc-300">Web</span>).
        Kosongkan untuk otomatis: layanan inti (WhatsApp, Telegram, Sunfish) masuk <span className="text-zinc-300">Core</span>, sisanya <span className="text-zinc-300">Web</span>.
      </p>
      <datalist id="profile-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>

      <div className="rounded-2xl border border-accent-400/20 bg-accent-400/[0.06] px-4 py-3">
        <div className="flex items-center gap-1.5 font-display text-[12px] font-semibold uppercase tracking-[0.12em] text-accent-200"><Info size={13} /> Google &amp; passkey</div>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-400">
          Google menolak login dari browser di dalam aplikasi (pesan “browser atau aplikasi ini mungkin tidak aman”).
          Paling ringan: tombol <span className="text-zinc-200">Buka di browser</span> — satu tab di browser bawaan,
          tanpa instance browser baru; kalau browser itu sudah login Google, situs langsung terbuka dalam keadaan login.
          Butuh sesi terpisah? Pakai <span className="text-zinc-200">Jendela Chrome</span> (profil khusus app, lebih berat).
        </p>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-500">
          Dialog Windows Security <span className="text-zinc-300">“Sign in with a passkey / masukkan security key”</span> juga berasal dari permintaan passkey situs.
          Tekan Esc atau Cancel, lalu pilih “Coba cara lain” untuk masuk dengan sandi.
        </p>
      </div>

      {profiles.map((p) => <ProfileCard key={p.id} profile={p} groups={groups} />)}
      {err && <p className="text-sm text-red-300">{err}</p>}
      <button data-testid="btn-add-profile" onClick={() => void add()} className={btn.ghost}><Plus size={14} /> Tambah profil</button>
    </div>
  )
}
