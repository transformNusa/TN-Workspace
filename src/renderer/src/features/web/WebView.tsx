import { ArrowLeft, ArrowRight, SquareArrowOutUpRight, Code2, ExternalLink, Home, Minus, Plus, RotateCw, ShieldAlert, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ProfileRow, ViewInfo } from '@shared/data'
import { iconBtn } from '@renderer/components/ui'
import { openTask } from '@renderer/lib/actions'
import { useUi, type WebPanel } from '@renderer/store/ui'
import { useWeb } from '@renderer/store/web'

const chip = 'flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 font-mono text-[10px] text-zinc-400 transition hover:bg-white/[0.09] hover:text-zinc-200'

function AddressBar({ profile, info }: { profile: ProfileRow | undefined; info: ViewInfo | undefined }) {
  const [value, setValue] = useState(info?.url ?? profile?.homeUrl ?? '')
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setValue(info?.url ?? profile?.homeUrl ?? '')
  }, [info?.url, profile?.homeUrl])
  if (!profile) return null
  return (
    <input
      data-testid="web-address"
      value={value}
      onFocus={() => { focused.current = true }}
      onBlur={() => { focused.current = false }}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return
        const url = value.trim()
        if (!url) return
        void window.alip.views.navigate(profile.id, url).catch(() => setValue(info?.url ?? profile.homeUrl ?? ''))
      }}
      placeholder={profile.homeUrl ?? 'Ketik alamat lalu Enter'}
      spellCheck={false}
      className="min-w-0 flex-1 rounded-full border border-white/[0.08] bg-black/25 px-3 py-1 font-mono text-[11px] text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-accent-400/60 focus:bg-black/35"
    />
  )
}

function PanelToolbar({ profile, info }: { profile: ProfileRow | undefined; info: ViewInfo | undefined }) {
  const setNotice = useUi((s) => s.setNotice)
  const [zoom, setZoom] = useState(0)
  if (!profile) return null
  const id = profile.id
  const step = (action: 'in' | 'out' | 'reset'): void => {
    setZoom((z) => (action === 'reset' ? 0 : Math.max(-3, Math.min(3, z + (action === 'in' ? 0.5 : -0.5)))))
    void window.alip.views.zoom(id, action)
  }
  const openChrome = async (): Promise<void> => {
    const res = await window.alip.profiles.openInBrowser(id, info?.url ?? undefined)
    setNotice({ kind: res.ok ? 'ok' : 'error', text: res.message ?? (res.ok ? 'Dibuka di Chrome.' : 'Gagal membuka Chrome.') })
  }
  return (
    <div className="flex h-9 shrink-0 items-center gap-1 border-b border-white/[0.07] px-2">
      <button title="Mundur" className={iconBtn} onClick={() => void window.alip.views.back(id)}><ArrowLeft size={14} /></button>
      <button title="Maju" className={iconBtn} onClick={() => void window.alip.views.forward(id)}><ArrowRight size={14} /></button>
      {info?.loading
        ? <button title="Hentikan" className={iconBtn} onClick={() => void window.alip.views.stop(id)}><X size={14} /></button>
        : <button title="Muat ulang" data-testid="web-reload" className={iconBtn} onClick={() => void window.alip.views.reload(id)}><RotateCw size={14} /></button>}
      <button title="Halaman awal layanan" className={iconBtn} disabled={!profile.homeUrl} onClick={() => profile.homeUrl && void window.alip.views.navigate(id, profile.homeUrl)}><Home size={14} /></button>
      <AddressBar profile={profile} info={info} />
      <button title="Perkecil" className={iconBtn} onClick={() => step('out')}><Minus size={14} /></button>
      <button title="Zoom normal" onClick={() => step('reset')} className={chip}>{Math.round(Math.pow(1.2, zoom) * 100)}%</button>
      <button title="Perbesar" className={iconBtn} onClick={() => step('in')}><Plus size={14} /></button>
      <button title="Buka di Chrome (login Google berfungsi di sana)" data-testid="web-chrome" className={iconBtn} onClick={() => void openChrome()}><SquareArrowOutUpRight size={14} /></button>
      <button title="Buka di browser bawaan" className={iconBtn} onClick={() => void window.alip.views.openExternal(id)}><ExternalLink size={14} /></button>
      <button title="Inspector (DevTools)" data-testid="web-devtools" className={iconBtn} onClick={() => void window.alip.views.devtools(id)}><Code2 size={14} /></button>
    </div>
  )
}

