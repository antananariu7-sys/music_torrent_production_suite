# IPC Communication Design

This document describes the Inter-Process Communication (IPC) design between main and renderer processes.

## 3. IPC Communication Design

### IPC Channels

All channel name constants are defined in `src/shared/constants.ts` under `IPC_CHANNELS`. The renderer-side API is exposed via `contextBridge.exposeInMainWorld('api', api)` in `src/preload/index.ts`.

**Direction key:**

- **R->M** = Renderer invokes Main (`ipcRenderer.invoke` / `ipcMain.handle`) -- request-response
- **M->R** = Main pushes to Renderer (`webContents.send` / `ipcRenderer.on`) -- push event
- Channels marked **[not implemented]** are defined in `IPC_CHANNELS` but have no handler or preload binding yet

| Channel Name                       | Direction | Preload API                                              | Purpose                                           | Signature                                                                        |
| ---------------------------------- | --------- | -------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------- |
| **App Lifecycle**                  |           |                                                          |                                                   |                                                                                  |
| `app:ready`                        | R->M      | `api.getAppInfo()`                                       | Get app info on startup                           | `void` -> `AppInfo`                                                              |
| `app:quit`                         | --        | --                                                       | Quit application                                  | **[not implemented]**                                                            |
| **Settings**                       |           |                                                          |                                                   |                                                                                  |
| `settings:get`                     | R->M      | `api.getSettings()`                                      | Get user settings                                 | `void` -> `AppSettings`                                                          |
| `settings:set`                     | R->M      | `api.setSettings(settings)`                              | Update user settings                              | `Partial<AppSettings>` -> `AppSettings`                                          |
| **Project Management**             |           |                                                          |                                                   |                                                                                  |
| `project:create`                   | R->M      | `api.createProject(request)`                             | Create new project                                | `CreateProjectRequest` -> `ApiResponse<Project>`                                 |
| `project:load`                     | R->M      | `api.openProject(request)`                               | Load existing project                             | `OpenProjectRequest` (has `filePath`) -> `ApiResponse<Project>`                  |
| `project:save`                     | --        | --                                                       | Save current project                              | **[not implemented]**                                                            |
| `project:close`                    | R->M      | `api.closeProject(projectId)`                            | Close current project                             | `string` -> `ApiResponse<void>`                                                  |
| `project:list`                     | R->M      | `api.getRecentProjects()`                                | Get all recent projects                           | `void` -> `ApiResponse<RecentProject[]>`                                         |
| `project:delete`                   | R->M      | `api.deleteProject(projectId)`                           | Delete a project (metadata only)                  | `string` -> `ApiResponse<void>`                                                  |
| `project:delete-from-disk`         | R->M      | `api.deleteProjectFromDisk(projectId, projectDirectory)` | Delete project and its files from disk            | `(string, string)` -> `ApiResponse<void>`                                        |
| **File Operations**                |           |                                                          |                                                   |                                                                                  |
| `file:select-directory`            | R->M      | `api.selectDirectory(title?)`                            | Open native directory picker                      | `string?` -> `string \| null`                                                    |
| `file:open-path`                   | R->M      | `api.openPath(filePath)`                                 | Open path in OS file manager                      | `string` -> `{ success: boolean; error?: string }`                               |
| **Authentication**                 |           |                                                          |                                                   |                                                                                  |
| `auth:login`                       | R->M      | `api.auth.login(credentials)`                            | Login to RuTracker                                | `LoginCredentials` -> `LoginResult`                                              |
| `auth:logout`                      | R->M      | `api.auth.logout()`                                      | Logout from RuTracker                             | `void` -> `void`                                                                 |
| `auth:status`                      | R->M      | `api.auth.getStatus()`                                   | Check authentication status                       | `void` -> `ApiResponse<AuthState>`                                               |
| `auth:debug`                       | R->M      | `api.auth.getDebugInfo()`                                | Get auth debug info (cookies etc.)                | `void` -> `ApiResponse<{ cookies: ...; cookieCount: number }>`                   |
| **Search**                         |           |                                                          |                                                   |                                                                                  |
| `search:start`                     | R->M      | `api.search.start(request)`                              | Start RuTracker search (single-page)              | `SearchRequest` -> `SearchResponse`                                              |
| `search:start-progressive`         | R->M      | `api.search.startProgressive(request)`                   | Start progressive multi-page search               | `ProgressiveSearchRequest` -> `SearchResponse`                                   |
| `search:stop`                      | --        | --                                                       | Stop ongoing search                               | **[not implemented]**                                                            |
| `search:progress`                  | M->R      | `api.search.onProgress(callback)`                        | Search progress push event                        | `SearchProgressEvent` (returns cleanup fn)                                       |
| `search:results`                   | --        | --                                                       | Partial results update                            | **[not implemented]**                                                            |
| `search:error`                     | --        | --                                                       | Search error notification                         | **[not implemented]**                                                            |
| `search:open-url`                  | R->M      | `api.search.openUrl(url)`                                | Open URL in external browser                      | `string` -> `{ success: boolean; error?: string }`                               |
| **Discography Search**             |           |                                                          |                                                   |                                                                                  |
| `discography:search`               | R->M      | `api.discography.search(request)`                        | Search full discography for artist                | `DiscographySearchRequest` -> `DiscographySearchResponse`                        |
| `discography:search-progress`      | M->R      | `api.discography.onProgress(callback)`                   | Discography search progress push event            | `DiscographySearchProgress` (returns cleanup fn)                                 |
| **MusicBrainz**                    |           |                                                          |                                                   |                                                                                  |
| `musicbrainz:classify-search`      | R->M      | `api.musicBrainz.classifySearch(request)`                | Classify search term (artist/album/song)          | `SearchClassificationRequest` -> `SearchClassificationResponse`                  |
| `musicbrainz:find-albums`          | R->M      | `api.musicBrainz.findAlbumsBySong(request)`              | Find albums containing a song                     | `AlbumSearchRequest` -> `AlbumSearchResponse`                                    |
| `musicbrainz:get-album`            | R->M      | `api.musicBrainz.getAlbumDetails(albumId)`               | Get album details by ID                           | `string` -> `ApiResponse<MusicBrainzAlbum \| null>`                              |
| `musicbrainz:get-artist-albums`    | R->M      | `api.musicBrainz.getArtistAlbums(request)`               | Get all albums for an artist                      | `ArtistAlbumsRequest` -> `ArtistAlbumsResponse`                                  |
| `musicbrainz:create-query`         | R->M      | `api.musicBrainz.createRuTrackerQuery(albumId)`          | Generate RuTracker search query from album        | `string` -> `ApiResponse<string>`                                                |
| **Torrent Operations**             |           |                                                          |                                                   |                                                                                  |
| `torrent:download`                 | R->M      | `api.torrent.download(request)`                          | Download .torrent file from RuTracker             | `TorrentDownloadRequest` -> `TorrentDownloadResponse`                            |
| `torrent:get-history`              | R->M      | `api.torrent.getHistory(projectDirectory?)`              | Get download history                              | `string?` -> `ApiResponse<TorrentFile[]>`                                        |
| `torrent:clear-history`            | R->M      | `api.torrent.clearHistory(projectDirectory?)`            | Clear download history                            | `string?` -> `ApiResponse<void>`                                                 |
| `torrent:get-settings`             | R->M      | `api.torrent.getSettings()`                              | Get torrent download settings                     | `void` -> `ApiResponse<TorrentSettings>`                                         |
| `torrent:update-settings`          | R->M      | `api.torrent.updateSettings(settings)`                   | Update torrent download settings                  | `TorrentSettings` -> `ApiResponse<TorrentSettings>`                              |
| `torrent:progress`                 | M->R      | --                                                       | Torrent download progress push event              | `TorrentDownloadProgress`                                                        |
| `torrent:check-local-file`         | R->M      | `api.torrent.checkLocalFile(request)`                    | Check if torrent file exists locally              | `CheckLocalTorrentRequest` -> `CheckLocalTorrentResponse`                        |
| **Torrent Metadata**               |           |                                                          |                                                   |                                                                                  |
| `torrent:parse-metadata`           | R->M      | `api.torrentMetadata.parse(request)`                     | Parse torrent page metadata (tracks, etc.)        | `TorrentMetadataRequest` -> `TorrentMetadataResponse`                            |
| **Torrent Collection**             |           |                                                          |                                                   |                                                                                  |
| `torrent:collection:load`          | R->M      | `api.torrentCollection.load(request)`                    | Load project torrent collection                   | `LoadTorrentCollectionRequest` -> `TorrentCollectionResponse`                    |
| `torrent:collection:save`          | R->M      | `api.torrentCollection.save(request)`                    | Save project torrent collection                   | `SaveTorrentCollectionRequest` -> `TorrentCollectionResponse`                    |
| `torrent:collection:clear`         | R->M      | `api.torrentCollection.clear(projectDirectory)`          | Clear project torrent collection                  | `string` -> `TorrentCollectionResponse`                                          |
| **Search History**                 |           |                                                          |                                                   |                                                                                  |
| `searchHistory:load`               | R->M      | `api.searchHistory.load(request)`                        | Load project search history                       | `LoadSearchHistoryRequest & { projectDirectory }` -> `SearchHistoryResponse`     |
| `searchHistory:save`               | R->M      | `api.searchHistory.save(request)`                        | Save project search history                       | `SaveSearchHistoryRequest & { projectDirectory }` -> `SearchHistoryResponse`     |
| **WebTorrent Download Queue**      |           |                                                          |                                                   |                                                                                  |
| `webtorrent:add`                   | R->M      | `api.webtorrent.add(request)`                            | Add torrent to download queue                     | `AddTorrentRequest` -> `AddTorrentResponse`                                      |
| `webtorrent:pause`                 | R->M      | `api.webtorrent.pause(id)`                               | Pause a queued torrent                            | `string` -> `{ success: boolean; error?: string }`                               |
| `webtorrent:resume`                | R->M      | `api.webtorrent.resume(id)`                              | Resume a paused torrent                           | `string` -> `{ success: boolean; error?: string }`                               |
| `webtorrent:remove`                | R->M      | `api.webtorrent.remove(id)`                              | Remove torrent from queue                         | `string` -> `{ success: boolean; error?: string }`                               |
| `webtorrent:get-all`               | R->M      | `api.webtorrent.getAll()`                                | Get all queued torrents                           | `void` -> `ApiResponse<QueuedTorrent[]>`                                         |
| `webtorrent:get-settings`          | R->M      | `api.webtorrent.getSettings()`                           | Get WebTorrent engine settings                    | `void` -> `ApiResponse<WebTorrentSettings>`                                      |
| `webtorrent:update-settings`       | R->M      | `api.webtorrent.updateSettings(settings)`                | Update WebTorrent engine settings                 | `Partial<WebTorrentSettings>` -> `ApiResponse<WebTorrentSettings>`               |
| `webtorrent:select-files`          | R->M      | `api.webtorrent.selectFiles(request)`                    | Select which files to download                    | `SelectTorrentFilesRequest` -> `SelectTorrentFilesResponse`                      |
| `webtorrent:get-download-path`     | R->M      | `api.webtorrent.getDownloadPath(projectId)`              | Get per-project download path                     | `string` -> `ApiResponse<string>`                                                |
| `webtorrent:set-download-path`     | R->M      | `api.webtorrent.setDownloadPath(projectId, path)`        | Set per-project download path                     | `(string, string)` -> `{ success: boolean }`                                     |
| `webtorrent:progress`              | M->R      | `api.webtorrent.onProgress(callback)`                    | Real-time progress broadcast (~1s interval)       | `QueuedTorrentProgress[]` (returns cleanup fn)                                   |
| `webtorrent:status-change`         | M->R      | `api.webtorrent.onStatusChange(callback)`                | Torrent status change notification                | `QueuedTorrent` (returns cleanup fn)                                             |
| `webtorrent:file-selection-needed` | M->R      | `api.webtorrent.onFileSelectionNeeded(callback)`         | Prompt user to select files for a torrent         | `{ id: string; name: string; files: TorrentContentFile[] }` (returns cleanup fn) |
| **Audio Playback**                 |           |                                                          |                                                   |                                                                                  |
| `audio:read-file`                  | R->M      | `api.audio.readFile(filePath)`                           | Read audio file as base64 data URL                | `string` -> `{ success: boolean; dataUrl?: string; error?: string }`             |
| **Stream Preview**                 |           |                                                          |                                                   |                                                                                  |
| `stream-preview:start`             | R->M      | `api.streamPreview.start(request)`                       | Start streaming a torrent track for preview       | `StreamPreviewStartRequest` -> `{ success: boolean }`                            |
| `stream-preview:stop`              | R->M      | `api.streamPreview.stop()`                               | Stop current stream preview                       | `void` -> `{ success: boolean }`                                                 |
| `stream-preview:ready`             | M->R      | `api.streamPreview.onReady(callback)`                    | Audio data buffered and ready to play             | `StreamPreviewReadyEvent` (returns cleanup fn)                                   |
| `stream-preview:buffering`         | M->R      | `api.streamPreview.onBuffering(callback)`                | Buffering progress update                         | `StreamPreviewBufferingEvent` (returns cleanup fn)                               |
| `stream-preview:error`             | M->R      | `api.streamPreview.onError(callback)`                    | Preview error (timeout, unsupported format, etc.) | `StreamPreviewErrorEvent` (returns cleanup fn)                                   |

