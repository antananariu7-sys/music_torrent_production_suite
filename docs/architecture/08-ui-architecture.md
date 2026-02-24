# UI Architecture

This document describes the UI architecture, component structure, and styling strategy.

## 8. UI Architecture

### Framework/Library

- **React 18.3.1** with functional components and hooks
- **TypeScript 5.9.3** for type safety
- **Chakra UI 3.31.0** for component library
- **React Router 6.30.3** for client-side routing
- **Emotion** (CSS-in-JS) required by Chakra UI
- No class components (hooks-based architecture)

### Component Structure

```
src/renderer/
├── pages/                      # Route-level page components
│   ├── ProjectLauncher/        # Project selection/creation (welcome screen)
│   │   └── index.tsx
│   ├── ProjectOverview/        # Main workspace with tabbed interface
│   │   ├── index.tsx           # Tab navigation and layout
│   │   ├── ProjectOverview.styles.tsx
│   │   ├── utils.ts            # Statistics calculation helpers
│   │   └── components/
│   │       ├── ProjectHeader.tsx
│   │       ├── StatsGrid.tsx
│   │       ├── MetadataSection.tsx
│   │       ├── SongsList.tsx
│   │       ├── SearchSection.tsx
│   │       └── tabs/
│   │           ├── SearchTab.tsx   # Smart search workflow
│   │           ├── TorrentTab.tsx  # Torrent collection management
│   │           ├── MixTab.tsx      # Audio mixing (placeholder)
│   │           └── index.ts
│   └── Settings/               # Application settings
│       └── index.tsx
├── components/                 # Reusable UI components
│   ├── common/                 # Layout, footer, shared utilities
│   │   ├── PageLayout.tsx
│   │   ├── Footer.tsx
│   │   ├── AudioPlayer.tsx     # Fixed bottom audio player with controls
│   │   ├── Waveform.tsx
│   │   ├── FrequencyBars.tsx
│   │   ├── ErrorAlert.tsx
│   │   └── ConfirmDialog.tsx
│   └── features/
│       ├── search/             # Smart search components
│       │   ├── SmartSearchBar.tsx       # Search input with auto-classify
│       │   ├── SmartSearch.tsx          # Multi-step search workflow orchestrator
│       │   ├── InlineSearchResults.tsx  # Search results host (renders tabs)
│       │   ├── SearchResultsTabs.tsx    # Album / Discography tab container
│       │   ├── SearchResultsTable.tsx   # Data-dense sortable table with groups
│       │   ├── SearchResultsRow.tsx     # Single result row with actions
│       │   ├── SearchResultsFilter.tsx  # Text filter with debounced input
│       │   ├── SearchResultsPagination.tsx # Page controls + page size selector
│       │   ├── SearchResultsLoadMore.tsx # Load more pages button
│       │   ├── DuplicateWarningBadge.tsx # Orange DUP badge for duplicates
│       │   ├── TorrentTrackListPreview.tsx # Expanded row track list
│       │   ├── SearchClassificationDialog.tsx
│       │   ├── AlbumSelectionDialog.tsx
│       │   ├── DiscographyScanPanel.tsx
│       │   ├── TorrentResultsDialog.tsx
│       │   ├── useSmartSearchWorkflow.ts
│       │   ├── hooks/
│       │   │   ├── useSearchTableState.ts  # Sort, filter, pagination, expansion state
│       │   │   ├── useDuplicateCheck.ts    # Background duplicate detection
│       │   │   ├── useDiscographyScan.ts
│       │   │   ├── useRuTrackerSearch.ts
│       │   │   └── useSearchClassification.ts
│       │   └── index.ts
│       └── torrent/            # Torrent management components
│           ├── TorrentCollection.tsx    # Collected torrents list
│           ├── CollectedTorrentItem.tsx  # Single collected torrent with actions
│           ├── DownloadQueue.tsx         # WebTorrent queue container
│           ├── DownloadQueueItem.tsx     # Queue item with progress/controls
│           ├── DownloadManager.tsx       # Legacy .torrent download history
│           ├── TorrentSettings.tsx       # Torrent + WebTorrent settings
│           └── index.ts
├── theme/                      # Chakra UI theme configuration
│   └── index.ts                # Custom theme with brand colors
├── styles/                     # Global styles
│   └── global.css              # Base CSS reset and globals
├── store/                      # Zustand state stores
│   ├── smartSearchStore.ts     # Multi-step search workflow state
│   ├── torrentCollectionStore.ts # Per-project torrent collection
│   ├── downloadQueueStore.ts   # WebTorrent download queue state
│   ├── audioPlayerStore.ts     # Audio player state (playback, playlist, controls)
│   ├── fileSelectionStore.ts   # Torrent file selection state
│   ├── torrentActivityStore.ts # Torrent activity log
│   ├── useAuthStore.ts         # Authentication state
│   ├── useProjectStore.ts      # Project CRUD operations
│   ├── useSearchStore.ts       # Basic search state
│   ├── useSettingsStore.ts     # App settings state
│   └── useThemeStore.ts        # Theme state
└── hooks/                      # Custom React hooks
    └── useDownloadQueueListener.ts # WebTorrent progress/status events
```

