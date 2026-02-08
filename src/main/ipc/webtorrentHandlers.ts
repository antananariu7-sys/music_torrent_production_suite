import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import { AddTorrentRequestSchema, WebTorrentSettingsSchema } from '@shared/schemas/torrent.schema'
import type { WebTorrentService } from '../services/WebTorrentService'

export function registerWebtorrentHandlers(webtorrentService: WebTorrentService): void {
  // Add torrent to download queue
  ipcMain.handle(IPC_CHANNELS.WEBTORRENT_ADD, async (_event, request: unknown) => {
    try {
      const parsed = AddTorrentRequestSchema.parse(request)
      return await webtorrentService.add(parsed)
    } catch (error) {
      console.error('Failed to add torrent:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add torrent',
      }
    }
  })

  // Pause a downloading/seeding torrent
  ipcMain.handle(IPC_CHANNELS.WEBTORRENT_PAUSE, async (_event, id: string) => {
    try {
      return webtorrentService.pause(id)
    } catch (error) {
      console.error('Failed to pause torrent:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to pause torrent',
      }
    }
  })

  // Resume a paused/errored torrent
  ipcMain.handle(IPC_CHANNELS.WEBTORRENT_RESUME, async (_event, id: string) => {
    try {
      return webtorrentService.resume(id)
    } catch (error) {
      console.error('Failed to resume torrent:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resume torrent',
      }
    }
  })

  // Remove a torrent from queue
  ipcMain.handle(IPC_CHANNELS.WEBTORRENT_REMOVE, async (_event, id: string) => {
    try {
      return webtorrentService.remove(id)
    } catch (error) {
      console.error('Failed to remove torrent:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove torrent',
      }
    }
  })

  // Get all queued torrents
  ipcMain.handle(IPC_CHANNELS.WEBTORRENT_GET_ALL, async () => {
    try {
      return { success: true, data: webtorrentService.getAll() }
    } catch (error) {
      console.error('Failed to get download queue:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get download queue',
      }
    }
  })

  // Get WebTorrent settings
  ipcMain.handle(IPC_CHANNELS.WEBTORRENT_GET_SETTINGS, async () => {
    try {
      return { success: true, data: webtorrentService.getSettings() }
    } catch (error) {
      console.error('Failed to get WebTorrent settings:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get WebTorrent settings',
      }
    }
  })

  // Update WebTorrent settings
  ipcMain.handle(IPC_CHANNELS.WEBTORRENT_UPDATE_SETTINGS, async (_event, settings: unknown) => {
    try {
      const parsed = WebTorrentSettingsSchema.partial().parse(settings)
      const updated = webtorrentService.updateSettings(parsed)
      return { success: true, data: updated }
    } catch (error) {
      console.error('Failed to update WebTorrent settings:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update WebTorrent settings',
      }
    }
  })

  // Get per-project download path
  ipcMain.handle(IPC_CHANNELS.WEBTORRENT_GET_DOWNLOAD_PATH, async (_event, projectId: string) => {
    try {
      return { success: true, data: webtorrentService.getProjectDownloadPath(projectId) }
    } catch (error) {
      return { success: false, error: 'Failed to get download path' }
    }
  })

  // Set per-project download path
  ipcMain.handle(IPC_CHANNELS.WEBTORRENT_SET_DOWNLOAD_PATH, async (_event, projectId: string, downloadPath: string) => {
    try {
      webtorrentService.setProjectDownloadPath(projectId, downloadPath)
      return { success: true }
    } catch (error) {
      return { success: false, error: 'Failed to save download path' }
    }
  })
}
