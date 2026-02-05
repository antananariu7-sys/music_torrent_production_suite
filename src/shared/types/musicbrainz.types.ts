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
  /** Cover art URL from Cover Art Archive */
  coverArtUrl?: string
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

// Search classification types
export type SearchResultType = 'artist' | 'album' | 'song' | 'unknown'

export interface SearchClassificationRequest {
  /** Search term entered by user */
  query: string
}

export interface SearchClassificationResult {
  /** Type of result */
  type: SearchResultType
  /** Result name */
  name: string
  /** Artist name (for albums and songs) */
  artist?: string
  /** Album ID (for albums) */
  albumId?: string
  /** Confidence score (0-100) */
  score: number
}

export interface SearchClassificationResponse {
  success: boolean
  /** Classified results ordered by confidence */
  results?: SearchClassificationResult[]
  /** Best guess */
  bestMatch?: SearchClassificationResult
  error?: string
  query?: string
}

// Artist search types
export interface MusicBrainzArtist {
  /** MusicBrainz artist ID */
  id: string
  /** Artist name */
  name: string
  /** Artist type (person, group, etc.) */
  type?: string
  /** Artist score from search */
  score?: number
}

export interface ArtistAlbumsRequest {
  /** MusicBrainz artist ID */
  artistId: string
  /** Optional: limit number of results */
  limit?: number
}

export interface ArtistAlbumsResponse {
  success: boolean
  albums?: MusicBrainzAlbum[]
  artist?: MusicBrainzArtist
  error?: string
}
