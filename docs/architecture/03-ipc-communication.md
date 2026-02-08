# IPC Communication Design

This document describes the Inter-Process Communication (IPC) design between main and renderer processes.

## 3. IPC Communication Design

### IPC Channels

| Channel Name | Direction | Purpose | Data |
|--------------|-----------|---------|------|
| **App Lifecycle** |  |  |  |
| `app:ready` | R→M | Signal app is ready | `void` → `void` |
| `app:quit` | R→M | Quit application | `void` → `void` |
| **Authentication** |  |  |  |
| `auth:login` | R→M | Login to RuTracker | `LoginCredentials` → `LoginResult` |
| `auth:logout` | R→M | Logout from RuTracker | `void` → `{success: boolean, error?: string}` |
| `auth:status` | R→M | Check authentication status | `void` → `{success: boolean, data?: AuthState}` |
| `auth:debug` | R→M | Get debug info for auth | `void` → `DebugInfo` |
| **Search** |  |  |  |
| `search:start` | R→M | Start RuTracker search | `SearchRequest` → `SearchResponse` |
| `search:stop` | R→M | Stop ongoing search | `void` → `void` |
| `search:progress` | M→R | Search progress update | `SearchProgress` |
| `search:results` | M→R | Partial results update | `{results: SearchResult[]}` |
| `search:error` | M→R | Search error notification | `{error: string}` |
| `search:open-url` | R→M | Open URL in browser | `{url: string}` → `void` |
| **Project Management** |  |  |  |
| `project:create` | R→M | Create new project | `{name: string, description?: string}` → `Project` |
| `project:load` | R→M | Load existing project | `{projectId: string}` → `Project` |
| `project:save` | R→M | Save current project | `{project: Project}` → `boolean` |
| `project:close` | R→M | Close current project | `void` → `void` |
| `project:list` | R→M | Get all projects | `void` → `ProjectInfo[]` |
| `project:delete` | R→M | Delete a project | `{projectId: string}` → `boolean` |
| **Torrent Operations** |  |  |  |
| `torrent:download` | R→M | Download torrent file | `TorrentDownloadRequest` → `TorrentDownloadResponse` |
| `torrent:get-history` | R→M | Get download history | `void` → `TorrentFile[]` |
| `torrent:clear-history` | R→M | Clear download history | `void` → `{success: boolean}` |
| `torrent:get-settings` | R→M | Get torrent settings | `void` → `TorrentSettings` |
| `torrent:update-settings` | R→M | Update torrent settings | `Partial<TorrentSettings>` → `TorrentSettings` |
| `torrent:progress` | M→R | Torrent progress update | `TorrentDownloadProgress` |
| **Torrent Collection** |  |  |  |
| `torrent:collection:load` | R→M | Load project torrent collection | `LoadTorrentCollectionRequest` → `TorrentCollectionResponse` |
| `torrent:collection:save` | R→M | Save project torrent collection | `SaveTorrentCollectionRequest` → `{success: boolean}` |
| `torrent:collection:clear` | R→M | Clear project torrent collection | `{projectDirectory: string}` → `{success: boolean}` |
| **WebTorrent Download Queue** |  |  |  |
| `webtorrent:add` | R→M | Add torrent to download queue | `AddTorrentRequest` → `AddTorrentResponse` |
| `webtorrent:pause` | R→M | Pause a queued torrent | `{id: string}` → `{success: boolean, error?: string}` |
| `webtorrent:resume` | R→M | Resume a paused torrent | `{id: string}` → `{success: boolean, error?: string}` |
| `webtorrent:remove` | R→M | Remove torrent from queue | `{id: string}` → `{success: boolean, error?: string}` |
| `webtorrent:get-all` | R→M | Get all queued torrents | `void` → `ApiResponse<QueuedTorrent[]>` |
| `webtorrent:get-settings` | R→M | Get WebTorrent settings | `void` → `ApiResponse<WebTorrentSettings>` |
| `webtorrent:update-settings` | R→M | Update WebTorrent settings | `Partial<WebTorrentSettings>` → `ApiResponse<WebTorrentSettings>` |
| `webtorrent:progress` | M→R | Real-time progress broadcast (1s interval) | `QueuedTorrentProgress[]` |
| `webtorrent:status-change` | M→R | Torrent status change notification | `QueuedTorrent` |
| **MusicBrainz** |  |  |  |
| `musicbrainz:find-albums` | R→M | Find albums by song | `{songTitle: string, artist?: string}` → `MusicBrainzAlbum[]` |
| `musicbrainz:get-album` | R→M | Get album details | `{albumId: string}` → `MusicBrainzAlbum` |
| `musicbrainz:create-query` | R→M | Create RuTracker query | `{albumId: string}` → `string` |
| `musicbrainz:classify-search` | R→M | Classify search term | `{query: string}` → `SearchClassificationResult[]` |
| `musicbrainz:get-artist-albums` | R→M | Get artist's albums | `{artistId: string, limit?: number}` → `MusicBrainzAlbum[]` |
| **Search History** |  |  |  |
| `searchHistory:load` | R→M | Load project search history | `{projectId: string, projectDirectory: string}` → `SearchHistoryResponse` |
| `searchHistory:save` | R→M | Save project search history | `SaveSearchHistoryRequest` → `{success: boolean}` |
| **Settings** |  |  |  |
| `settings:get` | R→M | Get user settings | `void` → `Settings` |
| `settings:set` | R→M | Update settings | `Partial<Settings>` → `Settings` |
| **File Operations** |  |  |  |
| `file:select-directory` | R→M | Open directory picker | `void` → `string \| null` |

### Communication Patterns
- **Request-Response**: File operations, settings management, window control (use `ipcMain.handle` / `ipcRenderer.invoke`)
- **One-Way Messages**: Analytics, logging (use `ipcMain.on` / `ipcRenderer.send`)
- **Push Updates**: Settings changes, data updates from main (use `webContents.send` / `ipcRenderer.on`)

### Validation Strategy
- Validate all IPC messages in main process handlers
- Use Zod schema validation library for runtime type checking
- Type-check with TypeScript at compile time
- Sanitize file paths to prevent directory traversal
- Rate-limit expensive operations
- Validate and sanitize all search queries before execution
