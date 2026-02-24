import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import { duplicateDetectionService } from '../services/DuplicateDetectionService'
import type { DuplicateCheckRequest } from '@shared/types/duplicateDetection.types'

export function registerDuplicateHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.DUPLICATE_CHECK,
    async (_event, request: DuplicateCheckRequest) => {
      try {
        return duplicateDetectionService.check(request)
      } catch (error) {
        console.error('Duplicate check failed:', error)
        return {
          success: false,
          matches: [],
          indexedFileCount: 0,
          error:
            error instanceof Error ? error.message : 'Duplicate check failed',
        }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.DUPLICATE_RESCAN,
    async (_event, projectDirectory: string) => {
      try {
        return duplicateDetectionService.rescan(projectDirectory)
      } catch (error) {
        console.error('Duplicate rescan failed:', error)
        return {
          success: false,
          matches: [],
          indexedFileCount: 0,
          error:
            error instanceof Error ? error.message : 'Duplicate rescan failed',
        }
      }
    }
  )
}
