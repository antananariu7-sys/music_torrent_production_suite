# Pragmatic Testing Guide for Electron Applications

This guide outlines pragmatic testing practices for Electron applications, focusing on business logic only.

## Testing Philosophy

### Core Principle: Test Business Logic Only

**⚠️ IMPORTANT**: This project follows a pragmatic testing approach:
- ✅ **Test business logic** in services, utilities, and core algorithms
- ❌ **Skip UI tests** for components and stores (unless critical)
- ⚠️ **Test selectively** - only when it provides real value

### Testing Focus

```
         /\
        /E2E\        <- Rare (only critical workflows)
       /------\
      /  INT   \     <- Selective (complex IPC only)
     /----------\
    /   LOGIC   \    <- Business logic only
   /--------------\
```

**Unit Tests (Business Logic)**: Services, utilities, complex algorithms
**Integration Tests (Selective)**: Complex IPC handlers only
**E2E Tests (Rare)**: Critical user workflows only

## When to Use TDD

**TDD is optional** and should be used selectively:

### Use TDD For:
- ✅ Complex business logic in services
- ✅ Critical algorithms and calculations
- ✅ Complex data transformations
- ✅ Utilities with edge cases

### Skip TDD For:
- ❌ UI components and pages
- ❌ Simple Zustand stores
- ❌ Basic IPC handlers
- ❌ Presentational components

## TDD Workflow (Optional)

### Red-Green-Refactor Cycle

**Use this only for business logic:**

1. **Red**: Write a failing test for business logic
2. **Green**: Write minimal code to make it pass
3. **Refactor**: Clean up while keeping tests green

## Unit Testing

### Testing Services (Main Process)

#### Example: SearchService TDD

**Step 1: Write the test (Red)**

```typescript
// tests/unit/services/search.service.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SearchService } from '../../../src/main/services/search.service'
import type { SearchQuery } from '../../../src/shared/types/search.types'

describe('SearchService', () => {
  let searchService: SearchService
  let mockScraper: any
  let mockResults: any
  let mockLogger: any

  beforeEach(() => {
    mockScraper = {
      search: vi.fn()
    }
    mockResults = {
      save: vi.fn()
    }
    mockLogger = {
      info: vi.fn(),
      error: vi.fn()
    }

    searchService = new SearchService(mockScraper, mockResults, mockLogger)
  })

  describe('execute', () => {
    it('should search, save results, and return them', async () => {
      // Arrange
      const query: SearchQuery = { query: 'test music', maxPages: 1 }
      const scrapedResults = [
        { title: 'Track 1', url: 'http://example.com/1', torrentUrl: 'magnet:1' }
      ]
      const savedResults = [
        { id: '1', title: 'Track 1', url: 'http://example.com/1', torrentUrl: 'magnet:1' }
      ]

      mockScraper.search.mockResolvedValue(scrapedResults)
      mockResults.save.mockResolvedValue(savedResults)

      // Act
      const results = await searchService.execute(query)

      // Assert
      expect(mockScraper.search).toHaveBeenCalledWith(query)
      expect(mockResults.save).toHaveBeenCalledWith('test music', scrapedResults)
      expect(results).toEqual(savedResults)
      expect(mockLogger.info).toHaveBeenCalledWith('Starting search: test music')
    })

    it('should log and throw error when search fails', async () => {
      // Arrange
      const query: SearchQuery = { query: 'test', maxPages: 1 }
      const error = new Error('Network error')
      mockScraper.search.mockRejectedValue(error)

      // Act & Assert
      await expect(searchService.execute(query)).rejects.toThrow('Network error')
      expect(mockLogger.error).toHaveBeenCalledWith('Search failed: Network error')
    })
  })
})
```

**Step 2: Implement minimal code (Green)**

```typescript
// src/main/services/search.service.ts
import type { ScraperService } from './scraper.service'
import type { ResultsService } from './results.service'
import type { LoggerService } from './logger.service'
import type { SearchQuery, SearchResults } from '../../shared/types/search.types'

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
```

**Step 3: Refactor**

After tests pass, refactor if needed while keeping tests green.

### Testing React Components (Skip Unless Critical)

**⚠️ IMPORTANT**: Skip component tests unless they contain critical business logic.

**Don't test:**
- Simple presentational components
- Components that just display data
- Basic UI interactions
- Layout components

