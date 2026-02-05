// Torrent download types

export type TorrentStatus = 'pending' | 'downloading' | 'completed' | 'failed'

export interface TorrentDownloadRequest {
  /** RuTracker topic/torrent ID */
  torrentId: string
  /** Page URL where torrent is located */
  pageUrl: string
  /** Optional torrent title */
  title?: string
}

export interface TorrentFile {
  /** Torrent ID */
  id: string
  /** Torrent title */
  title: string
  /** Local file path where torrent is saved (for .torrent files) */
  filePath?: string
  /** Magnet link (alternative to file download) */
  magnetLink?: string
  /** Original page URL */
  pageUrl: string
  /** Download timestamp */
  downloadedAt: Date
  /** File size in bytes */
  size?: number
  /** Associated search result data */
  metadata?: {
    author?: string
    seeders?: number
    leechers?: number
    category?: string
  }
}

export interface TorrentDownloadResponse {
  success: boolean
  error?: string
  /** Downloaded torrent file info */
  torrent?: TorrentFile
}

export interface TorrentDownloadProgress {
  torrentId: string
  status: TorrentStatus
  progress: number // 0-100
  message?: string
}

export interface TorrentSettings {
  /** Directory where torrent files are saved */
  torrentsFolder: string
  /** Auto-open torrents in default torrent client */
  autoOpen?: boolean
  /** Keep download history */
  keepHistory?: boolean
  /** Prefer magnet links over .torrent file downloads */
  preferMagnetLinks?: boolean
}

/**
 * A torrent that has been collected from search results but not yet downloaded
 */
export interface CollectedTorrent {
  /** Unique ID for this collection entry */
  id: string
  /** RuTracker topic/torrent ID */
  torrentId: string
  /** Magnet link for the torrent */
  magnetLink: string
  /** Torrent title */
  title: string
  /** Original page URL */
  pageUrl: string
  /** When this torrent was added to collection (ISO string) */
  addedAt: string
  /** Associated metadata */
  metadata?: {
    size?: string
    sizeBytes?: number
    seeders?: number
    leechers?: number
    category?: string
  }
  /** Project this torrent belongs to */
  projectId: string
}

/**
 * Torrent collection file format (saved to project directory)
 */
export interface TorrentCollectionFile {
  projectId: string
  projectName: string
  torrents: CollectedTorrent[]
  lastUpdated: string
}

/**
 * Request to load torrent collection
 */
export interface LoadTorrentCollectionRequest {
  projectId: string
  projectDirectory: string
}

/**
 * Request to save torrent collection
 */
export interface SaveTorrentCollectionRequest {
  projectId: string
  projectName: string
  projectDirectory: string
  torrents: CollectedTorrent[]
}

/**
 * Response for torrent collection operations
 */
export interface TorrentCollectionResponse {
  success: boolean
  torrents?: CollectedTorrent[]
  error?: string
}
