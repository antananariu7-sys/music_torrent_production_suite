# Music Production Suite - Architecture Documentation

**Comprehensive Electron-based music production application** with integrated torrent search, download management, and mixing capabilities.

> **📁 This document serves as an index to the complete architecture documentation.**
> All detailed specifications are organized in the [`docs/`](docs/) directory.

---

## 🎵 Application Overview

A project-based music production suite with three integrated components:

1. **Torrent Search** - RuTracker automation for finding music
2. **Download Manager** - WebTorrent-based download and seeding
3. **Music Mixer** - Audio mixing interface _(TBD)_

**Target Platforms**: Windows 10/11, macOS 10.13+

---

## 📚 Documentation Structure

### Architecture Documentation ([docs/architecture/](docs/architecture/))

Core architecture and system design documents:

| Document | Description |
|----------|-------------|
| [**01-overview.md**](docs/architecture/01-overview.md) | Application purpose, components, project structure |
| [**02-process-architecture.md**](docs/architecture/02-process-architecture.md) | Main/Renderer/Preload process responsibilities |
| [**03-ipc-communication.md**](docs/architecture/03-ipc-communication.md) | IPC channels, patterns, validation strategy |
| [**04-web-automation.md**](docs/architecture/04-web-automation.md) | Puppeteer integration, RuTracker scraping flows |
| [**05-security.md**](docs/architecture/05-security.md) | Security architecture, threats, credential storage |
| [**06-directory-structure.md**](docs/architecture/06-directory-structure.md) | Complete file/folder organization |
| [**07-data-models.md**](docs/architecture/07-data-models.md) | TypeScript interfaces for all data structures |
| [**08-ui-architecture.md**](docs/architecture/08-ui-architecture.md) | React components, pages, styling strategy |
| [**09-dependencies.md**](docs/architecture/09-dependencies.md) | NPM packages and dependency rationale |
| [**10-development-plan.md**](docs/architecture/10-development-plan.md) | 6-phase development roadmap, ADRs |
| [**11-risks-and-success.md**](docs/architecture/11-risks-and-success.md) | Technical risks, success criteria |
| [**15-project-system.md**](docs/architecture/15-project-system.md) | Project-based workflow architecture |
| [**refactoring-plan-project-launcher.md**](docs/architecture/refactoring-plan-project-launcher.md) | Project launcher refactoring plan |
| [**transform-welcome-to-project.md**](docs/architecture/transform-welcome-to-project.md) | Welcome screen transformation plan |

### Development Guides ([docs/guides/](docs/guides/))

Practical implementation guides and best practices:

| Document | Description |
|----------|-------------|
| [**development.md**](docs/guides/development.md) | Code quality, architecture patterns, security practices |
| [**testing.md**](docs/guides/testing.md) | Testing standards, data-testid locators, test patterns |
| [**rutracker-implementation.md**](docs/guides/rutracker-implementation.md) | RuTracker-specific implementation code examples |
| [**enhanced-search.md**](docs/guides/enhanced-search.md) | Enhanced search features, filters, MusicBrainz integration |
| [**smart-search-integration.md**](docs/guides/smart-search-integration.md) | Smart Search workflow, components, and integration guide |
| [**chakra-ui-style-guide.md**](docs/guides/chakra-ui-style-guide.md) | Chakra UI v3 styling standards and patterns |

### API Reference ([docs/api/](docs/api/))

API documentation and quick references:

| Document | Description |
|----------|-------------|
| [**search-api-reference.md**](docs/api/search-api-reference.md) | Quick reference for enhanced search API |

---

## 🚀 Quick Start

### Key Technologies

```json
{
  "electron": "40.1.0",
  "react": "18.3.1",
  "react-router-dom": "6.30.3",
  "@chakra-ui/react": "3.31.0",
  "zustand": "4.5.7",
  "puppeteer-core": "21.11.0",
  "webtorrent": "2.8.5",
  "typescript": "5.9.3",
  "vite": "5.4.21",
  "esbuild": "0.27.2"
}
```

**Package Manager**: Yarn (exact versions locked)
**Node.js Requirement**: >=25.0.0
**Module System**: ES Modules (`"type": "module"`)

### Component Flow

```
Project → Search (RuTracker) → Download (WebTorrent) → Mix (TBD)
```

### Development Phases

1. **Foundation** (Week 1-2) - Project system, IPC infrastructure
2. **Component 1** (Week 3-4) - Search engine
3. **Component 2** (Week 5-6) - Torrent manager
4. **Component 3** (Week 7-8) - Mixer _(details TBD)_
5. **Polish** (Week 9-10) - Testing, optimization
6. **Distribution** (Week 11) - Installers, deployment

---

## 🔑 Key Architecture Decisions

