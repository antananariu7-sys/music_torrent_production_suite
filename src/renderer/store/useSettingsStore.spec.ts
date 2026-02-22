import { describe, it, expect, beforeEach, jest } from '@jest/globals'

// Mock localStorage for zustand persist middleware
const mockStorage: Record<string, string> = {}
;(globalThis as any).localStorage = {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = value
  },
  removeItem: (key: string) => {
    delete mockStorage[key]
  },
}

const mockWindowApi = {
  setSettings: jest.fn<(settings: any) => void>(),
  getSettings: jest.fn<() => Promise<any>>(),
}

;(globalThis as any).window = { api: mockWindowApi }

import { useSettingsStore } from './useSettingsStore'

describe('useSettingsStore', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useSettingsStore.setState({ autoScanDiscography: true })
  })

  describe('setAutoScanDiscography', () => {
    it('should update store and call IPC', () => {
      useSettingsStore.getState().setAutoScanDiscography(false)

      expect(useSettingsStore.getState().autoScanDiscography).toBe(false)
      expect(mockWindowApi.setSettings).toHaveBeenCalledWith({
        autoScanDiscography: false,
      })
    })

    it('should sync true value to main process', () => {
      useSettingsStore.setState({ autoScanDiscography: false })

      useSettingsStore.getState().setAutoScanDiscography(true)

      expect(useSettingsStore.getState().autoScanDiscography).toBe(true)
      expect(mockWindowApi.setSettings).toHaveBeenCalledWith({
        autoScanDiscography: true,
      })
    })
  })

  describe('loadFromMain', () => {
    it('should hydrate store from main process settings', async () => {
      mockWindowApi.getSettings.mockResolvedValue({
        autoScanDiscography: false,
      } as never)

      await useSettingsStore.getState().loadFromMain()

      expect(useSettingsStore.getState().autoScanDiscography).toBe(false)
    })

    it('should handle failure gracefully', async () => {
      mockWindowApi.getSettings.mockRejectedValue(new Error('fail') as never)

      await useSettingsStore.getState().loadFromMain()

      // Should not throw, state unchanged
      expect(useSettingsStore.getState().autoScanDiscography).toBe(true)
    })
  })
})
