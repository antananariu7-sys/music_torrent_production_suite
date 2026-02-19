# Test Coverage Gap Analysis & Plan

**Date**: 2026-02-19
**Overall coverage**: 41% (19/46 testable files)

---

## What's Well Covered (keep as-is)

- Core infrastructure: FileSystemService, ConfigService, LockService, ProjectService
- Session lifecycle: AuthService
- Queue operations: WebTorrentService (main)
- Utilities: formatDetector, sizeParser, relevanceScorer, SearchFilters, retryWithBackoff
- State machine: `smartSearchStore` (the only tested store, 100+ tests)

---

## Priority 1 — WebTorrent Subsystems (0%, 6 files)

Real-time progress, lifecycle, and file selection — complex state logic, high bug risk.

| File | What to test |
|------|-------------|
| `src/main/services/webtorrent/managers/ProgressBroadcaster.ts` | Progress calculation, partial download tracking, completion detection |
| `src/main/services/webtorrent/managers/TorrentLifecycleManager.ts` | State transitions, error handling |
| `src/main/services/webtorrent/handlers/FileSelectionHandler.ts` | File selection/deselection, cleanup, bounds checking |
| `src/main/services/webtorrent/utils/torrentPersistence.ts` | Save/load queue logic, error paths |
| `src/main/services/webtorrent/utils/torrentHelpers.ts` | File mapping/transformation |
| `src/main/services/webtorrent/utils/fileCleanup.ts` | Deletion logic, error paths |

---

## Priority 2 — Frontend Stores (9%, 1/11 tested)

| File | Complexity | What to test |
|------|-----------|-------------|
| `src/renderer/store/downloadQueueStore.ts` | High | Async ops, queue ordering, state transitions |
| `src/renderer/store/fileSelectionStore.ts` | High | File selection logic, mirrors FileSelectionHandler |
| `src/renderer/store/torrentActivityStore.ts` | Medium | Real-time update handling |
| `src/renderer/store/torrentCollectionStore.ts` | Medium | CRUD operations, IPC integration |
| `src/renderer/store/useProjectStore.ts` | Medium | Project lifecycle, state transitions |
| `src/renderer/store/useAuthStore.ts` | Medium | Session state, login/logout flows |
| `src/renderer/store/useSearchStore.ts` | Low | UI state correctness |
| `src/renderer/store/useSettingsStore.ts` | Low | Settings persistence |
| `src/renderer/store/useThemeStore.ts` | Low | **Skip** — trivial |
| `src/renderer/store/audioPlayerStore.ts` | Low | **Skip** — trivial |

---

## Priority 3 — MusicBrainz API Layer (0%, 4 files)

| File | What to test |
|------|-------------|
| `src/main/services/musicbrainz/MusicBrainzApiClient.ts` | Request building, response parsing, retry logic, error handling |
| `src/main/services/musicbrainz/api/albumSearch.ts` | Search query construction, result mapping |
| `src/main/services/musicbrainz/api/classifySearch.ts` | Classification logic, edge cases |
| `src/main/services/musicbrainz/api/artistAlbums.ts` | Album fetching, pagination |

---

## Priority 4 — RuTracker Scrapers (0%, 3 files)

| File | What to test |
|------|-------------|
| `src/main/services/rutracker/scrapers/ResultParser.ts` | HTML parsing branches, malformed input |
| `src/main/services/rutracker/scrapers/PaginationHandler.ts` | Pagination edge cases, last page detection |
| `src/main/services/rutracker/scrapers/PageScraper.ts` | Request/session handling, error recovery |

---

## Priority 5 — Auth Session Classes (0%, 2 files)

| File | What to test |
|------|-------------|
| `src/main/services/auth/session/SessionPersistence.ts` | File I/O, serialization, corruption handling |
| `src/main/services/auth/session/SessionValidator.ts` | Validation rules, expiry logic, edge cases |

---

## Priority 6 — Other (lower priority)

| File | What to test |
|------|-------------|
| `src/main/services/torrent/DownloadHistoryManager.ts` | History CRUD, cleanup of old entries |
| `src/main/services/discography/PageContentParser.ts` | HTML parsing for discography pages |
| `src/main/services/rutracker/utils/urlBuilder.ts` | URL construction, encoding, edge cases |
| `src/renderer/hooks/useDownloadQueueListener.ts` | Listener setup/cleanup, event handling |

---

## Files to Skip (trivial, low ROI)

- `src/renderer/store/useThemeStore.ts`
- `src/renderer/store/audioPlayerStore.ts`
- All `index.ts` re-export files

---

## Coverage Summary Table

| Component | Files | Tested | Coverage | Priority |
|-----------|-------|--------|----------|----------|
| Core Infrastructure Services | 8 | 8 | 100% | Done |
| RuTracker Utils | 6 | 4 | 67% | Priority 6 |
| WebTorrentService (main) | 1 | 1 | 100% | Done |
| WebTorrent Subsystems | 6 | 0 | **0%** | **Priority 1** |
| Auth Subsystem | 2 | 0 | **0%** | Priority 5 |
| MusicBrainz APIs | 4 | 0 | **0%** | Priority 3 |
| RuTracker Scrapers | 3 | 0 | **0%** | Priority 4 |
| Other Services | 4 | 2 | 50% | Priority 6 |
| Frontend Stores | 11 | 1 | **9%** | **Priority 2** |
| Frontend Hooks | 1 | 0 | 0% | Priority 6 |
| **Total** | **46** | **19** | **41%** | |
