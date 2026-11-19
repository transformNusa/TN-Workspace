import { create } from 'zustand'
import type { InboxInput, InboxRow, InboxStatus, InboxTaskInput, TaskRow } from '@shared/data'
import { useData } from './data'

const cleanMessage = (e: unknown): string =>
  (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

type InboxState = {
  items: InboxRow[]
  selectedId: string | null
  loaded: boolean
  error: string | null
  clearError: () => void
  /** Dipakai langganan IPC (main mengirim daftar terbaru setelah ada perubahan). */
  setItems: (items: InboxRow[]) => void
  refresh: () => Promise<void>
  select: (id: string | null) => void
  add: (input: InboxInput) => Promise<InboxRow | null>
  makeTask: (id: string, input: InboxTaskInput) => Promise<TaskRow | null>
  link: (id: string, taskId: string) => Promise<boolean>
  snooze: (id: string, until: string) => Promise<boolean>
  ignore: (id: string) => Promise<boolean>
  restore: (id: string) => Promise<boolean>
  counts: () => Record<InboxStatus, number>
}

export const useInbox = create<InboxState>((set, get) => {
  const run = async (fn: () => Promise<unknown>): Promise<boolean> => {
    try {
      await fn()
      await get().refresh()
      return true
    } catch (e) {
      set({ error: cleanMessage(e) })
      return false
    }
  }
  return {
    items: [],
    selectedId: null,
    loaded: false,
    error: null,
    clearError: () => set({ error: null }),
    setItems: (items) => set((st) => ({ items, loaded: true, selectedId: st.selectedId && items.some((i) => i.id === st.selectedId) ? st.selectedId : items[0]?.id ?? null })),
    refresh: async () => {
      try {
        const items = await window.alip.inbox.list()
        set((st) => ({ items, loaded: true, error: null, selectedId: st.selectedId && items.some((i) => i.id === st.selectedId) ? st.selectedId : items[0]?.id ?? null }))
      } catch (e) {
        set({ error: cleanMessage(e) })
      }
    },
    select: (selectedId) => set({ selectedId }),
    add: async (input) => {
      try {
        const row = await window.alip.inbox.add(input)
        await get().refresh()
        set({ selectedId: row.id })
        return row
      } catch (e) {
        set({ error: cleanMessage(e) })
        return null
      }
    },
    makeTask: async (id, input) => {
      try {
        const task = await window.alip.inbox.makeTask(id, input)
        await get().refresh()
        await useData.getState().refresh()
        return task
      } catch (e) {
        set({ error: cleanMessage(e) })
        return null
      }
    },
    link: async (id, taskId) => run(() => window.alip.inbox.link(id, taskId)),
    snooze: async (id, until) => run(() => window.alip.inbox.snooze(id, until)),
    ignore: async (id) => run(() => window.alip.inbox.ignore(id)),
    restore: async (id) => run(() => window.alip.inbox.restore(id)),
    counts: () => {
      const out: Record<InboxStatus, number> = { baru: 0, ditunda: 0, dijadikan_task: 0, diabaikan: 0 }
      for (const i of get().items) out[i.status] += 1
      return out
    }
  }
})