> **Note on `searchHistory:load` / `searchHistory:save`:** These channels use raw string literals (not `IPC_CHANNELS` constants) in the preload. They are not defined in `constants.ts`.

### Communication Patterns

#### 1. Request-Response (R->M)

Used for: project CRUD, settings, auth, search initiation, torrent downloads, file operations.

- **Main process:** `ipcMain.handle(channel, handler)` -- handler returns a value (or Promise)
- **Preload:** `ipcRenderer.invoke(channel, ...args)` -- returns a Promise

```typescript
// Handler (main process)
ipcMain.handle(
  IPC_CHANNELS.PROJECT_CREATE,
  async (_event, request: CreateProjectRequest) => {
    return await projectService.createProject(request)
  }
)

// Preload bridge
createProject: (request: CreateProjectRequest): Promise<ApiResponse<Project>> =>
  ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CREATE, request)

// Renderer usage
const result = await window.api.createProject({
  name: 'My Project',
  directory: '/path',
})
```

#### 2. Push Events (M->R)

Used for: search progress, discography search progress, WebTorrent download progress, torrent status changes, file selection prompts.

- **Main process:** `event.sender.send(channel, data)` from inside a handler, or `BrowserWindow.getAllWindows().forEach(win => win.webContents.send(channel, data))` for broadcast
- **Preload:** Wraps `ipcRenderer.on` and returns a cleanup function to remove the listener

