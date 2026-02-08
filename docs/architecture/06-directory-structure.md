# Directory Structure

This document describes the directory structure and module organization for the application.

## 5. Directory Structure

```
electron-app/
├── .vscode/
│   ├── launch.json              # Debug configurations
│   └── settings.json            # Editor settings
│
├── src/
│   ├── main/                    # Main process (Node.js)
│   │   ├── index.ts             # Entry point
│   │   ├── window.ts            # Window management
│   │   ├── menu.ts              # Application menu
│   │   │
│   │   ├── ipc/                 # IPC handlers
│   │   │   ├── index.ts         # Register all handlers
│   │   │   ├── app-handlers.ts
│   │   │   ├── project-handlers.ts   # Project management
│   │   │   ├── auth-handlers.ts
│   │   │   ├── search-handlers.ts
│   │   │   ├── torrent-handlers.ts   # Torrent file operations
│   │   │   ├── webtorrentHandlers.ts # WebTorrent download queue
│   │   │   ├── file-handlers.ts
│   │   │   └── settings-handlers.ts
│   │   │
│   │   ├── services/            # Business logic
│   │   │   ├── project.service.ts    # Project CRUD operations
│   │   │   ├── auth.service.ts       # Authentication management
│   │   │   ├── search.service.ts     # Search orchestration
│   │   │   ├── scraper.service.ts    # Web scraping with Puppeteer
│   │   │   ├── torrent.service.ts    # Torrent download engine
│   │   │   ├── WebTorrentService.ts  # WebTorrent download queue manager
│   │   │   ├── download.service.ts   # Download queue management
│   │   │   ├── audiofile.service.ts  # Audio file management
│   │   │   ├── credential.service.ts # Secure credential storage
│   │   │   ├── results.service.ts    # Results caching & export
│   │   │   ├── file.service.ts
│   │   │   ├── settings.service.ts
│   │   │   └── logger.service.ts
│   │   │
│   │   ├── types/               # Type declarations for untyped packages
│   │   │   └── webtorrent.d.ts  # WebTorrent client type definitions
│   │   │
│   │   └── utils/               # Main utilities
│   │       └── validation.ts
│   │
│   ├── renderer/                # Renderer process (React)
│   │   ├── index.html           # HTML entry
│   │   ├── index.tsx            # React entry
│   │   ├── App.tsx              # Root component
│   │   │
│   │   ├── pages/               # Page components
│   │   │   ├── Welcome.tsx           # Project selection/creation
│   │   │   ├── Login.tsx             # RuTracker authentication
│   │   │   ├── Dashboard.tsx         # Main project dashboard
│   │   │   ├── Search.tsx            # Torrent search interface (Component 1)
│   │   │   ├── Downloads.tsx         # Download manager (Component 2)
│   │   │   ├── Library.tsx           # Downloaded files library
│   │   │   ├── Mixer.tsx             # Music mixing interface (Component 3 - TBD)
│   │   │   └── Settings.tsx          # Application settings
│   │   │
│   │   ├── components/          # UI components
│   │   │   ├── common/          # Shared components
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── Modal.tsx
│   │   │   │   ├── ProgressBar.tsx
│   │   │   │   ├── Table.tsx
│   │   │   │   └── LogViewer.tsx         # Real-time log display
│   │   │   │
│   │   │   └── features/        # Feature components
│   │   │       ├── ProjectManager/
│   │   │       │   ├── ProjectList.tsx
│   │   │       │   ├── ProjectCard.tsx
│   │   │       │   ├── CreateProjectDialog.tsx
│   │   │       │   └── ProjectSettings.tsx
│   │   │       ├── QueryInput/
│   │   │       │   ├── QueryList.tsx
│   │   │       │   ├── QueryEditor.tsx
│   │   │       │   └── FileImporter.tsx
│   │   │       ├── SearchProgress/
│   │   │       │   ├── ProgressDisplay.tsx
│   │   │       │   ├── StatusIndicator.tsx
│   │   │       │   └── ActivityLog.tsx   # Real-time activity log
│   │   │       ├── BrowserView/
│   │   │       │   └── BrowserContainer.tsx # Embedded browser display
│   │   │       ├── ErrorHandling/
│   │   │       │   ├── ErrorDialog.tsx    # User choice on errors
│   │   │       │   └── RetryOptions.tsx
│   │   │       ├── SearchResults/
│   │   │       │   ├── ResultsTable.tsx
│   │   │       │   ├── ResultCard.tsx
│   │   │       │   ├── AddToDownloadButton.tsx
│   │   │       │   └── ExportButton.tsx
│   │   │       ├── torrent/
│   │   │       │   ├── index.ts              # Barrel exports
│   │   │       │   ├── TorrentCollection.tsx  # Collected torrents list
│   │   │       │   ├── CollectedTorrentItem.tsx # Single collected torrent
│   │   │       │   ├── DownloadQueue.tsx       # WebTorrent queue container
│   │   │       │   ├── DownloadQueueItem.tsx   # Single queue item with progress
│   │   │       │   ├── DownloadManager.tsx     # Legacy .torrent downloads
│   │   │       │   └── TorrentSettings.tsx     # Torrent + WebTorrent settings
│   │   │       ├── AudioLibrary/
│   │   │       │   ├── FileList.tsx
│   │   │       │   ├── FileCard.tsx
│   │   │       │   ├── AudioPlayer.tsx
│   │   │       │   ├── FileMetadata.tsx
│   │   │       │   └── LibrarySearch.tsx
│   │   │       └── Mixer/ # Component 3 - TBD
│   │   │           └── MixerInterface.tsx
│   │   │
│   │   ├── hooks/               # Custom React hooks
│   │   │   ├── useAuth.ts            # Authentication hook
│   │   │   ├── useSearch.ts          # Search operations hook
│   │   │   ├── useDownloadQueueListener.ts # WebTorrent progress/status events
│   │   │   ├── useSettings.ts
│   │   │   └── useIpc.ts
│   │   │
│   │   ├── store/               # Zustand stores
│   │   │   ├── index.ts
│   │   │   ├── useProjectStore.ts    # Current project state
│   │   │   ├── useAuthStore.ts       # Auth state
│   │   │   ├── useSearchStore.ts     # Search state & results
│   │   │   ├── useTorrentStore.ts    # Torrent downloads & queue
│   │   │   ├── downloadQueueStore.ts # WebTorrent download queue state
│   │   │   ├── torrentCollectionStore.ts # Per-project torrent collection
│   │   │   ├── useLibraryStore.ts    # Audio library
│   │   │   ├── useMixerStore.ts      # Mixer state (Component 3 - TBD)
│   │   │   ├── useAppStore.ts
│   │   │   └── useSettingsStore.ts
│   │   │
│   │   ├── services/            # API wrappers
│   │   │   └── api.ts
│   │   │
│   │   ├── styles/              # Global styles
│   │   │   └── global.css
│   │   │
│   │   └── types/               # Renderer types
│   │       └── index.ts
│   │
│   ├── preload/                 # Preload scripts
│   │   ├── index.ts             # Main preload
│   │   └── types.ts             # Window API types
│   │
│   └── shared/                  # Shared code
│       ├── types/               # Shared types
│       │   ├── app.types.ts
│       │   ├── project.types.ts      # Project structure
│       │   ├── auth.types.ts         # Auth & credentials
│       │   ├── search.types.ts       # Search queries & results
│       │   ├── torrent.types.ts      # Torrent downloads
│       │   ├── audiofile.types.ts    # Audio files & library
│       │   ├── mixer.types.ts        # Mixer (Component 3 - TBD)
│       │   ├── file.types.ts
│       │   └── ipc.types.ts
│       ├── constants.ts              # App constants, IPC channels
│       └── schemas/             # Zod validation schemas
│           ├── index.ts
│           ├── project.schema.ts
│           ├── auth.schema.ts
│           ├── search.schema.ts
│           └── torrent.schema.ts
│
├── resources/                   # App resources
│   └── icons/
│       ├── icon.icns           # macOS
│       ├── icon.ico            # Windows
│       └── icon.png
│
├── dist/                        # Build output
├── release/                     # Release builds
│
├── tests/                       # Integration & E2E tests only
│   ├── integration/            # Cross-module integration tests
│   │   ├── ipc/
│   │   ├── features/
│   │   └── services/
│   └── e2e/                    # End-to-end Playwright tests
│       ├── tests/
│       └── fixtures/
│
│   # Note: Unit tests are colocated with source files
│   # Example: src/renderer/components/Button.tsx
│   #          src/renderer/components/Button.test.tsx
│
├── package.json
├── tsconfig.json
├── tsconfig.main.json
├── tsconfig.renderer.json
├── tsconfig.preload.json
├── vite.config.ts              # Vite for renderer
├── electron-builder.yml
└── README.md
```

### Module Organization Strategy
**Hybrid approach**: Feature-based organization within each process layer
- Clear separation by process type (main/renderer/preload/shared)
- Feature-based grouping within renderer (components, pages)
- Service layer pattern for business logic
- Shared types and utilities across processes
