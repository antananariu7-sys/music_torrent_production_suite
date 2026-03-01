import { ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type {
  SaveSearchHistoryRequest,
  LoadSearchHistoryRequest,
  SearchHistoryResponse,
} from '@shared/types/searchHistory.types'

export const searchHistoryApi = {
  load: (
    request: LoadSearchHistoryRequest & { projectDirectory: string }
  ): Promise<SearchHistoryResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.SEARCH_HISTORY_LOAD, request),

  save: (
    request: SaveSearchHistoryRequest & { projectDirectory: string }
  ): Promise<SearchHistoryResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.SEARCH_HISTORY_SAVE, request),
}
