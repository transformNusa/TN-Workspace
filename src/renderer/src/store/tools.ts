import { create } from 'zustand'
import type { LayoutRow, LayoutSlotId, ToolRow } from '@shared/tools'
import { useData } from './data'

const cleanMessage = (e: unknown): string =>
  (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

type ToolsState = {
  tools: ToolRow[]
  layout: LayoutRow[]
  loaded: boolean
  error: string | null
  activeTool: string | null
  load: () => Promise<void>
  install: (sourcePath: string) => Promise<boolean>
  remove: (id: string) => Promise<boolean>
  setEnabled: (id: string, enabled: boolean) => Promise<void>
  openTool: (id: string | null) => void
  setLayout: (slot: LayoutSlotId, toolId: string | null, size?: number) => Promise<void>
  attachOutputs: (taskId: string, toolId: string, outputs: string[]) => Promise<void>
}

export const useTools = create<ToolsState>((set, get) => ({
  tools: [],
  layout: [],
  loaded: false,
  error: null,
  activeTool: null,
  load: async () => {
    try {
      const [tools, layout] = await Promise.all([window.alip.tools.list(), window.alip.tools.layout()])
      set({ tools, layout, loaded: true, error: null })
    } catch (e) {
      set({ error: cleanMessage(e) })
    }
  },
  install: async (sourcePath) => {
    try {
      await window.alip.tools.install(sourcePath)
      await get().load()
      return true
    } catch (e) {
      set({ error: cleanMessage(e) })
      return false
    }
  },
  remove: async (id) => {
    try {
      await window.alip.tools.remove(id)
      await get().load()
      return true
    } catch (e) {
      set({ error: cleanMessage(e) })
      return false
    }
  },
  setEnabled: async (id, enabled) => {
    try {
      const tools = await window.alip.tools.setEnabled(id, enabled)
      set({ tools })
    } catch (e) {
      set({ error: cleanMessage(e) })
    }
  },
  openTool: (activeTool) => set({ activeTool }),
  setLayout: async (slotId, toolId, size) => {
    try {
      set({ layout: await window.alip.tools.setLayout(slotId, toolId, size) })
    } catch (e) {
      set({ error: cleanMessage(e) })
    }
  },
  attachOutputs: async (taskId, toolId, outputs) => {
    for (const file of outputs) {
      const title = file.split(/[\\/]/).pop() ?? file
      try { await window.alip.resources.add(taskId, { type: 'tool', title, target: file, toolId }) } catch { /* dilewati */ }
    }
    await useData.getState().refresh()
  }
}))