### Page Architecture

**ProjectOverview Tabbed Interface**:
The main workspace uses a tabbed interface with three sections:

| Tab         | Icon | Purpose                                      | Component    |
| ----------- | ---- | -------------------------------------------- | ------------ |
| **Search**  | 🔍   | Smart search workflow                        | `SearchTab`  |
| **Torrent** | ⬇️   | Torrent collection, download queue, settings | `TorrentTab` |
| **Mix**     | 🎵   | Audio mixing (placeholder)                   | `MixTab`     |

- Tab navigation uses local state (`useState`)
- Badge on Torrent tab shows collection count
- Each tab is a separate component for code splitting potential

**TorrentTab Layout** (vertical stack):

1. `TorrentCollection` — Collected torrents from search results
2. `DownloadQueue` — Active WebTorrent download queue with real-time progress
3. `DownloadManager` — Legacy .torrent file download history
4. `TorrentSettings` — Configuration for both torrent and WebTorrent settings

**SearchTab — Search Results Table Architecture**:
The search results use a data-dense table layout with two independent tabs (Album / Discography):

```
InlineSearchResults
  └── SearchResultsTabs
        ├── SearchResultsFilter       (text filter with 200ms debounce)
        ├── SearchResultsTable         (sortable, grouped, with row expansion)
        │     ├── Group Section Headers (collapsible, with counts)
        │     └── SearchResultsRow     (columns + action buttons + expand)
        │           └── TorrentTrackListPreview  (lazy-loaded on expand)
        ├── SearchResultsPagination    (20/50/100 page sizes)
        └── SearchResultsLoadMore      (fetch additional tracker pages)
```

- Each tab has independent state via `useSearchTableState` hook (sort, filter, page, collapse, expansion)
- Non-audio results auto-hidden with toggle to reveal in dimmed style
- FLAC images deprioritized in sort + orange IMG badge
- Discography tab shows Match column (replaces Format) with scan result badges
- Duplicate detection runs in background via `useDuplicateCheck` hook, shows DUP badges

**Real-Time Download Queue Pattern**:

- `useDownloadQueueListener` hook subscribes to `webtorrent:progress` (1s interval) and `webtorrent:status-change` events
- Progress updates flow through Zustand (`downloadQueueStore`) for efficient re-renders
- `DownloadQueueItem` displays live speed, ETA, progress bar, peer stats, and pause/resume/remove controls
- `CollectedTorrentItem` can enqueue torrents directly to the WebTorrent queue via `window.api.webtorrent.add()`

**Audio Player Integration**:

- Fixed bottom audio player (`AudioPlayer.tsx`) for in-app music playback
- Reads audio files through IPC (`audio:read-file`) as base64 data URLs for security
- Integrates with `DownloadQueueItem` for click-to-play functionality on completed audio files
- Supports playlist playback with next/previous navigation
- Auto-expands folder tree when navigating between tracks
- Visual indication (blue highlight, play icon) for currently playing track
- Store: `audioPlayerStore.ts` manages playback state, playlist, and controls
- Supported formats: MP3, FLAC, WAV, M4A, AAC, OGG, Opus, WMA, AIFF, APE

