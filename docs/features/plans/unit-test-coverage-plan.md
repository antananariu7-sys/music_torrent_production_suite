# Unit Test Coverage Plan

## Current State

**35 spec files** covering ~560 test cases across services, utils, and stores. Coverage is strong for core business logic (project management, torrent helpers, mix export sub-components, search/filter utils) but has clear gaps in newer services, shared validation, and embedded handler logic.

### What's Well-Tested

| Area                  | Spec files                                                                                                                                                                                                   | Notes                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| Project management    | `ProjectService.spec.ts`, `ConfigService.spec.ts`, `FileSystemService.spec.ts`, `LockService.spec.ts`                                                                                                        | CRUD, recent projects, file ops, locking |
| RuTracker search      | `RuTrackerSearchService.spec.ts`, `formatDetector.spec.ts`, `sizeParser.spec.ts`, `relevanceScorer.spec.ts`, `resultGrouper.spec.ts`, `SearchFilters.spec.ts`, `torrentPageParser.spec.ts`                   | Full pipeline                            |
| WebTorrent            | `WebTorrentService.spec.ts`, `torrentHelpers.spec.ts`, `torrentPersistence.spec.ts`, `ProgressBroadcaster.spec.ts`, `FileSelectionHandler.spec.ts`, `TorrentLifecycleManager.spec.ts`, `fileCleanup.spec.ts` | All sub-modules                          |
| Mix export components | `FilterGraphBuilder.spec.ts`, `CueSheetGenerator.spec.ts`, `MixValidator.spec.ts`, `LoudnormAnalyzer.spec.ts`                                                                                                | Individual pipeline stages               |
| Waveform/BPM          | `WaveformExtractor.spec.ts`, `BpmDetector.spec.ts`                                                                                                                                                           | Extraction + detection                   |
| Auth & history        | `AuthService.spec.ts`, `SearchHistoryService.spec.ts`, `TorrentCollectionService.spec.ts`, `DiscographySearchService.spec.ts`, `MusicBrainzService.spec.ts`                                                  | Core flows                               |
| Utils                 | `ffmpegRunner.spec.ts`, `parseAudioMeta.spec.ts`, `retryWithBackoff.spec.ts`                                                                                                                                 |                                          |
| Renderer              | `smartSearchStore.spec.ts`, `ProjectOverview/utils.spec.ts`                                                                                                                                                  |                                          |

### What's NOT Tested

| Area                          | Files                                                                                                     | Impact                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Stream preview service        | `StreamPreviewService.ts`                                                                                 | New feature, 253 lines, zero tests                       |
| Mix export orchestrator       | `MixExportService.ts`                                                                                     | 310 lines, sub-components tested but coordination is not |
| Shared utils                  | `resultClassifier.ts`, `songMatcher.ts`, `flacImageDetector.ts`, `trackMatcher.ts`                        | Pure functions, trivially testable                       |
| Search table hook             | `useSearchTableState.ts`                                                                                  | Complex business logic: sort, filter, pagination, groups |
| Duplicate detection           | `DuplicateDetectionService.ts`                                                                            | FS scanning, fuzzy matching, cache logic                 |
| Load more results             | `RuTrackerSearchService.loadMoreResults()`                                                                | Pagination, batching, deduplication                      |
| Shared schemas                | `project.schema.ts`, `torrent.schema.ts`, `search.schema.ts`, `mixExport.schema.ts`, `waveform.schema.ts` | Zod `refine()` validators untested                       |
| Torrent metadata service      | `TorrentMetadataService.ts`                                                                               | Cache logic + auth guard                                 |
| MusicBrainz API client        | `MusicBrainzApiClient.ts`, `albumSearch.ts`, `classifySearch.ts`, `artistAlbums.ts`                       | Rate limiting, retry, classification                     |
| Session management            | `SessionPersistence.ts`, `SessionValidator.ts`                                                            | File I/O, cookie handling                                |
| Download history              | `DownloadHistoryManager.ts`                                                                               | Per-project JSON persistence                             |
| Scraper utils                 | `urlBuilder.ts`                                                                                           | Pure function, zero tests                                |
| FFmpeg path                   | `ffmpegPath.ts`                                                                                           | Asar path rewriting branch                               |
| IPC handlers (embedded logic) | `torrentHandlers.ts`, `projectHandlers.ts`, `audioHandlers.ts`                                            | Path normalization, file scanning, version parsing       |

