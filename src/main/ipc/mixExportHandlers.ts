import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import { MixExportRequestSchema } from '@shared/schemas/mixExport.schema'
import type { MixExportService } from '../services/mixExport/MixExportService'

export function registerMixExportHandlers(
  mixExportService: MixExportService
): void {
  ipcMain.handle(IPC_CHANNELS.MIX_EXPORT_START, async (_event, request: unknown) => {
    try {
      const parsed = MixExportRequestSchema.parse(request)
      const result = await mixExportService.startExport(parsed)
      return { success: true, data: result }
    } catch (error) {
      console.error('[mixExportHandlers] Failed to start export:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start export',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.MIX_EXPORT_CANCEL, async () => {
    try {
      mixExportService.cancelExport()
      return { success: true }
    } catch (error) {
      console.error('[mixExportHandlers] Failed to cancel export:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel export',
      }
    }
  })
}
