import { ipcMain } from 'electron'
import { stat } from 'fs/promises'
import { IPC_CHANNELS } from '@shared/constants'
import { parseAudioMeta } from '../utils/parseAudioMeta'
import { getFfmpegPath } from '../utils/ffmpegPath'
import { runFfmpeg } from '../utils/ffmpegRunner'

/**
 * Register audio-related IPC handlers
 */
export function registerAudioHandlers(): void {
  /**
   * Return a streaming URL for an audio file via the custom audio:// protocol.
   * No file data is transferred over IPC — the renderer loads audio directly.
   */
  ipcMain.handle(
    IPC_CHANNELS.AUDIO_READ_FILE,
    async (_event, filePath: string) => {
      try {
        await stat(filePath)
        const url = `audio://play?path=${encodeURIComponent(filePath)}`
        return { success: true, url }
      } catch (error) {
        console.error('[audioHandlers] Failed to access audio file:', error)
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to access audio file',
        }
      }
    }
  )

  /**
   * Extract audio metadata via music-metadata
   */
  ipcMain.handle(
    IPC_CHANNELS.AUDIO_READ_METADATA,
    async (_event, filePath: string) => {
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
          error:
            error instanceof Error
              ? error.message
              : 'Failed to read audio metadata',
        }
      }
    }
  )

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
