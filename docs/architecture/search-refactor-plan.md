# Search Functionality Refactor Plan

**Date:** 2026-02-10
**Updated:** 2026-02-17
**Status:** In Progress
**Author:** Architecture Review

---

## Executive Summary

This document outlines a comprehensive refactor of the search functionality to improve:
- **User Experience**: Better search intelligence, grouped results, duplicate detection
- **Architecture**: Move business logic from UI store to services, improve separation of concerns
- **Visibility**: Full activity tracking for all operations including torrent parsing
- **Maintainability**: Clearer service boundaries, better testability

**Key Improvements:**
1. Track-level search with album highlighting
2. Grouped and filterable RuTracker results (Studio Albums | Live | Compilations)
3. Torrent page parsing for track listings with progress indication
4. Duplicate detection against project audio files
5. Retry logic for MusicBrainz API calls
6. Move business logic from `smartSearchStore` to dedicated services

---

## Table of Contents

1. [Current Architecture Analysis](#current-architecture-analysis)
2. [Issues to Address](#issues-to-address)
3. [Proposed Architecture](#proposed-architecture)
4. [Detailed Changes](#detailed-changes)
5. [Implementation Plan](#implementation-plan)
6. [Migration Strategy](#migration-strategy)
7. [Testing Strategy](#testing-strategy)
8. [Risk Assessment](#risk-assessment)

---

## Current Architecture Analysis

### Search Flow
```
User Query
  ↓
MusicBrainz Classification (artist/album/song)
  ↓
User selects type + action
  ↓
[If song] Find albums containing it
  ↓
Search RuTracker
  ↓
[Optional] Scan discography pages for specific album
  ↓
Select torrent
  ↓
Add to collection
```

### Current Services

#### **MusicBrainzService** (`src/main/services/MusicBrainzService.ts`)
- Search classification (artist/album/song)
- Album search by song title
- Artist albums lookup
- **Issue**: No retry logic for API failures

#### **RuTrackerSearchService** (`src/main/services/RuTrackerSearchService.ts`)
- Puppeteer-based search
- Progressive search with pagination
- Basic filtering and relevance scoring
- **Issue**: No result grouping (Studio Albums | Live | Compilations)
- **Issue**: No track listing extraction from torrent pages

#### **DiscographySearchService** (`src/main/services/DiscographySearchService.ts`)
- Scans multiple torrent pages for album matches
- Parallel page loading
- **Issue**: Doesn't extract track listings for non-discography pages

### Current State Management

#### **smartSearchStore** (`src/renderer/store/smartSearchStore.ts`)
- Manages entire search workflow state machine
- Activity logging
- Search history
- **Issue**: Contains orchestration logic that should be in services
- **Issue**: Coupled to specific workflow steps

### What Works Well

✅ **Clear workflow state machine** - Easy to understand search progression
✅ **Activity logging** - Good visibility into operations
✅ **Session management** - AuthService integration works well
✅ **Progressive search** - Good UX for multi-page results
✅ **Relevance scoring** - Existing algorithm is solid

---

## Issues to Address

### 1. **Search Intelligence**
- ❌ No track name search with album highlighting
- ❌ MusicBrainz API calls have no retry logic
- ❌ Can't distinguish between album versions in results

### 2. **Result Presentation**
- ❌ RuTracker results not grouped by type (Studio/Live/Compilation)
- ❌ No collapsible groups (overwhelming for 100+ results)
- ❌ Limited filtering options in UI
- ❌ No "show more" within groups (shows all or nothing)

### 3. **Track-Level Awareness**
- ❌ No track listing extraction from torrent pages
- ❌ Users can't preview what's in a torrent before adding
- ❌ No progress indicator for torrent page parsing

### 4. **Duplicate Detection**
- ❌ No checking against existing project audio files
- ❌ Can download same content multiple times
- ❌ No metadata tracking of what's already been downloaded

### 5. **Architecture Issues**
- ❌ Business logic in UI store (`smartSearchStore`)
- ❌ Service orchestration happens in renderer
- ❌ Hard to test workflow logic
- ❌ No dedicated service for result processing/grouping

### 6. **Progress Visibility**
- ❌ Torrent page parsing has no progress indication
- ❌ Duplicate detection happens silently
- ❌ API retry attempts not visible to user

---

## Proposed Architecture

### New Service Layer

```
Main Process Services:
├── MusicBrainzService (enhanced)
│   ├── Search classification with retry logic
│   ├── Track-to-album matching
│   └── Confidence scoring improvements
│
├── RuTrackerSearchService (enhanced)
│   ├── Existing search functionality
│   ├── + Result grouping (Studio/Live/Compilation)
│   └── + Advanced filtering
│
├── TorrentMetadataService (NEW)
│   ├── Parse torrent page for track listings
│   ├── Extract metadata (format, bitrate, etc.)
│   ├── Progress reporting
│   └── Caching parsed results
│
├── DuplicateDetectionService (NEW)
│   ├── Scan project directory for audio files
│   ├── Compare against torrent content
│   ├── Maintain project metadata index
│   └── Revalidation support
│
└── SearchOrchestrationService (NEW)
    ├── Coordinate multi-service workflows
    ├── Manage search state machine
    ├── Handle retries and error recovery
    └── Emit progress events
```

### Enhanced Data Flow

```
User Query
  ↓
SearchOrchestrationService.startSearch()
  ↓
MusicBrainzService.classify() [with retry]
  ↓
User selects classification
  ↓
[If track] MusicBrainzService.findAlbumsWithTrack()
  ↓
RuTrackerSearchService.search()
  ↓
ResultGroupingService.groupResults() [Studio/Live/Compilation]
  ↓
User selects torrent(s)
  ↓
TorrentMetadataService.parseTrackListing() [with progress]
  ↓
DuplicateDetectionService.checkDuplicates()
  ↓
User confirms (or skips duplicates)
  ↓
Add to collection
```

### Store Simplification

**smartSearchStore** becomes a pure UI state store:
- Current step in workflow
- Selected items (classification, album, torrent)
- UI state (loading, errors, dialogs)
- Activity log (for display only)

**Business logic moves to services:**
- All API calls
- Result processing and grouping
- Duplicate detection
- Workflow orchestration

---

## Detailed Changes

### Change 1: Create TorrentMetadataService

**Purpose:** Extract track listings and metadata from torrent pages

**Location:** `src/main/services/TorrentMetadataService.ts`

**Responsibilities:**
- Parse torrent page HTML for track listings
- Extract metadata: format (MP3/FLAC), bitrate, codec
- Cache parsed results (avoid re-parsing same page)
- Report progress during parsing
- Handle parsing errors gracefully

**IPC Interface:**
```typescript
// New IPC channel
IPC_CHANNELS.TORRENT_PARSE_METADATA

interface TorrentMetadataRequest {
  torrentUrl: string
  torrentId: string
}

interface TorrentMetadataResponse {
  success: boolean
  metadata?: {
    tracks: Array<{
      position: number
      title: string
      duration?: string
      fileSize?: string
    }>
    format: FileFormat
    bitrate?: string
    codec?: string
    totalSize: string
    releaseInfo?: string
  }
  error?: string
}

// Progress event
IPC_CHANNELS.TORRENT_PARSE_PROGRESS
interface TorrentParseProgress {
  torrentId: string
  stage: 'loading' | 'parsing' | 'complete'
  message: string
}
```

**Implementation Notes:**
- Reuse Puppeteer browser instance from RuTrackerSearchService
- Use same session cookies from AuthService
- Cache results in memory (Map<torrentId, metadata>)
- Emit progress events via IPC

---

### Change 2: Create DuplicateDetectionService

**Purpose:** Detect duplicate audio files in project directory

**Location:** `src/main/services/DuplicateDetectionService.ts`

**Responsibilities:**
- Scan project directory for audio files (.mp3, .flac, .wav, etc.)
- Build/maintain index of existing files in project metadata
- Compare torrent track listings against existing files
- Support revalidation (re-scan directory)
- Fast fuzzy matching for track names

**Project Metadata:**
```typescript
// Stored in project directory: .music-suite/audio-index.json
interface AudioFileIndex {
  lastScan: string // ISO date
  files: Array<{
    path: string
    fileName: string
    artist?: string
    album?: string
    title?: string
    duration?: number
    size: number
    hash?: string // For exact duplicate detection
  }>
}
```

**IPC Interface:**
```typescript
IPC_CHANNELS.DUPLICATE_CHECK

interface DuplicateCheckRequest {
  projectDirectory: string
  torrentMetadata: TorrentMetadata
  rescan?: boolean // Force directory rescan
}

interface DuplicateCheckResponse {
  success: boolean
  duplicates: Array<{
    torrentTrack: string
    existingFile: string
    matchConfidence: number // 0-100
  }>
  newTracks: string[] // Tracks not found in project
  error?: string
}
```

**Implementation Notes:**
- Use fast-glob for directory scanning
- Use music-metadata library for audio file parsing
- Fuzzy match using string similarity (levenshtein distance)
- Cache index in `.music-suite/audio-index.json`
- Invalidate cache on rescan

---

### Change 3: Create SearchOrchestrationService

**Purpose:** Coordinate multi-service search workflows

**Location:** `src/main/services/SearchOrchestrationService.ts`

**Responsibilities:**
- Manage search state machine (current step, data)
- Coordinate calls to MusicBrainz, RuTracker, TorrentMetadata, DuplicateDetection
- Handle retry logic and error recovery
- Emit unified progress events
- Maintain search session context

**IPC Interface:**
```typescript
IPC_CHANNELS.SEARCH_ORCHESTRATION_START

interface SearchOrchestrationRequest {
  query: string
  projectDirectory: string
  options?: {
    skipDuplicateCheck?: boolean
    skipMetadataParsing?: boolean
  }
}

// Unified progress event
IPC_CHANNELS.SEARCH_ORCHESTRATION_PROGRESS
interface SearchOrchestrationProgress {
  step: SearchWorkflowStep
  message: string
  data?: any // Step-specific data
  error?: string
}
```

**Implementation Notes:**
- Maintains session state in memory
- Emits progress events at each step
- Handles errors and retries
- Provides resume/cancel capabilities

---

### Change 4: Enhance MusicBrainzService

**Enhancements:**
1. **Retry Logic**
   - Exponential backoff (1s, 2s, 4s)
   - Max 3 retries
   - Report retry attempts via progress events

2. **Track Name Search**
   ```typescript
   async findAlbumsWithTrack(trackName: string, artistName?: string): Promise<MusicBrainzAlbum[]>
   ```
   - Search MusicBrainz for recordings
   - Return albums containing the track
   - Include track position in album

3. **Improved Classification**
   - Better confidence scoring
   - Consider query structure (e.g., "artist - track" format)

**Implementation Notes:**
- Use axios-retry or manual retry logic
- Add new IPC channel: `IPC_CHANNELS.MUSICBRAINZ_FIND_TRACK`
- Report API retry attempts in progress events

---

### Change 5: Enhance RuTrackerSearchService

**Enhancements:**
1. **Result Grouping**
   ```typescript
   interface GroupedSearchResults {
     studioAlbums: SearchResult[]
     liveAlbums: SearchResult[]
     compilations: SearchResult[]
     other: SearchResult[]
   }

   function groupResults(results: SearchResult[]): GroupedSearchResults
   ```

   **Grouping Rules:**
   - Studio Albums: no "live", "compilation", "best of", "greatest hits" in title
   - Live: contains "live", "concert", "tour"
   - Compilations: contains "compilation", "collection", "best of", "greatest hits", "anthology"
   - Other: everything else

2. **Enhanced Filtering**
   - Keep existing filters (format, seeders, size, date)
   - Add: group filter, album type filter
   - UI controls for each filter

**Implementation Notes:**
- Add `groupResults()` utility function
- Update `SearchResponse` type to include grouped results
- Keep flat results array for backwards compatibility

---

### Change 6: Simplify smartSearchStore

**Remove from store:**
- API call logic → Move to services
- Orchestration logic → Move to SearchOrchestrationService
- Complex data processing → Move to services

**Keep in store:**
- Current workflow step (for UI state)
- Selected items (classification, album, torrent)
- UI-specific state (dialogs open, loading indicators)
- Activity log (display-only)
- Search history (display-only)

**New structure:**
```typescript
interface SmartSearchState {
  // Workflow state (minimal)
  step: SearchWorkflowStep
  originalQuery: string

  // User selections
  selectedClassification: SearchClassificationResult | null
  selectedAlbum: MusicBrainzAlbum | null
  selectedTorrent: SearchResult | null

  // Display data (provided by services)
  classificationResults: SearchClassificationResult[]
  albums: MusicBrainzAlbum[]
  ruTrackerResults: GroupedSearchResults
  torrentMetadata: TorrentMetadata | null
  duplicates: DuplicateCheckResponse | null

  // UI state
  isLoading: boolean
  error: string | null
  activityLog: ActivityLogEntry[]

  // Actions (thin wrappers around IPC calls)
  startSearch: (query: string) => void
  selectClassification: (result: SearchClassificationResult) => void
  // ... etc
}
```

---

### Change 7: Enhanced UI Components

**New Components:**

1. **GroupedResultsList** (`src/renderer/components/features/search/GroupedResultsList.tsx`)
   - Expandable/collapsible groups
   - Show top 20 per group by default
   - "Show more" button per group
   - Group headers with counts

2. **TorrentTrackListPreview** (`src/renderer/components/features/search/TorrentTrackListPreview.tsx`)
   - Display track listing from parsed metadata
   - Show format, bitrate, total size
   - Indicate duplicate tracks (highlighted)

3. **DuplicateWarningDialog** (`src/renderer/components/features/search/DuplicateWarningDialog.tsx`)
   - List duplicate tracks found
   - Show existing file paths
   - Options: Skip, Download Anyway, Cancel

**Enhanced Components:**

1. **ActivityLog**
   - Add icon/color for each activity type
   - Show parsing progress
   - Show retry attempts
   - Expandable detail view

---

## Implementation Plan

### Phase 1: Foundation (Week 1)
**Goal:** Create new services without breaking existing functionality

**Tasks:**
1. Create `TorrentMetadataService.ts` (stub implementation)
   - IPC handlers
   - Basic Puppeteer integration
   - Progress events

2. Create `DuplicateDetectionService.ts` (stub implementation)
   - Directory scanning
   - Audio file indexing
   - Basic matching logic

3. Create `SearchOrchestrationService.ts` (stub implementation)
   - State machine skeleton
   - Progress event system
   - IPC interface

4. Add new IPC channels to `src/shared/constants.ts`

5. Register new IPC handlers in `src/main/ipc/index.ts`

6. Add new types to `src/shared/types/`

**Testing:**
- Unit tests for each new service
- IPC integration tests
- No UI changes yet

---

### Phase 2: Torrent Metadata Parsing (Week 2)
**Goal:** Implement and integrate torrent page parsing

**Tasks:**
1. Implement `TorrentMetadataService.parseMetadata()`
   - Parse track listings from RuTracker page HTML
   - Extract format, bitrate, codec
   - Handle various page layouts
   - Cache results

2. Create `TorrentTrackListPreview` component

3. Integrate into search workflow:
   - Call after user selects torrent
   - Show loading indicator during parsing
   - Display track listing preview

4. Update activity log to show parsing progress

**Testing:**
- Parse various torrent page formats
- Test progress reporting
- Test caching
- Manual UI testing

---

### Phase 3: Duplicate Detection (Week 2-3)
**Goal:** Implement duplicate detection and warning system

**Tasks:**
1. Implement `DuplicateDetectionService.checkDuplicates()`
   - Directory scanning with fast-glob
   - Audio metadata extraction with music-metadata
   - Fuzzy matching algorithm
   - Index caching

2. Create `DuplicateWarningDialog` component

3. Integrate into search workflow:
   - Check after parsing torrent metadata
   - Show warning dialog if duplicates found
   - Allow user to proceed or cancel

4. Add "Rescan Project" button to settings

**Testing:**
- Test with various audio formats
- Test fuzzy matching accuracy
- Test with large directories (1000+ files)
- Test cache invalidation

---

### Phase 4: MusicBrainz Enhancements (Week 3)
**Goal:** Add retry logic and track name search

**Tasks:**
1. Add retry logic to all MusicBrainz API calls
   - Exponential backoff
   - Progress reporting for retries

2. Implement `findAlbumsWithTrack()`
   - Search recordings by name
   - Return albums containing track
   - Include track position

3. Update classification to detect track names
   - Improved query parsing
   - "Artist - Track" pattern detection

4. Show retry attempts in activity log

**Testing:**
- Test retry logic with network failures
- Test track search accuracy
- Test various query formats

---

### Phase 5: Result Grouping (Week 4)
**Goal:** Implement grouped RuTracker results

**Tasks:**
1. Implement `groupResults()` in RuTrackerSearchService
   - Classification logic (Studio/Live/Compilation)
   - Apply to search results

2. Create `GroupedResultsList` component
   - Collapsible groups
   - Show top 20 per group
   - "Show more" functionality

3. Update search workflow to use grouped results

4. Add group filter UI controls

**Testing:**
- Test grouping accuracy with various results
- Test UI expand/collapse
- Test "show more" pagination

---

### Phase 6: Search Orchestration (Week 4-5)
**Goal:** Move orchestration logic from store to service

**Tasks:**
1. Implement `SearchOrchestrationService` fully
   - Complete state machine
   - Coordinate all services
   - Unified progress events

2. Refactor `smartSearchStore` to use orchestration service
   - Remove business logic
   - Thin wrapper around IPC calls
   - Pure UI state

3. Update all search components to use new API

4. Comprehensive integration testing

**Testing:**
- Test complete search flows
- Test error handling and recovery
- Test cancellation
- Test concurrent searches

---

### Phase 7: Polish & Optimization (Week 5)
**Goal:** Performance, UX improvements, documentation

**Tasks:**
1. Performance optimization
   - Cache MusicBrainz results
   - Optimize directory scanning
   - Reduce unnecessary re-renders

2. Enhanced progress visibility
   - Better loading states
   - Progress percentages where applicable
   - Cancel buttons for long operations

3. Documentation
   - Update architecture docs
   - Service API documentation
   - User-facing feature docs

4. Code cleanup
   - Remove old/dead code
   - Refactor duplicated logic
   - ESLint/TypeScript strict mode

**Testing:**
- Performance benchmarks
- User acceptance testing
- Regression testing

---

## Migration Strategy

### Backwards Compatibility

**Approach:** Incremental migration with feature flags

1. **Phase 1-3**: New services work alongside existing code
   - New IPC channels added
   - Old channels remain functional
   - No breaking changes

2. **Phase 4-5**: Gradual cutover
   - Components updated one at a time
   - Feature flags to enable/disable new behavior
   - Rollback capability

3. **Phase 6**: Complete cutover
   - Old code paths removed
   - Orchestration becomes the only path
   - Final testing and stabilization

### Data Migration

**Search History:**
- No changes needed (JSON format remains same)

**Torrent Collection:**
- No changes needed (existing structure compatible)

**New Metadata:**
- Audio file index created on first use
- No migration needed for existing data

### Rollback Plan

If critical issues arise:
1. Disable feature flags (revert to old code paths)
2. Keep old services functional until Phase 6
3. IPC handlers support both old and new APIs
4. Monitor error rates and user feedback

---

## Testing Strategy

### Unit Tests

**New Services:**
- `TorrentMetadataService`: Parse various page formats
- `DuplicateDetectionService`: Matching accuracy, performance
- `SearchOrchestrationService`: State machine transitions
- Enhanced `MusicBrainzService`: Retry logic, track search
- Enhanced `RuTrackerSearchService`: Result grouping

**Test Coverage Goal:** 80% for business logic

### Integration Tests

**IPC Communication:**
- Each new IPC channel
- Progress event delivery
- Error propagation

**Service Coordination:**
- Complete search flows (happy path)
- Error scenarios
- Cancellation
- Concurrent operations

### E2E Tests (Manual for Phase 1, Automated Later)

**Critical Flows:**
1. Search by artist → select album → parse metadata → check duplicates → add to collection
2. Search by track → find album → search RuTracker → select from grouped results
3. Search with retry (MusicBrainz failure)
4. Cancel during long operation

**Test Cases:**
- ~20 critical user journeys
- Various query types (artist, album, track)
- Edge cases (no results, errors, duplicates)

### Performance Tests

**Benchmarks:**
- Directory scan with 1000, 5000, 10000 files
- Fuzzy matching performance
- Torrent page parsing speed
- Memory usage during concurrent searches

**Targets:**
- Directory scan: < 2s for 5000 files
- Duplicate check: < 1s for 100 tracks
- Torrent parse: < 3s per page
- Memory: < 200MB for search session

---

## Risk Assessment

### High Risks

**Risk 1: RuTracker Page HTML Changes**
- **Impact:** Parsing breaks if RuTracker changes page structure
- **Mitigation:**
  - Use multiple selectors (fallbacks)
  - Log parsing failures for monitoring
  - Graceful degradation (show torrent without tracks)
  - Version detection for different page formats

**Risk 2: Performance with Large Music Libraries**
- **Impact:** Duplicate detection slow for 10,000+ audio files
- **Mitigation:**
  - Incremental indexing (scan only new files)
  - Background indexing on project open
  - Cache index in .music-suite/audio-index.json
  - Optional: disable duplicate check for large libraries

**Risk 3: Workflow Complexity**
- **Impact:** Orchestration service becomes too complex
- **Mitigation:**
  - Clear state machine definition
  - Comprehensive unit tests
  - Careful error handling at each step
  - Allow workflow to be restarted from any point

### Medium Risks

**Risk 4: MusicBrainz Rate Limiting**
- **Impact:** API blocks requests if too many in short time
- **Mitigation:**
  - Respect rate limits (1 req/sec)
  - Cache results aggressively
  - Retry with exponential backoff
  - Show user-friendly error if blocked

**Risk 5: Memory Leaks in Puppeteer**
- **Impact:** App becomes slow/crashes after many searches
- **Mitigation:**
  - Close pages after each operation
  - Reuse browser instance (not create new ones)
  - Periodic browser restart (every 50 searches)
  - Monitor memory usage in development

### Low Risks

**Risk 6: Fuzzy Matching False Positives**
- **Impact:** Incorrect duplicate detection
- **Mitigation:**
  - Conservative matching threshold (85%+)
  - Show user what was matched
  - Allow user to override (Download Anyway button)

---

## Success Criteria

### Functional Requirements
- ✅ Users can search by track name and see which albums contain it
- ✅ RuTracker results grouped by type (Studio/Live/Compilation)
- ✅ Users can preview track listings before downloading
- ✅ Duplicate detection warns before downloading existing content
- ✅ Retry logic handles transient MusicBrainz failures
- ✅ All operations show progress indicators

### Non-Functional Requirements
- ✅ Duplicate check completes in < 2s for 5000 files
- ✅ Torrent page parse completes in < 3s
- ✅ No memory leaks (stable memory usage over 100 searches)
- ✅ 80% unit test coverage for business logic
- ✅ Zero regressions in existing functionality

### User Experience
- ✅ Users report search is "smarter" and "more helpful"
- ✅ Reduced duplicate downloads
- ✅ Clearer understanding of what's happening during search
- ✅ Easier to find specific albums in large result sets

---

## Appendix

### New File Structure
```
src/
├── main/
│   ├── services/
│   │   ├── TorrentMetadataService.ts (NEW)
│   │   ├── DuplicateDetectionService.ts (NEW)
│   │   ├── SearchOrchestrationService.ts (NEW)
│   │   ├── MusicBrainzService.ts (ENHANCED)
│   │   └── RuTrackerSearchService.ts (ENHANCED)
│   └── ipc/
│       ├── torrentMetadataHandlers.ts (NEW)
│       ├── duplicateDetectionHandlers.ts (NEW)
│       └── searchOrchestrationHandlers.ts (NEW)
├── renderer/
│   ├── components/features/search/
│   │   ├── GroupedResultsList.tsx (NEW)
│   │   ├── TorrentTrackListPreview.tsx (NEW)
│   │   ├── DuplicateWarningDialog.tsx (NEW)
│   │   └── ActivityLog.tsx (ENHANCED)
│   └── store/
│       └── smartSearchStore.ts (REFACTORED)
└── shared/
    ├── types/
    │   ├── torrentMetadata.types.ts (NEW)
    │   └── duplicateDetection.types.ts (NEW)
    └── constants.ts (ENHANCED - new IPC channels)
```

### New IPC Channels
```typescript
// Torrent Metadata
TORRENT_PARSE_METADATA: 'torrent:parseMetadata'
TORRENT_PARSE_PROGRESS: 'torrent:parseProgress'

// Duplicate Detection
DUPLICATE_CHECK: 'duplicate:check'
DUPLICATE_RESCAN: 'duplicate:rescan'

// Search Orchestration
SEARCH_ORCHESTRATION_START: 'searchOrchestration:start'
SEARCH_ORCHESTRATION_PROGRESS: 'searchOrchestration:progress'
SEARCH_ORCHESTRATION_CANCEL: 'searchOrchestration:cancel'

// Enhanced MusicBrainz
MUSICBRAINZ_FIND_TRACK: 'musicbrainz:findTrack'
```

### Estimated Effort

| Phase | Duration | Complexity | Dependencies |
|-------|----------|------------|--------------|
| Phase 1: Foundation | 1 week | Medium | None |
| Phase 2: Torrent Metadata | 1 week | High | Phase 1 |
| Phase 3: Duplicate Detection | 1.5 weeks | High | Phase 1 |
| Phase 4: MusicBrainz Enhancements | 1 week | Medium | Phase 1 |
| Phase 5: Result Grouping | 1 week | Low | Phase 1 |
| Phase 6: Orchestration | 1.5 weeks | High | Phases 2-5 |
| Phase 7: Polish | 1 week | Low | Phase 6 |

**Total Estimated Duration:** 5-6 weeks

---

## Progress Tracker

### Completed

#### Store Simplification (pre-plan)
- `smartSearchStore` refactored to pure UI state
- Orchestration moved to `useSmartSearchWorkflow` hook
- Search error retry button added to `SearchErrorNotice`

#### Result Grouping — Pure Logic (2026-02-17)
- **Created** `src/main/services/rutracker/utils/resultGrouper.ts` — `classifyResult()`, `groupResults()`, `filterDiscographyPages()`
- **Created** `src/shared/utils/resultClassifier.ts` — shared `isLikelyDiscography()` (importable by both main and renderer)
- **Created** `src/main/services/rutracker/utils/resultGrouper.spec.ts` — 15 tests
- **Deduplicated** discography detection from 3 files into single source of truth
- **Updated** `DiscographySearchService.ts`, `useSmartSearchWorkflow.ts`, `InlineSearchResults.tsx` to use shared classifier
- Classification: discography / live / compilation / studio (priority order)

#### MusicBrainz Retry with Backoff (2026-02-17)
- **Created** `src/main/services/utils/retryWithBackoff.ts` — generic async retry with exponential backoff + jitter
- **Created** `src/main/services/utils/retryWithBackoff.spec.ts` — 8 tests
- **Applied** to `MusicBrainzService.request()` — retries on 429, 503, 5xx, network errors (max 3 retries)

#### Torrent Page Parser — Pure Logic (2026-02-17)
- **Created** `src/shared/types/torrentMetadata.types.ts` — `TorrentTrack`, `ParsedAlbum`, `TorrentPageMetadata`
- **Created** `src/main/services/rutracker/utils/torrentPageParser.ts` — `parseAlbumsFromHtml()`, `parseTracksFromText()`, `parseTracksFromCue()`, `extractFormatInfo()`
- **Created** `src/main/services/rutracker/utils/torrentPageParser.spec.ts` — 18 tests
- Handles: discography pages (multiple sp-wrap albums), single album pages, CUE sheet fallback, multi-CD, Russian text

### Remaining

#### Torrent Metadata Service + IPC (Step 4)
- Wire `torrentPageParser` into `TorrentMetadataService` with Puppeteer
- Add IPC channel `torrent:parse-metadata`, handler, preload API
- Cache parsed results in memory

#### Track List Preview UI (Step 5)
- `TorrentTrackListPreview.tsx` component (Chakra UI)
- Integrate into `InlineSearchResults.tsx` as action on torrent items

#### Grouped Results UI (Step 6)
- Render `groupResults()` output as collapsible category sections in `InlineSearchResults.tsx`
- Group headers with counts, "Show more" per group

#### Duplicate Detection (Step 7 — optional)
- `trackMatcher.ts` — fuzzy matching pure functions
- `DuplicateDetectionService` — scan project dir for audio files
- `DuplicateWarningDialog.tsx` — warning before download

### Dropped

#### SearchOrchestrationService
**Decision:** Not implementing. The workflow is inherently interactive (user picks at each step). Moving orchestration from the renderer hook to the main process would add IPC round-trips with no testability gain. The `useSmartSearchWorkflow` hook approach works well.
