import { ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type {
  LoginCredentials,
  LoginResult,
  AuthState,
} from '@shared/types/auth.types'

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export const authApi = {
  login: (credentials: LoginCredentials): Promise<LoginResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGIN, credentials),

  logout: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGOUT),

  getStatus: (): Promise<ApiResponse<AuthState>> =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_STATUS),

  getDebugInfo: (): Promise<
    ApiResponse<{
      cookies: Array<{
        name: string
        value: string
        domain: string
        path: string
        expires: number
      }>
      cookieCount: number
    }>
  > => ipcRenderer.invoke(IPC_CHANNELS.AUTH_DEBUG),
}