---

## Plan

### Priority Tiers

**Tier 1 — Pure functions with zero dependencies (highest value, lowest effort)**
These require no mocking and can be written in minutes.

**Tier 2 — Services with mockable dependencies (high value, moderate effort)**
Require mocking electron-store, filesystem, or other services.

**Tier 3 — Embedded logic extraction + testing (medium value, moderate effort)**
Logic buried in IPC handlers that should be extracted into testable pure functions.

**Tier 4 — Schema validation tests (low-medium value, low effort)**
Zod `refine()` cross-field validators — declarative but worth verifying edge cases.

---

## Tier 1: Pure Functions

### 1.1 `src/shared/utils/resultClassifier.spec.ts`

**Target:** `src/shared/utils/resultClassifier.ts`

**Functions to test:**

- `isLikelyDiscography(title: string): boolean` — keyword matching (discography, anthology, complete works, etc.)
- `classifyResult(result): 'album' | 'discography' | 'compilation'` — classification logic
- `groupResults(results): GroupedResults` — grouping by classification
- `filterDiscographyPages(results): Result[]` — filter to discography-only

**Test cases (~15):**

- Titles with "discography", "Discography", "DISCOGRAPHY" (case insensitivity)
- Titles with "anthology", "complete works", "collection"
- Album titles that should NOT match (e.g., "Thriller", "Dark Side of the Moon")
- Edge cases: empty string, very long title, title with keyword as substring ("methodiscography")
- `groupResults` with mixed types, empty array, single item
- `filterDiscographyPages` with no discographies in input

### 1.2 `src/shared/utils/songMatcher.spec.ts`

**Target:** `src/shared/utils/songMatcher.ts`

**Functions to test:**

- `isSongMatch(searchTitle, candidateTitle): boolean` — fuzzy title normalization + substring matching

**Test cases (~12):**

- Exact match: `"Blue Monday"` vs `"Blue Monday"`
- Case-insensitive: `"blue monday"` vs `"Blue Monday"`
- With track numbers: `"01 - Blue Monday"` vs `"Blue Monday"`
- With artist prefix: `"New Order - Blue Monday"` vs `"Blue Monday"`
- Punctuation differences: `"Don't Stop"` vs `"Dont Stop"`
- Partial match: `"Blue Monday (Extended Mix)"` vs `"Blue Monday"`
- No match: `"Blue Monday"` vs `"Bizarre Love Triangle"`
- Empty strings, whitespace-only strings

### 1.3 `src/main/services/rutracker/utils/urlBuilder.spec.ts`

**Target:** `src/main/services/rutracker/utils/urlBuilder.ts`

**Functions to test:**

- `buildSearchUrl(query, page): string` — constructs RuTracker search URL with query encoding

**Test cases (~6):**

- Basic query, page 1
- Query with special characters (Cyrillic, spaces, ampersands)
- Page > 1 (pagination offset)
- Empty query
- Page 0 / negative page

---

## Tier 2: Services with Mockable Dependencies

### 2.1 `src/main/services/StreamPreviewService.spec.ts`

**Target:** `src/main/services/StreamPreviewService.ts` (253 lines)

**Mock:** WebTorrent client, `WebContents` (IPC sender)

**Functions to test:**

