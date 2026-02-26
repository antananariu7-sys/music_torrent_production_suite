# Code Size Refactoring Plan

> Generated: 2026-02-26
> Baseline: **278 files, 37,334 lines** in `src/`
> Target: All files under 400 lines (ideally 200-300)

## Current State

| Status            | Files | Threshold            |
| ----------------- | ----- | -------------------- |
| Critical (>500)   | 5     | Refactor immediately |
| Warning (400-500) | 4     | Refactor soon        |
| Good (<400)       | 269   | No action needed     |

---

## Priority 1 — Critical Files (>500 lines)

### 1. `TimelineLayout.tsx` — 976 lines

**Location:** `src/renderer/components/features/timeline/TimelineLayout.tsx`
**Problem:** Single monolithic component mixing scroll logic, zoom logic, trim drag handling, cue point drag handling, region selection edge dragging, playback control, and 280 lines of JSX render. Far exceeds any threshold.

**Refactoring Strategy: Extract 5 custom hooks + 1 sub-component**

| Extract                   | Lines | Description                                                                         |
| ------------------------- | ----- | ----------------------------------------------------------------------------------- |
| `useTimelineScroll.ts`    | ~70   | Scroll sync (store↔DOM), auto-follow playhead, `handleScroll`                       |
| `useTimelineZoom.ts`      | ~45   | Ctrl+wheel zoom with cursor-stable pivot                                            |
| `useTrimDrag.ts`          | ~90   | `previewTrims` state, `handleTrimStartDrag/EndDrag/DragEnd`, persistence debounce   |
| `useCuePointDrag.ts`      | ~100  | `previewCuePoints` state, drag/dragEnd handlers, trim-type sync, persistence        |
| `useSelectionEdgeDrag.ts` | ~80   | Selection edge resize, snap-to-beat, `handleTrimToSelection`, `handlePlaySelection` |
| `CrossfadeZones.tsx`      | ~35   | Crossfade overlap zone rendering (extract from render body)                         |

**Expected result:** `TimelineLayout.tsx` drops to ~350 lines (constants, `computeTrackPositions`, JSX orchestration, and `WaveformPlaceholder`).

**Risk:** Low — each hook is self-contained with clear inputs/outputs. No API or store changes needed.

---

### 2. `preload/index.ts` — 727 lines

**Location:** `src/preload/index.ts`
**Problem:** Every IPC namespace is defined inline in a single file. Purely structural — no logic complexity, just breadth.

**Refactoring Strategy: Split into domain modules**

```
src/preload/
├── index.ts              (~40 lines — assemble + exposeInMainWorld)
├── api/
│   ├── app.ts            (~15)  — getAppInfo, getSettings, setSettings
│   ├── project.ts        (~50)  — CRUD + file ops
│   ├── auth.ts           (~30)  — login, logout, getStatus, debug
│   ├── search.ts         (~40)  — start, progressive, onProgress, openUrl, loadMore
│   ├── discography.ts    (~25)  — search, onProgress
│   ├── musicBrainz.ts    (~30)  — classify, albums, details, query
│   ├── torrent.ts        (~40)  — download, history, settings, checkLocal
│   ├── webtorrent.ts     (~80)  — add, pause, resume, remove, onProgress, etc.
│   ├── waveform.ts       (~40)  — generate, batch, rebuild, onProgress
│   ├── bpm.ts            (~35)  — detect, batch, song, onProgress
│   ├── key.ts            (~35)  — detect, batch, song, onProgress
│   ├── audio.ts          (~15)  — readFile, readMetadata
│   ├── mix.ts            (~40)  — addSong, removeSong, updateSong, reorder, sync
│   ├── mixExport.ts      (~30)  — checkFfmpeg, start, cancel, onProgress
│   ├── streamPreview.ts  (~50)  — start, stop, onReady, onFullReady, onBuffering, onError
│   ├── duplicate.ts      (~15)  — check, rescan
│   ├── searchHistory.ts  (~15)  — load, save
│   └── torrentCollection.ts (~20) — load, save, clear
```

