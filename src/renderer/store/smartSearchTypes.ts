import type {
  SearchClassificationResult,
  MusicBrainzAlbum,
} from '@shared/types/musicbrainz.types'
import type { SearchResult } from '@shared/types/search.types'
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

export interface SmartSearchState {
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

  // Load-more pagination state (discography search)
  discoQuery: string
  discoLoadedPages: number
  discoTotalPages: number
  isLoadingMore: boolean
  loadMoreError: string | null

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
  setProjectContext: (
    projectId: string,
    projectName: string,
    projectDirectory: string
  ) => void
  loadHistoryFromProject: (
    projectId: string,
    projectDirectory: string
  ) => Promise<void>
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

  // Load-more actions
  setDiscoSearchMeta: (
    query: string,
    loadedPages: number,
    totalPages: number
  ) => void
  appendRuTrackerResults: (
    newResults: SearchResult[],
    searchSource: 'album' | 'discography'
  ) => void
  setLoadingMore: (loading: boolean) => void
  setLoadMoreError: (error: string | null) => void

  // Discography scan actions
  startDiscographyScan: () => void
  setDiscographyScanProgress: (
    progress: DiscographySearchProgress | null
  ) => void
  setDiscographyScanResults: (results: PageContentScanResult[]) => void
  stopDiscographyScan: () => void
}
