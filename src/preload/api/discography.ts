import { ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type {
  DiscographySearchRequest,
  DiscographySearchResponse,
  DiscographySearchProgress,
} from '@shared/types/discography.types'

export const discographyApi = {
  search: (
    request: DiscographySearchRequest
  ): Promise<DiscographySearchResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.DISCOGRAPHY_SEARCH, request),

  onProgress: (
    callback: (progress: DiscographySearchProgress) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      progress: DiscographySearchProgress
    ) => {
      callback(progress)
    }
    ipcRenderer.on(IPC_CHANNELS.DISCOGRAPHY_SEARCH_PROGRESS, handler)
    return () => {
      ipcRenderer.removeListener(
        IPC_CHANNELS.DISCOGRAPHY_SEARCH_PROGRESS,
        handler
      )
    }
  },
}
