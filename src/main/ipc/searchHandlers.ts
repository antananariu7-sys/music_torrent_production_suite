import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type { RuTrackerSearchService } from '../services/RuTrackerSearchService'
import type { DiscographySearchService } from '../services/DiscographySearchService'
import { searchHistoryService } from '../services/SearchHistoryService'
import type { SearchRequest, ProgressiveSearchRequest } from '@shared/types/search.types'
import type { DiscographySearchRequest } from '@shared/types/discography.types'
import type {
  SaveSearchHistoryRequest,
  LoadSearchHistoryRequest,
  SearchHistoryResponse,
} from '@shared/types/searchHistory.types'

export function registerSearchHandlers(
  searchService: RuTrackerSearchService,
  discographySearchService: DiscographySearchService
): void {
  // Search
  ipcMain.handle(IPC_CHANNELS.SEARCH_START, async (_event, request: SearchRequest) => {
    try {
      const response = await searchService.search(request)
      return response
    } catch (error) {
      console.error('Search failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.SEARCH_OPEN_URL, async (_event, url: string) => {
    try {
      const response = await searchService.openUrlWithSession(url)
      return response
    } catch (error) {
      console.error('Failed to open URL:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open URL',
      }
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.SEARCH_START_PROGRESSIVE,
    async (event, request: ProgressiveSearchRequest) => {
      try {
        const response = await searchService.searchProgressive(request, (progress) => {
          event.sender.send(IPC_CHANNELS.SEARCH_PROGRESS, progress)
        })
        return response
      } catch (error) {
        console.error('Progressive search failed:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Progressive search failed',
        }
      }
    }
  )

  // Discography search
  ipcMain.handle(
    IPC_CHANNELS.DISCOGRAPHY_SEARCH,
    async (event, request: DiscographySearchRequest) => {
      try {
        const response = await discographySearchService.searchInPages(request, (progress) => {
          event.sender.send(IPC_CHANNELS.DISCOGRAPHY_SEARCH_PROGRESS, progress)
        })
        return response
      } catch (error) {
        console.error('Discography search failed:', error)
        return {
          success: false,
          scanResults: [],
          matchedPages: [],
          totalScanned: 0,
          matchCount: 0,
          error: error instanceof Error ? error.message : 'Discography search failed',
        }
      }
    }
  )

  // Search history
  ipcMain.handle(
    'searchHistory:load',
    async (_event, request: LoadSearchHistoryRequest & { projectDirectory: string }): Promise<SearchHistoryResponse> => {
      try {
        const { projectId, projectDirectory } = request

        if (!projectDirectory) {
          return {
            success: false,
            error: 'Project directory not provided',
          }
        }

        const history = await searchHistoryService.loadHistory(projectId, projectDirectory)

        return {
          success: true,
          history,
        }
      } catch (error) {
        console.error('Error loading search history:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to load search history',
        }
      }
    }
  )

  ipcMain.handle(
    'searchHistory:save',
    async (_event, request: SaveSearchHistoryRequest & { projectDirectory: string }): Promise<SearchHistoryResponse> => {
      try {
        const { projectId, projectName, history, projectDirectory } = request

        if (!projectDirectory) {
          return {
            success: false,
            error: 'Project directory not provided',
          }
        }

        await searchHistoryService.saveHistory(
          projectId,
          projectName,
          projectDirectory,
          history
        )

        return {
          success: true,
        }
      } catch (error) {
        console.error('Error saving search history:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to save search history',
        }
      }
    }
  )
}