```typescript
// Handler pushes progress during a long-running operation (main process)
ipcMain.handle(
  IPC_CHANNELS.SEARCH_START_PROGRESSIVE,
  async (event, request) => {
    // Periodically push progress to the renderer
    event.sender.send(IPC_CHANNELS.SEARCH_PROGRESS, {
      page: 1,
      totalPages: 5,
      resultsCount: 50,
    })
    // ...eventually return final result
    return finalSearchResponse
  }
)

// Preload wraps the listener with a cleanup function
onProgress: (
  callback: (progress: SearchProgressEvent) => void
): (() => void) => {
  const handler = (
    _event: Electron.IpcRendererEvent,
    progress: SearchProgressEvent
  ) => {
    callback(progress)
  }
  ipcRenderer.on(IPC_CHANNELS.SEARCH_PROGRESS, handler)
  return () => {
    ipcRenderer.removeListener(IPC_CHANNELS.SEARCH_PROGRESS, handler)
  }
}

// Renderer usage -- mount at App level for cross-page access
useEffect(() => {
  const cleanup = window.api.search.onProgress((progress) => {
    setSearchProgress(progress)
  })
  return cleanup
}, [])
```

#### 3. Broadcast to All Windows

Used by the WebTorrent progress interval to push updates to every open window:

