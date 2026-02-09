# Code Size Analysis & Refactoring Recommendations

**Analysis Date**: 2026-02-09
**Target**: Keep all files under 400-500 lines for maintainability

---

## 📊 Summary Statistics

| Category | Files Analyzed | Critical (>500) | Warning (400-500) | Good (<400) |
|----------|----------------|-----------------|-------------------|-------------|
| Renderer Components | 36 | 3 | 1 | 32 |
| Main Services | 12 | 4 | 2 | 6 |
| Pages | 19 | 1 | 0 | 18 |
| Stores | 12 | 0 | 1 | 11 |
| IPC Handlers | 9 | 0 | 0 | 9 |

**Total Critical Files**: 8 files require immediate refactoring
**Total Warning Files**: 4 files should be monitored

---

## 🔴 CRITICAL - Immediate Refactoring Needed (>500 lines)

### Renderer Components

#### 1. DownloadQueueItem.tsx - **633 lines** 🚨

**Location**: `src/renderer/components/features/torrent/DownloadQueueItem.tsx`

**Issues**:
- Complex file tree rendering logic (buildFileTree, renderTreeNode)
- Progress display and formatting utilities
- Audio player integration
- Torrent control actions
- All mixed in a single 633-line component

**Refactoring Plan**:
```
src/renderer/components/features/torrent/
├── DownloadQueueItem.tsx (150 lines)
│   └── Main container component
├── components/
│   ├── FileTreeNode.tsx (150 lines)
│   │   └── Recursive tree node rendering
│   ├── TorrentProgressBar.tsx (80 lines)
│   │   └── Progress bar with ETA display
│   └── TorrentControls.tsx (100 lines)
│       └── Pause/resume/remove/play buttons
└── utils/
    ├── fileTreeBuilder.ts (100 lines)
    │   └── buildFileTree, calculateFolderData logic
    └── formatters.ts (50 lines)
        └── formatSpeed, formatSize, formatEta functions
```

**Benefits**:
- Easier to test individual components
- Reusable FileTreeNode for other features
- Clearer separation of concerns
- Improved code navigation

---

#### 2. useSmartSearchWorkflow.ts - **586 lines**

**Location**: `src/renderer/components/features/search/useSmartSearchWorkflow.ts`

**Issues**:
- Complex state machine managing multi-step search workflow
- Classification, album selection, and torrent selection all in one hook
- Difficult to test and maintain
- Hard to understand the flow

**Refactoring Plan**:
```
src/renderer/components/features/search/hooks/
├── useSmartSearchWorkflow.ts (200 lines)
│   └── Main orchestration hook
├── useSearchClassification.ts (100 lines)
│   └── Step 1: Classify search term
├── useAlbumSelection.ts (100 lines)
│   └── Step 2: Select album from MusicBrainz
├── useTorrentSelection.ts (100 lines)
│   └── Step 3: Select torrent from RuTracker
└── utils/
    └── searchWorkflowHelpers.ts (86 lines)
        └── Shared utilities and state transitions
```

**Benefits**:
- Each step can be tested independently
- Easier to add new workflow steps
- Better code reusability
- Clearer workflow visualization

---

#### 3. InlineSearchResults.tsx - **534 lines**

**Location**: `src/renderer/components/features/search/InlineSearchResults.tsx`

**Issues**:
- Large table with filtering, sorting, pagination
- Collection management (add to collection)
- Download actions
- All UI logic in one component

**Refactoring Plan**:
```
src/renderer/components/features/search/
├── InlineSearchResults.tsx (150 lines)
│   └── Main container and layout
├── components/
│   ├── SearchResultsTable.tsx (150 lines)
│   │   └── Table display logic
│   ├── SearchResultRow.tsx (100 lines)
│   │   └── Individual result row with actions
│   └── SearchFilters.tsx (80 lines)
│       └── Format/quality filter controls
└── hooks/
    └── useSearchResultsFiltering.ts (54 lines)
        └── Filter and sort logic
```

**Benefits**:
- Reusable table components
- Easier to modify filter UI
- Better testing of filter logic
- Improved performance (smaller re-render scope)

---

### Main Process Services

#### 4. RuTrackerSearchService.ts - **910 lines** 🚨🚨 **HIGHEST PRIORITY**

**Location**: `src/main/services/RuTrackerSearchService.ts`

**Issues**:
- Massive monolithic service
- Handles scraping, parsing, pagination, filtering, retry logic
- Nearly impossible to maintain
- Hard to test individual pieces
- Violates Single Responsibility Principle

**Refactoring Plan**:
```
src/main/services/rutracker/
├── RuTrackerSearchService.ts (200 lines)
│   └── Main orchestrator, public API
├── scrapers/
│   ├── PageScraper.ts (150 lines)
│   │   └── Puppeteer page navigation and scraping
│   ├── ResultParser.ts (200 lines)
│   │   └── HTML parsing and result extraction
│   └── PaginationHandler.ts (100 lines)
│       └── Multi-page search handling
├── filters/
│   └── SearchFilters.ts (100 lines)
│       └── Format, quality, and size filtering
└── utils/
    ├── retryHandler.ts (80 lines)
    │   └── Retry logic with exponential backoff
    └── urlBuilder.ts (80 lines)
        └── Search URL construction
```

