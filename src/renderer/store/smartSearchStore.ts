import { create } from 'zustand'
import type {
  SearchClassificationResult,
  MusicBrainzAlbum,
} from '@shared/types/musicbrainz.types'
import type { SearchResult } from '@shared/types/search.types'
import type { SearchHistoryEntry as PersistentSearchHistoryEntry } from '@shared/types/searchHistory.types'
import type {
  DiscographySearchProgress,
  PageContentScanResult,
} from '@shared/types/discography.types'

/**
 * Search History Entry
 */
export interface SearchHistoryEntry {
  id: string
  query: string
  timestamp: Date
  status: 'completed' | 'error' | 'cancelled'
  result?: string // Description of result (e.g., "Downloaded album X")
}

/**
 * Activity Log Entry
 */
export interface ActivityLogEntry {
  id: string
  timestamp: Date
  step: SearchWorkflowStep
  message: string
  type: 'info' | 'success' | 'error' | 'warning'
}

/**
 * Smart Search Workflow States
 */
export type SearchWorkflowStep =
  | 'idle' // No search
  | 'classifying' // Classifying search term
  | 'user-choice' // Waiting for user to choose classification
  | 'selecting-album' // User selecting album from MusicBrainz results
  | 'selecting-action' // User choosing action (download album/song/discography)
  | 'searching-rutracker' // Searching RuTracker with query
  | 'selecting-torrent' // User selecting torrent from RuTracker results
  | 'collecting' // Adding torrent to collection
  | 'downloading' // Downloading torrent file (kept for direct download option)
  | 'completed' // Workflow completed
  | 'error' // Error occurred

interface SmartSearchState {
  // Current workflow step
  step: SearchWorkflowStep

  // User's original search query
  originalQuery: string

  // Classification results
  classificationResults: SearchClassificationResult[]
  selectedClassification: SearchClassificationResult | null

  // MusicBrainz album results
  albums: MusicBrainzAlbum[]
  selectedAlbum: MusicBrainzAlbum | null

  // User's chosen action
  userAction: 'album' | 'song' | 'discography' | null

  // RuTracker search results
  ruTrackerQuery: string
  ruTrackerResults: SearchResult[]
  selectedTorrent: SearchResult | null

  // Download state
  downloadedFilePath: string | null

  // Error state
  error: string | null

  // Loading state
  isLoading: boolean

  // Discography scan state
  isScannningDiscography: boolean
  discographyScanProgress: DiscographySearchProgress | null
  discographyScanResults: PageContentScanResult[]
  scannedTorrentIds: Set<string>

  // Search history
  searchHistory: SearchHistoryEntry[]

  // Activity log
  activityLog: ActivityLogEntry[]

  // Project context for persistence
  projectId?: string
  projectName?: string
  projectDirectory?: string

  // Actions
  setProjectContext: (projectId: string, projectName: string, projectDirectory: string) => void
  loadHistoryFromProject: (projectId: string, projectDirectory: string) => Promise<void>
  startSearch: (query: string) => void
  setClassificationResults: (results: SearchClassificationResult[]) => void
  selectClassification: (result: SearchClassificationResult) => void
  setAlbums: (albums: MusicBrainzAlbum[]) => void
  selectAlbum: (album: MusicBrainzAlbum) => void
  selectAction: (action: 'album' | 'song' | 'discography') => void
  setRuTrackerResults: (query: string, results: SearchResult[]) => void
  selectTorrent: (torrent: SearchResult) => void
  setDownloadComplete: (filePath: string) => void
  setError: (error: string) => void
  setStep: (step: SearchWorkflowStep) => void
  setLoading: (isLoading: boolean) => void
  addActivityLog: (message: string, type: ActivityLogEntry['type']) => void
  addToHistory: (entry: Omit<SearchHistoryEntry, 'id' | 'timestamp'>) => void
  removeFromHistory: (id: string) => void
  clearHistory: () => void
  clearActivityLog: () => void
  reset: () => void

