# IPC Communication Design

This document describes the Inter-Process Communication (IPC) design between main and renderer processes.

## 3. IPC Communication Design

### IPC Channels

| Channel Name | Direction | Purpose | Data |
|--------------|-----------|---------|------|
| `app:get-version` | R→M | Get application version | `void` → `string` |
| `auth:login` | R→M | Login to database website | `{username: string, password: string, remember: boolean}` → `LoginResult` |
| `auth:logout` | R→M | Logout from database | `void` → `void` |
| `auth:check-status` | R→M | Check if logged in | `void` → `{isLoggedIn: boolean, username?: string}` |
| `auth:get-stored` | R→M | Get stored credentials | `void` → `{username?: string}` |
| `search:start` | R→M | Start batch search | `{queries: string[], options?: SearchOptions}` → `{jobId: string}` |
| `search:cancel` | R→M | Cancel ongoing search | `{jobId: string}` → `void` |
| `search:get-results` | R→M | Get search results | `{jobId: string}` → `SearchResult[]` |
| `search:export` | R→M | Export results to file | `{jobId: string, format: 'json'\|'csv'}` → `string` |
| `search:progress` | M→R | Search progress update | `{jobId: string, current: number, total: number, status: string}` |
| `search:log` | M→R | Real-time log message | `{jobId: string, level: 'info'\|'warn'\|'error', message: string, timestamp: Date}` |
| `search:complete` | M→R | Search job completed | `{jobId: string, results: SearchResult[]}` |
| `search:error` | M→R | Search error occurred | `{jobId: string, error: string, canRetry: boolean}` |
| `search:error-choice` | R→M | User's error handling choice | `{jobId: string, action: 'retry'\|'skip'\|'abort'}` → `void` |
| `file:import-queries` | R→M | Import queries from file | `void` → `string[]` |
| `file:export-results` | R→M | Show export dialog | `{results: SearchResult[]}` → `string` |
| **Project Management** |  |  |  |
| `project:create` | R→M | Create new project | `{name: string}` → `Project` |
| `project:load` | R→M | Load existing project | `{projectId: string}` → `Project` |
| `project:save` | R→M | Save current project | `{project: Project}` → `boolean` |
| `project:close` | R→M | Close current project | `void` → `void` |
| `project:list` | R→M | Get all projects | `void` → `ProjectInfo[]` |
| `project:delete` | R→M | Delete a project | `{projectId: string}` → `boolean` |
| `project:export` | R→M | Export project to file | `{projectId: string}` → `string` |
| `project:import` | R→M | Import project from file | `void` → `Project` |
| **Torrent Management** |  |  |  |
| `torrent:add` | R→M | Add torrent to queue | `{magnetUri: string, options?: TorrentOptions}` → `TorrentDownload` |
| `torrent:add-from-search` | R→M | Add torrent from search result | `{searchResultId: string}` → `TorrentDownload` |
| `torrent:pause` | R→M | Pause torrent download | `{torrentId: string}` → `void` |
| `torrent:resume` | R→M | Resume torrent download | `{torrentId: string}` → `void` |
| `torrent:remove` | R→M | Remove torrent | `{torrentId: string, deleteFiles: boolean}` → `void` |
| `torrent:get-info` | R→M | Get torrent info | `{torrentId: string}` → `TorrentInfo` |
| `torrent:list` | R→M | Get all torrents | `void` → `TorrentDownload[]` |
| `torrent:progress` | M→R | Torrent progress update | `{torrentId: string, progress: number, downloadSpeed: number, uploadSpeed: number}` |
| `torrent:complete` | M→R | Torrent download complete | `{torrentId: string, files: AudioFile[]}` |
| `torrent:error` | M→R | Torrent error occurred | `{torrentId: string, error: string}` |
| **Settings** |  |  |  |
| `settings:get` | R→M | Get user settings | `void` → `Settings` |
| `settings:update` | R→M | Update settings | `Partial<Settings>` → `Settings` |
| `settings:changed` | M→R | Notify settings changed | `Settings` |
| **Window Control** |  |  |  |
| `window:minimize` | R→M | Minimize window | `void` → `void` |
| `window:maximize` | R→M | Maximize window | `void` → `void` |
| `window:close` | R→M | Close window | `void` → `void` |

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
