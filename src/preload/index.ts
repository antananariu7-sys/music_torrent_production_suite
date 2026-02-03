import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type { AppInfo, AppSettings } from '@shared/types/app.types'
import type {
  CreateProjectRequest,
  OpenProjectRequest,
  Project,
  RecentProject,
} from '@shared/types/project.types'
import type { LoginCredentials, LoginResult, AuthState } from '@shared/types/auth.types'

// API response wrapper
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// Define the API that will be exposed to the renderer process
const api = {
  // App methods
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke(IPC_CHANNELS.APP_READY),

  // Settings methods
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  setSettings: (settings: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, settings),

  // Project methods
  createProject: (request: CreateProjectRequest): Promise<ApiResponse<Project>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CREATE, request),

  openProject: (request: OpenProjectRequest): Promise<ApiResponse<Project>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_LOAD, request),

  closeProject: (projectId: string): Promise<ApiResponse<void>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CLOSE, projectId),

  getRecentProjects: (): Promise<ApiResponse<RecentProject[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_LIST),

  // File operations
  selectDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_SELECT_DIRECTORY),

  // Authentication methods
  auth: {
    login: (credentials: LoginCredentials): Promise<LoginResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGIN, credentials),

    logout: (): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGOUT),

    getStatus: (): Promise<ApiResponse<AuthState>> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_STATUS),
  },
}

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('api', api)

// Type declaration for TypeScript
export type ElectronAPI = typeof api