**Only test if:**
- Component has complex business logic
- Component has critical state management
- Failure would cause major issues

If you must test a component, follow the pattern in the testing guidelines document.

## Integration Testing

### Testing IPC Handlers

#### Example: Search Handler TDD

**Step 1: Write integration test (Red)**

```typescript
// tests/integration/ipc/search-handlers.spec.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ipcMain } from 'electron'
import '../../../src/main/ipc/search-handlers'
import { services } from '../../../src/main/services'

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    removeHandler: vi.fn()
  }
}))

describe('Search IPC Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('search:execute', () => {
    it('should validate input and execute search', async () => {
      // Get the registered handler
      const handleCall = (ipcMain.handle as any).mock.calls.find(
        (call) => call[0] === 'search:execute'
      )
      const handler = handleCall[1]

      const mockEvent = { sender: { send: vi.fn() } }
      const query = { query: 'test', maxPages: 2 }

      vi.spyOn(services.search, 'execute').mockResolvedValue([
        { id: '1', title: 'Result 1', url: 'http://ex.com/1', torrentUrl: 'magnet:1' }
      ])

      const result = await handler(mockEvent, query)

      expect(services.search.execute).toHaveBeenCalledWith(query)
      expect(result).toHaveLength(1)
    })

    it('should reject invalid input', async () => {
      const handleCall = (ipcMain.handle as any).mock.calls.find(
        (call) => call[0] === 'search:execute'
      )
      const handler = handleCall[1]

      const mockEvent = { sender: { send: vi.fn() } }
      const invalidQuery = { query: '', maxPages: -1 } // Invalid

      await expect(handler(mockEvent, invalidQuery)).rejects.toThrow()
    })
  })
})
```

**Step 2: Implement handler (Green)**

```typescript
// src/main/ipc/search-handlers.ts
import { ipcMain } from 'electron'
import { services } from '../services'
import { SearchQuerySchema } from '../../shared/schemas/search.schema'

ipcMain.handle('search:execute', async (event, data) => {
  // Validate input
  const validated = SearchQuerySchema.parse(data)

  // Execute search
  const results = await services.search.execute(validated)

  return results
})
```

### Testing Service Integration

```typescript
// tests/integration/services/search-flow.spec.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { SearchService } from '../../../src/main/services/search.service'
import { ScraperService } from '../../../src/main/services/scraper.service'
import { ResultsService } from '../../../src/main/services/results.service'
import { LoggerService } from '../../../src/main/services/logger.service'

describe('Search Flow Integration', () => {
  let searchService: SearchService
  let scraperService: ScraperService
  let resultsService: ResultsService

  beforeEach(() => {
    const logger = new LoggerService()
    scraperService = new ScraperService()
    resultsService = new ResultsService()
    searchService = new SearchService(scraperService, resultsService, logger)
  })

  it('should complete full search flow', async () => {
    // This test uses real services (not mocks) to verify integration
    const query = { query: 'test', maxPages: 1 }

    // Mock browser to avoid real web scraping in tests
    vi.spyOn(scraperService, 'search').mockResolvedValue([
      { title: 'Track 1', url: 'http://ex.com/1', torrentUrl: 'magnet:1' }
    ])

    const results = await searchService.execute(query)

    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('Track 1')

    // Verify results were saved
    const saved = await resultsService.getByQuery('test')
    expect(saved).toHaveLength(1)
  })
})
```

## E2E Testing

### Testing Critical User Flows

```typescript
// tests/e2e/search-flow.spec.ts
import { test, expect, _electron as electron } from '@playwright/test'
import { ElectronApplication, Page } from 'playwright'

test.describe('Search Flow', () => {
  let electronApp: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    electronApp = await electron.launch({ args: ['.'] })
    window = await electronApp.firstWindow()
  })

  test.afterAll(async () => {
    await electronApp.close()
  })

  test('should complete search and display results', async () => {
    // Navigate to search page
    await window.click('[data-testid="nav-search"]')

    // Enter search query
    await window.fill('[data-testid="search-input"]', 'test music')

    // Set max pages
    await window.fill('[data-testid="max-pages"]', '1')

    // Start search
    await window.click('[data-testid="search-button"]')

    // Wait for results
    await window.waitForSelector('[data-testid="results-table"]', { timeout: 10000 })

    // Verify results displayed
    const results = await window.locator('[data-testid="result-row"]')
    expect(await results.count()).toBeGreaterThan(0)
  })

  test('should handle search errors gracefully', async () => {
    // Mock network failure
    await window.evaluate(() => {
      window.api.searchExecute = () => Promise.reject(new Error('Network error'))
    })

    await window.click('[data-testid="search-button"]')

    // Verify error dialog appears
    const errorDialog = await window.locator('[data-testid="error-dialog"]')
    await expect(errorDialog).toBeVisible()

    // Verify error message
    const errorMsg = await window.locator('[data-testid="error-message"]')
    await expect(errorMsg).toContainText('Network error')
  })
})
```

