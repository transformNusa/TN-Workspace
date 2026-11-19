import { z } from 'zod'

export const STATUSES = ['baru', 'proses', 'menunggu', 'selesai'] as const
export const PRIORITIES = ['rendah', 'normal', 'tinggi', 'urgent'] as const
export type Status = (typeof STATUSES)[number]
export type Priority = (typeof PRIORITIES)[number]

export const STATUS_LABEL: Record<Status, string> = { baru: 'Baru', proses: 'Proses', menunggu: 'Menunggu', selesai: 'Selesai' }
export const PRIORITY_LABEL: Record<Priority, string> = { rendah: 'Rendah', normal: 'Normal', tinggi: 'Tinggi', urgent: 'Urgent' }

export const workspaceInput = z.object({
  name: z.string().trim().min(1, 'Nama workspace wajib diisi').max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Warna tidak valid')
})
export type WorkspaceInput = z.infer<typeof workspaceInput>

export const taskCreateInput = z.object({
  title: z.string().trim().min(1, 'Judul task wajib diisi').max(200),
  workspaceId: z.string().nullable().optional(),
  priority: z.enum(PRIORITIES).optional(),
  dueAt: z.string().nullable().optional(),
  description: z.string().max(10000).optional()
})
export type TaskCreateInput = z.infer<typeof taskCreateInput>

export const taskPatch = z
  .object({
    title: z.string().trim().min(1, 'Judul tidak boleh kosong').max(200),
    description: z.string().max(10000).nullable(),
    workspaceId: z.string().nullable(),
    priority: z.enum(PRIORITIES),
    dueAt: z.string().nullable(),
    resumeNote: z.string().max(500).nullable(),
    recurrenceRule: z.string().nullable()
  })
  .partial()
  .strict()
export type TaskPatch = z.infer<typeof taskPatch>

export type Workspace = { id: string; name: string; color: string; sortOrder: number }

export type TaskRow = {
  id: string
  workspaceId: string | null
  workspaceName: string | null
  workspaceColor: string | null
  title: string
  description: string | null
  status: Status
  priority: Priority
  dueAt: string | null
  waitingSince: string | null
  lastTouchedAt: string | null
  completedAt: string | null
  resumeNote: string | null
  /** Pengingat untuk task ini dibisukan (Fase 4). */
  remindMuted: boolean
  /** Aturan berulang (JSON tersimpan di tasks.recurrence_rule). */
  recurrenceRule: string | null
  createdAt: string
  subtasksTotal: number
  subtasksDone: number
  resourceCount: number
  /** Total detik dari sesi timer yang sudah selesai (sesi berjalan dihitung terpisah di UI). */
  trackedSeconds: number
}

export type Subtask = { id: string; taskId: string; title: string; done: boolean; sortOrder: number }
export type TimeEntryRow = {
  id: string
  taskId: string
  startedAt: string
  endedAt: string | null
  durationSeconds: number | null
  note: string | null
  source: 'manual' | 'auto'
}
export type ActivityRow = { id: string; type: string; payload: Record<string, unknown> | null; at: string }

export type TaskDetail = TaskRow & {
  subtasks: Subtask[]
  resources: ResourceRow[]
  note: string
  entries: TimeEntryRow[]
  activity: ActivityRow[]
}

export type ActiveTimer = { entryId: string; taskId: string; taskTitle: string; startedAt: string }
export type DayStats = { todaySeconds: number; weekSeconds: number }

/** Entri waktu + judul task/workspace untuk grid timesheet. */
export type TimeEntryWithTask = TimeEntryRow & {
  taskTitle: string
  workspaceName: string | null
  workspaceColor: string | null
}

// ----------------------------------------------------------------- berulang
export const RECURRENCE_FREQS = ['weekly', 'monthly'] as const
export type RecurrenceFreq = (typeof RECURRENCE_FREQS)[number]
/** `weekdays` hanya dipakai frekuensi mingguan (0 = Minggu … 6 = Sabtu). */
export type RecurrenceRule = { freq: RecurrenceFreq; interval: number; weekdays: number[] }
export const recurrenceRuleSchema = z.object({
  freq: z.enum(RECURRENCE_FREQS),
  interval: z.number().int().min(1).max(12),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7)
})

export function parseRecurrence(json: string | null): RecurrenceRule | null {
  if (!json) return null
  try {
    const r = recurrenceRuleSchema.safeParse(JSON.parse(json))
    return r.success ? r.data : null
  } catch {
    return null
  }
}