```typescript
// Main process -- broadcast progress to all windows
BrowserWindow.getAllWindows().forEach((win) => {
  win.webContents.send(IPC_CHANNELS.WEBTORRENT_PROGRESS, progressUpdates)
})
```

### Preload API Namespace Structure

The preload exposes a single `window.api` object organized into namespaces:

```typescript
window.api.getAppInfo() // App lifecycle
window.api.getSettings() / setSettings() // Settings
window.api.createProject() // Project management (flat)
window.api.openProject()
window.api.closeProject()
window.api.getRecentProjects()
window.api.deleteProject()
window.api.deleteProjectFromDisk()
window.api.selectDirectory() // File operations (flat)
window.api.openPath()
window.api.auth.login() // Auth namespace
window.api.auth.logout()
window.api.auth.getStatus()
window.api.auth.getDebugInfo()
window.api.search.start() // Search namespace
window.api.search.startProgressive()
window.api.search.onProgress()
window.api.search.openUrl()
window.api.discography.search() // Discography namespace
window.api.discography.onProgress()
window.api.musicBrainz.classifySearch() // MusicBrainz namespace
window.api.musicBrainz.findAlbumsBySong()
window.api.musicBrainz.getAlbumDetails()
window.api.musicBrainz.getArtistAlbums()
window.api.musicBrainz.createRuTrackerQuery()
window.api.torrent.download() // Torrent namespace
window.api.torrent.getHistory()
window.api.torrent.clearHistory()
window.api.torrent.getSettings()
window.api.torrent.updateSettings()
window.api.torrent.checkLocalFile()
window.api.torrentMetadata.parse() // Torrent metadata namespace
window.api.torrentCollection.load() // Torrent collection namespace
window.api.torrentCollection.save()
window.api.torrentCollection.clear()
window.api.searchHistory.load() // Search history namespace
window.api.searchHistory.save()
window.api.webtorrent.add() // WebTorrent namespace
window.api.webtorrent.pause()
window.api.webtorrent.resume()
window.api.webtorrent.remove()
window.api.webtorrent.getAll()
window.api.webtorrent.getSettings()
window.api.webtorrent.updateSettings()
window.api.webtorrent.selectFiles()
window.api.webtorrent.getDownloadPath()
window.api.webtorrent.setDownloadPath()
window.api.webtorrent.onProgress()
window.api.webtorrent.onStatusChange()
window.api.webtorrent.onFileSelectionNeeded()
window.api.audio.readFile() // Audio namespace
window.api.streamPreview.start() // Stream preview namespace
window.api.streamPreview.stop()
window.api.streamPreview.onReady()
window.api.streamPreview.onBuffering()
window.api.streamPreview.onError()
```

