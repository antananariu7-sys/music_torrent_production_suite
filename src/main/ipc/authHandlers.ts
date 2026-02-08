import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type { AuthService } from '../services/AuthService'
import type { LoginCredentials } from '@shared/types/auth.types'

export function registerAuthHandlers(authService: AuthService): void {
  ipcMain.handle(IPC_CHANNELS.AUTH_LOGIN, async (_event, credentials: LoginCredentials) => {
    try {
      const result = await authService.login(credentials)
      return result
    } catch (error) {
      console.error('Auth login failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_LOGOUT, async () => {
    try {
      await authService.logout()
      return { success: true }
    } catch (error) {
      console.error('Auth logout failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Logout failed',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_STATUS, async () => {
    try {
      const authState = authService.getAuthStatus()
      return { success: true, data: authState }
    } catch (error) {
      console.error('Get auth status failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get auth status',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_DEBUG, async () => {
    try {
      const debugInfo = authService.getDebugInfo()
      return { success: true, data: debugInfo }
    } catch (error) {
      console.error('Get auth debug info failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get debug info',
      }
    }
  })
}
