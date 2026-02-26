import { ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type {
  WaveformData,
  WaveformGenerateRequest,
  WaveformBatchRequest,
  WaveformProgressEvent,
} from '@shared/types/waveform.types'

export const waveformApi = {
  generate: (
    request: WaveformGenerateRequest
  ): Promise<{ success: boolean; data?: WaveformData; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.WAVEFORM_GENERATE, request),

  generateBatch: (
    request: WaveformBatchRequest
  ): Promise<{ success: boolean; data?: WaveformData[]; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.WAVEFORM_GENERATE_BATCH, request),

  rebuildBatch: (
    request: WaveformBatchRequest
  ): Promise<{ success: boolean; data?: WaveformData[]; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.WAVEFORM_REBUILD_BATCH, request),

  onProgress: (
    callback: (progress: WaveformProgressEvent) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      progress: WaveformProgressEvent
    ) => {
      callback(progress)
    }
    ipcRenderer.on(IPC_CHANNELS.WAVEFORM_PROGRESS, handler)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.WAVEFORM_PROGRESS, handler)
    }
  },
}
