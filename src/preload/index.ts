import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/constants'
import type { AppInfo, AppSettings } from '../shared/types/app.types'

// Define the API that will be exposed to the renderer process
const api = {
  // App methods
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke(IPC_CHANNELS.APP_READY),

  // Settings methods
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  setSettings: (settings: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, settings),

  // Project methods
  createProject: (data: { name: string; description?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CREATE, data),
  loadProject: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_LOAD, id),
  listProjects: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_LIST),

  // File operations
  selectDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_SELECT_DIRECTORY),
}

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('api', api)

// Type declaration for TypeScript
export type ElectronAPI = typeof api
