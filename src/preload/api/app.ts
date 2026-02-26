import { ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type { AppInfo, AppSettings } from '@shared/types/app.types'

export const appApi = {
  getAppInfo: (): Promise<AppInfo> =>
    ipcRenderer.invoke(IPC_CHANNELS.APP_READY),

  getSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),

  setSettings: (settings: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, settings),
}