### Styling Strategy

**Official Styling Standard**: **Chakra UI v3 ONLY**

> **⚠️ IMPORTANT**: All UI components MUST use Chakra UI v3. Tailwind CSS, inline styles with `className`, or other CSS frameworks are **NOT permitted**.

**Why Chakra UI v3**:

- **Type-safe**: Full TypeScript support with autocomplete for all props
- **Accessible by default**: ARIA attributes, keyboard navigation, focus management built-in
- **Theme-aware**: Semantic tokens automatically adapt to light/dark mode
- **Composable**: Component-based API matches React patterns
- **Maintainable**: Consistent styling across the entire application
- **Performant**: CSS-in-JS with Emotion, tree-shakable components
- **Electron-friendly**: No build-time CSS processing required

**Chakra UI Components**:

- Layout: `Box`, `Flex`, `Stack`, `HStack`, `VStack`, `Grid`
- Typography: `Heading`, `Text`
- Form: `Input`, `Button`, `Textarea`, `Select`
- Feedback: `Spinner`, `Alert`, `Toast`
- Overlay: `Modal`, `Drawer`, `Popover`
- Data Display: `Badge`, `Card`, `Table`
- And more: See [Chakra UI Docs](https://www.chakra-ui.com/)

**Theme Configuration** ([src/renderer/theme/index.ts](../../src/renderer/theme/index.ts)):

- **Custom semantic tokens** for consistent theming
- **Studio aesthetic** with electric blue brand colors and slate grays
- **Semantic color system**: `bg.canvas`, `bg.surface`, `bg.card`, `text.primary`, `text.secondary`, `border.base`, `interactive.base`
- **Custom shadows**: Studio-inspired elevation system (`studio-sm`, `studio-md`, `studio-lg`)
- **Global styles**: Font family, smooth transitions for theme changes

**Semantic Color Tokens**:

```typescript
// Background hierarchy
'bg.canvas' // Deep studio dark (#0a0d12 dark, white light)
'bg.surface' // Slightly elevated surface
'bg.card' // Card elevation
'bg.elevated' // Higher elevation
'bg.hover' // Hover state background
'bg.active' // Active/selected state

// Text hierarchy
'text.primary' // Primary text (#e8eaed dark, gray.900 light)
'text.secondary' // Secondary text (#9ca3af)
'text.muted' // Muted text (#6b7280)

// Borders
'border.base' // Default border (#252b3a dark)
'border.hover' // Hover state border
'border.focus' // Focus state border (brand.500)

// Interactive elements
'interactive.base' // Primary interactive (brand.500)
'interactive.hover' // Interactive hover state
'interactive.active' // Interactive active state
```

**Brand Color Palette**:

- **Brand**: Electric blue (blue-500 to blue-900) - Primary UI elements, links, interactive states
- **Accent**: Cyan shades - Secondary highlights
- **Slate**: Deep studio grays - Backgrounds and surfaces

**DO NOT Use**:

- ❌ Tailwind CSS classes (`className="flex items-center"`)
- ❌ Raw `className` with utility classes
- ❌ Inline `style` objects (except for rare edge cases)
- ❌ CSS modules or global CSS files for component styling
- ❌ Any other CSS framework

**When to use Chakra props vs style**:

- ✅ **Always use Chakra props**: `<Box p={4} bg="bg.card" borderRadius="lg">`
- ✅ **Use semantic tokens**: `color="text.primary"`, `bg="bg.surface"`
- ✅ **Use responsive props**: `width={{ base: '100%', md: '50%' }}`
- ⚠️ **Only use `style` for**: Dynamic values from state/props that can't be expressed with Chakra tokens

### Responsive Design

- Support for different window sizes (minimum 800x600)
- Chakra UI responsive props for adaptive layouts
- Flexbox and Grid utilities from Chakra
- Handle different screen DPI/scaling
- Mobile-first responsive breakpoints (if needed for multi-window scenarios)
