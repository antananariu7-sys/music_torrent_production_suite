# Playwright with Electron - Reference Guide

## Table of Contents

1. [Setup and Configuration](#setup-and-configuration)
2. [Launching Electron Apps](#launching-electron-apps)
3. [Working with Windows](#working-with-windows)
4. [IPC Communication](#ipc-communication)
5. [File Dialogs](#file-dialogs)
6. [Main Process Testing](#main-process-testing)
7. [Common Patterns](#common-patterns)
8. [Debugging](#debugging)

## Setup and Configuration

### Installation

```bash
npm install --save-dev @playwright/test
npm install --save-dev playwright
```

### Basic Playwright Config for Electron

See `assets/playwright.config.ts` for a complete configuration template.

Key differences from web testing:
- Use `_electron` API instead of browser contexts
- Configure for single project (Electron) rather than multiple browsers
- Adjust viewport to match typical desktop app sizes
- Enable video/screenshot on failure for debugging

## Launching Electron Apps

### Basic Launch

```typescript
import { _electron as electron } from '@playwright/test';

const electronApp = await electron.launch({
  args: ['path/to/main.js'],
});

const window = await electronApp.firstWindow();
```

### Launch with Custom Electron Binary

```typescript
const electronApp = await electron.launch({
  executablePath: require('electron'),
  args: ['path/to/main.js'],
});
```

### Launch with Environment Variables

```typescript
const electronApp = await electron.launch({
  args: ['path/to/main.js'],
  env: {
    ...process.env,
    NODE_ENV: 'test',
    DEBUG: 'true',
  },
});
```

### Wait for App to be Ready

```typescript
const window = await electronApp.firstWindow();
await window.waitForLoadState('domcontentloaded');
// or
await window.waitForLoadState('networkidle');
```

## Working with Windows

### Access Main Window

```typescript
const window = await electronApp.firstWindow();
```

### Multiple Windows

```typescript
// Wait for new window to open
const [newWindow] = await Promise.all([
  electronApp.waitForEvent('window'),
  window.click('button#open-settings'),
]);

// Work with new window
await newWindow.waitForLoadState();
await newWindow.locator('input[name="setting"]').fill('value');

// Get all windows
const allWindows = electronApp.windows();
console.log(`Open windows: ${allWindows.length}`);
```

### Close Windows

```typescript
// Close specific window
await window.close();

// Close entire app
await electronApp.close();
```

## IPC Communication

### Evaluate in Main Process

```typescript
// Get app version
const version = await electronApp.evaluate(async ({ app }) => {
  return app.getVersion();
});

// Get app path
const appPath = await electronApp.evaluate(async ({ app }) => {
  return app.getAppPath();
});
```

### Send IPC Events

```typescript
// Evaluate main process code
const result = await electronApp.evaluate(
  ({ ipcMain }, customArg) => {
    return new Promise((resolve) => {
      ipcMain.once('response-channel', (event, data) => {
        resolve(data);
      });
      // Trigger something that causes IPC response
    });
  },
  'customArg'
);
```

### Listen for IPC Events

```typescript
const result = await electronApp.evaluate(
  ({ ipcMain }, channel) => {
    return new Promise((resolve) => {
      ipcMain.once(channel, (event, ...args) => {
        resolve(args);
      });
    });
  },
  'my-channel'
);
```

## File Dialogs

### Handle Open File Dialog

```typescript
const [fileChooser] = await Promise.all([
  window.waitForEvent('filechooser'),
  window.click('button#open-file'),
]);

await fileChooser.setFiles('/path/to/file.txt');
```

### Handle Multiple File Selection

```typescript
const [fileChooser] = await Promise.all([
  window.waitForEvent('filechooser'),
  window.click('button#open-files'),
]);

await fileChooser.setFiles([
  '/path/to/file1.txt',
  '/path/to/file2.txt',
]);
```

### Handle Save Dialog

```typescript
const [fileChooser] = await Promise.all([
  window.waitForEvent('filechooser'),
  window.click('button#save-file'),
]);

await fileChooser.setFiles('/path/to/save/location.txt');
```

### Cancel File Dialog

```typescript
const [fileChooser] = await Promise.all([
  window.waitForEvent('filechooser'),
  window.click('button#open-file'),
]);

await fileChooser.cancel();
```

## Main Process Testing

### Access Electron APIs

```typescript
// Check if running in development mode
const isDev = await electronApp.evaluate(({ app }) => {
  return !app.isPackaged;
});

// Get user data path
const userDataPath = await electronApp.evaluate(({ app }) => {
  return app.getPath('userData');
});

// Quit app
await electronApp.evaluate(({ app }) => {
  app.quit();
});
```

### Test Menu Items

```typescript
// Get menu structure
const menuItems = await electronApp.evaluate(({ Menu }) => {
  const menu = Menu.getApplicationMenu();
  return menu ? menu.items.map((item) => item.label) : [];
});

// Trigger menu action
await electronApp.evaluate(({ Menu }) => {
  const menu = Menu.getApplicationMenu();
  const fileMenu = menu?.items.find((item) => item.label === 'File');
  const openItem = fileMenu?.submenu?.items.find(
    (item) => item.label === 'Open'
  );
  openItem?.click();
});
```

## Common Patterns

### Custom Fixtures for Electron

See `assets/utils/fixtures.ts` for a complete example of custom fixtures that:
- Automatically launch the Electron app before each test
- Provide the main window to tests
- Automatically close the app after tests

Usage:
```typescript
import { test, expect } from './utils/fixtures';

test('my test', async ({ window, electronApp }) => {
  // window and electronApp are automatically provided
});
```

### Wait for App Initialization

```typescript
// Wait for specific element that indicates app is ready
await window.waitForSelector('[data-testid="app-ready"]');

// Or wait for specific IPC event
await electronApp.evaluate(({ ipcMain }) => {
  return new Promise((resolve) => {
    ipcMain.once('app-ready', () => resolve(true));
  });
});
```

### Handle Native Dialogs

```typescript
// Handle confirmation dialogs
window.on('dialog', (dialog) => {
  console.log(dialog.message());
  dialog.accept(); // or dialog.dismiss()
});
```

### Screenshot and Video

```typescript
// Take screenshot
await window.screenshot({ path: 'screenshot.png' });

// Full page screenshot
await window.screenshot({ path: 'screenshot.png', fullPage: true });

// Video is configured in playwright.config.ts
// Videos are automatically recorded on failure when configured
```

## Debugging

### Enable Playwright Inspector

```bash
PWDEBUG=1 npm test
```

### Slow Down Execution

```typescript
const electronApp = await electron.launch({
  args: ['path/to/main.js'],
  slowMo: 1000, // Slow down by 1 second
});
```

### Enable Electron DevTools

The Electron window automatically has DevTools available. You can interact with it during test development.

### Console Logs

```typescript
// Listen to console messages from renderer
window.on('console', (msg) => {
  console.log('Browser console:', msg.text());
});

// Listen to page errors
window.on('pageerror', (error) => {
  console.error('Page error:', error.message);
});
```

### Debug Mode

```typescript
const electronApp = await electron.launch({
  args: ['path/to/main.js'],
  env: {
    ...process.env,
    NODE_ENV: 'test',
    DEBUG: '*', // Enable all debug logs
  },
});
```

### Headed Mode

By default, Electron runs in headed mode during tests. To see the UI:

```bash
npm test # Will show the Electron window
```

### Wait for Debugging

```typescript
// Pause test execution for manual debugging
await window.pause();
```
