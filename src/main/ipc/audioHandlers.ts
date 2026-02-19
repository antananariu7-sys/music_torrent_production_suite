import { ipcMain } from 'electron'
import { readFileSync, statSync } from 'fs'
import { IPC_CHANNELS } from '@shared/constants'

/**
 * Register audio-related IPC handlers
 */
export function registerAudioHandlers(): void {
  /**
   * Read audio file and return as base64 data URL
   */
  ipcMain.handle(IPC_CHANNELS.AUDIO_READ_FILE, async (_event, filePath: string) => {
    try {
      const buffer = readFileSync(filePath)
      const ext = filePath.toLowerCase().slice(filePath.lastIndexOf('.'))

      // Map file extensions to MIME types
      const mimeTypes: Record<string, string> = {
        '.mp3': 'audio/mpeg',
        '.flac': 'audio/flac',
        '.wav': 'audio/wav',
        '.m4a': 'audio/mp4',
        '.aac': 'audio/aac',
        '.ogg': 'audio/ogg',
        '.opus': 'audio/opus',
        '.wma': 'audio/x-ms-wma',
        '.aiff': 'audio/aiff',
        '.ape': 'audio/ape',
      }

      const mimeType = mimeTypes[ext] || 'audio/mpeg'
      const base64 = buffer.toString('base64')
      const dataUrl = `data:${mimeType};base64,${base64}`

      return { success: true, dataUrl }
    } catch (error) {
      console.error('[audioHandlers] Failed to read audio file:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read audio file',
      }
    }
  })

  /**
   * Extract audio metadata via music-metadata
   */
  ipcMain.handle(IPC_CHANNELS.AUDIO_READ_METADATA, async (_event, filePath: string) => {
    try {
      const mm = await import('music-metadata')
      const meta = await mm.parseFile(filePath, { duration: true })
      const fileSize = statSync(filePath).size
      return {
        success: true,
        data: {
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
        },
      }
    } catch (error) {
      console.error('[audioHandlers] Failed to read audio metadata:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read audio metadata',
      }
    }
  })
}
