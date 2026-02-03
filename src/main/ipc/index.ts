import { ipcMain, dialog } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import { ProjectService } from '../services/ProjectService'
import { ConfigService } from '../services/ConfigService'
import { FileSystemService } from '../services/FileSystemService'
import { LockService } from '../services/LockService'
import { AuthService } from '../services/AuthService'
import { RuTrackerSearchService } from '../services/RuTrackerSearchService'
import type { CreateProjectRequest, OpenProjectRequest } from '@shared/types/project.types'
import type { LoginCredentials } from '@shared/types/auth.types'
import type { SearchRequest } from '@shared/types/search.types'

// Initialize services
const fileSystemService = new FileSystemService()
const configService = new ConfigService()
const lockService = new LockService()
const authService = new AuthService()
const searchService = new RuTrackerSearchService(authService)
const projectService = new ProjectService(
  fileSystemService,
  configService,
  lockService
)

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

  // Authentication handlers
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

  // Search handlers
  ipcMain.handle(IPC_CHANNELS.SEARCH_START, async (_event, request: SearchRequest) => {
    try {
      const response = await searchService.search(request)
      return response
    } catch (error) {
      console.error('Search failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed',
      }
    }
  })

  // Project handlers
  ipcMain.handle(IPC_CHANNELS.PROJECT_CREATE, async (_event, request: CreateProjectRequest) => {
    try {
      const project = await projectService.createProject(
        request.name,
        request.location,
        request.description
      )
      return { success: true, data: project }
    } catch (error) {
      console.error('Failed to create project:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create project',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_LOAD, async (_event, request: OpenProjectRequest) => {
    try {
      const project = await projectService.openProject(request.filePath)
      return { success: true, data: project }
    } catch (error) {
      console.error('Failed to open project:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open project',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_CLOSE, async (_event, projectId: string) => {
    try {
      await projectService.closeProject(projectId)
      return { success: true }
    } catch (error) {
      console.error('Failed to close project:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to close project',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_LIST, async () => {
    try {
      const recentProjects = configService.getRecentProjects()
      return { success: true, data: recentProjects }
    } catch (error) {
      console.error('Failed to get recent projects:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get recent projects',
      }
    }
  })

  // File operation handlers
  ipcMain.handle(IPC_CHANNELS.FILE_SELECT_DIRECTORY, async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
        title: 'Select Project Location',
      })

      if (result.canceled || result.filePaths.length === 0) {
        return null
      }

      return result.filePaths[0]
    } catch (error) {
      console.error('Failed to select directory:', error)
      return null
    }
  })

  console.log('IPC handlers registered successfully')
}

/**
 * Cleanup services before app shutdown
 */
export async function cleanupServices(): Promise<void> {
  console.log('Cleaning up services...')
  await authService.cleanup()
  console.log('Services cleaned up successfully')
}
