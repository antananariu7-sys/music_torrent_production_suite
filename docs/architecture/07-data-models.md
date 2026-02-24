# Data Models

This document describes all TypeScript interfaces and data models used in the application.
All types are defined in `src/shared/types/` and organized by domain.

## 7. Data Architecture - Data Models

### Authentication (`auth.types.ts`)

```typescript
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
```

### Application Settings (`app.types.ts`)

```typescript
interface AppInfo {
  name: string
  version: string
  platform: NodeJS.Platform
  arch: string
}

interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  downloadDirectory: string
  autoStart: boolean
  minimizeToTray: boolean
  notifications: boolean
  autoScanDiscography: boolean
}

type AppStatus = 'idle' | 'busy' | 'error'

interface ErrorInfo {
  code: string
  message: string
  details?: unknown
}
```

### Project Management (`project.types.ts`)

```typescript
interface Project {
  id: string
  name: string
  description?: string
  createdAt: Date
  updatedAt: Date
  projectDirectory: string // Root directory for project
  songs: Song[] // Array of songs in the mix
  mixMetadata: MixMetadata // Metadata about the mix
  isActive: boolean // Whether project is currently open
}

interface Song {
  id: string
  title: string
  artist?: string
  album?: string
  duration?: number // Duration in seconds
  format?: string // mp3, flac, wav, etc.
  bitrate?: number // Bitrate in kbps
  sampleRate?: number // Sample rate in Hz
  fileSize?: number // File size in bytes
  downloadId?: string // Reference to download (if from Component 2)
  externalFilePath?: string // Path to external file (if not downloaded)
  localFilePath?: string // Path in project assets/ directory
  addedAt: Date
  order: number // Order in the mix
  metadata?: AudioMetadata // Extended audio metadata
}

interface MixMetadata {
  title?: string
  description?: string
  coverImagePath?: string // Path to cover image in assets/covers/
  tags: string[]
  genre?: string
  estimatedDuration?: number // Sum of all song durations
  createdBy?: string // User who created the mix
}

interface AudioMetadata {
  duration?: number
  format?: string
  bitrate?: number
  sampleRate?: number
  fileSize?: number
  artist?: string
  title?: string
  album?: string
  year?: number
  genre?: string
  trackNumber?: number
  channels?: number
  codec?: string
}

interface RecentProject {
  projectId: string
  projectName: string
  projectDirectory: string
  lastOpened: Date
  songCount: number
  coverImagePath?: string
}

interface ProjectStats {
  totalSongs: number
  totalDuration: number // Sum of all song durations in seconds
  totalSize: number // Total file size in bytes
  downloadedSongs: number // Songs from Component 2
  externalSongs: number // Songs from external files
  formatBreakdown: Record<string, number> // Count by format (mp3: 5, flac: 3)
}

interface ProjectLock {
  projectId: string
  lockedBy: { pid: number; hostname: string }
  lockedAt: Date
}

interface CreateProjectRequest {
  name: string
  location: string // Parent directory where project will be created
  description?: string
}

interface OpenProjectRequest {
  filePath: string
}

// Legacy project metadata (for backward compatibility)
interface ProjectMetadata {
  totalSearches: number
  totalDownloads: number
  totalFiles: number
  lastOpened: Date
}
```

### Search (`search.types.ts`)

```typescript
type FileFormat =
  | 'mp3'
  | 'flac'
  | 'wav'
  | 'aac'
  | 'ogg'
  | 'alac'
  | 'ape'
  | 'any'
type SortBy = 'relevance' | 'seeders' | 'date' | 'size' | 'title'
type SortOrder = 'asc' | 'desc'

interface SearchFilters {
  format?: FileFormat
  minSeeders?: number
  minSize?: number // MB
  maxSize?: number // MB
  categories?: string[]
  dateFrom?: Date
  dateTo?: Date
}

interface SearchSort {
  by: SortBy
  order: SortOrder
}

interface SearchRequest {
  query: string
  filters?: SearchFilters
  sort?: SearchSort
  maxResults?: number
}

type SearchSource = 'album' | 'discography'

interface SearchResult {
  id: string // Topic ID from RuTracker
  title: string
  author: string
  size: string
  sizeBytes?: number // For sorting/filtering
  seeders: number
  leechers: number
  url: string // Full URL to topic page
  category?: string
  uploadDate?: string
  relevanceScore?: number // 0-100
  format?: FileFormat // Detected from title/description
  searchSource?: SearchSource // Direct album or discography search
}

interface SearchResponse {
  success: boolean
  results?: SearchResult[]
  error?: string
  query?: string
  appliedFilters?: SearchFilters
  totalResults?: number // Before filtering
}

interface SearchState {
  isSearching: boolean
  query: string
  results: SearchResult[]
  error?: string
  filters?: SearchFilters
  sort?: SearchSort
}

// Progressive multi-page search
interface ProgressiveSearchRequest {
  query: string
  filters?: SearchFilters
  maxPages?: number // Default: 10, max: 10
}

// Result grouping
type ResultGroup = 'studio' | 'live' | 'compilation' | 'discography' | 'other'

interface GroupedSearchResults {
  studio: SearchResult[]
  live: SearchResult[]
  compilation: SearchResult[]
  discography: SearchResult[]
  other: SearchResult[]
}

// Progress event for progressive search (M->R push via search:progress)
interface SearchProgressEvent {
  currentPage: number // 1-based
  totalPages: number
  results: SearchResult[] // Results found so far
  isComplete: boolean
  error?: string
}

// Load more results (on-demand page fetching)
interface LoadMoreRequest {
  query: string // Original search query
  fromPage: number // First page to fetch (1-indexed)
  toPage: number // Last page to fetch (inclusive)
  filters?: SearchFilters
}

interface LoadMoreResponse {
  success: boolean
  results: SearchResult[] // New results from fetched pages
  loadedPages: number // Pages successfully loaded
  totalPages: number // Total available pages on tracker
  isComplete: boolean // All available pages loaded
  error?: string
}
```

