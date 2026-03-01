# Architecture Audit & Refactoring Plan

## Context

Codebase: **337 files, 44,375 lines**. Overall architecture is solid — BrowserWindow security config is exemplary (`contextIsolation`, `sandbox: true`, `nodeIntegration: false`), production code is `any`-free, Zod validation is used in newer IPC handlers, and test coverage follows consistent `.spec.ts` conventions.

However, the audit found **5 critical-size files**, **14 warnings**, and **9 suggestions** across security, IPC validation, code duplication, component architecture, and store patterns. This plan addresses them grouped by priority.

---

## P0 — Security & Correctness

### 1. Add Zod validation to `projectHandlers.ts`

**File:** [src/main/ipc/projectHandlers.ts](src/main/ipc/projectHandlers.ts)

All 11 handlers accept TypeScript types without runtime validation. Add Zod schemas matching existing patterns in `waveformHandlers.ts`, `webtorrentHandlers.ts`, etc.

- Create schemas in `src/shared/schemas/project.schemas.ts` for: `CreateProjectRequest`, `OpenProjectRequest`, `AddSongFromFileRequest`, `RemoveSongRequest`, `ReorderSongsRequest`, `UpdateSongRequest`, etc.
- Add `.parse(request)` calls at the top of each handler

### 2. Add Zod validation to `searchHandlers.ts`

**File:** [src/main/ipc/searchHandlers.ts](src/main/ipc/searchHandlers.ts)

`SearchRequest`, `ProgressiveSearchRequest`, `LoadMoreRequest` — all cast without validation.

- Create schemas in `src/shared/schemas/search.schemas.ts`
- Add `.parse()` calls in handlers

### 3. Validate `shell.openPath` input

