import { ipcMain, dialog } from 'electron'
import * as path from 'path'
import { existsSync } from 'fs'
import { readdir } from 'fs/promises'
import { IPC_CHANNELS } from '@shared/constants'
import {
  CreateProjectRequestSchema,
  OpenProjectRequestSchema,
  ProjectIdSchema,
  UpdateSongRequestSchema,
  AddSongFromFileRequestSchema,
  ReorderSongsRequestSchema,
  DeleteFromDiskRequestSchema,
} from '@shared/schemas/project.schema'
import type { ProjectService } from '../services/ProjectService'
import type { ConfigService } from '../services/ConfigService'
import type { FileSystemService } from '../services/FileSystemService'
import { parseAudioMeta } from '../utils/parseAudioMeta'

export function registerProjectHandlers(
  projectService: ProjectService,
  configService: ConfigService,
  fileSystemService: FileSystemService
): void {
  ipcMain.handle(IPC_CHANNELS.PROJECT_CREATE, async (_event, request) => {
    try {
      const { name, location, description } =
        CreateProjectRequestSchema.parse(request)
      const project = await projectService.createProject(
        name,
        location,
        description
      )
      return { success: true, data: project }
    } catch (error) {
      console.error('Failed to create project:', error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to create project',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_LOAD, async (_event, request) => {
    try {
      const { filePath } = OpenProjectRequestSchema.parse(request)
      const project = await projectService.openProject(filePath)
      return { success: true, data: project }
    } catch (error) {
      console.error('Failed to open project:', error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to open project',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_CLOSE, async (_event, projectId) => {
    try {
      const id = ProjectIdSchema.parse(projectId)
      await projectService.closeProject(id)
      return { success: true }
    } catch (error) {
      console.error('Failed to close project:', error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to close project',
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
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get recent projects',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_DELETE, async (_event, projectId) => {
    try {
      const id = ProjectIdSchema.parse(projectId)
      configService.removeRecentProject(id)
      return { success: true }
    } catch (error) {
      console.error('Failed to delete project:', error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to delete project',
      }
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_DELETE_FROM_DISK,
    async (_event, projectId, projectDirectory) => {
      try {
        const validated = DeleteFromDiskRequestSchema.parse({
          projectId,
          projectDirectory,
        })
        configService.removeRecentProject(validated.projectId)
        await fileSystemService.deleteDirectory(validated.projectDirectory)
        return { success: true }
      } catch (error) {
        console.error('Failed to delete project from disk:', error)
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to delete project from disk',
        }
      }
    }
  )

  // ── Mix / Song management ──────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.PROJECT_ADD_SONG, async (_event, request) => {
    try {
      const validated = AddSongFromFileRequestSchema.parse(request)
      const project = projectService.getActiveProject()
      if (!project || project.id !== validated.projectId) {
        throw new Error(`Project not found: ${validated.projectId}`)
      }

      // 1. Read audio metadata (best-effort — handles FLAC+ID3v2 and other edge cases)
      const meta = await parseAudioMeta(validated.sourcePath)
      const metadata = meta ?? { fileSize: 0 }

      // 2. Copy file into project assets/audio/
      const fileName = path.basename(validated.sourcePath)
      const destPath = path.join(
        project.projectDirectory,
        'assets',
        'audio',
        fileName
      )
      await fileSystemService.copyFile(validated.sourcePath, destPath)

      // 3. Determine title (override > metadata > filename)
      const title =
        validated.title ||
        meta?.title ||
        path.basename(fileName, path.extname(fileName))

      // 4. Add song to project (returns updated Project)
      const updatedProject = await projectService.addSong(validated.projectId, {
        title,
        localFilePath: destPath,
        order: validated.order,
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
    async (_event, projectId, songId) => {
      try {
        const validatedProjectId = ProjectIdSchema.parse(projectId)
        const validatedSongId = ProjectIdSchema.parse(songId)

        // Capture file path before removing from project data
        const project = projectService.getActiveProject()
        const song = project?.songs.find((s) => s.id === validatedSongId)
        const localFilePath = song?.localFilePath

        const updatedProject = await projectService.removeSong(
          validatedProjectId,
          validatedSongId
        )

        // Delete the audio file from assets/audio/ (best-effort)
        if (localFilePath) {
          try {
            await fileSystemService.deleteFile(localFilePath)
          } catch (err) {
            console.warn(
              '[projectHandlers] Could not delete audio file from disk:',
              err
            )
          }
        }

        return { success: true, data: updatedProject }
      } catch (error) {
        console.error('[projectHandlers] Failed to remove song:', error)
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to remove song',
        }
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.PROJECT_UPDATE_SONG, async (_event, request) => {
    try {
      const validated = UpdateSongRequestSchema.parse(request)
      const updatedProject = await projectService.updateSong(
        validated.projectId,
        validated.songId,
        validated.updates
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
    async (_event, projectId, orderedSongIds) => {
      try {
        const validated = ReorderSongsRequestSchema.parse({
          projectId,
          orderedSongIds,
        })
        const updatedProject = await projectService.reorderSongs(
          validated.projectId,
          validated.orderedSongIds
        )
        return { success: true, data: updatedProject }
      } catch (error) {
        console.error('[projectHandlers] Failed to reorder songs:', error)
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to reorder songs',
        }
      }
    }
  )

  // File operation
  ipcMain.handle(
    IPC_CHANNELS.FILE_SELECT_DIRECTORY,
    async (_event, title?: string) => {
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
    }
  )

  ipcMain.handle(IPC_CHANNELS.FILE_SELECT_AUDIO_FILES, async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        title: 'Add Audio Files to Mix',
        filters: [
          {
            name: 'Audio Files',
            extensions: [
              'mp3',
              'flac',
              'wav',
              'm4a',
              'aac',
              'ogg',
              'opus',
              'wma',
              'aiff',
              'ape',
              'alac',
            ],
          },
        ],
      })

      if (result.canceled || result.filePaths.length === 0) {
        return null
      }

      return result.filePaths
    } catch (error) {
      console.error('Failed to select audio files:', error)
      return null
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_SYNC_AUDIO_FOLDER,
    async (_event, projectId) => {
      try {
        const validatedId = ProjectIdSchema.parse(projectId)
        const project = projectService.getActiveProject()
        if (!project || project.id !== validatedId) {
          throw new Error(`Project not found: ${validatedId}`)
        }

        const audioDir = path.join(project.projectDirectory, 'assets', 'audio')
        if (!existsSync(audioDir)) {
          return { success: true, data: project, newCount: 0 }
        }

        const audioExtensions = new Set([
          '.mp3',
          '.flac',
          '.wav',
          '.m4a',
          '.aac',
          '.ogg',
          '.opus',
          '.wma',
          '.aiff',
          '.ape',
          '.alac',
        ])

        const entries = await readdir(audioDir, { withFileTypes: true })
        const audioFiles = entries
          .filter(
            (e) =>
              e.isFile() &&
              audioExtensions.has(path.extname(e.name).toLowerCase())
          )
          .map((e) => e.name)

        // Compare by normalised lowercase path
        const existingPaths = new Set(
          project.songs
            .map((s) => s.localFilePath)
            .filter(Boolean)
            .map((p) => p!.toLowerCase().replace(/\\/g, '/'))
        )

        const newFiles = audioFiles.filter((f) => {
          const filePath = path.join(audioDir, f).replace(/\\/g, '/')
          return !existingPaths.has(filePath.toLowerCase())
        })

        if (newFiles.length === 0) {
          return { success: true, data: project, newCount: 0 }
        }

        let updatedProject = project

        for (const file of newFiles) {
          const filePath = path.join(audioDir, file)
          try {
            const meta = await parseAudioMeta(filePath)
            updatedProject = await projectService.addSong(validatedId, {
              title: meta?.title || path.basename(file, path.extname(file)),
              localFilePath: filePath,
              order: updatedProject.songs.length,
              metadata: meta ?? { fileSize: 0 },
            })
          } catch (err) {
            console.error(`[projectHandlers] Failed to sync file ${file}:`, err)
          }
        }

        return {
          success: true,
          data: updatedProject,
          newCount: newFiles.length,
        }
      } catch (error) {
        console.error('[projectHandlers] Failed to sync audio folder:', error)
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to sync audio folder',
        }
      }
    }
  )
}
