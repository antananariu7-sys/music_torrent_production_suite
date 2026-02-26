import type { SearchHistoryEntry as PersistentSearchHistoryEntry } from '@shared/types/searchHistory.types'
import type { SearchHistoryEntry } from './smartSearchTypes'

/**
 * Helper function to save search history to disk
 */
export async function saveSearchHistoryToDisk(
  history: SearchHistoryEntry[],
  projectId?: string,
  projectName?: string,
  projectDirectory?: string
): Promise<void> {
  if (!projectId || !projectName || !projectDirectory) {
    console.warn('[smartSearchStore] Cannot save history: missing project info')
    return
  }

  try {
    // Convert Date objects to ISO strings for serialization
    const persistentHistory: PersistentSearchHistoryEntry[] = history.map(
      (entry) => ({
        ...entry,
        timestamp: entry.timestamp.toISOString(),
      })
    )

    await window.api.searchHistory.save({
      projectId,
      projectName,
      projectDirectory,
      history: persistentHistory,
    })
  } catch (error) {
    console.error('[smartSearchStore] Failed to save search history:', error)
  }
}

/**
 * Helper function to load search history from disk
 */
export async function loadSearchHistoryFromDisk(
  projectId: string,
  projectDirectory: string
): Promise<SearchHistoryEntry[]> {
  try {
    const response = await window.api.searchHistory.load({
      projectId,
      projectDirectory,
    })

    if (response.success && response.history) {
      // Convert ISO strings back to Date objects
      return response.history.map((entry) => ({
        ...entry,
        timestamp: new Date(entry.timestamp),
      }))
    }

    return []
  } catch (error) {
    console.error('[smartSearchStore] Failed to load search history:', error)
    return []
  }
}
