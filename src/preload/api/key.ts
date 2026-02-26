import { ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type {
  KeyData,
  KeyDetectRequest,
  KeyBatchRequest,
  KeyDetectSongRequest,
  KeyProgressEvent,
} from '@shared/types/waveform.types'

export const keyApi = {
  detect: (
    request: KeyDetectRequest
  ): Promise<{ success: boolean; data?: KeyData; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.KEY_DETECT, request),

  detectBatch: (
    request: KeyBatchRequest
  ): Promise<{ success: boolean; data?: KeyData[]; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.KEY_DETECT_BATCH, request),

  detectSong: (
    request: KeyDetectSongRequest
  ): Promise<{ success: boolean; data?: KeyData; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.KEY_DETECT_SONG, request),

  onProgress: (
    callback: (progress: KeyProgressEvent) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      progress: KeyProgressEvent
    ) => {
      callback(progress)
    }
    ipcRenderer.on(IPC_CHANNELS.KEY_PROGRESS, handler)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.KEY_PROGRESS, handler)
    }
  },
}
