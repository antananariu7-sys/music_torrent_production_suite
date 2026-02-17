/** A single track extracted from a torrent page */
export interface TorrentTrack {
  /** Track number within its disc */
  position: number
  /** Track title */
  title: string
  /** Duration string if available (e.g., "4:42") */
  duration?: string
}

/** A single album/disc parsed from a torrent page */
export interface ParsedAlbum {
  /** Album title */
  title: string
  /** Release year if detected */
  year?: string
  /** Track listing */
  tracks: TorrentTrack[]
}

/** Metadata extracted from a RuTracker torrent page */
export interface TorrentPageMetadata {
  /** Parsed albums (may contain multiple for discography pages) */
  albums: ParsedAlbum[]
  /** Audio format (FLAC, MP3, etc.) */
  format?: string
  /** Bitrate or quality info (320kbps, lossless, etc.) */
  bitrate?: string
  /** Total duration string */
  totalDuration?: string
}

/** Request to parse torrent page metadata */
export interface TorrentMetadataRequest {
  /** URL of the torrent page */
  torrentUrl: string
  /** Torrent ID for caching */
  torrentId: string
}

/** Response from torrent metadata parsing */
export interface TorrentMetadataResponse {
  success: boolean
  metadata?: TorrentPageMetadata
  error?: string
}
