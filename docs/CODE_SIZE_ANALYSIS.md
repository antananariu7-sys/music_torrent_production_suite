# Code Size Analysis & Refactoring Recommendations

**Last Updated**: 2026-02-22
**Target**: Keep all files under 400-500 lines for maintainability

---

## Summary Statistics

| Category            | Files Analyzed | Critical (>500) | Warning (400-500) | Good (<400) |
| ------------------- | -------------- | --------------- | ----------------- | ----------- |
| Renderer Components | 76             | 1               | 0                 | 75          |
| Main Services       | 60             | 1               | 1                 | 58          |
| Preload             | 2              | 1               | 0                 | 1           |
| Pages               | 30             | 0               | 0                 | 30          |
| Stores              | 14             | 0               | 1                 | 13          |
| IPC Handlers        | 14             | 0               | 0                 | 14          |
| Shared              | 21             | 0               | 0                 | 21          |
| Other               | 18             | 0               | 0                 | 18          |
| **TOTAL**           | **235**        | **3**           | **2**             | **230**     |

**Total Critical Files**: 3 (new since waveform timeline implementation)
**Total Warning Files**: 2 (smartSearchStore.ts + ProjectService.ts)
**Total Lines**: 29,291

> **Update 2026-02-22**: Waveform timeline implementation added 3 new critical files: `preload/index.ts` (653 lines — grew with waveform/bpm API surface), `WaveformExtractor.ts` (535 lines), `TimelineLayout.tsx` (535 lines). These need refactoring.
>
> **Update 2026-02-19 (Phase 3)**: All 4 warning files (400-500 lines) from Phase 3 have been split. All files in codebase are now under 400 lines except smartSearchStore.ts (434 lines, stable, only split if grows past 500).
>
> **Update 2026-02-19 (Phase 2)**: Major refactoring session completed. All 6 critical files (>500 lines) have been split into focused modules. Build passes, all tests pass.
>
> **Previous updates**: RuTrackerSearchService.ts refactored from 910 to 364 lines. Settings/index.tsx refactored from 899 to 142 lines.

---

## CRITICAL - Immediate Refactoring Needed (>500 lines)

### 1. preload/index.ts — 653 lines

**Location**: `src/preload/index.ts`

**Problem**: Single preload file grew as new API namespaces were added (waveform, bpm, audio, mix export, stream preview). Each namespace adds ~30-50 lines of `contextBridge.exposeInMainWorld` boilerplate.

**Suggested split**:

```
src/preload/
├── index.ts (~100 lines) — contextBridge.exposeInMainWorld call, imports
├── api/
│   ├── auth.ts — auth namespace
│   ├── search.ts — search namespace
│   ├── torrent.ts — torrent, webtorrent, torrentMeta namespaces
│   ├── project.ts — project namespace
│   ├── audio.ts — audio, audioPlayer namespaces
│   ├── waveform.ts — waveform, bpm namespaces
│   └── mixExport.ts — mixExport namespace
└── types.ts — existing type definitions
```

---

### 2. WaveformExtractor.ts — 535 lines

**Location**: `src/main/services/waveform/WaveformExtractor.ts`

**Problem**: Combines FFmpeg peak extraction, 3-band frequency analysis, binary cache read/write, and legacy JSON migration in one file.

**Suggested split**:

```
src/main/services/waveform/
├── WaveformExtractor.ts (~200 lines) — Public API, batch orchestration
├── peakExtractor.ts (~150 lines) — FFmpeg PCM extraction + peak downsampling
├── frequencyExtractor.ts (~120 lines) — 3-band frequency analysis via FFmpeg
└── peakCache.ts (~100 lines) — Binary .peaks read/write, legacy JSON migration
```

---

### 3. TimelineLayout.tsx — 535 lines

**Location**: `src/renderer/components/features/timeline/TimelineLayout.tsx`

**Problem**: Handles zoom logic, scroll synchronization, track position computation, crossfade/cue point popover state, and rendering. Multiple concerns in one component.

**Suggested split**:

```
src/renderer/components/features/timeline/
├── TimelineLayout.tsx (~200 lines) — Main container, track rendering
├── hooks/
│   ├── useTimelineZoom.ts (~100 lines) — Ctrl+scroll zoom, cursor-position preservation
│   ├── useTimelineScroll.ts (~100 lines) — Playback scroll sync, manual scroll detection
│   └── useTrackPositions.ts (~80 lines) — computeTrackPositions, layout calculations
└── (existing components unchanged)
```

