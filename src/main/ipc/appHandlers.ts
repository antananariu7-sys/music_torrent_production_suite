import { app, ipcMain, shell } from 'electron'
import { resolve, isAbsolute } from 'path'
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
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
    }
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async () => {
    const saved =
      configService.getSetting<Record<string, unknown>>('appSettings')
    return { ...defaultSettings, ...saved }
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (_event, settings) => {
    const current =
      configService.getSetting<Record<string, unknown>>('appSettings') || {}
    const merged = { ...defaultSettings, ...current, ...settings }
    configService.setSetting('appSettings', merged)
    return merged
  })

  // Open a folder/file path in the system file manager
  ipcMain.handle(
    IPC_CHANNELS.FILE_OPEN_PATH,
    async (_event, filePath: string) => {
      try {
        if (!filePath || typeof filePath !== 'string') {
          return { success: false, error: 'Invalid file path' }
        }

        // Resolve and validate the path is absolute and has no traversal
        const resolved = resolve(filePath)
        if (!isAbsolute(resolved)) {
          return { success: false, error: 'Path must be absolute' }
        }

        // Block paths outside user-accessible directories
        const userData = app.getPath('userData')
        const home = app.getPath('home')
        if (!resolved.startsWith(home) && !resolved.startsWith(userData)) {
          return {
            success: false,
            error: 'Path is outside allowed directories',
          }
        }

        const result = await shell.openPath(resolved)
        if (result) {
          return { success: false, error: result }
        }
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to open path',
        }
      }
    }
  )
}
