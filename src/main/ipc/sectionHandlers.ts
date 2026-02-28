import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import {
  SectionDetectRequestSchema,
  SectionBatchRequestSchema,
} from '@shared/schemas/sectionDetection.schema'
import type { SectionDetector } from '../services/waveform/SectionDetector'

export function registerSectionHandlers(
  sectionDetector: SectionDetector
): void {
  ipcMain.handle(
    IPC_CHANNELS.SECTION_DETECT,
    async (_event, request: unknown) => {
      try {
        const { projectId, songId } = SectionDetectRequestSchema.parse(request)
        const data = await sectionDetector.detectSong(projectId, songId)
        return { success: true, data }
      } catch (error) {
        console.error('[sectionHandlers] Failed to detect sections:', error)
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to detect sections',
        }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.SECTION_DETECT_BATCH,
    async (_event, request: unknown) => {
      try {
        const { projectId } = SectionBatchRequestSchema.parse(request)
        const data = await sectionDetector.detectBatch(projectId)
        return { success: true, data }
      } catch (error) {
        console.error(
          '[sectionHandlers] Failed batch section detection:',
          error
        )
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to detect sections',
        }
      }
    }
  )
}
