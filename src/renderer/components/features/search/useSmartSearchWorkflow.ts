import { useEffect, useRef } from 'react'
import { useSmartSearchStore } from '@/store/smartSearchStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useTorrentCollectionStore } from '@/store/torrentCollectionStore'
import { toaster } from '@/components/ui/toaster'
import type { MusicBrainzAlbum } from '@shared/types/musicbrainz.types'
import type { SearchResult } from '@shared/types/search.types'

import { useRuTrackerSearch } from './hooks/useRuTrackerSearch'
import { useSearchClassification } from './hooks/useSearchClassification'
import { useDiscographyScan } from './hooks/useDiscographyScan'

interface UseSmartSearchWorkflowOptions {
  onComplete?: (filePath: string) => void
  onCancel?: () => void
}

export function useSmartSearchWorkflow({
  onComplete,
  onCancel,
}: UseSmartSearchWorkflowOptions) {
  const autoScanDiscography = useSettingsStore((s) => s.autoScanDiscography)
  const autoScanFiredRef = useRef(false)

  const {
    step,
    originalQuery,
    classificationResults,
    selectedClassification,
    albums,
    selectedAlbum,
    ruTrackerResults,
    error,
    isScannningDiscography,
    discographyScanProgress,
    discographyScanResults,
    setClassificationResults,
    selectClassification,
    setAlbums,
    selectAlbum,
    selectAction,
    setRuTrackerResults,
    setDiscoSearchMeta,
    selectTorrent,
    setDownloadComplete,
    setError,
    addActivityLog,
    addToHistory,
    reset,
    startDiscographyScan,
    setDiscographyScanProgress,
    setDiscographyScanResults,
    stopDiscographyScan,
    startSearch,
  } = useSmartSearchStore()

  // ====================================
  // SUB-HOOKS
  // ====================================

  const { searchRuTracker, searchProgress } = useRuTrackerSearch({
    addActivityLog,
    setRuTrackerResults,
    setDiscoSearchMeta,
    setError,
  })

  const { handleClassify, handleSelectClassification } =
    useSearchClassification({
      addActivityLog,
      setClassificationResults,
      selectClassification,
      setAlbums,
      selectAlbum,
      setError,
      addToHistory,
      searchRuTracker,
    })

  const { handleStartDiscographyScan, handleStopDiscographyScan } =
    useDiscographyScan({
      selectedAlbum,
      ruTrackerResults,
      isScannningDiscography,
      addActivityLog,
      startDiscographyScan,
      stopDiscographyScan,
      setDiscographyScanProgress,
      setDiscographyScanResults,
    })

  // ====================================
  // ALBUM HANDLERS
  // ====================================

  const handleSelectAlbum = async (album: MusicBrainzAlbum) => {
    addActivityLog(`Selected album: ${album.title} by ${album.artist}`, 'info')
    selectAlbum(album)
    await searchRuTracker(album)
  }

  const handleSelectDiscography = async () => {
    if (!selectedClassification) return

    selectAction('discography')
    const artistName =
      selectedClassification.artist || selectedClassification.name

    try {
      const discographyQuery = `${artistName} discography`
      console.log('[SmartSearch] Discography search query:', discographyQuery)
      console.log('[SmartSearch] Classification:', selectedClassification)
      addActivityLog(`Searching for discography: ${discographyQuery}`, 'info')

      const discographyResponse = await window.api.search.start({
        query: discographyQuery,
        filters: { minSeeders: 5 },
        sort: { by: 'seeders', order: 'desc' },
        maxResults: 20,
      })

      console.log('[SmartSearch] Discography search response:', {
        success: discographyResponse.success,
        resultCount: discographyResponse.results?.length || 0,
        error: discographyResponse.error,
      })

      if (
        discographyResponse.success &&
        discographyResponse.results &&
        discographyResponse.results.length > 0
      ) {
        addActivityLog(
          `Found ${discographyResponse.results.length} discography torrents`,
          'success'
        )
        setRuTrackerResults(discographyQuery, discographyResponse.results)
        return
      }

      addActivityLog(
        'No discography torrents found, searching by artist name...',
        'warning'
      )
      console.log(
        '[SmartSearch] Falling back to artist name search:',
        artistName
      )

      const artistResponse = await window.api.search.start({
        query: artistName,
        filters: { minSeeders: 5 },
        sort: { by: 'seeders', order: 'desc' },
        maxResults: 20,
      })

      console.log('[SmartSearch] Artist name search response:', {
        success: artistResponse.success,
        resultCount: artistResponse.results?.length || 0,
        error: artistResponse.error,
      })

      if (
        artistResponse.success &&
        artistResponse.results &&
        artistResponse.results.length > 0
      ) {
        addActivityLog(
          `Found ${artistResponse.results.length} torrents for ${artistName}`,
          'success'
        )
        setRuTrackerResults(artistName, artistResponse.results)
      } else {
        const errorMsg = `No torrents found for ${artistName}`
        addActivityLog(errorMsg, 'error')
        setError(errorMsg)
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'Failed to search RuTracker'
      addActivityLog(errorMsg, 'error')
      setError(errorMsg)
    }
  }

  // ====================================
  // TORRENT / FLOW HANDLERS
  // ====================================

  const handleSelectTorrent = async (torrent: SearchResult) => {
    selectTorrent(torrent)

    try {
      const { addToCollection } = useTorrentCollectionStore.getState()
      addToCollection(torrent)

      addActivityLog(`Added to collection: ${torrent.title}`, 'success')

      toaster.create({
        title: 'Added to collection',
        description: torrent.title,
        type: 'success',
        duration: 5000,
      })

      addToHistory({
        query: originalQuery,
        status: 'completed',
        result: `Added to collection: ${torrent.title}`,
      })

      setDownloadComplete('Added to collection')

      if (onComplete) {
        onComplete('Added to collection')
      }

      setTimeout(() => {
        reset()
      }, 2000)
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'Failed to add to collection'
      addActivityLog(errorMsg, 'error')
      setError(errorMsg)
      addToHistory({ query: originalQuery, status: 'error' })

      toaster.create({
        title: 'Failed to add to collection',
        description: errorMsg,
        type: 'error',
        duration: 5000,
      })
    }
  }

  const handleCancel = () => {
    addActivityLog('Search cancelled by user', 'warning')
    if (originalQuery) {
      addToHistory({ query: originalQuery, status: 'cancelled' })
    }
    reset()
    if (onCancel) {
      onCancel()
    }
  }

  const handleRetry = () => {
    if (!originalQuery) return
    addActivityLog(`Retrying search: "${originalQuery}"`, 'info')
    reset()
    startSearch(originalQuery)
  }

  // ====================================
  // EFFECTS
  // ====================================

  useEffect(() => {
    if (step === 'classifying' && originalQuery) {
      autoScanFiredRef.current = false
      handleClassify(originalQuery)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, originalQuery])

  useEffect(() => {
    if (
      autoScanDiscography &&
      step === 'selecting-torrent' &&
      selectedAlbum &&
      ruTrackerResults.length > 0 &&
      !isScannningDiscography &&
      !autoScanFiredRef.current
    ) {
      autoScanFiredRef.current = true
      handleStartDiscographyScan()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    step,
    selectedAlbum,
    ruTrackerResults,
    autoScanDiscography,
    isScannningDiscography,
  ])

  useEffect(() => {
    if (error) {
      console.error('SmartSearch error:', error)
      setTimeout(() => {
        toaster.create({
          title: 'Search error',
          description: error,
          type: 'error',
          duration: 5000,
        })
      }, 0)
    }
  }, [error])

  // ====================================
  // DERIVED STATE
  // ====================================

  const getInlineStep = (): 'classification' | 'albums' | 'torrents' | null => {
    if (step === 'user-choice') return 'classification'
    if (step === 'selecting-album') return 'albums'
    if (
      step === 'selecting-torrent' ||
      step === 'collecting' ||
      step === 'downloading'
    )
      return 'torrents'
    return null
  }

  const getLoadingMessage = (): string | null => {
    if (step === 'classifying') return 'Classifying search term...'
    if (step === 'selecting-action') return 'Fetching album details...'
    if (step === 'searching-rutracker') return 'Searching RuTracker...'
    return null
  }

  return {
    // State
    step,
    error,
    classificationResults,
    selectedClassification,
    albums,
    selectedAlbum,
    ruTrackerResults,
    isScannningDiscography,
    discographyScanProgress,
    discographyScanResults,

    // Derived
    inlineStep: getInlineStep(),
    loadingMessage: getLoadingMessage(),
    searchProgress,

    // Handlers
    handleSelectClassification,
    handleSelectAlbum,
    handleSelectDiscography,
    handleStartDiscographyScan,
    handleStopDiscographyScan,
    handleSelectTorrent,
    handleCancel,
    handleRetry,
  }
}