**Benefits**:
- Much easier to test each piece
- Clear separation of concerns
- Easier to add new search features
- Better error isolation
- Improved code navigation

---

#### 5. WebTorrentService.ts - **670 lines**

**Location**: `src/main/services/WebTorrentService.ts`

**Issues**:
- Queue management logic
- Torrent lifecycle (add/pause/resume/remove)
- Progress tracking and broadcasting
- Queue persistence
- All in one massive service

**Refactoring Plan**:
```
src/main/services/webtorrent/
├── WebTorrentService.ts (200 lines)
│   └── Main service, public API
├── managers/
│   ├── QueueManager.ts (150 lines)
│   │   └── FIFO queue logic, concurrency control
│   ├── TorrentLifecycleManager.ts (150 lines)
│   │   └── Add/pause/resume/remove operations
│   └── ProgressBroadcaster.ts (100 lines)
│       └── Real-time progress updates (1s interval)
└── utils/
    └── torrentPersistence.ts (70 lines)
        └── Save/load queue to JSON
```

**Benefits**:
- Easier to test queue logic independently
- Better separation of lifecycle vs queue management
- Clearer code organization
- Easier to modify progress broadcast interval

---

#### 6. AuthService.ts - **599 lines**

**Location**: `src/main/services/AuthService.ts`

**Issues**:
- Login flow with CAPTCHA detection
- Session management and persistence
- Cookie handling
- Background session validation
- All mixed together

**Refactoring Plan**:
```
src/main/services/auth/
├── AuthService.ts (200 lines)
│   └── Main auth orchestrator
├── login/
│   ├── LoginHandler.ts (150 lines)
│   │   └── Login flow orchestration
│   └── CaptchaHandler.ts (80 lines)
│       └── CAPTCHA detection and handling
└── session/
    ├── SessionManager.ts (100 lines)
    │   └── Session persistence and cookie management
    └── SessionValidator.ts (70 lines)
        └── Background validation (5-minute interval)
```

**Benefits**:
- Easier to test login flow separately
- Better session management isolation
- Clearer CAPTCHA handling
- Improved background validation logic

---

#### 7. TorrentDownloadService.ts - **579 lines**

**Location**: `src/main/services/TorrentDownloadService.ts`

**Issues**:
- Torrent file download logic
- Magnet link extraction
- Download history management
- All in one service

**Refactoring Plan**:
```
src/main/services/torrent/
├── TorrentDownloadService.ts (200 lines)
│   └── Main service orchestrator
├── downloaders/
│   ├── TorrentFileDownloader.ts (150 lines)
│   │   └── .torrent file download via Puppeteer
│   └── MagnetLinkExtractor.ts (120 lines)
│       └── Extract magnet links from pages
└── managers/
    └── DownloadHistoryManager.ts (109 lines)
        └── Track download history per project
```

**Benefits**:
- Separate download logic from history
- Easier to test magnet link extraction
- Better error handling per downloader type

---

### Pages

#### 8. Settings/index.tsx - **899 lines** 🚨🚨

**Location**: `src/renderer/pages/Settings/index.tsx`

**Issues**:
- Monolithic settings page
- All settings categories in one file
- Hard to navigate and maintain
- Difficult to add new settings sections

**Refactoring Plan**:
```
src/renderer/pages/Settings/
├── index.tsx (150 lines)
│   └── Main container, tab navigation
└── components/
    ├── GeneralSettings.tsx (150 lines)
    │   └── App-wide settings
    ├── RuTrackerAuthCard.tsx (351 lines) ✅ Already extracted!
    ├── TorrentSettings.tsx (120 lines)
    │   └── .torrent download settings
    ├── WebTorrentSettings.tsx (120 lines)
    │   └── WebTorrent queue settings
    └── AdvancedSettings.tsx (100 lines)
        └── Advanced/debug options
```

**Benefits**:
- Each settings category is independent
- Easier to add new settings sections
- Better code organization
- Improved performance (lazy loading possible)

---

## 🟡 WARNING - Consider Refactoring (400-500 lines)

### 9. smartSearchStore.ts - **433 lines**

**Location**: `src/renderer/store/smartSearchStore.ts`

**Status**: Acceptable for a complex state store, but approaching limit

**Recommendation**: Monitor for growth. If exceeds 500 lines, split into:
- `smartSearchStore.ts` - Core state
- `smartSearchActions.ts` - Action creators
- `smartSearchSelectors.ts` - Derived state selectors

---

### 10. FileSelectionDialog.tsx - **430 lines**

**Location**: `src/renderer/components/features/torrent/FileSelectionDialog.tsx`

**Refactoring Plan**:
```
src/renderer/components/features/torrent/
├── FileSelectionDialog.tsx (150 lines)
│   └── Dialog wrapper and state
├── components/
│   ├── FileSelectionTree.tsx (150 lines)
│   │   └── Tree view with checkboxes
│   └── FileSelectionControls.tsx (80 lines)
│       └── Select all/none, folder toggle buttons
└── hooks/
    └── useFileSelection.ts (50 lines)
        └── File selection state logic
```

