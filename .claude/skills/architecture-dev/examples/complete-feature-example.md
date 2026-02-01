# Complete Feature Implementation Example

This example demonstrates implementing a complete feature following the architecture: a **Settings Management** feature.

## Feature Overview

Users can view and update application settings with real-time sync between main and renderer processes.

## Implementation Steps

### Step 1: Define Types

```typescript
// src/shared/types/settings.types.ts
export interface AppSettings {
  downloadPath: string
  maxConcurrentDownloads: number
  enableNotifications: boolean
  theme: 'light' | 'dark'
  rutracker: {
    baseUrl: string
    timeout: number
  }
}

export interface SettingsUpdate {
  key: keyof AppSettings
  value: any
}
```

### Step 2: Create Zod Schema

```typescript
// src/shared/schemas/settings.schema.ts
import { z } from 'zod'

export const AppSettingsSchema = z.object({
  downloadPath: z.string().min(1),
  maxConcurrentDownloads: z.number().min(1).max(10),
  enableNotifications: z.boolean(),
  theme: z.enum(['light', 'dark']),
  rutracker: z.object({
    baseUrl: z.string().url(),
    timeout: z.number().min(1000).max(30000)
  })
})

export const SettingsUpdateSchema = z.object({
  key: z.string(),
  value: z.any()
})
```

### Step 3: Create Service

```typescript
// src/main/services/settings.service.ts
import { app } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import { AppSettings } from '../../shared/types/settings.types'
import { AppSettingsSchema } from '../../shared/schemas/settings.schema'
import { LoggerService } from './logger.service'

const DEFAULT_SETTINGS: AppSettings = {
  downloadPath: path.join(app.getPath('downloads'), 'torrents'),
  maxConcurrentDownloads: 3,
  enableNotifications: true,
  theme: 'dark',
  rutracker: {
    baseUrl: 'https://rutracker.org',
    timeout: 10000
  }
}

export class SettingsService {
  private settingsPath: string
  private currentSettings: AppSettings | null = null

  constructor(private logger: LoggerService) {
    this.settingsPath = path.join(
      app.getPath('userData'),
      'settings.json'
    )
  }

  async getSettings(): Promise<AppSettings> {
    if (this.currentSettings) {
      return this.currentSettings
    }

    try {
      const data = await fs.readFile(this.settingsPath, 'utf-8')
      const parsed = JSON.parse(data)
      const validated = AppSettingsSchema.parse(parsed)

      this.currentSettings = validated
      return validated
    } catch (error) {
      this.logger.warn('Settings file not found or invalid, using defaults')
      return await this.resetToDefaults()
    }
  }

  async updateSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings()
    const updated = { ...current, ...updates }

    // Validate before saving
    const validated = AppSettingsSchema.parse(updated)

    await fs.writeFile(
      this.settingsPath,
      JSON.stringify(validated, null, 2),
      'utf-8'
    )

    this.currentSettings = validated
    this.logger.info('Settings updated successfully')

    return validated
  }

  async resetToDefaults(): Promise<AppSettings> {
    await fs.writeFile(
      this.settingsPath,
      JSON.stringify(DEFAULT_SETTINGS, null, 2),
      'utf-8'
    )

    this.currentSettings = DEFAULT_SETTINGS
    return DEFAULT_SETTINGS
  }
}
```

### Step 4: Create IPC Handlers

```typescript
// src/main/ipc/settings-handlers.ts
import { ipcMain } from 'electron'
import { services } from '../services'
import { SettingsUpdateSchema } from '../../shared/schemas/settings.schema'

ipcMain.handle('settings:get', async () => {
  return await services.settings.getSettings()
})

ipcMain.handle('settings:update', async (event, data) => {
  const validated = SettingsUpdateSchema.parse(data)

  const updated = await services.settings.updateSettings({
    [validated.key]: validated.value
  })

  // Notify all windows of the change
  event.sender.send('settings:changed', updated)

  return updated
})

ipcMain.handle('settings:reset', async (event) => {
  const defaults = await services.settings.resetToDefaults()

  event.sender.send('settings:changed', defaults)

  return defaults
})
```

### Step 5: Register Handler

```typescript
// src/main/ipc/index.ts
import './app-handlers'
import './project-handlers'
import './auth-handlers'
import './search-handlers'
import './settings-handlers' // Add this line
```

### Step 6: Expose API in Preload

```typescript
// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // ... other APIs

  // Settings API
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (key: string, value: any) =>
    ipcRenderer.invoke('settings:update', { key, value }),
  resetSettings: () => ipcRenderer.invoke('settings:reset'),
  onSettingsChanged: (callback: (settings: AppSettings) => void) => {
    ipcRenderer.on('settings:changed', (_, data) => callback(data))
    return () => ipcRenderer.removeListener('settings:changed', callback)
  }
}

contextBridge.exposeInMainWorld('api', api)
```

### Step 7: Create Zustand Store

