# RuTracker-Specific Implementation Guide

This document provides specific implementation details for RuTracker integration.

## 20. RuTracker-Specific Implementation Guide

### Login Flow Implementation

```typescript
// main/services/scraper.service.ts
async login(username: string, password: string): Promise<LoginResult> {
  const page = await this.browser.newPage()

  try {
    // Navigate to RuTracker login page
    await page.goto('https://rutracker.org/forum/login.php')

    // Fill login form (selectors may need adjustment)
    await page.type('#login-form-username', username)
    await page.type('#login-form-password', password)

    // Submit form
    await page.click('#login-form-submit')

    // Wait for navigation and verify login
    await page.waitForNavigation()

    // Check if login successful (look for user menu or specific element)
    const isLoggedIn = await page.$('#logged-in-username') !== null

    if (isLoggedIn) {
      // Save session cookies
      const cookies = await page.cookies()
      await this.saveCookies(cookies)

      return { success: true, username }
    } else {
      return { success: false, error: 'Invalid credentials' }
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
```

### Search Execution Implementation

```typescript
// main/services/search.service.ts
async executeSearch(query: string, options: SearchOptions): Promise<PageMatch[]> {
  const page = await this.getBrowserPage()
  const results: PageMatch[] = []

  try {
    // Navigate to search page
    await page.goto('https://rutracker.org/forum/tracker.php')

    // Enter search query
    await page.type('#search-text', query)
    await page.click('#search-submit')

    // Wait for results
    await page.waitForSelector('.torrent-list')

    // Handle pagination
    let currentPage = 1
    const maxPages = options.maxPages || 5

    while (currentPage <= maxPages) {
      // Extract results from current page
      const pageResults = await this.extractResultsFromPage(page)
      results.push(...pageResults)

      // Check if there's a next page
      const nextButton = await page.$('.pagination .next')
      if (!nextButton || currentPage >= maxPages) break

      // Go to next page
      await nextButton.click()
      await page.waitForSelector('.torrent-list')
      currentPage++

      // Send progress update
      this.sendProgressUpdate(query, currentPage, maxPages)
    }

    return results
  } catch (error) {
    this.logger.error(`Search failed for "${query}":`, error)
    throw error
  }
}

async extractResultsFromPage(page: Page): Promise<PageMatch[]> {
  return await page.$$eval('.torrent-item', (elements) => {
    return elements.map(el => ({
      title: el.querySelector('.torrent-title')?.textContent || '',
      url: el.querySelector('.torrent-link')?.getAttribute('href') || '',
      torrentUrl: el.querySelector('.download-link')?.getAttribute('href') || '',
      size: el.querySelector('.torrent-size')?.textContent || '',
      seeders: parseInt(el.querySelector('.seeders')?.textContent || '0'),
      leechers: parseInt(el.querySelector('.leechers')?.textContent || '0'),
      uploadDate: el.querySelector('.upload-date')?.textContent || ''
    }))
  })
}
```

### Error Handling with User Choice

```typescript
// main/ipc/search-handlers.ts
ipcMain.handle('search:start', async (event, { queries, options }) => {
  const jobId = uuidv4()

  for (const query of queries) {
    let retryCount = 0
    let success = false

    while (!success && retryCount < 3) {
      try {
        const results = await searchService.executeSearch(query, options)
        event.sender.send('search:log', {
          jobId,
          level: 'info',
          message: `Found ${results.length} results for "${query}"`,
          timestamp: new Date()
        })
        success = true
      } catch (error) {
        // Send error to renderer and wait for user choice
        const choice = await new Promise<string>((resolve) => {
          event.sender.send('search:error', {
            jobId,
            query,
            error: error.message,
            canRetry: retryCount < 2
          })

          // Listen for user's choice
          ipcMain.once(`search:error-choice:${jobId}`, (_, action) => {
            resolve(action)
          })
        })

        if (choice === 'retry') {
          retryCount++
          continue
        } else if (choice === 'skip') {
          break
        } else if (choice === 'abort') {
          throw new Error('User aborted search')
        }
      }
    }
  }
})
```

### Real-Time Logging

```typescript
// renderer/components/features/SearchProgress/ActivityLog.tsx
import { useEffect, useState } from 'react'
import { useSearchStore } from '../../../store/useSearchStore'

interface LogEntry {
  jobId: string
  level: 'info' | 'warn' | 'error'
  message: string
  timestamp: Date
}

export function ActivityLog() {
  const [logs, setLogs] = useState<LogEntry[]>([])

  useEffect(() => {
    // Listen for log messages from main process
    window.api.onSearchLog((entry: LogEntry) => {
      setLogs(prev => [...prev, entry].slice(-100)) // Keep last 100 entries
    })
  }, [])

  return (
    <div className="activity-log">
      <h3>Activity Log</h3>
      <div className="log-entries">
        {logs.map((entry, idx) => (
          <div key={idx} className={`log-entry log-${entry.level}`}>
            <span className="timestamp">
              {entry.timestamp.toLocaleTimeString()}
            </span>
            <span className="level">[{entry.level.toUpperCase()}]</span>
            <span className="message">{entry.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

### CSS Selectors Configuration

**Important**: RuTracker's HTML structure may change. Store selectors in a configuration file for easy updates:

```typescript
// src/shared/constants.ts
export const RUTRACKER_SELECTORS = {
  login: {
    usernameInput: '#login-form-username',
    passwordInput: '#login-form-password',
    submitButton: '#login-form-submit',
    loggedInIndicator: '#logged-in-username'
  },
  search: {
    searchInput: '#search-text',
    submitButton: '#search-submit',
    resultsContainer: '.torrent-list',
    torrentItem: '.torrent-item',
    nextPage: '.pagination .next'
  },
  torrent: {
    title: '.torrent-title',
    link: '.torrent-link',
    downloadLink: '.download-link',
    size: '.torrent-size',
    seeders: '.seeders',
    leechers: '.leechers',
    uploadDate: '.upload-date'
  }
}
```

**Note**: You'll need to inspect RuTracker's actual HTML to determine the correct selectors.

---

## Quick Reference: Key Security Settings

```typescript
// main/window.ts
const mainWindow = new BrowserWindow({
  width: 1200,
  height: 800,
  webPreferences: {
    preload: path.join(__dirname, '../preload/index.js'),
    contextIsolation: true,        // ✅ Required
    nodeIntegration: false,         // ✅ Required
    sandbox: true,                  // ✅ Recommended
    webSecurity: true,              // ✅ Required
    allowRunningInsecureContent: false, // ✅ Required
    enableRemoteModule: false,      // ✅ Required (deprecated anyway)
  }
})
```

## Quick Reference: IPC Pattern

```typescript
// preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings) => ipcRenderer.invoke('settings:update', settings),
  onSettingsChanged: (callback) => {
    ipcRenderer.on('settings:changed', (_, data) => callback(data))
  }
})

// main/ipc/settings-handlers.ts
ipcMain.handle('settings:get', async () => {
  return await settingsService.getSettings()
})

ipcMain.handle('settings:update', async (event, settings) => {
  const updated = await settingsService.updateSettings(settings)
  event.sender.send('settings:changed', updated)
  return updated
})

// renderer/hooks/useSettings.ts
const settings = await window.api.getSettings()
window.api.onSettingsChanged((newSettings) => {
  // Update Zustand store
})
```

---

**Document Version**: 1.0
**Last Updated**: 2026-01-31
**Status**: Initial Architecture Plan
