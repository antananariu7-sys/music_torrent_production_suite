# Code Size Analysis & Refactoring Recommendations

**Last Updated**: 2026-02-19
**Target**: Keep all files under 400-500 lines for maintainability

---

## Summary Statistics

| Category | Files Analyzed | Critical (>500) | Warning (400-500) | Good (<400) |
|----------|----------------|-----------------|-------------------|-------------|
| Renderer Components | 33 | 0 | 2 | 31 |
| Main Services | 13 | 0 | 1 | 12 |
| Pages | 23 | 0 | 0 | 23 |
| Stores | 11 | 0 | 1 | 10 |
| IPC Handlers | 10 | 0 | 0 | 10 |

**Total Critical Files**: 0 (all resolved!)
**Total Warning Files**: 4 files should be monitored

> **Update 2026-02-19**: Major refactoring session completed. All 6 critical files (>500 lines) have been split into focused modules. Largest file in codebase is now 359 lines (TorrentDownloadService.ts facade). Build passes, all tests pass.
>
> **Previous updates**: RuTrackerSearchService.ts refactored from 910 to 364 lines. Settings/index.tsx refactored from 899 to 142 lines.

---

## CRITICAL - Immediate Refactoring Needed (>500 lines)

*No critical files remain. All have been resolved.*

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
└── browserUtils.ts (43 lines) — findChromePath() (shared with TorrentDownloadService)
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

## WARNING - Consider Refactoring (400-500 lines)

### 1. MusicBrainzService.ts - **464 lines** (was 444, growing)

**Location**: `src/main/services/MusicBrainzService.ts`

**Refactoring Plan**:
```
src/main/services/musicbrainz/
├── MusicBrainzService.ts (150 lines) — Main service
└── api/
    ├── AlbumSearchAPI.ts (100 lines)
    ├── ArtistSearchAPI.ts (100 lines)
    └── ClassificationAPI.ts (114 lines)
```

---

### 2. CollectedTorrentItem.tsx - **460 lines**

**Location**: `src/renderer/components/features/torrent/CollectedTorrentItem.tsx`

**Refactoring Plan**:
```
src/renderer/components/features/torrent/
├── CollectedTorrentItem.tsx (150 lines) — Main container
├── components/
│   ├── CollectedItemActions.tsx (100 lines)
│   └── CollectedItemDetails.tsx (100 lines)
└── hooks/
    └── useCollectedItemActions.ts (80 lines)
```

---

### 3. smartSearchStore.ts - **433 lines** (stable)

**Location**: `src/renderer/store/smartSearchStore.ts`

**Recommendation**: If exceeds 500 lines, split into core state, action creators, and selectors.

---

### 4. FileSelectionDialog.tsx - **430 lines** (stable)

**Location**: `src/renderer/components/features/torrent/FileSelectionDialog.tsx`

**Refactoring Plan**:
```
src/renderer/components/features/torrent/
├── FileSelectionDialog.tsx (150 lines)
└── components/
    ├── FileSelectionTree.tsx (150 lines)
    └── FileSelectionControls.tsx (80 lines)
```

---

## WATCH - Approaching Warning (350-400 lines)

| File | Lines | Notes |
|------|-------|-------|
| `TorrentDownloadService.ts` | 359 | In webtorrent/ — stable |
| `ProjectService.ts` | 395 | Approaching 400-line warning threshold |
| `RuTrackerSearchService.ts` | 364 | Stable post-refactor |
| `RuTrackerAuthCard.tsx` | 351 | Settings subcomponent, monitor |
| `DiscographySearchService.ts` | 426 | Warning zone, stable |

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

**Last Updated**: 2026-02-19
**Status**: All Phase 1 & 2 critical files resolved. Phase 3 (warning files) queued for future sessions.