### Search History (`searchHistory.types.ts`)

```typescript
interface SearchHistoryEntry {
  id: string
  query: string
  timestamp: string // ISO timestamp
  status: 'completed' | 'error' | 'cancelled'
  result?: string // Description (e.g., "Downloaded album X")
}

interface SearchHistoryFile {
  projectId: string
  projectName: string
  history: SearchHistoryEntry[]
  lastUpdated: string
}
```

### MusicBrainz Integration (`musicbrainz.types.ts`)

```typescript
interface MusicBrainzAlbum {
  id: string // MusicBrainz release ID
  title: string
  artist: string
  date?: string // Release date
  type?: string // album, single, compilation, etc.
  trackCount?: number
  tracks?: MusicBrainzTrack[] // Track listing
  score?: number // Match confidence (0-100)
  coverArtUrl?: string // Cover Art Archive URL
}

interface MusicBrainzTrack {
  position: number
  title: string
  duration?: number // Duration in ms
}

interface AlbumSearchRequest {
  songTitle: string
  artist?: string
}

interface AlbumSearchResponse {
  success: boolean
  albums?: MusicBrainzAlbum[]
  error?: string
  query?: string
}

type SearchResultType = 'artist' | 'album' | 'song' | 'unknown'

interface SearchClassificationRequest {
  query: string
}

interface SearchClassificationResult {
  type: SearchResultType
  name: string
  artist?: string
  albumId?: string
  score: number // Confidence (0-100)
}

interface SearchClassificationResponse {
  success: boolean
  results?: SearchClassificationResult[]
  bestMatch?: SearchClassificationResult
  error?: string
  query?: string
}

interface MusicBrainzArtist {
  id: string
  name: string
  type?: string // person, group, etc.
  score?: number
}

interface ArtistAlbumsRequest {
  artistId: string
  limit?: number
}

interface ArtistAlbumsResponse {
  success: boolean
  albums?: MusicBrainzAlbum[]
  artist?: MusicBrainzArtist
  error?: string
}
```

### Discography Search (`discography.types.ts`)

```typescript
interface DiscographyAlbumEntry {
  title: string
  year?: string
  rawText: string
  duration?: string
  releaseInfo?: string
}

interface PageContentScanResult {
  searchResult: SearchResult
  albumFound: boolean
  matchedAlbums: DiscographyAlbumEntry[]
  allAlbums: DiscographyAlbumEntry[]
  isDiscography: boolean
  pageTitle: string
  error?: string
}

interface DiscographySearchRequest {
  searchResults: SearchResult[]
  albumName: string
  artistName?: string
  maxConcurrent?: number
  pageTimeout?: number // ms
}

interface DiscographySearchResponse {
  success: boolean
  scanResults: PageContentScanResult[]
  matchedPages: PageContentScanResult[]
  totalScanned: number
  matchCount: number
  error?: string
}

// Progress update (M->R push via discography:search-progress)
interface DiscographySearchProgress {
  currentPage: number
  totalPages: number
  currentUrl: string
  message: string
}
```

### Torrent Operations (`torrent.types.ts`)