- Extension validation — supported formats pass, unsupported (`.ape`, `.wma`) reject with error
- Buffer size selection — compressed formats get 2MB, lossless (`.flac`, `.wav`) get 4MB
- MIME type mapping — each supported extension maps to correct MIME type
- Data URL construction — `data:audio/mpeg;base64,...` format
- Progress clamping — never exceeds 99% during buffering (100% = ready)
- Start when already active — stops previous before starting new
- Stop when idle — no-op, no error
- Metadata timeout — fires error after 15s with no torrent metadata
- File index out of bounds — error reported
- Unsupported format detection — checked before torrent connection starts

**Test cases (~18):**

- `start()` with supported extension → begins buffering
- `start()` with `.ape` → immediate error "Preview not available for this format"
- `start()` while already buffering → previous stopped, new started
- `stop()` → destroys torrent, clears state
- `stop()` when idle → no error
- Buffer size for `.mp3` → 2MB
- Buffer size for `.flac` → 4MB
- MIME type for `.mp3` → `audio/mpeg`
- MIME type for `.flac` → `audio/flac`
- MIME type for `.ogg` → `audio/ogg`
- Progress at 50% buffer → emits `{ progress: 50 }`
- Progress at 100% buffer → clamped to 99 (ready event sent separately)
- File index > files.length → error
- File index < 0 → error
- Metadata timeout → error "No peers available"
- `cleanup()` → destroys client, safe to call multiple times

### 2.2 `src/main/services/mixExport/MixExportService.spec.ts`

**Target:** `src/main/services/mixExport/MixExportService.ts` (310 lines)

**Mock:** `MixValidator`, `LoudnormAnalyzer`, `FilterGraphBuilder`, `ffmpegRunner`, `CueSheetGenerator`, `BrowserWindow`

**Functions to test:**

- `computeTotalDuration` (extract to public or test via pipeline) — sums effective durations minus crossfade overlaps
- Double-start guard — `startExport()` while active throws
- Cancel during analysis phase — kills process, cleans up
- Cancel during render phase — kills FFmpeg, deletes partial file
- Progress broadcast — correct phase labels and percentages
- Successful pipeline — all 5 phases complete in order
- Validation failure — short-circuits with error

**Test cases (~14):**

- `startExport` with 3 songs, valid config → pipeline completes
- `startExport` while already exporting → throws "Export already in progress"
- `cancelExport` during analysis → sets cancelled state, cleans up
- `cancelExport` during render → kills FFmpeg, deletes partial output
- `cancelExport` when idle → no-op
- Total duration: 3 songs (180s, 240s, 300s), crossfades (5s, 3s) → 180+240+300-5-3 = 712s
- Total duration: single song → song duration, no crossfade subtraction
- Total duration: songs with trim → uses `(trimEnd - trimStart)` not full duration
- Progress broadcast: analysis phase → `{ phase: 'analyzing', trackIndex, trackCount }`
- Progress broadcast: render phase → `{ phase: 'rendering', percent, eta }`
- Validation returns missing files → export rejects with file list
- Output file created at expected path with correct extension

### 2.3 `src/main/services/TorrentMetadataService.spec.ts`

**Target:** `src/main/services/TorrentMetadataService.ts` (182 lines)

**Mock:** `AuthService`, Puppeteer `Browser`/`Page`, in-memory cache

**Functions to test:**

- Cache hit — second call with same URL returns cached result without browser launch
- Cache miss — first call launches browser, fetches page, caches result
- Auth guard — not logged in → returns error immediately
- `clearCache()` — empties the map, next call re-fetches
- Error handling — page navigation failure → meaningful error message

**Test cases (~8):**

- `parseMetadata` when not logged in → `{ success: false, error: "Not authenticated" }`
- `parseMetadata` first call → launches browser, returns metadata, caches it
- `parseMetadata` second call same URL → returns from cache, browser not called again
- `parseMetadata` with invalid URL → error
- `clearCache` → cache empty, next call re-fetches
- Browser launch failure → error propagated
- Page timeout → error with useful message

