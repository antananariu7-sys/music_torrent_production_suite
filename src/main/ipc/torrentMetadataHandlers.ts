import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type { TorrentMetadataService } from '../services/TorrentMetadataService'
import type { TorrentMetadataRequest } from '@shared/types/torrentMetadata.types'

export function registerTorrentMetadataHandlers(
  torrentMetadataService: TorrentMetadataService
): void {
  ipcMain.handle(
    IPC_CHANNELS.TORRENT_PARSE_METADATA,
    async (_event, request: TorrentMetadataRequest) => {
      try {
        return await torrentMetadataService.parseMetadata(request)
      } catch (error) {
        console.error('[torrentMetadataHandlers] Failed to parse metadata:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to parse torrent metadata',
        }
      }
    }
  )
}
