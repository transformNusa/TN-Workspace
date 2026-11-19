import { create } from 'zustand'
import type { Reminder } from '@shared/data'

const cleanMessage = (e: unknown): string =>
  (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

type RemindersState = {
  list: Reminder[]
  loaded: boolean
  error: string | null
  load: () => Promise<void>
  set: (list: Reminder[]) => void
  /** Tunda pengingat ini sampai besok. */
  dismiss: (key: string) => Promise<void>
  /** Bisukan/suarakan pengingat sebuah task. */
  mute: (taskId: string, muted: boolean) => Promise<void>
}

export const useReminders = create<RemindersState>((set) => ({
  list: [],
  loaded: false,
  error: null,
  load: async () => {
    try {
      set({ list: await window.alip.reminders.list(), loaded: true })
    } catch (e) {
      set({ error: cleanMessage(e) })
    }
  },
  set: (list) => set({ list, loaded: true }),
  dismiss: async (key) => {
    try {
      set({ list: await window.alip.reminders.dismiss(key) })
    } catch (e) {
      set({ error: cleanMessage(e) })
    }
  },
  mute: async (taskId, muted) => {
    try {
      set({ list: await window.alip.reminders.mute(taskId, muted) })
    } catch (e) {
      set({ error: cleanMessage(e) })
    }
  }
}))