function LoginBlocked({ profile, info }: { profile: ProfileRow; info: ViewInfo | undefined }) {
  const setNotice = useUi((s) => s.setNotice)
  // Opsi ringan: satu tab di browser bawaan (biasanya sudah hidup & sudah login Google).
  const openExternal = async (): Promise<void> => {
    const res = await window.alip.profiles.openExternal(profile.id)
    setNotice({ kind: res.ok ? 'ok' : 'error', text: res.message ?? (res.ok ? 'Dibuka di browser.' : 'Gagal membuka browser.') })
  }
  const openChrome = async (): Promise<void> => {
    const res = await window.alip.profiles.openInBrowser(profile.id, info?.url ?? undefined)
    setNotice({ kind: res.ok ? 'ok' : 'error', text: res.message ?? (res.ok ? 'Dibuka di Chrome.' : 'Gagal membuka Chrome.') })
  }
  return (
    <div data-testid="web-login-blocked" className="flex shrink-0 items-center gap-2.5 border-b border-amber-300/25 bg-amber-300/[0.08] px-3 py-2.5 text-[12px] text-amber-100">
      <ShieldAlert size={14} className="shrink-0 text-amber-300" />
      <span className="min-w-0 flex-1 truncate">
        Google menolak login di dalam app. Buka di browser — satu tab, ringan, dan biasanya sudah dalam keadaan login.
      </span>
      <button data-testid="web-open-browser" onClick={() => void openExternal()} className="btn-primary shrink-0 px-2.5 py-1 text-[11.5px]">Buka di browser</button>
      <button onClick={() => void openChrome()} className="shrink-0 rounded-full border border-white/15 px-2.5 py-1 text-[11.5px] text-amber-50/80 transition hover:bg-white/10" title="Jendela Chrome terpisah dengan profil khusus app (lebih berat)">Jendela Chrome</button>
      <button onClick={() => void window.alip.views.reload(profile.id)} className="shrink-0 rounded-full border border-white/15 px-2.5 py-1 text-[11.5px] text-amber-50/80 transition hover:bg-white/10">Coba lagi</button>
    </div>
  )
}

