import type { Settings, SettingsSectionKey } from './settings'
import type {
  ActiveTimer, DayStats, InboxInput, InboxRow, InboxTaskInput, LaunchResult, OpenAllResult, ProfileInput, ProfileRow, Reminder, ResourceInput, SnippetInput, SnippetRow, Status, TemplateInput, TemplateRow, TimeEntryWithTask, ViewInfo, ViewSlot, TaskCreateInput, TaskDetail, TaskPatch, TaskRow, Workspace, WorkspaceInput
} from './data'
import type {
  BuiltinFileEntry, LayoutRow, LayoutSlotId, ToolManifest, ToolRow, ToolRunInputs, ToolRunResult
} from './tools'

export type Metrics = {
  /** Total RAM seluruh proses app (MB). */
  totalMb: number
  processCount: number
  activeViews: number
  hibernatedViews: number
}

export type AppInfo = { version: string; platform: string; dbPath: string }

/** Status jendela untuk tombol kustom di title bar (jendela frameless). */
export type WindowState = { maximized: boolean }

export type SaveResult = { ok: true; settings: Settings } | { ok: false; error: string }

/** Status pendaftaran pintasan global (bisa gagal bila dipakai aplikasi lain). */
export type ShortcutStatus = {
  accelerator: string
  registered: boolean
  error: string | null
  /** Pintasan Screenshot Editor; null bila dimatikan. */
  screenshot: { accelerator: string; registered: boolean; error: string | null } | null
}