### 2.4 `src/main/services/torrent/DownloadHistoryManager.spec.ts`

**Target:** `src/main/services/torrent/DownloadHistoryManager.ts`

**Mock:** Filesystem (or use temp dir)

**Functions to test:**

- Add download entry → persisted to JSON file
- Get history for project → returns entries sorted by date
- Empty project → returns empty array
- File doesn't exist yet → creates it on first write
- Corrupted JSON → handles gracefully (returns empty, overwrites)

**Test cases (~8):**

- `addEntry(projectId, entry)` → file written with entry
- `addEntry` twice → both entries in file
- `getHistory(projectId)` → returns entries
- `getHistory` for unknown project → empty array
- History file missing → empty array, no error
- History file corrupted JSON → empty array, file recoverable

### 2.5 `src/main/services/auth/session/SessionPersistence.spec.ts`

**Target:** `src/main/services/auth/session/SessionPersistence.ts`

**Mock:** Filesystem (or use temp dir)

**Functions to test:**

- Save session cookies → JSON written to disk
- Load session cookies → parsed from disk
- No saved session → returns null
- Corrupted session file → returns null, doesn't throw
- Clear session → file deleted

**Test cases (~6):**

- `save(cookies)` → JSON file written
- `load()` → returns saved cookies
- `load()` when no file → returns null
- `load()` with corrupted file → returns null
- `clear()` → file removed
- `clear()` when no file → no error

### 2.6 `src/main/services/musicbrainz/MusicBrainzApiClient.spec.ts`

**Target:** `src/main/services/musicbrainz/MusicBrainzApiClient.ts`

**Mock:** HTTP fetch/axios

**Functions to test:**

- Successful API call → returns parsed JSON
- Rate limiting — respects 1 request/second MusicBrainz policy
- Retry on 503 → retries with backoff
- 404 → returns null/empty (not an error)
- Network error → throws with context

**Test cases (~8):**

- `search(query)` → returns results
- Sequential calls respect rate limit (second call delayed)
- 503 response → retries up to N times
- 404 response → returns empty result
- Network failure → throws with error message
- Timeout → throws with timeout message

---

## Tier 3: Embedded Logic Extraction

These are logic fragments buried in IPC handlers that should be extracted into pure utility functions with their own tests.

### 3.1 Extract from `src/main/ipc/torrentHandlers.ts`

**Logic:** Local `.torrent` file lookup (lines ~90-116). Searches for `{id}.torrent` (legacy) and `*[{id}].torrent` (human-readable suffix) in the download directory.

**Extract to:** `src/main/utils/torrentFileFinder.ts`

```ts
export function findLocalTorrentFile(
  dir: string,
  torrentId: string,
  files: string[]
): string | null
```

**Test file:** `src/main/utils/torrentFileFinder.spec.ts`

**Test cases (~6):**

- Legacy format: `"12345.torrent"` found → returns full path
- Suffix format: `"Artist - Album [12345].torrent"` found → returns full path
- Both exist → returns suffix format (preferred)
- No match → returns null
- Empty directory listing → returns null
- Multiple matches with same ID → returns first

### 3.2 Extract from `src/main/ipc/projectHandlers.ts`

**Logic:** Audio folder sync path normalization (lines ~252-315). Normalizes paths (backslash→forward-slash, lowercase), compares against known songs to find new files.

**Extract to:** `src/main/utils/audioFolderSync.ts`

```ts
export function findNewAudioFiles(
  folderFiles: string[],
  knownSongPaths: string[],
  audioExtensions: Set<string>
): string[]
```

**Test file:** `src/main/utils/audioFolderSync.spec.ts`

**Test cases (~8):**

- New `.mp3` file not in known paths → included
- Existing file already in known paths → excluded
- Non-audio file (`.txt`, `.jpg`) → excluded
- Path normalization: backslash vs forward-slash considered same
- Case-insensitive path comparison on Windows
- Empty folder → empty result
- Empty known paths → all audio files returned
- Mixed: some new, some existing → correct subset

