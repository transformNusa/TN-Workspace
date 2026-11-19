import { create } from 'zustand'
import type { ProfileRow, ViewInfo } from '@shared/data'

type WebStore = {
  profiles: ProfileRow[]
  infos: ViewInfo[]
  loadProfiles: () => Promise<void>
  setInfos: (infos: ViewInfo[]) => void
}

export const useWeb = create<WebStore>((set) => ({
  profiles: [],
  infos: [],
  loadProfiles: async () => set({ profiles: await window.alip.profiles.list() }),
  setInfos: (infos) => set({ infos })
}))