```typescript
// Torrent .torrent file download
type TorrentStatus = 'pending' | 'downloading' | 'completed' | 'failed'

interface TorrentDownloadRequest {
  torrentId: string // RuTracker topic/torrent ID
  pageUrl: string
  title?: string
  projectDirectory?: string // For saving download history
}

interface TorrentFile {
  id: string
  title: string
  filePath?: string // Local path (for .torrent files)
  magnetLink?: string // Magnet link alternative
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

interface TorrentDownloadResponse {
  success: boolean
  error?: string
  torrent?: TorrentFile
}

interface TorrentSettings {
  torrentsFolder: string
  autoOpen?: boolean
  keepHistory?: boolean
  preferMagnetLinks?: boolean
}

// Torrent collection (per-project saved torrents)
interface CollectedTorrent {
  id: string
  torrentId: string
  magnetLink: string
  title: string
  pageUrl: string
  addedAt: string // ISO timestamp
  metadata?: {
    size?: string
    sizeBytes?: number
    seeders?: number
    leechers?: number
    category?: string
  }
  projectId: string
}

interface TorrentCollectionFile {
  projectId: string
  projectName: string
  torrents: CollectedTorrent[]
  lastUpdated: string
}

interface TorrentCollectionResponse {
  success: boolean
  torrents?: CollectedTorrent[]
  error?: string
}

// Check for local .torrent file
interface CheckLocalTorrentRequest {
  torrentId: string
  projectDirectory: string
}

interface CheckLocalTorrentResponse {
  found: boolean
  filePath?: string
}
```

### WebTorrent Download Queue (`torrent.types.ts`)

```typescript
// Status lifecycle: queued -> downloading -> seeding/completed/error
//                   downloading <-> paused
//                   queued -> awaiting-file-selection -> downloading
type QueuedTorrentStatus =
  | 'queued'
  | 'downloading'
  | 'seeding'
  | 'paused'
  | 'completed'
  | 'error'
  | 'awaiting-file-selection'

interface TorrentContentFile {
  path: string
  name: string
  size: number // bytes
  downloaded: number // bytes
  progress: number // 0-100
  selected: boolean
}

interface QueuedTorrent {
  id: string // UUID
  projectId: string
  magnetUri: string
  infoHash: string
  name: string
  status: QueuedTorrentStatus
  progress: number // 0-100
  downloadSpeed: number // bytes/sec
  uploadSpeed: number // bytes/sec
  downloaded: number // bytes
  uploaded: number // bytes
  totalSize: number // bytes
  files: TorrentContentFile[]
  seeders: number
  leechers: number
  ratio: number
  addedAt: string // ISO
  startedAt?: string
  completedAt?: string
  downloadPath: string
  fromCollectedTorrentId?: string
  torrentFilePath?: string // .torrent file path if used
  error?: string
}

// Broadcast every 1s via webtorrent:progress
interface QueuedTorrentProgress {
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

interface AddTorrentRequest {
  magnetUri: string
  projectId: string
  name: string
  downloadPath: string
  fromCollectedTorrentId?: string
  torrentFilePath?: string
}

interface AddTorrentResponse {
  success: boolean
  torrent?: QueuedTorrent
  error?: string
}

interface SelectTorrentFilesRequest {
  id: string // QueuedTorrent.id
  selectedFileIndices: number[] // 0-based
}

interface SelectTorrentFilesResponse {
  success: boolean
  error?: string
}

interface WebTorrentSettings {
  maxConcurrentDownloads: number // 1-10, default 3
  seedAfterDownload: boolean // default false
  maxUploadSpeed: number // bytes/sec, 0 = unlimited
  maxDownloadSpeed: number // bytes/sec, 0 = unlimited
}

interface TorrentActivityLogEntry {
  id: string
  timestamp: string
  message: string
  type: 'info' | 'success' | 'error' | 'warning'
}
```

### Torrent Metadata (`torrentMetadata.types.ts`)

```typescript
interface TorrentMetadataRequest {
  pageUrl: string
}

interface TorrentMetadataResponse {
  success: boolean
  data?: ParsedAlbumData
  error?: string
}
```

### Duplicate Detection (`duplicateDetection.types.ts`)

```typescript
interface AudioFileEntry {
  normalizedName: string // Lowercase, no extension, no track number prefix
  originalName: string // Original file name with extension
}

interface DuplicateCheckRequest {
  projectDirectory: string
  titles: { id: string; title: string }[]
}

interface DuplicateMatch {
  resultId: string // Search result ID
  matchedFiles: string[] // Matched audio files in the project
  confidence: number // 0-100
}

interface DuplicateCheckResponse {
  success: boolean
  matches: DuplicateMatch[]
  indexedFileCount: number // Number of audio files indexed
  error?: string
}
```

### Audio Player (Zustand store, not in shared types)

```typescript
interface Track {
  filePath: string
  name: string
  duration?: number // seconds
}

interface AudioPlayerState {
  currentTrack: Track | null
  isPlaying: boolean
  currentTime: number // seconds
  duration: number // seconds
  volume: number // 0-1
  playlist: Track[]
  currentIndex: number // -1 if no playlist

  // Actions
  playTrack: (track: Track) => void
  playPlaylist: (tracks: Track[], startIndex?: number) => void
  play: () => void
  pause: () => void
  togglePlayPause: () => void
  seek: (time: number) => void
  setVolume: (volume: number) => void
  next: () => void
  previous: () => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  clearPlaylist: () => void
}
```

### Mixing (Component 3 - TBD)

> Mixing types will be defined when Component 3 implementation begins.
> Current placeholder: `MixTab.tsx` exists in the ProjectOverview page.
