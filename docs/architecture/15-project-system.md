# Project System Architecture

**Version**: 2.0
**Last Updated**: 2026-02-17
**Status**: Implemented

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
12. [Architecture Decisions](#12-architecture-decisions)

---

## 1. Overview

### Purpose

The Project System serves as the central organizing unit for the Music Production Suite, encapsulating all user work including:
- User's song/tracklist with metadata
- Mix metadata and cover art
- Project directory with organized assets
- References to downloaded and external audio files

Search results, torrent collections, and download queues are managed by their own services and persisted per-project-directory (not embedded in the project file). This keeps `project.json` focused on the user-curated mix.

### Key Features

- **Create/Open/Close Projects**: Full project lifecycle management
- **Recent Projects**: Quick access to recently opened projects
- **External File Support**: Add audio files from anywhere on the system
- **Project Locking**: Prevent simultaneous access to same project
- **Mix Metadata**: Title, description, genre, cover image, tags
- **Songs List**: User-curated tracklist with ordering
- **Delete Projects**: Remove from recent list or delete from disk entirely
- **Global Torrent Integration**: Download paths are per-project via ConfigService

### Design Principles

1. **Single Project Active**: Only one project open at a time (simplifies state)
2. **JSON Storage**: Human-readable, debuggable, version-controllable
3. **User-Controlled Location**: Users choose where projects are saved
4. **Asset Organization**: Structured folder for project assets
5. **Lean Project File**: `project.json` stores only project identity, songs, and mix metadata -- search history, torrent collections, and download queues are stored in separate files within the project directory
6. **Cross-Platform**: Windows and macOS support

---

## 2. Data Models

### Core Interfaces

**Location**: `src/shared/types/project.types.ts`

```typescript
// ==========================================
// PROJECT
// ==========================================

export interface Project {
  id: string                    // UUID v4
  name: string                  // User-defined project name
  description?: string          // Optional project description
  createdAt: Date
  updatedAt: Date
  projectDirectory: string      // Root directory for project
  songs: Song[]                 // Array of songs in the mix
  mixMetadata: MixMetadata      // Metadata about the mix
  isActive: boolean             // Whether project is currently open
}

// ==========================================
// SONG (User's Tracklist)
// ==========================================

export interface Song {
  id: string                    // UUID v4
  title: string                 // Song title
  artist?: string               // Artist name
  album?: string                // Album name
  duration?: number             // Duration in seconds
  format?: string               // mp3, flac, wav, etc.
  bitrate?: number              // kbps
  sampleRate?: number           // Hz
  fileSize?: number             // bytes
  downloadId?: string           // Reference to download (if from torrent system)
  externalFilePath?: string     // Path to external file (if not downloaded)
  localFilePath?: string        // Path in project assets/ directory
  addedAt: Date
  order: number                 // Position in tracklist (0-indexed)
  metadata?: AudioMetadata      // Extended audio metadata
}

// ==========================================
// MIX METADATA
// ==========================================

export interface MixMetadata {
  title?: string                // Mix title (e.g., "Summer Vibes 2026")
  description?: string          // Mix description
  coverImagePath?: string       // Path to cover image in assets/covers/
  tags: string[]                // Genre tags, mood tags, etc.
  genre?: string                // Musical genre
  estimatedDuration?: number    // Sum of all song durations
  createdBy?: string            // User who created the mix
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
// RECENT PROJECTS
// ==========================================

export interface RecentProject {
  projectId: string             // Project UUID
  projectName: string           // Project display name
  projectDirectory: string      // Absolute path to project directory
  lastOpened: Date
  songCount: number
  coverImagePath?: string       // Absolute path to cover image
}

// ==========================================
// PROJECT STATISTICS
// ==========================================

export interface ProjectStats {
  totalSongs: number
  totalDuration: number         // Sum of all song durations in seconds
  totalSize: number             // Total file size in bytes
  downloadedSongs: number       // Songs from torrent system
  externalSongs: number         // Songs from external files
  formatBreakdown: Record<string, number>  // Count by format (mp3: 5, flac: 3)
}

// ==========================================
// PROJECT LOCK
// ==========================================

export interface ProjectLock {
  projectId: string
  lockedBy: {
    pid: number                 // Process ID
    hostname: string            // Machine hostname
  }
  lockedAt: Date
}

// ==========================================
// REQUEST TYPES
// ==========================================

export interface CreateProjectRequest {
  name: string
  location: string              // Parent directory where project will be created
  description?: string
}

export interface OpenProjectRequest {
  filePath: string              // Path to project.json
}

export interface SaveProjectRequest {
  project: Project
}

export interface AddSongRequest {
  projectId: string
  title: string
  downloadId?: string           // If from torrent system
  externalFilePath?: string     // If external file
  order: number
  metadata?: Partial<AudioMetadata>
}

export interface UpdateSongRequest {
  projectId: string
  songId: string
  updates: Partial<Omit<Song, 'id' | 'addedAt'>>
}

export interface RemoveSongRequest {
  projectId: string
  songId: string
}

export interface UpdateMixMetadataRequest {
  projectId: string
  metadata: Partial<MixMetadata>
}

// ==========================================
// LEGACY / UTILITY TYPES
// ==========================================

export interface ProjectMetadata {
  totalSearches: number
  totalDownloads: number
  totalFiles: number
  lastOpened: Date
}

export interface SelectFileResponse {
  filePath: string
  cancelled: boolean
}
```

---

## 3. File System Architecture

### Directory Structure

```
User-Selected-Location/
└── MyMixProject/
    ├── project.json              # Main project file
    ├── .lock                     # Lock file (present when project is open)
    ├── assets/                   # Project-specific assets
    │   ├── covers/               # Mix cover images
    │   └── audio/                # Local audio files
    ├── search-history.json       # Search history (managed by SearchHistoryService)
    └── torrent-collection.json   # Torrent collection (managed by TorrentCollectionService)
```

Note: Download paths for torrents are stored per-project in ConfigService with the key `webtorrent-download-path:{projectId}`, not in the project directory itself. The download location defaults to a system-level path and can be changed by the user.

### Project File Format

**project.json**:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Summer House Mix 2026",
  "description": "Progressive house compilation for summer",
  "createdAt": "2026-02-02T10:30:00.000Z",
  "updatedAt": "2026-02-02T15:45:00.000Z",
  "projectDirectory": "C:\\Users\\name\\MusicProjects\\MyMixProject",
  "isActive": true,

  "mixMetadata": {
    "title": "Summer Vibes",
    "description": "A journey through progressive house...",
    "coverImagePath": "assets/covers/cover.jpg",
    "tags": ["house", "progressive", "summer", "2026"],
    "genre": "Progressive House",
    "estimatedDuration": 3600,
    "createdBy": "DJ Name"
  },

  "songs": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "title": "Track One",
      "artist": "Artist Name",
      "album": "Album Name",
      "duration": 420,
      "format": "mp3",
      "bitrate": 320,
      "sampleRate": 44100,
      "fileSize": 10485760,
      "downloadId": "770e8400-e29b-41d4-a716-446655440002",
      "localFilePath": null,
      "order": 0,
      "addedAt": "2026-02-02T11:00:00.000Z",
      "metadata": {
        "duration": 420,
        "format": "mp3",
        "bitrate": 320,
        "sampleRate": 44100,
        "fileSize": 10485760,
        "artist": "Artist Name",
        "title": "Track One",
        "album": "Album Name",
        "year": 2025,
        "genre": "House",
        "channels": 2,
        "codec": "mp3"
      }
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440003",
      "title": "External Track",
      "artist": "External Artist",
      "album": null,
      "duration": 380,
      "format": "flac",
      "bitrate": 1411,
      "sampleRate": 44100,
      "fileSize": 25165824,
      "externalFilePath": "D:\\Music\\my-track.flac",
      "localFilePath": null,
      "order": 1,
      "addedAt": "2026-02-02T12:00:00.000Z"
    }
  ]
}
```

### Lock File Format

**.lock** (in project directory root):

```json
{
  "projectId": "550e8400-e29b-41d4-a716-446655440000",
  "lockedAt": "2026-02-02T15:30:00.000Z",
  "lockedBy": {
    "pid": 12345,
    "hostname": "DESKTOP-ABC123"
  }
}
```

### Application Config

Stored by `electron-store` (in userData directory):

```json
{
  "recentProjects": [
    {
      "projectId": "550e8400-e29b-41d4-a716-446655440000",
      "projectName": "Summer House Mix 2026",
      "projectDirectory": "C:\\Users\\name\\MusicProjects\\MyMixProject",
      "lastOpened": "2026-02-02T15:30:00.000Z",
      "songCount": 12,
      "coverImagePath": "assets/covers/cover.jpg"
    }
  ]
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
const windowsProjectDir = 'C:\\Users\\Username\\MusicProjects\\MyMixProject'

// macOS/Linux paths
const macProjectDir = '/Users/username/MusicProjects/MyMixProject'

// Use Node.js path module for cross-platform compatibility
import path from 'path'

const projectFilePath = path.join(projectDirectory, 'project.json')
const assetPath = path.join(projectDirectory, 'assets', 'covers', 'cover.jpg')
```

**Directory Creation** (FileSystemService):
```typescript
const projectDir = path.join(parentDir, projectName)
await fs.ensureDir(projectDir)
await fs.ensureDir(path.join(projectDir, 'assets'))
await fs.ensureDir(path.join(projectDir, 'assets', 'covers'))
await fs.ensureDir(path.join(projectDir, 'assets', 'audio'))
```

**JSON Serialization**:
```typescript
// FileSystemService handles serialization via fs-extra's readJson/writeJson
// Dates must be rehydrated when reading from disk:
project.createdAt = new Date(project.createdAt)
project.updatedAt = new Date(project.updatedAt)
project.songs = project.songs.map((song) => ({
  ...song,
  addedAt: new Date(song.addedAt),
}))
```

---

## 4. IPC Communication

### Channel Definitions

All channel constants are defined in `src/shared/constants.ts`.

| Constant | Channel | Direction | Purpose | Request Type | Response Type |
|----------|---------|-----------|---------|--------------|---------------|
| **Project Lifecycle** |
| `PROJECT_CREATE` | `project:create` | R->M | Create new project | `CreateProjectRequest` | `ApiResponse<Project>` |
| `PROJECT_LOAD` | `project:load` | R->M | Open existing project | `OpenProjectRequest` | `ApiResponse<Project>` |
| `PROJECT_CLOSE` | `project:close` | R->M | Close current project | `string` (projectId) | `ApiResponse<void>` |
| **Recent Projects** |
| `PROJECT_LIST` | `project:list` | R->M | Get recent projects | `void` | `ApiResponse<RecentProject[]>` |
| `PROJECT_DELETE` | `project:delete` | R->M | Remove from recent | `string` (projectId) | `ApiResponse<void>` |
| `PROJECT_DELETE_FROM_DISK` | `project:delete-from-disk` | R->M | Delete project files | `string, string` (projectId, projectDirectory) | `ApiResponse<void>` |
| **File Operations** |
| `FILE_SELECT_DIRECTORY` | `file:select-directory` | R->M | Show folder picker | `string?` (title) | `string \| null` |
| `FILE_OPEN_PATH` | `file:open-path` | R->M | Open path in OS | `string` (filePath) | `{ success, error? }` |

### IPC Response Wrapper

All project IPC handlers wrap responses in `ApiResponse<T>`:

```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}
```

### IPC Handler Implementation

**Location**: `src/main/ipc/projectHandlers.ts`

```typescript
import { ipcMain, dialog } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type { ProjectService } from '../services/ProjectService'
import type { ConfigService } from '../services/ConfigService'
import type { FileSystemService } from '../services/FileSystemService'
import type { CreateProjectRequest, OpenProjectRequest } from '@shared/types/project.types'