  // Discography scan actions
  startDiscographyScan: () => void
  setDiscographyScanProgress: (progress: DiscographySearchProgress | null) => void
  setDiscographyScanResults: (results: PageContentScanResult[]) => void
  stopDiscographyScan: () => void
}

const initialState = {
  step: 'idle' as SearchWorkflowStep,
  originalQuery: '',
  classificationResults: [],
  selectedClassification: null,
  albums: [],
  selectedAlbum: null,
  userAction: null,
  ruTrackerQuery: '',
  ruTrackerResults: [],
  selectedTorrent: null,
  downloadedFilePath: null,
  error: null,
  isLoading: false,
  searchHistory: [] as SearchHistoryEntry[],
  activityLog: [] as ActivityLogEntry[],
  // Discography scan initial state
  isScannningDiscography: false,
  discographyScanProgress: null as DiscographySearchProgress | null,
  discographyScanResults: [] as PageContentScanResult[],
  scannedTorrentIds: new Set<string>(),
}

/**
 * Helper function to save search history to disk
 */
async function saveSearchHistoryToDisk(
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
    const persistentHistory: PersistentSearchHistoryEntry[] = history.map((entry) => ({
      ...entry,
      timestamp: entry.timestamp.toISOString(),
    }))

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

export const useSmartSearchStore = create<SmartSearchState>((set) => ({
  ...initialState,

  setProjectContext: (projectId: string, projectName: string, projectDirectory: string) =>
    set({ projectId, projectName, projectDirectory }),

  loadHistoryFromProject: async (projectId: string, projectDirectory: string) => {
    const history = await loadSearchHistoryFromDisk(projectId, projectDirectory)
    set({ searchHistory: history })
  },

  startSearch: (query: string) =>
    set((state) => ({
      ...initialState,
      // Preserve history, activity log, and project context
      searchHistory: state.searchHistory,
      activityLog: state.activityLog,
      projectId: state.projectId,
      projectName: state.projectName,
      projectDirectory: state.projectDirectory,
      // Start new search
      originalQuery: query,
      step: 'classifying',
      isLoading: true,
    })),

  setClassificationResults: (results: SearchClassificationResult[]) =>
    set({
      classificationResults: results,
      step: results.length > 0 ? 'user-choice' : 'error',
      error: results.length === 0 ? 'No results found' : null,
      isLoading: false,
    }),

  selectClassification: (result: SearchClassificationResult) =>
    set({
      selectedClassification: result,
      step: result.type === 'song' ? 'selecting-album' : 'selecting-action',
      isLoading: result.type === 'song', // Load albums if song
    }),

  setAlbums: (albums: MusicBrainzAlbum[]) =>
    set({
      albums,
      step: albums.length > 0 ? 'selecting-album' : 'error',
      error: albums.length === 0 ? 'No albums found' : null,
      isLoading: false,
    }),

  selectAlbum: (album: MusicBrainzAlbum) =>
    set({
      selectedAlbum: album,
      step: 'searching-rutracker',
      isLoading: true,
    }),

  selectAction: (action: 'album' | 'song' | 'discography') =>
    set((state) => ({
      userAction: action,
      step:
        action === 'discography' || state.selectedClassification?.type === 'album'
          ? 'searching-rutracker'
          : 'selecting-album',
      isLoading: true,
    })),

  setRuTrackerResults: (query: string, results: SearchResult[]) =>
    set({
      ruTrackerQuery: query,
      ruTrackerResults: results,
      step: results.length > 0 ? 'selecting-torrent' : 'error',
      error: results.length === 0 ? 'No torrents found on RuTracker' : null,
      isLoading: false,
    }),

  selectTorrent: (torrent: SearchResult) =>
    set({
      selectedTorrent: torrent,
      step: 'collecting',
      isLoading: false,
    }),

  setDownloadComplete: (filePath: string) =>
    set({
      downloadedFilePath: filePath,
      step: 'completed',
      isLoading: false,
    }),

  setError: (error: string) =>
    set({
      error,
      step: 'error',
      isLoading: false,
    }),

  setStep: (step: SearchWorkflowStep) =>
    set({ step }),

  setLoading: (isLoading: boolean) =>
    set({ isLoading }),

  addActivityLog: (message: string, type: ActivityLogEntry['type']) =>
    set((state) => ({
      activityLog: [
        ...state.activityLog,
        {
          id: `${Date.now()}-${Math.random()}`,
          timestamp: new Date(),
          step: state.step,
          message,
          type,
        },
      ],
    })),

  addToHistory: (entry: Omit<SearchHistoryEntry, 'id' | 'timestamp'>) =>
    set((state) => {
      const newHistory = [
        {
          id: `${Date.now()}-${Math.random()}`,
          timestamp: new Date(),
          ...entry,
        },
        ...state.searchHistory,
      ].slice(0, 50) // Keep only last 50 searches

      // Auto-save to file (fire and forget)
      saveSearchHistoryToDisk(
        newHistory,
        state.projectId,
        state.projectName,
        state.projectDirectory
      )

      return { searchHistory: newHistory }
    }),

  removeFromHistory: (id: string) =>
    set((state) => {
      const newHistory = state.searchHistory.filter((entry) => entry.id !== id)

      // Auto-save to file (fire and forget)
      saveSearchHistoryToDisk(
        newHistory,
        state.projectId,
        state.projectName,
        state.projectDirectory
      )

      return { searchHistory: newHistory }
    }),

  clearHistory: () =>
    set({ searchHistory: [] }),

  clearActivityLog: () =>
    set({ activityLog: [] }),

  reset: () =>
    set({
      ...initialState,
      searchHistory: useSmartSearchStore.getState().searchHistory,
      activityLog: useSmartSearchStore.getState().activityLog,
    }),

  // Discography scan actions
  startDiscographyScan: () =>
    set({
      isScannningDiscography: true,
      discographyScanProgress: null,
      discographyScanResults: [],
    }),

  setDiscographyScanProgress: (progress: DiscographySearchProgress | null) =>
    set({ discographyScanProgress: progress }),

  setDiscographyScanResults: (results: PageContentScanResult[]) =>
    set((state) => {
      // Track which torrents have been scanned
      const scannedIds = new Set(state.scannedTorrentIds)
      results.forEach((r) => scannedIds.add(r.searchResult.id))

      return {
        discographyScanResults: results,
        scannedTorrentIds: scannedIds,
        isScannningDiscography: false,
        discographyScanProgress: null,
      }
    }),

  stopDiscographyScan: () =>
    set({
      isScannningDiscography: false,
      discographyScanProgress: null,
    }),
}))

// Selector hooks for better performance
export const useSearchStep = () => useSmartSearchStore((state) => state.step)
export const useIsSearching = () => useSmartSearchStore((state) => state.isLoading)
export const useSearchError = () => useSmartSearchStore((state) => state.error)
export const useClassificationResults = () =>
  useSmartSearchStore((state) => state.classificationResults)
export const useSelectedClassification = () =>
  useSmartSearchStore((state) => state.selectedClassification)
export const useAlbums = () => useSmartSearchStore((state) => state.albums)
export const useSelectedAlbum = () => useSmartSearchStore((state) => state.selectedAlbum)
export const useRuTrackerResults = () => useSmartSearchStore((state) => state.ruTrackerResults)
export const useSelectedTorrent = () => useSmartSearchStore((state) => state.selectedTorrent)
export const useSearchHistory = () => useSmartSearchStore((state) => state.searchHistory)
export const useActivityLog = () => useSmartSearchStore((state) => state.activityLog)

// Discography scan selectors
export const useIsScannningDiscography = () =>
  useSmartSearchStore((state) => state.isScannningDiscography)
export const useDiscographyScanProgress = () =>
  useSmartSearchStore((state) => state.discographyScanProgress)
export const useDiscographyScanResults = () =>
  useSmartSearchStore((state) => state.discographyScanResults)
export const useScannedTorrentIds = () =>
  useSmartSearchStore((state) => state.scannedTorrentIds)
