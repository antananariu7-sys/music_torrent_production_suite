# Application Overview and Component Architecture

This document covers the application overview and component architecture.

## 1. Application Overview

### Purpose
**Comprehensive Music Production Suite** with integrated torrent search, download management, and music mixing capabilities. The application operates on a project-based workflow (similar to DAWs like Ableton or video editors like Premiere Pro), where each project contains:
1. Torrent search results for finding music
2. Downloaded and managed torrent files
3. Music mixing sessions using downloaded content

### Target Users
- **DJs** and music producers needing to acquire and mix music tracks
- **Music curators** building collections from torrent sources
- **Content creators** searching, downloading, and mixing audio content
- **Hobbyists** managing personal music libraries

### Application Components

**Component 1: Torrent Search Engine**
- Automated RuTracker search (single query, batch processing future)
- Authentication with CAPTCHA support and session persistence
- Session restoration across app restarts
- Background session validation
- Result extraction with torrent metadata (seeders, leechers, size)

**Component 2: Torrent Download Manager**
- Integrated torrent client (WebTorrent or similar)
- Download queue management
- Seeding/sharing capabilities
- File organization and storage
- Download progress tracking
- File verification and health monitoring

**Component 3: Music Mixer** *(Details TBD)*
- Audio file mixing and editing
- Integration with downloaded torrent content
- Project-based workflow
- Export mixed audio

### Project-Based Workflow
- Each **project** is a self-contained workspace
- Projects store: search results, download queue, downloaded files, mixing sessions
- Import/export projects for portability
- Auto-save and version control within projects

### Key Features
- **Project Management**: Create, save, load music production projects
- **Bulk Torrent Search**: Find multiple music tracks simultaneously
- **Torrent Management**: Download, seed, and organize torrent files
- **Music Mixing**: Mix and edit downloaded audio files *(Component 3 - TBD)*
- **Authenticated Sessions**: Secure RuTracker login with credential storage
- **Real-time Monitoring**: Progress tracking for searches, downloads, and processing
- **Cross-platform Support**: Works on Windows and macOS

### Technical Requirements
- **Platform Support**: Windows 10/11, macOS 10.13+
- **Runtime Environment**: Node.js >=25.0.0, ES Modules
- **Performance**:
  - Handle batch searches efficiently
  - Concurrent torrent downloads (5-10 simultaneous)
  - Real-time audio processing for mixing
  - Responsive UI during background operations
- **Security**:
  - Secure credential storage (encrypted)
  - Context isolation enabled, no node integration in renderer
  - Safe handling of downloaded torrent files
  - Sandboxed torrent client
- **Reliability**:
  - Handle network failures, rate limiting, session timeouts
  - Resume interrupted downloads
  - Project auto-save and crash recovery
- **Storage**:
  - Efficient file organization for downloaded content
  - Project metadata and state persistence
  - Configurable download directory
- **Scalability**:
  - Support large lists of search strings (100+ items)
  - Manage hundreds of downloaded files per project
  - Handle multiple active projects

### Build System & Tooling

**Package Manager**: Yarn (exact version locking)

**Build Tools**:
- **Vite 5.4.21**: Renderer process build tool
  - Fast HMR (Hot Module Replacement) in development
  - Optimized production builds with code splitting
  - Target: `esnext` for modern JavaScript features
  - Dev server on port 5173
  - Path aliases: `@/` → `src/renderer/`, `@shared/` → `src/shared/`

- **esbuild 0.27.2**: Main/preload process bundler
  - Fast TypeScript compilation and bundling
  - Main process: Bundled as CommonJS (`format: 'cjs'`) to `dist/main/index.cjs`
  - Preload process: Bundled as CommonJS to `dist/preload/index.cjs`
  - Target: `node25` matching engine requirement
  - Path aliases: `@shared` → `src/shared/`
  - External dependencies: All runtime modules kept external (electron, puppeteer-core, cheerio, webtorrent, music-metadata, electron-store, csv-stringify, uuid)
  - Sourcemaps enabled in development, minification in production
  - Custom build scripts: `scripts/build-main.mjs`, `scripts/build-preload.mjs`

