import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants'

export function registerIpcHandlers(): void {
  console.log('Registering IPC handlers...')

  // App handlers
  ipcMain.handle(IPC_CHANNELS.APP_READY, async () => {
    return {
      name: 'Music Production Suite',
      version: '0.1.0',
      platform: process.platform,
      arch: process.arch,
    }
  })

  // Settings handlers
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async () => {
    // TODO: Implement settings service
    return {
      theme: 'system',
      downloadDirectory: '',
      autoStart: false,
      minimizeToTray: false,
      notifications: true,
    }
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (_event, settings) => {
    // TODO: Implement settings service
    console.log('Settings updated:', settings)
    return settings
  })

  console.log('IPC handlers registered successfully')
}
