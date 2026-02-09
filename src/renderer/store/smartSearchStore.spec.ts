import { describe, it, expect, beforeEach, jest } from '@jest/globals'

// Mock window.api for search history persistence
const mockWindowApi = {
  searchHistory: {
    save: jest.fn().mockResolvedValue({ success: true } as never),
    load: jest.fn().mockResolvedValue({ success: true, history: [] } as never),
  },
}

;(globalThis as any).window = { api: mockWindowApi }

import { useSmartSearchStore } from './smartSearchStore'
import type { SearchClassificationResult } from '@shared/types/musicbrainz.types'

function makeClassification(overrides: Partial<SearchClassificationResult> = {}): SearchClassificationResult {
  return {
    type: 'album',
    artist: 'Test Artist',
    title: 'Test Album',
    confidence: 0.9,
    ...overrides,
  } as SearchClassificationResult
}

describe('smartSearchStore', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset store to initial state
    useSmartSearchStore.setState({
      step: 'idle',
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
      searchHistory: [],
      activityLog: [],
      isScannningDiscography: false,
      discographyScanProgress: null,
      discographyScanResults: [],
      scannedTorrentIds: new Set(),
    })
  })

  // =========================================
  // startSearch()
  // =========================================

  describe('startSearch', () => {
    it('should set step to "classifying" and isLoading to true', () => {
      const { startSearch } = useSmartSearchStore.getState()

      startSearch('Radiohead OK Computer')

      const state = useSmartSearchStore.getState()
      expect(state.step).toBe('classifying')
      expect(state.isLoading).toBe(true)
      expect(state.originalQuery).toBe('Radiohead OK Computer')
    })

    it('should preserve searchHistory and activityLog', () => {
      // Pre-populate history and activity log
      useSmartSearchStore.setState({
        searchHistory: [{ id: '1', query: 'old search', timestamp: new Date(), status: 'completed' }],
        activityLog: [{ id: '1', timestamp: new Date(), step: 'idle', message: 'test', type: 'info' }],
      })

      const { startSearch } = useSmartSearchStore.getState()
      startSearch('new search')

      const state = useSmartSearchStore.getState()
      expect(state.searchHistory).toHaveLength(1)
      expect(state.activityLog).toHaveLength(1)
    })

    it('should preserve project context', () => {
      useSmartSearchStore.setState({
        projectId: 'proj-1',
        projectName: 'My Project',
        projectDirectory: '/projects/my-project',
      })

      const { startSearch } = useSmartSearchStore.getState()
      startSearch('search query')

      const state = useSmartSearchStore.getState()
      expect(state.projectId).toBe('proj-1')
      expect(state.projectName).toBe('My Project')
    })

    it('should reset other state fields', () => {
      useSmartSearchStore.setState({
        classificationResults: [makeClassification()],
        selectedClassification: makeClassification(),
        error: 'some error',
      })

      const { startSearch } = useSmartSearchStore.getState()
      startSearch('new search')

      const state = useSmartSearchStore.getState()
      expect(state.classificationResults).toEqual([])
      expect(state.selectedClassification).toBeNull()
      expect(state.error).toBeNull()
    })
  })

  // =========================================
  // setClassificationResults()
  // =========================================

  describe('setClassificationResults', () => {
    it('should set step to "user-choice" when results exist', () => {
      const { setClassificationResults } = useSmartSearchStore.getState()

      setClassificationResults([makeClassification()])

      const state = useSmartSearchStore.getState()
      expect(state.step).toBe('user-choice')
      expect(state.classificationResults).toHaveLength(1)
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
    })

    it('should set step to "error" with message when results are empty', () => {
      const { setClassificationResults } = useSmartSearchStore.getState()

      setClassificationResults([])

      const state = useSmartSearchStore.getState()
      expect(state.step).toBe('error')
      expect(state.error).toBe('No results found')
      expect(state.isLoading).toBe(false)
    })
  })

  // =========================================
  // selectClassification()
  // =========================================

  describe('selectClassification', () => {
    it('should route to "selecting-album" for song type', () => {
      const { selectClassification } = useSmartSearchStore.getState()
      const songResult = makeClassification({ type: 'song' })

      selectClassification(songResult)

      const state = useSmartSearchStore.getState()
      expect(state.step).toBe('selecting-album')
      expect(state.selectedClassification).toEqual(songResult)
      expect(state.isLoading).toBe(true) // Loads albums for song
    })

    it('should route to "selecting-action" for album type', () => {
      const { selectClassification } = useSmartSearchStore.getState()
      const albumResult = makeClassification({ type: 'album' })

      selectClassification(albumResult)

      const state = useSmartSearchStore.getState()
      expect(state.step).toBe('selecting-action')
      expect(state.isLoading).toBe(false)
    })

    it('should route to "selecting-action" for artist type', () => {
      const { selectClassification } = useSmartSearchStore.getState()
      const artistResult = makeClassification({ type: 'artist' })

      selectClassification(artistResult)

      const state = useSmartSearchStore.getState()
      expect(state.step).toBe('selecting-action')
      expect(state.isLoading).toBe(false)
    })
  })

  // =========================================
  // selectAction()
  // =========================================

  describe('selectAction', () => {
    it('should route to "searching-rutracker" for discography action', () => {
      const { selectAction } = useSmartSearchStore.getState()

      selectAction('discography')

      const state = useSmartSearchStore.getState()
      expect(state.step).toBe('searching-rutracker')
      expect(state.userAction).toBe('discography')
      expect(state.isLoading).toBe(true)
    })

    it('should route to "searching-rutracker" for album classification + album action', () => {
      // First set a classification with type 'album'
      useSmartSearchStore.setState({
        selectedClassification: makeClassification({ type: 'album' }),
      })

      const { selectAction } = useSmartSearchStore.getState()
      selectAction('album')

      const state = useSmartSearchStore.getState()
      expect(state.step).toBe('searching-rutracker')
    })

    it('should route to "selecting-album" for song action', () => {
      useSmartSearchStore.setState({
        selectedClassification: makeClassification({ type: 'artist' }),
      })

      const { selectAction } = useSmartSearchStore.getState()
      selectAction('song')

      const state = useSmartSearchStore.getState()
      expect(state.step).toBe('selecting-album')
    })
  })

  // =========================================
  // addToHistory()
  // =========================================

  describe('addToHistory', () => {
    it('should prepend entry to history', () => {
      const { addToHistory } = useSmartSearchStore.getState()

      addToHistory({ query: 'first search', status: 'completed' })
      addToHistory({ query: 'second search', status: 'completed' })

      const state = useSmartSearchStore.getState()
      expect(state.searchHistory).toHaveLength(2)
      expect(state.searchHistory[0].query).toBe('second search')
      expect(state.searchHistory[1].query).toBe('first search')
    })

    it('should limit history to 50 entries', () => {
      const { addToHistory } = useSmartSearchStore.getState()

      for (let i = 0; i < 55; i++) {
        addToHistory({ query: `search ${i}`, status: 'completed' })
      }

      const state = useSmartSearchStore.getState()
      expect(state.searchHistory).toHaveLength(50)
    })

    it('should generate id and timestamp', () => {
      const { addToHistory } = useSmartSearchStore.getState()

      addToHistory({ query: 'test', status: 'completed' })

      const entry = useSmartSearchStore.getState().searchHistory[0]
      expect(entry.id).toBeDefined()
      expect(entry.id.length).toBeGreaterThan(0)
      expect(entry.timestamp).toBeInstanceOf(Date)
    })
  })

  // =========================================
  // removeFromHistory()
  // =========================================

  describe('removeFromHistory', () => {
    it('should remove entry by id', () => {
      useSmartSearchStore.setState({
        searchHistory: [
          { id: 'a', query: 'first', timestamp: new Date(), status: 'completed' },
          { id: 'b', query: 'second', timestamp: new Date(), status: 'completed' },
        ],
      })

      const { removeFromHistory } = useSmartSearchStore.getState()
      removeFromHistory('a')

      const state = useSmartSearchStore.getState()
      expect(state.searchHistory).toHaveLength(1)
      expect(state.searchHistory[0].id).toBe('b')
    })

    it('should preserve other entries', () => {
      useSmartSearchStore.setState({
        searchHistory: [
          { id: 'a', query: 'first', timestamp: new Date(), status: 'completed' },
          { id: 'b', query: 'second', timestamp: new Date(), status: 'completed' },
          { id: 'c', query: 'third', timestamp: new Date(), status: 'completed' },
        ],
      })

      const { removeFromHistory } = useSmartSearchStore.getState()
      removeFromHistory('b')

      const state = useSmartSearchStore.getState()
      expect(state.searchHistory).toHaveLength(2)
      expect(state.searchHistory.map(e => e.id)).toEqual(['a', 'c'])
    })
  })

  // =========================================
  // setDiscographyScanResults()
  // =========================================

  describe('setDiscographyScanResults', () => {
    it('should track scanned torrent IDs', () => {
      const { setDiscographyScanResults } = useSmartSearchStore.getState()

      setDiscographyScanResults([
        { searchResult: { id: 'torrent-1' } } as any,
        { searchResult: { id: 'torrent-2' } } as any,
      ])

      const state = useSmartSearchStore.getState()
      expect(state.scannedTorrentIds.has('torrent-1')).toBe(true)
      expect(state.scannedTorrentIds.has('torrent-2')).toBe(true)
    })

    it('should accumulate scanned IDs across multiple calls', () => {
      const { setDiscographyScanResults } = useSmartSearchStore.getState()

      setDiscographyScanResults([{ searchResult: { id: 'torrent-1' } } as any])

      // Second call
      useSmartSearchStore.getState().setDiscographyScanResults([
        { searchResult: { id: 'torrent-2' } } as any,
      ])

      const state = useSmartSearchStore.getState()
      expect(state.scannedTorrentIds.has('torrent-1')).toBe(true)
      expect(state.scannedTorrentIds.has('torrent-2')).toBe(true)
    })

    it('should set isScannningDiscography to false', () => {
      useSmartSearchStore.setState({ isScannningDiscography: true })

      const { setDiscographyScanResults } = useSmartSearchStore.getState()
      setDiscographyScanResults([])

      expect(useSmartSearchStore.getState().isScannningDiscography).toBe(false)
    })
  })

  // =========================================
  // reset()
  // =========================================

  describe('reset', () => {
    it('should reset to initial state but preserve searchHistory and activityLog', () => {
      useSmartSearchStore.setState({
        step: 'error',
        originalQuery: 'test query',
        error: 'something failed',
        isLoading: true,
        searchHistory: [{ id: '1', query: 'saved', timestamp: new Date(), status: 'completed' }],
        activityLog: [{ id: '1', timestamp: new Date(), step: 'idle', message: 'log', type: 'info' }],
      })

      const { reset } = useSmartSearchStore.getState()
      reset()

      const state = useSmartSearchStore.getState()
      // Reset fields
      expect(state.step).toBe('idle')
      expect(state.originalQuery).toBe('')
      expect(state.error).toBeNull()
      expect(state.isLoading).toBe(false)
      // Preserved
      expect(state.searchHistory).toHaveLength(1)
      expect(state.activityLog).toHaveLength(1)
    })
  })

  // =========================================
  // setError()
  // =========================================

  describe('setError', () => {
    it('should set error and step to "error"', () => {
      const { setError } = useSmartSearchStore.getState()

      setError('Connection failed')

      const state = useSmartSearchStore.getState()
      expect(state.step).toBe('error')
      expect(state.error).toBe('Connection failed')
      expect(state.isLoading).toBe(false)
    })
  })
})
