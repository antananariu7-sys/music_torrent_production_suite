import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  autoScanDiscography: boolean
  setAutoScanDiscography: (value: boolean) => void
  loadFromMain: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      autoScanDiscography: true,

      setAutoScanDiscography: (value) => {
        set({ autoScanDiscography: value })
        window.api.setSettings({ autoScanDiscography: value })
      },

      loadFromMain: async () => {
        try {
          const settings = await window.api.getSettings()
          set({ autoScanDiscography: settings.autoScanDiscography })
        } catch (err) {
          console.error('[SettingsStore] Failed to load settings from main:', err)
        }
      },
    }),
    {
      name: 'settings-storage',
    }
  )
)
