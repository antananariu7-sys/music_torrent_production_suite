import React, { useEffect } from 'react'
import { Box, Flex, Text, Button, Icon } from '@chakra-ui/react'
import { FiCheckCircle, FiAlertCircle } from 'react-icons/fi'
import { useSmartSearchStore } from '@/store/smartSearchStore'
import { SearchClassificationDialog } from './SearchClassificationDialog'
import { AlbumSelectionDialog } from './AlbumSelectionDialog'
import { TorrentResultsDialog } from './TorrentResultsDialog'
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
    reset,
  } = useSmartSearchStore()

  // Handle classification
  const handleClassify = async (query: string) => {
    try {
      const response = await window.api.musicBrainz.classifySearch({ query })

      if (response.success && response.results) {
        setClassificationResults(response.results)
      } else {
        setError(response.error || 'Failed to classify search term')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to classify search')
    }
  }

  // Handle classification selection
  const handleSelectClassification = async (result: SearchClassificationResult) => {
    selectClassification(result)

    // If it's a song, find albums containing it
    if (result.type === 'song') {
      try {
        const response = await window.api.musicBrainz.findAlbumsBySong({
          songTitle: result.name,
          artist: result.artist,
        })

        if (response.success && response.albums) {
          setAlbums(response.albums)
        } else {
          setError(response.error || 'No albums found for this song')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to find albums')
      }
    } else if (result.type === 'artist') {
      // Get artist albums
      try {
        if (!result.albumId) {
          setError('Artist ID not found')
          return
        }

        const response = await window.api.musicBrainz.getArtistAlbums({
          artistId: result.albumId,
          limit: 50,
        })

        if (response.success && response.albums) {
          setAlbums(response.albums)
        } else {
          setError(response.error || 'No albums found for this artist')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to get artist albums')
      }
    } else if (result.type === 'album' && result.albumId) {
      // For albums, go straight to RuTracker search
      try {
        const albumResponse = await window.api.musicBrainz.getAlbumDetails(result.albumId)

        if (albumResponse.success && albumResponse.data) {
          await searchRuTracker(albumResponse.data)
        } else {
          setError('Failed to get album details')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to search RuTracker')
      }
    }
  }

  // Handle album selection
  const handleSelectAlbum = async (album: MusicBrainzAlbum) => {
    selectAlbum(album)
    await searchRuTracker(album)
  }

  // Handle discography selection
  const handleSelectDiscography = async () => {
    if (!selectedClassification) return

    selectAction('discography')

    // Search RuTracker for artist discography
    try {
      const query = `${selectedClassification.artist || selectedClassification.name} discography`
      const response = await window.api.search.start({
        query,
        filters: {
          minSeeders: 5,
        },
        sort: {
          by: 'seeders',
          order: 'desc',
        },
        maxResults: 20,
      })

      if (response.success && response.results) {
        setRuTrackerResults(query, response.results)
      } else {
        setError(response.error || 'No torrents found')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search RuTracker')
    }
  }

  // Search RuTracker for album
  const searchRuTracker = async (album: MusicBrainzAlbum) => {
    try {
      const queryResponse = await window.api.musicBrainz.createRuTrackerQuery(album.id)

      if (!queryResponse.success || !queryResponse.data) {
        setError('Failed to create RuTracker query')
        return
      }

      const query = queryResponse.data
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

      if (response.success && response.results) {
        setRuTrackerResults(query, response.results)
      } else {
        setError(response.error || 'No torrents found on RuTracker')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search RuTracker')
    }
  }

  // Handle torrent selection and download
  const handleSelectTorrent = async (torrent: SearchResult) => {
    selectTorrent(torrent)

    try {
      const response = await window.api.torrent.download({
        torrentId: torrent.id,
        pageUrl: torrent.url,
        title: torrent.title,
      })

      if (response.success && response.torrent) {
        // Use magnet link or file path
        const result = response.torrent.magnetLink || response.torrent.filePath || 'Torrent ready'
        setDownloadComplete(result)

        if (onComplete) {
          onComplete(result)
        }

        // Auto-close after 2 seconds
        setTimeout(() => {
          reset()
        }, 2000)
      } else {
        setError(response.error || 'Failed to download torrent')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download torrent')
    }
  }

  // Handle cancel
  const handleCancel = () => {
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

  return (
    <>
      {/* Step 1: Classification Dialog */}
      <SearchClassificationDialog
        isOpen={step === 'user-choice'}
        query={originalQuery}
        results={classificationResults}
        onSelect={handleSelectClassification}
        onCancel={handleCancel}
      />

      {/* Step 2: Album Selection Dialog */}
      <AlbumSelectionDialog
        isOpen={step === 'selecting-album'}
        albums={albums}
        selectedClassification={selectedClassification}
        onSelectAlbum={handleSelectAlbum}
        onSelectDiscography={
          selectedClassification?.type === 'artist' ? handleSelectDiscography : undefined
        }
        onCancel={handleCancel}
      />

      {/* Step 3: Torrent Results Dialog */}
      <TorrentResultsDialog
        isOpen={step === 'selecting-torrent' || step === 'downloading'}
        query={originalQuery}
        results={ruTrackerResults}
        onSelectTorrent={handleSelectTorrent}
        onCancel={handleCancel}
        isDownloading={step === 'downloading'}
      />

      {/* Completion Notification */}
      {step === 'completed' && (
        <Box position="fixed" bottom={4} right={4} zIndex="toast" borderRadius="lg" bg="green.600" p={4} shadow="lg">
          <Flex align="center" gap={3}>
            <Icon as={FiCheckCircle} boxSize={6} color="white" />
            <Box color="white">
              <Text fontWeight="medium">Torrent Downloaded!</Text>
              <Text fontSize="sm" opacity={0.9}>
                Ready to open in your torrent client
              </Text>
            </Box>
          </Flex>
        </Box>
      )}

      {/* Error Notification */}
      {step === 'error' && error && (
        <Box
          position="fixed"
          bottom={4}
          right={4}
          zIndex="toast"
          borderRadius="lg"
          bg="red.600"
          p={4}
          shadow="lg"
          maxW="md"
        >
          <Flex align="flex-start" gap={3}>
            <Icon as={FiAlertCircle} boxSize={6} color="white" flexShrink={0} />
            <Box flex="1">
              <Text fontWeight="medium" color="white">
                Search Error
              </Text>
              <Text fontSize="sm" color="white" opacity={0.9}>
                {error}
              </Text>
              <Button
                onClick={handleCancel}
                mt={2}
                size="sm"
                variant="ghost"
                color="white"
                opacity={0.9}
                textDecoration="underline"
                _hover={{ opacity: 1, bg: 'whiteAlpha.200' }}
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
