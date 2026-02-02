# Project System Architecture

**Version**: 1.0
**Last Updated**: 2026-02-02
**Status**: Design Complete - Ready for Implementation

---

## Table of Contents

1. [Overview](#1-overview)
2. [Data Models](#2-data-models)
3. [File System Architecture](#3-file-system-architecture)
4. [IPC Communication](#4-ipc-communication)
5. [Service Layer](#5-service-layer)
6. [UI Components](#6-ui-components)
7. [State Management](#7-state-management)
8. [Project Lifecycle](#8-project-lifecycle)
9. [Security & Validation](#9-security--validation)
10. [Error Handling](#10-error-handling)
11. [Testing Strategy](#11-testing-strategy)
12. [Implementation Roadmap](#12-implementation-roadmap)
13. [Architecture Decisions](#13-architecture-decisions)

---

## 1. Overview

### Purpose

The Project System serves as the central organizing unit for the Music Production Suite, encapsulating all user work including:
- Search results from RuTracker
- Torrent downloads and status
- Downloaded audio files
- User's song/tracklist
- Mix metadata and cover art
- Mixing sessions

### Key Features

- **Create/Open/Save Projects**: Full project lifecycle management
- **Recent Projects**: Quick access to recently opened projects
- **External File Support**: Add audio files from anywhere on the system
- **Project Locking**: Prevent simultaneous access to same project
- **Auto-Save**: Configurable automatic saving
- **Mix Metadata**: Title, artist, genre, description, cover image, tags
- **Songs List**: User-curated tracklist with ordering
- **Global Torrent Integration**: Projects reference global torrent manager

### Design Principles

1. **Single Project Active**: Only one project open at a time (simplifies state)
2. **JSON Storage**: Human-readable, debuggable, version-controllable
3. **User-Controlled Location**: Users choose where projects are saved
4. **Asset Organization**: Structured folder for project assets
5. **Manual Backup**: Users explicitly export/duplicate when needed
6. **Cross-Platform**: Windows and macOS support

---

## 2. Data Models

### Core Interfaces

```typescript
// ==========================================
// PROJECT
// ==========================================

export interface Project {
  // Identity
  id: string                    // UUID v4
  name: string                  // User-defined project name
  description?: string          // Optional project description
  version: string              // Project format version (e.g., "1.0")

  // Timestamps
  createdAt: Date
  updatedAt: Date
  lastOpenedAt?: Date

  // File system
  filePath: string             // Absolute path to project.json
  projectDirectory: string     // Directory containing project files

  // Mix metadata
  mixMetadata?: MixMetadata

  // Component 1: Search results
  searchResults: SearchResult[]
  searchHistory: SearchQuery[]

  // Component 2: Torrent downloads
  downloadQueue: TorrentDownload[]
  downloadedFiles: AudioFile[]
  downloadSettings: DownloadSettings

  // User's song/tracklist
  songs: Song[]

  // Component 3: Mixing sessions (TBD)
  mixingSessions?: MixingSession[]

  // Project configuration
  settings: ProjectSettings
  metadata: ProjectMetadata
}

// ==========================================
// SONG (User's Tracklist)
// ==========================================

export interface Song {
  id: string                    // UUID v4
  title: string                 // Song title
  artist?: string               // Artist name
  duration?: number             // Duration in seconds

  // File reference (one of these will be set)
  audioFileId?: string          // Link to downloaded AudioFile
  externalFilePath?: string     // Absolute path to external audio file

  // Metadata (especially for external files)
  format?: string               // mp3, flac, wav, etc.
  bitrate?: number              // kbps
  sampleRate?: number           // Hz
  fileSize?: number             // bytes

  // Organization
  order: number                 // Position in tracklist (0-indexed)
  addedAt: Date
  notes?: string                // User notes about the song
  tags?: string[]               // User-defined tags
}

// ==========================================
// MIX METADATA
// ==========================================

export interface MixMetadata {
  title?: string                // Mix title (e.g., "Summer Vibes 2026")
  artist?: string               // DJ/Mixer name
  genre?: string                // Musical genre
  description?: string          // Mix description
  duration?: number             // Total mix duration in seconds
  bpm?: number                  // Average/target BPM

  // Cover art
  coverImage?: string           // Relative path to cover image (e.g., "assets/covers/mix-cover.jpg")
  coverImageThumb?: string      // Relative path to thumbnail

  // Metadata
  createdAt?: Date
  tags: string[]                // Genre tags, mood tags, etc.

  // Social
  url?: string                  // SoundCloud, MixCloud, etc.
  isPublic?: boolean            // Is mix publicly shared
}

// ==========================================
// PROJECT SETTINGS
// ==========================================

export interface ProjectSettings {
  // Downloads
  downloadPath: string          // Where to download files for this project
  maxConcurrentDownloads: number
  seedRatio: number             // Auto-stop seeding after this ratio

  // Project
  projectDirectory: string      // Base directory for project
  autoSaveInterval: number      // Auto-save every N seconds (0 = disabled)

  // Mixer (TBD)
  autoAddToMixer: boolean       // Auto-add downloaded files to mixer
}

// ==========================================
// PROJECT METADATA
// ==========================================

export interface ProjectMetadata {
  // Statistics
  totalSearches: number
  totalDownloads: number
  totalFiles: number
  totalMixes?: number

  // Organization
  tags: string[]                // Project tags
  genre?: string                // Primary genre
  color?: string                // UI color for project

  // Timestamps
  lastSavedAt?: Date
}

// ==========================================
// RECENT PROJECTS
// ==========================================

export interface RecentProject {
  filePath: string              // Absolute path to project.json
  name: string                  // Project name
  lastOpenedAt: Date
  previewImage?: string         // Absolute path to cover thumbnail
  metadata?: {                  // Quick preview metadata
    songsCount: number
    downloadsCount: number
    genre?: string
  }
}

// ==========================================
// AUDIO METADATA
// ==========================================

export interface AudioMetadata {
  duration?: number             // Duration in seconds
  format?: string               // mp3, flac, wav, ogg, etc.
  bitrate?: number              // Bitrate in kbps
  sampleRate?: number           // Sample rate in Hz
  fileSize?: number             // File size in bytes
  artist?: string               // Artist from ID3 tags
  title?: string                // Title from ID3 tags
  album?: string                // Album from ID3 tags
  year?: number                 // Release year
  genre?: string                // Genre from ID3 tags
  trackNumber?: number          // Track number
  channels?: number             // Number of audio channels (1=mono, 2=stereo)
  codec?: string                // Audio codec (e.g., "mp3", "aac", "flac")
}

// ==========================================
// PROJECT INFO (Lightweight)
// ==========================================

export interface ProjectInfo {
  id: string
  name: string
  description?: string
  createdAt: Date
  updatedAt: Date
  lastOpenedAt?: Date
  filePath: string

  // Statistics
  fileCount: number
  totalSize: number             // Total project size in bytes
  songsCount: number
  downloadsCount: number
}

// ==========================================
// PROJECT STATISTICS
// ==========================================

export interface ProjectStats {
  // Counts
  totalSongs: number
  totalSearchResults: number
  totalTorrents: number
  totalDownloadedFiles: number
  totalMixingSessions: number

  // Sizes
  projectSize: number           // Total size in bytes
  assetsSize: number
  downloadsSize: number

  // Durations
  totalAudioDuration: number    // Total duration of all audio files

  // Activity
  lastModified: Date
  daysActive: number            // Days since creation
}

// ==========================================
// PROJECT LOCK
// ==========================================

export interface ProjectLock {
  projectId: string
  lockedAt: Date
  lockedBy: {
    pid: number                 // Process ID
    hostname: string            // Machine hostname
    username: string            // OS username
  }
  appVersion: string
}

// ==========================================
// CREATE/UPDATE REQUESTS
// ==========================================

export interface CreateProjectRequest {
  name: string
  description?: string
  location: string              // Directory where project will be created
}

export interface UpdateProjectRequest {
  id: string
  updates: Partial<Project>
}

export interface AddSongRequest {
  projectId: string
  song: Omit<Song, 'id' | 'addedAt'>
}

export interface UpdateSongRequest {
  projectId: string
  songId: string
  updates: Partial<Song>
}

export interface ReorderSongsRequest {
  projectId: string
  songIds: string[]             // Ordered array of song IDs
}

export interface UpdateMixMetadataRequest {
  projectId: string
  metadata: Partial<MixMetadata>
}

export interface UploadCoverRequest {
  projectId: string
  sourceImagePath: string       // Path to user-selected image
}

export interface OpenProjectRequest {
  filePath: string
}

export interface SaveProjectRequest {
  project: Project
}

export interface RemoveSongRequest {
  projectId: string
  songId: string
}

export interface RemoveFromRecentRequest {
  filePath: string
}

export interface GetProjectInfoRequest {
  projectId: string
}

export interface GetProjectStatsRequest {
  projectId: string
}

export interface ValidateProjectRequest {
  filePath: string
}

export interface SelectAudioFileRequest {
  filters?: { name: string; extensions: string[] }[]
}

export interface GetAudioMetadataRequest {
  filePath: string
}

export interface ExportProjectRequest {
  projectId: string
  targetPath: string
}

export interface ImportProjectRequest {
  sourcePath: string
}

export interface DuplicateProjectRequest {
  projectId: string
  newName: string
}

// ==========================================
// RESPONSES
// ==========================================

export interface SaveProjectResponse {
  success: boolean
  savedAt: Date
  error?: string
}

export interface SelectLocationResponse {
  path: string
  cancelled: boolean
}

export interface UploadCoverResponse {
  coverPath: string             // Relative path to cover image
  thumbPath: string             // Relative path to thumbnail
}

export interface SelectFileResponse {
  filePath: string
  cancelled: boolean
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationError {
  field: string
  message: string
  code: string
}

export interface ValidationWarning {
  field: string
  message: string
}
```

### Zod Schemas

```typescript
// src/shared/schemas/project.schema.ts

import { z } from 'zod'

export const CreateProjectSchema = z.object({
  name: z.string()
    .min(1, 'Project name is required')
    .max(100, 'Project name too long')
    .refine(val => !/[<>:"/\\|?*]/.test(val), 'Invalid characters in project name'),
  description: z.string().max(500).optional(),
  location: z.string().min(1, 'Location is required'),
})

export const SongSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  artist: z.string().max(200).optional(),
  duration: z.number().positive().optional(),
  audioFileId: z.string().uuid().optional(),
  externalFilePath: z.string().optional(),
  format: z.string().optional(),
  bitrate: z.number().positive().optional(),
  sampleRate: z.number().positive().optional(),
  fileSize: z.number().nonnegative().optional(),
  order: z.number().nonnegative(),
  addedAt: z.date(),
  notes: z.string().max(1000).optional(),
  tags: z.array(z.string()).optional(),
}).refine(
  data => data.audioFileId || data.externalFilePath,
  'Either audioFileId or externalFilePath must be provided'
)

export const MixMetadataSchema = z.object({
  title: z.string().max(200).optional(),
  artist: z.string().max(200).optional(),
  genre: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  duration: z.number().positive().optional(),
  bpm: z.number().positive().max(300).optional(),
  coverImage: z.string().optional(),
  coverImageThumb: z.string().optional(),
  createdAt: z.date().optional(),
  tags: z.array(z.string().max(50)).max(20),
  url: z.string().url().optional(),
  isPublic: z.boolean().optional(),
})

export const ProjectSettingsSchema = z.object({
  downloadPath: z.string().min(1),
  maxConcurrentDownloads: z.number().int().min(1).max(10),
  seedRatio: z.number().nonnegative().max(10),
  projectDirectory: z.string().min(1),
  autoSaveInterval: z.number().int().nonnegative().max(600),
  autoAddToMixer: z.boolean(),
})

export const UpdateMixMetadataRequestSchema = z.object({
  projectId: z.string().uuid(),
  metadata: MixMetadataSchema.partial(),
})

export const AddSongRequestSchema = z.object({
  projectId: z.string().uuid(),
  song: SongSchema.omit({ id: true, addedAt: true }),
})

export const ReorderSongsRequestSchema = z.object({
  projectId: z.string().uuid(),
  songIds: z.array(z.string().uuid()).min(1),
})
```

---

## 3. File System Architecture

### Directory Structure

```
User-Selected-Location/
└── MyMixProject/
    ├── project.json              # Main project file
    ├── .project.lock             # Lock file (present when project is open)
    ├── assets/                   # Project-specific assets
    │   ├── covers/               # Mix cover images
    │   │   ├── original/         # Original uploaded images
    │   │   │   └── cover.jpg
    │   │   └── thumbs/           # Generated thumbnails
    │   │       └── cover-thumb.jpg
    │   └── cache/                # Cached data (waveforms, etc.)
    └── downloads/                # Default download location
        └── [torrent-files]
```

### Project File Format

**project.json**:

```json
{
  "version": "1.0",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Summer House Mix 2026",
  "description": "Progressive house compilation for summer",
  "createdAt": "2026-02-02T10:30:00.000Z",
  "updatedAt": "2026-02-02T15:45:00.000Z",
  "lastOpenedAt": "2026-02-02T15:30:00.000Z",
  "filePath": "/Users/name/MusicProjects/MyMixProject/project.json",  // macOS/Linux
  // Windows: "C:\\Users\\name\\MusicProjects\\MyMixProject\\project.json"
  "projectDirectory": "/Users/name/MusicProjects/MyMixProject",  // macOS/Linux
  // Windows: "C:\\Users\\name\\MusicProjects\\MyMixProject"

  "mixMetadata": {
    "title": "Summer Vibes",
    "artist": "DJ Name",
    "genre": "Progressive House",
    "description": "A journey through progressive house...",
    "duration": 3600,
    "bpm": 126,
    "coverImage": "assets/covers/original/cover.jpg",
    "coverImageThumb": "assets/covers/thumbs/cover-thumb.jpg",
    "createdAt": "2026-02-02T10:30:00.000Z",
    "tags": ["house", "progressive", "summer", "2026"],
    "isPublic": false
  },

  "songs": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "title": "Track One",
      "artist": "Artist Name",
      "duration": 420,
      "audioFileId": "770e8400-e29b-41d4-a716-446655440002",
      "format": "mp3",
      "bitrate": 320,
      "sampleRate": 44100,
      "fileSize": 10485760,
      "order": 0,
      "addedAt": "2026-02-02T11:00:00.000Z",
      "notes": "Great intro track",
      "tags": ["intro", "melodic"]
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440003",
      "title": "External Track",
      "artist": "External Artist",
      "duration": 380,
      "externalFilePath": "/Users/name/Music/my-track.flac",
      "format": "flac",
      "bitrate": 1411,
      "sampleRate": 44100,
      "fileSize": 25165824,
      "order": 1,
      "addedAt": "2026-02-02T12:00:00.000Z"
    }
  ],

  "searchResults": [],
  "searchHistory": [],
  "downloadQueue": [],
  "downloadedFiles": [],

  "downloadSettings": {
    "maxConcurrentDownloads": 3,
    "defaultDownloadPath": "/Users/name/MusicProjects/MyMixProject/downloads",
    "seedAfterDownload": true,
    "maxUploadSpeed": 0,
    "maxDownloadSpeed": 0
  },

  "settings": {
    "downloadPath": "/Users/name/MusicProjects/MyMixProject/downloads",
    "projectDirectory": "/Users/name/MusicProjects/MyMixProject",
    "autoSaveInterval": 30,
    "maxConcurrentDownloads": 3,
    "seedRatio": 1.0,
    "autoAddToMixer": false
  },

  "metadata": {
    "totalSearches": 5,
    "totalDownloads": 12,
    "totalFiles": 12,
    "tags": ["house", "mix-project"],
    "genre": "Progressive House",
    "color": "#FF6B6B",
    "lastSavedAt": "2026-02-02T15:45:00.000Z"
  }
}
```

### Lock File Format

**.project.lock**:

```json
{
  "projectId": "550e8400-e29b-41d4-a716-446655440000",
  "lockedAt": "2026-02-02T15:30:00.000Z",
  "lockedBy": {
    "pid": 12345,
    "hostname": "macbook-pro.local",
    "username": "username"
  },
  "appVersion": "1.0.0"
}
```

### Application Config

**app-config.json** (stored in userData):

```json
{
  "recentProjects": [
    {
      "filePath": "/Users/name/MusicProjects/MyMixProject/project.json",
      "name": "Summer House Mix 2026",
      "lastOpenedAt": "2026-02-02T15:30:00.000Z",
      "previewImage": "/Users/name/MusicProjects/MyMixProject/assets/covers/thumbs/cover-thumb.jpg",
      "metadata": {
        "songsCount": 12,
        "downloadsCount": 8,
        "genre": "Progressive House"
      }
    }
  ],
  "maxRecentProjects": 10,
  "defaultProjectLocation": "/Users/name/MusicProjects"
}
```

### File Operations

**Path Handling**:
- Always use `path.resolve()` and `path.normalize()`
- Store absolute paths in project files
- Use relative paths for assets within project directory
- Handle cross-platform path differences (Windows/macOS)

**Cross-Platform Path Examples**:
```typescript
// Windows paths
const windowsProjectPath = 'C:\\Users\\Username\\MusicProjects\\MyMixProject\\project.json'
const windowsDownloadPath = 'C:\\Users\\Username\\MusicProjects\\MyMixProject\\downloads'
const windowsExternalFile = 'D:\\Music\\my-track.mp3'

// macOS/Linux paths
const macProjectPath = '/Users/username/MusicProjects/MyMixProject/project.json'
const macDownloadPath = '/Users/username/MusicProjects/MyMixProject/downloads'
const macExternalFile = '/Users/username/Music/my-track.mp3'

// Use Node.js path module for cross-platform compatibility
import path from 'path'

const projectPath = path.join(userSelectedLocation, projectName, 'project.json')
// Windows: C:\Users\Username\MusicProjects\MyProject\project.json
// macOS: /Users/username/MusicProjects/MyProject/project.json

const assetPath = path.join(projectDirectory, 'assets', 'covers', 'cover.jpg')
// Works on both platforms
```

**Directory Creation**:
```typescript
const projectDir = path.join(location, sanitizeFileName(name))
await fs.mkdir(projectDir, { recursive: true })
await fs.mkdir(path.join(projectDir, 'assets', 'covers', 'original'), { recursive: true })
await fs.mkdir(path.join(projectDir, 'assets', 'covers', 'thumbs'), { recursive: true })
await fs.mkdir(path.join(projectDir, 'assets', 'cache'), { recursive: true })
await fs.mkdir(path.join(projectDir, 'downloads'), { recursive: true })
```

**JSON Serialization**:
```typescript
// Dates must be converted to ISO strings
const serializeProject = (project: Project): string => {
  const serializable = {
    ...project,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    lastOpenedAt: project.lastOpenedAt?.toISOString(),
    songs: project.songs.map(song => ({
      ...song,
      addedAt: song.addedAt.toISOString(),
    })),
    // ... convert all Date fields
  }
  return JSON.stringify(serializable, null, 2)
}

const deserializeProject = (json: string): Project => {
  const parsed = JSON.parse(json)
  return {
    ...parsed,
    createdAt: new Date(parsed.createdAt),
    updatedAt: new Date(parsed.updatedAt),
    lastOpenedAt: parsed.lastOpenedAt ? new Date(parsed.lastOpenedAt) : undefined,
    songs: parsed.songs.map(song => ({
      ...song,
      addedAt: new Date(song.addedAt),
    })),
    // ... convert all Date fields
  }
}
```

---

## 4. IPC Communication

### Channel Definitions

| Channel | Direction | Purpose | Request Type | Response Type |
|---------|-----------|---------|--------------|---------------|
| **Project Lifecycle** |
| `project:create` | R→M | Create new project | `CreateProjectRequest` | `Project` |
| `project:open` | R→M | Open existing project | `{ filePath: string }` | `Project` |
| `project:save` | R→M | Save current project | `{ project: Project }` | `SaveProjectResponse` |
| `project:close` | R→M | Close current project | `void` | `void` |
| `project:select-location` | R→M | Show folder picker | `void` | `SelectLocationResponse` |
| `project:auto-save` | M→R | Project auto-saved | `{ timestamp: Date }` | - |
| **Recent Projects** |
| `project:list-recent` | R→M | Get recent projects | `void` | `RecentProject[]` |
| `project:remove-recent` | R→M | Remove from recent | `{ filePath: string }` | `void` |
| `project:clear-recent` | R→M | Clear all recent | `void` | `void` |
| **Project Info** |
| `project:get-info` | R→M | Get project info | `{ projectId: string }` | `ProjectInfo` |
| `project:get-stats` | R→M | Get project stats | `{ projectId: string }` | `ProjectStats` |
| `project:validate` | R→M | Validate project | `{ filePath: string }` | `ValidationResult` |
| **Songs Management** |
| `project:add-song` | R→M | Add song to project | `AddSongRequest` | `Song` |
| `project:update-song` | R→M | Update song | `UpdateSongRequest` | `Song` |
| `project:remove-song` | R→M | Remove song | `{ projectId: string, songId: string }` | `void` |
| `project:reorder-songs` | R→M | Reorder songs | `ReorderSongsRequest` | `void` |
| `project:select-audio-file` | R→M | Show file picker for audio | `void` | `{ filePath: string, cancelled: boolean }` |
| `project:get-audio-metadata` | R→M | Extract audio metadata | `{ filePath: string }` | `AudioMetadata` |
| **Mix Metadata** |
| `project:update-mix-metadata` | R→M | Update mix metadata | `UpdateMixMetadataRequest` | `MixMetadata` |
| `project:upload-cover` | R→M | Upload cover image | `UploadCoverRequest` | `UploadCoverResponse` |
| `project:select-cover-image` | R→M | Show image picker | `void` | `{ filePath: string, cancelled: boolean }` |
| **Import/Export** |
| `project:export` | R→M | Export project | `{ projectId: string, targetPath: string }` | `string` |
| `project:import` | R→M | Import project | `{ sourcePath: string }` | `Project` |
| `project:duplicate` | R→M | Duplicate project | `{ projectId: string, newName: string }` | `Project` |

### IPC Implementation Examples

```typescript
// src/main/ipc/project-handlers.ts

import { ipcMain, dialog } from 'electron'
import { projectService } from '../services/project.service'
import { CreateProjectSchema, AddSongRequestSchema } from '../../shared/schemas/project.schema'

export function registerProjectHandlers() {
  // Create project
  ipcMain.handle('project:create', async (event, request: CreateProjectRequest) => {
    const validated = CreateProjectSchema.parse(request)
    return await projectService.createProject(
      validated.name,
      validated.location,
      validated.description
    )
  })

  // Open project
  ipcMain.handle('project:open', async (event, request: OpenProjectRequest) => {
    if (!request.filePath || typeof request.filePath !== 'string') {
      throw new Error('Invalid file path')
    }
    return await projectService.openProject(request.filePath)
  })

  // Save project
  ipcMain.handle('project:save', async (event, request: SaveProjectRequest) => {
    if (!request.project || !request.project.id) {
      throw new Error('Invalid project')
    }
    await projectService.saveProject(request.project)
    return { success: true, savedAt: new Date() }
  })

  // Close project
  ipcMain.handle('project:close', async () => {
    await projectService.closeProject()
  })

  // Select location (folder picker)
  ipcMain.handle('project:select-location', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Project Location',
    })
    return {
      path: result.filePaths[0] || '',
      cancelled: result.canceled,
    }
  })

  // List recent projects
  ipcMain.handle('project:list-recent', async () => {
    return await projectService.getRecentProjects()
  })

  // Add song
  ipcMain.handle('project:add-song', async (event, request: AddSongRequest) => {
    const validated = AddSongRequestSchema.parse(request)
    return await projectService.addSong(validated.projectId, validated.song)
  })

  // Update mix metadata
  ipcMain.handle('project:update-mix-metadata', async (event, request: UpdateMixMetadataRequest) => {
    return await projectService.updateMixMetadata(
      request.projectId,
      request.metadata
    )
  })

  // Upload cover image
  ipcMain.handle('project:upload-cover', async (event, request: UploadCoverRequest) => {
    return await projectService.uploadCoverImage(
      request.projectId,
      request.sourceImagePath
    )
  })

  // Select audio file
  ipcMain.handle('project:select-audio-file', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      title: 'Select Audio File',
      filters: [
        { name: 'Audio Files', extensions: ['mp3', 'flac', 'wav', 'ogg', 'aac', 'm4a', 'wma'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })
    return {
      filePath: result.filePaths[0] || '',
      cancelled: result.canceled,
    }
  })

  // Select cover image
  ipcMain.handle('project:select-cover-image', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      title: 'Select Cover Image',
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })
    return {
      filePath: result.filePaths[0] || '',
      cancelled: result.canceled,
    }
  })
}
```

```typescript
// src/preload/index.ts

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  project: {
    // Lifecycle
    create: (request: CreateProjectRequest) =>
      ipcRenderer.invoke('project:create', request),
    open: (filePath: string) =>
      ipcRenderer.invoke('project:open', { filePath }),
    save: (project: Project) =>
      ipcRenderer.invoke('project:save', { project }),
    close: () =>
      ipcRenderer.invoke('project:close'),
    selectLocation: () =>
      ipcRenderer.invoke('project:select-location'),

    // Recent projects
    listRecent: () =>
      ipcRenderer.invoke('project:list-recent'),
    removeRecent: (filePath: string) =>
      ipcRenderer.invoke('project:remove-recent', { filePath }),

    // Songs
    addSong: (request: AddSongRequest) =>
      ipcRenderer.invoke('project:add-song', request),
    updateSong: (request: UpdateSongRequest) =>
      ipcRenderer.invoke('project:update-song', request),
    removeSong: (projectId: string, songId: string) =>
      ipcRenderer.invoke('project:remove-song', { projectId, songId }),
    reorderSongs: (request: ReorderSongsRequest) =>
      ipcRenderer.invoke('project:reorder-songs', request),
    selectAudioFile: () =>
      ipcRenderer.invoke('project:select-audio-file'),

    // Mix metadata
    updateMixMetadata: (request: UpdateMixMetadataRequest) =>
      ipcRenderer.invoke('project:update-mix-metadata', request),
    uploadCover: (request: UploadCoverRequest) =>
      ipcRenderer.invoke('project:upload-cover', request),
    selectCoverImage: () =>
      ipcRenderer.invoke('project:select-cover-image'),

    // Listeners
    onAutoSave: (callback: (data: { timestamp: Date }) => void) => {
      ipcRenderer.on('project:auto-save', (_, data) => callback(data))
    },
  },
})
```

---

## 5. Service Layer

### ProjectService

**Location**: `src/main/services/project.service.ts`

```typescript
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import { BrowserWindow } from 'electron'
import { Project, Song, MixMetadata, RecentProject, ProjectStats } from '../../shared/types/project.types'
import { FileSystemService } from './filesystem.service'
import { ConfigService } from './config.service'
import { LockService } from './lock.service'
import { AudioMetadataService } from './audio-metadata.service'
import { ImageService } from './image.service'

export class ProjectService {
  private currentProject: Project | null = null
  private autoSaveTimer?: NodeJS.Timeout

  constructor(
    private fsService: FileSystemService,
    private configService: ConfigService,
    private lockService: LockService,
    private audioMetadataService: AudioMetadataService,
    private imageService: ImageService
  ) {}

  // ==========================================
  // PROJECT LIFECYCLE
  // ==========================================

  async createProject(
    name: string,
    location: string,
    description?: string
  ): Promise<Project> {
    // Validate location
    await this.fsService.validateDirectory(location)

    // Create project directory structure
    const projectDir = await this.fsService.createProjectDirectory(location, name)
    const projectFilePath = path.join(projectDir, 'project.json')

    // Initialize project
    const project: Project = {
      id: uuidv4(),
      name,
      description,
      version: '1.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      filePath: projectFilePath,
      projectDirectory: projectDir,

      songs: [],
      searchResults: [],
      searchHistory: [],
      downloadQueue: [],
      downloadedFiles: [],

      downloadSettings: {
        maxConcurrentDownloads: 3,
        defaultDownloadPath: path.join(projectDir, 'downloads'),
        seedAfterDownload: true,
        maxUploadSpeed: 0,
        maxDownloadSpeed: 0,
      },

      settings: {
        downloadPath: path.join(projectDir, 'downloads'),
        projectDirectory: projectDir,
        autoSaveInterval: 30,
        maxConcurrentDownloads: 3,
        seedRatio: 1.0,
        autoAddToMixer: false,
      },

      metadata: {
        totalSearches: 0,
        totalDownloads: 0,
        totalFiles: 0,
        tags: [],
      },

      mixMetadata: {
        tags: [],
      },
    }

    // Save project file
    await this.fsService.writeProjectFile(project)

    // Set as current project
    this.currentProject = project

    // Create lock file
    await this.lockService.createLock(project)

    // Add to recent projects
    await this.addToRecent(project)

    // Enable auto-save if configured
    if (project.settings.autoSaveInterval > 0) {
      this.enableAutoSave(project.settings.autoSaveInterval)
    }

    return project
  }

  async openProject(filePath: string): Promise<Project> {
    // Validate file exists
    await this.fsService.validateFile(filePath)

    // Check for lock
    const lockInfo = await this.lockService.checkLock(filePath)
    if (lockInfo) {
      // Check if lock is stale
      const isStale = await this.lockService.isLockStale(lockInfo)
      if (!isStale) {
        throw new Error(
          `Project is already open on ${lockInfo.lockedBy.hostname} by ${lockInfo.lockedBy.username}`
        )
      }
      // Remove stale lock
      await this.lockService.removeLock(filePath)
    }

    // Load project
    const project = await this.fsService.readProjectFile(filePath)

    // Validate project
    const validation = await this.validateProject(project)
    if (!validation.valid) {
      throw new Error(`Project validation failed: ${validation.errors[0].message}`)
    }

    // Update lastOpenedAt
    project.lastOpenedAt = new Date()

    // Set as current project
    this.currentProject = project

    // Create lock file
    await this.lockService.createLock(project)

    // Add to recent projects
    await this.addToRecent(project)

    // Save updated lastOpenedAt
    await this.saveProject(project)

    // Enable auto-save if configured
    if (project.settings.autoSaveInterval > 0) {
      this.enableAutoSave(project.settings.autoSaveInterval)
    }

    return project
  }

  async saveProject(project: Project): Promise<void> {
    if (!project) {
      throw new Error('No project to save')
    }

    // Update timestamp
    project.updatedAt = new Date()
    project.metadata.lastSavedAt = new Date()

    // Write to file
    await this.fsService.writeProjectFile(project)

    // Update current project reference
    this.currentProject = project

    // Update recent projects
    await this.addToRecent(project)
  }

  async closeProject(): Promise<void> {
    if (!this.currentProject) {
      return
    }

    // Disable auto-save
    this.disableAutoSave()

    // Remove lock
    await this.lockService.removeLock(this.currentProject.filePath)

    // Clear current project
    this.currentProject = null
  }

  getCurrentProject(): Project | null {
    return this.currentProject
  }

  // ==========================================
  // RECENT PROJECTS
  // ==========================================

  async getRecentProjects(): Promise<RecentProject[]> {
    const recent = await this.configService.getRecentProjects()

    // Filter out non-existent projects
    const validated = []
    for (const project of recent) {
      try {
        await this.fsService.validateFile(project.filePath)
        validated.push(project)
      } catch {
        // File doesn't exist, skip
      }
    }

    // Save cleaned list
    if (validated.length !== recent.length) {
      await this.configService.saveRecentProjects(validated)
    }

    return validated
  }

  async addToRecent(project: Project): Promise<void> {
    const recent = await this.configService.getRecentProjects()

    // Remove if already in list
    const filtered = recent.filter(p => p.filePath !== project.filePath)

    // Create recent project entry
    const recentProject: RecentProject = {
      filePath: project.filePath,
      name: project.name,
      lastOpenedAt: project.lastOpenedAt || new Date(),
      previewImage: project.mixMetadata?.coverImageThumb
        ? path.resolve(project.projectDirectory, project.mixMetadata.coverImageThumb)
        : undefined,
      metadata: {
        songsCount: project.songs.length,
        downloadsCount: project.downloadedFiles.length,
        genre: project.mixMetadata?.genre,
      },
    }

    // Add to front
    filtered.unshift(recentProject)

    // Limit to max recent projects
    const maxRecent = await this.configService.getMaxRecentProjects()
    const limited = filtered.slice(0, maxRecent)

    // Save
    await this.configService.saveRecentProjects(limited)
  }

  async removeFromRecent(filePath: string): Promise<void> {
    const recent = await this.configService.getRecentProjects()
    const filtered = recent.filter(p => p.filePath !== filePath)
    await this.configService.saveRecentProjects(filtered)
  }

  async clearRecent(): Promise<void> {
    await this.configService.saveRecentProjects([])
  }

  // ==========================================
  // SONGS MANAGEMENT
  // ==========================================

  async addSong(projectId: string, song: Omit<Song, 'id' | 'addedAt'>): Promise<Song> {
    const project = await this.ensureProjectLoaded(projectId)

    // Validate external file if provided
    if (song.externalFilePath) {
      await this.fsService.validateFile(song.externalFilePath)

      // Extract metadata if not provided
      if (!song.format || !song.duration) {
        const metadata = await this.audioMetadataService.extractMetadata(song.externalFilePath)
        song.format = song.format || metadata.format
        song.duration = song.duration || metadata.duration
        song.bitrate = song.bitrate || metadata.bitrate
        song.sampleRate = song.sampleRate || metadata.sampleRate
        song.fileSize = song.fileSize || metadata.fileSize
      }
    }

    // Create song
    const newSong: Song = {
      ...song,
      id: uuidv4(),
      addedAt: new Date(),
      order: project.songs.length, // Add to end
    }

    // Add to project
    project.songs.push(newSong)

    // Save
    await this.saveProject(project)

    return newSong
  }

  async updateSong(projectId: string, songId: string, updates: Partial<Song>): Promise<Song> {
    const project = await this.ensureProjectLoaded(projectId)

    const song = project.songs.find(s => s.id === songId)
    if (!song) {
      throw new Error('Song not found')
    }

    // Apply updates
    Object.assign(song, updates)

    // Save
    await this.saveProject(project)

    return song
  }

  async removeSong(projectId: string, songId: string): Promise<void> {
    const project = await this.ensureProjectLoaded(projectId)

    const index = project.songs.findIndex(s => s.id === songId)
    if (index === -1) {
      throw new Error('Song not found')
    }

    // Remove
    project.songs.splice(index, 1)

    // Re-order remaining songs
    project.songs.forEach((song, idx) => {
      song.order = idx
    })

    // Save
    await this.saveProject(project)
  }

  async reorderSongs(projectId: string, songIds: string[]): Promise<void> {
    const project = await this.ensureProjectLoaded(projectId)

    // Validate all song IDs exist
    const songsMap = new Map(project.songs.map(s => [s.id, s]))
    for (const id of songIds) {
      if (!songsMap.has(id)) {
        throw new Error(`Song not found: ${id}`)
      }
    }

    // Reorder
    const reordered = songIds.map((id, idx) => {
      const song = songsMap.get(id)!
      song.order = idx
      return song
    })

    project.songs = reordered

    // Save
    await this.saveProject(project)
  }

  // ==========================================
  // MIX METADATA
  // ==========================================

  async updateMixMetadata(
    projectId: string,
    metadata: Partial<MixMetadata>
  ): Promise<MixMetadata> {
    const project = await this.ensureProjectLoaded(projectId)

    // Merge metadata
    project.mixMetadata = {
      ...project.mixMetadata,
      ...metadata,
    }

    // Save
    await this.saveProject(project)

    return project.mixMetadata
  }

  async uploadCoverImage(projectId: string, sourceImagePath: string): Promise<{ coverPath: string; thumbPath: string }> {
    const project = await this.ensureProjectLoaded(projectId)

    // Validate source image
    await this.fsService.validateFile(sourceImagePath)
    const imageInfo = await this.imageService.validateImage(sourceImagePath)
    if (!imageInfo.valid) {
      throw new Error('Invalid image file')
    }

    // Copy to project directory
    const coverPath = await this.fsService.copyAsset(
      sourceImagePath,
      project.projectDirectory,
      'cover'
    )

    // Generate thumbnail
    const thumbPath = await this.imageService.generateThumbnail(
      path.resolve(project.projectDirectory, coverPath),
      project.projectDirectory
    )

    // Update project metadata
    project.mixMetadata = project.mixMetadata || { tags: [] }
    project.mixMetadata.coverImage = coverPath
    project.mixMetadata.coverImageThumb = thumbPath

    // Save
    await this.saveProject(project)

    return { coverPath, thumbPath }
  }

  // ==========================================
  // AUTO-SAVE
  // ==========================================

  enableAutoSave(interval: number): void {
    this.disableAutoSave() // Clear existing timer

    if (interval <= 0) return

    this.autoSaveTimer = setInterval(async () => {
      if (this.currentProject) {
        try {
          await this.saveProject(this.currentProject)
          // Notify renderer
          const mainWindow = BrowserWindow.getAllWindows()[0]
          mainWindow?.webContents.send('project:auto-save', { timestamp: new Date() })
        } catch (error) {
          console.error('Auto-save failed:', error)
        }
      }
    }, interval * 1000)
  }

  disableAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer)
      this.autoSaveTimer = undefined
    }
  }

  // ==========================================
  // STATISTICS
  // ==========================================

  async getProjectStats(projectId: string): Promise<ProjectStats> {
    const project = await this.ensureProjectLoaded(projectId)

    const projectSize = await this.fsService.getDirectorySize(project.projectDirectory)
    const assetsSize = await this.fsService.getDirectorySize(
      path.join(project.projectDirectory, 'assets')
    )
    const downloadsSize = await this.fsService.getDirectorySize(
      project.settings.downloadPath
    )

    const totalAudioDuration = project.songs.reduce(
      (sum, song) => sum + (song.duration || 0),
      0
    )

    const daysActive = Math.floor(
      (Date.now() - project.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    )

    return {
      totalSongs: project.songs.length,
      totalSearchResults: project.searchResults.length,
      totalTorrents: project.downloadQueue.length,
      totalDownloadedFiles: project.downloadedFiles.length,
      totalMixingSessions: project.mixingSessions?.length || 0,
      projectSize,
      assetsSize,
      downloadsSize,
      totalAudioDuration,
      lastModified: project.updatedAt,
      daysActive,
    }
  }

  // ==========================================
  // VALIDATION
  // ==========================================

  async validateProject(project: Project): Promise<ValidationResult> {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // Check required fields
    if (!project.id) errors.push({ field: 'id', message: 'Project ID is missing', code: 'MISSING_ID' })
    if (!project.name) errors.push({ field: 'name', message: 'Project name is missing', code: 'MISSING_NAME' })
    if (!project.filePath) errors.push({ field: 'filePath', message: 'File path is missing', code: 'MISSING_PATH' })

    // Validate dates
    if (!(project.createdAt instanceof Date) || isNaN(project.createdAt.getTime())) {
      errors.push({ field: 'createdAt', message: 'Invalid creation date', code: 'INVALID_DATE' })
    }

    // Validate songs
    const songIds = new Set<string>()
    for (const song of project.songs) {
      if (songIds.has(song.id)) {
        errors.push({ field: 'songs', message: `Duplicate song ID: ${song.id}`, code: 'DUPLICATE_ID' })
      }
      songIds.add(song.id)

      if (!song.audioFileId && !song.externalFilePath) {
        errors.push({
          field: 'songs',
          message: `Song "${song.title}" has no file reference`,
          code: 'MISSING_FILE_REF'
        })
      }

      // Check external file exists
      if (song.externalFilePath) {
        try {
          await this.fsService.validateFile(song.externalFilePath)
        } catch {
          warnings.push({
            field: 'songs',
            message: `External file not found: ${song.externalFilePath}`,
          })
        }
      }
    }

    // Check project directory exists
    try {
      await this.fsService.validateDirectory(project.projectDirectory)
    } catch {
      errors.push({
        field: 'projectDirectory',
        message: 'Project directory not found',
        code: 'MISSING_DIR'
      })
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  // ==========================================
  // UTILITIES
  // ==========================================

  private async ensureProjectLoaded(projectId: string): Promise<Project> {
    if (!this.currentProject || this.currentProject.id !== projectId) {
      throw new Error('Project not loaded')
    }
    return this.currentProject
  }
}

// Singleton instance
export const projectService = new ProjectService(
  fsService,
  configService,
  lockService,
  audioMetadataService,
  imageService
)
```

### Supporting Services

**FileSystemService** (`src/main/services/filesystem.service.ts`):
- `createProjectDirectory(location, name): Promise<string>`
- `writeProjectFile(project): Promise<void>`
- `readProjectFile(filePath): Promise<Project>`
- `validateFile(filePath): Promise<void>`
- `validateDirectory(dirPath): Promise<void>`
- `copyAsset(source, projectDir, type): Promise<string>`
- `getDirectorySize(dirPath): Promise<number>`

**ConfigService** (`src/main/services/config.service.ts`):
- `getRecentProjects(): Promise<RecentProject[]>`
- `saveRecentProjects(projects): Promise<void>`
- `getMaxRecentProjects(): Promise<number>`
- `getDefaultProjectLocation(): Promise<string>`
- `setDefaultProjectLocation(path): Promise<void>`

**LockService** (`src/main/services/lock.service.ts`):
- `createLock(project): Promise<void>`
- `checkLock(filePath): Promise<ProjectLock | null>`
- `removeLock(filePath): Promise<void>`
- `isLockStale(lock): Promise<boolean>`

**AudioMetadataService** (`src/main/services/audio-metadata.service.ts`):
- `extractMetadata(filePath): Promise<AudioMetadata>`
- Uses `music-metadata` library

**ImageService** (`src/main/services/image.service.ts`):
- `validateImage(filePath): Promise<ImageInfo>`
- `generateThumbnail(sourcePath, projectDir): Promise<string>`
- Uses `sharp` library for image processing

---

## 6. UI Components

### Component Hierarchy

```
App
└── Router
    ├── WelcomePage
    │   ├── WelcomeHeader
    │   ├── RecentProjectsList
    │   │   └── ProjectCard (multiple)
    │   ├── EmptyState
    │   └── CreateProjectDialog
    │
    ├── Dashboard (when project is open)
    │   ├── ProjectHeader
    │   │   ├── ProjectInfo
    │   │   ├── AutoSaveIndicator
    │   │   └── ProjectMenu
    │   ├── Sidebar
    │   └── MainContent
    │       ├── SearchPage
    │       ├── DownloadsPage
    │       ├── LibraryPage
    │       ├── MixerPage
    │       └── SettingsPage
    │
    └── Modals/Dialogs
        ├── CreateProjectDialog
        ├── ProjectSettingsDialog
        ├── SongDetailsDialog
        ├── MixMetadataPanel
        └── UnsavedChangesDialog
```

### Key Component Specifications

#### WelcomePage
**Location**: `src/renderer/pages/Welcome/Welcome.tsx`

```typescript
export const WelcomePage: React.FC = () => {
  const { recentProjects, isLoading, loadRecentProjects, openProject, removeFromRecent } = useProjectStore()
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  useEffect(() => {
    loadRecentProjects()
  }, [])

  const handleOpenExisting = async () => {
    // This will be replaced with file picker
    const result = await window.api.project.selectLocation()
    if (!result.cancelled) {
      await openProject(result.path)
    }
  }

  return (
    <Box data-testid="welcome-page">
      <WelcomeHeader />

      {isLoading ? (
        <LoadingSpinner />
      ) : recentProjects.length > 0 ? (
        <RecentProjectsList
          projects={recentProjects}
          onOpen={openProject}
          onRemove={removeFromRecent}
        />
      ) : (
        <EmptyState
          onCreateNew={() => setShowCreateDialog(true)}
          onOpenExisting={handleOpenExisting}
        />
      )}

      <HStack spacing={4} mt={8}>
        <Button
          onClick={() => setShowCreateDialog(true)}
          colorScheme="blue"
          data-testid="create-project-button"
        >
          Create New Project
        </Button>
        <Button
          onClick={handleOpenExisting}
          variant="outline"
          data-testid="open-project-button"
        >
          Open Existing Project
        </Button>
      </HStack>

      {showCreateDialog && (
        <CreateProjectDialog
          isOpen={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
        />
      )}
    </Box>
  )
}
```

#### ProjectCard
**Location**: `src/renderer/pages/Welcome/components/ProjectCard.tsx`

```typescript
interface ProjectCardProps {
  project: RecentProject
  onOpen: (filePath: string) => Promise<void>
  onRemove: (filePath: string) => Promise<void>
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, onOpen, onRemove }) => {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <Card
      data-testid={`project-card-${project.name}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onOpen(project.filePath)}
      cursor="pointer"
      transition="all 0.2s"
      _hover={{ transform: 'translateY(-4px)', shadow: 'lg' }}
    >
      {/* Cover Image */}
      <Box position="relative" height="200px" bg="gray.100">
        {project.previewImage ? (
          <Image
            src={`file://${project.previewImage}`}
            alt={project.name}
            objectFit="cover"
            width="100%"
            height="100%"
          />
        ) : (
          <Center height="100%">
            <Icon as={MusicIcon} boxSize={16} color="gray.400" />
          </Center>
        )}

        {/* Quick Actions (visible on hover) */}
        {isHovered && (
          <HStack
            position="absolute"
            top={2}
            right={2}
            spacing={2}
          >
            <IconButton
              aria-label="Remove from recent"
              icon={<CloseIcon />}
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onRemove(project.filePath)
              }}
            />
          </HStack>
        )}
      </Box>

      <CardBody>
        <VStack align="start" spacing={2}>
          <Heading size="md">{project.name}</Heading>

          {project.metadata && (
            <HStack spacing={4} fontSize="sm" color="gray.600">
              <Text>{project.metadata.songsCount} songs</Text>
              <Text>{project.metadata.downloadsCount} downloads</Text>
              {project.metadata.genre && <Badge>{project.metadata.genre}</Badge>}
            </HStack>
          )}

          <Text fontSize="xs" color="gray.500">
            Last opened: {formatDistanceToNow(project.lastOpenedAt)} ago
          </Text>
        </VStack>
      </CardBody>
    </Card>
  )
}
```

#### CreateProjectDialog
**Location**: `src/renderer/components/features/ProjectManager/CreateProjectDialog.tsx`

```typescript
interface CreateProjectDialogProps {
  isOpen: boolean
  onClose: () => void
}

export const CreateProjectDialog: React.FC<CreateProjectDialogProps> = ({ isOpen, onClose }) => {
  const { createProject } = useProjectStore()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Load default location when dialog opens
    if (isOpen) {
      loadDefaultLocation()
    }
  }, [isOpen])

  const loadDefaultLocation = async () => {
    // Get default from config
    const defaultLoc = await window.api.project.getDefaultLocation()
    setLocation(defaultLoc)
  }

  const handleSelectLocation = async () => {
    const result = await window.api.project.selectLocation()
    if (!result.cancelled) {
      setLocation(result.path)
    }
  }

  const handleCreate = async () => {
    setError('')

    // Validate
    if (!name.trim()) {
      setError('Project name is required')
      return
    }
    if (!location) {
      setError('Project location is required')
      return
    }

    setIsCreating(true)
    try {
      await createProject(name.trim(), location, description.trim() || undefined)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to create project')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent data-testid="create-project-dialog">
        <ModalHeader>Create New Project</ModalHeader>
        <ModalCloseButton />

        <ModalBody>
          <VStack spacing={4}>
            {/* Name */}
            <FormControl isRequired>
              <FormLabel>Project Name</FormLabel>
              <Input
                data-testid="project-name-input"
                placeholder="My Mix Project"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </FormControl>

            {/* Description */}
            <FormControl>
              <FormLabel>Description</FormLabel>
              <Textarea
                data-testid="project-description-input"
                placeholder="Optional description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </FormControl>

            {/* Location */}
            <FormControl isRequired>
              <FormLabel>Location</FormLabel>
              <HStack>
                <Input
                  data-testid="project-location-input"
                  value={location}
                  readOnly
                  placeholder="Select location..."
                />
                <Button
                  onClick={handleSelectLocation}
                  data-testid="select-location-button"
                >
                  Browse
                </Button>
              </HStack>
            </FormControl>

            {/* Error */}
            {error && (
              <Alert status="error" data-testid="create-project-error">
                <AlertIcon />
                {error}
              </Alert>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" onClick={onClose} mr={3}>
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            onClick={handleCreate}
            isLoading={isCreating}
            data-testid="create-project-submit"
          >
            Create Project
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
```

#### ProjectHeader
**Location**: `src/renderer/components/features/ProjectManager/ProjectHeader.tsx`

```typescript
export const ProjectHeader: React.FC = () => {
  const { currentProject, saveProject, closeProject, lastSaved } = useProjectStore()
  const navigate = useNavigate()

  if (!currentProject) return null

  const handleClose = async () => {
    // Check for unsaved changes
    await closeProject()
    navigate('/welcome')
  }

  return (
    <HStack
      justify="space-between"
      p={4}
      borderBottom="1px"
      borderColor="gray.200"
      data-testid="project-header"
    >
      <HStack spacing={4}>
        {/* Project Icon/Cover */}
        {currentProject.mixMetadata?.coverImageThumb && (
          <Avatar
            src={`file://${path.resolve(currentProject.projectDirectory, currentProject.mixMetadata.coverImageThumb)}`}
            name={currentProject.name}
            size="sm"
          />
        )}

        {/* Project Name */}
        <VStack align="start" spacing={0}>
          <Heading size="md">{currentProject.name}</Heading>
          {currentProject.description && (
            <Text fontSize="sm" color="gray.600">{currentProject.description}</Text>
          )}
        </VStack>
      </HStack>

      <HStack spacing={4}>
        {/* Auto-save Indicator */}
        <AutoSaveIndicator lastSaved={lastSaved} />

        {/* Save Button */}
        <Button
          leftIcon={<SaveIcon />}
          onClick={() => saveProject()}
          size="sm"
          data-testid="save-project-button"
        >
          Save
        </Button>

        {/* Project Menu */}
        <Menu>
          <MenuButton
            as={IconButton}
            icon={<HamburgerIcon />}
            variant="ghost"
            size="sm"
            data-testid="project-menu-button"
          />
          <MenuList>
            <MenuItem onClick={handleClose}>Close Project</MenuItem>
            <MenuItem>Project Settings</MenuItem>
            <MenuItem>Export Project</MenuItem>
            <MenuItem>Duplicate Project</MenuItem>
          </MenuList>
        </Menu>
      </HStack>
    </HStack>
  )
}
```

#### SongsList
**Location**: `src/renderer/components/features/ProjectManager/SongsList.tsx`

```typescript
export const SongsList: React.FC = () => {
  const { currentProject, addSong, removeSong, reorderSongs } = useProjectStore()
  const [showAddDialog, setShowAddDialog] = useState(false)

  if (!currentProject) return null

  const songs = [...currentProject.songs].sort((a, b) => a.order - b.order)

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return

    const reordered = Array.from(songs)
    const [removed] = reordered.splice(result.source.index, 1)
    reordered.splice(result.destination.index, 0, removed)

    const songIds = reordered.map(s => s.id)
    reorderSongs(currentProject.id, songIds)
  }

  return (
    <Box data-testid="songs-list">
      <HStack justify="space-between" mb={4}>
        <Heading size="md">Songs ({songs.length})</Heading>
        <Button
          leftIcon={<AddIcon />}
          onClick={() => setShowAddDialog(true)}
          data-testid="add-song-button"
        >
          Add Song
        </Button>
      </HStack>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="songs">
          {(provided) => (
            <VStack
              {...provided.droppableProps}
              ref={provided.innerRef}
              spacing={2}
              align="stretch"
            >
              {songs.map((song, index) => (
                <Draggable key={song.id} draggableId={song.id} index={index}>
                  {(provided, snapshot) => (
                    <Box
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      data-testid={`song-item-${song.id}`}
                    >
                      <SongItem
                        song={song}
                        onRemove={() => removeSong(currentProject.id, song.id)}
                        isDragging={snapshot.isDragging}
                      />
                    </Box>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </VStack>
          )}
        </Droppable>
      </DragDropContext>

      {showAddDialog && (
        <AddSongDialog
          isOpen={showAddDialog}
          onClose={() => setShowAddDialog(false)}
          projectId={currentProject.id}
        />
      )}
    </Box>
  )
}
```

#### MixMetadataPanel
**Location**: `src/renderer/components/features/ProjectManager/MixMetadataPanel.tsx`

```typescript
export const MixMetadataPanel: React.FC = () => {
  const { currentProject, updateMixMetadata, uploadCover } = useProjectStore()
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<Partial<MixMetadata>>({})

  useEffect(() => {
    if (currentProject?.mixMetadata) {
      setFormData(currentProject.mixMetadata)
    }
  }, [currentProject])

  if (!currentProject) return null

  const handleSave = async () => {
    await updateMixMetadata(currentProject.id, formData)
    setIsEditing(false)
  }

  const handleUploadCover = async () => {
    const result = await window.api.project.selectCoverImage()
    if (!result.cancelled) {
      await uploadCover({ projectId: currentProject.id, sourceImagePath: result.filePath })
    }
  }

  return (
    <Box data-testid="mix-metadata-panel" p={4} border="1px" borderColor="gray.200" borderRadius="md">
      <HStack justify="space-between" mb={4}>
        <Heading size="md">Mix Metadata</Heading>
        <Button
          size="sm"
          onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          data-testid={isEditing ? "save-metadata-button" : "edit-metadata-button"}
        >
          {isEditing ? 'Save' : 'Edit'}
        </Button>
      </HStack>

      {/* Cover Image */}
      <Box mb={4}>
        <FormLabel>Cover Image</FormLabel>
        <HStack>
          {currentProject.mixMetadata?.coverImage ? (
            <Image
              src={`file://${path.resolve(currentProject.projectDirectory, currentProject.mixMetadata.coverImage)}`}
              alt="Mix cover"
              boxSize="150px"
              objectFit="cover"
              borderRadius="md"
            />
          ) : (
            <Box
              boxSize="150px"
              bg="gray.100"
              borderRadius="md"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Icon as={ImageIcon} boxSize={12} color="gray.400" />
            </Box>
          )}
          <Button onClick={handleUploadCover} size="sm">
            {currentProject.mixMetadata?.coverImage ? 'Change' : 'Upload'} Cover
          </Button>
        </HStack>
      </Box>

      {/* Metadata Fields */}
      <VStack spacing={4} align="stretch">
        <FormControl>
          <FormLabel>Title</FormLabel>
          <Input
            value={formData.title || ''}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            readOnly={!isEditing}
            data-testid="mix-title-input"
          />
        </FormControl>

        <FormControl>
          <FormLabel>Artist/DJ Name</FormLabel>
          <Input
            value={formData.artist || ''}
            onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
            readOnly={!isEditing}
            data-testid="mix-artist-input"
          />
        </FormControl>

        <FormControl>
          <FormLabel>Genre</FormLabel>
          <Input
            value={formData.genre || ''}
            onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
            readOnly={!isEditing}
            data-testid="mix-genre-input"
          />
        </FormControl>

        <FormControl>
          <FormLabel>Description</FormLabel>
          <Textarea
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            readOnly={!isEditing}
            rows={4}
            data-testid="mix-description-input"
          />
        </FormControl>

        <FormControl>
          <FormLabel>Tags</FormLabel>
          {/* Tag input component */}
        </FormControl>
      </VStack>
    </Box>
  )
}
```

---

## 7. State Management

### Zustand Store

**Location**: `src/renderer/store/useProjectStore.ts`

```typescript
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { Project, RecentProject, Song, MixMetadata } from '../../shared/types/project.types'

interface ProjectStore {
  // State
  currentProject: Project | null
  recentProjects: RecentProject[]
  isLoading: boolean
  isSaving: boolean
  lastSaved: Date | null
  error: string | null

  // Actions - Project Lifecycle
  createProject: (name: string, location: string, description?: string) => Promise<void>
  openProject: (filePath: string) => Promise<void>
  saveProject: () => Promise<void>
  closeProject: () => Promise<void>

  // Actions - Recent Projects
  loadRecentProjects: () => Promise<void>
  removeFromRecent: (filePath: string) => Promise<void>

  // Actions - Songs
  addSong: (song: Omit<Song, 'id' | 'addedAt'>) => Promise<void>
  updateSong: (songId: string, updates: Partial<Song>) => Promise<void>
  removeSong: (songId: string) => Promise<void>
  reorderSongs: (songIds: string[]) => Promise<void>

  // Actions - Mix Metadata
  updateMixMetadata: (metadata: Partial<MixMetadata>) => Promise<void>
  uploadCover: (sourceImagePath: string) => Promise<void>

  // Utilities
  clearError: () => void
}

export const useProjectStore = create<ProjectStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      currentProject: null,
      recentProjects: [],
      isLoading: false,
      isSaving: false,
      lastSaved: null,
      error: null,

      // ==========================================
      // PROJECT LIFECYCLE
      // ==========================================

      createProject: async (name, location, description) => {
        set({ isLoading: true, error: null })
        try {
          const project = await window.api.project.create({ name, location, description })
          set({ currentProject: project, isLoading: false })
        } catch (error) {
          set({ error: error.message, isLoading: false })
          throw error
        }
      },

      openProject: async (filePath) => {
        set({ isLoading: true, error: null })
        try {
          const project = await window.api.project.open(filePath)
          set({ currentProject: project, isLoading: false, lastSaved: project.updatedAt })
        } catch (error) {
          set({ error: error.message, isLoading: false })
          throw error
        }
      },

      saveProject: async () => {
        const { currentProject } = get()
        if (!currentProject) return

        set({ isSaving: true, error: null })
        try {
          await window.api.project.save({ project: currentProject })
          set({ isSaving: false, lastSaved: new Date() })
        } catch (error) {
          set({ error: error.message, isSaving: false })
          throw error
        }
      },

      closeProject: async () => {
        set({ isLoading: true, error: null })
        try {
          await window.api.project.close()
          set({ currentProject: null, isLoading: false, lastSaved: null })
        } catch (error) {
          set({ error: error.message, isLoading: false })
          throw error
        }
      },

      // ==========================================
      // RECENT PROJECTS
      // ==========================================

      loadRecentProjects: async () => {
        set({ isLoading: true, error: null })
        try {
          const projects = await window.api.project.listRecent()
          set({ recentProjects: projects, isLoading: false })
        } catch (error) {
          set({ error: error.message, isLoading: false })
        }
      },

      removeFromRecent: async (filePath) => {
        try {
          await window.api.project.removeRecent(filePath)
          set(state => ({
            recentProjects: state.recentProjects.filter(p => p.filePath !== filePath)
          }))
        } catch (error) {
          set({ error: error.message })
        }
      },

      // ==========================================
      // SONGS
      // ==========================================

      addSong: async (song) => {
        const { currentProject } = get()
        if (!currentProject) return

        try {
          const newSong = await window.api.project.addSong({
            projectId: currentProject.id,
            song,
          })

          set(state => ({
            currentProject: state.currentProject ? {
              ...state.currentProject,
              songs: [...state.currentProject.songs, newSong],
            } : null,
          }))
        } catch (error) {
          set({ error: error.message })
          throw error
        }
      },

      updateSong: async (songId, updates) => {
        const { currentProject } = get()
        if (!currentProject) return

        try {
          const updatedSong = await window.api.project.updateSong({
            projectId: currentProject.id,
            songId,
            updates,
          })

          set(state => ({
            currentProject: state.currentProject ? {
              ...state.currentProject,
              songs: state.currentProject.songs.map(s =>
                s.id === songId ? updatedSong : s
              ),
            } : null,
          }))
        } catch (error) {
          set({ error: error.message })
          throw error
        }
      },

      removeSong: async (songId) => {
        const { currentProject } = get()
        if (!currentProject) return

        try {
          await window.api.project.removeSong(currentProject.id, songId)

          set(state => ({
            currentProject: state.currentProject ? {
              ...state.currentProject,
              songs: state.currentProject.songs.filter(s => s.id !== songId),
            } : null,
          }))
        } catch (error) {
          set({ error: error.message })
          throw error
        }
      },

      reorderSongs: async (songIds) => {
        const { currentProject } = get()
        if (!currentProject) return

        try {
          await window.api.project.reorderSongs({
            projectId: currentProject.id,
            songIds,
          })

          // Reorder locally
          const songsMap = new Map(currentProject.songs.map(s => [s.id, s]))
          const reordered = songIds.map((id, idx) => ({
            ...songsMap.get(id)!,
            order: idx,
          }))

          set(state => ({
            currentProject: state.currentProject ? {
              ...state.currentProject,
              songs: reordered,
            } : null,
          }))
        } catch (error) {
          set({ error: error.message })
          throw error
        }
      },

      // ==========================================
      // MIX METADATA
      // ==========================================

      updateMixMetadata: async (metadata) => {
        const { currentProject } = get()
        if (!currentProject) return

        try {
          const updated = await window.api.project.updateMixMetadata({
            projectId: currentProject.id,
            metadata,
          })

          set(state => ({
            currentProject: state.currentProject ? {
              ...state.currentProject,
              mixMetadata: updated,
            } : null,
          }))
        } catch (error) {
          set({ error: error.message })
          throw error
        }
      },

      uploadCover: async (sourceImagePath) => {
        const { currentProject } = get()
        if (!currentProject) return

        try {
          const { coverPath, thumbPath } = await window.api.project.uploadCover({
            projectId: currentProject.id,
            sourceImagePath,
          })

          set(state => ({
            currentProject: state.currentProject ? {
              ...state.currentProject,
              mixMetadata: {
                ...state.currentProject.mixMetadata,
                coverImage: coverPath,
                coverImageThumb: thumbPath,
              },
            } : null,
          }))
        } catch (error) {
          set({ error: error.message })
          throw error
        }
      },

      // ==========================================
      // UTILITIES
      // ==========================================

      clearError: () => set({ error: null }),
    }),
    { name: 'ProjectStore' }
  )
)
```

---

## 8. Project Lifecycle

### State Diagram

```
┌──────────┐
│  No      │
│  Project │
└────┬─────┘
     │
     ├─── Create ────┐
     │               │
     └─── Open ──────┤
                     ▼
              ┌────────────┐
              │  Project   │
              │  Loading   │
              └─────┬──────┘
                    │
         ┌──────────┼──────────┐
         │                     │
         ▼                     ▼
    ┌────────┐           ┌──────────┐
    │ Lock   │           │ Validate │
    │ Check  │           │ Project  │
    └────┬───┘           └─────┬────┘
         │                     │
         │                     ▼
         │              ┌──────────────┐
         │              │   Project    │
         └─────────────▶│   Active     │
                        └──────┬───────┘
                               │
                    ┌──────────┼──────────┐
                    │          │          │
                    ▼          ▼          ▼
              ┌─────────┐ ┌────────┐ ┌──────┐
              │ Editing │ │ Saving │ │ Auto │
              │         │ │        │ │ Save │
              └─────────┘ └────────┘ └──────┘
                               │
                               ▼
                        ┌─────────────┐
                        │   Close     │
                        │   Project   │
                        └──────┬──────┘
                               │
                    ┌──────────┼──��────────┐
                    │          │           │
                    ▼          ▼           ▼
              ┌─────────┐ ┌────────┐ ┌──────────┐
              │  Save   │ │ Remove │ │  Return  │
              │ Changes │ │  Lock  │ │ to Start │
              └─────────┘ └────────┘ └──────────┘
```

### Flow Descriptions

**Create Project**:
1. User clicks "Create New Project"
2. Show CreateProjectDialog
3. User enters name, description, selects location
4. Validate inputs
5. Call `project:create` IPC
6. Main process creates directory structure
7. Write project.json
8. Create lock file
9. Add to recent projects
10. Return to renderer
11. Navigate to Dashboard

**Open Project**:
1. User clicks on recent project or selects file
2. Call `project:open` IPC
3. Main process validates file exists
4. Check for lock file
   - If locked and not stale: Show error
   - If locked and stale: Remove lock
5. Read and deserialize project.json
6. Validate project structure
7. Create lock file
8. Update lastOpenedAt
9. Add to recent projects
10. Return to renderer
11. Navigate to Dashboard

**Save Project**:
1. User clicks "Save" or auto-save triggers
2. Update updatedAt timestamp
3. Serialize project to JSON
4. Write to project.json
5. Update recent projects list
6. Show success indicator

**Close Project**:
1. User clicks "Close Project"
2. Check for unsaved changes
   - If unsaved: Show confirmation dialog
3. Disable auto-save timer
4. Remove lock file
5. Clear currentProject state
6. Navigate to Welcome page

---

## 9. Security & Validation

### Input Validation

**Project Name**:
```typescript
const validateProjectName = (name: string): boolean => {
  // No empty names
  if (!name || name.trim().length === 0) return false

  // Length limits
  if (name.length > 100) return false

  // No invalid filesystem characters
  if (/[<>:"/\\|?*]/.test(name)) return false

  return true
}
```

**File Paths**:
```typescript
const validateFilePath = (filePath: string): boolean => {
  // Must be absolute
  if (!path.isAbsolute(filePath)) return false

  // No directory traversal
  if (filePath.includes('..')) return false

  // Within allowed directories
  const allowed = [app.getPath('home'), app.getPath('documents')]
  if (!allowed.some(dir => filePath.startsWith(dir))) return false

  return true
}
```

**Image Files**:
```typescript
const validateImageFile = async (filePath: string): Promise<boolean> => {
  // Check extension
  const ext = path.extname(filePath).toLowerCase()
  if (!['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) return false

  // Check file size (max 10MB)
  const stats = await fs.stat(filePath)
  if (stats.size > 10 * 1024 * 1024) return false

  // Validate image format with sharp
  try {
    const metadata = await sharp(filePath).metadata()
    return metadata.format !== undefined
  } catch {
    return false
  }
}
```

### Project Lock File

**Lock Creation**:
```typescript
const createLock = async (project: Project): Promise<void> => {
  const lockPath = path.join(project.projectDirectory, '.project.lock')

  const lock: ProjectLock = {
    projectId: project.id,
    lockedAt: new Date(),
    lockedBy: {
      pid: process.pid,
      hostname: os.hostname(),
      username: os.userInfo().username,
    },
    appVersion: app.getVersion(),
  }

  await fs.writeFile(lockPath, JSON.stringify(lock, null, 2), 'utf-8')
}
```

**Lock Check**:
```typescript
const checkLock = async (filePath: string): Promise<ProjectLock | null> => {
  const projectDir = path.dirname(filePath)
  const lockPath = path.join(projectDir, '.project.lock')

  try {
    const content = await fs.readFile(lockPath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null // No lock file
  }
}

const isLockStale = async (lock: ProjectLock): Promise<boolean> => {
  // Lock is considered stale if:
  // 1. The process no longer exists, OR
  // 2. The lock is older than 24 hours (86400000 ms)

  const STALE_LOCK_TIMEOUT = 24 * 60 * 60 * 1000 // 24 hours

  // Check if lock is too old
  const lockAge = Date.now() - new Date(lock.lockedAt).getTime()
  if (lockAge > STALE_LOCK_TIMEOUT) {
    return true
  }

  // Check if process still exists
  try {
    process.kill(lock.lockedBy.pid, 0)
    return false // Process exists
  } catch {
    return true // Process doesn't exist
  }
}
```

### Sanitization

**File Name Sanitization**:
```typescript
const sanitizeFileName = (name: string): string => {
  return name
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid chars
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .substring(0, 100) // Limit length
}
```

**Path Sanitization**:
```typescript
const sanitizePath = (filePath: string): string => {
  return path.normalize(path.resolve(filePath))
}
```

---

## 10. Error Handling

### Error Categories

**File System Errors**:
- File not found
- Permission denied
- Disk full
- Invalid path

**Validation Errors**:
- Invalid project structure
- Missing required fields
- Invalid data types
- Corrupted JSON

**Lock Errors**:
- Project already open
- Stale lock detection

**Network Errors** (if cloud sync added):
- Connection timeout
- Authentication failed
- Sync conflict

### Error Recovery Strategies

**Corrupted Project File**:
```typescript
const recoverProject = async (filePath: string): Promise<Project> => {
  try {
    // Try to read file
    const content = await fs.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(content)

    // Attempt to repair
    const repaired = repairProject(parsed)

    // Validate repaired project
    const validation = await validateProject(repaired)
    if (!validation.valid) {
      throw new Error('Cannot repair project')
    }

    // Create backup of corrupted file
    await fs.copyFile(filePath, `${filePath}.backup.${Date.now()}`)

    // Save repaired version
    await writeProjectFile(repaired)

    return repaired
  } catch (error) {
    throw new Error(`Project recovery failed: ${error.message}`)
  }
}

const repairProject = (data: any): Project => {
  return {
    id: data.id || uuidv4(),
    name: data.name || 'Recovered Project',
    version: '1.0',
    createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
    updatedAt: new Date(),
    songs: Array.isArray(data.songs) ? data.songs : [],
    // ... fill in missing required fields with defaults
  }
}
```

**Auto-Save Failure**:
```typescript
import { BrowserWindow } from 'electron'

const handleAutoSaveError = async (error: Error): Promise<void> => {
  console.error('Auto-save failed:', error)

  // Show non-intrusive warning to user
  const mainWindow = BrowserWindow.getAllWindows()[0]
  mainWindow?.webContents.send('project:auto-save-failed', {
    error: error.message,
    timestamp: new Date(),
  })

  // Don't throw - let user continue working
  // User can manually save when ready
}
```

**External File Missing**:
```typescript
const handleMissingExternalFile = (song: Song): void => {
  // Mark song as having missing file
  song.notes = `[File Missing: ${song.externalFilePath}]\n${song.notes || ''}`

  // Show warning in UI but don't fail
  console.warn(`External file missing for song: ${song.title}`)
}
```

---

## 11. Testing Strategy

### Unit Tests

**ProjectService Tests**:
```typescript
describe('ProjectService', () => {
  describe('createProject', () => {
    it('should create project with valid inputs', async () => {
      const project = await projectService.createProject(
        'Test Project',
        '/tmp/test-location'
      )

      expect(project.name).toBe('Test Project')
      expect(project.id).toBeDefined()
      expect(project.songs).toEqual([])
    })

    it('should reject invalid project name', async () => {
      await expect(
        projectService.createProject('Invalid<Name', '/tmp')
      ).rejects.toThrow()
    })

    it('should create directory structure', async () => {
      const project = await projectService.createProject('Test', '/tmp')

      expect(await fs.pathExists(project.projectDirectory)).toBe(true)
      expect(await fs.pathExists(path.join(project.projectDirectory, 'assets'))).toBe(true)
    })
  })

  describe('addSong', () => {
    it('should add song to project', async () => {
      const project = await projectService.createProject('Test', '/tmp')

      const song = await projectService.addSong(project.id, {
        title: 'Test Song',
        externalFilePath: '/path/to/song.mp3',
        order: 0,
      })

      expect(song.id).toBeDefined()
      expect(song.title).toBe('Test Song')
      expect(project.songs).toHaveLength(1)
    })

    it('should extract metadata for external files', async () => {
      // Mock audioMetadataService
      const song = await projectService.addSong(projectId, {
        title: 'Test',
        externalFilePath: '/test.mp3',
        order: 0,
      })

      expect(song.duration).toBeDefined()
      expect(song.format).toBeDefined()
    })
  })
})
```

**FileSystemService Tests**:
```typescript
describe('FileSystemService', () => {
  describe('createProjectDirectory', () => {
    it('should create nested directories', async () => {
      const dir = await fsService.createProjectDirectory('/tmp', 'MyProject')

      expect(await fs.pathExists(dir)).toBe(true)
      expect(await fs.pathExists(path.join(dir, 'assets', 'covers'))).toBe(true)
    })
  })

  describe('validateFile', () => {
    it('should accept valid file paths', async () => {
      await fs.writeFile('/tmp/test.txt', 'test')
      await expect(fsService.validateFile('/tmp/test.txt')).resolves.toBeUndefined()
    })

    it('should reject non-existent files', async () => {
      await expect(fsService.validateFile('/tmp/nonexistent.txt')).rejects.toThrow()
    })
  })
})
```

### Integration Tests

**IPC Handler Tests**:
```typescript
describe('Project IPC Handlers', () => {
  it('should create project via IPC', async () => {
    const result = await ipcRenderer.invoke('project:create', {
      name: 'Test Project',
      location: '/tmp',
    })

    expect(result.id).toBeDefined()
    expect(result.name).toBe('Test Project')
  })

  it('should handle errors gracefully', async () => {
    await expect(
      ipcRenderer.invoke('project:create', {
        name: '',
        location: '/tmp',
      })
    ).rejects.toThrow()
  })
})
```

### E2E Tests (Playwright)

**Project Workflow Tests**:
```typescript
test('create and open project', async ({ page }) => {
  // Navigate to welcome page
  await page.goto('/')
  await expect(page.getByTestId('welcome-page')).toBeVisible()

  // Click create project
  await page.getByTestId('create-project-button').click()
  await expect(page.getByTestId('create-project-dialog')).toBeVisible()

  // Fill form
  await page.getByTestId('project-name-input').fill('E2E Test Project')
  await page.getByTestId('project-description-input').fill('Test description')

  // Create project
  await page.getByTestId('create-project-submit').click()

  // Should navigate to dashboard
  await expect(page.getByTestId('project-header')).toBeVisible()
  await expect(page.getByText('E2E Test Project')).toBeVisible()
})

test('add and reorder songs', async ({ page }) => {
  // Open project
  await openTestProject(page)

  // Add first song
  await page.getByTestId('add-song-button').click()
  await page.getByTestId('song-title-input').fill('Song 1')
  await page.getByTestId('add-song-submit').click()

  // Add second song
  await page.getByTestId('add-song-button').click()
  await page.getByTestId('song-title-input').fill('Song 2')
  await page.getByTestId('add-song-submit').click()

  // Verify order
  const songs = await page.getByTestId(/^song-item-/).all()
  expect(songs).toHaveLength(2)

  // Drag to reorder
  await songs[1].dragTo(songs[0])

  // Verify new order
  const reordered = await page.getByTestId(/^song-item-/).all()
  await expect(reordered[0]).toContainText('Song 2')
  await expect(reordered[1]).toContainText('Song 1')
})
```

### Test Coverage Goals

- **Unit Tests**: 80% coverage for services
- **Integration Tests**: All IPC handlers covered
- **E2E Tests**: Critical user flows covered
  - Create project
  - Open project
  - Add/remove songs
  - Update metadata
  - Upload cover
  - Save project
  - Close project

---

## 12. Implementation Roadmap

### Phase 1: Core Data & Services (2-3 days)

**Tasks**:
- [ ] Extend data models in `shared/types/project.types.ts`
- [ ] Create Zod schemas in `shared/schemas/project.schema.ts`
- [ ] Implement FileSystemService
- [ ] Implement ConfigService (electron-store)
- [ ] Implement LockService
- [ ] Implement ProjectService (CRUD operations)
- [ ] Write unit tests for services

**Deliverables**:
- Complete service layer
- 80%+ test coverage
- Working file operations

### Phase 2: IPC Communication (1 day)

**Tasks**:
- [ ] Create IPC handlers in `main/ipc/project-handlers.ts`
- [ ] Update preload script with project APIs
- [ ] Add IPC type definitions
- [ ] Write integration tests for IPC

**Deliverables**:
- All IPC channels implemented
- Preload API exposed
- IPC tests passing

### Phase 3: Welcome Page (2 days)

**Tasks**:
- [ ] Update WelcomePage layout
- [ ] Create RecentProjectsList component
- [ ] Create ProjectCard component
- [ ] Create EmptyState component
- [ ] Create CreateProjectDialog
- [ ] Add loading and error states
- [ ] Write component tests

**Deliverables**:
- Functional welcome page
- Recent projects display
- Project creation flow

### Phase 4: Project Management UI (2 days)

**Tasks**:
- [ ] Create ProjectHeader component
- [ ] Create AutoSaveIndicator component
- [ ] Implement save/close actions
- [ ] Create ProjectSettingsDialog
- [ ] Add navigation guards for unsaved changes
- [ ] Write component tests

**Deliverables**:
- Project header with actions
- Auto-save indicator
- Settings dialog

### Phase 5: Songs Management (2 days)

**Tasks**:
- [ ] Create SongsList component
- [ ] Create SongItem component
- [ ] Implement drag-and-drop (react-beautiful-dnd)
- [ ] Create AddSongDialog
- [ ] Create SongDetailsDialog
- [ ] Implement audio file picker
- [ ] Write component tests

**Deliverables**:
- Songs list with reordering
- Add/edit/remove songs
- External file support

### Phase 6: Mix Metadata & Assets (1-2 days)

**Tasks**:
- [ ] Create MixMetadataPanel component
- [ ] Implement cover image upload
- [ ] Add ImageService for thumbnails (sharp)
- [ ] Add AudioMetadataService (music-metadata)
- [ ] Create TagsInput component
- [ ] Write component tests

**Deliverables**:
- Metadata editing
- Cover image upload
- Thumbnail generation

### Phase 7: State Management (1 day)

**Tasks**:
- [ ] Create useProjectStore
- [ ] Connect components to store
- [ ] Add error handling in store
- [ ] Implement optimistic updates
- [ ] Add store devtools
- [ ] Test store actions

**Deliverables**:
- Complete Zustand store
- All components connected
- Error handling

### Phase 8: Integration & Polish (1-2 days)

**Tasks**:
- [ ] Connect to existing features (torrents, search)
- [ ] Add keyboard shortcuts
- [ ] Implement auto-save
- [ ] Add telemetry events
- [ ] Error recovery dialogs
- [ ] Performance optimization
- [ ] Write E2E tests

**Deliverables**:
- Fully integrated system
- Keyboard shortcuts
- E2E tests passing

### Phase 9: Testing & Documentation (1 day)

**Tasks**:
- [ ] Complete test coverage
- [ ] Test edge cases
- [ ] Test error scenarios
- [ ] Update user documentation
- [ ] Create migration guide (if needed)

**Deliverables**:
- 80%+ test coverage
- All tests passing
- Documentation updated

**Total Estimated Time**: 12-14 days

---

## 13. Architecture Decisions

### ADR-007: JSON File Format for Projects

**Status**: Accepted

**Context**:
Need to choose storage format for projects. Options: JSON, SQLite, custom binary.

**Decision**:
Use JSON files (.json) for project storage.

**Rationale**:
- Human-readable and debuggable
- Easy to version control
- Simple serialization/deserialization
- Cross-platform compatible
- No additional dependencies
- Easy to backup and share

**Consequences**:
- Must handle Date serialization manually
- Not optimal for very large projects (>1000 songs)
- No built-in indexing or querying
- Entire file must be loaded into memory

### ADR-008: Single Active Project

**Status**: Accepted

**Context**:
Should users be able to open multiple projects simultaneously?

**Decision**:
Only one project can be active at a time.

**Rationale**:
- Simpler state management
- Reduced memory usage
- Clearer user mental model
- Aligns with DAW/video editor patterns
- Easier to implement auto-save
- Reduces risk of data conflicts

**Consequences**:
- Users must close current project to open another
- Cannot copy/move items between projects easily
- Future enhancement could add multi-project support

### ADR-009: External File Support

**Status**: Accepted

**Context**:
Should songs only reference downloaded files, or also external files?

**Decision**:
Allow users to add external audio files from anywhere on their system.

**Rationale**:
- Greater flexibility for users
- Users may already have music libraries
- Not all music is available via torrents
- Enables mixing downloaded and existing files
- Common pattern in music software

**Consequences**:
- Must validate external file paths
- Files may be moved/deleted outside app
- Need to extract metadata for external files
- Project portability is reduced

### ADR-010: Project Locking

**Status**: Accepted

**Context**:
How to prevent users from opening same project in multiple instances?

**Decision**:
Use `.project.lock` file with process PID and stale lock detection.

**Rationale**:
- Prevents data corruption from concurrent writes
- Simple file-based implementation
- No external dependencies
- Works across platforms
- Can detect stale locks from crashes

**Consequences**:
- Must handle stale lock cleanup
- Requires process existence checking
- Lock file must be cleaned up properly
- Network file systems may have issues

### ADR-011: Manual Backup Only

**Status**: Accepted

**Context**:
Should the app automatically backup projects?

**Decision**:
No automatic backups. Users manually export/duplicate when needed.

**Rationale**:
- Keeps implementation simple
- Gives users control
- Avoids disk space issues
- Users can use system backups (Time Machine, etc.)
- Auto-save already prevents data loss

**Consequences**:
- Users responsible for their own backups
- No automatic versioning
- Potential data loss if user doesn't backup
- Future enhancement could add optional auto-backup

### ADR-012: Global Torrent Manager

**Status**: Accepted

**Context**:
Should torrents be project-scoped or globally managed?

**Decision**:
Global torrent manager shared across projects. Torrents reference `projectId`.

**Rationale**:
- Allows torrents to continue when project closes
- Avoids duplicate downloads
- Centralized download management
- Better resource utilization
- Can seed across projects

**Consequences**:
- Torrents persist after project closes
- Need to filter torrents by project in UI
- Must handle orphaned torrents
- Slightly more complex state management

---

**End of Document**
