# Test Coverage Gap Analysis & Plan

**Date**: 2026-02-22 (updated 2026-02-22)
**Overall coverage**: ~85% (53/62 testable files)

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
- Frontend stores: all 11 non-trivial stores (10 new + smartSearchStore)
- MusicBrainz API: albumSearch, classifySearch, artistAlbums
- RuTracker scrapers: ResultParser, PaginationHandler, PageScraper
- Auth session: SessionPersistence, SessionValidator

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

## Priority 2 — Frontend Stores ✅ DONE (79%, 11/14 tested)

10 new spec files added covering all non-trivial stores:

| File                                           | Status    |
| ---------------------------------------------- | --------- |
| `src/renderer/store/smartSearchStore.ts`       | ✅ Tested |
| `src/renderer/store/downloadQueueStore.ts`     | ✅ Tested |
| `src/renderer/store/fileSelectionStore.ts`     | ✅ Tested |
| `src/renderer/store/torrentActivityStore.ts`   | ✅ Tested |
| `src/renderer/store/torrentCollectionStore.ts` | ✅ Tested |
| `src/renderer/store/useProjectStore.ts`        | ✅ Tested |
| `src/renderer/store/useAuthStore.ts`           | ✅ Tested |
| `src/renderer/store/mixExportStore.ts`         | ✅ Tested |
| `src/renderer/store/timelineStore.ts`          | ✅ Tested |
| `src/renderer/store/useSearchStore.ts`         | ✅ Tested |
| `src/renderer/store/useSettingsStore.ts`       | ✅ Tested |
| `src/renderer/store/streamPreviewStore.ts`     | ⏭️ Skip   |
| `src/renderer/store/useThemeStore.ts`          | ⏭️ Skip   |
| `src/renderer/store/audioPlayerStore.ts`       | ⏭️ Skip   |

---

## Priority 3 — MusicBrainz API Layer ✅ DONE (100%, 4/4)

| File                                                        | Status                                 |
| ----------------------------------------------------------- | -------------------------------------- |
| `src/main/services/musicbrainz/api/albumSearch.ts`          | ✅ Tested                              |
| `src/main/services/musicbrainz/api/classifySearch.ts`       | ✅ Tested                              |
| `src/main/services/musicbrainz/api/artistAlbums.ts`         | ✅ Tested                              |
| ~~`src/main/services/musicbrainz/MusicBrainzApiClient.ts`~~ | ✅ Covered via MusicBrainzService.spec |

---

## Priority 4 — RuTracker Scrapers ✅ DONE (100%, 3/3)

| File                                                        | Status    |
| ----------------------------------------------------------- | --------- |
| `src/main/services/rutracker/scrapers/ResultParser.ts`      | ✅ Tested |
| `src/main/services/rutracker/scrapers/PaginationHandler.ts` | ✅ Tested |
| `src/main/services/rutracker/scrapers/PageScraper.ts`       | ✅ Tested |

---

## Priority 5 — Auth Session Classes ✅ DONE (100%, 2/2)

| File                                                   | Status    |
| ------------------------------------------------------ | --------- |
| `src/main/services/auth/session/SessionPersistence.ts` | ✅ Tested |
| `src/main/services/auth/session/SessionValidator.ts`   | ✅ Tested |

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
| Auth Subsystem               | 2       | 2      | 100%     | ✅ Done                          |
| MusicBrainz APIs             | 4       | 4      | 100%     | ✅ Done                          |
| RuTracker Scrapers           | 3       | 3      | 100%     | ✅ Done                          |
| Other Services               | 4       | 2      | 50%      | Priority 6                       |
| Frontend Stores              | 14      | 11     | 79%      | ✅ Done (3 skipped as trivial)   |
| Renderer Utils               | 1       | 1      | 100%     | Done                             |
| Frontend Hooks               | 1       | 0      | 0%       | Priority 6                       |
| **Total**                    | **~62** | **53** | **~85%** |                                  |
