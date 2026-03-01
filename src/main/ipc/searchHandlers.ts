import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type { RuTrackerSearchService } from '../services/RuTrackerSearchService'
import type { DiscographySearchService } from '../services/DiscographySearchService'
import { searchHistoryService } from '../services/SearchHistoryService'
import {
  SearchRequestSchema,
  ProgressiveSearchRequestSchema,
  LoadMoreRequestSchema,
  DiscographySearchRequestSchema,
  LoadSearchHistoryRequestSchema,
  SaveSearchHistoryRequestSchema,
} from '@shared/schemas/search.schema'
import { z, ZodError } from 'zod'
import type { SearchHistoryResponse } from '@shared/types/searchHistory.types'

function formatError(error: unknown): string {
  if (error instanceof ZodError) return error.message
  if (error instanceof Error) return error.message
  return String(error)
}

export function registerSearchHandlers(
  searchService: RuTrackerSearchService,
  discographySearchService: DiscographySearchService
): void {
  // Search
  ipcMain.handle(IPC_CHANNELS.SEARCH_START, async (_event, request) => {
    try {
      const validated = SearchRequestSchema.parse(request)
      const response = await searchService.search(validated)
      return response
    } catch (error) {
      console.error('Search failed:', formatError(error))
      return {
        success: false,
        error: formatError(error),
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.SEARCH_OPEN_URL, async (_event, url) => {
    try {
      const validatedUrl = z.string().url().parse(url)
      const response = await searchService.openUrlWithSession(validatedUrl)
      return response
    } catch (error) {
      console.error('Failed to open URL:', formatError(error))
      return {
        success: false,
        error: formatError(error),
      }
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.SEARCH_START_PROGRESSIVE,
    async (event, request) => {
      try {
        const validated = ProgressiveSearchRequestSchema.parse(request)
        const response = await searchService.searchProgressive(
          validated,
          (progress) => {
            event.sender.send(IPC_CHANNELS.SEARCH_PROGRESS, progress)
          }
        )
        return response
      } catch (error) {
        console.error('Progressive search failed:', formatError(error))
        return {
          success: false,
          error: formatError(error),
        }
      }
    }
  )

  // Load more results (additional pages)
  ipcMain.handle(IPC_CHANNELS.SEARCH_LOAD_MORE, async (_event, request) => {
    try {
      const validated = LoadMoreRequestSchema.parse(request)
      return await searchService.loadMoreResults(validated)
    } catch (error) {
      console.error('Load more failed:', formatError(error))
      return {
        success: false,
        results: [],
        loadedPages: 0,
        totalPages: 0,
        isComplete: false,
        error: formatError(error),
      }
    }
  })

  // Discography search
  ipcMain.handle(IPC_CHANNELS.DISCOGRAPHY_SEARCH, async (event, request) => {
    try {
      const validated = DiscographySearchRequestSchema.parse(request)
      const response = await discographySearchService.searchInPages(
        validated,
        (progress) => {
          event.sender.send(IPC_CHANNELS.DISCOGRAPHY_SEARCH_PROGRESS, progress)
        }
      )
      return response
    } catch (error) {
      console.error('Discography search failed:', formatError(error))
      return {
        success: false,
        scanResults: [],
        matchedPages: [],
        totalScanned: 0,
        matchCount: 0,
        error: formatError(error),
      }
    }
  })

  // Search history
  ipcMain.handle(
    IPC_CHANNELS.SEARCH_HISTORY_LOAD,
    async (_event, request): Promise<SearchHistoryResponse> => {
      try {
        const validated = LoadSearchHistoryRequestSchema.parse(request)

        const history = await searchHistoryService.loadHistory(
          validated.projectId,
          validated.projectDirectory
        )

        return {
          success: true,
          history,
        }
      } catch (error) {
        console.error('Error loading search history:', formatError(error))
        return {
          success: false,
          error: formatError(error),
        }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.SEARCH_HISTORY_SAVE,
    async (_event, request): Promise<SearchHistoryResponse> => {
      try {
        const validated = SaveSearchHistoryRequestSchema.parse(request)

        await searchHistoryService.saveHistory(
          validated.projectId,
          validated.projectName,
          validated.projectDirectory,
          validated.history
        )

        return {
          success: true,
        }
      } catch (error) {
        console.error('Error saving search history:', formatError(error))
        return {
          success: false,
          error: formatError(error),
        }
      }
    }
  )
}
