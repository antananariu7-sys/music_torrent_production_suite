import { ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type {
  SectionData,
  SectionDetectRequest,
  SectionBatchRequest,
  SectionProgressEvent,
} from '@shared/types/sectionDetection.types'

export const sectionApi = {
  detect: (
    request: SectionDetectRequest
  ): Promise<{ success: boolean; data?: SectionData; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.SECTION_DETECT, request),

  detectBatch: (
    request: SectionBatchRequest
  ): Promise<{ success: boolean; data?: SectionData[]; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.SECTION_DETECT_BATCH, request),

  onProgress: (
    callback: (progress: SectionProgressEvent) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      progress: SectionProgressEvent
    ) => {
      callback(progress)
    }
    ipcRenderer.on(IPC_CHANNELS.SECTION_PROGRESS, handler)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.SECTION_PROGRESS, handler)
    }
  },
}