export function registerProjectHandlers(
  projectService: ProjectService,
  configService: ConfigService,
  fileSystemService: FileSystemService
): void {
  ipcMain.handle(IPC_CHANNELS.PROJECT_CREATE, async (_event, request: CreateProjectRequest) => {
    try {
      const project = await projectService.createProject(
        request.name,
        request.location,
        request.description
      )
      return { success: true, data: project }
    } catch (error) {
      console.error('Failed to create project:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create project',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_LOAD, async (_event, request: OpenProjectRequest) => {
    try {
      const project = await projectService.openProject(request.filePath)
      return { success: true, data: project }
    } catch (error) {
      console.error('Failed to open project:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open project',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_CLOSE, async (_event, projectId: string) => {
    try {
      await projectService.closeProject(projectId)
      return { success: true }
    } catch (error) {
      console.error('Failed to close project:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to close project',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_LIST, async () => {
    try {
      const recentProjects = configService.getRecentProjects()
      return { success: true, data: recentProjects }
    } catch (error) {
      console.error('Failed to get recent projects:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get recent projects',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_DELETE, async (_event, projectId: string) => {
    try {
      configService.removeRecentProject(projectId)
      return { success: true }
    } catch (error) {
      console.error('Failed to delete project:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete project',
      }
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_DELETE_FROM_DISK,
    async (_event, projectId: string, projectDirectory: string) => {
      try {
        configService.removeRecentProject(projectId)
        await fileSystemService.deleteDirectory(projectDirectory)
        return { success: true }
      } catch (error) {
        console.error('Failed to delete project from disk:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete project from disk',
        }
      }
    }
  )

  // File operation: directory picker dialog
  ipcMain.handle(IPC_CHANNELS.FILE_SELECT_DIRECTORY, async (_event, title?: string) => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
        title: title || 'Select Project Location',
      })

      if (result.canceled || result.filePaths.length === 0) {
        return null
      }

      return result.filePaths[0]
    } catch (error) {
      console.error('Failed to select directory:', error)
      return null
    }
  })
}
```

### Preload API

**Location**: `src/preload/index.ts`

Project methods are exposed as top-level functions on `window.api` (not nested under a `project` namespace):

```typescript
const api = {
  // Project methods
  createProject: (request: CreateProjectRequest): Promise<ApiResponse<Project>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CREATE, request),

  openProject: (request: OpenProjectRequest): Promise<ApiResponse<Project>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_LOAD, request),

  closeProject: (projectId: string): Promise<ApiResponse<void>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CLOSE, projectId),

  getRecentProjects: (): Promise<ApiResponse<RecentProject[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_LIST),

  deleteProject: (projectId: string): Promise<ApiResponse<void>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_DELETE, projectId),

  deleteProjectFromDisk: (projectId: string, projectDirectory: string): Promise<ApiResponse<void>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_DELETE_FROM_DISK, projectId, projectDirectory),

  // File operations
  selectDirectory: (title?: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_SELECT_DIRECTORY, title),

  openPath: (filePath: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_OPEN_PATH, filePath),

  // ... other APIs (auth, search, torrent, webtorrent, etc.)
}

contextBridge.exposeInMainWorld('api', api)
export type ElectronAPI = typeof api
```

**Usage from renderer**:
```typescript
// Create project
const response = await window.api.createProject({ name, location, description })

// Open project
const response = await window.api.openProject({ filePath })

// Close project
await window.api.closeProject(projectId)

// Get recent projects
const response = await window.api.getRecentProjects()

// Delete from recent list only
await window.api.deleteProject(projectId)

// Delete project and its files from disk
await window.api.deleteProjectFromDisk(projectId, projectDirectory)
```

---

## 5. Service Layer

### ProjectService

**Location**: `src/main/services/ProjectService.ts`

Orchestrates FileSystemService, ConfigService, and LockService for all project operations. Maintains a single `activeProject` reference in memory.

```typescript
import { v4 as uuidv4 } from 'uuid'
import * as path from 'path'
import { Project, Song, MixMetadata, ProjectStats, AddSongRequest } from '../../shared/types/project.types'
import { FileSystemService } from './FileSystemService'
import { ConfigService } from './ConfigService'
import { LockService } from './LockService'

export class ProjectService {
  private activeProject: Project | null = null

  constructor(
    private fileSystemService: FileSystemService,
    private configService: ConfigService,
    private lockService: LockService
  ) {}

  async createProject(
    name: string,
    location: string,
    description?: string
  ): Promise<Project> {
    // Create project directory structure
    const projectDirectory = await this.fileSystemService.createProjectDirectory(location, name)

    // Create project object
    const project: Project = {
      id: uuidv4(),
      name,
      description,
      createdAt: new Date(),
      updatedAt: new Date(),
      projectDirectory,
      songs: [],
      mixMetadata: { tags: [] },
      isActive: true,
    }

    // Save project to disk
    const projectFilePath = path.join(projectDirectory, 'project.json')
    await this.fileSystemService.writeJsonFile(projectFilePath, project)

    // Acquire lock
    await this.lockService.acquireLock(project.id, projectDirectory)

    // Add to recent projects
    this.configService.addRecentProject({
      projectId: project.id,
      projectName: project.name,
      projectDirectory: project.projectDirectory,
      lastOpened: new Date(),
      songCount: 0,
    })

    // Set as active project
    this.activeProject = project
    return project
  }

  async openProject(filePath: string): Promise<Project> {
    // Validate file exists
    await this.fileSystemService.validateFilePath(filePath)

    // Read project from disk
    const project = await this.fileSystemService.readJsonFile<Project>(filePath)

    // Convert date strings to Date objects
    project.createdAt = new Date(project.createdAt)
    project.updatedAt = new Date(project.updatedAt)
    project.songs = project.songs.map((song) => ({
      ...song,
      addedAt: new Date(song.addedAt),
    }))

    // Acquire lock
    await this.lockService.acquireLock(project.id, project.projectDirectory)

    // Update isActive
    project.isActive = true

    // Add to recent projects
    this.configService.addRecentProject({
      projectId: project.id,
      projectName: project.name,
      projectDirectory: project.projectDirectory,
      lastOpened: new Date(),
      songCount: project.songs.length,
      coverImagePath: project.mixMetadata.coverImagePath,
    })

    // Set as active project
    this.activeProject = project
    return project
  }

  async saveProject(project: Project): Promise<void> {
    const fs = await import('fs-extra')
    if (!await fs.pathExists(project.projectDirectory)) {
      throw new Error(`Project directory does not exist: ${project.projectDirectory}`)
    }

    project.updatedAt = new Date()

    const projectFilePath = path.join(project.projectDirectory, 'project.json')
    await this.fileSystemService.writeJsonFile(projectFilePath, project)
  }

  async closeProject(projectId: string): Promise<void> {
    if (this.activeProject && this.activeProject.id === projectId) {
      this.activeProject.isActive = false
      await this.saveProject(this.activeProject)
      await this.lockService.releaseLock(this.activeProject.id, this.activeProject.projectDirectory)
      this.activeProject = null
    }
  }

  async addSong(projectId: string, request: Omit<AddSongRequest, 'projectId'>): Promise<Song> {
    const project = this.getProjectById(projectId)

    const song: Song = {
      id: uuidv4(),
      title: request.title,
      artist: request.metadata?.artist,
      album: request.metadata?.album,
      duration: request.metadata?.duration,
      format: request.metadata?.format,
      bitrate: request.metadata?.bitrate,
      sampleRate: request.metadata?.sampleRate,
      fileSize: request.metadata?.fileSize,
      downloadId: request.downloadId,
      externalFilePath: request.externalFilePath,
      localFilePath: undefined,
      addedAt: new Date(),
      order: request.order,
      metadata: request.metadata,
    }

    project.songs.push(song)
    await this.saveProject(project)
    this.updateRecentProject(project)
    return song
  }

  async removeSong(projectId: string, songId: string): Promise<void> {
    const project = this.getProjectById(projectId)
    const songIndex = project.songs.findIndex((s) => s.id === songId)
    if (songIndex === -1) throw new Error(`Song not found: ${songId}`)
    project.songs.splice(songIndex, 1)
    await this.saveProject(project)
    this.updateRecentProject(project)
  }

  async updateSong(
    projectId: string,
    songId: string,
    updates: Partial<Omit<Song, 'id' | 'addedAt'>>
  ): Promise<void> {
    const project = this.getProjectById(projectId)
    const song = project.songs.find((s) => s.id === songId)
    if (!song) throw new Error(`Song not found: ${songId}`)
    Object.assign(song, updates)
    await this.saveProject(project)
    this.updateRecentProject(project)
  }

  async updateMixMetadata(projectId: string, metadata: Partial<MixMetadata>): Promise<void> {
    const project = this.getProjectById(projectId)
    Object.assign(project.mixMetadata, metadata)
    await this.saveProject(project)
    this.updateRecentProject(project)
  }

  async getProjectStats(projectId: string): Promise<ProjectStats> {
    const project = this.getProjectById(projectId)

    const stats: ProjectStats = {
      totalSongs: project.songs.length,
      totalDuration: 0,
      totalSize: 0,
      downloadedSongs: 0,
      externalSongs: 0,
      formatBreakdown: {},
    }

    for (const song of project.songs) {
      if (song.duration) stats.totalDuration += song.duration
      if (song.fileSize) stats.totalSize += song.fileSize
      if (song.downloadId) stats.downloadedSongs++
      else if (song.externalFilePath) stats.externalSongs++
      if (song.format) {
        stats.formatBreakdown[song.format] = (stats.formatBreakdown[song.format] || 0) + 1
      }
    }

    return stats
  }

  getActiveProject(): Project | null {
    return this.activeProject
  }

  hasActiveProject(): boolean {
    return this.activeProject !== null
  }

  private getProjectById(projectId: string): Project {
    if (!this.activeProject || this.activeProject.id !== projectId) {
      throw new Error(`Project not found: ${projectId}`)
    }
    return this.activeProject
  }

  private updateRecentProject(project: Project): void {
    this.configService.addRecentProject({
      projectId: project.id,
      projectName: project.name,
      projectDirectory: project.projectDirectory,
      lastOpened: new Date(),
      songCount: project.songs.length,
      coverImagePath: project.mixMetadata.coverImagePath,
    })
  }
}
```

### Supporting Services

**FileSystemService** (`src/main/services/FileSystemService.ts`):
- `createProjectDirectory(parentDir, projectName): Promise<string>` -- creates project dir with `assets/`, `assets/covers/`, `assets/audio/` subdirectories
- `validateFilePath(filePath): Promise<boolean>` -- checks file exists and is a file
- `readJsonFile<T>(filePath): Promise<T>` -- reads and parses JSON
- `writeJsonFile(filePath, data): Promise<void>` -- writes JSON with 2-space indent
- `copyFile(source, dest): Promise<void>`
- `deleteFile(filePath): Promise<void>`
- `deleteDirectory(dirPath): Promise<void>`
- `getFileSize(filePath): Promise<number>`
- `sanitizeFileName(fileName): string`

**ConfigService** (`src/main/services/ConfigService.ts`):
- Uses `electron-store` for persistent storage
- `getRecentProjects(): RecentProject[]` -- sorted by lastOpened descending
- `addRecentProject(project: RecentProject): void` -- upsert to front, max 10
- `removeRecentProject(projectId: string): void`
- `clearRecentProjects(): void`
- `getSetting<T>(key, defaultValue?): T | undefined`
- `setSetting<T>(key, value): void`

**LockService** (`src/main/services/LockService.ts`):
- `acquireLock(projectId, projectDir): Promise<ProjectLock>` -- creates `.lock` file
- `releaseLock(projectId, projectDir): Promise<void>` -- removes `.lock` file
- `isLocked(projectId, projectDir): Promise<boolean>`
- `getLock(projectId, projectDir): Promise<ProjectLock | null>`
- `isLockStale(lock): Promise<boolean>` -- stale if process doesn't exist or lock > 24h old

### Service Registration

**Location**: `src/main/ipc/index.ts`

Services are instantiated and wired together when IPC handlers are registered:

```typescript
export function registerIpcHandlers(): void {
  fileSystemService = new FileSystemService()
  configService = new ConfigService()
  lockService = new LockService()
  projectService = new ProjectService(fileSystemService, configService, lockService)
  // ... other services

  registerProjectHandlers(projectService, configService, fileSystemService)
  // ... other handler registrations
}
```

---

## 6. UI Components

### Component Hierarchy

```
App
└── Router
    ├── ProjectLauncher (no active project)
    │   ├── LauncherHeader
    │   ├── CreateProjectCard
    │   ├── OpenProjectCard
    │   └── RecentProjectsSection
    │       └── RecentProjectCard (multiple)
    │
    └── ProjectOverview (active project)
        ├── ProjectHeader
        ├── StatsGrid
        ├── MetadataSection
        ├── SongsList
        └── Tabbed Content
            ├── SearchTab
            ├── TorrentTab
            └── MixTab
```

### Key Pages

**ProjectLauncher** (`src/renderer/pages/ProjectLauncher/`):
- The landing page when no project is open
- Shows recent projects, create new, and open existing options
- Components: `LauncherHeader`, `CreateProjectCard`, `OpenProjectCard`, `RecentProjectCard`, `RecentProjectsSection`

**ProjectOverview** (`src/renderer/pages/ProjectOverview/`):
- Main project workspace with tabbed interface
- Components: `ProjectHeader`, `StatsGrid`, `MetadataSection`, `SongsList`
- Tabs: `SearchTab`, `TorrentTab`, `MixTab`

### UI Pattern Notes

- Uses Chakra UI v3 with semantic tokens (`bg.card`, `text.primary`, etc.)
- Icons from `react-icons/fi`
- Toasts via `toaster.create()` from `@/components/ui/toaster`
- No Tailwind/className -- all styling through Chakra props

---

## 7. State Management

### Zustand Store

**Location**: `src/renderer/store/useProjectStore.ts`

```typescript
import { create } from 'zustand'
import type { Project, RecentProject } from '@shared/types/project.types'

interface ProjectState {
  // State
  currentProject: Project | null
  recentProjects: RecentProject[]
  isLoading: boolean
  error: string | null

  // Actions
  setCurrentProject: (project: Project | null) => void
  setRecentProjects: (projects: RecentProject[]) => void
  setIsLoading: (isLoading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void

  // Async actions
  loadRecentProjects: () => Promise<void>
  createProject: (name: string, location: string, description?: string) => Promise<void>
  openProject: (filePath: string) => Promise<void>
  closeProject: () => Promise<void>
  deleteProject: (projectId: string) => Promise<boolean>
  deleteProjectFromDisk: (projectId: string, projectDirectory: string) => Promise<boolean>
}

export const useProjectStore = create<ProjectState>((set) => ({
  // Initial state
  currentProject: null,
  recentProjects: [],
  isLoading: false,
  error: null,

  // Setters
  setCurrentProject: (project) => set({ currentProject: project }),
  setRecentProjects: (projects) => set({ recentProjects: projects }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  // Async actions
  loadRecentProjects: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await window.api.getRecentProjects()
      if (response.success && response.data) {
        set({ recentProjects: response.data, isLoading: false })
      } else {
        set({ error: response.error || 'Failed to load recent projects', isLoading: false })
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load recent projects',
        isLoading: false,
      })
    }
  },

  createProject: async (name, location, description) => {
    set({ isLoading: true, error: null })
    try {
      const response = await window.api.createProject({ name, location, description })
      if (response.success && response.data) {
        set({ currentProject: response.data, isLoading: false })
        // Refresh recent projects
        const recentResponse = await window.api.getRecentProjects()
        if (recentResponse.success && recentResponse.data) {
          set({ recentProjects: recentResponse.data })
        }
      } else {
        set({ error: response.error || 'Failed to create project', isLoading: false })
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create project',
        isLoading: false,
      })
    }
  },

  openProject: async (filePath) => {
    set({ isLoading: true, error: null })
    try {
      const response = await window.api.openProject({ filePath })
      if (response.success && response.data) {
        set({ currentProject: response.data, isLoading: false })
        // Refresh recent projects
        const recentResponse = await window.api.getRecentProjects()
        if (recentResponse.success && recentResponse.data) {
          set({ recentProjects: recentResponse.data })
        }
      } else {
        set({ error: response.error || 'Failed to open project', isLoading: false })
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to open project',
        isLoading: false,
      })
    }
  },

  closeProject: async () => {
    const { currentProject } = useProjectStore.getState()
    if (!currentProject) return
    try {
      const response = await window.api.closeProject(currentProject.id)
      if (response.success) {
        set({ currentProject: null })
      } else {
        set({ error: response.error || 'Failed to close project' })
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to close project',
      })
    }
  },

  deleteProject: async (projectId) => {
    try {
      const response = await window.api.deleteProject(projectId)
      if (response.success) {
        const { recentProjects } = useProjectStore.getState()
        set({ recentProjects: recentProjects.filter((p) => p.projectId !== projectId) })
        return true
      } else {
        set({ error: response.error || 'Failed to delete project' })
        return false
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete project',
      })
      return false
    }
  },

  deleteProjectFromDisk: async (projectId, projectDirectory) => {
    try {
      const response = await window.api.deleteProjectFromDisk(projectId, projectDirectory)
      if (response.success) {
        const { recentProjects } = useProjectStore.getState()
        set({ recentProjects: recentProjects.filter((p) => p.projectId !== projectId) })
        return true
      } else {
        set({ error: response.error || 'Failed to delete project from disk' })
        return false
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete project from disk',
      })
      return false
    }
  },
}))
```

### Key Differences from Original Design

1. **No `isSaving` / `lastSaved` state** -- the store does not track explicit save state since the project auto-saves on changes via ProjectService
2. **No `devtools` middleware** -- the store uses a plain `create()` call
3. **ApiResponse unwrapping** -- all async actions check `response.success` and `response.data` before updating state
4. **Delete operations** -- both "remove from recent" and "delete from disk" are supported
5. **No song/metadata management in store** -- song CRUD and mix metadata updates are handled through direct ProjectService calls, not through the Zustand store

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
    │ Lock   │           │  Read &  │
    │ Check  │           │  Parse   │
    └────┬───┘           └─────┬────┘
         │                     │
         │                     ▼
         │              ┌──────────────┐
         │              │   Project    │
         └─────────────►│   Active     │
                        └──────┬───────┘
                               │
                    ┌──────────┼──────────┐
                    │          │          │
                    ▼          ▼          ▼
              ┌─────────┐ ┌────────┐ ┌──────────┐
              │ Add/Edit│ │  Save  │ │  Delete  │
              │  Songs  │ │(on     │ │  Project │
              └─────────┘ │change) │ └──────────┘
                          └────────┘
                               │
                               ▼
                        ┌─────────────┐
                        │   Close     │
                        │   Project   │
                        └──────┬──────┘
                               │
                    ┌──────────┼───────────┐
                    │          │           │
                    ▼          ▼           ▼
              ┌─────────┐ ┌────────┐ ┌──────────┐
              │  Save   │ │ Remove │ │  Return  │
              │(isActive│ │  Lock  │ │ to       │
              │= false) │ │(.lock) │ │ Launcher │
              └─────────┘ └────────┘ └──────────┘
```

