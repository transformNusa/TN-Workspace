import { create } from 'zustand'
import { DEFAULT_SETTINGS, type Settings, type SettingsSectionKey } from '@shared/settings'

type SettingsState = {
  settings: Settings
  loaded: boolean
  load: () => Promise<void>
  save: (section: SettingsSectionKey, value: unknown) => Promise<string | null>
}

export const useSettings = create<SettingsState>((set) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  load: async () => {
    const settings = await window.alip.settings.get()
    set({ settings, loaded: true })
  },
  save: async (section, value) => {
    const res = await window.alip.settings.setSection(section, value)
    if (res.ok) {
      set({ settings: res.settings })
      return null
    }
    return res.error
  }
}))