---

### 11. MusicBrainzService.ts - **444 lines**

**Location**: `src/main/services/MusicBrainzService.ts`

**Refactoring Plan**:
```
src/main/services/musicbrainz/
├── MusicBrainzService.ts (150 lines)
│   └── Main service
└── api/
    ├── AlbumSearchAPI.ts (100 lines)
    ├── ArtistSearchAPI.ts (100 lines)
    └── ClassificationAPI.ts (94 lines)
```

---

### 12. DiscographySearchService.ts - **432 lines**

**Location**: `src/main/services/DiscographySearchService.ts`

**Refactoring Plan**:
```
src/main/services/discography/
├── DiscographySearchService.ts (150 lines)
│   └── Main orchestrator
├── DiscographyScraper.ts (150 lines)
│   └── Puppeteer scraping logic
└── DiscographyParser.ts (132 lines)
    └── Result parsing and formatting
```

---

## 📋 Prioritized Refactoring Roadmap

### Phase 1: Critical Services (Week 1-2)

**Priority Order**:
1. **RuTrackerSearchService.ts** (910 → ~200 lines)
   - Highest impact, most complex
   - Will improve search reliability

2. **Settings/index.tsx** (899 → ~150 lines)
   - User-facing, frequently modified
   - Easy to split by settings category

3. **WebTorrentService.ts** (670 → ~200 lines)
   - Core download functionality
   - Better testability needed

### Phase 2: UI Components (Week 3-4)

4. **DownloadQueueItem.tsx** (633 → ~150 lines)
   - High user visibility
   - Complex rendering logic

5. **useSmartSearchWorkflow.ts** (586 → ~200 lines)
   - Central to search UX
   - Complex state machine

6. **InlineSearchResults.tsx** (534 → ~150 lines)
   - Frequently used component
   - Performance improvements possible

### Phase 3: Remaining Services (Week 5-6)

7. **AuthService.ts** (599 → ~200 lines)
8. **TorrentDownloadService.ts** (579 → ~200 lines)
9. **MusicBrainzService.ts** (444 → ~150 lines)
10. **DiscographySearchService.ts** (432 → ~150 lines)

### Phase 4: Final Polish (Week 7)

11. **FileSelectionDialog.tsx** (430 → ~150 lines)
12. **smartSearchStore.ts** (433 lines) - Only if grown further

---

## 🎯 Refactoring Principles

### 1. Single Responsibility Principle
Each file should have ONE clear responsibility:
- ✅ `ResultParser.ts` - Parse HTML results
- ❌ `SearchService.ts` - Do everything

### 2. Extract Utilities First
Move pure functions to separate files:
- Formatters (`formatSpeed`, `formatSize`, `formatEta`)
- Builders (`buildFileTree`, `buildSearchUrl`)
- Validators (`isValidUrl`, `isAudioFile`)

### 3. Component Composition
Split UI into smaller, focused components:
- Container components (logic)
- Presentational components (UI)
- Utility components (reusable pieces)

### 4. Service Layer Separation
Separate orchestration from implementation:
- Service (orchestrates, public API)
- Managers (business logic)
- Utils (pure functions)

### 5. Hook Extraction
Extract complex logic into custom hooks:
- ✅ `useFileSelection` - Selection state
- ✅ `useSearchFiltering` - Filter logic
- ❌ Everything in component

### 6. Target File Size
- **Ideal**: 200-300 lines
- **Max**: 400 lines
- **Critical**: >500 lines (must refactor)

---

## 🧪 Testing Strategy After Refactoring

### Unit Tests
- Test each extracted utility independently
- Test managers without service overhead
- Test components in isolation

### Integration Tests
- Test service orchestration
- Test component composition
- Test workflow state machines

### Benefits
- Faster test execution
- Better test isolation
- Easier to identify failures
- Higher code coverage

---

## 📈 Expected Improvements

### Code Quality
- ✅ Better maintainability
- ✅ Easier to understand
- ✅ Clearer responsibilities
- ✅ Improved navigation

### Developer Experience
- ✅ Faster feature development
- ✅ Easier onboarding
- ✅ Better code reviews
- ✅ Reduced merge conflicts

### Testing
- ✅ Higher test coverage
- ✅ Faster test execution
- ✅ Better test isolation
- ✅ Easier to mock

### Performance
- ✅ Smaller re-render scope (React)
- ✅ Better code splitting potential
- ✅ Reduced memory footprint
- ✅ Faster initial load

---

## ✅ Files Already Well-Sized (<400 lines)

**Excellent examples to follow**:
- Most stores (26-222 lines)
- Most IPC handlers (39-182 lines)
- Most common components (32-163 lines)
- Utility components (18-82 lines)

**Keep these patterns**:
- Small, focused files
- Clear single responsibility
- Well-named files
- Good separation of concerns

---

**Last Updated**: 2026-02-09
**Next Review**: After Phase 1 completion
