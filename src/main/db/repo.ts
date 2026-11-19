import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import {
  STATUSES, INBOX_SOURCE_LABEL, nextOccurrence, parseRecurrence, snippetInput, templateInput,
  inboxInput, inboxTaskInput, inboxTitle, parseFirstUrl, parseTicketRef, defaultProfileGroup,
  profileInput, resourceInput, taskCreateInput, taskPatch, workspaceInput,
  type ActiveTimer, type ActivityRow, type DayStats, type InboxRow, type ProfileRow, type ReminderInboxLite,
  type ReminderTaskLite, type ResourceRow, type SnippetRow, type Status, type Subtask, type TaskDetail,
  type TaskRow, type TemplateRow, type TimeEntryRow, type TimeEntryWithTask, type Workspace
} from '@shared/data'
import { openDb } from './index'

const db = () => openDb()
const nowIso = (): string => new Date().toISOString()

/** Parse dengan zod dan lempar Error berpesan manusiawi (bukan JSON mentah). */
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value)
  if (!r.success) throw new Error(r.error.issues.map((i) => i.message).join('; '))
  return r.data
}

function log(taskId: string, type: string, payload?: Record<string, unknown>): void {
  db()
    .prepare('INSERT INTO activity_log (id, task_id, type, payload_json, at) VALUES (?, ?, ?, ?, ?)')
    .run(randomUUID(), taskId, type, payload ? JSON.stringify(payload) : null, nowIso())
}

function touch(taskId: string): void {
  const t = nowIso()
  db().prepare('UPDATE tasks SET last_touched_at = ?, updated_at = ? WHERE id = ?').run(t, t, taskId)
}

// ---------------------------------------------------------------- workspaces
export function listWorkspaces(): Workspace[] {
  return db()
    .prepare('SELECT id, name, color, sort_order AS sortOrder FROM workspaces WHERE archived = 0 ORDER BY sort_order, created_at')
    .all() as Workspace[]
}