### Flow Descriptions

**Create Project**:
1. User clicks "Create New Project" on ProjectLauncher page
2. User enters name, description, selects location via directory picker
3. Store calls `window.api.createProject({ name, location, description })`
4. Main process: `ProjectService.createProject()`:
   - Creates directory structure via `FileSystemService.createProjectDirectory()`
   - Writes `project.json` with initial data
   - Acquires lock via `LockService.acquireLock()`
   - Adds to recent via `ConfigService.addRecentProject()`
5. Returns `ApiResponse<Project>` to renderer
6. Store sets `currentProject`, navigates to ProjectOverview

**Open Project**:
1. User clicks on a recent project card or browses for `project.json`
2. Store calls `window.api.openProject({ filePath })`
3. Main process: `ProjectService.openProject()`:
   - Validates file exists
   - Reads and parses JSON
   - Rehydrates Date fields
   - Acquires lock (stale lock detection built in)
   - Sets `isActive = true`
   - Updates recent projects
4. Returns `ApiResponse<Project>` to renderer
5. Store sets `currentProject`, navigates to ProjectOverview

**Close Project**:
1. User navigates back to launcher or triggers close
2. Store calls `window.api.closeProject(projectId)`
3. Main process: `ProjectService.closeProject()`:
   - Sets `isActive = false`
   - Saves project to disk
   - Releases lock
   - Clears active project reference
