import { app, session, shell, WebContentsView, type BrowserWindow, type Session } from 'electron'
import { join } from 'node:path'
import type { SlotBounds, ViewInfo, ViewSlot, ViewState } from '@shared/data'
import type { ProfileRow } from '@shared/data'

export type PerfSettings = { hibernateMinutes: number; maxLiveViews: number }
export type ProfileLite = Pick<ProfileRow, 'id' | 'name' | 'partitionId' | 'service' | 'homeUrl' | 'keepAlive'>

type Entry = {
  profile: ProfileLite
  view: WebContentsView | null
  state: ViewState
  lastActiveAt: number
  lastUrl: string | null
  title: string
  badge: number
  loading: boolean
  error: string | null
  bounds: SlotBounds | null
  loginBlocked: 'google' | null
}

const HTTP = /^https?:\/\//i
const configured = new WeakSet<Session>()

/** Google menolak login dari browser tertanam; halaman penolakannya mudah dikenali dari URL. */
export function detectLoginBlocked(url: string): 'google' | null {
  if (/accounts\.google\.com\/.*(signin\/rejected|blocked_user_agent)/i.test(url)) return 'google'
  if (/google\.com\/.*blocked_user_agent/i.test(url)) return 'google'
  return null
}

/** User-agent seperti Chrome stabil: buang token "Electron/…" dan nama app supaya situs tidak menolak. */
export function chromeUserAgent(): string {
  return session.defaultSession.getUserAgent().replace(/\s(Electron|alip-workspace|TN-Workspace)\/\S+/gi, '')
}

function configureSession(ses: Session): void {
  if (configured.has(ses)) return
  configured.add(ses)
  ses.setUserAgent(chromeUserAgent())
  const allowed = new Set(['notifications', 'clipboard-sanitized-write'])
  ses.setPermissionRequestHandler((_wc, permission, cb) => cb(allowed.has(permission)))
  ses.setPermissionCheckHandler((_wc, permission) => allowed.has(permission))
}

/** Badge dari judul halaman, mis. "(3) WhatsApp" atau "Inbox (12) - Gmail". */
export function parseBadge(title: string): number {
  const m = /\((\d{1,3})\)/.exec(title)
  return m ? Number(m[1]) : 0
}

/** Alamat dari address bar: tanpa skema ditambah https://; hanya http(s) yang diterima. */
export function normalizeUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`
  if (!HTTP.test(withScheme)) return null
  try { return new URL(withScheme).toString() } catch { return null }
}

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

function errorPage(url: string, desc: string): string {
  const html = `<!doctype html><meta charset="utf-8"><body style="font-family:Segoe UI,Arial,sans-serif;background:#0b0d12;color:#d4d4d8;display:grid;place-items:center;height:100vh;margin:0">
