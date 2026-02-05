# Data Models

This document describes all TypeScript interfaces and data models used in the application.

## 7. Data Architecture - Data Models

```typescript
// Authentication
interface LoginCredentials {
  username: string
  password: string
  remember: boolean
}

interface LoginResult {
  success: boolean
  username?: string
  error?: string
  sessionId?: string
}

interface AuthState {
  isLoggedIn: boolean
  username?: string
  sessionExpiry?: Date
  isSessionRestored?: boolean // Indicates session was restored from saved state
}

interface StoredCredentials {
  username?: string
  // Note: Password is NEVER stored, only username for convenience
}

interface SessionCookie {
  name: string
  value: string
  domain: string
  path: string
  expires: number
}

interface PersistedSession {
  cookies: SessionCookie[]
  username: string
  sessionExpiry: number
  savedAt: number
}

// Search - Current Implementation
interface SearchRequest {
  query: string
  category?: string // Optional category filter (not implemented yet)
}

interface SearchResult {
  id: string // Topic ID from RuTracker
  title: string
  author: string
  size: string
  seeders: number
  leechers: number
  url: string // Full URL to topic page
  category?: string
}

interface SearchResponse {
  success: boolean
  results?: SearchResult[]
  error?: string
  query?: string
}

interface SearchState {
  isSearching: boolean
  query: string
  results: SearchResult[]
  error?: string
}

// Search - Future Batch Implementation (TBD)
interface SearchQuery {
  id: string
  query: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  addedAt: Date
}

interface SearchOptions {
  maxResults?: number
  timeout?: number
  delayBetweenSearches?: number
  searchType?: 'exact' | 'partial' | 'fuzzy'
}

interface SearchJob {
  id: string
  queries: SearchQuery[]
  startedAt: Date
  completedAt?: Date
  status: 'running' | 'completed' | 'cancelled' | 'failed'
  progress: {
    current: number
    total: number
    percentage: number
  }
}

// ====================================
// MUSICBRAINZ INTEGRATION
// ====================================

interface MusicBrainzAlbum {
  id: string                  // MusicBrainz release ID
  title: string
  artist: string
  artistId?: string
  releaseDate?: string
  country?: string
  trackCount?: number
  format?: string             // CD, Vinyl, Digital, etc.
  score?: number              // Match confidence (0-100)
}

interface SearchClassificationResult {
  type: 'artist' | 'album' | 'song'
  name: string
  artist?: string
  artistId?: string
  albumId?: string
  score: number               // Match confidence (0-100)
  disambiguation?: string     // Additional context
}

// ====================================
// SEARCH HISTORY (Per-Project)
// ====================================

interface SearchHistoryEntry {
  id: string
  query: string
  timestamp: string           // ISO timestamp
  status: 'completed' | 'error' | 'cancelled'
  result?: string             // Description (e.g., "Downloaded album X")
}

interface SearchHistoryFile {
  projectId: string
  projectName: string
  history: SearchHistoryEntry[]
  lastUpdated: string
}

// ====================================
// USER SETTINGS
// ====================================

// User Settings
interface Settings {
  theme: 'light' | 'dark' | 'system'
  language: string
  searchDefaults: SearchOptions
  rememberCredentials: boolean
  autoExportResults: boolean
  exportFormat: 'json' // Future: 'csv' | 'excel'
  rutrackerUrl: string // Default: 'https://rutracker.org/forum/index.php'
  showBrowser: boolean // Show browser window during automation
  maxPagesPerSearch: number // Pagination limit
  customPreferences: Record<string, any>
}

// Application State
interface AppState {
  version: string
  platform: Platform
  isOnline: boolean
  currentJob?: SearchJob
  currentProject?: Project
}

// ====================================
// PROJECT MANAGEMENT
// ====================================

interface Project {
  id: string
  name: string
  description?: string
  createdAt: Date
  updatedAt: Date
  lastOpenedAt?: Date

  // Component 1: Search results
  searchResults: SearchResult[]
  searchHistory: SearchQuery[]

  // Component 2: Torrent downloads
  downloadQueue: TorrentDownload[]
  downloadedFiles: AudioFile[]
  downloadSettings: DownloadSettings

  // Component 3: Mixing (TBD)
  mixingSessions?: MixingSession[]

  // Project configuration
  settings: ProjectSettings
  metadata: ProjectMetadata
}

interface ProjectInfo {
  id: string
  name: string
  description?: string
  createdAt: Date
  updatedAt: Date
  lastOpenedAt?: Date
  fileCount: number
  totalSize: number
}

interface ProjectSettings {
  downloadPath: string
  autoAddToMixer: boolean
  maxConcurrentDownloads: number
  seedRatio: number // Auto-stop seeding after this ratio
}

interface ProjectMetadata {
  tags: string[]
  genre?: string
  totalSearches: number
  totalDownloads: number
  totalMixes?: number
}

// ====================================
// TORRENT MANAGEMENT
// ====================================

// Torrent download request/response types
interface TorrentDownloadRequest {
  torrentId: string           // RuTracker topic/torrent ID
  pageUrl: string             // Page URL where torrent is located
  title?: string              // Optional torrent title
}

interface TorrentDownloadResponse {
  success: boolean
  error?: string
  torrent?: TorrentFileInfo   // Downloaded torrent file info
}

interface TorrentFileInfo {
  id: string
  title: string
  filePath?: string           // Local file path (for .torrent files)
  magnetLink?: string         // Magnet link alternative
  pageUrl: string
  downloadedAt: Date
  size?: number
  metadata?: {
    author?: string
    seeders?: number
    leechers?: number
    category?: string
  }
}

interface TorrentSettings {
  torrentsFolder: string      // Directory for torrent files
  autoOpen?: boolean          // Auto-open in torrent client
  keepHistory?: boolean       // Track download history
  preferMagnetLinks?: boolean // Prefer magnet links over .torrent
}

// Torrent collection (per-project saved torrents)
interface CollectedTorrent {
  id: string                  // Unique collection entry ID
  torrentId: string           // RuTracker topic ID
  magnetLink: string          // Magnet link
  title: string
  pageUrl: string
  addedAt: string             // ISO timestamp
  metadata?: {
    size?: string
    sizeBytes?: number
    seeders?: number
    leechers?: number
    category?: string
  }
  projectId: string           // Owning project
}

interface TorrentCollectionFile {
  projectId: string
  projectName: string
  torrents: CollectedTorrent[]
  lastUpdated: string         // ISO timestamp
}

interface TorrentDownload {
  id: string
  projectId: string
  magnetUri: string
  infoHash: string
  name: string
  status: 'queued' | 'downloading' | 'seeding' | 'paused' | 'completed' | 'error'

  // Progress
  progress: number // 0-100
  downloadSpeed: number // bytes/sec
  uploadSpeed: number // bytes/sec
  downloaded: number // bytes
  uploaded: number // bytes
  totalSize: number // bytes

  // Metadata
  files: TorrentFile[]
  seeders: number
  leechers: number
  ratio: number // upload/download ratio

  // Timestamps
  addedAt: Date
  startedAt?: Date
  completedAt?: Date

  // Source
  fromSearchResult?: string // SearchResult ID
  error?: string
}

interface TorrentFile {
  path: string
  name: string
  size: number
  downloaded: number
  progress: number
  selected: boolean // User can choose which files to download
}

interface TorrentOptions {
  downloadPath?: string
  maxUploadSpeed?: number
  maxDownloadSpeed?: number
  sequentialDownload?: boolean
}

interface TorrentInfo {
  name: string
  infoHash: string
  magnetUri: string
  files: TorrentFile[]
  totalSize: number
  pieceLength: number
  pieces: number
}

// ====================================
// AUDIO FILE MANAGEMENT
// ====================================

interface AudioFile {
  id: string
  projectId: string
  torrentId?: string // If downloaded via torrent

  // File info
  path: string
  name: string
  size: number
  format: 'mp3' | 'flac' | 'wav' | 'ogg' | 'aac' | 'other'

  // Audio metadata
  duration?: number // seconds
  bitrate?: number // kbps
  sampleRate?: number // Hz
  channels?: number // 1=mono, 2=stereo

  // ID3 tags
  title?: string
  artist?: string
  album?: string
  year?: number
  genre?: string

  // Application metadata
  addedAt: Date
  lastPlayedAt?: Date
  usedInMixes?: string[] // MixingSession IDs
  tags: string[]
}

interface DownloadSettings {
  maxConcurrentDownloads: number
  defaultDownloadPath: string
  seedAfterDownload: boolean
  maxUploadSpeed: number // KB/s, 0 = unlimited
  maxDownloadSpeed: number // KB/s, 0 = unlimited
}

// ====================================
// MIXING (Component 3 - TBD)
// ====================================

interface MixingSession {
  id: string
  projectId: string
  name: string
  createdAt: Date
  updatedAt: Date

  // Tracks in the mix
  tracks: MixTrack[]

  // Export settings
  exportFormat?: 'mp3' | 'wav' | 'flac'
  exportPath?: string

  // Session state (TBD - depends on mixing implementation)
  state?: any
}

interface MixTrack {
  id: string
  audioFileId: string
  name: string
  volume: number
  // More properties TBD based on mixing requirements
}
```
