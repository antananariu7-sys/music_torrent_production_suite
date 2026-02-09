import { ipcMain } from 'electron'
import { readFileSync } from 'fs'
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
}
