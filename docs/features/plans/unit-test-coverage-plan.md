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
| Shared utils                  | `resultClassifier.ts`, `songMatcher.ts`                                                                   | Pure functions, trivially testable                       |
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

## Implementation Order

| Phase | Files                                                                                            | New test cases | Effort                          |
| ----- | ------------------------------------------------------------------------------------------------ | -------------- | ------------------------------- |
| **1** | `resultClassifier.spec.ts`, `songMatcher.spec.ts`, `urlBuilder.spec.ts`                          | ~33            | Low — pure functions, no mocks  |
| **2** | `StreamPreviewService.spec.ts`                                                                   | ~18            | Medium — mock WebTorrent client |
| **3** | `MixExportService.spec.ts`                                                                       | ~14            | Medium — mock sub-services      |
| **4** | `project.schema.spec.ts`, `torrent.schema.spec.ts`, `mixExport.schema.spec.ts`                   | ~17            | Low — `.safeParse()` calls      |
| **5** | `torrentFileFinder.spec.ts`, `audioFolderSync.spec.ts`, `ffmpegVersion.spec.ts`                  | ~19            | Medium — extract + test         |
| **6** | `TorrentMetadataService.spec.ts`, `DownloadHistoryManager.spec.ts`, `SessionPersistence.spec.ts` | ~22            | Medium — mock FS/browser        |
| **7** | `MusicBrainzApiClient.spec.ts`                                                                   | ~8             | Medium — mock HTTP              |

**Total: ~131 new test cases across 13 new spec files + 3 extracted utility modules**

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
