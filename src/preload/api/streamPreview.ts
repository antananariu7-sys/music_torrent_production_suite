import { ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type {
  StreamPreviewStartRequest,
  StreamPreviewReadyEvent,
  StreamPreviewBufferingEvent,
  StreamPreviewErrorEvent,
} from '@shared/types/streamPreview.types'

export const streamPreviewApi = {
  start: (request: StreamPreviewStartRequest): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.STREAM_PREVIEW_START, request),

  stop: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.STREAM_PREVIEW_STOP),

  onReady: (
    callback: (event: StreamPreviewReadyEvent) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: StreamPreviewReadyEvent
    ) => {
      callback(data)
    }
    ipcRenderer.on(IPC_CHANNELS.STREAM_PREVIEW_READY, handler)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.STREAM_PREVIEW_READY, handler)
    }
  },

  onFullReady: (
    callback: (event: StreamPreviewReadyEvent) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: StreamPreviewReadyEvent
    ) => {
      callback(data)
    }
    ipcRenderer.on(IPC_CHANNELS.STREAM_PREVIEW_FULL_READY, handler)
    return () => {
      ipcRenderer.removeListener(
        IPC_CHANNELS.STREAM_PREVIEW_FULL_READY,
        handler
      )
    }
  },

  onBuffering: (
    callback: (event: StreamPreviewBufferingEvent) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: StreamPreviewBufferingEvent
    ) => {
      callback(data)
    }
    ipcRenderer.on(IPC_CHANNELS.STREAM_PREVIEW_BUFFERING, handler)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.STREAM_PREVIEW_BUFFERING, handler)
    }
  },

  onError: (
    callback: (event: StreamPreviewErrorEvent) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: StreamPreviewErrorEvent
    ) => {
      callback(data)
    }
    ipcRenderer.on(IPC_CHANNELS.STREAM_PREVIEW_ERROR, handler)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.STREAM_PREVIEW_ERROR, handler)
    }
  },
}
