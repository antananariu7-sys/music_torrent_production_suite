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
}

// Search Queries
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

// Search Results
interface SearchResult {
  queryId: string
  query: string
  pages: PageMatch[]
  searchedAt: Date
  executionTime: number
  error?: string
}

interface PageMatch {
  url: string
  title: string
  torrentUrl: string // Direct link to .torrent file
  size?: string
  seeders?: number
  leechers?: number
  uploadDate?: string
  category?: string
  metadata?: Record<string, any>
}

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