export function describeRecurrence(rule: RecurrenceRule): string {
  if (rule.freq === 'monthly') return rule.interval === 1 ? 'Setiap bulan' : `Setiap ${rule.interval} bulan`
  const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
  const list = rule.weekdays.length ? ` (${rule.weekdays.map((d) => days[d]).join(', ')})` : ''
  return `${rule.interval === 1 ? 'Setiap minggu' : `Setiap ${rule.interval} minggu`}${list}`
}

function withTime(base: Date, source: Date): Date {
  const d = new Date(base)
  d.setHours(source.getHours(), source.getMinutes(), 0, 0)
  return d
}

/** Occurrence berikutnya setelah `from` (dipakai saat task berulang selesai). */
export function nextOccurrence(rule: RecurrenceRule, from: Date): Date {
  if (rule.freq === 'monthly') {
    const d = new Date(from)
    const day = d.getDate()
    d.setDate(1)
    d.setMonth(d.getMonth() + rule.interval)
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    d.setDate(Math.min(day, last))
    return withTime(d, from)
  }
  if (!rule.weekdays.length) {
    const d = new Date(from)
    d.setDate(d.getDate() + 7 * rule.interval)
    return withTime(d, from)
  }
  // Cari hari kerja pertama setelah `from`, lalu tambah (interval-1) minggu.
  const probe = new Date(from)
  probe.setDate(probe.getDate() + 1)
  for (let i = 0; i < 7; i++) {
    if (rule.weekdays.includes(probe.getDay())) {
      probe.setDate(probe.getDate() + (rule.interval - 1) * 7)
      return withTime(probe, from)
    }
    probe.setDate(probe.getDate() + 1)
  }
  const d = new Date(from)
  d.setDate(d.getDate() + 7 * rule.interval)
  return withTime(d, from)
}

// ----------------------------------------------------------------- resource
export const LAUNCHER_APPS = ['vscode', 'kiro', 'godot', 'excel', 'gridcraft'] as const
export type LauncherApp = (typeof LAUNCHER_APPS)[number]
export const LAUNCHER_LABEL: Record<LauncherApp, string> = {
  vscode: 'VS Code', kiro: 'Kiro', godot: 'Godot', excel: 'Excel', gridcraft: 'GridCraft'
}
/** Aplikasi buatan pengguna (Pengaturan → Aplikasi Saya) dirujuk dengan awalan ini. */
export const CUSTOM_APP_PREFIX = 'custom:'
export const customAppRef = (id: string): string => `${CUSTOM_APP_PREFIX}${id}`
export const isCustomApp = (ref: string): boolean => ref.startsWith(CUSTOM_APP_PREFIX)

export const NATIVE_RESOURCE_TYPES = ['folder', 'file', 'launcher', 'tool'] as const
export const WEB_RESOURCE_TYPES = ['whatsapp', 'telegram', 'email', 'ticket', 'url'] as const
export const RESOURCE_TYPES = [...NATIVE_RESOURCE_TYPES, ...WEB_RESOURCE_TYPES] as const
export type ResourceType = (typeof RESOURCE_TYPES)[number]
export const isWebResource = (t: string): boolean => (WEB_RESOURCE_TYPES as readonly string[]).includes(t)

export const PROFILE_SERVICES = ['whatsapp', 'telegram', 'gmail', 'outlook', 'zimbra', 'sunfish', 'support', 'kiro', 'generic'] as const
export type ProfileService = (typeof PROFILE_SERVICES)[number]
export const SERVICE_LABEL: Record<ProfileService, string> = {
  whatsapp: 'WhatsApp', telegram: 'Telegram', gmail: 'Gmail', outlook: 'Outlook', zimbra: 'Zimbra',
  sunfish: 'Sunfish', support: 'Tiket Support', kiro: 'Akun Kiro', generic: 'Browser umum'
}
/** Layanan inti (chat & timesheet) — kelompok sidebar default "Core". */
export const CORE_SERVICES: ProfileService[] = ['whatsapp', 'telegram', 'sunfish']
/** Kelompok sidebar default bila profil belum diisi grupnya sendiri. */
export function defaultProfileGroup(service: ProfileService): string {
  return CORE_SERVICES.includes(service) ? 'Core' : 'Web'
}
export function resourceTypeForService(s: ProfileService): (typeof WEB_RESOURCE_TYPES)[number] {
  if (s === 'whatsapp') return 'whatsapp'
  if (s === 'telegram') return 'telegram'
  if (s === 'gmail' || s === 'outlook' || s === 'zimbra') return 'email'
  if (s === 'support') return 'ticket'
  return 'url'
}

const httpUrl = /^https?:\/\/\S+$/i