---

## Previously Critical — Now Refactored ✅

### 1. WebTorrentService.ts — ~~1000 lines~~ → **8 files, max 288 lines** ✅

**Location**: `src/main/services/WebTorrentService.ts` (re-export stub)

**Split into**:

```
src/main/services/webtorrent/
├── WebTorrentService.ts (288 lines) — Main facade, public API
├── managers/
│   ├── TorrentLifecycleManager.ts (269 lines) — Engine, startTorrent, processQueue
│   └── ProgressBroadcaster.ts (155 lines) — Real-time progress updates
├── handlers/
│   └── FileSelectionHandler.ts (169 lines) — File selection, partial downloads
└── utils/
    ├── fileCleanup.ts (145 lines) — Delete/cleanup downloaded files
    ├── torrentHelpers.ts (52 lines) — mapTorrentFiles, parseTorrentFiles
    └── torrentPersistence.ts (51 lines) — Save/load queue to JSON
```

---

### 2. DownloadQueueItem.tsx — ~~806 lines~~ → **7 files, max 275 lines** ✅

**Location**: `src/renderer/components/features/torrent/DownloadQueueItem.tsx`

**Split into**:

```
src/renderer/components/features/torrent/
├── DownloadQueueItem.tsx (275 lines) — Main container
├── components/
│   ├── FileTreeNode.tsx — Recursive tree node rendering
│   ├── TorrentProgressBar.tsx — Progress bar
│   ├── TorrentControls.tsx — Pause/resume/remove/play buttons
│   └── RemoveDialog.tsx — Removal confirmation dialog
└── utils/
    ├── fileTreeBuilder.ts — buildFileTree logic
    └── formatters.ts — formatSpeed, formatSize
```

---

### 3. InlineSearchResults.tsx — ~~713 lines~~ → **6 files, max 266 lines** ✅

**Location**: `src/renderer/components/features/search/InlineSearchResults.tsx`

**Split into**:

```
src/renderer/components/features/search/
├── InlineSearchResults.tsx (266 lines) — Main container
└── components/
    ├── ClassificationItem.tsx
    ├── AlbumItem.tsx
    ├── TorrentItem.tsx
    └── GroupedTorrentList.tsx
```

---

### 4. AuthService.ts — ~~607 lines~~ → **4 files, max 263 lines** ✅

**Location**: `src/main/services/AuthService.ts` (re-export stub)

**Split into**:

```
src/main/services/auth/
├── AuthService.ts (263 lines) — Main service, login, public API
└── session/
    ├── SessionPersistence.ts (114 lines) — Save/restore session to disk
    └── SessionValidator.ts (113 lines) — Background session validation
```

**Shared utility**:

```
src/main/services/utils/
└── browserUtils.ts (43 lines) — findChromePath() (shared across Auth, TorrentDownload, Discography)
```

---

### 5. TorrentDownloadService.ts — ~~583 lines~~ → **3 files, max 359 lines** ✅

**Location**: `src/main/services/TorrentDownloadService.ts` (re-export stub)

**Split into**:

```
src/main/services/torrent/
├── TorrentDownloadService.ts (359 lines) — Main service
└── DownloadHistoryManager.ts (93 lines) — History load/save/clear
```

---

### 6. useSmartSearchWorkflow.ts — ~~561 lines~~ → **4 files, max 313 lines** ✅

**Location**: `src/renderer/components/features/search/useSmartSearchWorkflow.ts`

**Split into**:

```
src/renderer/components/features/search/
├── useSmartSearchWorkflow.ts (313 lines) — Main orchestration hook
└── hooks/
    ├── useSearchClassification.ts (131 lines) — Classify query, handle classification selection
    ├── useRuTrackerSearch.ts (116 lines) — Parallel album + discography search
    └── useDiscographyScan.ts (104 lines) — Scan discography pages for album
```

---

### Previously Refactored

#### RuTrackerSearchService.ts — ~~910 lines~~ → **364 lines** ✅

Split into `src/main/services/rutracker/` subdirectory with scrapers, parsers, and utils.

#### Settings/index.tsx — ~~899 lines~~ → **142 lines** ✅

Split into GeneralSettings, RuTrackerAuthCard, SearchSettings, WebTorrentSettings, DebugSettings, AdvancedSettings subcomponents.

---

## Phase 3 — Warning Files Now Resolved ✅

