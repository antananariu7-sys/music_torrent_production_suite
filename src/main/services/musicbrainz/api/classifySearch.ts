import type { SearchClassificationRequest, SearchClassificationResponse, SearchClassificationResult } from '@shared/types/musicbrainz.types'
import type { MusicBrainzApiClient } from '../MusicBrainzApiClient'
import type { MBArtistResponse, MBReleaseResponse, MBRecordingResponse } from '../types'

/**
 * Classify a search term as artist, album, or song using parallel MusicBrainz API calls
 */
export async function classifySearch(
  client: MusicBrainzApiClient,
  request: SearchClassificationRequest
): Promise<SearchClassificationResponse> {
  try {
    console.log(`[MusicBrainzService] Classifying search term: "${request.query}"`)

    const results: SearchClassificationResult[] = []

    // Search for artists
    try {
      const artistResponse = await client.request<MBArtistResponse>('artist', {
        query: `artist:"${request.query}"`,
        limit: '3',
        fmt: 'json',
      })

      if (artistResponse.artists && artistResponse.artists.length > 0) {
        for (const artist of artistResponse.artists) {
          results.push({
            type: 'artist',
            name: artist.name,
            artist: artist.name,
            albumId: artist.id,
            score: artist.score || 0,
          })
        }
      }
    } catch (error) {
      console.warn('[MusicBrainzService] Artist search failed:', error)
    }

    // Search for albums
    try {
      const albumResponse = await client.request<MBReleaseResponse>('release', {
        query: `release:"${request.query}"`,
        limit: '3',
        fmt: 'json',
      })

      if (albumResponse.releases && albumResponse.releases.length > 0) {
        for (const release of albumResponse.releases) {
          const artist = release['artist-credit']?.[0]?.artist?.name || 'Unknown Artist'
          results.push({
            type: 'album',
            name: release.title,
            artist,
            albumId: release.id,
            score: release.score || 0,
          })
        }
      }
    } catch (error) {
      console.warn('[MusicBrainzService] Album search failed:', error)
    }

    // Search for songs (recordings)
    try {
      const songResponse = await client.request<MBRecordingResponse>('recording', {
        query: `recording:"${request.query}"`,
        limit: '3',
        fmt: 'json',
      })

      if (songResponse.recordings && songResponse.recordings.length > 0) {
        for (const recording of songResponse.recordings) {
          const artist = recording['artist-credit']?.[0]?.artist?.name || 'Unknown Artist'
          results.push({
            type: 'song',
            name: recording.title,
            artist,
            score: recording.score || 0,
          })
        }
      }
    } catch (error) {
      console.warn('[MusicBrainzService] Song search failed:', error)
    }

    results.sort((a, b) => b.score - a.score)

    const bestMatch = results.length > 0 ? results[0] : undefined

    console.log(
      `[MusicBrainzService] Found ${results.length} results, best match: ${bestMatch?.type} - ${bestMatch?.name}`
    )

    return { success: true, results, bestMatch, query: request.query }
  } catch (error) {
    console.error('[MusicBrainzService] Classification failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Classification failed',
      query: request.query,
    }
  }
}
