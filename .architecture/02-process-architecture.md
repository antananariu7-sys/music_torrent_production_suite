# Process Architecture

This document describes the process architecture for the Electron application.

## 2. Process Architecture

### Main Process Responsibilities
**Node.js environment with full system access**
- Application lifecycle management (start, quit, updates)
- Window creation and management
- **Project Management**: Create, load, save, export projects
- **Web Automation Engine**: Puppeteer/Playwright for browser automation
- **Authentication Management**: Login to RuTracker, session management
- **Search Orchestration**: Process search queue, execute searches, handle retries
- **Torrent Engine**: WebTorrent client for downloading and seeding
- **Download Management**: Queue management, progress tracking, file organization
- **File System Operations**: Organize downloaded files, manage storage
- **Credential Storage**: Encrypt and store login credentials securely
- **Results Processing**: Parse search results, cache data
- **Audio Processing**: File verification, metadata extraction (Component 3 preparation)
- Native OS integrations (file system, system dialogs, notifications)
- IPC message handling and validation
- Application menu and tray icon
- Auto-update orchestration

### Renderer Process Responsibilities
**Chromium environment - sandboxed and secure**
- UI rendering with React
- User interaction handling
- Application state management (Zustand)
- Communication with main process via IPC
- Form validation and UI-level logic
- Client-side routing

### Preload Script Strategy
**Secure bridge between main and renderer**
- Expose minimal, specific APIs via `contextBridge.exposeInMainWorld`
- No direct Node.js or Electron API exposure
- Type-safe API definitions for renderer process
- Input validation and sanitization
- Creates `window.api` interface for renderer

### Multi-Window Strategy
- Single main window architecture (initially)
- Support for modal dialogs when needed
- Shared preload script across windows
- State synchronization via IPC events for multi-window scenarios
