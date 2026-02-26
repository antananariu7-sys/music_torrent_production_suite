import { ipcRenderer } from 'electron'
import type {
  SaveSearchHistoryRequest,
  LoadSearchHistoryRequest,
  SearchHistoryResponse,
} from '@shared/types/searchHistory.types'

export const searchHistoryApi = {
  load: (
    request: LoadSearchHistoryRequest & { projectDirectory: string }
  ): Promise<SearchHistoryResponse> =>
    ipcRenderer.invoke('searchHistory:load', request),

  save: (
    request: SaveSearchHistoryRequest & { projectDirectory: string }
  ): Promise<SearchHistoryResponse> =>
    ipcRenderer.invoke('searchHistory:save', request),
}
