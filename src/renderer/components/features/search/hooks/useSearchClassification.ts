import type { SearchClassificationResult, MusicBrainzAlbum } from '@shared/types/musicbrainz.types'

export interface UseSearchClassificationDeps {
  addActivityLog: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void
  setClassificationResults: (results: SearchClassificationResult[]) => void
  selectClassification: (result: SearchClassificationResult) => void
  setAlbums: (albums: MusicBrainzAlbum[]) => void
  selectAlbum: (album: MusicBrainzAlbum) => void
  setError: (error: string) => void
  addToHistory: (entry: { query: string; status: string }) => void
  searchRuTracker: (album: MusicBrainzAlbum) => Promise<void>
}

/**
 * useSearchClassification
 *
 * Handles classifying a search query and responding to the user's classification selection.
 */
export function useSearchClassification(deps: UseSearchClassificationDeps) {
  const {
    addActivityLog,
    setClassificationResults,
    selectClassification,
    setAlbums,
    selectAlbum,
    setError,
    addToHistory,
    searchRuTracker,
  } = deps

  /** Classify a raw search query via MusicBrainz API */
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

  /** Respond to the user choosing a classification result */
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

  return { handleClassify, handleSelectClassification }
}
