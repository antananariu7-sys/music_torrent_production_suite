import React, { useEffect } from 'react'
import { Box, Flex, Text, Button, Icon } from '@chakra-ui/react'
import { FiAlertCircle, FiDownload } from 'react-icons/fi'
import { useSmartSearchStore } from '@/store/smartSearchStore'
import { useTorrentCollectionStore } from '@/store/torrentCollectionStore'
import { InlineSearchResults } from './InlineSearchResults'
import type { SearchClassificationResult, MusicBrainzAlbum } from '@shared/types/musicbrainz.types'
import type { SearchResult } from '@shared/types/search.types'

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
    ruTrackerResults,
    error,
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

  // Search RuTracker for album
  const searchRuTracker = async (album: MusicBrainzAlbum) => {
    try {
      addActivityLog('Creating optimized RuTracker search query...', 'info')
      const queryResponse = await window.api.musicBrainz.createRuTrackerQuery(album.id)

      if (!queryResponse.success || !queryResponse.data) {
        addActivityLog('Failed to create RuTracker query', 'error')
        setError('Failed to create RuTracker query')
        return
      }

      const query = queryResponse.data
      console.log('[SmartSearch] RuTracker search query:', query)
      console.log('[SmartSearch] Album details:', { title: album.title, artist: album.artist, id: album.id })
      addActivityLog(`Searching RuTracker: "${query}"`, 'info')

      const response = await window.api.search.start({
        query,
        filters: {
          format: 'any',
          minSeeders: 5,
        },
        sort: {
          by: 'relevance',
          order: 'desc',
        },
        maxResults: 20,
      })

      console.log('[SmartSearch] RuTracker search response:', {
        success: response.success,
        resultCount: response.results?.length || 0,
        error: response.error
      })

      if (response.success && response.results) {
        addActivityLog(`Found ${response.results.length} torrents on RuTracker`, 'success')
        setRuTrackerResults(query, response.results)
      } else {
        const errorMsg = response.error || 'No torrents found on RuTracker'
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
      // TODO: Show error toast notification
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

  return (
    <>
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
