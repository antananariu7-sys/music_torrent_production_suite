import { ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type {
  BpmData,
  BpmDetectRequest,
  BpmBatchRequest,
  BpmDetectSongRequest,
  BpmProgressEvent,
} from '@shared/types/waveform.types'

export const bpmApi = {
  detect: (
    request: BpmDetectRequest
  ): Promise<{ success: boolean; data?: BpmData; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.BPM_DETECT, request),

  detectBatch: (
    request: BpmBatchRequest
  ): Promise<{ success: boolean; data?: BpmData[]; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.BPM_DETECT_BATCH, request),

  detectSong: (
    request: BpmDetectSongRequest
  ): Promise<{ success: boolean; data?: BpmData; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.BPM_DETECT_SONG, request),

  onProgress: (
    callback: (progress: BpmProgressEvent) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      progress: BpmProgressEvent
    ) => {
      callback(progress)
    }
    ipcRenderer.on(IPC_CHANNELS.BPM_PROGRESS, handler)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.BPM_PROGRESS, handler)
    }
  },
}
