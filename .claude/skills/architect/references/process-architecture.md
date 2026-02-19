# Process Architecture Patterns

## Process Model Overview

### Main Process (Node.js environment)
**Responsibilities**:
- Application lifecycle management
- Window creation and management
- Native OS interactions (menus, dialogs, notifications)
- Business logic and data processing
- File system and database access
- System tray and auto-updater
- IPC message handling

**Access**:
- Full Node.js APIs
- Full Electron main process APIs
- Native modules
- File system access

### Renderer Process (Chromium environment)
**Responsibilities**:
- UI rendering (HTML, CSS, JavaScript)
- User interactions and events
- UI state management
- Communicating with main process via IPC

**Access**:
- Web APIs (DOM, fetch, localStorage, etc.)
- Limited APIs exposed through preload script
- **NO direct access** to Node.js or Electron APIs (when configured securely)

### Preload Scripts (Bridge environment)
**Responsibilities**:
- Expose safe, specific APIs to renderer
- Transform/validate data between processes
- Create abstraction layer for IPC communication

**Access**:
- Node.js APIs (but isolated from renderer)
- Electron renderer process APIs
- Can expose selected APIs via contextBridge

## Secure IPC Patterns

### Pattern 1: Request-Response (Async)

**Use case**: Renderer requests data/action from main process

**Main Process (main/ipc-handlers.ts)**:
```typescript
import { ipcMain } from 'electron';

// Register handler
ipcMain.handle('user:get', async (event, userId: string) => {
  // Validate input
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid user ID');
  }

  // Perform operation
  const user = await database.getUser(userId);
  return user;
});
```

**Preload Script (preload/index.ts)**:
```typescript
import { contextBridge, ipcRenderer } from 'electron';

// Expose safe API
contextBridge.exposeInMainWorld('api', {
  getUser: (userId: string) => ipcRenderer.invoke('user:get', userId)
});
```

**Renderer (renderer/app.tsx)**:
```typescript
// Use exposed API
const user = await window.api.getUser('123');
```

### Pattern 2: One-Way Message

**Use case**: Renderer notifies main process (no response needed)

**Main Process**:
```typescript
ipcMain.on('analytics:track', (event, eventName: string, data: unknown) => {
  // Validate
  if (!eventName || typeof eventName !== 'string') return;

  // Process
  analytics.track(eventName, data);
});
```

**Preload**:
```typescript
contextBridge.exposeInMainWorld('api', {
  trackEvent: (eventName: string, data: unknown) =>
    ipcRenderer.send('analytics:track', eventName, data)
});
```

**Renderer**:
```typescript
window.api.trackEvent('button-clicked', { buttonId: 'save' });
```

### Pattern 3: Main to Renderer (Push Updates)

**Use case**: Main process sends updates to renderer

**Main Process**:
```typescript
import { BrowserWindow } from 'electron';

function notifyRenderer(window: BrowserWindow, data: unknown) {
  window.webContents.send('data:updated', data);
}
```

**Preload**:
```typescript
contextBridge.exposeInMainWorld('api', {
  onDataUpdated: (callback: (data: unknown) => void) => {
    ipcRenderer.on('data:updated', (event, data) => callback(data));
  }
});
```

**Renderer**:
```typescript
window.api.onDataUpdated((data) => {
  console.log('Data updated:', data);
});
```

### Pattern 4: Bidirectional Stream

**Use case**: Ongoing communication (e.g., file upload progress)

**Main Process**:
```typescript
ipcMain.handle('file:upload', async (event, filePath: string) => {
  const stream = createUploadStream(filePath);

  stream.on('progress', (percent) => {
    event.sender.send('file:upload:progress', percent);
  });

  return await stream.finish();
});
```

**Preload**:
```typescript
contextBridge.exposeInMainWorld('api', {
  uploadFile: (filePath: string, onProgress: (percent: number) => void) => {
    ipcRenderer.on('file:upload:progress', (event, percent) => onProgress(percent));
    return ipcRenderer.invoke('file:upload', filePath);
  }
});
```

## IPC Channel Naming Convention

Use structured channel names for clarity:

```
<domain>:<action>[:<event>]
```

**Examples**:
- `user:get` - Get user data
- `user:create` - Create user
- `user:update` - Update user
- `file:upload` - Upload file
- `file:upload:progress` - Upload progress event
- `window:minimize` - Minimize window
- `analytics:track` - Track analytics event

## Context Isolation Setup

**BrowserWindow Configuration (main/window.ts)**:
```typescript
import { BrowserWindow } from 'electron';

const mainWindow = new BrowserWindow({
  width: 1200,
  height: 800,
  webPreferences: {
    // REQUIRED: Enable context isolation
    contextIsolation: true,

    // REQUIRED: Disable node integration in renderer
    nodeIntegration: false,

    // REQUIRED: Specify preload script
    preload: path.join(__dirname, 'preload.js'),

    // RECOMMENDED: Disable remote module
    enableRemoteModule: false,

    // RECOMMENDED: Enable web security
    webSecurity: true,

    // RECOMMENDED: Sandbox renderer process (if compatible)
    sandbox: true
  }
});
```

## Preload Script Best Practices

### DO:
- Use `contextBridge.exposeInMainWorld` to expose APIs
- Validate all inputs before sending to main process
- Create type-safe interfaces
- Keep exposed API minimal (principle of least privilege)
- Document all exposed APIs

### DON'T:
- Expose entire `ipcRenderer` or Node.js modules
- Pass functions from renderer to main (not serializable)
- Trust data from renderer without validation
- Create overly generic APIs

## Multi-Window Architecture

### Pattern: Shared State Management

**Main Process State Manager (main/state-manager.ts)**:
```typescript
class StateManager {
  private windows = new Map<number, BrowserWindow>();
  private state = { /* shared state */ };

  register(window: BrowserWindow) {
    this.windows.set(window.id, window);
  }

  updateState(newState: unknown) {
    this.state = { ...this.state, ...newState };

    // Notify all windows
    this.windows.forEach(window => {
      window.webContents.send('state:updated', this.state);
    });
  }
}
```

### Pattern: Window-Specific Communication

**Main Process**:
```typescript
ipcMain.handle('data:get', async (event) => {
  // Get window that sent request
  const window = BrowserWindow.fromWebContents(event.sender);

  // Return window-specific data
  return getDataForWindow(window.id);
});
```

## Error Handling in IPC

### Main Process:
```typescript
ipcMain.handle('risky:operation', async (event, data) => {
  try {
    // Validate input
    const validated = validateSchema(data);

    // Perform operation
    const result = await performOperation(validated);

    return { success: true, data: result };
  } catch (error) {
    // Log error securely (don't expose internals)
    logger.error('Operation failed', { error });

    // Return safe error message
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});
```

### Renderer:
```typescript
const result = await window.api.performRiskyOperation(data);

if (result.success) {
  // Handle success
  console.log(result.data);
} else {
  // Handle error
  showErrorMessage(result.error);
}
```