```typescript
// src/renderer/store/useSettingsStore.ts
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { AppSettings } from '../../shared/types/settings.types'

interface SettingsState {
  settings: AppSettings | null
  isLoading: boolean

  loadSettings: () => Promise<void>
  updateSetting: (key: keyof AppSettings, value: any) => Promise<void>
  resetSettings: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>()(
  devtools(
    (set, get) => ({
      settings: null,
      isLoading: false,

      loadSettings: async () => {
        set({ isLoading: true })
        try {
          const settings = await window.api.getSettings()
          set({ settings, isLoading: false })
        } catch (error) {
          console.error('Failed to load settings:', error)
          set({ isLoading: false })
        }
      },

      updateSetting: async (key, value) => {
        const updated = await window.api.updateSettings(key, value)
        set({ settings: updated })
      },

      resetSettings: async () => {
        const defaults = await window.api.resetSettings()
        set({ settings: defaults })
      }
    }),
    { name: 'SettingsStore' }
  )
)
```

### Step 8: Create React Component

```typescript
// src/renderer/components/pages/Settings.tsx
import { useEffect } from 'react'
import { useSettingsStore } from '../../store/useSettingsStore'

export function Settings() {
  const { settings, isLoading, loadSettings, updateSetting, resetSettings } =
    useSettingsStore()

  useEffect(() => {
    loadSettings()

    // Listen for settings changes
    const cleanup = window.api.onSettingsChanged((newSettings) => {
      useSettingsStore.setState({ settings: newSettings })
    })

    return cleanup
  }, [loadSettings])

  if (isLoading || !settings) {
    return <div>Loading settings...</div>
  }

  return (
    <div className="settings-page">
      <h1>Settings</h1>

      <section>
        <h2>Downloads</h2>

        <div className="setting-item">
          <label htmlFor="downloadPath">Download Path</label>
          <input
            id="downloadPath"
            type="text"
            value={settings.downloadPath}
            onChange={(e) => updateSetting('downloadPath', e.target.value)}
          />
        </div>

        <div className="setting-item">
          <label htmlFor="maxDownloads">Max Concurrent Downloads</label>
          <input
            id="maxDownloads"
            type="number"
            min="1"
            max="10"
            value={settings.maxConcurrentDownloads}
            onChange={(e) =>
              updateSetting('maxConcurrentDownloads', parseInt(e.target.value))
            }
          />
        </div>
      </section>

      <section>
        <h2>Appearance</h2>

        <div className="setting-item">
          <label htmlFor="theme">Theme</label>
          <select
            id="theme"
            value={settings.theme}
            onChange={(e) => updateSetting('theme', e.target.value)}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>

        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={settings.enableNotifications}
              onChange={(e) =>
                updateSetting('enableNotifications', e.target.checked)
              }
            />
            Enable Notifications
          </label>
        </div>
      </section>

      <section>
        <h2>RuTracker</h2>

        <div className="setting-item">
          <label htmlFor="rutrackerUrl">Base URL</label>
          <input
            id="rutrackerUrl"
            type="url"
            value={settings.rutracker.baseUrl}
            onChange={(e) =>
              updateSetting('rutracker', {
                ...settings.rutracker,
                baseUrl: e.target.value
              })
            }
          />
        </div>

        <div className="setting-item">
          <label htmlFor="timeout">Timeout (ms)</label>
          <input
            id="timeout"
            type="number"
            min="1000"
            max="30000"
            step="1000"
            value={settings.rutracker.timeout}
            onChange={(e) =>
              updateSetting('rutracker', {
                ...settings.rutracker,
                timeout: parseInt(e.target.value)
              })
            }
          />
        </div>
      </section>

      <div className="actions">
        <button onClick={resetSettings}>Reset to Defaults</button>
      </div>
    </div>
  )
}
```

### Step 9: Write Tests

```typescript
// tests/unit/services/settings.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SettingsService } from '../../../src/main/services/settings.service'

describe('SettingsService', () => {
  let settingsService: SettingsService
  let mockLogger: any

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }
    settingsService = new SettingsService(mockLogger)
  })

  it('should return default settings when file not found', async () => {
    const settings = await settingsService.getSettings()

    expect(settings.downloadPath).toBeDefined()
    expect(settings.maxConcurrentDownloads).toBe(3)
    expect(settings.theme).toBe('dark')
  })

  it('should update settings', async () => {
    const updated = await settingsService.updateSettings({
      theme: 'light',
      maxConcurrentDownloads: 5
    })

    expect(updated.theme).toBe('light')
    expect(updated.maxConcurrentDownloads).toBe(5)
  })

  it('should reject invalid settings', async () => {
    await expect(
      settingsService.updateSettings({
        maxConcurrentDownloads: 20 // Max is 10
      })
    ).rejects.toThrow()
  })
})
```

## Summary

This complete feature implementation demonstrates:

1. **Type safety**: TypeScript types + Zod validation
2. **Service layer**: Business logic in `SettingsService`
3. **IPC communication**: Type-safe channels with events
4. **State management**: Zustand store for React
5. **Real-time updates**: Event-based sync
6. **Testing**: Unit tests for service

This pattern should be followed for all new features in the application.