Each module exports its slice of the API object. `index.ts` imports and merges them:

```ts
import { appApi } from './api/app'
import { projectApi } from './api/project'
// ...
const api = { ...appApi, auth: authApi, search: searchApi /* ... */ }
contextBridge.exposeInMainWorld('api', api)
export type ElectronAPI = typeof api
```

**Expected result:** `index.ts` drops to ~40 lines. Each module is 15-80 lines.

**Risk:** Low — pure restructuring. `ElectronAPI` type derivation stays the same. No runtime behavior change.

---

### 3. `RuTrackerSearchService.ts` — 547 lines

**Location:** `src/main/services/RuTrackerSearchService.ts`
**Problem:** Three major operations (`search`, `searchProgressive`, `loadMoreResults`) plus browser management and URL opening in one class.

**Refactoring Strategy: Extract browser management + viewing**

| Extract                   | Lines | Description                                                                            |
| ------------------------- | ----- | -------------------------------------------------------------------------------------- |
| `BrowserManager.ts`       | ~100  | `initBrowser()`, `closeBrowser()`, `findChromePath()`, viewing browser pool management |
| Move `openUrlWithSession` | ~80   | Into `BrowserManager` or dedicated `ViewingService`                                    |

**Expected result:** `RuTrackerSearchService.ts` drops to ~370 lines (three search methods + constructor).

**Alternative:** Could also extract `loadMoreResults` into a separate `PaginatedSearchService`, but the shared browser dependency makes this less clean. Start with browser extraction.

**Risk:** Low — `BrowserManager` is injected into `RuTrackerSearchService` via constructor.

---

### 4. `WaveformExtractor.ts` — 535 lines

**Location:** `src/main/services/waveform/WaveformExtractor.ts`
**Problem:** FFmpeg process spawning, PCM extraction, frequency band extraction, peak downsampling, and binary cache I/O all in one class.

**Refactoring Strategy: Extract cache layer**

| Extract            | Lines | Description                                                                                                                            |
| ------------------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `WaveformCache.ts` | ~170  | `readCache`, `readBinaryCache`, `writeCache`, constants (`PEAKS_MAGIC/VERSION/HEADER_SIZE`), `getCacheBasePath`, `invalidateAllCaches` |

**Expected result:** `WaveformExtractor.ts` drops to ~365 lines (extraction logic + `generate` + `generateBatch`).

**Alternative:** Could also extract `FfmpegRunner` (extractPcm + extractFrequencyBands), but those are private implementation details tightly coupled to the extractor. Cache is the cleaner boundary.

**Risk:** Low — cache is a pure I/O layer with no business logic coupling.

---

### 5. `smartSearchStore.ts` — 524 lines

**Location:** `src/renderer/store/smartSearchStore.ts`
**Problem:** Large Zustand store with 30+ actions, extensive state interface, helper functions, and 40 lines of selector hooks.

**Refactoring Strategy: Extract selectors + persistence helpers**

| Extract                     | Lines | Description                                                                                  |
| --------------------------- | ----- | -------------------------------------------------------------------------------------------- |
| `smartSearchSelectors.ts`   | ~45   | All `useSearchStep`, `useIsSearching`, etc. selector hooks                                   |
| `smartSearchPersistence.ts` | ~60   | `saveSearchHistoryToDisk`, `loadSearchHistoryFromDisk` helpers                               |
| `smartSearchTypes.ts`       | ~50   | `SearchHistoryEntry`, `ActivityLogEntry`, `SearchWorkflowStep`, `SmartSearchState` interface |

**Expected result:** `smartSearchStore.ts` drops to ~370 lines (initial state + store definition).

**Risk:** Very low — pure file splits, no logic changes. Selectors and types are already independent.

---

## Priority 2 — Warning Files (400-500 lines)

### 6. `TorrentTrackListPreview.tsx` — 429 lines