**Development Workflow**:
```bash
yarn dev          # Build main+preload, start Vite dev server, launch Electron
yarn build        # Production build (renderer → vite, main+preload → esbuild)
yarn package      # Build + electron-builder packaging
```

**TypeScript Configuration**:
- Strict type checking enabled
- Separate `tsconfig.json` for main/renderer/preload processes
- ES Modules with `"type": "module"` in package.json
- Node.js 25+ target for latest ECMAScript features

## 1.1 Component Architecture

### Component Interaction Flow

```
┌─────────────────────────────────────────────────────────────┐
│                         PROJECT                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                                                         │ │
│  │  ┌──────────────┐   ┌──────────────┐   ┌───────────┐  │ │
│  │  │   Component  │   │  Component   │   │Component  │  │ │
│  │  │   1: Search  │──▶│  2: Download │──▶│ 3: Mix    │  │ │
│  │  │              │   │   Manager    │   │           │  │ │
│  │  └──────────────┘   └──────────────┘   └───────────┘  │ │
│  │        │                   │                  │        │ │
│  │        ▼                   ▼                  ▼        │ │
│  │  Search Results      Downloaded Files    Mixed Audio   │ │
│  │                                                         │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Component 1: Torrent Search Engine
**Responsibilities**:
- RuTracker authentication with CAPTCHA support
- Session persistence and automatic restoration
- Background session validation (every 5 minutes)
- Single-query torrent search (batch processing planned for future)
- Result extraction (torrent links, metadata: seeders, leechers, size, author)
- Search result storage within project (via Zustand store)
- Direct URL navigation for efficient searching

**Outputs**: List of torrent search results with topic URLs and metadata

**Current Implementation Status**:
- ✅ Authentication with session persistence
- ✅ Single-query search
- ✅ Result parsing and display
- ⏳ Batch search processing (planned)
- ⏳ Pagination support (planned)
- ⏳ Export search results (planned)

### Component 2: Torrent Download Manager
**Responsibilities**:
- Add torrents to download queue from search results
- WebTorrent-based download engine
- Download progress monitoring
- Seeding/sharing management
- File organization and storage
- Download history tracking
- File health monitoring (seeders/leechers)

**Inputs**: Torrent URLs from Component 1
**Outputs**: Downloaded audio files available for mixing

### Component 3: Mix Builder *(v0.2 — In Development)*
**Responsibilities**:
- Curated tracklist management (add/reorder/remove songs)
- Play through the mix in order via built-in AudioPlayer
- Inline song metadata editing (title, artist)
- Mix metadata management (title, genre, tags)
- Add audio files from disk or from completed downloads

> Architecture detail: `docs/architecture/16-mixer-component.md`

**Inputs**: Downloaded audio files from Component 2 (or external files)
**Outputs**: Ordered mix/playlist playable in-app

### Component 3b: Audio Mix Export *(Planned)*
**Responsibilities**:
- Export ordered tracklist as a single continuous audio file
- Per-track crossfade controls (0–30s)
- EBU R128 loudness normalization
- WAV / FLAC / MP3 output with .cue sheet
- Background rendering with progress reporting

> Architecture detail: `docs/architecture/17-audio-mix-export.md`
> Feature spec: `docs/features/audio-mix-export.md`

**Inputs**: Ordered mix from Component 3
**Outputs**: Single audio file + optional .cue sheet

### Project Structure
```typescript
Project {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date

  // Component 1 data
  searchResults: SearchResult[]
  searchHistory: SearchQuery[]

  // Component 2 data
  downloadQueue: TorrentDownload[]
  downloadedFiles: AudioFile[]

  // Component 3 data (TBD)
  mixingSessions: MixingSession[]

  // Project settings
  settings: ProjectSettings
  metadata: ProjectMetadata
}
```
