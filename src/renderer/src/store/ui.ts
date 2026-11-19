import { create } from 'zustand'
import { loadJson, saveJson } from '@renderer/lib/persist'

export type ViewId = 'today' | 'inbox' | 'tasks' | 'waiting' | 'timesheet' | 'done' | 'settings' | 'web'
/** Satu panel web punya daftar tab (profil) dan tab aktif. Maks 2 panel berdampingan. */
export type WebPanel = { tabs: string[]; active: number }
/**
 * `panels` = layout split yang tersimpan (dipulihkan saat app dibuka lagi).
 * `full` = layanan yang sedang tampil penuh menutupi layout itu (dibuka saat layout sudah terisi),
 * sehingga membuka situs lain tidak menempel ke salah satu panel WA/Telegram.
 */
export type WebState = { panels: WebPanel[]; fromTaskId: string | null; ratio: number; full: string | null }
export type Dialog =
  | { type: 'newTask'; workspaceId?: string | null }
  | { type: 'workspace'; id?: string }
  | { type: 'resource'; taskId: string }
  /** Tangkap cepat: isi clipboard sudah dibaca main process. */
  | { type: 'capture'; text: string }
  | { type: 'inboxTask'; itemId: string }
  | { type: 'linkInbox'; itemId: string }
  | { type: 'endOfDay' }
  | { type: 'templates' }
  | { type: 'saveTemplate'; taskId: string }
  | { type: 'snippets' }
  | { type: 'snippet'; id: string }
  | null
export type Notice = { kind: 'ok' | 'error'; text: string } | null

const WEB_KEY = 'tn.web.v1'
const RATIO_DEFAULT = 0.5

const emptyPanels = (): WebPanel[] => [
  { tabs: [], active: 0 },
  { tabs: [], active: 0 }
]

/** Validasi bentuk tersimpan; nilai aneh jatuh ke default supaya app tidak rusak. */
function loadWeb(): WebState {
  const raw = loadJson<Partial<WebState>>(WEB_KEY, {})
  const panels = Array.isArray(raw.panels) && raw.panels.length === 2 ? raw.panels : emptyPanels()
  const clean = panels.map((p) => ({
    tabs: Array.isArray(p.tabs) ? p.tabs.filter((t) => typeof t === 'string') : [],
    active: Number.isInteger(p.active) ? (p.active as number) : 0
  }))
  for (const p of clean) p.active = Math.max(0, Math.min(p.active, p.tabs.length - 1))
  const ratio = typeof raw.ratio === 'number' && raw.ratio >= 0.2 && raw.ratio <= 0.8 ? raw.ratio : RATIO_DEFAULT
  const full = typeof raw.full === 'string' && raw.full ? raw.full : null
  return { panels: clean, fromTaskId: raw.fromTaskId ?? null, ratio, full }
}

const saveWeb = (web: WebState): void => saveJson(WEB_KEY, web)

function clonePanels(panels: WebPanel[]): WebPanel[] {
  return panels.map((p) => ({ tabs: [...p.tabs], active: p.active }))
}

function activate(panels: WebPanel[], panel: number, profileId: string): WebPanel[] {
  const idx = panels[panel]?.tabs.indexOf(profileId) ?? -1
  if (idx >= 0) panels[panel].active = idx
  return panels
}

/** Buang tab dari panel lain supaya satu profil tidak tampil dua kali. */
function removeFromOtherPanels(panels: WebPanel[], keepPanel: number, profileId: string): void {
  panels.forEach((p, i) => {
    if (i === keepPanel) return
    const idx = p.tabs.indexOf(profileId)
    if (idx < 0) return
    p.tabs.splice(idx, 1)
    if (p.active >= p.tabs.length) p.active = Math.max(0, p.tabs.length - 1)
  })
}

function place(panels: WebPanel[], panel: number, profileId: string): WebPanel[] {
  removeFromOtherPanels(panels, panel, profileId)
  const p = panels[panel]
  if (!p.tabs.includes(profileId)) {
    p.tabs.push(profileId)
    p.active = p.tabs.length - 1
  } else {
    p.active = p.tabs.indexOf(profileId)
  }
  return panels
}

type UiState = {
  view: ViewId
  prevView: ViewId
  web: WebState
  settingsSection: string
  workspaceFilter: string | null
  paletteOpen: boolean
  /** Panel lonceng pengingat terbuka (perlu overlay agar tidak tertutup view web). */
  reminderPanelOpen: boolean
  dialog: Dialog
  notice: Notice
  /** Dialog "Terakhir sampai mana?" untuk satu task yang timernya akan dijeda. */
  stopPrompt: { taskId: string } | null
  setView: (v: ViewId) => void
  openWeb: (targets: { profileId: string }[], fromTaskId: string | null) => void
  /** Tutup tampilan penuh dan kembali ke layout split yang tersimpan. */
  clearFull: () => void
  /** Ubah tampilan penuh menjadi split dengan layanan lain (layout lama tetap jadi tab). */
  splitFull: (partnerId: string) => void
  setWebPanels: (panels: WebPanel[]) => void
  addTab: (panel: number, profileId: string) => void
  closeTab: (panel: number, index: number) => void
  activateTab: (panel: number, index: number) => void
  setWebRatio: (ratio: number) => void
  openWorkspace: (id: string) => void
  setSettingsSection: (id: string) => void
  setPalette: (open: boolean) => void
  setReminderPanel: (open: boolean) => void
  setDialog: (d: Dialog) => void
  setNotice: (n: Notice) => void
  setStopPrompt: (p: { taskId: string } | null) => void
}

