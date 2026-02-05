import * as fs from 'fs/promises'
import * as path from 'path'
import type {
  SearchHistoryFile,
  SearchHistoryEntry,
} from '@shared/types/searchHistory.types'

/**
 * Service for managing persistent search history storage
 */
export class SearchHistoryService {
  private readonly HISTORY_FILE_NAME = 'search-history.json'

  /**
   * Get the path to the search history file for a project
   */
  private getHistoryFilePath(projectDirectory: string): string {
    return path.join(projectDirectory, this.HISTORY_FILE_NAME)
  }

  /**
   * Load search history for a project
   */
  async loadHistory(
    projectId: string,
    projectDirectory: string
  ): Promise<SearchHistoryEntry[]> {
    try {
      const filePath = this.getHistoryFilePath(projectDirectory)

      // Check if file exists
      try {
        await fs.access(filePath)
      } catch {
        // File doesn't exist, return empty history
        return []
      }

      // Read and parse file
      const fileContent = await fs.readFile(filePath, 'utf-8')
      const historyFile: SearchHistoryFile = JSON.parse(fileContent)

      // Verify project ID matches
      if (historyFile.projectId !== projectId) {
        console.warn(
          `[SearchHistoryService] Project ID mismatch in history file. Expected ${projectId}, got ${historyFile.projectId}`
        )
        return []
      }

      return historyFile.history || []
    } catch (error) {
      console.error('[SearchHistoryService] Error loading search history:', error)
      return []
    }
  }

  /**
   * Save search history for a project
   */
  async saveHistory(
    projectId: string,
    projectName: string,
    projectDirectory: string,
    history: SearchHistoryEntry[]
  ): Promise<void> {
    try {
      const filePath = this.getHistoryFilePath(projectDirectory)

      const historyFile: SearchHistoryFile = {
        projectId,
        projectName,
        history,
        lastUpdated: new Date().toISOString(),
      }

      await fs.writeFile(filePath, JSON.stringify(historyFile, null, 2), 'utf-8')

      console.log(
        `[SearchHistoryService] Saved ${history.length} search history entries to ${filePath}`
      )
    } catch (error) {
      console.error('[SearchHistoryService] Error saving search history:', error)
      throw error
    }
  }

  /**
   * Clear search history for a project
   */
  async clearHistory(projectDirectory: string): Promise<void> {
    try {
      const filePath = this.getHistoryFilePath(projectDirectory)

      try {
        await fs.unlink(filePath)
        console.log(`[SearchHistoryService] Cleared search history at ${filePath}`)
      } catch (error) {
        // File might not exist, ignore error
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error
        }
      }
    } catch (error) {
      console.error('[SearchHistoryService] Error clearing search history:', error)
      throw error
    }
  }
}

// Singleton instance
export const searchHistoryService = new SearchHistoryService()