export interface AlipApi {
  app: { info(): Promise<AppInfo> }
  win: {
    minimize(): Promise<void>
    toggleMaximize(): Promise<void>
    close(): Promise<void>
    state(): Promise<WindowState>
    onState(cb: (s: WindowState) => void): () => void
  }
  settings: {
    get(): Promise<Settings>
    setSection(section: SettingsSectionKey, value: unknown): Promise<SaveResult>
  }
  metrics: {
    get(): Promise<Metrics>
    subscribe(cb: (m: Metrics) => void): () => void
  }
  workspaces: {
    list(): Promise<Workspace[]>
    create(input: WorkspaceInput): Promise<Workspace>
    update(id: string, input: WorkspaceInput): Promise<void>
    archive(id: string): Promise<void>
  }
  tasks: {
    list(): Promise<TaskRow[]>
    get(id: string): Promise<TaskDetail | null>
    create(input: TaskCreateInput): Promise<TaskRow>
    update(id: string, patch: TaskPatch): Promise<void>
    setStatus(id: string, status: Status): Promise<void>
    remove(id: string): Promise<void>
  }
  subtasks: {
    add(taskId: string, title: string): Promise<void>
    setDone(id: string, done: boolean): Promise<void>
    rename(id: string, title: string): Promise<void>
    remove(id: string): Promise<void>
  }
  notes: { save(taskId: string, content: string): Promise<void> }
  /** Catatan cepat global (tool "Catatan"): satu textarea yang tersimpan di app. */
  quickNote: {
    get(): Promise<string>
    save(content: string): Promise<void>
  }
  resources: {
    add(taskId: string, input: ResourceInput): Promise<void>
    remove(id: string): Promise<void>
    open(id: string): Promise<LaunchResult>
    /** Buka folder/file sebuah resource dengan aplikasi tertentu (mis. folder proyek di VS Code). */
    openWith(id: string, app: string): Promise<LaunchResult>
    openAll(taskId: string): Promise<OpenAllResult>
  }
  profiles: {
    list(): Promise<ProfileRow[]>
    create(input: ProfileInput): Promise<ProfileRow>
    update(id: string, input: ProfileInput): Promise<void>
    /** Menghapus profil sekaligus data login/sesinya. */
    remove(id: string): Promise<void>
    /** Untuk profil "hanya luncurkan app native". */
    openNative(id: string): Promise<LaunchResult>
    /** Buka layanan di jendela Chrome/Edge asli (untuk login yang menolak browser tertanam, mis. Google). */
    openInBrowser(id: string, url?: string): Promise<LaunchResult>
    /** Opsi ringan: buka layanan di browser bawaan (satu tab, tanpa instance browser baru). */
    openExternal(id: string): Promise<LaunchResult>
  }
  views: {
    list(): Promise<ViewInfo[]>
    /** Tampilkan view di slot (maks 2). Slot kosong = sembunyikan semua. */
    show(slots: ViewSlot[]): Promise<void>
    /** Arahkan view sebuah profil ke URL (dipanggil saat membuka resource web). */
    open(profileId: string, url: string): Promise<void>
    setOverlay(on: boolean): Promise<void>
    reload(profileId: string): Promise<void>
    back(profileId: string): Promise<void>
    forward(profileId: string): Promise<void>
    hibernate(profileId: string): Promise<void>
    /** Mode hemat: hibernasi semua view yang tidak terlihat dan tidak "jaga hidup". Mengembalikan jumlahnya. */
    hibernateAll(): Promise<number>
    openExternal(profileId: string): Promise<void>
    /** Arahkan view ke alamat yang diketik di address bar (http/https saja). */
    navigate(profileId: string, url: string): Promise<void>
    /** Buka/tutup DevTools view (inspector). */
    devtools(profileId: string): Promise<void>
    /** Perbesar/perkecil/reset zoom halaman web. */
    zoom(profileId: string, action: 'in' | 'out' | 'reset'): Promise<void>
    /** Hentikan pemuatan halaman. */
    stop(profileId: string): Promise<void>
    subscribe(cb: (infos: ViewInfo[]) => void): () => void
  }
  launcher: {
    /** Uji path (yang sedang diketik, belum tentu tersimpan). Python: jalankan --version. App lain: buka aplikasinya. */
    test(app: string, path: string): Promise<LaunchResult>
    detect(): Promise<Record<string, string>>
    pick(kind: 'file' | 'folder'): Promise<string | null>
    /** Pilih beberapa file sekaligus (mis. banyak gambar untuk Image Resizer). */
    pickMany(kind: 'file' | 'folder'): Promise<string[]>
  }
  time: {
    /** Semua timer yang sedang berjalan; bisa lebih dari satu task sekaligus. */
    active(): Promise<ActiveTimer[]>
    start(taskId: string): Promise<void>
    /** Jeda timer satu task. resumeNote kosong = hapus catatan; undefined = biarkan. */
    stop(taskId: string, resumeNote?: string): Promise<void>
    /** Jeda semua timer berjalan (tanpa menyentuh resume note). */
    stopAll(): Promise<void>
    stats(): Promise<DayStats>
    entries(fromIso: string, toIso: string): Promise<TimeEntryWithTask[]>
    updateEntry(id: string, patch: { startedAt: string; endedAt: string; note?: string | null }): Promise<void>
    addEntry(taskId: string, patch: { startedAt: string; endedAt: string; note?: string | null }): Promise<void>
    /** Timer berhenti karena idle; renderer menampilkan toast dan menyegarkan data. */
    onIdleStopped(cb: (stopped: { taskId: string; taskTitle: string; seconds: number }[]) => void): () => void
  }
  timesheet: {
    markSynced(fromIso: string, toIso: string, synced: boolean): Promise<number>
    unsynced(fromIso: string, toIso: string): Promise<number>
  }
  templates: {
    list(): Promise<TemplateRow[]>
    create(input: TemplateInput): Promise<TemplateRow>
    update(id: string, input: TemplateInput): Promise<void>
    remove(id: string): Promise<void>
    createTask(id: string, dueAt?: string | null): Promise<TaskRow>
  }
  snippets: {
    list(): Promise<SnippetRow[]>
    create(input: SnippetInput): Promise<SnippetRow>
    update(id: string, input: SnippetInput): Promise<void>
    remove(id: string): Promise<void>
  }
  clipboard: {
    writeText(text: string): Promise<void>
    /** Gambar terakhir di clipboard sebagai data URL PNG, atau null. */
    readImage(): Promise<string | null>
    writeImage(dataUrl: string): Promise<void>
  }
  tools: {
    list(): Promise<ToolRow[]>
    /** Impor file tool atau folder berisi tool.json, lalu salin ke folder tools milik app. */
    install(sourcePath: string): Promise<ToolRow>
    remove(id: string): Promise<void>
    setEnabled(id: string, enabled: boolean): Promise<ToolRow[]>
    run(id: string, inputs: ToolRunInputs): Promise<ToolRunResult>
    cancel(id: string): Promise<void>
    layout(): Promise<LayoutRow[]>
    setLayout(slotId: LayoutSlotId, toolId: string | null, size?: number): Promise<LayoutRow[]>
    /** Pintasan global / aksi membuka tool (mis. Screenshot Editor). */
    onOpen(cb: (id: string) => void): () => void
    /** Tool bawaan yang butuh akses main process. */
    readImages(files: string[]): Promise<{ name: string; path: string; dataUrl: string; width: number; height: number }[]>
    writeFiles(items: { path: string; dataUrl: string }[]): Promise<ToolRunResult>
    listFiles(dir: string): Promise<BuiltinFileEntry[]>
    renameFile(path: string, newName: string): Promise<void>
    trashFile(path: string): Promise<void>
    openPath(path: string): Promise<void>
    /** Manifest bawaan (untuk halaman Tool Saya saat DB belum terisi). */
    builtins(): Promise<ToolManifest[]>
  }
  inbox: {
    list(): Promise<InboxRow[]>
    add(input: InboxInput): Promise<InboxRow>
    /** Ubah item jadi task baru (judul dari baris pertama bila tidak diisi). */
    makeTask(id: string, input: InboxTaskInput): Promise<TaskRow>
    /** Tautkan item ke task yang sudah ada. */
    link(id: string, taskId: string): Promise<void>
    snooze(id: string, until: string): Promise<void>
    ignore(id: string): Promise<void>
    /** Kembalikan item yang ditunda/diabaikan ke status baru. */
    restore(id: string): Promise<void>
    /** Isi clipboard saat ini (dipotong 4000 karakter), untuk tangkap cepat. */
    readClipboard(): Promise<string>
    /** Dipicu pintasan global: app difokuskan lalu dialog tangkap dibuka. */
    onCapture(cb: () => void): () => void
    subscribe(cb: (items: InboxRow[]) => void): () => void
  }
  reminders: {
    list(): Promise<Reminder[]>
    /** Bisukan/suarakan pengingat untuk satu task; mengembalikan daftar terbaru. */
    mute(taskId: string, muted: boolean): Promise<Reminder[]>
    /** Hentikan pengingat ini sampai besok; mengembalikan daftar terbaru. */
    dismiss(key: string): Promise<Reminder[]>
    subscribe(cb: (reminders: Reminder[]) => void): () => void
    onNew(cb: (reminder: Reminder) => void): () => void
    /** Klik notifikasi Windows: buka task/inbox terkait. */
    onOpen(cb: (reminder: Reminder) => void): () => void
  }
  shortcuts: { status(): Promise<ShortcutStatus> }
}

export const IPC = {
  appInfo: 'app:info',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set-section',
  metricsGet: 'metrics:get',
  metricsUpdate: 'metrics:update',
  viewsUpdate: 'views:update',
  winState: 'win:state',
  captureRequest: 'inbox:capture-request',
  inboxUpdate: 'inbox:update',
  remindersUpdate: 'reminders:update',
  remindersNew: 'reminders:new',
  remindersOpen: 'reminders:open',
  timerIdle: 'time:idle-stopped',
  toolOpen: 'tools:open'
} as const