### IPC Handler Registration

All handlers are registered in `src/main/ipc/index.ts`, which calls registration functions from the individual handler files:

| Handler File                              | Channels Covered                                                                                                                                                                             |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/main/ipc/appHandlers.ts`             | `app:ready`, `settings:get`, `settings:set`, `file:select-directory`, `file:open-path`                                                                                                       |
| `src/main/ipc/authHandlers.ts`            | `auth:login`, `auth:logout`, `auth:status`, `auth:debug`                                                                                                                                     |
| `src/main/ipc/searchHandlers.ts`          | `search:start`, `search:start-progressive`, `search:open-url`, `discography:search`                                                                                                          |
| `src/main/ipc/projectHandlers.ts`         | `project:create`, `project:load`, `project:close`, `project:list`, `project:delete`, `project:delete-from-disk`                                                                              |
| `src/main/ipc/torrentHandlers.ts`         | `torrent:download`, `torrent:get-history`, `torrent:clear-history`, `torrent:get-settings`, `torrent:update-settings`, `torrent:check-local-file`, `torrent:collection:*`, `searchHistory:*` |
| `src/main/ipc/torrentMetadataHandlers.ts` | `torrent:parse-metadata`                                                                                                                                                                     |
| `src/main/ipc/webtorrentHandlers.ts`      | `webtorrent:*`                                                                                                                                                                               |
| `src/main/ipc/musicBrainzHandlers.ts`     | `musicbrainz:*`                                                                                                                                                                              |
| `src/main/ipc/audioHandlers.ts`           | `audio:read-file`                                                                                                                                                                            |
| `src/main/ipc/streamPreviewHandlers.ts`   | `stream-preview:start`, `stream-preview:stop`, `stream-preview:ready`, `stream-preview:buffering`, `stream-preview:error`                                                                    |

### Validation Strategy

- Validate all IPC messages in main process handlers
- Use Zod schema validation library for runtime type checking
- Type-check with TypeScript at compile time
- Sanitize file paths to prevent directory traversal
- Rate-limit expensive operations
- Validate and sanitize all search queries before execution
- Constants defined in `src/shared/constants.ts`, Zod validation on IPC boundaries
