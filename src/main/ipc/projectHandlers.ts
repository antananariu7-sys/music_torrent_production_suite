import { ipcMain, dialog } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type { ProjectService } from '../services/ProjectService'
import type { ConfigService } from '../services/ConfigService'
import type { FileSystemService } from '../services/FileSystemService'
import type { CreateProjectRequest, OpenProjectRequest } from '@shared/types/project.types'

export function registerProjectHandlers(
  projectService: ProjectService,
  configService: ConfigService,
  fileSystemService: FileSystemService
): void {
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

  ipcMain.handle(IPC_CHANNELS.PROJECT_DELETE, async (_event, projectId: string) => {
    try {
      configService.removeRecentProject(projectId)
      return { success: true }
    } catch (error) {
      console.error('Failed to delete project:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete project',
      }
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_DELETE_FROM_DISK,
    async (_event, projectId: string, projectDirectory: string) => {
      try {
        configService.removeRecentProject(projectId)
        await fileSystemService.deleteDirectory(projectDirectory)
        return { success: true }
      } catch (error) {
        console.error('Failed to delete project from disk:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete project from disk',
        }
      }
    }
  )

  // File operation
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
}
