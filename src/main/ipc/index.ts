import { ipcMain, dialog } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import { ProjectService } from '../services/ProjectService'
import { ConfigService } from '../services/ConfigService'
import { FileSystemService } from '../services/FileSystemService'
import { LockService } from '../services/LockService'
import type { CreateProjectRequest, OpenProjectRequest } from '@shared/types/project.types'

// Initialize services
const fileSystemService = new FileSystemService()
const configService = new ConfigService()
const lockService = new LockService()
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
