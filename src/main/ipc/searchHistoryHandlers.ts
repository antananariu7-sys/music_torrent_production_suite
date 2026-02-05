import { ipcMain } from 'electron'
import { searchHistoryService } from '../services/SearchHistoryService'
import type {
  SaveSearchHistoryRequest,
  LoadSearchHistoryRequest,
  SearchHistoryResponse,
} from '@shared/types/searchHistory.types'

/**
 * Register IPC handlers for search history operations
 */
export function registerSearchHistoryHandlers(): void {
  // Load search history
  ipcMain.handle(
    'searchHistory:load',
    async (_event, request: LoadSearchHistoryRequest): Promise<SearchHistoryResponse> => {
      try {
        const { projectId } = request

        // Get current project to get directory
        // Note: You'll need to pass projectDirectory or get it from project store
        // For now, we'll need to modify the request to include it
        const projectDirectory = (request as any).projectDirectory

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
        console.error('[searchHistoryHandlers] Error loading search history:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to load search history',
        }
      }
    }
  )

  // Save search history
  ipcMain.handle(
    'searchHistory:save',
    async (_event, request: SaveSearchHistoryRequest): Promise<SearchHistoryResponse> => {
      try {
        const { projectId, projectName, history } = request

        // Get project directory from request
        const projectDirectory = (request as any).projectDirectory

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
        console.error('[searchHistoryHandlers] Error saving search history:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to save search history',
        }
      }
    }
  )

  // Clear search history
  ipcMain.handle(
    'searchHistory:clear',
    async (_event, projectDirectory: string): Promise<SearchHistoryResponse> => {
      try {
        await searchHistoryService.clearHistory(projectDirectory)

        return {
          success: true,
        }
      } catch (error) {
        console.error('[searchHistoryHandlers] Error clearing search history:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to clear search history',
        }
      }
    }
  )

  console.log('[searchHistoryHandlers] Search history IPC handlers registered')
}
