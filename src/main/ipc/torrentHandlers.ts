import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type { TorrentDownloadService } from '../services/TorrentDownloadService'
import { torrentCollectionService } from '../services/TorrentCollectionService'
import type {
  TorrentDownloadRequest,
  TorrentSettings,
  LoadTorrentCollectionRequest,
  SaveTorrentCollectionRequest,
  TorrentCollectionResponse,
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

  ipcMain.handle(IPC_CHANNELS.TORRENT_GET_HISTORY, async () => {
    try {
      const history = torrentService.getHistory()
      return { success: true, data: history }
    } catch (error) {
      console.error('Failed to get torrent history:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get torrent history',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.TORRENT_CLEAR_HISTORY, async () => {
    try {
      torrentService.clearHistory()
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
