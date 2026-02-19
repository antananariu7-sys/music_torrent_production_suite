import { ipcMain } from 'electron'
import { readFileSync } from 'fs'
import { IPC_CHANNELS } from '@shared/constants'
import { parseAudioMeta } from '../utils/parseAudioMeta'
import { getFfmpegPath } from '../utils/ffmpegPath'
import { runFfmpeg } from '../utils/ffmpegRunner'

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
      const meta = await parseAudioMeta(filePath)
      if (!meta) {
        return { success: false, error: 'Could not parse audio metadata' }
      }
      return { success: true, data: meta }
    } catch (error) {
      console.error('[audioHandlers] Failed to read audio metadata:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read audio metadata',
      }
    }
  })

  /**
   * Check FFmpeg availability — spawns `ffmpeg -version` and returns version string
   */
  ipcMain.handle(IPC_CHANNELS.MIX_EXPORT_FFMPEG_CHECK, async () => {
    try {
      const ffmpegPath = getFfmpegPath()
      const result = await runFfmpeg(['-version'])
      // FFmpeg prints version info to stdout
      const firstLine = result.stdout.split('\n')[0] ?? ''
      const versionMatch = firstLine.match(/ffmpeg version (\S+)/)
      const version = versionMatch ? versionMatch[1] : firstLine.trim()

      return { success: true, data: { version, path: ffmpegPath } }
    } catch (error) {
      console.error('[audioHandlers] FFmpeg check failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'FFmpeg not available',
      }
    }
  })
}
