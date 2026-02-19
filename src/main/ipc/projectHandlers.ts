import { ipcMain, dialog } from 'electron'
import * as path from 'path'
import { IPC_CHANNELS } from '@shared/constants'
import type { ProjectService } from '../services/ProjectService'
import type { ConfigService } from '../services/ConfigService'
import type { FileSystemService } from '../services/FileSystemService'
import type {
  CreateProjectRequest,
  OpenProjectRequest,
  AddSongFromFileRequest,
  UpdateSongRequest,
} from '@shared/types/project.types'

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

  // ── Mix / Song management ──────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.PROJECT_ADD_SONG, async (_event, request: AddSongFromFileRequest) => {
    try {
      const project = projectService.getActiveProject()
      if (!project || project.id !== request.projectId) {
        throw new Error(`Project not found: ${request.projectId}`)
      }

      // 1. Read audio metadata
      const mm = await import('music-metadata')
      const meta = await mm.parseFile(request.sourcePath, { duration: true })
      const { statSync } = await import('fs')
      const fileSize = statSync(request.sourcePath).size

      const metadata = {
        title: meta.common.title,
        artist: meta.common.artist,
        album: meta.common.album,
        duration: meta.format.duration,
        format: meta.format.container?.toLowerCase(),
        bitrate: meta.format.bitrate ? Math.round(meta.format.bitrate / 1000) : undefined,
        sampleRate: meta.format.sampleRate,
        channels: meta.format.numberOfChannels,
        year: meta.common.year,
        genre: meta.common.genre?.[0],
        trackNumber: meta.common.track?.no ?? undefined,
        fileSize,
      }

      // 2. Copy file into project assets/audio/
      const fileName = path.basename(request.sourcePath)
      const destPath = path.join(project.projectDirectory, 'assets', 'audio', fileName)
      await fileSystemService.copyFile(request.sourcePath, destPath)

      // 3. Determine title (override > metadata > filename)
      const title = request.title || meta.common.title || path.basename(fileName, path.extname(fileName))

      // 4. Add song to project (returns updated Project)
      const updatedProject = await projectService.addSong(request.projectId, {
        title,
        localFilePath: destPath,
        order: request.order,
        metadata,
      })

      return { success: true, data: updatedProject }
    } catch (error) {
      console.error('[projectHandlers] Failed to add song:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add song',
      }
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_REMOVE_SONG,
    async (_event, projectId: string, songId: string) => {
      try {
        const updatedProject = await projectService.removeSong(projectId, songId)
        return { success: true, data: updatedProject }
      } catch (error) {
        console.error('[projectHandlers] Failed to remove song:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to remove song',
        }
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.PROJECT_UPDATE_SONG, async (_event, request: UpdateSongRequest) => {
    try {
      const updatedProject = await projectService.updateSong(
        request.projectId,
        request.songId,
        request.updates
      )
      return { success: true, data: updatedProject }
    } catch (error) {
      console.error('[projectHandlers] Failed to update song:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update song',
      }
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_REORDER_SONGS,
    async (_event, projectId: string, orderedSongIds: string[]) => {
      try {
        const updatedProject = await projectService.reorderSongs(projectId, orderedSongIds)
        return { success: true, data: updatedProject }
      } catch (error) {
        console.error('[projectHandlers] Failed to reorder songs:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to reorder songs',
        }
      }
    }
  )

  // File operation
  ipcMain.handle(IPC_CHANNELS.FILE_SELECT_DIRECTORY, async (_event, title?: string) => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
        title: title || 'Select Project Location',
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