**File:** [src/main/ipc/appHandlers.ts:37](src/main/ipc/appHandlers.ts#L37)

`filePath` from renderer passed directly to `shell.openPath` with no validation. Add a check that the resolved path is under an allowed directory (project dir, app userData, or download path).

### 4. Validate `shell.openExternal` magnet URIs

**File:** [src/main/services/torrent/TorrentDownloadService.ts:341](src/main/services/torrent/TorrentDownloadService.ts#L341)

Add a check that the URI starts with `magnet:` before passing to `shell.openExternal`.

### 5. Add error handling to `streamPreviewHandlers.ts`

**File:** [src/main/ipc/streamPreviewHandlers.ts](src/main/ipc/streamPreviewHandlers.ts)

Wrap handler in try/catch returning structured `{ success, error }` response, matching all other handlers.

### 6. Validate `audio://` protocol paths

**File:** [src/main/index.ts:41-45](src/main/index.ts#L41-L45)

Add path validation ensuring `filePath` resolves within project audio directories or `userData`.

---

## P1 — Code Quality & DRY

### 7. Move hardcoded IPC channels to constants

**File:** [src/shared/constants.ts](src/shared/constants.ts)

Add `SEARCH_HISTORY_LOAD: 'searchHistory:load'` and `SEARCH_HISTORY_SAVE: 'searchHistory:save'` to `IPC_CHANNELS`. Update references in:

- [src/main/ipc/searchHandlers.ts:130,168](src/main/ipc/searchHandlers.ts#L130)
- [src/preload/api/searchHistory.ts:12,17](src/preload/api/searchHistory.ts#L12)

### 8. Deduplicate Chrome-finding logic

**Files:**

- [src/main/services/BrowserManager.ts:44-80](src/main/services/BrowserManager.ts#L44) — duplicate `findChromePath()`
- [src/main/services/TorrentMetadataService.ts:38-66](src/main/services/TorrentMetadataService.ts#L38) — duplicate `findChromePath()`

Replace with import from existing [src/main/services/utils/browserUtils.ts](src/main/services/utils/browserUtils.ts) (already used by AuthService, DiscographySearchService, TorrentDownloadService).

### 9. Replace `execSync` with async alternative

**Files:** [src/main/services/utils/browserUtils.ts](src/main/services/utils/browserUtils.ts)

After deduplication consolidates all Chrome-finding to `browserUtils.ts`, convert `execSync('where chrome')` to `execFile` (promisified) or `child_process.exec` with async/await. This unblocks the main process event loop during browser init.

### 10. Remove unnecessary dynamic imports

**Files:**

- [src/main/services/ProjectService.ts:139](src/main/services/ProjectService.ts#L139) — `await import('fs-extra')` on every `saveProject` call. Replace with top-level import.
- [src/main/ipc/projectHandlers.ts:260-261](src/main/ipc/projectHandlers.ts#L260) — `await import('fs')` and `await import('fs/promises')` for built-in Node modules. Replace with top-level imports.

### 11. Remove `--disable-web-security` from Puppeteer launch args

**Files:**

- [src/main/services/BrowserManager.ts:99-102](src/main/services/BrowserManager.ts#L99)

Remove `--disable-web-security` and `--disable-features=IsolateOrigins,site-per-process` flags. Keep only `--no-sandbox` and `--disable-setuid-sandbox` which are required for Electron/CI. Verify scraping still works after removal.

---

## P2 — Component & Store Refactoring

### 12. Fix `smartSearchStore.reset()` anti-pattern

**File:** [src/renderer/store/smartSearchStore.ts:240-245](src/renderer/store/smartSearchStore.ts#L240)

Replace `useSmartSearchStore.getState()` inside `set()` with functional form:

```ts
reset: () => set((state) => ({
  ...initialState,
  searchHistory: state.searchHistory,
  activityLog: state.activityLog,
})),
```

### 13. Move side effect out of Zustand `set()` in `addToHistory`

**File:** [src/renderer/store/smartSearchStore.ts:210-218](src/renderer/store/smartSearchStore.ts#L210)

Move `saveSearchHistoryToDisk()` call outside the `set()` callback:

```ts
addToHistory: (entry) => {
  const newHistory = [/* ... */]
  set({ searchHistory: newHistory })
  saveSearchHistoryToDisk(newHistory, ...)  // side effect outside set()
}
```

### 14. Fix async action type mismatch in `streamPreviewStore`

**File:** [src/renderer/store/streamPreviewStore.ts](src/renderer/store/streamPreviewStore.ts)

Change interface declaration from `() => void` to `() => Promise<void>` for `startPreview`.

### 15. Fix typo: `isScannningDiscography` → `isScanningDiscography`

**Files:**

- [src/renderer/store/smartSearchTypes.ts:89](src/renderer/store/smartSearchTypes.ts#L89)
- All references in store, selectors, and consumers (find-and-replace)

### 16. Tighten CSP for production builds

**File:** [src/main/window.ts:17](src/main/window.ts#L17)

Remove `'unsafe-inline'` from `script-src` in production CSP. Keep it only for development (Vite HMR requires it). Use conditional CSP based on `app.isPackaged` or `process.env.NODE_ENV`.

---

## P3 — Large File Decomposition (future)

These files exceed 500 lines and should be split, but are lower priority than the above fixes. Documenting them for future work:

| File                          | Lines | Suggested Split                                                                                               |
| ----------------------------- | ----- | ------------------------------------------------------------------------------------------------------------- |
| `WebAudioEngine.ts`           | 1157  | Extract: `AudioBufferManager`, `PlaybackController`, `CrossfadeEngine`, `EQProcessor`                         |
| `SectionDetector.ts`          | 773   | Extract: `EssentiaAnalyzer`, `SectionBoundaryFinder`, `SectionLabeler`                                        |
| `TransitionDetail.tsx`        | 708   | Extract: `trackSuggestionFeedback` → settings store; `TransitionControls`, `TransitionPreview` sub-components |
| `TransitionWaveformPanel.tsx` | 534   | Extract: `TrimDragHandler`, `CrossfadeOverlay`, `BeatGridLayer`                                               |
| `FilterGraphBuilder.ts`       | 531   | Extract: `CrossfadeFilterNode`, `EQFilterNode`, `FilterChainComposer`                                         |

---

## Verification

1. **Build:** `yarn build` — confirm renderer + main + preload compile cleanly
2. **Tests:** `yarn test:main` — verify no regressions in service/IPC tests
3. **Runtime:** Launch app, verify:
   - Project create/load/save works (Zod validation pass-through)
   - Search works (channel constants updated)
   - Scraping works (Puppeteer flags reduced)
   - Audio preview works (protocol path validation)
   - `shell.openPath` works for valid project paths
4. **Code size:** `python scripts/count-lines.py --critical` — confirm no new critical files introduced
