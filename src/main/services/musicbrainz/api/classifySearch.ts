import type {
  SearchClassificationRequest,
  SearchClassificationResponse,
  SearchClassificationResult,
} from '@shared/types/musicbrainz.types'
import type { MusicBrainzApiClient } from '../MusicBrainzApiClient'
import type {
  MBArtistResponse,
  MBReleaseResponse,
  MBRecordingResponse,
} from '../types'

/**
 * Classify a search term as artist, album, or song using parallel MusicBrainz API calls
 */
export async function classifySearch(
  client: MusicBrainzApiClient,
  request: SearchClassificationRequest
): Promise<SearchClassificationResponse> {
  try {
    console.log(
      `[MusicBrainzService] Classifying search term: "${request.query}"`
    )

    const results: SearchClassificationResult[] = []

    // Fire all three searches in parallel — they are independent
    const [artistResult, albumResult, songResult] = await Promise.allSettled([
      client.request<MBArtistResponse>('artist', {
        query: `artist:"${request.query}"`,
        limit: '3',
        fmt: 'json',
      }),
      client.request<MBReleaseResponse>('release', {
        query: `release:"${request.query}"`,
        limit: '3',
        fmt: 'json',
      }),
      client.request<MBRecordingResponse>('recording', {
        query: `recording:"${request.query}"`,
        limit: '3',
        fmt: 'json',
      }),
    ])

    // Process artist results
    if (artistResult.status === 'fulfilled') {
      const artistResponse = artistResult.value
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
    } else {
      console.warn(
        '[MusicBrainzService] Artist search failed:',
        artistResult.reason
      )
    }

    // Process album results
    if (albumResult.status === 'fulfilled') {
      const albumResponse = albumResult.value
      if (albumResponse.releases && albumResponse.releases.length > 0) {
        for (const release of albumResponse.releases) {
          const artist =
            release['artist-credit']?.[0]?.artist?.name || 'Unknown Artist'
          results.push({
            type: 'album',
            name: release.title,
            artist,
            albumId: release.id,
            score: release.score || 0,
          })
        }
      }
    } else {
      console.warn(
        '[MusicBrainzService] Album search failed:',
        albumResult.reason
      )
    }

    // Process song results
    if (songResult.status === 'fulfilled') {
      const songResponse = songResult.value
      if (songResponse.recordings && songResponse.recordings.length > 0) {
        for (const recording of songResponse.recordings) {
          const artist =
            recording['artist-credit']?.[0]?.artist?.name || 'Unknown Artist'
          results.push({
            type: 'song',
            name: recording.title,
            artist,
            score: recording.score || 0,
          })
        }
      }
    } else {
      console.warn(
        '[MusicBrainzService] Song search failed:',
        songResult.reason
      )
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
