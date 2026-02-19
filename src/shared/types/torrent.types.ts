// Torrent download types

export type TorrentStatus = 'pending' | 'downloading' | 'completed' | 'failed'

export interface TorrentDownloadRequest {
  /** RuTracker topic/torrent ID */
  torrentId: string
  /** Page URL where torrent is located */
  pageUrl: string
  /** Optional torrent title */
  title?: string
  /** Project directory for saving download history */
  projectDirectory?: string
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

// ====================================
// WEBTORRENT DOWNLOAD QUEUE TYPES
// ====================================

/** Status of a torrent in the download queue */
export type QueuedTorrentStatus = 'queued' | 'downloading' | 'seeding' | 'paused' | 'completed' | 'error' | 'awaiting-file-selection'

/** A single file inside a torrent being downloaded */
export interface TorrentContentFile {
  /** File path relative to torrent root */
  path: string
  /** File name */
  name: string
  /** Total file size in bytes */
  size: number
  /** Bytes downloaded so far */
  downloaded: number
  /** Download progress 0-100 */
  progress: number
  /** Whether the file is selected for download */
  selected: boolean
}

/** A torrent in the active download queue */
export interface QueuedTorrent {
  /** Unique queue entry ID (UUID) */
  id: string
  /** Owning project ID */
  projectId: string
  /** Magnet URI used to add the torrent */
  magnetUri: string
  /** Info hash (populated once torrent metadata resolves) */
  infoHash: string
  /** Torrent name */
  name: string
  /** Current status */
  status: QueuedTorrentStatus
  /** Download progress 0-100 */
  progress: number
  /** Current download speed in bytes/sec */
  downloadSpeed: number
  /** Current upload speed in bytes/sec */
  uploadSpeed: number
  /** Total bytes downloaded */
  downloaded: number
  /** Total bytes uploaded */
  uploaded: number
  /** Total torrent size in bytes */
  totalSize: number
  /** Files inside the torrent */
  files: TorrentContentFile[]
  /** Number of connected seeders/peers */
  seeders: number
  /** Number of connected leechers */
  leechers: number
  /** Upload/download ratio */
  ratio: number
  /** When the torrent was added to queue (ISO string) */
  addedAt: string
  /** When downloading started (ISO string) */
  startedAt?: string
  /** When download completed (ISO string) */
  completedAt?: string
  /** Local directory where files are saved */
  downloadPath: string
  /** Links back to CollectedTorrent.id if added from collection */
  fromCollectedTorrentId?: string
  /** Error message if status is 'error' */
  error?: string
  /** Path to the .torrent file used (if any) */
  torrentFilePath?: string
  /** Pre-selected file indices (skip file selection dialog) */
  selectedFileIndices?: number[]
  /** Actual root folder name created by WebTorrent on disk (set from torrent.name on metadata) */
  torrentRootFolder?: string
}

/** Progress event pushed from main to renderer for active torrents */
export interface QueuedTorrentProgress {
  /** QueuedTorrent.id */
  id: string
  status: QueuedTorrentStatus
  progress: number
  downloadSpeed: number
  uploadSpeed: number
  downloaded: number
  uploaded: number
  totalSize: number
  seeders: number
  leechers: number
  ratio: number
  files: TorrentContentFile[]
}

/** Request to add a torrent to the download queue */
export interface AddTorrentRequest {
  /** Magnet URI for the torrent */
  magnetUri: string
  /** Project ID this download belongs to */
  projectId: string
  /** Display name for the torrent */
  name: string
  /** Local directory to save downloaded files */
  downloadPath: string
  /** Optional link back to CollectedTorrent.id */
  fromCollectedTorrentId?: string
  /** Path to a local .torrent file (used instead of magnetUri when available) */
  torrentFilePath?: string
  /** Pre-selected file indices — skip the file selection dialog when provided */
  selectedFileIndices?: number[]
}

/** Request to parse a .torrent file and get its file list */
export interface ParseTorrentFilesRequest {
  torrentFilePath: string
}

/** Response from parsing a .torrent file */
export interface ParseTorrentFilesResponse {
  success: boolean
  files?: TorrentContentFile[]
  error?: string
}

/** Response after adding a torrent to the queue */
export interface AddTorrentResponse {
  success: boolean
  torrent?: QueuedTorrent
  error?: string
}

/** Request to check for a local .torrent file in the project directory */
export interface CheckLocalTorrentRequest {
  /** RuTracker topic/torrent ID */
  torrentId: string
  /** Project directory to check in */
  projectDirectory: string
}

/** Response from local .torrent file check */
export interface CheckLocalTorrentResponse {
  /** Whether the .torrent file was found */
  found: boolean
  /** Full file path if found */
  filePath?: string
}

/** Entry in the torrent activity log */
export interface TorrentActivityLogEntry {
  id: string
  timestamp: string
  message: string
  type: 'info' | 'success' | 'error' | 'warning'
}

/** Settings for the WebTorrent download client */
export interface WebTorrentSettings {
  /** Maximum number of concurrent downloads (1-10, default 3) */
  maxConcurrentDownloads: number
  /** Keep seeding after download completes (default false) */
  seedAfterDownload: boolean
  /** Maximum upload speed in bytes/sec (0 = unlimited) */
  maxUploadSpeed: number
  /** Maximum download speed in bytes/sec (0 = unlimited) */
  maxDownloadSpeed: number
}

/** Request to select files for a torrent */
export interface SelectTorrentFilesRequest {
  /** QueuedTorrent.id */
  id: string
  /** Array of file indices to select (0-based) */
  selectedFileIndices: number[]
}

/** Response from file selection */
export interface SelectTorrentFilesResponse {
  success: boolean
  error?: string
}
