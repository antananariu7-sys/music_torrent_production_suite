# Electron + React Best Practices

This document outlines best practices for developing Electron applications with React, based on security guidelines and modern patterns.

## Security Best Practices

### Context Isolation & Node Integration

```typescript
// main/window.ts
const mainWindow = new BrowserWindow({
  webPreferences: {
    preload: path.join(__dirname, '../preload/index.js'),
    contextIsolation: true,        // REQUIRED
    nodeIntegration: false,         // REQUIRED
    sandbox: true,                  // RECOMMENDED
    webSecurity: true,              // REQUIRED
    allowRunningInsecureContent: false,
    enableRemoteModule: false,
  }
})
```

**Rules:**
- NEVER enable `nodeIntegration` in renderer
- ALWAYS use `contextIsolation: true`
- ALWAYS use preload scripts for IPC exposure
- ALWAYS enable `sandbox: true` when possible

### Credential Storage

```typescript
// Use electron's safeStorage for credentials
import { safeStorage } from 'electron'

class CredentialService {
  async saveCredentials(username: string, password: string) {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(password)
      // Store encrypted buffer
      await store.set('credentials', {
        username,
        password: encrypted.toString('base64')
      })
    }
  }

  async getCredentials(): Promise<{ username: string; password: string }> {
    const data = await store.get('credentials')
    if (data && safeStorage.isEncryptionAvailable()) {
      const buffer = Buffer.from(data.password, 'base64')
      const decrypted = safeStorage.decryptString(buffer)
      return { username: data.username, password: decrypted }
    }
    throw new Error('Credentials not found')
  }
}
```

## IPC Communication Patterns

### Type-Safe IPC with Zod Validation

```typescript
// shared/schemas/search.schema.ts
import { z } from 'zod'

export const SearchQuerySchema = z.object({
  query: z.string().min(1),
  maxPages: z.number().min(1).max(10).optional(),
  options: z.object({
    includeMetadata: z.boolean().optional()
  }).optional()
})

export type SearchQuery = z.infer<typeof SearchQuerySchema>
```

```typescript
// main/ipc/search-handlers.ts
import { SearchQuerySchema } from '../../shared/schemas/search.schema'

ipcMain.handle('search:execute', async (event, data) => {
  // Validate input
  const validated = SearchQuerySchema.parse(data)

  // Execute search
  const results = await searchService.execute(validated)
  return results
})
```

### Preload Script Pattern

```typescript
// preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'

// Type-safe API
const api = {
  // Request-response pattern
  searchExecute: (query: SearchQuery) =>
    ipcRenderer.invoke('search:execute', query),

  // Event listener pattern
  onSearchProgress: (callback: (progress: SearchProgress) => void) => {
    ipcRenderer.on('search:progress', (_, data) => callback(data))
    return () => ipcRenderer.removeListener('search:progress', callback)
  },

  // One-time event
  onSearchComplete: (callback: (results: SearchResults) => void) => {
    ipcRenderer.once('search:complete', (_, data) => callback(data))
  }
}

contextBridge.exposeInMainWorld('api', api)

// Type definitions for renderer
export type API = typeof api
```

```typescript
// preload/types.ts
import type { API } from './index'

declare global {
  interface Window {
    api: API
  }
}
```

## React Patterns

### Custom Hooks for IPC

```typescript
// renderer/hooks/useSearch.ts
import { useState, useEffect, useCallback } from 'react'
import { useSearchStore } from '../store/useSearchStore'

export function useSearch() {
  const { setProgress, setResults, addLog } = useSearchStore()
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    // Subscribe to progress updates
    const cleanup = window.api.onSearchProgress((progress) => {
      setProgress(progress)
      addLog({
        level: 'info',
        message: `Processing: ${progress.current}/${progress.total}`,
        timestamp: new Date()
      })
    })

    return cleanup
  }, [setProgress, addLog])

  const executeSearch = useCallback(async (query: SearchQuery) => {
    setIsSearching(true)
    try {
      const results = await window.api.searchExecute(query)
      setResults(results)
      return results
    } catch (error) {
      addLog({
        level: 'error',
        message: error.message,
        timestamp: new Date()
      })
      throw error
    } finally {
      setIsSearching(false)
    }
  }, [setResults, addLog])

  return { executeSearch, isSearching }
}
```

### Zustand Store Pattern

```typescript
// renderer/store/useSearchStore.ts
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface SearchState {
  results: SearchResult[]
  progress: SearchProgress | null
  logs: LogEntry[]

  setResults: (results: SearchResult[]) => void
  setProgress: (progress: SearchProgress) => void
  addLog: (log: LogEntry) => void
  clearLogs: () => void
}

export const useSearchStore = create<SearchState>()(
  devtools(
    persist(
      (set) => ({
        results: [],
        progress: null,
        logs: [],

        setResults: (results) => set({ results }),
        setProgress: (progress) => set({ progress }),
        addLog: (log) => set((state) => ({
          logs: [...state.logs, log].slice(-100) // Keep last 100
        })),
        clearLogs: () => set({ logs: [] })
      }),
      {
        name: 'search-store',
        partialize: (state) => ({
          results: state.results
          // Don't persist logs or progress
        })
      }
    ),
    { name: 'SearchStore' }
  )
)
```

