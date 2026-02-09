# Unit Test Coverage Plan

**Created**: 2026-02-08
**Status**: Implementation ready

## Context

Three main-process services (`WebTorrentService`, `AuthService`, `TorrentDownloadService`) have zero test coverage despite containing significant business logic (queue management, session lifecycle, download history). One Zustand store (`smartSearchStore`) contains a complex state machine with conditional transitions and history limits. This plan adds pragmatic unit tests covering testable business logic while skipping Puppeteer/WebTorrent integration code per project testing guidelines.

**Already covered:** `utils.test.ts` (ProjectOverview), `ConfigService`, `FileSystemService`, `LockService`, `ProjectService`, `TorrentCollectionService`, `SearchHistoryService`, `RuTrackerSearchService`, `DiscographySearchService`, `MusicBrainzService`.

---

## Files to Create (4 test files, ~85 test cases)

### 1. `src/main/services/WebTorrentService.spec.ts` (~30 tests)

**Run:** `yarn test:main`

**What to test:**
- `add()` — creates QueuedTorrent with UUID, 'queued' status, initial zeroed fields; detects duplicates by magnetUri/torrentFilePath; allows re-add if existing has 'error'/'completed' status
- `pause(id)` — only allows 'downloading'/'seeding' → 'paused'; rejects invalid transitions; resets speeds to 0
- `resume(id)` — only allows 'paused'/'error' → 'queued'; clears error field; rejects invalid transitions
- `remove(id)` — removes from queue map; handles non-existent ID
- `getAll()` — returns array from queue Map
- `getSettings()` / `updateSettings()` — default settings; partial merge; persistence via ConfigService
- `getProjectDownloadPath()` / `setProjectDownloadPath()` — per-project path with prefixed ConfigService key

**Mocking:**
- `electron` (app.getPath, BrowserWindow.getAllWindows)
- `electron-store` (reuse ConfigService.spec.ts pattern)
- `fs` (existsSync, readFileSync, writeFileSync, mkdirSync)
- `webtorrent` dynamic import (mock client with noop `add`/`on`/`destroy`)

**Skip:** `startTorrent()`, `ensureClient()`, `startProgressBroadcast()`, `sendToAllWindows()` — require WebTorrent client and Electron IPC

---

### 2. `src/main/services/AuthService.spec.ts` (~22 tests)

**Run:** `yarn test:main`

**What to test:**
- `getAuthStatus()` — returns isLoggedIn:false initially; invalidates when sessionExpiry passed; returns valid state when not expired
- `logout()` — resets authState, clears cookies, clears session file
- `getStoredCredentials()` / `clearStoredCredentials()` — getter/setter behavior
- `getSessionCookies()` — returns empty initially, returns copy not reference
- `isRestoredSession()` — false initially, true after successful restore
- `getDebugInfo()` — returns cookie count
- Session restore via constructor — loads valid session from file; rejects expired session; handles corrupt JSON gracefully; sets isSessionRestored flag
- `cleanup()` — clears interval, closes browser reference

**Mocking:**
- `electron` (app.getPath)
- `fs` (existsSync, readFileSync, writeFileSync, mkdirSync)
- `puppeteer-core` (launch → noop)
- `child_process` (execSync → noop)

**Skip:** `login()`, `validateSession()`, `initBrowser()`, `findChromePath()` — Puppeteer-heavy

---

### 3. `src/main/services/TorrentDownloadService.spec.ts` (~18 tests)

**Run:** `yarn test:main`

**What to test:**
- Constructor — initializes with default settings; merges provided settings; creates torrents folder
- `getSettings()` / `updateSettings()` — returns settings copy; partial merge; creates folder on path change
- `getHistory()` — returns empty initially; loads from project-specific path; deserializes date strings to Date objects
- `clearHistory()` — resets to empty array; writes empty array to disk
- History persistence — loadHistory handles corrupt JSON; saves correctly serialized JSON
- `openInTorrentClient()` — calls shell.openExternal for magnet; falls back to shell.openPath for .torrent file; returns error when neither available

**Mocking:**
- `electron` (shell.openExternal, shell.openPath)
- `fs` (existsSync, mkdirSync, readFileSync, writeFileSync)
- `AuthService` mock object (reuse RuTrackerSearchService.spec.ts pattern)
- `puppeteer-core`, `child_process` (noop)

**Skip:** `downloadTorrent()`, `initBrowser()`, `findChromePath()`, `validateSession()` — Puppeteer-heavy

---

### 4. `src/renderer/store/smartSearchStore.spec.ts` (~15 tests)

**Run:** `yarn test`

**Requires config change:** Add store test pattern to `jest.config.ts` testMatch.

**What to test:**
- `startSearch()` — sets step to 'classifying', isLoading true, preserves history/activityLog/project context
- `setClassificationResults()` — sets 'user-choice' when results exist; sets 'error' with message when empty
- `selectClassification()` — routes to 'selecting-album' for song type; routes to 'selecting-action' for non-song; sets isLoading for song type
- `selectAction()` — routes to 'searching-rutracker' for discography; routes to 'searching-rutracker' when classification is album + action is album; routes to 'selecting-album' for song action
- `addToHistory()` — prepends entry; limits to 50 entries; generates id and timestamp
- `removeFromHistory()` — removes by id; preserves other entries
- `setDiscographyScanResults()` — tracks scanned torrent IDs in Set; sets isScannningDiscography to false
- `reset()` — resets to initial but preserves searchHistory and activityLog

**Mocking:**
- `window.api.searchHistory.save` and `.load` (noop / return empty)
- Access store via `useSmartSearchStore.getState()` and call actions directly (no React rendering needed)

---

## Jest Config Change

Before writing store tests, update `jest.config.ts`:

```typescript
testMatch: [
  '<rootDir>/src/main/services/**/*.{test,spec}.{ts,tsx}',
  '<rootDir>/src/renderer/**/utils.{test,spec}.{ts,tsx}',
  '<rootDir>/src/renderer/store/**/*.{test,spec}.{ts,tsx}',  // NEW
],
```

Also add to `collectCoverageFrom`:
```typescript
'src/renderer/store/**/*.{ts,tsx}',
'!src/renderer/store/**/*.{test,spec}.{ts,tsx}',
```

---

## Execution Order

1. `WebTorrentService.spec.ts` (highest business value — queue is core feature)
2. `AuthService.spec.ts` (session management is critical path)
3. `TorrentDownloadService.spec.ts` (download history, settings)
4. `jest.config.ts` update (enable store test matching)
5. `smartSearchStore.spec.ts` (state machine logic)

---

## Verification

After each file:
- `yarn test:main` — all main process tests pass (files 1-3)
- `yarn test` — all renderer tests pass (file 4)
- `yarn test:all` — full suite green at the end

---

## Out of Scope

Per [testing.md](testing.md) pragmatic approach:
- **UI components/pages** — no tests (ProjectLauncher, ProjectOverview, Settings)
- **Simple stores** — no tests (useThemeStore, useSearchStore, useSettingsStore, useProjectStore, torrentActivityStore)
- **downloadQueueStore** — mostly IPC wrappers, low business logic value
- **Puppeteer integration** — skip browser automation methods in all services
- **WebTorrent integration** — skip actual torrent client methods
