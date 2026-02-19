import type { MusicBrainzAlbum, MusicBrainzArtist, ArtistAlbumsRequest, ArtistAlbumsResponse } from '@shared/types/musicbrainz.types'
import type { MusicBrainzApiClient } from '../MusicBrainzApiClient'
import type { MBArtist, MBReleaseResponse } from '../types'

/**
 * Get all albums by an artist
 */
export async function getArtistAlbums(
  client: MusicBrainzApiClient,
  request: ArtistAlbumsRequest
): Promise<ArtistAlbumsResponse> {
  try {
    console.log(`[MusicBrainzService] Fetching albums for artist: ${request.artistId}`)

    const artistResponse = await client.request<MBArtist>(`artist/${request.artistId}`, {
      fmt: 'json',
    })

    const artist: MusicBrainzArtist = {
      id: artistResponse.id,
      name: artistResponse.name,
      type: artistResponse.type,
    }

    const releasesResponse = await client.request<MBReleaseResponse>('release', {
      artist: request.artistId,
      limit: String(request.limit || 50),
      fmt: 'json',
    })

    const albums: MusicBrainzAlbum[] = []

    if (releasesResponse.releases && releasesResponse.releases.length > 0) {
      for (const release of releasesResponse.releases) {
        albums.push({
          id: release.id,
          title: release.title,
          artist: artist.name,
          date: release.date,
          type: release['release-group']?.['primary-type']?.toLowerCase(),
          trackCount: release['track-count'],
          coverArtUrl: client.getCoverArtUrl(release.id),
        })
      }
    }

    console.log(`[MusicBrainzService] Found ${albums.length} albums for ${artist.name}`)

    return { success: true, albums, artist }
  } catch (error) {
    console.error('[MusicBrainzService] Failed to get artist albums:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get artist albums',
    }
  }
}