4. Store sets `currentProject = null`

**Delete Project**:
- **From recent only**: `window.api.deleteProject(projectId)` removes from ConfigService
- **From disk**: `window.api.deleteProjectFromDisk(projectId, projectDirectory)` removes from ConfigService AND deletes project directory

---

## 9. Security & Validation

### Input Validation

**Project Name**:
```typescript
// FileSystemService validates names before directory creation
private isValidFileName(fileName: string): boolean {
  const invalidChars = /[<>:"/\\|?*]/
  return !invalidChars.test(fileName)
}
```

**File Paths**:
```typescript
// FileSystemService.validateFilePath
async validateFilePath(filePath: string): Promise<boolean> {
  if (!filePath || filePath.trim() === '') {
    throw new Error('Invalid file path: path cannot be empty')
  }
  if (!await fs.pathExists(filePath)) {
    throw new Error(`File does not exist: ${filePath}`)
  }
  const stats = await fs.stat(filePath)
  if (!stats.isFile()) {
    throw new Error(`Path is not a file: ${filePath}`)
  }
  return true
}
```

### Project Lock File

**Lock Creation** (LockService):
```typescript
const lock: ProjectLock = {
  projectId,
  lockedBy: {
    pid: process.pid,
    hostname: os.hostname(),
  },
  lockedAt: new Date(),
}

const lockFilePath = path.join(projectDir, '.lock')
await fs.writeJson(lockFilePath, lock, { spaces: 2 })
```

