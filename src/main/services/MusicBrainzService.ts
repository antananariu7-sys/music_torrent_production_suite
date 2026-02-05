import type {
  MusicBrainzAlbum,
  MusicBrainzTrack,
  MusicBrainzArtist,
  AlbumSearchRequest,
  AlbumSearchResponse,
  SearchClassificationRequest,
  SearchClassificationResponse,
  SearchClassificationResult,
  ArtistAlbumsRequest,
  ArtistAlbumsResponse,
} from '@shared/types/musicbrainz.types'

// MusicBrainz API response types
interface MBRecording {
  id: string
  title: string
  score?: number
  'artist-credit'?: Array<{ artist?: { id: string; name: string } }>
  releases?: Array<{
    id: string
    title: string
    date?: string
    'release-group'?: { id: string; 'primary-type'?: string }
    'track-count'?: number
  }>
}

interface MBRelease {
  id: string
  title: string
  score?: number
  date?: string
  'artist-credit'?: Array<{ artist?: { id: string; name: string } }>
  'release-group'?: { id: string; 'primary-type'?: string }
  'track-count'?: number
}

interface MBArtist {
  id: string
  name: string
  score?: number
  type?: string
}

interface MBRecordingResponse {
  recordings: MBRecording[]
}

interface MBReleaseResponse {
  releases: MBRelease[]
}

interface MBArtistResponse {
  artists: MBArtist[]
}

/**
 * MusicBrainzService
 *
 * Integrates with MusicBrainz API to discover albums containing specific songs.
 * This helps users find the correct album when they know a song name.
 */
export class MusicBrainzService {
  private readonly API_BASE = 'https://musicbrainz.org/ws/2'
  private readonly COVER_ART_BASE = 'https://coverartarchive.org/release'
  private readonly USER_AGENT = 'MusicProductionSuite/1.0.0 (https://github.com/yourrepo)'
  private readonly RATE_LIMIT_MS = 1000 // MusicBrainz requires 1 request per second

  private lastRequestTime = 0

  /**
   * Generate Cover Art Archive URL for an album
   * Uses 250px thumbnail for performance
   *
   * @param albumId - MusicBrainz release ID
   * @returns Cover art URL
   */
  private getCoverArtUrl(albumId: string): string {
    return `${this.COVER_ART_BASE}/${albumId}/front-250`
  }

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

    return response.json() as Promise<T>
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
      const recordingResponse = await this.request<MBRecordingResponse>('recording', {
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
          const artist = recording['artist-credit']?.[0]?.artist?.name || 'Unknown Artist'

          const album: MusicBrainzAlbum = {
            id: release.id,
            title: release.title,
            artist,
            date: release.date,
            type: release['release-group']?.['primary-type']?.toLowerCase(),
            trackCount: release['track-count'],
            score: recording.score || 0,
            coverArtUrl: this.getCoverArtUrl(release.id),
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

      const response = await this.request<MBRelease & { media?: Array<{ tracks?: Array<{ id: string; title: string; length?: number; position: number; recording?: { title: string; length?: number } }> }> }>(`release/${albumId}`, {
        inc: 'recordings+artist-credits',
        fmt: 'json',
      })

      const artist = response['artist-credit']?.[0]?.artist?.name || 'Unknown Artist'

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
        coverArtUrl: this.getCoverArtUrl(response.id),
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

  /**
   * Classify a search term as artist, album, or song
   *
   * @param request - Search classification request
   * @returns Classification results with best match
   */
  async classifySearch(request: SearchClassificationRequest): Promise<SearchClassificationResponse> {
    try {
      console.log(`[MusicBrainzService] Classifying search term: "${request.query}"`)

      const results: SearchClassificationResult[] = []

      // Search for artists
      try {
        const artistResponse = await this.request<MBArtistResponse>('artist', {
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
        const albumResponse = await this.request<MBReleaseResponse>('release', {
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
        const songResponse = await this.request<MBRecordingResponse>('recording', {
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

      // Sort by score
      results.sort((a, b) => b.score - a.score)

      const bestMatch = results.length > 0 ? results[0] : undefined

      console.log(
        `[MusicBrainzService] Found ${results.length} results, best match: ${bestMatch?.type} - ${bestMatch?.name}`
      )

      return {
        success: true,
        results,
        bestMatch,
        query: request.query,
      }
    } catch (error) {
      console.error('[MusicBrainzService] Classification failed:', error)

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Classification failed',
        query: request.query,
      }
    }
  }

  /**
   * Get all albums by an artist
   *
   * @param request - Artist albums request
   * @returns List of albums by the artist
   */
  async getArtistAlbums(request: ArtistAlbumsRequest): Promise<ArtistAlbumsResponse> {
    try {
      console.log(`[MusicBrainzService] Fetching albums for artist: ${request.artistId}`)

      // Get artist details
      const artistResponse = await this.request<MBArtist>(`artist/${request.artistId}`, {
        fmt: 'json',
      })

      const artist: MusicBrainzArtist = {
        id: artistResponse.id,
        name: artistResponse.name,
        type: artistResponse.type,
      }

      // Get artist's releases
      const releasesResponse = await this.request<MBReleaseResponse>('release', {
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
            coverArtUrl: this.getCoverArtUrl(release.id),
          })
        }
      }

      console.log(`[MusicBrainzService] Found ${albums.length} albums for ${artist.name}`)

      return {
        success: true,
        albums,
        artist,
      }
    } catch (error) {
      console.error('[MusicBrainzService] Failed to get artist albums:', error)

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get artist albums',
      }
    }
  }
}
