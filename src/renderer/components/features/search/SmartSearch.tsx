import React, { useEffect, useCallback } from 'react'
import { Box, Flex, Text, Button, Icon, VStack } from '@chakra-ui/react'
import { FiAlertCircle, FiDownload, FiSearch } from 'react-icons/fi'
import { keyframes } from '@emotion/react'

// Animated line loader keyframes
const slideAnimation = keyframes`
  0% { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
`
import { useSmartSearchStore } from '@/store/smartSearchStore'
import { useTorrentCollectionStore } from '@/store/torrentCollectionStore'
import { toaster } from '@/components/ui/toaster'
import { InlineSearchResults } from './InlineSearchResults'
import type { SearchClassificationResult, MusicBrainzAlbum } from '@shared/types/musicbrainz.types'
import type { SearchResult, SearchProgressEvent } from '@shared/types/search.types'

interface SmartSearchProps {
  /** Optional callback when workflow completes */
  onComplete?: (filePath: string) => void
  /** Optional callback when workflow is cancelled */
  onCancel?: () => void
}

export const SmartSearch: React.FC<SmartSearchProps> = ({ onComplete, onCancel }) => {
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

  // Handle classification selection
  const handleSelectClassification = async (result: SearchClassificationResult) => {
    addActivityLog(`Selected: ${result.name} (${result.type})`, 'info')
    selectClassification(result)

    // If it's a song, find albums containing it
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
      // Get artist albums
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
      // For albums, go straight to RuTracker search
      try {
        addActivityLog(`Fetching album details...`, 'info')
        const albumResponse = await window.api.musicBrainz.getAlbumDetails(result.albumId)

        if (albumResponse.success && albumResponse.data) {
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

    // Search RuTracker for artist discography
    try {
      // First, try searching with "discography"
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

      // If we found results with "discography", use them
      if (discographyResponse.success && discographyResponse.results && discographyResponse.results.length > 0) {
        addActivityLog(`Found ${discographyResponse.results.length} discography torrents`, 'success')
        setRuTrackerResults(discographyQuery, discographyResponse.results)
        return
      }

      // If no results with "discography", fall back to just artist name
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

    // Filter to only discography/collection pages
    const discographyPages = ruTrackerResults.filter((t) => {
      const titleLower = t.title.toLowerCase()
      return (
        titleLower.includes('discography') ||
        titleLower.includes('дискография') ||
        titleLower.includes('complete') ||
        titleLower.includes('collection') ||
        titleLower.includes('anthology') ||
        titleLower.includes('box set') ||
        titleLower.includes('all albums')
      )
    })

    if (discographyPages.length === 0) {
      addActivityLog('No discography pages found to scan', 'warning')
      return
    }

    addActivityLog(`Scanning ${discographyPages.length} discography pages for "${selectedAlbum.title}"...`, 'info')
    startDiscographyScan()

    // Set up progress listener
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
      // Use just artist name for broader discography search (not "artist discography")
      const discographyQuery = album.artist

      console.log('[SmartSearch] RuTracker search queries:', { albumQuery, discographyQuery })
      console.log('[SmartSearch] Album details:', { title: album.title, artist: album.artist, id: album.id })
      addActivityLog(`Searching RuTracker: "${albumQuery}" + artist pages...`, 'info')

      // Track merged results for progressive updates
      let albumResults: SearchResult[] = []
      const seenIds = new Set<string>()

      // Helper to merge and update results
      const mergeAndUpdateResults = (newDiscographyResults: SearchResult[]) => {
        const mergedResults: SearchResult[] = []

        // Add album results first (higher priority)
        for (const result of albumResults) {
          if (!seenIds.has(result.id)) {
            seenIds.add(result.id)
            mergedResults.push(result)
          }
        }

        // Add discography results (only if not already present)
        for (const result of newDiscographyResults) {
          if (!seenIds.has(result.id)) {
            seenIds.add(result.id)
            mergedResults.push({ ...result, searchSource: 'discography' as const })
          }
        }

        return mergedResults
      }

      // Set up progress listener for discography search
      const cleanupProgress = window.api.search.onProgress((progress: SearchProgressEvent) => {
        console.log(`[SmartSearch] Discography progress: page ${progress.currentPage}/${progress.totalPages}, ${progress.results.length} results`)

        if (progress.results.length > 0) {
          const merged = mergeAndUpdateResults(progress.results)
          if (merged.length > 0) {
            addActivityLog(`Found ${merged.length} results (page ${progress.currentPage}/${progress.totalPages})...`, 'info')
            setRuTrackerResults(albumQuery, merged)
          }
        }
      })

      // Run album search and progressive discography search in parallel
      const [albumResponse, discographyResponse] = await Promise.allSettled([
        // Album search: single page, quick
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
        // Discography search: multi-page progressive (up to 10 pages)
        window.api.search.startProgressive({
          query: discographyQuery,
          filters: {
            minSeeders: 5,
          },
          maxPages: 10,
        }),
      ])

      // Cleanup progress listener
      cleanupProgress()

      // Process album search results
      albumResults = albumResponse.status === 'fulfilled' && albumResponse.value.success
        ? (albumResponse.value.results || []).map(r => ({ ...r, searchSource: 'album' as const }))
        : []

      // Process final discography search results
      const discographyResults = discographyResponse.status === 'fulfilled' && discographyResponse.value.success
        ? (discographyResponse.value.results || [])
        : []

      console.log('[SmartSearch] RuTracker search responses:', {
        albumResults: albumResults.length,
        discographyResults: discographyResults.length,
      })

      // Final merge
      const mergedResults = mergeAndUpdateResults(discographyResults)

      if (mergedResults.length > 0) {
        const albumCount = albumResults.length
        const discographyCount = mergedResults.filter(r => r.searchSource === 'discography').length
        const logMsg = discographyCount > 0
          ? `Found ${albumCount} direct + ${discographyCount} from artist search`
          : `Found ${albumCount} torrents on RuTracker`
        addActivityLog(logMsg, 'success')
        setRuTrackerResults(albumQuery, mergedResults)
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

  // Handle torrent selection - add to collection instead of downloading
  const handleSelectTorrent = async (torrent: SearchResult) => {
    selectTorrent(torrent)

    try {
      // Add to torrent collection
      const { addToCollection } = useTorrentCollectionStore.getState()
      addToCollection(torrent)

      addActivityLog(`Added to collection: ${torrent.title}`, 'success')

      // Show success toast
      toaster.create({
        title: 'Added to collection',
        description: torrent.title,
        type: 'success',
        duration: 5000,
      })

      // Add to search history
      addToHistory({
        query: originalQuery,
        status: 'completed',
        result: `Added to collection: ${torrent.title}`,
      })

      // Mark as completed
      setDownloadComplete('Added to collection')

      if (onComplete) {
        onComplete('Added to collection')
      }

      // Auto-close after 2 seconds
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

  // Auto-classify when step changes to classifying
  useEffect(() => {
    if (step === 'classifying' && originalQuery) {
      handleClassify(originalQuery)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, originalQuery])

  // Show error notification
  useEffect(() => {
    if (error) {
      console.error('SmartSearch error:', error)
      // Defer toast to avoid flushSync warning during React lifecycle
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

  // Determine which step to show in inline results
  const getInlineStep = (): 'classification' | 'albums' | 'torrents' | null => {
    if (step === 'user-choice') return 'classification'
    if (step === 'selecting-album') return 'albums'
    if (step === 'selecting-torrent' || step === 'collecting' || step === 'downloading') return 'torrents'
    return null
  }

  const inlineStep = getInlineStep()

  // Get loading message based on step
  const getLoadingMessage = (): string | null => {
    if (step === 'classifying') return 'Classifying search term...'
    if (step === 'searching-rutracker') return 'Searching RuTracker (up to 10 pages)...'
    return null
  }

  const loadingMessage = getLoadingMessage()

  return (
    <>
      {/* Loading Indicator */}
      {loadingMessage && (
        <Box
          p={4}
          borderRadius="md"
          bg="bg.surface"
          borderWidth="1px"
          borderColor="border.focus"
        >
          <VStack align="stretch" gap={3}>
            <Flex align="center" gap={3}>
              <Icon as={FiSearch} boxSize={5} color="interactive.base" />
              <Text fontSize="sm" fontWeight="medium" color="text.primary">
                {loadingMessage}
              </Text>
            </Flex>
            {/* Animated progress bar */}
            <Box
              position="relative"
              h="4px"
              bg="bg.elevated"
              borderRadius="full"
              overflow="hidden"
            >
              <Box
                position="absolute"
                top={0}
                left={0}
                h="full"
                w="50%"
                bg="interactive.base"
                borderRadius="full"
                css={{ animation: `${slideAnimation} 1.2s ease-in-out infinite` }}
              />
            </Box>
          </VStack>
        </Box>
      )}

      {/* Inline Search Results */}
      {inlineStep && (
        <InlineSearchResults
          step={inlineStep}
          classificationResults={classificationResults}
          onSelectClassification={handleSelectClassification}
          albums={albums}
          onSelectAlbum={handleSelectAlbum}
          onSelectDiscography={
            selectedClassification?.type === 'artist' ? handleSelectDiscography : undefined
          }
          selectedClassification={selectedClassification}
          torrents={ruTrackerResults}
          onSelectTorrent={handleSelectTorrent}
          isDownloading={step === 'downloading'}
          onCancel={handleCancel}
          // Discography scan props
          selectedAlbum={selectedAlbum}
          isScannningDiscography={isScannningDiscography}
          discographyScanProgress={discographyScanProgress}
          discographyScanResults={discographyScanResults}
          onStartDiscographyScan={selectedAlbum ? handleStartDiscographyScan : undefined}
          onStopDiscographyScan={handleStopDiscographyScan}
        />
      )}

      {/* Completion Notification */}
      {step === 'completed' && (
        <Box
          p={4}
          borderRadius="md"
          bg="green.500/10"
          borderWidth="1px"
          borderColor="green.500/30"
        >
          <Flex align="center" gap={3}>
            <Icon as={FiDownload} boxSize={5} color="green.500" />
            <Box>
              <Text fontWeight="medium" color="green.500">
                Added to Collection!
              </Text>
              <Text fontSize="sm" color="text.secondary">
                Go to Torrent tab to manage downloads
              </Text>
            </Box>
          </Flex>
        </Box>
      )}

      {/* Error Notification */}
      {step === 'error' && error && (
        <Box
          p={4}
          borderRadius="md"
          bg="red.500/10"
          borderWidth="1px"
          borderColor="red.500/30"
        >
          <Flex align="flex-start" gap={3}>
            <Icon as={FiAlertCircle} boxSize={5} color="red.500" flexShrink={0} />
            <Box flex="1">
              <Text fontWeight="medium" color="red.500">
                Search Error
              </Text>
              <Text fontSize="sm" color="text.secondary">
                {error}
              </Text>
              <Button
                onClick={handleCancel}
                mt={2}
                size="sm"
                variant="ghost"
                color="red.500"
                _hover={{ bg: 'red.500/10' }}
              >
                Close
              </Button>
            </Box>
          </Flex>
        </Box>
      )}
    </>
  )
}