**Stale Lock Detection**:
```typescript
async isLockStale(lock: ProjectLock): Promise<boolean> {
  // Stale if lock > 24 hours old
  const STALE_LOCK_TIMEOUT = 24 * 60 * 60 * 1000
  const lockAge = Date.now() - new Date(lock.lockedAt).getTime()
  if (lockAge > STALE_LOCK_TIMEOUT) return true

  // Stale if owning process no longer exists
  try {
    process.kill(lock.lockedBy.pid, 0)
    return false // Process exists
  } catch {
    return true // Process doesn't exist
  }
}
```

### Sanitization

**File Name Sanitization** (FileSystemService):
```typescript
sanitizeFileName(fileName: string): string {
  let sanitized = fileName.replace(/[<>:"/\\|?*]/g, '')
  sanitized = sanitized.trim()
  return sanitized
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
- Project directory already exists

**Lock Errors**:
- Project already open (locked by another process)
- Stale lock detection and cleanup

**Validation Errors**:
- Invalid project name (contains filesystem-invalid characters)
- Empty or missing required fields
- Invalid JSON in project file

### Error Response Pattern

All IPC handlers catch errors and return `ApiResponse` with `success: false`:

```typescript
try {
  const result = await service.doSomething()
  return { success: true, data: result }
} catch (error) {
  console.error('Operation failed:', error)
  return {
    success: false,
    error: error instanceof Error ? error.message : 'Operation failed',
  }
}
```

The Zustand store checks `response.success` and sets `error` state for UI display.

---

## 11. Testing Strategy

### Approach

Following the project's pragmatic testing philosophy: test business logic only, skip UI tests. Use `yarn build` for full build verification.

### Unit Tests

**ProjectService Tests**:
```typescript
describe('ProjectService', () => {
  describe('createProject', () => {
    it('should create project with valid inputs', async () => {
      const project = await projectService.createProject('Test Project', '/tmp/test-location')
      expect(project.name).toBe('Test Project')
      expect(project.id).toBeDefined()
      expect(project.songs).toEqual([])
      expect(project.isActive).toBe(true)
      expect(project.mixMetadata.tags).toEqual([])
    })

    it('should reject invalid project name', async () => {
      await expect(
        projectService.createProject('Invalid<Name', '/tmp')
      ).rejects.toThrow()
    })
  })

  describe('getProjectStats', () => {
    it('should calculate stats from songs', async () => {
      const stats = await projectService.getProjectStats(projectId)
      expect(stats.totalSongs).toBe(project.songs.length)
      expect(stats.formatBreakdown).toBeDefined()
    })
  })
})
```

**LockService Tests**:
```typescript
describe('LockService', () => {
  it('should acquire and release lock', async () => {
    const lock = await lockService.acquireLock(projectId, projectDir)
    expect(lock.projectId).toBe(projectId)
    expect(lock.lockedBy.pid).toBe(process.pid)

    await lockService.releaseLock(projectId, projectDir)
    const isLocked = await lockService.isLocked(projectId, projectDir)
    expect(isLocked).toBe(false)
  })

  it('should detect stale locks', async () => {
    const staleLock: ProjectLock = {
      projectId: 'test',
      lockedBy: { pid: 999999, hostname: 'old-machine' },
      lockedAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
    }
    expect(await lockService.isLockStale(staleLock)).toBe(true)
  })
})
```

---

## 12. Architecture Decisions

### ADR-007: JSON File Format for Projects

**Status**: Accepted

**Decision**: Use JSON files (`project.json`) for project storage.

**Rationale**:
- Human-readable and debuggable
- Easy to version control
- Simple serialization/deserialization
- Cross-platform compatible
- No additional dependencies

**Consequences**:
- Must handle Date serialization manually (ISO strings on disk, Date objects in memory)
- Not optimal for very large projects (>1000 songs)
- Entire file must be loaded into memory

### ADR-008: Single Active Project

**Status**: Accepted

**Decision**: Only one project can be active at a time.

**Rationale**:
- Simpler state management
- Reduced memory usage
- Clearer user mental model (similar to DAW/video editor patterns)
- Easier to implement auto-save and locking

**Consequences**:
- Users must close current project to open another
- Cannot copy/move items between projects easily

### ADR-009: External File Support

**Status**: Accepted

**Decision**: Allow users to add external audio files from anywhere on their system.

**Rationale**:
- Greater flexibility for users with existing music libraries
- Not all music is available via torrents
- Common pattern in music software

**Consequences**:
- Must validate external file paths
- Files may be moved/deleted outside app
- Project portability is reduced (external references break)

### ADR-010: Project Locking

**Status**: Accepted

**Decision**: Use `.lock` file with process PID and stale lock detection.

**Rationale**:
- Prevents data corruption from concurrent writes
- Simple file-based implementation
- Can detect stale locks from crashes via process.kill(pid, 0)

**Consequences**:
- Must handle stale lock cleanup (24-hour timeout + process existence check)
- Lock file must be cleaned up on close
- Network file systems may have issues with lock detection

### ADR-011: Lean Project File

**Status**: Accepted

**Decision**: Keep `project.json` focused on project identity, songs, and mix metadata. Search history, torrent collections, and other per-project data are stored in separate JSON files within the project directory.

**Rationale**:
- Keeps the core project file small and fast to read/write
- Different data has different update frequencies
- Separates user-curated content from transient/cached data
- Each feature can manage its own persistence independently

**Consequences**:
- Multiple files to manage per project
- Must coordinate cleanup when project is deleted from disk

### ADR-012: Global Torrent Manager

**Status**: Accepted

**Decision**: Global torrent manager shared across projects. Download paths are stored per-project in ConfigService with key `webtorrent-download-path:{projectId}`.

**Rationale**:
- Allows torrents to continue when project closes
- Avoids duplicate downloads
- Centralized download management
- Better resource utilization

**Consequences**:
- Torrents persist after project closes
- Need to filter torrents by project in UI
- Download path configuration stored in electron-store, not in project.json

---

**End of Document**