<div style="max-width:520px;padding:24px"><h2 style="margin:0 0 8px">Halaman tidak bisa dibuka</h2>
<p style="color:#a1a1aa;margin:0 0 4px">${esc(desc)}</p><p style="color:#71717a;word-break:break-all;margin:0 0 16px">${esc(url)}</p>
<p style="color:#71717a;margin:0">Periksa koneksi internet lalu tekan tombol muat ulang di atas.</p></div></body>`
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
}

export class ViewManager {
  private entries = new Map<string, Entry>()
  private slots: ViewSlot[] = []
  private overlay = false
  private emitQueued = false

  constructor(
    private win: BrowserWindow,
    private getProfile: (id: string) => ProfileLite | null,
    private getPerf: () => PerfSettings,
    private onChange: (infos: ViewInfo[]) => void = () => undefined
  ) {}

  // -------------------------------------------------------------- publik
  /** Tampilkan view di slot (maks 2). View yang tidak ada di slot menjadi "warm" (hidup tapi tersembunyi). */
  show(slots: ViewSlot[]): void {
    this.slots = slots.slice(0, 2)
    const wanted = new Set(this.slots.map((s) => s.profileId))
    const now = Date.now()

    for (const e of this.entries.values()) {
      if (e.state === 'active' && !wanted.has(e.profile.id)) {
        e.state = e.view ? 'warm' : 'hibernated'
        e.lastActiveAt = now
        e.view?.setVisible(false)
      }
    }
    for (const slot of this.slots) {
      const e = this.ensure(slot.profileId)
      if (!e) continue
      const url = e.lastUrl ?? e.profile.homeUrl
      if (!e.view) {
        if (!url) continue // belum ada URL: renderer menampilkan pesan
        this.createView(e, url)
      }
      e.bounds = slot.bounds
      e.view!.setBounds(slot.bounds)
      e.view!.setVisible(!this.overlay)
      e.state = 'active'
      e.lastActiveAt = now
    }
    this.enforceLimit()
    this.emit()
  }

  /** Arahkan view sebuah profil ke URL. Bila view belum hidup, URL dipakai saat view dibuat. */
  open(profileId: string, url: string): void {
    if (!HTTP.test(url)) throw new Error('Hanya alamat http(s) yang boleh dibuka')
    const e = this.ensure(profileId)
    if (!e) throw new Error('Layanan web tidak ditemukan')
    e.error = null
    if (e.view && !e.view.webContents.isDestroyed()) void e.view.webContents.loadURL(url).catch(() => undefined)
    else e.lastUrl = url
    this.emit()
  }

  setOverlay(on: boolean): void {
    this.overlay = on
    for (const e of this.entries.values()) if (e.view && e.state === 'active') e.view.setVisible(!on)
  }

  reload(profileId: string): void {
    const e = this.entries.get(profileId)
    if (!e) return
    e.error = null
    if (e.view && !e.view.webContents.isDestroyed()) {
      // Halaman galat (data: URL) tidak bisa dimuat ulang; kembali ke alamat terakhir.
      if (e.view.webContents.getURL().startsWith('data:') && e.lastUrl) void e.view.webContents.loadURL(e.lastUrl).catch(() => undefined)
      else e.view.webContents.reload()
    } else {
      this.show(this.slots) // bangunkan kembali (mis. setelah crash)
    }
    this.emit()
  }

  back(profileId: string): void {
    const wc = this.entries.get(profileId)?.view?.webContents
    if (wc && !wc.isDestroyed() && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack()
  }

  forward(profileId: string): void {
    const wc = this.entries.get(profileId)?.view?.webContents
    if (wc && !wc.isDestroyed() && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward()
  }

  openExternal(profileId: string): void {
    const e = this.entries.get(profileId)
    const url = e?.view && !e.view.webContents.isDestroyed() ? e.view.webContents.getURL() : e?.lastUrl
    if (url && HTTP.test(url)) void shell.openExternal(url)
  }

  /** Address bar: terima alamat tanpa skema (ditambahkan https://). */
  navigate(profileId: string, raw: string): void {
    const url = normalizeUrl(raw)
    if (!url) throw new Error('Alamat tidak valid. Contoh: https://web.whatsapp.com')
    this.open(profileId, url)
  }

  /** Inspector halaman (DevTools) untuk view profil ini. */
  devtools(profileId: string): void {
    const wc = this.entries.get(profileId)?.view?.webContents
    if (!wc || wc.isDestroyed()) return
    if (wc.isDevToolsOpened()) wc.closeDevTools()
    else wc.openDevTools({ mode: 'detach' })
  }

  /** Zoom halaman: langkah 0.5, rentang -3..3 (Electron zoom level). */
  zoom(profileId: string, action: 'in' | 'out' | 'reset'): void {
    const wc = this.entries.get(profileId)?.view?.webContents
    if (!wc || wc.isDestroyed()) return
    const next = action === 'reset' ? 0 : wc.getZoomLevel() + (action === 'in' ? 0.5 : -0.5)
    wc.setZoomLevel(Math.max(-3, Math.min(3, next)))
    this.emit()
  }

  stop(profileId: string): void {
    const wc = this.entries.get(profileId)?.view?.webContents
    if (wc && !wc.isDestroyed()) wc.stop()
  }

  /** Hancurkan view (sesi login tetap tersimpan di partition). */
  hibernate(profileId: string): void {
    const e = this.entries.get(profileId)
    if (!e?.view) return
    this.destroyView(e)
    e.state = 'hibernated'
    e.badge = 0
    e.loading = false
    this.emit()
  }

  /** Mode hemat: hibernasi semua view yang tidak terlihat dan tidak "jaga hidup". */
  hibernateAll(): number {
    this.refreshProfiles()
    let n = 0
    for (const e of this.entries.values()) {
      if (e.view && e.state !== 'active' && !e.profile.keepAlive) {
        this.destroyView(e)
        e.state = 'hibernated'
        e.badge = 0
        n++
      }
    }
    this.emit()
    return n
  }

  /** Dipanggil berkala: hibernasi view tersembunyi yang tidak dipakai melebihi batas menit. */
  tick(now = Date.now()): number {
    const limit = this.getPerf().hibernateMinutes * 60_000
    let n = 0
    for (const e of this.entries.values()) {
      this.ensureFresh(e)
      if (e.view && e.state === 'warm' && !e.profile.keepAlive && now - e.lastActiveAt >= limit) {
        this.destroyView(e)
        e.state = 'hibernated'
        e.badge = 0
        n++
      }
    }
    if (n) this.emit()
    return n
  }

  /** Lupakan sebuah profil (dihapus): view dihancurkan dan entri dibuang. */
  forget(profileId: string): void {
    const e = this.entries.get(profileId)
    if (!e) return
    this.destroyView(e)
    this.entries.delete(profileId)
    this.slots = this.slots.filter((s) => s.profileId !== profileId)
    this.emit()
  }

  destroyAll(): void {
    for (const e of this.entries.values()) this.destroyView(e)
    this.entries.clear()
  }

  list(): ViewInfo[] {
    const mem = new Map(app.getAppMetrics().map((m) => [m.pid, (m.memory.privateBytes || m.memory.workingSetSize) / 1024]))
    return [...this.entries.values()].map((e) => {
      this.ensureFresh(e)
      const wc = e.view && !e.view.webContents.isDestroyed() ? e.view.webContents : null
      const pid = wc ? wc.getOSProcessId() : 0
      return {
        profileId: e.profile.id, name: e.profile.name, service: e.profile.service, state: e.state,
        url: wc ? wc.getURL() || e.lastUrl : e.lastUrl, title: e.title, badge: e.badge, loading: e.loading, error: e.error,
        memoryMb: pid && mem.has(pid) ? Math.round(mem.get(pid)!) : null, keepAlive: e.profile.keepAlive,
        loginBlocked: e.loginBlocked
      }
    })
  }

  counts(): { alive: number; hibernated: number } {
    let alive = 0
    let hibernated = 0
    for (const e of this.entries.values()) {
      if (e.view) alive++
      else if (e.state === 'hibernated') hibernated++
    }
    return { alive, hibernated }
  }

  // ---- untuk pengujian ----
  debugView(profileId: string): WebContentsView | null { return this.entries.get(profileId)?.view ?? null }
  debugAge(profileId: string, ms: number): void { const e = this.entries.get(profileId); if (e) e.lastActiveAt -= ms }

  // ------------------------------------------------------------ internal
  /** Ambil ulang data profil (mis. "jaga hidup" diubah di Pengaturan) sebelum keputusan hibernasi. */
  private refreshProfiles(): void {
    for (const e of this.entries.values()) this.ensureFresh(e)
  }

  private ensureFresh(e: Entry): void {
    const p = this.getProfile(e.profile.id)
    if (p) e.profile = p
  }

  private ensure(profileId: string): Entry | null {
    const p = this.getProfile(profileId)
    if (!p) return null
    let e = this.entries.get(profileId)
    if (!e) {
      e = { profile: p, view: null, state: 'idle', lastActiveAt: Date.now(), lastUrl: null, title: '', badge: 0, loading: false, error: null, bounds: null, loginBlocked: null }
      this.entries.set(profileId, e)
    } else {
      e.profile = p
    }
    return e
  }

  /** Terapkan batas view hidup: hibernasi yang paling lama tak dipakai (utamakan yang bukan "jaga hidup"). */
  private enforceLimit(): void {
    this.refreshProfiles()
    const max = this.getPerf().maxLiveViews
    const alive = [...this.entries.values()].filter((e) => e.view)
    let over = alive.length - max
    if (over <= 0) return
    const victims = alive
      .filter((e) => e.state !== 'active')
      .sort((a, b) => Number(a.profile.keepAlive) - Number(b.profile.keepAlive) || a.lastActiveAt - b.lastActiveAt)
    for (const e of victims) {
      if (over-- <= 0) break
      this.destroyView(e)
      e.state = 'hibernated'
      e.badge = 0
    }
  }

  private destroyView(e: Entry): void {
    const v = e.view
    if (!v) return
    e.view = null
    try {
      if (!v.webContents.isDestroyed()) {
        const u = v.webContents.getURL()
        if (HTTP.test(u)) e.lastUrl = u
      }
      this.win.contentView.removeChildView(v)
      if (!v.webContents.isDestroyed()) v.webContents.close()
    } catch { /* jendela mungkin sedang ditutup */ }
  }

  private createView(e: Entry, url: string): void {
    const ses = session.fromPartition(`persist:${e.profile.partitionId}`)
    configureSession(ses)
    const view = new WebContentsView({
      webPreferences: {
        session: ses, sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: true, spellcheck: false,
        // Tamu: matikan passkey/WebAuthn supaya tidak memunculkan dialog Windows Security.
        preload: join(__dirname, '../preload/guest.js')
      }
    })
    const wc = view.webContents
    e.view = view
    e.error = null
    e.title = ''
    view.setVisible(false)
    this.win.contentView.addChildView(view)

    const guard = (ev: { preventDefault: () => void }, target: string): void => { if (!HTTP.test(target)) ev.preventDefault() }
    wc.on('will-navigate', (ev, target) => guard(ev, target))
    wc.on('will-redirect', (ev, target) => guard(ev, target))
    wc.setWindowOpenHandler(({ url: target }) => {
      if (HTTP.test(target)) void shell.openExternal(target)
      return { action: 'deny' }
    })
    wc.on('page-title-updated', (_ev, title) => { e.title = title; e.badge = parseBadge(title); this.emit() })
    const remember = (u: string): void => { if (HTTP.test(u)) e.lastUrl = u; e.loginBlocked = detectLoginBlocked(u) }
    wc.on('did-navigate', (_ev, u) => { remember(u); this.emit() })
    wc.on('did-navigate-in-page', (_ev, u) => remember(u))
    wc.on('did-start-loading', () => { e.loading = true; this.emit() })
    wc.on('did-stop-loading', () => { e.loading = false; this.emit() })
    wc.on('did-fail-load', (_ev, code, desc, failedUrl, isMain) => {
      if (!isMain || code === -3 || failedUrl.startsWith('data:')) return // -3 = dibatalkan
      e.error = desc
      remember(failedUrl)
      void wc.loadURL(errorPage(failedUrl, `${desc} (kode ${code})`)).catch(() => undefined)
    })
    wc.on('render-process-gone', (_ev, details) => {
      this.destroyView(e)
      e.state = 'hibernated'
      e.error = `Halaman berhenti bekerja (${details.reason})`
      this.emit()
    })
    remember(url)
    void wc.loadURL(url).catch(() => undefined)
  }

  /** Beri tahu renderer (digabung agar tidak membanjiri IPC). */
  private emit(): void {
    if (this.emitQueued) return
    this.emitQueued = true
    setTimeout(() => {
      this.emitQueued = false
      this.onChange(this.list())
    }, 80)
  }
}