export const resourceInput = z
  .object({
    type: z.enum(RESOURCE_TYPES),
    title: z.string().trim().min(1, 'Nama resource wajib diisi').max(120),
    target: z.string().trim().max(1000).optional(),
    launcherApp: z.string().trim().min(1).max(60).optional(),
    profileId: z.string().min(1).nullable().optional(),
    /** Untuk resource hasil tool (type 'tool'). */
    toolId: z.string().trim().min(1).max(60).optional()
  })
  .superRefine((v, ctx) => {
    if (v.type === 'launcher' && !v.launcherApp) ctx.addIssue({ code: 'custom', message: 'Pilih aplikasi untuk resource ini' })
    if (v.type === 'tool' && !v.toolId) ctx.addIssue({ code: 'custom', message: 'Tool untuk resource ini tidak diketahui' })
    if (isWebResource(v.type)) {
      if (v.type !== 'url' && !v.profileId) ctx.addIssue({ code: 'custom', message: 'Pilih layanan web untuk resource ini' })
      if (v.type === 'url' && !v.profileId && !v.target) ctx.addIssue({ code: 'custom', message: 'Isi alamat atau pilih layanan web' })
      if (v.target && !httpUrl.test(v.target)) ctx.addIssue({ code: 'custom', message: 'Link harus diawali http:// atau https://' })
    } else if (!v.target && v.type !== 'launcher' && v.type !== 'tool') {
      ctx.addIssue({ code: 'custom', message: 'Target wajib diisi' })
    }
  })
export type ResourceInput = z.infer<typeof resourceInput>

export type ResourceRow = {
  id: string
  taskId: string
  type: ResourceType | 'tool'
  title: string
  target: string | null
  launcherApp: string | null
  profileId: string | null
  profileName: string | null
  toolId: string | null
}

// ------------------------------------------------------------------ template
export const templateInput = z.object({
  name: z.string().trim().min(1, 'Nama template wajib diisi').max(120),
  workspaceId: z.string().nullable().optional(),
  priority: z.enum(PRIORITIES).optional(),
  subtasks: z.array(z.string().trim().min(1).max(200)).max(50),
  resources: z.array(resourceInput).max(30),
  recurrenceRule: recurrenceRuleSchema.nullable().optional()
})
export type TemplateInput = z.infer<typeof templateInput>

export type TemplateRow = {
  id: string
  name: string
  workspaceId: string | null
  workspaceName: string | null
  priority: Priority
  subtasks: string[]
  resources: ResourceInput[]
  recurrenceRule: RecurrenceRule | null
  createdAt: string
}

// ------------------------------------------------------------------- snippet
export const snippetInput = z.object({
  title: z.string().trim().min(1, 'Judul snippet wajib diisi').max(80),
  body: z.string().trim().min(1, 'Isi snippet wajib diisi').max(4000)
})
export type SnippetInput = z.infer<typeof snippetInput>

export type SnippetRow = { id: string; title: string; body: string; variables: string[]; updatedAt: string }

/** Variabel `{nama}` yang dipakai di body snippet (unik, urut kemunculan). */
export function snippetVariables(body: string): string[] {
  const out: string[] = []
  for (const m of body.matchAll(/\{([a-zA-Z0-9_]+)\}/g)) if (!out.includes(m[1])) out.push(m[1])
  return out
}

export function fillSnippet(body: string, values: Record<string, string>): string {
  return body.replace(/\{([a-zA-Z0-9_]+)\}/g, (all, key: string) => values[key] ?? all)
}

export type WebTarget = { profileId: string; url?: string }
export type LaunchResult = { ok: boolean; message?: string; web?: WebTarget }
export type OpenAllResult = { opened: number; failed: { title: string; message: string }[]; web: WebTarget[]; webSkipped: number }

// ------------------------------------------------------------------- inbox
export const INBOX_SOURCES = ['whatsapp', 'telegram', 'email', 'ticket', 'manual'] as const
export type InboxSource = (typeof INBOX_SOURCES)[number]
export const INBOX_SOURCE_LABEL: Record<InboxSource, string> = {
  whatsapp: 'WhatsApp', telegram: 'Telegram', email: 'Email', ticket: 'Tiket', manual: 'Manual'
}

export const INBOX_STATUSES = ['baru', 'ditunda', 'dijadikan_task', 'diabaikan'] as const
export type InboxStatus = (typeof INBOX_STATUSES)[number]
export const INBOX_STATUS_LABEL: Record<InboxStatus, string> = {
  baru: 'Baru', ditunda: 'Ditunda', dijadikan_task: 'Sudah jadi task', diabaikan: 'Diabaikan'
}

