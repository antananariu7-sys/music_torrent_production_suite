import { ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type {
  DuplicateCheckRequest,
  DuplicateCheckResponse,
} from '@shared/types/duplicateDetection.types'

export const duplicateApi = {
  check: (request: DuplicateCheckRequest): Promise<DuplicateCheckResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.DUPLICATE_CHECK, request),

  rescan: (projectDirectory: string): Promise<DuplicateCheckResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.DUPLICATE_RESCAN, projectDirectory),
}
