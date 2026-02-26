import { useSmartSearchStore } from './smartSearchStore'

// Selector hooks for better performance
export const useSearchStep = () => useSmartSearchStore((state) => state.step)
export const useIsSearching = () =>
  useSmartSearchStore((state) => state.isLoading)
export const useSearchError = () => useSmartSearchStore((state) => state.error)
export const useClassificationResults = () =>
  useSmartSearchStore((state) => state.classificationResults)
export const useSelectedClassification = () =>
  useSmartSearchStore((state) => state.selectedClassification)
export const useAlbums = () => useSmartSearchStore((state) => state.albums)
export const useSelectedAlbum = () =>
  useSmartSearchStore((state) => state.selectedAlbum)
export const useRuTrackerResults = () =>
  useSmartSearchStore((state) => state.ruTrackerResults)
export const useSelectedTorrent = () =>
  useSmartSearchStore((state) => state.selectedTorrent)
export const useSearchHistory = () =>
  useSmartSearchStore((state) => state.searchHistory)
export const useActivityLog = () =>
  useSmartSearchStore((state) => state.activityLog)

// Load-more selectors
export const useDiscoSearchMeta = () =>
  useSmartSearchStore((state) => ({
    discoQuery: state.discoQuery,
    discoLoadedPages: state.discoLoadedPages,
    discoTotalPages: state.discoTotalPages,
  }))
export const useIsLoadingMore = () =>
  useSmartSearchStore((state) => state.isLoadingMore)
export const useLoadMoreError = () =>
  useSmartSearchStore((state) => state.loadMoreError)

// Discography scan selectors
export const useIsScannningDiscography = () =>
  useSmartSearchStore((state) => state.isScannningDiscography)
export const useDiscographyScanProgress = () =>
  useSmartSearchStore((state) => state.discographyScanProgress)
export const useDiscographyScanResults = () =>
  useSmartSearchStore((state) => state.discographyScanResults)
export const useScannedTorrentIds = () =>
  useSmartSearchStore((state) => state.scannedTorrentIds)