### 1. MusicBrainzService.ts — ~~465 lines~~ → **6 files, max 132 lines** ✅

**Location**: `src/main/services/MusicBrainzService.ts` (re-export stub)

**Split into**:

```
src/main/services/musicbrainz/
├── MusicBrainzService.ts (48 lines) — Facade
├── MusicBrainzApiClient.ts (76 lines) — HTTP client + rate limiting
├── types.ts (42 lines) — Internal MB API response types
└── api/
    ├── albumSearch.ts (132 lines) — findAlbumsBySong, getAlbumDetails
    ├── classifySearch.ts (105 lines) — classifySearch
    └── artistAlbums.ts (58 lines) — getArtistAlbums
```

---

### 2. CollectedTorrentItem.tsx — ~~461 lines~~ → **4 files, max 244 lines** ✅

**Location**: `src/renderer/components/features/torrent/CollectedTorrentItem.tsx`

**Split into**:

```
src/renderer/components/features/torrent/
├── CollectedTorrentItem.tsx (221 lines) — Container, actions, JSX
└── hooks/
    ├── useCollectedItemDownload.ts (244 lines) — Multi-step download flow
    └── useCollectedItemPreview.ts (52 lines) — Track list preview
```

---

### 3. FileSelectionDialog.tsx — ~~431 lines~~ → **5 files, max 168 lines** ✅

**Location**: `src/renderer/components/features/torrent/FileSelectionDialog.tsx`

**Split into**:

```
src/renderer/components/features/torrent/
├── FileSelectionDialog.tsx (168 lines) — Modal container + state
├── components/
│   ├── FileSelectionTree.tsx (121 lines) — Recursive tree renderer
│   └── FileSelectionControls.tsx (89 lines) — Footer toolbar
└── utils/
    └── fileSelectionTree.ts (104 lines) — SelectionTreeNode, buildSelectionFileTree, formatBytes
```

---

### 4. DiscographySearchService.ts — ~~427 lines~~ → **3 files, max 187 lines** ✅

**Location**: `src/main/services/DiscographySearchService.ts` (re-export stub)

**Split into**:

```
src/main/services/discography/
├── DiscographySearchService.ts (169 lines) — Orchestration + browser lifecycle
└── PageContentParser.ts (187 lines) — scanSinglePage + parsePageContent
```

**Also fixed**: Removed duplicate `findChromePath()` — now uses shared `browserUtils.ts`.

---

## WATCH - Monitor Only

| File                        | Lines | Notes                                    |
| --------------------------- | ----- | ---------------------------------------- |
| `smartSearchStore.ts`       | 433   | WARNING — split only if exceeds 500      |
| `ProjectService.ts`         | 427   | WARNING — grew past 400, approaching 500 |
| `BpmDetector.ts`            | 396   | Approaching 400-line warning threshold   |
| `AudioPlayer.tsx`           | 387   | Approaching 400-line warning threshold   |
| `RuTrackerSearchService.ts` | 364   | Stable post-refactor                     |
| `MixExportService.ts`       | 358   | Stable                                   |
| `TorrentDownloadService.ts` | 358   | In torrent/ — stable                     |
| `RuTrackerAuthCard.tsx`     | 351   | Settings subcomponent, monitor           |
| `ExportConfigModal.tsx`     | 344   | Monitor                                  |

---

## Refactoring Principles

### 1. Single Responsibility Principle

Each file should have ONE clear responsibility.

### 2. Extract Utilities First

Move pure functions to separate files: formatters, builders, validators.

### 3. Component Composition

Split UI into smaller, focused components: container, presentational, utility.

### 4. Service Layer Separation

Separate orchestration from implementation: Service → Managers → Utils.

### 5. Hook Extraction

Extract complex logic into custom hooks per concern.

### 6. Target File Size

- **Ideal**: 200-300 lines
- **Max**: 400 lines
- **Critical**: >500 lines (must refactor)

---

## Files Already Well-Sized (<400 lines)

**Excellent examples to follow**:

- Most stores (26-222 lines)
- Most IPC handlers (39-200 lines)
- Most common components (32-285 lines)
- Most page components (18-271 lines)
- Refactored rutracker/ modules (175-262 lines)

---

**Last Updated**: 2026-02-22
**Status**: 3 new critical files from waveform timeline implementation (preload/index.ts, WaveformExtractor.ts, TimelineLayout.tsx). Refactoring plans provided above. 2 warning files (smartSearchStore.ts, ProjectService.ts).
