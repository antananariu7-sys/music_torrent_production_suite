# Music Production Suite - Domain Context

## What the App Does

Desktop application (Electron) for curating DJ/producer mixes. Users search for music via RuTracker, download via WebTorrent, and assemble ordered tracklists (mixes) within projects.

## Core Entities

### Project
Self-contained workspace stored as a directory:
- `project.json` — metadata, songs[], mix metadata
- `assets/covers/` — cover images
- `assets/audio/` — local audio files
- `search-history.json` — per-project search log
- `torrent-collection.json` — saved torrents
- `.lock` — prevents concurrent access
- Only one project open at a time

### Song
Audio track in a mix:
- title, artist, album, duration, format
- `downloadId` (torrent origin) OR `externalFilePath` (user file)
- Audio metadata: bitrate, sample rate, channels, codec
- `order` field for mix position

### MixMetadata
High-level mix info: title, description, cover art, tags, genre, estimated duration.

### SearchResult
Torrent found on RuTracker: title, author, size, seeders/leechers, URL, category, detected format.

### CollectedTorrent
Torrent saved to a project for later download: magnet link, metadata, project association.

### QueuedTorrent
Active download: status lifecycle (queued -> downloading -> seeding/completed/error), real-time metrics (speed, progress, ratio, peers), file selection.

### AudioMetadata
Extracted from files: duration, format, bitrate, sample rate, channels, ID3 tags.

## Current Pages

1. **ProjectLauncher** — Landing page. Create/open projects, recent projects list.
2. **ProjectOverview** — Main workspace with tabs:
   - **SearchTab** — Find torrents on RuTracker, filter by format/seeders, collect results
   - **TorrentTab** — Active downloads, file selection, progress tracking, seeding
   - **MixTab** — Tracklist manager: add/remove/reorder songs, inline metadata editing, playback
3. **Settings** — App config: theme, RuTracker auth, WebTorrent limits, debug options.

## Key Workflows

### Search -> Download -> Mix
1. User searches RuTracker (query + optional filters)
2. Collects interesting torrents (saved to project)
3. Downloads selected torrents (WebTorrent, with file selection)
4. Adds completed songs to mix tracklist
5. Reorders, edits metadata, sets cover art
6. Previews mix via built-in AudioPlayer

### Project Lifecycle
Create -> Open (acquire lock) -> Work (auto-save) -> Close (release lock) -> Return to launcher

## Tech Stack
- Electron 40 + React + Chakra UI v3 + Zustand + TypeScript
- esbuild (CJS main/preload), Vite (renderer)
- IPC: `ipcMain.handle()` / `ipcRenderer.invoke()` for request-response
- electron-store for persistent config
- WebTorrent for P2P downloads
- music-metadata for audio analysis

## Design Constraints
- Single project open at a time
- Per-project download directories (configurable)
- Songs can come from torrents OR external files (dual source tracking)
- Built-in playback (no external DAW needed for preview)
- Chakra UI v3 only (no Tailwind)
- Semantic color tokens for theming
