import { ipcMain } from 'electron'
import path from 'path'
import { existsSync, readdirSync } from 'fs'
import { IPC_CHANNELS } from '@shared/constants'
import { CheckLocalTorrentRequestSchema } from '@shared/schemas/torrent.schema'
import type { TorrentDownloadService } from '../services/TorrentDownloadService'
import { torrentCollectionService } from '../services/TorrentCollectionService'
import type {
  TorrentDownloadRequest,
  TorrentSettings,
  LoadTorrentCollectionRequest,
  SaveTorrentCollectionRequest,
  TorrentCollectionResponse,
  CheckLocalTorrentResponse,
} from '@shared/types/torrent.types'

export function registerTorrentHandlers(torrentService: TorrentDownloadService): void {
  // Torrent download
  ipcMain.handle(IPC_CHANNELS.TORRENT_DOWNLOAD, async (_event, request: TorrentDownloadRequest) => {
    try {
      const response = await torrentService.downloadTorrent(request)
      return response
    } catch (error) {
      console.error('Torrent download failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Torrent download failed',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.TORRENT_GET_HISTORY, async (_event, projectDirectory?: string) => {
    try {
      const history = torrentService.getHistory(projectDirectory)
      return { success: true, data: history }
    } catch (error) {
      console.error('Failed to get torrent history:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get torrent history',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.TORRENT_CLEAR_HISTORY, async (_event, projectDirectory?: string) => {
    try {
      torrentService.clearHistory(projectDirectory)
      return { success: true }
    } catch (error) {
      console.error('Failed to clear torrent history:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clear torrent history',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.TORRENT_GET_SETTINGS, async () => {
    try {
      const settings = torrentService.getSettings()
      return { success: true, data: settings }
    } catch (error) {
      console.error('Failed to get torrent settings:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get torrent settings',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.TORRENT_UPDATE_SETTINGS, async (_event, settings: TorrentSettings) => {
    try {
      torrentService.updateSettings(settings)
      return { success: true, data: torrentService.getSettings() }
    } catch (error) {
      console.error('Failed to update torrent settings:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update torrent settings',
      }
    }
  })

  // Check for local .torrent file in project directory
  ipcMain.handle(
    IPC_CHANNELS.TORRENT_CHECK_LOCAL_FILE,
    async (_event, request: unknown): Promise<CheckLocalTorrentResponse> => {
      try {
        const { torrentId, projectDirectory } = CheckLocalTorrentRequestSchema.parse(request)
        const torrentsDir = path.join(projectDirectory, 'torrents')

        // Check legacy name first: {torrentId}.torrent
        const legacyPath = path.join(torrentsDir, `${torrentId}.torrent`)
        if (existsSync(legacyPath)) {
          console.log(`[torrentHandlers] Check local .torrent: ${legacyPath} => FOUND (legacy)`)
          return { found: true, filePath: legacyPath }
        }

        // Search for human-readable name: *[{torrentId}].torrent
        if (existsSync(torrentsDir)) {
          const suffix = `[${torrentId}].torrent`
          const match = readdirSync(torrentsDir).find((f) => f.endsWith(suffix))
          if (match) {
            const matchPath = path.join(torrentsDir, match)
            console.log(`[torrentHandlers] Check local .torrent: ${matchPath} => FOUND`)
            return { found: true, filePath: matchPath }
          }
        }

        console.log(`[torrentHandlers] Check local .torrent for ${torrentId} => NOT FOUND`)
        return { found: false }
      } catch (error) {
        console.error('Failed to check local torrent file:', error)
        return { found: false }
      }
    }
  )

  // Torrent collection
  ipcMain.handle(
    IPC_CHANNELS.TORRENT_COLLECTION_LOAD,
    async (_event, request: LoadTorrentCollectionRequest): Promise<TorrentCollectionResponse> => {
      try {
        const { projectId, projectDirectory } = request

        if (!projectDirectory) {
          return {
            success: false,
            error: 'Project directory not provided',
          }
        }

        const torrents = await torrentCollectionService.loadCollection(projectId, projectDirectory)

        return {
          success: true,
          torrents,
        }
      } catch (error) {
        console.error('Error loading torrent collection:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to load torrent collection',
        }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.TORRENT_COLLECTION_SAVE,
    async (_event, request: SaveTorrentCollectionRequest): Promise<TorrentCollectionResponse> => {
      try {
        const { projectId, projectName, projectDirectory, torrents } = request

        if (!projectDirectory) {
          return {
            success: false,
            error: 'Project directory not provided',
          }
        }

        await torrentCollectionService.saveCollection(
          projectId,
          projectName,
          projectDirectory,
          torrents
        )

        return {
          success: true,
        }
      } catch (error) {
        console.error('Error saving torrent collection:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to save torrent collection',
        }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.TORRENT_COLLECTION_CLEAR,
    async (_event, projectDirectory: string): Promise<TorrentCollectionResponse> => {
      try {
        await torrentCollectionService.clearCollection(projectDirectory)

        return {
          success: true,
        }
      } catch (error) {
        console.error('Error clearing torrent collection:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to clear torrent collection',
        }
      }
    }
  )
}
