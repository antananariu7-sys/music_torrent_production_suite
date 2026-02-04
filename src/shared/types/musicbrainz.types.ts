// MusicBrainz API types for album discovery

export interface MusicBrainzAlbum {
  /** MusicBrainz release ID */
  id: string
  /** Album title */
  title: string
  /** Artist name */
  artist: string
  /** Release date */
  date?: string
  /** Album type (album, single, compilation, etc.) */
  type?: string
  /** Number of tracks */
  trackCount?: number
  /** Track list */
  tracks?: MusicBrainzTrack[]
  /** Score from search (0-100) */
  score?: number
}

export interface MusicBrainzTrack {
  /** Track position on album */
  position: number
  /** Track title */
  title: string
  /** Track duration in ms */
  duration?: number
}

export interface AlbumSearchRequest {
  /** Song title to search for */
  songTitle: string
  /** Optional artist name for better matching */
  artist?: string
}

export interface AlbumSearchResponse {
  success: boolean
  albums?: MusicBrainzAlbum[]
  error?: string
  query?: string
}