/** `#1234` pada teks tangkapan = nomor tiket (bible 9.4). */
export function parseTicketRef(text: string): string | null {
  const m = /(?:^|[\s(])#(\d{2,10})\b/.exec(text)
  return m ? m[1] : null
}

/** Tautan pertama pada teks tangkapan, dipakai untuk tombol "Buka tautan". */
export function parseFirstUrl(text: string): string | null {
  const m = /https?:\/\/[^\s<>"']+/i.exec(text)
  return m ? m[0].replace(/[),.;!?]+$/, '') : null
}

/** Judul task dari isi tangkapan: baris pertama yang tidak kosong. */
export function inboxTitle(preview: string): string {
  const first = preview.split(/\r?\n/).map((s) => s.trim()).find(Boolean) ?? ''
  return first.length > 200 ? `${first.slice(0, 197)}…` : first
}

export const inboxInput = z.object({
  source: z.enum(INBOX_SOURCES),
  sender: z.string().trim().max(120).nullish().transform((v) => (v ? v : null)),
  preview: z.string().trim().min(1, 'Isi item tidak boleh kosong').max(4000),
  receivedAt: z.string().nullish()
})
export type InboxInput = z.input<typeof inboxInput>

export const inboxTaskInput = z.object({
  /** Kosong = diambil dari baris pertama isi item. */
  title: z.string().trim().max(200).optional(),
  workspaceId: z.string().nullable().optional(),
  priority: z.enum(PRIORITIES).optional(),
  dueAt: z.string().nullable().optional()
})
export type InboxTaskInput = z.input<typeof inboxTaskInput>

export type InboxRow = {
  id: string
  createdAt: string
  updatedAt: string
  source: InboxSource
  sender: string | null
  preview: string
  receivedAt: string | null
  status: InboxStatus
  /** Nomor tiket hasil pola `#1234`. */
  ticketRef: string | null
  /** Tautan pertama pada isi tangkapan. */
  url: string | null
  linkedTaskId: string | null
  linkedTaskTitle: string | null
  snoozeUntil: string | null
}

// ---------------------------------------------------------------- pengingat
export const REMINDER_KINDS = ['overdue', 'waiting', 'stale', 'inbox', 'timesheet'] as const
export type ReminderKind = (typeof REMINDER_KINDS)[number]
/** Satu pengingat siap tampil. `key` dipakai untuk mendeduplikasi notifikasi dan menunda. */
export type Reminder = {
  key: string
  kind: ReminderKind
  title: string
  body: string
  taskId?: string
  inboxId?: string
}

/** Baris ringkas yang dibutuhkan penjadwal pengingat (tanpa kolom UI). */
export type ReminderTaskLite = {
  id: string
  title: string
  status: Status
  dueAt: string | null
  waitingSince: string | null
  lastTouchedAt: string | null
  createdAt: string
  remindMuted: boolean
}

export type ReminderInboxLite = {
  id: string
  preview: string
  createdAt: string
  receivedAt: string | null
  status: InboxStatus
  snoozeUntil: string | null
}

// ----------------------------------------------------------------- profil web
export const profileInput = z.object({
  name: z.string().trim().min(1, 'Nama profil wajib diisi').max(60),
  service: z.enum(PROFILE_SERVICES),
  homeUrl: z.string().trim().max(1000).refine((v) => v === '' || httpUrl.test(v), 'URL awal harus diawali http:// atau https://').transform((v) => v || null),
  keepAlive: z.boolean(),
  nativeOnly: z.boolean(),
  nativePath: z.string().trim().max(1000).transform((v) => v || null),
  /** Buka di browser bawaan (satu tab) alih-alih panel tertanam — untuk layanan yang menolak login di dalam app. */
  external: z.boolean().default(false),
  /** Kelompok di sidebar (mis. Core, Web). Kosong = otomatis dari jenis layanan. */
  groupName: z.string().trim().max(40).default('')
})
export type ProfileInput = z.input<typeof profileInput>

export type ProfileRow = {
  id: string
  name: string
  partitionId: string
  service: ProfileService
  groupName: string
  homeUrl: string | null
  keepAlive: boolean
  nativeOnly: boolean
  nativePath: string | null
  external: boolean
}

export type ViewState = 'active' | 'warm' | 'hibernated' | 'idle'
export type ViewInfo = {
  profileId: string
  name: string
  service: ProfileService
  state: ViewState
  url: string | null
  title: string
  badge: number
  loading: boolean
  error: string | null
  memoryMb: number | null
  keepAlive: boolean
  /** Situs menolak login dari browser tertanam (mis. Google). UI menawarkan "Buka di Chrome". */
  loginBlocked: 'google' | null
}
export type SlotBounds = { x: number; y: number; width: number; height: number }
export type ViewSlot = { profileId: string; bounds: SlotBounds }
