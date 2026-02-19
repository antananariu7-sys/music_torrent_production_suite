# Directory Structure

This document describes the directory structure and module organization for the application.

## 5. Directory Structure

```
music_production_suite/
├── .vscode/
│   ├── launch.json              # Debug configurations
│   └── settings.json            # Editor settings
│
├── scripts/
│   ├── build-main.mjs           # esbuild script for main process
│   └── build-preload.mjs        # esbuild script for preload
│
├── src/
│   ├── main/                    # Main process (Node.js)
│   │   ├── index.ts             # Entry point
│   │   ├── window.ts            # Window management
│   │   │
│   │   ├── ipc/                 # IPC handlers
│   │   │   ├── index.ts         # Register all handlers
│   │   │   ├── appHandlers.ts
│   │   │   ├── authHandlers.ts
│   │   │   ├── projectHandlers.ts
│   │   │   ├── searchHandlers.ts
│   │   │   ├── musicBrainzHandlers.ts
│   │   │   ├── torrentHandlers.ts
│   │   │   ├── torrentMetadataHandlers.ts
│   │   │   ├── webtorrentHandlers.ts
│   │   │   └── audioHandlers.ts
│   │   │
│   │   ├── services/            # Business logic
│   │   │   ├── AuthService.ts            (+ AuthService.spec.ts)
│   │   │   ├── ConfigService.ts          (+ ConfigService.spec.ts)
│   │   │   ├── DiscographySearchService.ts (+ DiscographySearchService.spec.ts)
│   │   │   ├── FileSystemService.ts      (+ FileSystemService.spec.ts)
│   │   │   ├── LockService.ts            (+ LockService.spec.ts)
│   │   │   ├── MusicBrainzService.ts     (+ MusicBrainzService.spec.ts)
│   │   │   ├── ProjectService.ts         (+ ProjectService.spec.ts)
│   │   │   ├── RuTrackerSearchService.ts (+ RuTrackerSearchService.spec.ts)
│   │   │   ├── SearchHistoryService.ts   (+ SearchHistoryService.spec.ts)
│   │   │   ├── TorrentCollectionService.ts (+ TorrentCollectionService.spec.ts)
│   │   │   ├── TorrentDownloadService.ts (+ TorrentDownloadService.spec.ts)
│   │   │   ├── TorrentMetadataService.ts
│   │   │   ├── WebTorrentService.ts      (+ WebTorrentService.spec.ts)
│   │   │   │
│   │   │   ├── rutracker/       # RuTracker search internals
│   │   │   │   ├── filters/
│   │   │   │   │   └── SearchFilters.ts       (+ SearchFilters.spec.ts)
│   │   │   │   ├── scrapers/
│   │   │   │   │   ├── ResultParser.ts
│   │   │   │   │   ├── PaginationHandler.ts
│   │   │   │   │   └── PageScraper.ts
│   │   │   │   └── utils/
│   │   │   │       ├── formatDetector.ts      (+ formatDetector.spec.ts)
│   │   │   │       ├── relevanceScorer.ts     (+ relevanceScorer.spec.ts)
│   │   │   │       ├── resultGrouper.ts       (+ resultGrouper.spec.ts)
│   │   │   │       ├── sizeParser.ts          (+ sizeParser.spec.ts)
│   │   │   │       ├── torrentPageParser.ts   (+ torrentPageParser.spec.ts)
│   │   │   │       └── urlBuilder.ts
│   │   │   │
│   │   │   └── utils/           # Service utilities
│   │   │       └── retryWithBackoff.ts        (+ retryWithBackoff.spec.ts)
│   │   │
│   │   └── types/               # Type declarations for untyped packages
│   │       └── webtorrent.d.ts
│   │
│   ├── renderer/                # Renderer process (React)
│   │   ├── index.html           # HTML entry
│   │   ├── index.tsx            # React entry
│   │   ├── App.tsx              # Root component
│   │   ├── window.d.ts          # Window API types (auto-derives from preload)
│   │   │
│   │   ├── pages/               # Page components
│   │   │   ├── ProjectLauncher/          # Project selection/creation
│   │   │   │   ├── index.tsx
│   │   │   │   ├── ProjectLauncher.styles.tsx
│   │   │   │   └── components/
│   │   │   │       ├── CreateProjectCard.tsx
│   │   │   │       ├── LauncherFooter.tsx
│   │   │   │       ├── LauncherHeader.tsx
│   │   │   │       ├── OpenProjectCard.tsx
│   │   │   │       ├── RecentProjectCard.tsx
│   │   │   │       ├── RecentProjectsSection.tsx
│   │   │   │       └── test-utils.tsx
│   │   │   │
│   │   │   ├── ProjectOverview/          # Main project dashboard (tabbed)
│   │   │   │   ├── index.tsx
│   │   │   │   ├── ProjectOverview.styles.tsx
│   │   │   │   ├── utils.ts              (+ utils.spec.ts)
│   │   │   │   └── components/
│   │   │   │       ├── MetadataSection.tsx
│   │   │   │       ├── ProjectHeader.tsx
│   │   │   │       ├── SearchSection.tsx
│   │   │   │       ├── SongsList.tsx
│   │   │   │       ├── StatsGrid.tsx
│   │   │   │       └── tabs/
│   │   │   │           ├── index.ts
│   │   │   │           ├── MixTab.tsx
│   │   │   │           ├── SearchTab.tsx
│   │   │   │           └── TorrentTab.tsx
│   │   │   │
│   │   │   └── Settings/                # Application settings
│   │   │       ├── index.tsx
│   │   │       ├── Settings.styles.tsx
│   │   │       └── components/
│   │   │           ├── AdvancedSettings.tsx
│   │   │           ├── DebugSettings.tsx
│   │   │           ├── GeneralSettings.tsx
│   │   │           ├── RuTrackerAuthCard.tsx
│   │   │           ├── SearchSettings.tsx
│   │   │           └── WebTorrentSettings.tsx
│   │   │
│   │   ├── components/          # UI components
│   │   │   ├── common/          # Shared components
│   │   │   │   ├── index.ts             # Barrel exports
│   │   │   │   ├── AudioPlayer.tsx
│   │   │   │   ├── ConfirmDialog.tsx
│   │   │   │   ├── DeleteProjectDialog.tsx
│   │   │   │   ├── ErrorAlert.tsx
│   │   │   │   ├── Footer.tsx
│   │   │   │   ├── FrequencyBars.tsx
│   │   │   │   ├── Layout.tsx
│   │   │   │   ├── PageLayout.tsx
│   │   │   │   └── Waveform.tsx
│   │   │   │
│   │   │   ├── features/        # Feature components
│   │   │   │   ├── search/
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── ActivityLog.tsx
│   │   │   │   │   ├── AlbumSelectionDialog.tsx
│   │   │   │   │   ├── DiscographyScanPanel.tsx
│   │   │   │   │   ├── InlineSearchResults.tsx
│   │   │   │   │   ├── SearchClassificationDialog.tsx
│   │   │   │   │   ├── SearchCompletionNotice.tsx
│   │   │   │   │   ├── SearchErrorNotice.tsx
│   │   │   │   │   ├── SearchHistory.tsx
│   │   │   │   │   ├── SearchLoadingIndicator.tsx
│   │   │   │   │   ├── SmartSearch.tsx
│   │   │   │   │   ├── SmartSearchBar.tsx
│   │   │   │   │   ├── TorrentResultsDialog.tsx
│   │   │   │   │   ├── TorrentTrackListPreview.tsx
│   │   │   │   │   └── useSmartSearchWorkflow.ts
│   │   │   │   │
│   │   │   │   └── torrent/
│   │   │   │       ├── index.ts
│   │   │   │       ├── CollectedTorrentItem.tsx
│   │   │   │       ├── DownloadManager.tsx
│   │   │   │       ├── DownloadQueue.tsx
│   │   │   │       ├── DownloadQueueItem.tsx
│   │   │   │       ├── FileSelectionDialog.tsx
│   │   │   │       ├── TorrentActivityLog.tsx
│   │   │   │       ├── TorrentCollection.tsx
│   │   │   │       └── TorrentSettings.tsx
│   │   │   │
│   │   │   └── ui/              # Chakra UI primitives
│   │   │       ├── checkbox.tsx
│   │   │       ├── slider.tsx
│   │   │       └── toaster.tsx
│   │   │
│   │   ├── hooks/               # Custom React hooks
│   │   │   └── useDownloadQueueListener.ts
│   │   │
│   │   ├── store/               # Zustand stores
│   │   │   ├── useProjectStore.ts
│   │   │   ├── useAuthStore.ts
│   │   │   ├── useSearchStore.ts
│   │   │   ├── useSettingsStore.ts
│   │   │   ├── useThemeStore.ts
│   │   │   ├── smartSearchStore.ts      (+ smartSearchStore.spec.ts)
│   │   │   ├── downloadQueueStore.ts
│   │   │   ├── torrentCollectionStore.ts
│   │   │   ├── audioPlayerStore.ts
│   │   │   ├── fileSelectionStore.ts
│   │   │   └── torrentActivityStore.ts
│   │   │
│   │   ├── utils/               # Renderer utilities
│   │   │   └── audioUtils.ts
│   │   │
│   │   ├── theme/               # Chakra UI theme
│   │   │   └── index.ts
│   │   │
│   │   └── styles/              # Global styles
│   │       └── global.css
│   │
│   ├── preload/                 # Preload scripts
│   │   ├── index.ts             # Main preload (exposes API to renderer)
│   │   └── types.ts             # Preload API types
│   │
│   ├── shared/                  # Shared code (main + renderer)
│   │   ├── constants.ts         # App constants, IPC channels
│   │   ├── types/               # Shared type definitions
│   │   │   ├── app.types.ts
│   │   │   ├── auth.types.ts
│   │   │   ├── discography.types.ts
│   │   │   ├── musicbrainz.types.ts
│   │   │   ├── project.types.ts
│   │   │   ├── search.types.ts
│   │   │   ├── searchHistory.types.ts
│   │   │   ├── torrent.types.ts
│   │   │   └── torrentMetadata.types.ts
│   │   ├── schemas/             # Zod validation schemas
│   │   │   ├── index.ts
│   │   │   ├── project.schema.ts
│   │   │   ├── search.schema.ts
│   │   │   └── torrent.schema.ts
│   │   └── utils/               # Shared utilities
│   │       ├── resultClassifier.ts
│   │       └── songMatcher.ts
│   │
│   └── test/                    # Test infrastructure
│       └── setup.ts
│
│   # Note: Unit tests are colocated with source files
│   # Example: src/main/services/AuthService.ts
│   #          src/main/services/AuthService.spec.ts
│
├── docs/                        # Documentation
│   ├── README.md
│   ├── architecture/            # Architecture docs (01-15)
│   ├── guides/                  # Development guides
│   └── api/                     # API reference
│
├── dist/                        # Build output
├── release/                     # Release builds
│
├── package.json
├── yarn.lock
├── tsconfig.json
├── tsconfig.main.json
├── tsconfig.renderer.json
├── tsconfig.preload.json
├── vite.config.ts               # Vite for renderer
├── jest.config.ts               # Jest for renderer tests
├── jest.config.main.ts          # Jest for main process tests
├── AGENTS.md
├── ARCHITECTURE.md
└── README.md
```

### Module Organization Strategy
**Hybrid approach**: Feature-based organization within each process layer
- Clear separation by process type (main/renderer/preload/shared)
- Feature-based grouping within renderer components (`features/search/`, `features/torrent/`)
- Page components use co-located subcomponents and styles (`pages/ProjectLauncher/components/`)
- PascalCase naming for all main process services
- Service layer pattern for business logic with colocated unit tests (`.spec.ts` convention — never `.test.ts`)
- Shared types, schemas, and utilities across processes via `src/shared/`
- Chakra UI primitive wrappers in `components/ui/`