function Panel({
  index, panel, profiles, infos, addTab, closeTab, activateTab, bindRef, fullMode = false, onCloseFull
}: {
  index: number
  panel: WebPanel
  profiles: ProfileRow[]
  infos: ViewInfo[]
  addTab: (panel: number, profileId: string) => void
  closeTab: (panel: number, index: number) => void
  activateTab: (panel: number, index: number) => void
  bindRef: (el: HTMLDivElement | null) => void
  /** Tampilan penuh: satu layanan menutupi layout split yang tersimpan. */
  fullMode?: boolean
  onCloseFull?: () => void
}) {
  const setView = useUi((s) => s.setView)
  const setSettingsSection = useUi((s) => s.setSettingsSection)
  const tabs = panel.tabs.map((id) => profiles.find((p) => p.id === id)).filter((p): p is ProfileRow => !!p)
  const activeProfile = tabs[Math.min(panel.active, tabs.length - 1)]
  const info = activeProfile ? infos.find((i) => i.profileId === activeProfile.id) : undefined
  const addable = profiles.filter((p) => !p.nativeOnly && !panel.tabs.includes(p.id))

  return (
    <div className="flex min-w-0 flex-col" style={{ flex: '1 1 0' }}>
      <div className="flex h-9 shrink-0 items-stretch gap-1 overflow-x-auto px-1.5 pt-1">
        {fullMode && activeProfile ? (
          <div className="group flex min-w-0 items-center gap-2 rounded-full border border-accent-400/40 bg-accent-500/[0.16] px-2.5 text-[12px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.6)]" />
            <span className="truncate" data-testid="web-full-name">{activeProfile.name}</span>
            <button title="Tutup tampilan penuh (kembali ke split tersimpan)" data-testid="web-full-close" onClick={() => onCloseFull?.()} className="rounded-full p-0.5 text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100"><X size={11} /></button>
          </div>
        ) : tabs.map((p, i) => {
          const on = p.id === activeProfile?.id
          const badge = infos.find((x) => x.profileId === p.id)?.badge ?? 0
          return (
            <div key={p.id} className={`group flex min-w-0 max-w-[190px] items-center gap-1.5 rounded-full border px-2.5 text-[12px] transition ${
              on ? 'border-white/15 bg-accent-500/[0.15] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]' : 'border-transparent text-zinc-400 hover:bg-white/[0.05]'
            }`}>
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${on ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
              <button data-testid={`web-tab-${p.name}`} onClick={() => activateTab(index, i)} className="min-w-0 flex-1 truncate py-1.5 text-left">{p.name}{badge ? ` (${badge})` : ''}</button>
              <button title="Tutup tab" onClick={() => closeTab(index, i)} className="rounded-full p-0.5 text-zinc-500 opacity-60 transition hover:bg-white/10 hover:text-zinc-200 group-hover:opacity-100"><X size={11} /></button>
            </div>
          )
        })}
        {!fullMode && (
          <select
            data-testid={`web-new-tab-${index}`} value="" onChange={(e) => e.target.value && addTab(index, e.target.value)}
            className="my-0.5 rounded-full border border-white/10 bg-white/[0.05] px-1 text-[12px] text-zinc-400 outline-none"
            title="Tab baru"
          >
            <option value="">+</option>
            {addable.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>
      <PanelToolbar profile={activeProfile} info={info} />
      {activeProfile && info?.loginBlocked && <LoginBlocked profile={activeProfile} info={info} />}
      {!activeProfile && (
        <div className="grid flex-1 place-items-center p-6 text-center">
          <div className="max-w-xs">
            <p className="text-sm text-zinc-400">Panel ini kosong.</p>
            <select
              value="" onChange={(e) => e.target.value && addTab(index, e.target.value)}
              className="mt-3 w-full rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-zinc-300 outline-none"
            >
              <option value="">Pilih layanan…</option>
              {addable.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
      )}
      {activeProfile && !info?.url && !activeProfile.homeUrl && (
        <div className="grid flex-1 place-items-center p-6 text-center">
          <div className="max-w-xs">
            <p className="text-sm text-zinc-300">URL {activeProfile.name} belum diatur.</p>
            <button onClick={() => { setSettingsSection('services'); setView('settings') }} className="mt-3 rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-1.5 text-sm text-zinc-200 transition hover:bg-white/[0.1]">Buka Pengaturan → Layanan Web</button>
          </div>
        </div>
      )}
      {activeProfile && info?.state === 'hibernated' && info.error && !info.loginBlocked && (
        <div className="grid flex-1 place-items-center p-6 text-center">
          <div className="max-w-xs">
            <p className="text-sm text-zinc-300">{info.error}</p>
            <button onClick={() => void window.alip.views.reload(activeProfile.id)} className="btn-primary mt-3 px-3.5">Muat ulang</button>
          </div>
        </div>
      )}
      <div ref={bindRef} className="relative min-h-0 flex-1 rounded-b-2xl bg-app" data-testid={`web-panel-${index}`} />
    </div>
  )
}

export default function WebView() {
  const { web, addTab, closeTab, activateTab, setWebRatio, setView, prevView, clearFull, splitFull } = useUi()
  const { profiles, infos } = useWeb()
  const panels = web.panels
  const refs = useRef<(HTMLDivElement | null)[]>([null, null])
  const containerRef = useRef<HTMLDivElement>(null)

  const profileOf = (id: string): ProfileRow | undefined => profiles.find((p) => p.id === id)
  // Tampilan penuh: layanan yang dibuka saat layout sudah terisi, menutupi split tersimpan.
  const fullId = web.full && profileOf(web.full) ? web.full : null
  const panelActive = panels.map((p) => {
    const ids = p.tabs.filter((id) => profileOf(id))
    return ids[Math.min(p.active, ids.length - 1)] ?? null
  })
  const activeIds = fullId ? [fullId] : panelActive
  const hasUrl = (id: string | null): boolean => {
    if (!id) return false
    const info = infos.find((i) => i.profileId === id)
    return !!(profileOf(id)?.homeUrl || info?.url)
  }
  const blocked = activeIds.some((id) => !!infos.find((i) => i.profileId === id)?.loginBlocked)

  const latest = useRef({ activeIds, hasUrl })
  latest.current = { activeIds, hasUrl }
  const report = useCallback(() => {
    const { activeIds: ids, hasUrl: has } = latest.current
    const list = ids.flatMap((id, i) => {
      const el = refs.current[i]
      if (!id || !el || !has(id)) return []
      const r = el.getBoundingClientRect()
      return [{ profileId: id, bounds: { x: r.x, y: r.y, width: r.width, height: r.height } }]
    })
    void window.alip.views.show(list)
  }, [])

  const sig = (fullId ?? '-') + '|' + panels.map((p) => `${p.tabs.join(',')}#${p.active}`).join('|') + `:${hasUrl(activeIds[0])}:${hasUrl(activeIds[1])}:${blocked}`
  useLayoutEffect(() => {
    report()
    let raf = 0
    const schedule = (): void => { cancelAnimationFrame(raf); raf = requestAnimationFrame(report) }
    const ro = new ResizeObserver(schedule)
    refs.current.forEach((el) => el && ro.observe(el))
    window.addEventListener('resize', schedule)
    return () => { cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener('resize', schedule) }
  }, [sig, web.ratio, report, blocked])

  useEffect(() => () => void window.alip.views.show([]), []) // keluar dari layar web: sembunyikan semua view

  const startDrag = (e: React.MouseEvent): void => {
    e.preventDefault()
    void window.alip.views.setOverlay(true)
    const move = (ev: MouseEvent): void => {
      const box = containerRef.current?.getBoundingClientRect()
      if (!box) return
      setWebRatio((ev.clientX - box.left) / box.width)
    }
    const up = (): void => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      void window.alip.views.setOverlay(false)
      report()
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const visible = [0, 1].filter((i) => panels[i].tabs.length > 0)
  if (!visible.length) visible.push(0)

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-black/20">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-white/[0.07] px-2.5">
        <button
          data-testid="web-back" onClick={() => { const t = web.fromTaskId; setView(prevView === 'web' ? 'today' : prevView); if (t) void openTask(t) }}
          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-[12.5px] text-zinc-300 transition hover:bg-white/[0.1]"
        >
          <ArrowLeft size={13} /> {web.fromTaskId ? 'Kembali ke task' : 'Kembali'}
        </button>
        <span className="ds-label">Layanan web</span>
        {(fullId || (panels[0].tabs.length > 0 && panels[1].tabs.length === 0)) && (
          <select
            data-testid="web-split" value=""
            onChange={(e) => {
              const v = e.target.value
              if (!v) return
              if (fullId) splitFull(v)
              else addTab(1, v)
            }}
            className="ml-2 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11.5px] text-zinc-300 outline-none"
            title={fullId ? 'Tampilkan layanan ini berdampingan dengan yang sedang penuh' : 'Tambah panel kanan'}
          >
            <option value="">Bagi layar dengan…</option>
            {profiles.filter((p) => !p.nativeOnly && p.id !== fullId && (fullId !== null || !panels[0].tabs.includes(p.id))).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-600">
          {fullId ? 'Tampil penuh · split tersimpan' : 'Tab & split tersimpan'}
        </span>
      </div>

      <div ref={containerRef} className="flex min-h-0 flex-1">
        {fullId ? (
          <div className="flex min-w-0 flex-col" style={{ flex: '1 1 0' }}>
            <Panel
              index={0} panel={{ tabs: [fullId], active: 0 }} profiles={profiles} infos={infos}
              addTab={addTab} closeTab={closeTab} activateTab={activateTab}
              bindRef={(el) => { refs.current[0] = el }}
              fullMode onCloseFull={clearFull}
            />
          </div>
        ) : visible.map((pi, order) => (
          <div key={pi} className="flex min-w-0 flex-col"
            style={visible.length === 2 ? (order === 0 ? { flex: `0 0 ${web.ratio * 100}%` } : { flex: '1 1 0' }) : { flex: '1 1 0' }}>
            <Panel
              index={pi} panel={panels[pi]} profiles={profiles} infos={infos}
              addTab={addTab} closeTab={closeTab} activateTab={activateTab}
              bindRef={(el) => { refs.current[pi] = el }}
            />
          </div>
        )).flatMap((node, i) => (i === 0 && visible.length === 2
          ? [node, <div key="divider" data-testid="web-divider" onMouseDown={startDrag} className="w-1.5 shrink-0 cursor-col-resize bg-white/[0.06] transition hover:bg-white/20" />]
          : [node]))}
      </div>
    </div>
  )
}
