// Project-related types

/**
 * Main project data structure
 */
export interface Project {
  id: string
  name: string
  description?: string
  createdAt: Date
  updatedAt: Date
  projectDirectory: string          // Root directory for project
  songs: Song[]                      // Array of songs in the mix
  mixMetadata: MixMetadata          // Metadata about the mix
  isActive: boolean                 // Whether project is currently open
}

/**
 * Song in a project
 */
export interface Song {
  id: string
  title: string
  artist?: string
  album?: string
  duration?: number                 // Duration in seconds
  format?: string                   // mp3, flac, wav, etc.
  bitrate?: number                  // Bitrate in kbps
  sampleRate?: number               // Sample rate in Hz
  fileSize?: number                 // File size in bytes
  downloadId?: string               // Reference to download (if from Component 2)
  externalFilePath?: string         // Path to external file (if not downloaded)
  localFilePath?: string            // Path in project assets/ directory
  addedAt: Date
  order: number                     // Order in the mix
  metadata?: AudioMetadata          // Extended audio metadata
}

/**
 * Mix metadata
 */
export interface MixMetadata {
  title?: string
  description?: string
  coverImagePath?: string           // Path to cover image in assets/covers/
  tags: string[]
  genre?: string
  estimatedDuration?: number        // Sum of all song durations
  createdBy?: string                // User who created the mix
}

/**
 * Audio metadata extracted from files
 */
export interface AudioMetadata {
  duration?: number                 // Duration in seconds
  format?: string                   // mp3, flac, wav, ogg, etc.
  bitrate?: number                  // Bitrate in kbps
  sampleRate?: number               // Sample rate in Hz
  fileSize?: number                 // File size in bytes
  artist?: string                   // Artist from ID3 tags
  title?: string                    // Title from ID3 tags
  album?: string                    // Album from ID3 tags
  year?: number                     // Release year
  genre?: string                    // Genre from ID3 tags
  trackNumber?: number              // Track number
  channels?: number                 // Number of audio channels
  codec?: string                    // Audio codec
}

/**
 * Recent project entry for welcome page
 */
export interface RecentProject {
  projectId: string
  projectName: string
  projectDirectory: string
  lastOpened: Date
  songCount: number
  coverImagePath?: string
}

/**
 * Project statistics
 */
export interface ProjectStats {
  totalSongs: number
  totalDuration: number             // Sum of all song durations in seconds
  totalSize: number                 // Total file size in bytes
  downloadedSongs: number           // Songs from Component 2
  externalSongs: number             // Songs from external files
  formatBreakdown: Record<string, number>  // Count by format (mp3: 5, flac: 3)
}

/**
 * Project lock information
 */
export interface ProjectLock {
  projectId: string
  lockedBy: {
    pid: number                     // Process ID
    hostname: string                // Machine name
  }
  lockedAt: Date
}

/**
 * Create project request
 */
export interface CreateProjectRequest {
  name: string
  location: string                  // Parent directory where project will be created
  description?: string
}

/**
 * Add song request
 */
export interface AddSongRequest {
  projectId: string
  title: string
  downloadId?: string               // If from Component 2
  externalFilePath?: string         // If external file
  order: number
  metadata?: Partial<AudioMetadata>
}

/**
 * Update song request
 */
export interface UpdateSongRequest {
  projectId: string
  songId: string
  updates: Partial<Omit<Song, 'id' | 'addedAt'>>
}

/**
 * Remove song request
 */
export interface RemoveSongRequest {
  projectId: string
  songId: string
}

/**
 * Update mix metadata request
 */
export interface UpdateMixMetadataRequest {
  projectId: string
  metadata: Partial<MixMetadata>
}

/**
 * Open project request
 */
export interface OpenProjectRequest {
  filePath: string
}

/**
 * Save project request
 */
export interface SaveProjectRequest {
  project: Project
}

/**
 * Remove from recent request
 */
export interface RemoveFromRecentRequest {
  filePath: string
}

/**
 * Get project info request
 */
export interface GetProjectInfoRequest {
  projectId: string
}

/**
 * Get project stats request
 */
export interface GetProjectStatsRequest {
  projectId: string
}

/**
 * Validate project request
 */
export interface ValidateProjectRequest {
  filePath: string
}

/**
 * Select audio file request
 */
export interface SelectAudioFileRequest {
  filters?: { name: string; extensions: string[] }[]
}

/**
 * Get audio metadata request
 */
export interface GetAudioMetadataRequest {
  filePath: string
}

/**
 * Export project request
 */
export interface ExportProjectRequest {
  projectId: string
  targetPath: string
}

/**
 * Import project request
 */
export interface ImportProjectRequest {
  sourcePath: string
}

/**
 * Duplicate project request
 */
export interface DuplicateProjectRequest {
  projectId: string
  newName: string
}

/**
 * Select file response
 */
export interface SelectFileResponse {
  filePath: string
  cancelled: boolean
}

/**
 * Legacy project metadata (for backward compatibility)
 */
export interface ProjectMetadata {
  totalSearches: number
  totalDownloads: number
  totalFiles: number
  lastOpened: Date
}
