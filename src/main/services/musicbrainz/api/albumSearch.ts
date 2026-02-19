import type { MusicBrainzAlbum, MusicBrainzTrack, AlbumSearchRequest, AlbumSearchResponse } from '@shared/types/musicbrainz.types'
import type { MusicBrainzApiClient } from '../MusicBrainzApiClient'
import type { MBRecordingResponse, MBRelease } from '../types'

type MBReleaseWithMedia = MBRelease & {
  media?: Array<{
    tracks?: Array<{
      id: string
      title: string
      length?: number
      position: number
      recording?: { title: string; length?: number }
    }>
  }>
}

/**
 * Search for albums containing a specific song
 */
export async function findAlbumsBySong(
  client: MusicBrainzApiClient,
  request: AlbumSearchRequest
): Promise<AlbumSearchResponse> {
  try {
    console.log(`[MusicBrainzService] Searching for albums with song: "${request.songTitle}"`)

    let query = `recording:"${request.songTitle}"`
    if (request.artist) {
      query += ` AND artist:"${request.artist}"`
    }

    const recordingResponse = await client.request<MBRecordingResponse>('recording', {
      query,
      limit: '10',
      fmt: 'json',
    })

    if (!recordingResponse.recordings || recordingResponse.recordings.length === 0) {
      return { success: true, albums: [], query: request.songTitle }
    }

    console.log(`[MusicBrainzService] Found ${recordingResponse.recordings.length} recordings`)

    const albumsMap = new Map<string, MusicBrainzAlbum>()

    for (const recording of recordingResponse.recordings) {
      if (!recording.releases) continue

      for (const release of recording.releases) {
        if (albumsMap.has(release.id)) continue

        const artist = recording['artist-credit']?.[0]?.artist?.name || 'Unknown Artist'

        albumsMap.set(release.id, {
          id: release.id,
          title: release.title,
          artist,
          date: release.date,
          type: release['release-group']?.['primary-type']?.toLowerCase(),
          trackCount: release['track-count'],
          score: recording.score || 0,
          coverArtUrl: client.getCoverArtUrl(release.id),
        })
      }
    }

    const albums = Array.from(albumsMap.values()).sort((a, b) => (b.score || 0) - (a.score || 0))

    console.log(`[MusicBrainzService] Found ${albums.length} unique albums`)

    return { success: true, albums, query: request.songTitle }
  } catch (error) {
    console.error('[MusicBrainzService] Search failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Album search failed',
      query: request.songTitle,
    }
  }
}

/**
 * Get full album details including track list
 */
export async function getAlbumDetails(
  client: MusicBrainzApiClient,
  albumId: string
): Promise<MusicBrainzAlbum | null> {
  try {
    console.log(`[MusicBrainzService] Fetching album details for: ${albumId}`)

    const response = await client.request<MBReleaseWithMedia>(`release/${albumId}`, {
      inc: 'recordings+artist-credits',
      fmt: 'json',
    })

    const artist = response['artist-credit']?.[0]?.artist?.name || 'Unknown Artist'

    const tracks: MusicBrainzTrack[] = []
    if (response.media && response.media.length > 0) {
      for (const medium of response.media) {
        if (!medium.tracks) continue
        for (const track of medium.tracks) {
          tracks.push({
            position: track.position,
            title: track.recording?.title || track.title,
            duration: track.recording?.length,
          })
        }
      }
    }

    const album: MusicBrainzAlbum = {
      id: response.id,
      title: response.title,
      artist,
      date: response.date,
      type: response['release-group']?.['primary-type']?.toLowerCase(),
      trackCount: tracks.length,
      tracks,
      coverArtUrl: client.getCoverArtUrl(response.id),
    }

    console.log(`[MusicBrainzService] Album has ${tracks.length} tracks`)

    return album
  } catch (error) {
    console.error('[MusicBrainzService] Failed to get album details:', error)
    return null
  }
}