**Location:** `src/renderer/components/features/search/TorrentTrackListPreview.tsx`
**Assessment:** Well-structured with 4 sub-components (`SingleAlbumView`, `CollapsibleAlbumView`, `TrackList`, loading/error states). Close to threshold but already decomposed.

**Refactoring Strategy: Extract `TrackList` to own file**

| Extract            | Lines | Description                                                                        |
| ------------------ | ----- | ---------------------------------------------------------------------------------- |
| `TrackListRow.tsx` | ~100  | The per-track row with preview button, highlight logic, stream preview integration |

**Expected result:** ~330 lines.

**Risk:** Very low.

---

### 7. `ProjectService.ts` — 427 lines

**Location:** `src/main/services/ProjectService.ts`
**Assessment:** Clean service with simple CRUD operations. Each method is short. The size comes from having many methods rather than any one being complex.

**Recommendation: No refactoring needed.** This is a natural service boundary. Splitting would create artificial boundaries (e.g., `ProjectSongService` vs `ProjectMetadataService`) with tight coupling. Monitor for growth but accept current size.

---

### 8. `AudioPlayer.tsx` — 414 lines

**Location:** `src/renderer/components/common/AudioPlayer.tsx`
**Problem:** Audio engine management (HTMLAudioElement lifecycle, events) mixed with UI rendering.

**Refactoring Strategy: Extract audio engine hook**

| Extract             | Lines | Description                                                                                            |
| ------------------- | ----- | ------------------------------------------------------------------------------------------------------ |
| `useAudioEngine.ts` | ~150  | Audio element creation, source loading, event listeners, seek handling, loop region, trim auto-advance |

**Expected result:** `AudioPlayer.tsx` drops to ~265 lines (pure UI: progress bar, controls, volume).

**Risk:** Low — the hook encapsulates all `audioRef` logic.

---

### 9. `useSearchTableState.ts` — 410 lines

**Location:** `src/renderer/components/features/search/hooks/useSearchTableState.ts`
**Assessment:** Complex data transformation hook (filtering, grouping, sorting, pagination). Logic is cohesive — splitting would scatter related computations.

**Recommendation: No refactoring needed.** The hook is a single unit of table state management. Could extract `compareResults` and grouping utils to a `searchTableUtils.ts`, but the savings (~40 lines) don't justify the indirection.

---

## Execution Order

Prioritize by impact (lines saved) and risk:

| Phase | File                                     | Lines Saved | Effort                          |
| ----- | ---------------------------------------- | ----------- | ------------------------------- |
| 1     | `TimelineLayout.tsx` (976→~350)          | ~626        | Medium — 5 hooks + 1 component  |
| 2     | `preload/index.ts` (727→~40)             | ~687        | Low — mechanical split          |
| 3     | `smartSearchStore.ts` (524→~370)         | ~154        | Low — extract types + selectors |
| 4     | `WaveformExtractor.ts` (535→~365)        | ~170        | Low — extract cache layer       |
| 5     | `RuTrackerSearchService.ts` (547→~370)   | ~177        | Low — extract browser mgmt      |
| 6     | `AudioPlayer.tsx` (414→~265)             | ~149        | Low — extract engine hook       |
| 7     | `TorrentTrackListPreview.tsx` (429→~330) | ~99         | Very low — extract component    |

**Skip:** `ProjectService.ts` (427) and `useSearchTableState.ts` (410) — well-structured, splitting adds complexity.

## Post-Refactoring Target

| Metric                  | Before    | After                                   |
| ----------------------- | --------- | --------------------------------------- |
| Critical files (>500)   | 5         | 0                                       |
| Warning files (400-500) | 4         | 2 (ProjectService, useSearchTableState) |
| Largest file            | 976 lines | ~370 lines                              |
| New files created       | —         | ~20                                     |
| Total lines             | 37,334    | ~37,334 (no code deleted, only moved)   |

## Validation

After each phase, verify:

1. `yarn build` passes (renderer + main + preload)
2. `python scripts/count-lines.py --critical` shows no new critical files
3. Manual smoke test of affected feature area