### 3.3 Extract from `src/main/ipc/audioHandlers.ts`

**Logic:** FFmpeg version string parsing (regex match on `ffmpeg version X.Y.Z`).

**Extract to:** `src/main/utils/ffmpegVersion.ts`

```ts
export function parseFfmpegVersion(output: string): string | null
```

**Test file:** `src/main/utils/ffmpegVersion.spec.ts`

**Test cases (~5):**

- Standard version: `"ffmpeg version 6.1.1 Copyright..."` → `"6.1.1"`
- Git version: `"ffmpeg version N-112345-g..."` → `"N-112345-g..."`
- No version found → null
- Empty string → null
- Multi-line output → finds version in first line

---

## Tier 4: Schema Validation

### 4.1 `src/shared/schemas/project.schema.spec.ts`

**Target:** `project.schema.ts` `refine()` validators

**Test cases (~8):**

- Project name with `<` → fails validation
- Project name with `>`, `:`, `"`, `\`, `|`, `?`, `*` → fails
- Project name with `/` → fails
- Normal project name → passes
- `AddSongRequest` with both `downloadId` and `externalFilePath` → passes
- `AddSongRequest` with neither → fails refine
- `AddSongRequest` with only `downloadId` → passes
- `AddSongRequest` with only `externalFilePath` → passes

### 4.2 `src/shared/schemas/torrent.schema.spec.ts`

**Target:** `torrent.schema.ts` `refine()` validators

**Test cases (~5):**

- `AddTorrentRequest` with `magnetUri` only → passes
- `AddTorrentRequest` with `torrentFilePath` only → passes
- `AddTorrentRequest` with both → passes
- `AddTorrentRequest` with neither → fails refine
- `WebTorrentSettings` with negative speed limit → fails

### 4.3 `src/shared/schemas/mixExport.schema.spec.ts`

**Target:** `mixExport.schema.ts`

**Test cases (~4):**

- Valid MP3 request with bitrate 320 → passes
- MP3 with invalid bitrate (256 is valid, 257 is not) → check literal union
- Crossfade duration -1 → fails (min 0)
- Crossfade duration 31 → fails (max 30)

---

---

## Search Results Table — Test Coverage Extension

Added 2026-02-24 after the Search Results Table feature (9 phases) was completed. The feature introduced new shared utils, a service, and a React hook with significant business logic.

**Existing coverage**: `nonAudioDetector.spec.ts` (81 test cases in `src/shared/utils/__tests__/`).

### ST-1: Pure Functions — `flacImageDetector.spec.ts`

**Target:** `src/shared/utils/flacImageDetector.ts`
**Exports:** `isFlacImage(result: SearchResult): boolean`

**Test cases (~12):**

- **Keyword detection (title):**
  - Title contains "image" → true
  - Title contains "img" → true
  - Title contains "cue" → true
  - Title contains "образ" (Cyrillic) → true
  - Title contains "ape+cue" → true
  - Title contains "flac+cue" → true
  - Title with keyword as substring in unrelated word → verify behavior
  - Title without any keywords, small size → false

- **Large file detection (size + format):**
  - FLAC format, 600MB → true
  - APE format, 600MB → true
  - FLAC format, 400MB (below threshold) → false
  - MP3 format, 600MB → false (only FLAC/APE trigger size check)
  - FLAC format, no sizeBytes → false

### ST-2: Pure Functions — `trackMatcher.spec.ts`

**Target:** `src/shared/utils/trackMatcher.ts`
**Exports:** `normalizeForComparison(name)`, `calculateSimilarity(a, b)`, `DUPLICATE_THRESHOLD`

**Test cases (~18):**

- **normalizeForComparison:**
  - Strips file extension: `"song.mp3"` → `"song"`
  - Strips leading track number: `"01 - Song Name"` → `"song name"`
  - Strips bracketed content: `"Song [Bonus]"` → `"song"`
  - Strips parenthetical content: `"Song (Live)"` → `"song"`
  - Strips format tags: `"Song FLAC 320kbps"` → `"song"`
  - Replaces punctuation: `"don't"` → `"don t"`
  - Collapses whitespace: `"  Song   Name  "` → `"song name"`
  - Empty string → `""`
  - Complex combined: `"01. Artist - Song Name [FLAC].flac"` → `"artist song name"`

- **calculateSimilarity:**
  - Empty strings → 0
  - Identical strings → 100
  - One contains the other → ratio-based score (>0, <100)
  - Completely different → low score
  - Token overlap: shared 2 of 3 tokens → ~67
  - Single-character tokens filtered out → 0 if only short tokens
  - Symmetry: `similarity(a, b) === similarity(b, a)`

- **DUPLICATE_THRESHOLD:** equals 85

### ST-3: Pure Functions — `resultClassifier.spec.ts` + `songMatcher.spec.ts`

Already covered in original Tier 1 (sections 1.1 and 1.2). No changes needed.

### ST-4: Service — `DuplicateDetectionService.spec.ts`

**Target:** `src/main/services/DuplicateDetectionService.ts`
**Mock:** `fs.readdirSync`, `fs.statSync` (or use temp dir with real FS)

**Test cases (~14):**

- **indexAudioDirectory (via check):**
  - Directory with mixed files → only audio extensions indexed (.mp3, .flac, .wav, .ogg, .m4a, .aac, .opus, .ape, .wma, .alac)
  - Non-audio files (.txt, .jpg, .pdf) → excluded
  - Empty directory → empty index
  - Non-existent directory → returns empty, no throw
  - Cache hit: same mtime → reuses cached entries
  - Cache miss: changed mtime → re-scans

- **check:**
  - No audio files in directory → `{ success: true, matches: [], indexedFileCount: 0 }`
  - Title matches file at ≥85% similarity → included in matches with confidence
  - Title below threshold → not included
  - Multiple files match same title → all listed in matchedFiles
  - Multiple titles checked → independent matches for each
  - Best score tracked correctly (highest similarity wins)

- **rescan:**
  - Invalidates cache → next check re-indexes
  - Returns `indexedFileCount` from fresh scan

### ST-5: Service Method — `RuTrackerSearchService.loadMoreResults` (add to existing spec)

**Target:** `src/main/services/RuTrackerSearchService.ts` → `loadMoreResults()`
**Add to:** `src/main/services/RuTrackerSearchService.spec.ts`

**Test cases (~12):**

- Not logged in → `{ success: false, error: "User is not logged in." }`
- Valid request (pages 11-15) → creates correct page range array
- First page determines totalPagesAvailable via `getTotalPages()`
- Relevance scores applied to loaded results
- Filters applied when provided
- Deduplication: results with same ID from different pages → only first kept
- Batch concurrency: max 3 concurrent browser pages created
- Page navigation error in batch → skipped, other pages still processed
- `isComplete: true` when `toPage >= totalPagesAvailable`
- `isComplete: false` when more pages available
- Empty results from a page → no error, loadedCount still incremented
- Browser/session error → returns `{ success: false }` with error message

### ST-6: React Hook — `useSearchTableState` (business logic extraction)

**Target:** `src/renderer/components/features/search/hooks/useSearchTableState.ts`

The hook contains significant business logic: filtering, grouping, sorting (3-level priority), pagination, and row flattening. Two testing approaches:

**Option A: Test with `@testing-library/react` renderHook** (recommended — tests the actual hook)

**Test cases (~20):**

- **Filtering:**
  - Empty filter → all results visible
  - Filter "foo" → only results with "foo" in title (case-insensitive)
  - Filter change resets page to 1 and collapses expanded row

- **Non-audio hiding:**
  - Non-audio results excluded from rows by default
  - `hiddenCount` reflects excluded count
  - `onToggleHidden()` → hidden results appear as separate group at bottom

- **Grouping:**
  - Results classified into studio/live/compilation/other groups
  - Fixed group order: studio → live → compilation → other
  - Groups with 0 results hidden (no group header row)
  - Total results < 5 → flat table (no group headers)

- **Sorting:**
  - Default sort: relevance descending
  - Click column → ascending
  - Click same column again → descending
  - Click same column third time → reset to default (relevance desc)
  - Click different column → ascending on new column, click count resets
  - FLAC images always at bottom within group regardless of sort
  - Discography tab: matched results above unmatched (3-level sort)

- **Pagination:**
  - Default page size 20
  - Results sliced correctly for page 1, page 2, etc.
  - `totalPages` computed correctly (ceil of filteredCount / pageSize)
  - Sort change resets to page 1

- **Row expansion:**
  - `expandedRowId` null by default
  - `onToggleExpand(id)` → expands row
  - Expand different row → previous collapses
  - Expand same row → collapses

**Option B: Extract sorting/grouping into pure functions** (lower effort but less coverage)
Extract `sortWithinGroup`, `buildRows`, `classifyAndGroup` into testable pure functions.

**Recommendation:** Option A with renderHook for full coverage.

---

## Implementation Order (Updated)

| Phase  | Files                                                                                            | New test cases | Effort                          |
| ------ | ------------------------------------------------------------------------------------------------ | -------------- | ------------------------------- |
| **1**  | `resultClassifier.spec.ts`, `songMatcher.spec.ts`, `urlBuilder.spec.ts`                          | ~33            | Low — pure functions, no mocks  |
| **1b** | `flacImageDetector.spec.ts`, `trackMatcher.spec.ts`                                              | ~30            | Low — pure functions, no mocks  |
| **2**  | `StreamPreviewService.spec.ts`                                                                   | ~18            | Medium — mock WebTorrent client |
| **2b** | `DuplicateDetectionService.spec.ts`                                                              | ~14            | Medium — mock FS                |
| **2c** | `RuTrackerSearchService.spec.ts` — add `loadMoreResults` tests                                   | ~12            | Medium — extend existing spec   |
| **3**  | `MixExportService.spec.ts`                                                                       | ~14            | Medium — mock sub-services      |
| **3b** | `useSearchTableState.spec.ts` (renderHook)                                                       | ~20            | Medium — @testing-library/react |
| **4**  | `project.schema.spec.ts`, `torrent.schema.spec.ts`, `mixExport.schema.spec.ts`                   | ~17            | Low — `.safeParse()` calls      |
| **5**  | `torrentFileFinder.spec.ts`, `audioFolderSync.spec.ts`, `ffmpegVersion.spec.ts`                  | ~19            | Medium — extract + test         |
| **6**  | `TorrentMetadataService.spec.ts`, `DownloadHistoryManager.spec.ts`, `SessionPersistence.spec.ts` | ~22            | Medium — mock FS/browser        |
| **7**  | `MusicBrainzApiClient.spec.ts`                                                                   | ~8             | Medium — mock HTTP              |

**Total: ~207 new test cases across 17 new spec files + 3 extracted utility modules**

---

## Verification

After each phase:

- `yarn test:main` — all existing + new tests pass
- `yarn build` — build still works (extracted utils don't break imports)
- No changes to production behavior — tests only, with extract-and-test for Tier 3

## Conventions

- File naming: always `.spec.ts` (never `.test.ts`)
- Test runner: `yarn test:main` with `jest.config.main.ts`
- Flag: `--testPathPatterns <pattern>` for running specific tests
- Mock patterns: follow existing specs (e.g., `ProjectService.spec.ts` for service mocking, `torrentHelpers.spec.ts` for pure function testing)
- React hook testing: `@testing-library/react` `renderHook` for `useSearchTableState`
