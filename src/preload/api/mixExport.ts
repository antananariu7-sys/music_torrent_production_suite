import { ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type {
  FfmpegCheckResult,
  MixExportRequest,
  MixExportProgress,
} from '@shared/types/mixExport.types'

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export const mixExportApi = {
  checkFfmpeg: (): Promise<ApiResponse<FfmpegCheckResult>> =>
    ipcRenderer.invoke(IPC_CHANNELS.MIX_EXPORT_FFMPEG_CHECK),

  start: (request: MixExportRequest): Promise<ApiResponse<{ jobId: string }>> =>
    ipcRenderer.invoke(IPC_CHANNELS.MIX_EXPORT_START, request),

  cancel: (): Promise<ApiResponse<void>> =>
    ipcRenderer.invoke(IPC_CHANNELS.MIX_EXPORT_CANCEL),

  onProgress: (
    callback: (progress: MixExportProgress) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      progress: MixExportProgress
    ) => {
      callback(progress)
    }
    ipcRenderer.on(IPC_CHANNELS.MIX_EXPORT_PROGRESS, handler)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.MIX_EXPORT_PROGRESS, handler)
    }
  },
}
