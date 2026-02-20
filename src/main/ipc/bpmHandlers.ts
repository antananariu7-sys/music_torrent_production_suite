import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import {
  BpmDetectRequestSchema,
  BpmBatchRequestSchema,
  BpmDetectSongRequestSchema,
} from '@shared/schemas/waveform.schema'
import type { BpmDetector } from '../services/waveform/BpmDetector'

export function registerBpmHandlers(
  bpmDetector: BpmDetector
): void {
  ipcMain.handle(IPC_CHANNELS.BPM_DETECT, async (_event, request: unknown) => {
    try {
      const { songId, filePath } = BpmDetectRequestSchema.parse(request)
      const data = await bpmDetector.detect(songId, filePath)
      return { success: true, data }
    } catch (error) {
      console.error('[bpmHandlers] Failed to detect BPM:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to detect BPM',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.BPM_DETECT_SONG, async (_event, request: unknown) => {
    try {
      const { projectId, songId } = BpmDetectSongRequestSchema.parse(request)
      const data = await bpmDetector.detectSong(projectId, songId)
      return { success: true, data }
    } catch (error) {
      console.error('[bpmHandlers] Failed to detect BPM for song:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to detect BPM',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.BPM_DETECT_BATCH, async (_event, request: unknown) => {
    try {
      const { projectId } = BpmBatchRequestSchema.parse(request)
      const data = await bpmDetector.detectBatch(projectId)
      return { success: true, data }
    } catch (error) {
      console.error('[bpmHandlers] Failed to detect batch BPM:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to detect batch BPM',
      }
    }
  })
}
