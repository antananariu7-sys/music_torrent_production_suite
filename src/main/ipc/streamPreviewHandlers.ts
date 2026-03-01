import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import { StreamPreviewStartRequestSchema } from '@shared/schemas/search.schema'
import type { StreamPreviewService } from '../services/StreamPreviewService'

export function registerStreamPreviewHandlers(
  service: StreamPreviewService
): void {
  ipcMain.handle(IPC_CHANNELS.STREAM_PREVIEW_START, async (event, request) => {
    try {
      const validated = StreamPreviewStartRequestSchema.parse(request)
      await service.start(validated, event.sender)
      return { success: true }
    } catch (error) {
      console.error('[streamPreviewHandlers] Failed to start preview:', error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to start preview',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.STREAM_PREVIEW_STOP, async () => {
    try {
      await service.stop()
      return { success: true }
    } catch (error) {
      console.error('[streamPreviewHandlers] Failed to stop preview:', error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to stop preview',
      }
    }
  })
}
