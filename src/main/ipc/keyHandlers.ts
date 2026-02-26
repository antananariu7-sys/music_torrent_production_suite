import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import {
  KeyDetectRequestSchema,
  KeyBatchRequestSchema,
  KeyDetectSongRequestSchema,
} from '@shared/schemas/waveform.schema'
import type { KeyDetector } from '../services/waveform/KeyDetector'

export function registerKeyHandlers(keyDetector: KeyDetector): void {
  ipcMain.handle(IPC_CHANNELS.KEY_DETECT, async (_event, request: unknown) => {
    try {
      const { songId, filePath } = KeyDetectRequestSchema.parse(request)
      const data = await keyDetector.detect(songId, filePath)
      return { success: true, data }
    } catch (error) {
      console.error('[keyHandlers] Failed to detect key:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to detect key',
      }
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.KEY_DETECT_SONG,
    async (_event, request: unknown) => {
      try {
        const { projectId, songId } = KeyDetectSongRequestSchema.parse(request)
        const data = await keyDetector.detectSong(projectId, songId)
        return { success: true, data }
      } catch (error) {
        console.error('[keyHandlers] Failed to detect key for song:', error)
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to detect key',
        }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.KEY_DETECT_BATCH,
    async (_event, request: unknown) => {
      try {
        const { projectId } = KeyBatchRequestSchema.parse(request)
        const data = await keyDetector.detectBatch(projectId)
        return { success: true, data }
      } catch (error) {
        console.error('[keyHandlers] Failed to detect batch key:', error)
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to detect batch key',
        }
      }
    }
  )
}
