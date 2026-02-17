import { useEffect, useCallback, useRef, useState } from 'react'
import { useSmartSearchStore } from '@/store/smartSearchStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useTorrentCollectionStore } from '@/store/torrentCollectionStore'
import { toaster } from '@/components/ui/toaster'
import type { SearchClassificationResult, MusicBrainzAlbum } from '@shared/types/musicbrainz.types'
import type { SearchResult, SearchProgressEvent } from '@shared/types/search.types'
import { isLikelyDiscography } from '@shared/utils/resultClassifier'

interface UseSmartSearchWorkflowOptions {
  onComplete?: (filePath: string) => void
  onCancel?: () => void
}

export function useSmartSearchWorkflow({ onComplete, onCancel }: UseSmartSearchWorkflowOptions) {
  const autoScanDiscography = useSettingsStore((s) => s.autoScanDiscography)
  const autoScanFiredRef = useRef(false)
  const [searchProgress, setSearchProgress] = useState<{ currentPage: number; totalPages: number } | null>(null)

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

  // Handle classification
  const handleClassify = async (query: string) => {
    try {
      addActivityLog(`Starting search for: "${query}"`, 'info')
      addActivityLog('Classifying search term with MusicBrainz...', 'info')

      const response = await window.api.musicBrainz.classifySearch({ query })

      if (response.success && response.results) {
        addActivityLog(`Found ${response.results.length} classification matches`, 'success')
        setClassificationResults(response.results)
      } else {
        const errorMsg = response.error || 'Failed to classify search term'
        addActivityLog(errorMsg, 'error')
        setError(errorMsg)
        addToHistory({ query, status: 'error' })
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to classify search'
      addActivityLog(errorMsg, 'error')
      setError(errorMsg)
      addToHistory({ query, status: 'error' })
    }
  }

  // Search RuTracker for album (parallel: direct album search + progressive discography search)
  const searchRuTracker = async (album: MusicBrainzAlbum) => {
    try {
      addActivityLog('Creating optimized RuTracker search query...', 'info')
      const queryResponse = await window.api.musicBrainz.createRuTrackerQuery(album.id)

      if (!queryResponse.success || !queryResponse.data) {
        addActivityLog('Failed to create RuTracker query', 'error')
        setError('Failed to create RuTracker query')
        return
      }

      const albumQuery = queryResponse.data
      const discographyQuery = album.artist

      console.log('[SmartSearch] RuTracker search queries:', { albumQuery, discographyQuery })
      console.log('[SmartSearch] Album details:', { title: album.title, artist: album.artist, id: album.id })
      addActivityLog(`Searching RuTracker: "${albumQuery}" + artist pages...`, 'info')

      let albumResults: SearchResult[] = []

      const cleanupProgress = window.api.search.onProgress((progress: SearchProgressEvent) => {
        console.log(`[SmartSearch] Discography progress: page ${progress.currentPage}/${progress.totalPages}, ${progress.results.length} results`)
        // Only update loading progress indicator, don't show partial results
        setSearchProgress({ currentPage: progress.currentPage, totalPages: progress.totalPages })
      })

      const [albumResponse, discographyResponse] = await Promise.allSettled([
        window.api.search.start({
          query: albumQuery,
          filters: {
            format: 'any',
            minSeeders: 5,
          },
          sort: {
            by: 'relevance',
            order: 'desc',
          },
          maxResults: 50,
        }),
        window.api.search.startProgressive({
          query: discographyQuery,
          filters: {
            minSeeders: 5,
          },
          maxPages: 50, // Search all available pages (up to 50)
        }),
      ])

      cleanupProgress()
      setSearchProgress(null)

      albumResults = albumResponse.status === 'fulfilled' && albumResponse.value.success
        ? (albumResponse.value.results || []).map(r => ({ ...r, searchSource: 'album' as const }))
        : []

      const discographyResults = discographyResponse.status === 'fulfilled' && discographyResponse.value.success
        ? (discographyResponse.value.results || [])
        : []

      console.log('[SmartSearch] RuTracker search responses:', {
        albumResults: albumResults.length,
        discographyResults: discographyResults.length,
      })

      const finalSeenIds = new Set<string>()
      const finalResults: SearchResult[] = []

      for (const r of albumResults) {
        if (!finalSeenIds.has(r.id)) {
          finalSeenIds.add(r.id)
          finalResults.push(r)
        }
      }

      for (const r of discographyResults) {
        if (!finalSeenIds.has(r.id)) {
          finalSeenIds.add(r.id)
          finalResults.push({ ...r, searchSource: 'discography' as const })
        }
      }

      if (finalResults.length > 0) {
        const albumCount = albumResults.length
        const discographyCount = finalResults.filter(r => r.searchSource === 'discography').length

        if (albumCount === 0 && discographyCount > 0) {
          addActivityLog(`No direct results for "${album.title}", showing ${discographyCount} results from artist discography`, 'warning')
        } else {
          const logMsg = discographyCount > 0
            ? `Found ${albumCount} direct + ${discographyCount} from artist search`
            : `Found ${albumCount} torrents on RuTracker`
          addActivityLog(logMsg, 'success')
        }
        setRuTrackerResults(albumQuery, finalResults)
      } else {
        const errorMsg = 'No torrents found on RuTracker'
        addActivityLog(errorMsg, 'warning')
        setError(errorMsg)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to search RuTracker'
      addActivityLog(errorMsg, 'error')
      setError(errorMsg)
    }
  }

  // Handle classification selection
  const handleSelectClassification = async (result: SearchClassificationResult) => {
    addActivityLog(`Selected: ${result.name} (${result.type})`, 'info')
    selectClassification(result)

    if (result.type === 'song') {
      try {
        addActivityLog(`Finding albums containing "${result.name}"...`, 'info')
        const response = await window.api.musicBrainz.findAlbumsBySong({
          songTitle: result.name,
          artist: result.artist,
        })

        if (response.success && response.albums) {
          addActivityLog(`Found ${response.albums.length} albums`, 'success')
          setAlbums(response.albums)
        } else {
          const errorMsg = response.error || 'No albums found for this song'
          addActivityLog(errorMsg, 'error')
          setError(errorMsg)
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to find albums'
        addActivityLog(errorMsg, 'error')
        setError(errorMsg)
      }
    } else if (result.type === 'artist') {
      try {
        if (!result.albumId) {
          addActivityLog('Artist ID not found', 'error')
          setError('Artist ID not found')
          return
        }

        addActivityLog(`Fetching albums by ${result.artist || result.name}...`, 'info')
        const response = await window.api.musicBrainz.getArtistAlbums({
          artistId: result.albumId,
          limit: 50,
        })

        if (response.success && response.albums) {
          addActivityLog(`Found ${response.albums.length} albums`, 'success')
          setAlbums(response.albums)
        } else {
          const errorMsg = response.error || 'No albums found for this artist'
          addActivityLog(errorMsg, 'error')
          setError(errorMsg)
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to get artist albums'
        addActivityLog(errorMsg, 'error')
        setError(errorMsg)
      }
    } else if (result.type === 'album' && result.albumId) {
      try {
        addActivityLog(`Fetching album details...`, 'info')
        const albumResponse = await window.api.musicBrainz.getAlbumDetails(result.albumId)

        if (albumResponse.success && albumResponse.data) {
          selectAlbum(albumResponse.data)
          await searchRuTracker(albumResponse.data)
        } else {
          addActivityLog('Failed to get album details', 'error')
          setError('Failed to get album details')
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to search RuTracker'
        addActivityLog(errorMsg, 'error')
        setError(errorMsg)
      }
    }
  }

  // Handle album selection
  const handleSelectAlbum = async (album: MusicBrainzAlbum) => {
    addActivityLog(`Selected album: ${album.title} by ${album.artist}`, 'info')
    selectAlbum(album)
    await searchRuTracker(album)
  }

  // Handle discography selection
  const handleSelectDiscography = async () => {
    if (!selectedClassification) return

    selectAction('discography')

    const artistName = selectedClassification.artist || selectedClassification.name

    try {
      const discographyQuery = `${artistName} discography`
      console.log('[SmartSearch] Discography search query:', discographyQuery)
      console.log('[SmartSearch] Classification:', selectedClassification)
      addActivityLog(`Searching for discography: ${discographyQuery}`, 'info')

      const discographyResponse = await window.api.search.start({
        query: discographyQuery,
        filters: {
          minSeeders: 5,
        },
        sort: {
          by: 'seeders',
          order: 'desc',
        },
        maxResults: 20,
      })

      console.log('[SmartSearch] Discography search response:', {
        success: discographyResponse.success,
        resultCount: discographyResponse.results?.length || 0,
        error: discographyResponse.error
      })

      if (discographyResponse.success && discographyResponse.results && discographyResponse.results.length > 0) {
        addActivityLog(`Found ${discographyResponse.results.length} discography torrents`, 'success')
        setRuTrackerResults(discographyQuery, discographyResponse.results)
        return
      }

      addActivityLog('No discography torrents found, searching by artist name...', 'warning')
      console.log('[SmartSearch] Falling back to artist name search:', artistName)

      const artistResponse = await window.api.search.start({
        query: artistName,
        filters: {
          minSeeders: 5,
        },
        sort: {
          by: 'seeders',
          order: 'desc',
        },
        maxResults: 20,
      })

      console.log('[SmartSearch] Artist name search response:', {
        success: artistResponse.success,
        resultCount: artistResponse.results?.length || 0,
        error: artistResponse.error
      })

      if (artistResponse.success && artistResponse.results && artistResponse.results.length > 0) {
        addActivityLog(`Found ${artistResponse.results.length} torrents for ${artistName}`, 'success')
        setRuTrackerResults(artistName, artistResponse.results)
      } else {
        const errorMsg = `No torrents found for ${artistName}`
        addActivityLog(errorMsg, 'error')
        setError(errorMsg)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to search RuTracker'
      addActivityLog(errorMsg, 'error')
      setError(errorMsg)
    }
  }

  // Handle discography content scan (scan pages for album)
  const handleStartDiscographyScan = useCallback(async () => {
    if (!selectedAlbum || ruTrackerResults.length === 0) return

    const discographyPages = ruTrackerResults.filter((t) => isLikelyDiscography(t.title))

    if (discographyPages.length === 0) {
      addActivityLog('No discography pages found to scan', 'warning')
      return
    }

    addActivityLog(`Scanning ${discographyPages.length} discography pages for "${selectedAlbum.title}"...`, 'info')
    startDiscographyScan()

    const cleanupProgress = window.api.discography.onProgress((progress) => {
      setDiscographyScanProgress(progress)
    })

    try {
      const response = await window.api.discography.search({
        searchResults: discographyPages,
        albumName: selectedAlbum.title,
        artistName: selectedAlbum.artist,
        maxConcurrent: 3,
        pageTimeout: 30000,
      })

      cleanupProgress()

      if (response.success) {
        setDiscographyScanResults(response.scanResults)
        if (response.matchCount > 0) {
          addActivityLog(
            `Found "${selectedAlbum.title}" in ${response.matchCount} of ${response.totalScanned} pages`,
            'success'
          )
          toaster.create({
            title: 'Album found!',
            description: `"${selectedAlbum.title}" found in ${response.matchCount} discography pages`,
            type: 'success',
            duration: 5000,
          })
        } else {
          addActivityLog(
            `Album not found in ${response.totalScanned} scanned pages`,
            'warning'
          )
        }
      } else {
        addActivityLog(response.error || 'Scan failed', 'error')
        stopDiscographyScan()
      }
    } catch (err) {
      cleanupProgress()
      const errorMsg = err instanceof Error ? err.message : 'Scan failed'
      addActivityLog(errorMsg, 'error')
      stopDiscographyScan()
    }
  }, [
    selectedAlbum,
    ruTrackerResults,
    addActivityLog,
    startDiscographyScan,
    setDiscographyScanProgress,
    setDiscographyScanResults,
    stopDiscographyScan,
  ])

  const handleStopDiscographyScan = useCallback(() => {
    addActivityLog('Discography scan stopped by user', 'warning')
    stopDiscographyScan()
  }, [addActivityLog, stopDiscographyScan])

  // Handle torrent selection - add to collection
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
      const errorMsg = err instanceof Error ? err.message : 'Failed to add to collection'
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

  // Handle cancel
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

  // Handle retry
  const handleRetry = () => {
    if (!originalQuery) return

    addActivityLog(`Retrying search: "${originalQuery}"`, 'info')
    reset()
    startSearch(originalQuery)
  }

  // Auto-classify when step changes to classifying
  useEffect(() => {
    if (step === 'classifying' && originalQuery) {
      autoScanFiredRef.current = false
      handleClassify(originalQuery)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, originalQuery])

  // Auto-scan discography pages when results arrive (if setting enabled)
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
  }, [step, selectedAlbum, ruTrackerResults, autoScanDiscography, isScannningDiscography])

  // Show error notification
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

  // Derived state
  const getInlineStep = (): 'classification' | 'albums' | 'torrents' | null => {
    if (step === 'user-choice') return 'classification'
    if (step === 'selecting-album') return 'albums'
    if (step === 'selecting-torrent' || step === 'collecting' || step === 'downloading') return 'torrents'
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
