import { create } from 'zustand'
import type {
  SearchClassificationResult,
  MusicBrainzAlbum,
} from '@shared/types/musicbrainz.types'
import type { SearchResult } from '@shared/types/search.types'

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
  | 'downloading' // Downloading torrent file
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

  // Actions
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
  reset: () => void
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
}

export const useSmartSearchStore = create<SmartSearchState>((set) => ({
  ...initialState,

  startSearch: (query: string) =>
    set({
      ...initialState,
      originalQuery: query,
      step: 'classifying',
      isLoading: true,
    }),

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
      step: 'downloading',
      isLoading: true,
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

  reset: () =>
    set(initialState),
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