| ADR         | Decision                     | Rationale                                  |
| ----------- | ---------------------------- | ------------------------------------------ |
| **ADR-005** | WebTorrent for downloads     | Pure JS, streaming support, cross-platform |
| **ADR-006** | Project-based architecture   | Organized workflow like DAWs/video editors |
| **ADR-003** | Context isolation enabled    | Security requirement for Electron apps     |
| **ADR-001** | Zustand for state management | Lightweight, TypeScript-friendly           |

See [10-development-plan.md](docs/architecture/10-development-plan.md#architecture-decision-records-adrs) for complete ADRs.

---

## 📋 Project Rules & Standards

For coding standards, commit message format, and development best practices, see:

**→ [AGENTS.md](AGENTS.md)** - Project rules for AI agents and developers

---

## 🎯 Current Implementation Status

### Completed Features

✅ **Authentication System**
- RuTracker login with CAPTCHA support
- Session persistence across app restarts
- Background session validation (5-minute interval)

✅ **Search Engine**
- Single-query search with advanced filters
- Format filtering (MP3, FLAC, WAV, etc.)
- Quality filtering (seeders, file size)
- Smart sorting (relevance, seeders, date, size)
- MusicBrainz album discovery integration

✅ **Smart Search Workflow**
- Automatic search term classification (artist/album/song)
- Multi-step guided workflow with dialogs
- Album selection from MusicBrainz results
- RuTracker result selection
- Search history persistence (per-project, max 50 entries)

✅ **Torrent Management**
- Direct torrent file downloads
- Magnet link extraction and support
- Download history tracking
- Configurable download folder
- Auto-open in torrent client option

✅ **Torrent Collection System**
- Per-project torrent collections
- Collect torrents from search results
- Persistent storage (`torrent-collection.json`)
- Duplicate prevention by torrent ID

✅ **Project System**
- Project creation and management
- Project-scoped data (search history, torrent collections)
- Recent projects list
- Project metadata and statistics

✅ **UI Architecture**
- Tabbed ProjectOverview interface (Search, Torrent, Mix)
- Chakra UI v3 component library
- Dark theme with studio aesthetic
- Responsive layout

✅ **Testing Infrastructure**
- Comprehensive unit tests for services
- Test coverage for RuTracker and MusicBrainz services

✅ **WebTorrent Download Queue**
- In-app torrent downloading via WebTorrent (lazy-loaded ESM)
- FIFO download queue with configurable concurrency (1-10, default 3)
- Real-time progress broadcasting (1s interval) with speed, ETA, peer stats
- Pause/resume/remove controls per torrent
- Queue persistence across app restarts (`webtorrent-queue.json`)
- Configurable speed limits and seed-after-download option
- Integrated flow: Collected Torrent → Download Queue
- File selection dialog for choosing which files to download
- Hierarchical file tree view with folder support in DownloadQueueItem

✅ **Audio Player**
- Fixed bottom audio player for in-app music playback
- Reads audio files through IPC (`audio:read-file`) as base64 data URLs for security
- Click-to-play integration with DownloadQueueItem for completed audio files
- Playlist playback with next/previous navigation
- Auto-expand folder tree when navigating between tracks
- Visual indication (blue highlight, play icon) for currently playing track
- Volume control with mute toggle
- Progress bar with seek functionality
- Supported formats: MP3, FLAC, WAV, M4A, AAC, OGG, Opus, WMA, AIFF, APE

### In Progress

🚧 **Mix Tab** - Audio mixing interface (placeholder)

### Planned

📋 **Music Mixer** - Full audio mixing capabilities
📋 **E2E Testing** - Playwright test automation

---

## 📝 Document Status

- **Version**: 2.4
- **Last Updated**: 2026-02-17
- **Status**: Architecture documentation reviewed and updated to match implementation
- **Recent Updates**:
  - Documentation audit: all architecture docs verified against actual codebase
  - RuTrackerSearchService refactored from 910 to 316 lines (split into `rutracker/` subdirectory)
  - Result grouping, MusicBrainz retry with backoff, torrent page parser implemented
  - TorrentMetadataService with IPC integration added
  - ProjectLauncher refactoring completed (split into subcomponents)
  - Welcome page transformed to ProjectOverview with tabbed interface (Search/Torrent/Mix)
  - Fixed IPC communication docs: all 50+ channels documented with correct signatures
  - Fixed directory structure: reflects actual PascalCase services, 2 pages, feature-based components
  - Fixed data models: all type definitions match actual `src/shared/types/`
  - Fixed security docs: credential storage accurately described
  - Fixed dependency versions to match package.json
  - Fixed guide docs: correct API namespaces (`window.api.search.start()`, etc.)
- **Next Steps**: Audio library with metadata extraction, then Phase 4 (Mixer)

---

## 🔗 Related Documentation

- **[AGENTS.md](AGENTS.md)** - Project rules and conventions for AI agents
- **[.claude/settings.local.json](.claude/settings.local.json)** - Claude Code configuration
- **[README.md](README.md)** - Project README

---

**Architecture by**: Claude Sonnet 4.5 using [architect skill](.claude/skills/architect/)
