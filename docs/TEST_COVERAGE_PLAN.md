# Test Coverage Gap Analysis & Plan

**Date**: 2026-02-22 (updated 2026-02-22)
**Overall coverage**: ~56% (35/62 testable files)

---

## What's Well Covered (keep as-is)

- Core infrastructure: FileSystemService, ConfigService, LockService, ProjectService
- Session lifecycle: AuthService
- Queue operations: WebTorrentService (main), TorrentDownloadService
- WebTorrent subsystems: ProgressBroadcaster, TorrentLifecycleManager, FileSelectionHandler, torrentPersistence, torrentHelpers, fileCleanup (120 tests added)
- Utilities: formatDetector, sizeParser, relevanceScorer, SearchFilters, retryWithBackoff, resultGrouper, torrentPageParser
- State machine: `smartSearchStore` (the only tested store, 100+ tests)
- Services: DiscographySearchService, MusicBrainzService (facade), TorrentCollectionService, SearchHistoryService
- Mix export: FilterGraphBuilder, CueSheetGenerator, LoudnormAnalyzer, MixValidator
- Waveform: WaveformExtractor, BpmDetector
- Main utils: ffmpegRunner, parseAudioMeta
- Renderer utils: ProjectOverview/utils

---

## Priority 1 — WebTorrent Subsystems ✅ DONE (100%, 6/6)

All 6 files now have specs (120 tests added in commit `043a54d`):

| File                                                               | Status    |
| ------------------------------------------------------------------ | --------- |
| `src/main/services/webtorrent/managers/ProgressBroadcaster.ts`     | ✅ Tested |
| `src/main/services/webtorrent/managers/TorrentLifecycleManager.ts` | ✅ Tested |
| `src/main/services/webtorrent/handlers/FileSelectionHandler.ts`    | ✅ Tested |
| `src/main/services/webtorrent/utils/torrentPersistence.ts`         | ✅ Tested |
| `src/main/services/webtorrent/utils/torrentHelpers.ts`             | ✅ Tested |
| `src/main/services/webtorrent/utils/fileCleanup.ts`                | ✅ Tested |

---

## Priority 2 — Frontend Stores (7%, 1/14 tested)

| File                                           | Complexity | What to test                                       |
| ---------------------------------------------- | ---------- | -------------------------------------------------- |
| `src/renderer/store/downloadQueueStore.ts`     | High       | Async ops, queue ordering, state transitions       |
| `src/renderer/store/fileSelectionStore.ts`     | High       | File selection logic, mirrors FileSelectionHandler |
| `src/renderer/store/torrentActivityStore.ts`   | Medium     | Real-time update handling                          |
| `src/renderer/store/torrentCollectionStore.ts` | Medium     | CRUD operations, IPC integration                   |
| `src/renderer/store/useProjectStore.ts`        | Medium     | Project lifecycle, state transitions               |
| `src/renderer/store/useAuthStore.ts`           | Medium     | Session state, login/logout flows                  |
| `src/renderer/store/mixExportStore.ts`         | Medium     | Export flow state, progress tracking               |
| `src/renderer/store/timelineStore.ts`          | Medium     | Zoom/scroll state, waveform cache, popover state   |
| `src/renderer/store/useSearchStore.ts`         | Low        | UI state correctness                               |
| `src/renderer/store/useSettingsStore.ts`       | Low        | Settings persistence                               |
| `src/renderer/store/streamPreviewStore.ts`     | Low        | **Skip** — trivial                                 |
| `src/renderer/store/useThemeStore.ts`          | Low        | **Skip** — trivial                                 |
| `src/renderer/store/audioPlayerStore.ts`       | Low        | **Skip** — trivial                                 |

---

## Priority 3 — MusicBrainz API Layer (25%, 1/4)

Facade (`MusicBrainzService`) is now tested. Sub-API modules still uncovered:

| File                                                        | What to test                              |
| ----------------------------------------------------------- | ----------------------------------------- |
| `src/main/services/musicbrainz/api/albumSearch.ts`          | Search query construction, result mapping |
| `src/main/services/musicbrainz/api/classifySearch.ts`       | Classification logic, edge cases          |
| `src/main/services/musicbrainz/api/artistAlbums.ts`         | Album fetching, pagination                |
| ~~`src/main/services/musicbrainz/MusicBrainzApiClient.ts`~~ | ✅ Covered via MusicBrainzService.spec    |

---

## Priority 4 — RuTracker Scrapers (0%, 3 files)

| File                                                        | What to test                               |
| ----------------------------------------------------------- | ------------------------------------------ |
| `src/main/services/rutracker/scrapers/ResultParser.ts`      | HTML parsing branches, malformed input     |
| `src/main/services/rutracker/scrapers/PaginationHandler.ts` | Pagination edge cases, last page detection |
| `src/main/services/rutracker/scrapers/PageScraper.ts`       | Request/session handling, error recovery   |

---

## Priority 5 — Auth Session Classes (0%, 2 files)

| File                                                   | What to test                                 |
| ------------------------------------------------------ | -------------------------------------------- |
| `src/main/services/auth/session/SessionPersistence.ts` | File I/O, serialization, corruption handling |
| `src/main/services/auth/session/SessionValidator.ts`   | Validation rules, expiry logic, edge cases   |

---

## Priority 6 — Other (lower priority)

| File                                             | What to test                           |
| ------------------------------------------------ | -------------------------------------- |
| `src/renderer/hooks/useDownloadQueueListener.ts` | Listener setup/cleanup, event handling |

---

## Files to Skip (trivial, low ROI)

- `src/renderer/store/useThemeStore.ts`
- `src/renderer/store/audioPlayerStore.ts`
- `src/renderer/store/streamPreviewStore.ts`
- All `index.ts` re-export files
- All `types.ts` and `schemas/` files

---

## Coverage Summary Table

| Component                    | Files   | Tested | Coverage | Priority                         |
| ---------------------------- | ------- | ------ | -------- | -------------------------------- |
| Core Infrastructure Services | 8       | 8      | 100%     | Done                             |
| RuTracker Utils              | 7       | 6      | 86%      | Done                             |
| WebTorrentService (main)     | 1       | 1      | 100%     | Done                             |
| WebTorrent Subsystems        | 6       | 6      | 100%     | Done                             |
| Mix Export                   | 5       | 4      | 80%      | Done (MixExportService untested) |
| Waveform/BPM                 | 2       | 2      | 100%     | Done                             |
| Main Utils                   | 3       | 2      | 67%      | Done (ffmpegPath untested)       |
| Auth Subsystem               | 2       | 0      | **0%**   | Priority 5                       |
| MusicBrainz APIs             | 4       | 1      | **25%**  | Priority 3                       |
| RuTracker Scrapers           | 3       | 0      | **0%**   | Priority 4                       |
| Other Services               | 4       | 2      | 50%      | Priority 6                       |
| Frontend Stores              | 14      | 1      | **7%**   | **Priority 2**                   |
| Renderer Utils               | 1       | 1      | 100%     | Done                             |
| Frontend Hooks               | 1       | 0      | 0%       | Priority 6                       |
| **Total**                    | **~62** | **35** | **~56%** |                                  |
