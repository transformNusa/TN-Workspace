import { create } from 'zustand'
import type {
  ActiveTimer, DayStats, Status, TaskCreateInput, TaskDetail, TaskPatch, TaskRow, Workspace, WorkspaceInput
} from '@shared/data'

type DataState = {
  workspaces: Workspace[]
  tasks: TaskRow[]
  /** Timer yang sedang berjalan; boleh lebih dari satu task. */
  running: ActiveTimer[]
  stats: DayStats
  selectedId: string | null
  detail: TaskDetail | null
  loaded: boolean
  error: string | null
  clearError: () => void
  init: () => Promise<void>
  refresh: () => Promise<void>
  refreshStats: () => Promise<void>
  select: (id: string | null) => Promise<void>
  createTask: (input: TaskCreateInput) => Promise<string | null>
  updateTask: (id: string, patch: TaskPatch) => Promise<void>
  setStatus: (id: string, status: Status) => Promise<void>
  removeTask: (id: string) => Promise<void>
  addSubtask: (taskId: string, title: string) => Promise<void>
  setSubtaskDone: (id: string, done: boolean) => Promise<void>
  renameSubtask: (id: string, title: string) => Promise<void>
  removeSubtask: (id: string) => Promise<void>
  saveNote: (taskId: string, content: string) => Promise<void>
  startTimer: (taskId: string) => Promise<void>
  stopTimer: (taskId: string, resumeNote?: string) => Promise<void>
  stopAllTimers: () => Promise<void>
  createWorkspace: (input: WorkspaceInput) => Promise<void>
  updateWorkspace: (id: string, input: WorkspaceInput) => Promise<void>
  archiveWorkspace: (id: string) => Promise<void>
}

const cleanMessage = (e: unknown): string =>
  (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

export const useData = create<DataState>((set, get) => {
  /** Jalankan aksi, lalu muat ulang data. Kesalahan jadi pesan toast, bukan crash. */
  const run = async (fn: () => Promise<unknown>): Promise<boolean> => {
    try {
      await fn()
      await get().refresh()
      return true
    } catch (e) {
      set({ error: cleanMessage(e) })
      await get().refresh().catch(() => undefined)
      return false
    }
  }
  const api = (): Window['alip'] => window.alip

  return {
    workspaces: [], tasks: [], running: [], stats: { todaySeconds: 0, weekSeconds: 0 },
    selectedId: null, detail: null, loaded: false, error: null,
    clearError: () => set({ error: null }),

    init: async () => {
      await get().refresh()
      set({ loaded: true })
    },
    refresh: async () => {
      const [workspaces, tasks, running, stats] = await Promise.all([
        api().workspaces.list(), api().tasks.list(), api().time.active(), api().time.stats()
      ])
      const { selectedId } = get()
      const detail = selectedId ? await api().tasks.get(selectedId) : null
      set({ workspaces, tasks, running, stats, detail, selectedId: detail ? selectedId : null })
    },
    refreshStats: async () => set({ stats: await api().time.stats(), running: await api().time.active() }),
    select: async (id) => {
      if (!id) return set({ selectedId: null, detail: null })
      set({ selectedId: id, detail: await api().tasks.get(id) })
    },

    createTask: async (input) => {
      try {
        const row = await api().tasks.create(input)
        await get().refresh()
        await get().select(row.id)
        return row.id
      } catch (e) {
        set({ error: cleanMessage(e) })
        return null
      }
    },
    updateTask: async (id, patch) => void (await run(() => api().tasks.update(id, patch))),
    setStatus: async (id, status) => void (await run(() => api().tasks.setStatus(id, status))),
    removeTask: async (id) => {
      set({ selectedId: null, detail: null })
      await run(() => api().tasks.remove(id))
    },
    addSubtask: async (taskId, title) => void (await run(() => api().subtasks.add(taskId, title))),
    setSubtaskDone: async (id, done) => void (await run(() => api().subtasks.setDone(id, done))),
    renameSubtask: async (id, title) => void (await run(() => api().subtasks.rename(id, title))),
    removeSubtask: async (id) => void (await run(() => api().subtasks.remove(id))),
    saveNote: async (taskId, content) => {
      try {
        await api().notes.save(taskId, content)
        set((st) => (st.detail?.id === taskId ? { detail: { ...st.detail, note: content } } : {}))
      } catch (e) {
        set({ error: cleanMessage(e) })
      }
    },
    startTimer: async (taskId) => void (await run(() => api().time.start(taskId))),
    stopTimer: async (taskId, note) => void (await run(() => api().time.stop(taskId, note))),
    stopAllTimers: async () => void (await run(() => api().time.stopAll())),
    createWorkspace: async (input) => void (await run(() => api().workspaces.create(input))),
    updateWorkspace: async (id, input) => void (await run(() => api().workspaces.update(id, input))),
    archiveWorkspace: async (id) => void (await run(() => api().workspaces.archive(id)))
  }
})