## Service Layer Pattern

### Dependency Injection

```typescript
// main/services/search.service.ts
import { ScraperService } from './scraper.service'
import { ResultsService } from './results.service'
import { LoggerService } from './logger.service'

export class SearchService {
  constructor(
    private scraper: ScraperService,
    private results: ResultsService,
    private logger: LoggerService
  ) {}

  async execute(query: SearchQuery): Promise<SearchResults> {
    this.logger.info(`Starting search: ${query.query}`)

    try {
      const pageResults = await this.scraper.search(query)
      const stored = await this.results.save(query.query, pageResults)

      this.logger.info(`Search complete: ${stored.length} results`)
      return stored
    } catch (error) {
      this.logger.error(`Search failed: ${error.message}`)
      throw error
    }
  }
}

// main/services/index.ts
import { SearchService } from './search.service'
import { ScraperService } from './scraper.service'
import { ResultsService } from './results.service'
import { LoggerService } from './logger.service'

// Service container
export const services = {
  logger: new LoggerService(),
  scraper: new ScraperService(),
  results: new ResultsService(),

  get search() {
    return new SearchService(
      this.scraper,
      this.results,
      this.logger
    )
  }
}
```

## Error Handling

### User-Facing Error Dialogs

```typescript
// main/ipc/search-handlers.ts
ipcMain.handle('search:execute', async (event, data) => {
  let retryCount = 0
  const maxRetries = 3

  while (retryCount < maxRetries) {
    try {
      const results = await searchService.execute(data)
      return { success: true, results }
    } catch (error) {
      // Send error to renderer for user decision
      const choice = await new Promise<'retry' | 'skip' | 'abort'>((resolve) => {
        event.sender.send('search:error', {
          query: data.query,
          error: error.message,
          canRetry: retryCount < maxRetries - 1,
          attempt: retryCount + 1,
          maxAttempts: maxRetries
        })

        ipcMain.once('search:error-response', (_, action) => {
          resolve(action)
        })
      })

      if (choice === 'retry') {
        retryCount++
        continue
      } else if (choice === 'skip') {
        return { success: false, skipped: true }
      } else {
        throw new Error('User aborted search')
      }
    }
  }
})
```

## Performance Optimization

### Pagination for Large Datasets

```typescript
// renderer/components/features/SearchResults/ResultsTable.tsx
import { useState, useMemo } from 'react'

const ITEMS_PER_PAGE = 50

export function ResultsTable({ results }: { results: SearchResult[] }) {
  const [page, setPage] = useState(0)

  const paginatedResults = useMemo(() => {
    const start = page * ITEMS_PER_PAGE
    return results.slice(start, start + ITEMS_PER_PAGE)
  }, [results, page])

  return (
    <div>
      <table>
        {paginatedResults.map((result) => (
          <ResultRow key={result.id} result={result} />
        ))}
      </table>
      <Pagination
        page={page}
        totalPages={Math.ceil(results.length / ITEMS_PER_PAGE)}
        onPageChange={setPage}
      />
    </div>
  )
}
```

### Virtual Scrolling for Long Lists

```typescript
import { useVirtualizer } from '@tanstack/react-virtual'

export function VirtualResultsList({ results }: { results: SearchResult[] }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: results.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60, // Estimated row height
    overscan: 10 // Render extra rows for smooth scrolling
  })

  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`
            }}
          >
            <ResultCard result={results[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  )
}
```

## Testing Patterns

### Pragmatic Testing Approach

**⚠️ IMPORTANT**: This project follows a pragmatic testing approach:
- ✅ **Test business logic** in services and utilities
- ❌ **Skip UI tests** for components (unless critical)
- ⚠️ **Test selectively** - only when it provides real value

### Main Process Testing (Business Logic)

**Always test services with business logic:**

```typescript
// src/main/services/search.service.spec.ts
import { describe, it, expect, vi } from 'vitest'
import { SearchService } from './search.service'

describe('SearchService', () => {
  it('should execute search and return results', async () => {
    const mockScraper = {
      search: vi.fn().mockResolvedValue([
        { title: 'Result 1', url: 'http://example.com/1' }
      ])
    }
    const mockResults = {
      save: vi.fn().mockResolvedValue([
        { id: '1', title: 'Result 1', url: 'http://example.com/1' }
      ])
    }
    const mockLogger = {
      info: vi.fn(),
      error: vi.fn()
    }

    const service = new SearchService(mockScraper, mockResults, mockLogger)
    const results = await service.execute({ query: 'test' })

    expect(results).toHaveLength(1)
    expect(mockScraper.search).toHaveBeenCalledWith({ query: 'test' })
    expect(mockLogger.info).toHaveBeenCalled()
  })
})
```

### Renderer Testing (Skip Unless Critical)

**Skip component tests unless they contain critical business logic.**

If you must test a component, refer to the testing guidelines for the pattern.

## Summary

- **Security first**: Always use context isolation, never enable node integration
- **Type-safe IPC**: Use Zod for runtime validation
- **Separation of concerns**: Service layer in main, Zustand stores in renderer
- **Error handling**: Give users control over retries and error recovery
- **Performance**: Use pagination and virtual scrolling for large datasets
- **Testing**: Only test business logic in services; skip UI tests unless critical
