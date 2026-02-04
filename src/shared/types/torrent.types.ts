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
  /** Local file path where torrent is saved */
  filePath: string
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
}