## Test Organization

### Directory Structure

```
tests/
├── unit/                       # Unit tests
│   ├── services/
│   │   ├── search.service.spec.ts
│   │   ├── scraper.service.spec.ts
│   │   └── results.service.spec.ts
│   ├── components/
│   │   ├── ResultsTable.spec.tsx
│   │   ├── SearchForm.spec.tsx
│   │   └── ErrorDialog.spec.tsx
│   └── utils/
│       └── validation.spec.ts
│
├── integration/                # Integration tests
│   ├── ipc/
│   │   ├── search-handlers.spec.ts
│   │   └── project-handlers.spec.ts
│   └── services/
│       └── search-flow.spec.ts
│
└── e2e/                        # E2E tests
    ├── search-flow.spec.ts
    ├── download-flow.spec.ts
    └── project-management.spec.ts
```

## Testing Utilities

### Test Helpers

```typescript
// tests/helpers/fixtures.ts
import type { SearchResult } from '../../src/shared/types/search.types'

export const createMockSearchResult = (overrides?: Partial<SearchResult>): SearchResult => ({
  id: '1',
  title: 'Test Track',
  url: 'http://example.com/1',
  torrentUrl: 'magnet:test',
  size: '100MB',
  seeders: 10,
  leechers: 2,
  uploadDate: '2024-01-01',
  ...overrides
})

export const createMockSearchResults = (count: number): SearchResult[] => {
  return Array.from({ length: count }, (_, i) =>
    createMockSearchResult({
      id: `${i + 1}`,
      title: `Track ${i + 1}`
    })
  )
}
```

### Component Test Setup

```typescript
// tests/helpers/render.tsx
import { render as rtlRender } from '@testing-library/react'
import { ReactElement } from 'react'

// Custom render with providers
export function render(ui: ReactElement) {
  return rtlRender(ui, {
    wrapper: ({ children }) => (
      <TestProviders>
        {children}
      </TestProviders>
    )
  })
}

// Re-export everything
export * from '@testing-library/react'
export { render }
```

## Testing Best Practices

1. **Test business logic only**: Focus on services, utilities, algorithms
2. **Skip UI tests**: Don't test simple components or stores
3. **One test, one concept**: Each test should verify one specific behavior
4. **Arrange-Act-Assert**: Structure tests clearly with AAA pattern
5. **Test behavior, not implementation**: Focus on what, not how
6. **Keep tests independent**: Each test should run in isolation
7. **Use descriptive names**: Test names should describe what they verify
8. **Test edge cases**: Don't just test the happy path
9. **Mock external dependencies**: Isolate the unit under test
10. **Fast feedback**: Tests should run quickly (<1s each)

## Test Coverage Goals

**Don't chase coverage percentages** - focus on testing what matters.

- **Services/Business Logic**: Aim for 70-80% coverage
- **UI Components**: 0-20% coverage (only critical components)
- **Integration tests**: Test complex IPC channels only
- **E2E tests**: Only critical user workflows

## Running Tests

```bash
# Unit tests (fast, run frequently)
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests (slow, run before commits)
npm run test:e2e

# All tests
npm test

# Watch mode for TDD
npm run test:watch

# Coverage report
npm run test:coverage
```

## CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:integration

      - name: E2E Tests
        run: npm run test:e2e
        if: matrix.os == 'ubuntu-latest'

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Summary

- **TDD cycle**: Red → Green → Refactor
- **Test pyramid**: More unit tests, fewer E2E tests
- **Test types**: Unit (services, components), Integration (IPC), E2E (user flows)
- **Best practices**: Write tests first, test behavior not implementation
- **Coverage**: 80%+ unit, 100% IPC, critical paths for E2E
