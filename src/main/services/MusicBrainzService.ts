import type {
  MusicBrainzAlbum,
  MusicBrainzTrack,
  AlbumSearchRequest,
  AlbumSearchResponse,
} from '@shared/types/musicbrainz.types'

/**
 * MusicBrainzService
 *
 * Integrates with MusicBrainz API to discover albums containing specific songs.
 * This helps users find the correct album when they know a song name.
 */
export class MusicBrainzService {
  private readonly API_BASE = 'https://musicbrainz.org/ws/2'
  private readonly USER_AGENT = 'MusicProductionSuite/1.0.0 (https://github.com/yourrepo)'
  private readonly RATE_LIMIT_MS = 1000 // MusicBrainz requires 1 request per second

  private lastRequestTime = 0

  /**
   * Respect MusicBrainz rate limiting (1 request per second)
   */
  private async respectRateLimit(): Promise<void> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime

    if (timeSinceLastRequest < this.RATE_LIMIT_MS) {
      const waitTime = this.RATE_LIMIT_MS - timeSinceLastRequest
      console.log(`[MusicBrainzService] Rate limiting: waiting ${waitTime}ms`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }

    this.lastRequestTime = Date.now()
  }

  /**
   * Make a request to MusicBrainz API
   *
   * @param endpoint - API endpoint
   * @param params - Query parameters
   * @returns API response
   */
  private async request<T>(endpoint: string, params: Record<string, string>): Promise<T> {
    await this.respectRateLimit()

    const url = new URL(`${this.API_BASE}/${endpoint}`)
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value)
    })

    console.log(`[MusicBrainzService] Requesting: ${url.toString()}`)

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': this.USER_AGENT,
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`MusicBrainz API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Search for albums containing a specific song
   *
   * @param request - Album search request
   * @returns Albums containing the song
   */
  async findAlbumsBySong(request: AlbumSearchRequest): Promise<AlbumSearchResponse> {
    try {
      console.log(`[MusicBrainzService] Searching for albums with song: "${request.songTitle}"`)

      // Build search query
      let query = `recording:"${request.songTitle}"`
      if (request.artist) {
        query += ` AND artist:"${request.artist}"`
      }

      // Search for recordings (songs)
      const recordingResponse = await this.request<any>('recording', {
        query,
        limit: '10',
        fmt: 'json',
      })

      if (!recordingResponse.recordings || recordingResponse.recordings.length === 0) {
        return {
          success: true,
          albums: [],
          query: request.songTitle,
        }
      }

      console.log(`[MusicBrainzService] Found ${recordingResponse.recordings.length} recordings`)

      // Extract unique albums from recordings
      const albumsMap = new Map<string, MusicBrainzAlbum>()

      for (const recording of recordingResponse.recordings) {
        if (!recording.releases) continue

        for (const release of recording.releases) {
          // Skip if we already have this album
          if (albumsMap.has(release.id)) continue

          // Get artist name
          const artist = recording['artist-credit']?.[0]?.name || 'Unknown Artist'

          const album: MusicBrainzAlbum = {
            id: release.id,
            title: release.title,
            artist,
            date: release.date,
            type: release['release-group']?.['primary-type']?.toLowerCase(),
            trackCount: release['track-count'],
            score: recording.score || 0,
          }

          albumsMap.set(release.id, album)
        }
      }

      // Convert map to array and sort by score
      const albums = Array.from(albumsMap.values()).sort((a, b) => (b.score || 0) - (a.score || 0))

      console.log(`[MusicBrainzService] Found ${albums.length} unique albums`)

      return {
        success: true,
        albums,
        query: request.songTitle,
      }
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
   *
   * @param albumId - MusicBrainz release ID
   * @returns Album with track list
   */
  async getAlbumDetails(albumId: string): Promise<MusicBrainzAlbum | null> {
    try {
      console.log(`[MusicBrainzService] Fetching album details for: ${albumId}`)

      const response = await this.request<any>(`release/${albumId}`, {
        inc: 'recordings+artist-credits',
        fmt: 'json',
      })

      const artist = response['artist-credit']?.[0]?.name || 'Unknown Artist'

      // Extract track list
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
      }

      console.log(`[MusicBrainzService] Album has ${tracks.length} tracks`)

      return album
    } catch (error) {
      console.error('[MusicBrainzService] Failed to get album details:', error)
      return null
    }
  }

  /**
   * Create a search query string for RuTracker based on album info
   *
   * @param album - MusicBrainz album
   * @returns Search query optimized for RuTracker
   */
  createRuTrackerQuery(album: MusicBrainzAlbum): string {
    // Format: "Artist - Album Title"
    return `${album.artist} - ${album.title}`
  }
}
