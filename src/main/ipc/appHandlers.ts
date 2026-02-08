import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type { ConfigService } from '../services/ConfigService'

const defaultSettings = {
  theme: 'system' as const,
  downloadDirectory: '',
  autoStart: false,
  minimizeToTray: false,
  notifications: true,
  autoScanDiscography: true,
}

export function registerAppHandlers(configService: ConfigService): void {
  ipcMain.handle(IPC_CHANNELS.APP_READY, async () => {
    return {
      name: 'Music Production Suite',
      version: '0.1.0',
      platform: process.platform,
      arch: process.arch,
    }
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async () => {
    const saved = configService.getSetting<Record<string, unknown>>('appSettings')
    return { ...defaultSettings, ...saved }
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (_event, settings) => {
    const current = configService.getSetting<Record<string, unknown>>('appSettings') || {}
    const merged = { ...defaultSettings, ...current, ...settings }
    configService.setSetting('appSettings', merged)
    return merged
  })
}