export const useUi = create<UiState>((set) => {
  return {
    view: 'today',
    prevView: 'today',
    web: loadWeb(),
    settingsSection: 'general',
    workspaceFilter: null,
    paletteOpen: false,
    reminderPanelOpen: false,
    dialog: null,
    notice: null,
    stopPrompt: null,
    setView: (view) => set({ view, workspaceFilter: null }),
    openWeb: (targets, fromTaskId) =>
      set((st) => {
        const panels = clonePanels(st.web.panels)
        let full: string | null = null
        if (targets.length >= 2) {
          // Dua target sekaligus (mis. Buka semua): paksa satu per panel agar benar-benar split.
          for (const p of panels) { p.tabs = []; p.active = 0 }
          place(panels, 0, targets[0].profileId)
          place(panels, 1, targets[1].profileId)
        } else {
          const id = targets[0]?.profileId
          if (id) {
            const home = panels.findIndex((p) => p.tabs.includes(id))
            if (home >= 0) {
              // Bagian dari layout tersimpan: tampilkan layout itu apa adanya (split kembali).
              activate(panels, home, id)
            } else if (panels.some((p) => p.tabs.length > 0)) {
              // Layout sudah terisi: jangan tempelkan situs baru ke panel WA/Telegram.
              // Tampilkan penuh dulu; split hanya kalau pengguna memilihnya.
              full = id
            } else {
              place(panels, 0, id)
            }
          }
        }
        const web = { ...st.web, panels, full, fromTaskId }
        saveWeb(web)
        return { prevView: st.view === 'web' ? st.prevView : st.view, view: 'web', web }
      }),
    clearFull: () =>
      set((st) => {
        if (!st.web.full) return {}
        const web = { ...st.web, full: null }
        saveWeb(web)
        return { web }
      }),
    splitFull: (partnerId) =>
      set((st) => {
        const fullId = st.web.full
        if (!fullId || fullId === partnerId) return {}
        const prev = clonePanels(st.web.panels)
        // Tab lama tidak dibuang: dipindah ke panel baru supaya tetap bisa dipilih.
        const keep = (tabs: string[] | undefined): string[] =>
          (tabs ?? []).filter((t) => t !== fullId && t !== partnerId)
        const panels: WebPanel[] = [
          { tabs: [fullId, ...keep(prev[0]?.tabs)], active: 0 },
          { tabs: [partnerId, ...keep(prev[1]?.tabs)], active: 0 }
        ]
        const web = { ...st.web, panels, full: null }
        saveWeb(web)
        return { web }
      }),
    setWebPanels: (panels) =>
      set((st) => {
        const web = { ...st.web, panels: clonePanels(panels).slice(0, 2) }
        saveWeb(web)
        return { web }
      }),
    addTab: (panel, profileId) =>
      set((st) => {
        const panels = clonePanels(st.web.panels)
        place(panels, Math.max(0, Math.min(panel, panels.length - 1)), profileId)
        const web = { ...st.web, panels }
        saveWeb(web)
        return { web }
      }),
    closeTab: (panel, index) =>
      set((st) => {
        const panels = clonePanels(st.web.panels)
        const p = panels[panel]
        if (!p) return {}
        p.tabs.splice(index, 1)
        if (p.active >= p.tabs.length) p.active = Math.max(0, p.tabs.length - 1)
        const web = { ...st.web, panels }
        saveWeb(web)
        return { web }
      }),
    activateTab: (panel, index) =>
      set((st) => {
        const panels = clonePanels(st.web.panels)
        const p = panels[panel]
        if (!p || index < 0 || index >= p.tabs.length) return {}
        p.active = index
        const web = { ...st.web, panels }
        saveWeb(web)
        return { web }
      }),
    setWebRatio: (ratio) =>
      set((st) => {
        const web = { ...st.web, ratio: Math.min(0.8, Math.max(0.2, ratio)) }
        saveWeb(web)
        return { web }
      }),
    openWorkspace: (id) => set({ view: 'tasks', workspaceFilter: id }),
    setSettingsSection: (settingsSection) => set({ settingsSection }),
    setPalette: (paletteOpen) => set({ paletteOpen }),
    setReminderPanel: (reminderPanelOpen) => set({ reminderPanelOpen }),
    setDialog: (dialog) => set({ dialog }),
    setNotice: (notice) => set({ notice }),
    setStopPrompt: (stopPrompt) => set({ stopPrompt })
  }
})
