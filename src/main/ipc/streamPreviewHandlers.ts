import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type { StreamPreviewService } from '../services/StreamPreviewService'
import type { StreamPreviewStartRequest } from '@shared/types/streamPreview.types'

export function registerStreamPreviewHandlers(service: StreamPreviewService): void {
  ipcMain.handle(
    IPC_CHANNELS.STREAM_PREVIEW_START,
    async (event, request: StreamPreviewStartRequest) => {
      await service.start(request, event.sender)
      return { success: true }
    },
  )

  ipcMain.handle(IPC_CHANNELS.STREAM_PREVIEW_STOP, async () => {
    await service.stop()
    return { success: true }
  })
}