export function createWorkspace(raw: unknown): Workspace {
  const input = parse(workspaceInput, raw)
  const id = randomUUID()
  const max = (db().prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM workspaces').get() as { m: number }).m
  db()
    .prepare('INSERT INTO workspaces (id, name, color, sort_order) VALUES (?, ?, ?, ?)')
    .run(id, input.name, input.color, max + 1)
  return { id, name: input.name, color: input.color, sortOrder: max + 1 }
}

export function updateWorkspace(id: string, raw: unknown): void {
  const input = parse(workspaceInput, raw)
  db()
    .prepare('UPDATE workspaces SET name = ?, color = ?, updated_at = ? WHERE id = ?')
    .run(input.name, input.color, nowIso(), id)
}

export function archiveWorkspace(id: string): void {
  db().prepare('UPDATE workspaces SET archived = 1, updated_at = ? WHERE id = ?').run(nowIso(), id)
}

/** Buat workspace contoh sekali saja (tidak kembali lagi bila dihapus pengguna). */
export function seedDefaultsOnce(): void {
  const d = db()
  if (d.prepare("SELECT 1 FROM settings WHERE key = 'meta.seeded'").get()) return
  const defaults: [string, string][] = [
    ['Support Tiket', '#6366f1'], ['Laporan Mingguan', '#10b981'], ['Development', '#0ea5e9'],
    ['Admin & HR', '#f59e0b'], ['Proyek Game Kampung', '#84cc16']
  ]
  d.transaction(() => {
    if ((d.prepare('SELECT COUNT(*) AS c FROM workspaces').get() as { c: number }).c === 0) {
      for (const [name, color] of defaults) createWorkspace({ name, color })
    }
    d.prepare("INSERT INTO settings (key, value_json) VALUES ('meta.seeded', '1')").run()
  })()
}

// --------------------------------------------------------------------- tasks
const TASK_SELECT = `
  SELECT t.id, t.workspace_id AS workspaceId, w.name AS workspaceName, w.color AS workspaceColor,
         t.title, t.description, t.status, t.priority, t.due_at AS dueAt, t.waiting_since AS waitingSince,
         t.last_touched_at AS lastTouchedAt, t.completed_at AS completedAt, t.resume_note AS resumeNote,
         t.remind_muted AS remindMuted, t.recurrence_rule AS recurrenceRule, t.created_at AS createdAt,
         (SELECT COUNT(*) FROM subtasks s WHERE s.task_id = t.id) AS subtasksTotal,
         (SELECT COUNT(*) FROM subtasks s WHERE s.task_id = t.id AND s.done = 1) AS subtasksDone,
         (SELECT COUNT(*) FROM task_resources r WHERE r.task_id = t.id) AS resourceCount,
         COALESCE((SELECT SUM(e.duration_seconds) FROM time_entries e WHERE e.task_id = t.id), 0) AS trackedSeconds
  FROM tasks t LEFT JOIN workspaces w ON w.id = t.workspace_id`

type TaskDbRow = Omit<TaskRow, 'remindMuted'> & { remindMuted: number }
const toTaskRow = (r: TaskDbRow): TaskRow => ({ ...r, remindMuted: r.remindMuted === 1 })

export function listTasks(): TaskRow[] {
  return (db().prepare(`${TASK_SELECT} ORDER BY t.created_at DESC`).all() as TaskDbRow[]).map(toTaskRow)
}

function getTaskRow(id: string): TaskRow | undefined {
  const row = db().prepare(`${TASK_SELECT} WHERE t.id = ?`).get(id) as TaskDbRow | undefined
  return row ? toTaskRow(row) : undefined
}

export function getTask(id: string): TaskDetail | null {
  const row = getTaskRow(id)
  if (!row) return null
  const d = db()
  const subtasks = (
    d.prepare('SELECT id, task_id AS taskId, title, done, sort_order AS sortOrder FROM subtasks WHERE task_id = ? ORDER BY sort_order, created_at').all(id) as (Omit<Subtask, 'done'> & { done: number })[]
  ).map((s) => ({ ...s, done: s.done === 1 }))
  const note = (d.prepare('SELECT content_md AS c FROM notes WHERE task_id = ?').get(id) as { c: string } | undefined)?.c ?? ''
  const entries = d
    .prepare('SELECT id, task_id AS taskId, started_at AS startedAt, ended_at AS endedAt, duration_seconds AS durationSeconds, source FROM time_entries WHERE task_id = ? ORDER BY started_at DESC LIMIT 50')
    .all(id) as TimeEntryRow[]
  const activity = (
    d.prepare('SELECT id, type, payload_json AS payloadJson, at FROM activity_log WHERE task_id = ? ORDER BY at DESC LIMIT 100').all(id) as { id: string; type: string; payloadJson: string | null; at: string }[]
  ).map((a): ActivityRow => ({ id: a.id, type: a.type, at: a.at, payload: a.payloadJson ? JSON.parse(a.payloadJson) : null }))
  return { ...row, subtasks, resources: listResources(id), note, entries, activity }
}

export function createTask(raw: unknown): TaskRow {
  const input = parse(taskCreateInput, raw)
  const id = randomUUID()
  const now = nowIso()
  db()
    .prepare('INSERT INTO tasks (id, workspace_id, title, description, priority, due_at, last_touched_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, input.workspaceId ?? null, input.title, input.description?.trim() || null, input.priority ?? 'normal', input.dueAt ?? null, now)
  log(id, 'dibuat')
  return getTaskRow(id)!
}

const PATCH_COLUMNS: Record<string, string> = {
  title: 'title', description: 'description', workspaceId: 'workspace_id',
  priority: 'priority', dueAt: 'due_at', resumeNote: 'resume_note', recurrenceRule: 'recurrence_rule'
}

export function updateTask(id: string, raw: unknown): void {
  const patch = parse(taskPatch, raw) as Record<string, unknown>
  const cols: string[] = []
  const vals: unknown[] = []
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue
    cols.push(`${PATCH_COLUMNS[k]} = ?`)
    vals.push(typeof v === 'string' && (k === 'description' || k === 'resumeNote') && v.trim() === '' ? null : v)
  }
  if (!cols.length) return
  const now = nowIso()
  db().prepare(`UPDATE tasks SET ${cols.join(', ')}, updated_at = ?, last_touched_at = ? WHERE id = ?`).run(...vals, now, now, id)
}

export function setStatus(id: string, status: Status): void {
  if (!(STATUSES as readonly string[]).includes(status)) throw new Error('Status tidak valid')
  const d = db()
  d.transaction(() => {
    const cur = d.prepare('SELECT status FROM tasks WHERE id = ?').get(id) as { status: Status } | undefined
    if (!cur) throw new Error('Task tidak ditemukan')
    if (cur.status === status) return
    const now = nowIso()
    // Task yang menunggu atau selesai tidak boleh punya timer berjalan.
    if (status === 'menunggu' || status === 'selesai') stopTaskTimersInner(id, undefined)
    if (status === 'menunggu') {
      d.prepare('UPDATE tasks SET status = ?, waiting_since = ?, completed_at = NULL WHERE id = ?').run(status, now, id)
    } else if (status === 'selesai') {
      d.prepare('UPDATE tasks SET status = ?, completed_at = ?, waiting_since = NULL WHERE id = ?').run(status, now, id)
    } else {
      d.prepare('UPDATE tasks SET status = ?, waiting_since = NULL, completed_at = NULL WHERE id = ?').run(status, id)
    }
    log(id, 'status_changed', { from: cur.status, to: status })
    touch(id)
    if (status === 'selesai') createNextOccurrence(id)
  })()
}

/**
 * Buat occurrence berikutnya untuk task berulang (Fase 5). Dipanggil di dalam transaksi setStatus.
 * `recurrence_parent_id` mencegah duplication saat status bolak-balik selesai → proses → selesai.
 */
function createNextOccurrence(taskId: string): string | null {
  const d = db()
  const t = getTaskRow(taskId)
  const rule = parseRecurrence(t?.recurrenceRule ?? null)
  if (!t || !rule) return null
  if (d.prepare('SELECT 1 FROM tasks WHERE recurrence_parent_id = ?').get(taskId)) return null
  const base = t.dueAt ? new Date(t.dueAt) : new Date()
  const due = nextOccurrence(rule, base)
  const child = createTask({
    title: t.title,
    workspaceId: t.workspaceId,
    priority: t.priority,
    dueAt: due.toISOString(),
    description: t.description ?? undefined
  })
  d.prepare('UPDATE tasks SET recurrence_rule = ?, recurrence_parent_id = ? WHERE id = ?').run(t.recurrenceRule, taskId, child.id)
  const subs = d.prepare('SELECT title, sort_order AS sortOrder FROM subtasks WHERE task_id = ? ORDER BY sort_order').all(taskId) as { title: string; sortOrder: number }[]
  for (const s of subs) d.prepare('INSERT INTO subtasks (id, task_id, title, sort_order) VALUES (?, ?, ?, ?)').run(randomUUID(), child.id, s.title, s.sortOrder)
  for (const r of listResources(taskId)) {
    d.prepare('INSERT INTO task_resources (id, task_id, type, title, target, launcher_app, profile_id, tool_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(randomUUID(), child.id, r.type, r.title, r.target, r.launcherApp, r.profileId, r.toolId)
  }
  log(taskId, 'recurrence_created', { childId: child.id, dueAt: due.toISOString() })
  return child.id
}

export function removeTask(id: string): void {
  const d = db()
  d.transaction(() => {
    stopTaskTimersInner(id, undefined)
    d.prepare('DELETE FROM tasks WHERE id = ?').run(id)
  })()
}

// ----------------------------------------------------------------- subtasks
export function addSubtask(taskId: string, title: string): void {
  const t = parse(z.string().trim().min(1, 'Judul subtask wajib diisi').max(200), title)
  const max = (db().prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM subtasks WHERE task_id = ?').get(taskId) as { m: number }).m
  db().prepare('INSERT INTO subtasks (id, task_id, title, sort_order) VALUES (?, ?, ?, ?)').run(randomUUID(), taskId, t, max + 1)
  touch(taskId)
}

export function setSubtaskDone(id: string, done: boolean): void {
  const s = db().prepare('SELECT task_id AS taskId, title FROM subtasks WHERE id = ?').get(id) as { taskId: string; title: string } | undefined
  if (!s) return
  db().prepare('UPDATE subtasks SET done = ?, updated_at = ? WHERE id = ?').run(done ? 1 : 0, nowIso(), id)
  if (done) log(s.taskId, 'subtask_done', { title: s.title })
  touch(s.taskId)
}

export function renameSubtask(id: string, title: string): void {
  const t = parse(z.string().trim().min(1, 'Judul subtask wajib diisi').max(200), title)
  const s = db().prepare('SELECT task_id AS taskId FROM subtasks WHERE id = ?').get(id) as { taskId: string } | undefined
  if (!s) return
  db().prepare('UPDATE subtasks SET title = ?, updated_at = ? WHERE id = ?').run(t, nowIso(), id)
  touch(s.taskId)
}

export function removeSubtask(id: string): void {
  const s = db().prepare('SELECT task_id AS taskId FROM subtasks WHERE id = ?').get(id) as { taskId: string } | undefined
  if (!s) return
  db().prepare('DELETE FROM subtasks WHERE id = ?').run(id)
  touch(s.taskId)
}

// -------------------------------------------------------------------- notes
export function saveNote(taskId: string, content: string): void {
  const c = parse(z.string().max(200000), content)
  const d = db()
  const ex = d.prepare('SELECT id FROM notes WHERE task_id = ?').get(taskId) as { id: string } | undefined
  if (ex) d.prepare('UPDATE notes SET content_md = ?, updated_at = ? WHERE id = ?').run(c, nowIso(), ex.id)
  else d.prepare('INSERT INTO notes (id, task_id, content_md) VALUES (?, ?, ?)').run(randomUUID(), taskId, c)
  touch(taskId)
}

// ------------------------------------------------------------- catatan cepat
/** Satu catatan global untuk tool bawaan "Catatan" (scratchpad). */
const QUICK_NOTE_ID = 'utama'

export function getQuickNote(): string {
  const row = db().prepare('SELECT content FROM quick_notes WHERE id = ?').get(QUICK_NOTE_ID) as { content: string } | undefined
  return row?.content ?? ''
}

export function saveQuickNote(content: string): void {
  const text = parse(z.string().max(200000), content)
  db()
    .prepare(
      `INSERT INTO quick_notes (id, content, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`
    )
    .run(QUICK_NOTE_ID, text, nowIso())
}

// -------------------------------------------------------------------- timer
/** Semua timer yang sedang berjalan (boleh lebih dari satu task sekaligus). */
export function listActiveTimers(): ActiveTimer[] {
  return db()
    .prepare(
      `SELECT e.id AS entryId, e.task_id AS taskId, t.title AS taskTitle, e.started_at AS startedAt
       FROM time_entries e JOIN tasks t ON t.id = e.task_id
       WHERE e.ended_at IS NULL ORDER BY e.started_at`
    )
    .all() as ActiveTimer[]
}

/** Tutup semua entri timer milik satu task; mengembalikan jumlah entri yang ditutup. */
function stopTaskTimersInner(taskId: string, resumeNote: string | undefined): number {
  const d = db()
  const rows = d.prepare('SELECT id, started_at AS startedAt FROM time_entries WHERE task_id = ? AND ended_at IS NULL').all(taskId) as {
    id: string; startedAt: string
  }[]
  const now = nowIso()
  for (const r of rows) {
    const seconds = Math.max(0, Math.round((Date.parse(now) - Date.parse(r.startedAt)) / 1000))
    d.prepare('UPDATE time_entries SET ended_at = ?, duration_seconds = ?, updated_at = ? WHERE id = ?').run(now, seconds, now, r.id)
    log(taskId, 'timer_stopped', { seconds })
  }
  if (rows.length) {
    if (resumeNote !== undefined) {
      d.prepare('UPDATE tasks SET resume_note = ? WHERE id = ?').run(resumeNote.trim() === '' ? null : resumeNote.trim().slice(0, 500), taskId)
    }
    touch(taskId)
  }
  return rows.length
}

/** Jeda timer satu task (tombol Jeda, atau status berubah jadi menunggu/selesai). */
export function stopTimerForTask(taskId: string, resumeNote?: string): void {
  db().transaction(() => stopTaskTimersInner(taskId, resumeNote))()
}

function stopAllTimersInner(resumeNote: string | undefined): void {
  const d = db()
  const rows = d.prepare('SELECT id, task_id AS taskId, started_at AS startedAt FROM time_entries WHERE ended_at IS NULL').all() as {
    id: string; taskId: string; startedAt: string
  }[]
  const now = nowIso()
  for (const r of rows) {
    const seconds = Math.max(0, Math.round((Date.parse(now) - Date.parse(r.startedAt)) / 1000))
    d.prepare('UPDATE time_entries SET ended_at = ?, duration_seconds = ?, updated_at = ? WHERE id = ?').run(now, seconds, now, r.id)
    if (resumeNote !== undefined) {
      d.prepare('UPDATE tasks SET resume_note = ? WHERE id = ?').run(resumeNote.trim() === '' ? null : resumeNote.trim().slice(0, 500), r.taskId)
    }
    log(r.taskId, 'timer_stopped', { seconds })
    touch(r.taskId)
  }
}

/** Jeda semua timer berjalan (tombol "Jeda semua" atau saat app ditutup). */
export function stopTimer(resumeNote?: string): void {
  db().transaction(() => stopAllTimersInner(resumeNote))()
}

export function startTimer(taskId: string, source: 'manual' | 'auto' = 'manual'): void {
  const d = db()
  d.transaction(() => {
    const t = d.prepare('SELECT status FROM tasks WHERE id = ?').get(taskId) as { status: Status } | undefined
    if (!t) throw new Error('Task tidak ditemukan')
    if (t.status === 'selesai') throw new Error('Task sudah selesai. Buka kembali dulu untuk memulai timer.')
    // Timer task lain tetap berjalan; task ini cukup punya satu entri terbuka.
    if (d.prepare('SELECT 1 FROM time_entries WHERE task_id = ? AND ended_at IS NULL').get(taskId)) return
    d.prepare('INSERT INTO time_entries (id, task_id, started_at, source) VALUES (?, ?, ?, ?)').run(randomUUID(), taskId, nowIso(), source)
    if (t.status !== 'proses') {
      d.prepare("UPDATE tasks SET status = 'proses', waiting_since = NULL WHERE id = ?").run(taskId)
      log(taskId, 'status_changed', { from: t.status, to: 'proses' })
    }
    log(taskId, 'timer_started', { source })
    touch(taskId)
  })()
}

/** Hentikan timer karena idle, potong durasi sampai detik terakhir aktif (`cutoff`). */
export function stopTimerIdle(cutoff: Date): { taskId: string; taskTitle: string; seconds: number }[] {
  const d = db()
  const stopped: { taskId: string; taskTitle: string; seconds: number }[] = []
  d.transaction(() => {
    const rows = d.prepare(
      `SELECT e.id, e.task_id AS taskId, t.title AS taskTitle, e.started_at AS startedAt
       FROM time_entries e JOIN tasks t ON t.id = e.task_id WHERE e.ended_at IS NULL`
    ).all() as { id: string; taskId: string; taskTitle: string; startedAt: string }[]
    for (const r of rows) {
      const start = Date.parse(r.startedAt)
      const end = Math.max(start, Math.min(cutoff.getTime(), Date.now()))
      const seconds = Math.round((end - start) / 1000)
      d.prepare("UPDATE time_entries SET ended_at = ?, duration_seconds = ?, source = 'auto', updated_at = ? WHERE id = ?")
        .run(new Date(end).toISOString(), seconds, nowIso(), r.id)
      log(r.taskId, 'timer_idle', { seconds })
      touch(r.taskId)
      stopped.push({ taskId: r.taskId, taskTitle: r.taskTitle, seconds })
    }
  })()
  return stopped
}

/** Dipanggil tiap menit selama app hidup, supaya timer yang tertinggal akibat crash tetap bisa dipulihkan. */
export function heartbeat(): void {
  db().prepare('UPDATE time_entries SET updated_at = ? WHERE ended_at IS NULL').run(nowIso())
}

/** Saat start: sesi yang menggantung (crash/mati listrik) ditutup pada detak jantung terakhir. */
export function recoverDanglingTimers(): number {
  const d = db()
  const rows = d.prepare('SELECT id, started_at AS startedAt, updated_at AS updatedAt FROM time_entries WHERE ended_at IS NULL').all() as {
    id: string; startedAt: string; updatedAt: string
  }[]
  for (const r of rows) {
    const end = Math.max(Date.parse(r.startedAt), Math.min(Date.parse(r.updatedAt), Date.now()))
    d.prepare('UPDATE time_entries SET ended_at = ?, duration_seconds = ? WHERE id = ?').run(
      new Date(end).toISOString(), Math.round((end - Date.parse(r.startedAt)) / 1000), r.id
    )
  }
  return rows.length
}

export function dayStats(): DayStats {
  const sod = new Date()
  sod.setHours(0, 0, 0, 0)
  const sow = new Date(sod)
  sow.setDate(sow.getDate() - ((sod.getDay() + 6) % 7)) // Senin
  const sum = db().prepare(
    `SELECT COALESCE(SUM(COALESCE(duration_seconds, CAST((julianday('now') - julianday(started_at)) * 86400 AS INTEGER))), 0) AS s
     FROM time_entries WHERE started_at >= ?`
  )
  return {
    todaySeconds: (sum.get(sod.toISOString()) as { s: number }).s,
    weekSeconds: (sum.get(sow.toISOString()) as { s: number }).s
  }
}

// ----------------------------------------------------------------- timesheet
const TIME_SELECT = `
  SELECT e.id, e.task_id AS taskId, e.started_at AS startedAt, e.ended_at AS endedAt,
         e.duration_seconds AS durationSeconds, e.source, e.note,
         t.title AS taskTitle, w.name AS workspaceName, w.color AS workspaceColor
  FROM time_entries e
  JOIN tasks t ON t.id = e.task_id
  LEFT JOIN workspaces w ON w.id = t.workspace_id`

/** Entri waktu dalam rentang [from, to) untuk grid timesheet. */
export function listTimeEntries(fromIso: string, toIso: string): TimeEntryWithTask[] {
  return db()
    .prepare(`${TIME_SELECT} WHERE e.started_at >= ? AND e.started_at < ? ORDER BY e.started_at`)
    .all(fromIso, toIso) as TimeEntryWithTask[]
}

const timeEntryPatchSchema = z.object({
  startedAt: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Waktu mulai tidak valid'),
  endedAt: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Waktu selesai tidak valid'),
  note: z.string().max(500).nullable().optional()
})

function durationBetween(startIso: string, endIso: string): number {
  return Math.max(0, Math.round((Date.parse(endIso) - Date.parse(startIso)) / 1000))
}

/** Edit manual satu entri (Fase 5: "entri otomatis bisa diedit manual"). */
export function updateTimeEntry(id: string, raw: unknown): void {
  const p = parse(timeEntryPatchSchema, raw)
  const exists = db().prepare('SELECT task_id AS taskId FROM time_entries WHERE id = ?').get(id) as { taskId: string } | undefined
  if (!exists) throw new Error('Entri waktu tidak ditemukan')
  const end = Date.parse(p.endedAt)
  if (end < Date.parse(p.startedAt)) throw new Error('Waktu selesai harus setelah waktu mulai')
  db()
    .prepare('UPDATE time_entries SET started_at = ?, ended_at = ?, duration_seconds = ?, note = ?, updated_at = ? WHERE id = ?')
    .run(p.startedAt, p.endedAt, durationBetween(p.startedAt, p.endedAt), p.note?.trim() || null, nowIso(), id)
  log(exists.taskId, 'time_entry_updated', { entryId: id })
  touch(exists.taskId)
}

/** Tambah entri manual dari grid timesheet. */
export function addTimeEntry(taskId: string, raw: unknown): void {
  const p = parse(timeEntryPatchSchema, raw)
  if (!db().prepare('SELECT 1 FROM tasks WHERE id = ?').get(taskId)) throw new Error('Task tidak ditemukan')
  if (Date.parse(p.endedAt) < Date.parse(p.startedAt)) throw new Error('Waktu selesai harus setelah waktu mulai')
  db()
    .prepare("INSERT INTO time_entries (id, task_id, started_at, ended_at, duration_seconds, note, source) VALUES (?, ?, ?, ?, ?, ?, 'manual')")
    .run(randomUUID(), taskId, p.startedAt, p.endedAt, durationBetween(p.startedAt, p.endedAt), p.note?.trim() || null)
  log(taskId, 'time_entry_added', { startedAt: p.startedAt })
  touch(taskId)
}

export function markEntriesSynced(fromIso: string, toIso: string, synced: boolean): number {
  const r = db()
    .prepare('UPDATE time_entries SET synced_to_sunfish = ?, updated_at = ? WHERE ended_at IS NOT NULL AND started_at >= ? AND started_at < ?')
    .run(synced ? 1 : 0, nowIso(), fromIso, toIso)
  return r.changes
}

export function unsyncedEntriesCount(fromIso: string, toIso: string): number {
  return (db()
    .prepare('SELECT COUNT(*) AS c FROM time_entries WHERE ended_at IS NOT NULL AND synced_to_sunfish = 0 AND started_at >= ? AND started_at < ?')
    .get(fromIso, toIso) as { c: number }).c
}

// ---------------------------------------------------------------- resources
const RESOURCE_SELECT = `
  SELECT r.id, r.task_id AS taskId, r.type, r.title, r.target, r.launcher_app AS launcherApp,
         r.profile_id AS profileId, p.name AS profileName, r.tool_id AS toolId
  FROM task_resources r LEFT JOIN profiles p ON p.id = r.profile_id`

export function listResources(taskId: string): ResourceRow[] {
  return db().prepare(`${RESOURCE_SELECT} WHERE r.task_id = ? ORDER BY r.created_at, r.rowid`).all(taskId) as ResourceRow[]
}

export function getResource(id: string): ResourceRow | null {
  return (db().prepare(`${RESOURCE_SELECT} WHERE r.id = ?`).get(id) as ResourceRow | undefined) ?? null
}

export function addResource(taskId: string, raw: unknown): void {
  const r = parse(resourceInput, raw)
  if (!db().prepare('SELECT 1 FROM tasks WHERE id = ?').get(taskId)) throw new Error('Task tidak ditemukan')
  if (r.profileId && !db().prepare('SELECT 1 FROM profiles WHERE id = ?').get(r.profileId)) throw new Error('Layanan web tidak ditemukan')
  db()
    .prepare('INSERT INTO task_resources (id, task_id, type, title, target, launcher_app, profile_id, tool_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(randomUUID(), taskId, r.type, r.title, r.target || null, r.type === 'launcher' ? r.launcherApp ?? null : null, r.profileId ?? null, r.toolId ?? null)
  touch(taskId)
}

export function removeResource(id: string): void {
  const r = getResource(id)
  if (!r) return
  db().prepare('DELETE FROM task_resources WHERE id = ?').run(id)
  touch(r.taskId)
}

export function noteResourcesOpened(taskId: string, count: number): void {
  log(taskId, 'resource_dibuka', { count })
  touch(taskId)
}

export function touchTask(taskId: string): void {
  touch(taskId)
}

// ----------------------------------------------------------------- profiles
type ProfileDbRow = Omit<ProfileRow, 'keepAlive' | 'nativeOnly' | 'external'> & { keepAlive: number; nativeOnly: number; external: number }
const PROFILE_SELECT = `SELECT id, name, partition_id AS partitionId, service, group_name AS groupName, home_url AS homeUrl, keep_alive AS keepAlive,
  native_only AS nativeOnly, native_path AS nativePath, external FROM profiles`
const toProfile = (r: ProfileDbRow): ProfileRow => ({
  ...r, keepAlive: r.keepAlive === 1, nativeOnly: r.nativeOnly === 1, external: r.external === 1
})

export function listProfiles(): ProfileRow[] {
  return (db().prepare(`${PROFILE_SELECT} ORDER BY created_at, rowid`).all() as ProfileDbRow[]).map(toProfile)
}

export function getProfile(id: string | null | undefined): ProfileRow | null {
  if (!id) return null
  const r = db().prepare(`${PROFILE_SELECT} WHERE id = ?`).get(id) as ProfileDbRow | undefined
  return r ? toProfile(r) : null
}

export function createProfile(raw: unknown): ProfileRow {
  const p = parse(profileInput, raw)
  const id = randomUUID()
  db()
    .prepare('INSERT INTO profiles (id, name, partition_id, service, group_name, home_url, keep_alive, native_only, native_path, external) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, p.name, `p-${randomUUID().slice(0, 8)}`, p.service, p.groupName || defaultProfileGroup(p.service), p.homeUrl, p.keepAlive ? 1 : 0, p.nativeOnly ? 1 : 0, p.nativePath, p.external ? 1 : 0)
  return getProfile(id)!
}

export function updateProfile(id: string, raw: unknown): void {
  const p = parse(profileInput, raw)
  db()
    .prepare('UPDATE profiles SET name = ?, service = ?, group_name = ?, home_url = ?, keep_alive = ?, native_only = ?, native_path = ?, external = ?, updated_at = ? WHERE id = ?')
    .run(p.name, p.service, p.groupName || defaultProfileGroup(p.service), p.homeUrl, p.keepAlive ? 1 : 0, p.nativeOnly ? 1 : 0, p.nativePath, p.external ? 1 : 0, nowIso(), id)
}

export function removeProfile(id: string): void {
  db().prepare('DELETE FROM profiles WHERE id = ?').run(id)
}

/** Profil layanan awal dibuat sekali. URL Zimbra, Sunfish, tiket, dan akun Kiro sengaja kosong: diisi sendiri di Pengaturan. */
export function seedProfilesOnce(): void {
  const d = db()
  if (d.prepare("SELECT 1 FROM settings WHERE key = 'meta.seeded_profiles'").get()) return
  const defaults: [string, string, string, boolean, boolean][] = [
    ['WhatsApp', 'whatsapp', 'https://web.whatsapp.com', true, false],
    ['Telegram', 'telegram', 'https://web.telegram.org/a/', true, false],
    // Gmail: Google menolak login di browser tertanam, jadi default-nya dibuka di browser luar.
    ['Gmail', 'gmail', 'https://mail.google.com', false, true],
    ['Outlook', 'outlook', 'https://outlook.office.com/mail', false, false],
    ['Zimbra', 'zimbra', '', false, false],
    ['Sunfish', 'sunfish', '', false, false],
    ['Tiket Support', 'support', '', false, false],
    ['Browser Umum', 'generic', 'https://www.google.com', false, false]
  ]
  d.transaction(() => {
    if ((d.prepare('SELECT COUNT(*) AS c FROM profiles').get() as { c: number }).c === 0) {
      for (const [name, service, homeUrl, keepAlive, external] of defaults) {
        createProfile({ name, service, homeUrl, keepAlive, nativeOnly: false, nativePath: '', external })
      }
    }
    d.prepare("INSERT INTO settings (key, value_json) VALUES ('meta.seeded_profiles', '1')").run()
  })()
}

// -------------------------------------------------------------------- inbox
const INBOX_SELECT = `
  SELECT i.id, i.created_at AS createdAt, i.updated_at AS updatedAt, i.source, i.sender, i.preview,
         i.received_at AS receivedAt, i.status, i.ticket_ref AS ticketRef, i.url,
         i.linked_task_id AS linkedTaskId, t.title AS linkedTaskTitle, i.snooze_until AS snoozeUntil
  FROM inbox_items i LEFT JOIN tasks t ON t.id = i.linked_task_id`

/** Item "baru" lebih dulu, lalu ditunda; yang selesai/diabaikan di bawah. */
export function listInbox(): InboxRow[] {
  return db()
    .prepare(`${INBOX_SELECT} ORDER BY CASE i.status WHEN 'baru' THEN 0 WHEN 'ditunda' THEN 1 ELSE 2 END, i.created_at DESC`)
    .all() as InboxRow[]
}

export function getInbox(id: string): InboxRow | null {
  return (db().prepare(`${INBOX_SELECT} WHERE i.id = ?`).get(id) as InboxRow | undefined) ?? null
}

/** Simpan tangkapan baru. Nomor tiket (#1234) dan tautan pertama dideteksi otomatis. */
export function addInboxItem(raw: unknown): InboxRow {
  const input = parse(inboxInput, raw)
  const id = randomUUID()
  db()
    .prepare('INSERT INTO inbox_items (id, source, sender, preview, received_at, ticket_ref, url) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, input.source, input.sender, input.preview, input.receivedAt ?? nowIso(), parseTicketRef(input.preview), parseFirstUrl(input.preview))
  return getInbox(id)!
}

function descriptionFor(item: InboxRow): string {
  const lines = [item.preview, '', `Sumber: ${INBOX_SOURCE_LABEL[item.source]}${item.sender ? ` · ${item.sender}` : ''}`]
  if (item.ticketRef) lines.push(`Tiket: #${item.ticketRef}`)
  if (item.url) lines.push(`Tautan: ${item.url}`)
  return lines.join('\n')
}

/** Ubah item inbox jadi task baru; item ditandai selesai dan tertaut ke task itu. */
export function makeInboxTask(id: string, raw: unknown): TaskRow {
  const item = getInbox(id)
  if (!item) throw new Error('Item inbox tidak ditemukan')
  const input = parse(inboxTaskInput, raw)
  const title = (input.title?.trim() || inboxTitle(item.preview) || 'Item inbox').slice(0, 200)
  const task = createTask({
    title,
    workspaceId: input.workspaceId ?? null,
    priority: input.priority,
    dueAt: input.dueAt ?? null,
    description: descriptionFor(item)
  })
  db().transaction(() => {
    db().prepare('UPDATE inbox_items SET status = ?, linked_task_id = ?, updated_at = ? WHERE id = ?').run('dijadikan_task', task.id, nowIso(), id)
    db().prepare('UPDATE tasks SET source_inbox_item_id = ? WHERE id = ?').run(id, task.id)
    log(task.id, 'inbox_dijadikan_task', { inboxId: id, source: item.source })
  })()
  return getTaskRow(task.id)!
}

/** Tautkan item ke task yang sudah ada (mis. "ide ini bagian dari tiket #4821"). */
export function linkInboxTask(id: string, taskId: string): void {
  if (!getInbox(id)) throw new Error('Item inbox tidak ditemukan')
  if (!db().prepare('SELECT 1 FROM tasks WHERE id = ?').get(taskId)) throw new Error('Task tidak ditemukan')
  db().prepare('UPDATE inbox_items SET status = ?, linked_task_id = ?, snooze_until = NULL, updated_at = ? WHERE id = ?').run('dijadikan_task', taskId, nowIso(), id)
  log(taskId, 'inbox_ditautkan', { inboxId: id })
  touch(taskId)
}

const untilSchema = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Waktu tunda tidak valid')

export function snoozeInbox(id: string, until: string): void {
  const t = parse(untilSchema, until)
  db().prepare('UPDATE inbox_items SET status = ?, snooze_until = ?, updated_at = ? WHERE id = ?').run('ditunda', t, nowIso(), id)
}

export function ignoreInbox(id: string): void {
  db().prepare('UPDATE inbox_items SET status = ?, snooze_until = NULL, updated_at = ? WHERE id = ?').run('diabaikan', nowIso(), id)
}

export function restoreInbox(id: string): void {
  db().prepare('UPDATE inbox_items SET status = ?, snooze_until = NULL, updated_at = ? WHERE id = ?').run('baru', nowIso(), id)
}

// ---------------------------------------------------------------- pengingat
/** Baris ringkas untuk penjadwal pengingat: hanya task yang belum selesai. */
export function listTasksForReminders(): ReminderTaskLite[] {
  const rows = db()
    .prepare(
      `SELECT id, title, status, due_at AS dueAt, waiting_since AS waitingSince,
              last_touched_at AS lastTouchedAt, created_at AS createdAt, remind_muted AS remindMuted
       FROM tasks WHERE status != 'selesai'`
    )
    .all() as (Omit<ReminderTaskLite, 'remindMuted'> & { remindMuted: number })[]
  return rows.map((r) => ({ ...r, remindMuted: r.remindMuted === 1 }))
}

export function listInboxForReminders(): ReminderInboxLite[] {
  return db()
    .prepare(
      `SELECT id, preview, created_at AS createdAt, received_at AS receivedAt, status, snooze_until AS snoozeUntil
       FROM inbox_items WHERE status IN ('baru', 'ditunda')`
    )
    .all() as ReminderInboxLite[]
}

export function muteTaskReminder(id: string, muted: boolean): void {
  db().prepare('UPDATE tasks SET remind_muted = ?, updated_at = ? WHERE id = ?').run(muted ? 1 : 0, nowIso(), id)
}

// ------------------------------------------------------------------ template
type TemplateDbRow = {
  id: string; name: string; workspaceId: string | null; workspaceName: string | null; priority: TaskRow['priority']
  subtasksJson: string | null; resourcesJson: string | null; recurrenceRule: string | null; createdAt: string
}
const TEMPLATE_SELECT = `
  SELECT t.id, t.name, t.workspace_id AS workspaceId, w.name AS workspaceName, t.priority,
         t.subtasks_json AS subtasksJson, t.resources_json AS resourcesJson, t.recurrence_rule AS recurrenceRule,
         t.created_at AS createdAt
  FROM task_templates t LEFT JOIN workspaces w ON w.id = t.workspace_id`

function jsonArray<T>(raw: string | null): T[] {
  if (!raw) return []
  try {
    const v: unknown = JSON.parse(raw)
    return Array.isArray(v) ? (v as T[]) : []
  } catch { return [] }
}

function toTemplate(r: TemplateDbRow): TemplateRow {
  return {
    id: r.id,
    name: r.name,
    workspaceId: r.workspaceId,
    workspaceName: r.workspaceName,
    priority: r.priority,
    subtasks: jsonArray<string>(r.subtasksJson).filter((s) => typeof s === 'string'),
    resources: jsonArray<Record<string, unknown>>(r.resourcesJson) as TemplateRow['resources'],
    recurrenceRule: parseRecurrence(r.recurrenceRule),
    createdAt: r.createdAt
  }
}

export function listTemplates(): TemplateRow[] {
  return (db().prepare(`${TEMPLATE_SELECT} ORDER BY t.name`).all() as TemplateDbRow[]).map(toTemplate)
}

export function createTemplate(raw: unknown): TemplateRow {
  const input = parse(templateInput, raw)
  const id = randomUUID()
  db().prepare('INSERT INTO task_templates (id, name, workspace_id, priority, subtasks_json, resources_json, recurrence_rule) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, input.name, input.workspaceId ?? null, input.priority ?? 'normal', JSON.stringify(input.subtasks), JSON.stringify(input.resources), input.recurrenceRule ? JSON.stringify(input.recurrenceRule) : null)
  return toTemplate(db().prepare(`${TEMPLATE_SELECT} WHERE t.id = ?`).get(id) as TemplateDbRow)
}

export function updateTemplate(id: string, raw: unknown): void {
  const input = parse(templateInput, raw)
  db().prepare('UPDATE task_templates SET name = ?, workspace_id = ?, priority = ?, subtasks_json = ?, resources_json = ?, recurrence_rule = ?, updated_at = ? WHERE id = ?')
    .run(input.name, input.workspaceId ?? null, input.priority ?? 'normal', JSON.stringify(input.subtasks), JSON.stringify(input.resources), input.recurrenceRule ? JSON.stringify(input.recurrenceRule) : null, nowIso(), id)
}

export function removeTemplate(id: string): void {
  db().prepare('DELETE FROM task_templates WHERE id = ?').run(id)
}

/** Buat task dari template: judul, workspace, prioritas, subtask, resource, dan aturan berulang ikut disalin. */
export function createTaskFromTemplate(templateId: string, dueAt?: string | null): TaskRow {
  const tpl = listTemplates().find((t) => t.id === templateId)
  if (!tpl) throw new Error('Template tidak ditemukan')
  const task = createTask({
    title: tpl.name, workspaceId: tpl.workspaceId, priority: tpl.priority, dueAt: dueAt ?? null
  })
  db().transaction(() => {
    for (const s of tpl.subtasks) {
      const max = (db().prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM subtasks WHERE task_id = ?').get(task.id) as { m: number }).m
      db().prepare('INSERT INTO subtasks (id, task_id, title, sort_order) VALUES (?, ?, ?, ?)').run(randomUUID(), task.id, s, max + 1)
    }
    for (const r of tpl.resources) {
      try { addResource(task.id, r) } catch { /* resource yang layanannya sudah dihapus dilewati */ }
    }
    if (tpl.recurrenceRule) db().prepare('UPDATE tasks SET recurrence_rule = ? WHERE id = ?').run(JSON.stringify(tpl.recurrenceRule), task.id)
    log(task.id, 'dari_template', { templateId })
  })()
  return getTaskRow(task.id)!
}

// ------------------------------------------------------------------- snippet
type SnippetDbRow = { id: string; title: string; body: string; variablesJson: string | null; updatedAt: string }
const toSnippet = (r: SnippetDbRow): SnippetRow => ({
  id: r.id, title: r.title, body: r.body,
  variables: jsonArray<string>(r.variablesJson), updatedAt: r.updatedAt
})

export function listSnippets(): SnippetRow[] {
  return (db().prepare('SELECT id, title, body, variables_json AS variablesJson, updated_at AS updatedAt FROM snippets ORDER BY title').all() as SnippetDbRow[]).map(toSnippet)
}

export function createSnippet(raw: unknown): SnippetRow {
  const input = parse(snippetInput, raw)
  const id = randomUUID()
  const variables = (body: string): string => {
    const out: string[] = []
    for (const m of body.matchAll(/\{([a-zA-Z0-9_]+)\}/g)) if (!out.includes(m[1])) out.push(m[1])
    return JSON.stringify(out)
  }
  db().prepare('INSERT INTO snippets (id, title, body, variables_json) VALUES (?, ?, ?, ?)')
    .run(id, input.title, input.body, variables(input.body))
  return toSnippet(db().prepare('SELECT id, title, body, variables_json AS variablesJson, updated_at AS updatedAt FROM snippets WHERE id = ?').get(id) as SnippetDbRow)
}

export function updateSnippet(id: string, raw: unknown): void {
  const input = parse(snippetInput, raw)
  const vars: string[] = []
  for (const m of input.body.matchAll(/\{([a-zA-Z0-9_]+)\}/g)) if (!vars.includes(m[1])) vars.push(m[1])
  db().prepare('UPDATE snippets SET title = ?, body = ?, variables_json = ?, updated_at = ? WHERE id = ?')
    .run(input.title, input.body, JSON.stringify(vars), nowIso(), id)
}

export function removeSnippet(id: string): void {
  db().prepare('DELETE FROM snippets WHERE id = ?').run(id)
}
