import React, { useEffect } from 'react'
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
        setDownloadComplete(response.torrent.filePath)

        if (onComplete) {
          onComplete(response.torrent.filePath)
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
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-green-600 p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <div className="text-white">
              <p className="font-medium">Torrent Downloaded!</p>
              <p className="text-sm opacity-90">Ready to open in your torrent client</p>
            </div>
          </div>
        </div>
      )}

      {/* Error Notification */}
      {step === 'error' && error && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-red-600 p-4 shadow-lg max-w-md">
          <div className="flex items-start gap-3">
            <svg
              className="h-6 w-6 text-white flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <p className="font-medium text-white">Search Error</p>
              <p className="text-sm text-white opacity-90">{error}</p>
              <button
                onClick={handleCancel}
                className="mt-2 text-sm underline text-white opacity-90 hover:opacity-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
