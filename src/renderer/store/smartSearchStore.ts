import { create } from 'zustand'
import type {
  SearchClassificationResult,
  MusicBrainzAlbum,
} from '@shared/types/musicbrainz.types'
import type { SearchResult } from '@shared/types/search.types'
import type {
  DiscographySearchProgress,
  PageContentScanResult,
} from '@shared/types/discography.types'
import type {
  SearchWorkflowStep,
  SmartSearchState,
  ActivityLogEntry,
  SearchHistoryEntry,
} from './smartSearchTypes'
import {
  saveSearchHistoryToDisk,
  loadSearchHistoryFromDisk,
} from './smartSearchPersistence'

// Re-export types and selectors for backward compatibility
export type {
  SearchHistoryEntry,
  ActivityLogEntry,
  SearchWorkflowStep,
} from './smartSearchTypes'
export { loadSearchHistoryFromDisk } from './smartSearchPersistence'
export {
  useSearchStep,
  useIsSearching,
  useSearchError,
  useClassificationResults,
  useSelectedClassification,
  useAlbums,
  useSelectedAlbum,
  useRuTrackerResults,
  useSelectedTorrent,
  useSearchHistory,
  useActivityLog,
  useDiscoSearchMeta,
  useIsLoadingMore,
  useLoadMoreError,
  useIsScannningDiscography,
  useDiscographyScanProgress,
  useDiscographyScanResults,
  useScannedTorrentIds,
} from './smartSearchSelectors'

const initialState = {
  step: 'idle' as SearchWorkflowStep,
  originalQuery: '',
  classificationResults: [] as SearchClassificationResult[],
  selectedClassification: null as SearchClassificationResult | null,
  albums: [] as MusicBrainzAlbum[],
  selectedAlbum: null as MusicBrainzAlbum | null,
  userAction: null as 'album' | 'song' | 'discography' | null,
  ruTrackerQuery: '',
  ruTrackerResults: [] as SearchResult[],
  selectedTorrent: null as SearchResult | null,
  discoQuery: '',
  discoLoadedPages: 0,
  discoTotalPages: 0,
  isLoadingMore: false,
  loadMoreError: null as string | null,
  downloadedFilePath: null as string | null,
  error: null as string | null,
  isLoading: false,
  searchHistory: [] as SearchHistoryEntry[],
  activityLog: [] as ActivityLogEntry[],
  // Discography scan initial state
  isScannningDiscography: false,
  discographyScanProgress: null as DiscographySearchProgress | null,
  discographyScanResults: [] as PageContentScanResult[],
  scannedTorrentIds: new Set<string>(),
}

export const useSmartSearchStore = create<SmartSearchState>((set) => ({
  ...initialState,

  setProjectContext: (
    projectId: string,
    projectName: string,
    projectDirectory: string
  ) => set({ projectId, projectName, projectDirectory }),

  loadHistoryFromProject: async (
    projectId: string,
    projectDirectory: string
  ) => {
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
        action === 'discography' ||
        state.selectedClassification?.type === 'album'
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

  setStep: (step: SearchWorkflowStep) => set({ step }),

  setLoading: (isLoading: boolean) => set({ isLoading }),

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

  clearHistory: () => set({ searchHistory: [] }),

  clearActivityLog: () => set({ activityLog: [] }),

  reset: () =>
    set({
      ...initialState,
      searchHistory: useSmartSearchStore.getState().searchHistory,
      activityLog: useSmartSearchStore.getState().activityLog,
    }),

  // Load-more actions
  setDiscoSearchMeta: (
    query: string,
    loadedPages: number,
    totalPages: number
  ) =>
    set({
      discoQuery: query,
      discoLoadedPages: loadedPages,
      discoTotalPages: totalPages,
    }),

  appendRuTrackerResults: (
    newResults: SearchResult[],
    searchSource: 'album' | 'discography'
  ) =>
    set((state) => {
      const existingIds = new Set(state.ruTrackerResults.map((r) => r.id))
      const unique = newResults
        .filter((r) => !existingIds.has(r.id))
        .map((r) => ({ ...r, searchSource }))
      return {
        ruTrackerResults: [...state.ruTrackerResults, ...unique],
        isLoadingMore: false,
        loadMoreError: null,
      }
    }),

  setLoadingMore: (loading: boolean) =>
    set({ isLoadingMore: loading, loadMoreError: null }),

  setLoadMoreError: (error: string | null) =>
    set({ loadMoreError: error, isLoadingMore: false }),

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
