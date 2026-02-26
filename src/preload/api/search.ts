import { ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type {
  SearchRequest,
  SearchResponse,
  ProgressiveSearchRequest,
  SearchProgressEvent,
  LoadMoreRequest,
  LoadMoreResponse,
} from '@shared/types/search.types'

export const searchApi = {
  start: (request: SearchRequest): Promise<SearchResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.SEARCH_START, request),

  startProgressive: (
    request: ProgressiveSearchRequest
  ): Promise<SearchResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.SEARCH_START_PROGRESSIVE, request),

  onProgress: (
    callback: (progress: SearchProgressEvent) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      progress: SearchProgressEvent
    ) => {
      callback(progress)
    }
    ipcRenderer.on(IPC_CHANNELS.SEARCH_PROGRESS, handler)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.SEARCH_PROGRESS, handler)
    }
  },

  openUrl: (url: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.SEARCH_OPEN_URL, url),

  loadMore: (request: LoadMoreRequest): Promise<LoadMoreResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.SEARCH_LOAD_MORE, request),
}
