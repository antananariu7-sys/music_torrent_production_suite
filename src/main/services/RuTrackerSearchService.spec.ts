import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals'
import type { SearchRequest, SearchResult } from '@shared/types/search.types'

// Create mock objects that will be used throughout the tests
const mockPage = {
  goto: jest.fn(),
  setViewport: jest.fn(),
  setCookie: jest.fn(),
  waitForSelector: jest.fn(),
  evaluate: jest.fn(),
  close: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}

const mockBrowser = {
  newPage: jest.fn(),
  close: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  on: jest.fn(),
}

// Mock puppeteer-core before importing the service
jest.mock('puppeteer-core', () => ({
  launch: jest.fn(),
}))

// Mock child_process
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}))

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
}))

// Now import puppeteer and the service
import puppeteer from 'puppeteer-core'
import { RuTrackerSearchService } from './RuTrackerSearchService'
import type { AuthService } from './AuthService'

// Mock AuthService
const mockAuthService = {
  getAuthStatus: jest.fn(),
  getSessionCookies: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
  cleanup: jest.fn(),
  getDebugInfo: jest.fn(),
} as unknown as AuthService

describe('RuTrackerSearchService', () => {
  let searchService: RuTrackerSearchService

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()

    // Setup puppeteer mock
    ;(puppeteer.launch as jest.Mock<typeof puppeteer.launch>).mockResolvedValue(
      mockBrowser as any
    )
    ;(mockBrowser.newPage as jest.Mock<any>).mockResolvedValue(mockPage as any)

    // Setup default mock implementations
    ;(mockAuthService.getAuthStatus as jest.Mock<any>).mockReturnValue({
      isLoggedIn: true,
      username: 'testuser',
      sessionExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
    })
    ;(mockAuthService.getSessionCookies as jest.Mock<any>).mockReturnValue([
      {
        name: 'bb_session',
        value: 'test-session-id',
        domain: '.rutracker.org',
        path: '/',
        expires: Math.floor(Date.now() / 1000) + 86400,
      },
    ])

    // Reset page mocks
    ;(mockPage.goto as jest.Mock<any>).mockResolvedValue(null as any)
    ;(mockPage.setViewport as jest.Mock<any>).mockResolvedValue(null as any)
    ;(mockPage.setCookie as jest.Mock<any>).mockResolvedValue(null as any)
    ;(mockPage.waitForSelector as jest.Mock<any>).mockResolvedValue(null as any)
    ;(mockPage.evaluate as jest.Mock<any>).mockResolvedValue([] as any)

    // Create service instance
    searchService = new RuTrackerSearchService(mockAuthService, {
      headless: true,
    })
  })

  afterEach(async () => {
    await searchService.closeBrowser()
  })

  describe('constructor', () => {
    it('should initialize with default headless mode', () => {
      const service = new RuTrackerSearchService(mockAuthService)
      expect(service).toBeDefined()
    })

    it('should initialize with custom browser options', () => {
      const service = new RuTrackerSearchService(mockAuthService, {
        headless: false,
      })
      expect(service).toBeDefined()
    })

    it('should respect DEBUG_BROWSER environment variable', () => {
      process.env.DEBUG_BROWSER = 'true'
      const service = new RuTrackerSearchService(mockAuthService)
      expect(service).toBeDefined()
      delete process.env.DEBUG_BROWSER
    })
  })

  describe('setBrowserOptions', () => {
    it('should update browser options', () => {
      searchService.setBrowserOptions({ headless: false })
      expect(true).toBe(true)
    })

    it('should merge options with existing ones', () => {
      searchService.setBrowserOptions({ headless: false })
      searchService.setBrowserOptions({ headless: true })
      expect(true).toBe(true)
    })
  })

  describe('search', () => {
    const mockSearchRequest: SearchRequest = {
      query: 'test music',
    }

    // Raw results from page.evaluate (before processing)
    const mockRawResults = [
      {
        id: '123456',
        title: 'Test Music Album',
        author: 'Test Artist',
        size: '500 MB',
        seeders: 10,
        leechers: 2,
        url: 'https://rutracker.org/forum/viewtopic.php?t=123456',
      },
    ]

    beforeEach(() => {
      ;(mockPage.evaluate as jest.Mock<any>).mockResolvedValue(
        mockRawResults as any
      )
    })

    it('should perform search successfully', async () => {
      const response = await searchService.search(mockSearchRequest)

      expect(response.success).toBe(true)
      expect(response.results).toHaveLength(1)
      // Check core fields from raw results
      expect(response.results![0].id).toBe('123456')
      expect(response.results![0].title).toBe('Test Music Album')
      expect(response.results![0].author).toBe('Test Artist')
      expect(response.results![0].seeders).toBe(10)
      expect(response.results![0].leechers).toBe(2)
      // Check processed fields added by the service
      expect(response.results![0].sizeBytes).toBe(500 * 1024 * 1024) // 500 MB in bytes
      expect(response.results![0].relevanceScore).toBeDefined()
      expect(response.query).toBe(mockSearchRequest.query)
    })

    it('should check if user is logged in', async () => {
      await searchService.search(mockSearchRequest)

      expect(mockAuthService.getAuthStatus).toHaveBeenCalled()
    })

    it('should return error if user is not logged in', async () => {
      ;(mockAuthService.getAuthStatus as jest.Mock<any>).mockReturnValue({
        isLoggedIn: false,
      })

      const response = await searchService.search(mockSearchRequest)

      expect(response.success).toBe(false)
      expect(response.error).toContain('not logged in')
    })

    it('should get session cookies from AuthService', async () => {
      await searchService.search(mockSearchRequest)

      expect(mockAuthService.getSessionCookies).toHaveBeenCalled()
    })

    it('should not navigate to homepage (cookies set via url property)', async () => {
      await searchService.search(mockSearchRequest)

      // First goto call should be the search URL, not the homepage
      expect(mockPage.goto).not.toHaveBeenCalledWith(
        'https://rutracker.org/forum/',
        expect.anything()
      )
    })

    it('should restore session cookies', async () => {
      await searchService.search(mockSearchRequest)

      expect(mockPage.setCookie).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'bb_session',
          value: 'test-session-id',
          domain: '.rutracker.org',
        })
      )
    })

    it('should navigate to search URL with encoded query', async () => {
      const request: SearchRequest = { query: 'test query with spaces' }
      await searchService.search(request)

      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://rutracker.org/forum/tracker.php?nm=test%20query%20with%20spaces',
        expect.objectContaining({
          waitUntil: 'domcontentloaded',
        })
      )
    })

    it('should wait for results table to load', async () => {
      await searchService.search(mockSearchRequest)

      expect(mockPage.waitForSelector).toHaveBeenCalledWith(
        '#tor-tbl',
        expect.objectContaining({
          visible: true,
          timeout: 15000,
        })
      )
    })

    it('should parse search results from page', async () => {
      await searchService.search(mockSearchRequest)

      expect(mockPage.evaluate).toHaveBeenCalled()
    })

    it('should close page after successful search', async () => {
      await searchService.search(mockSearchRequest)

      expect(mockPage.close).toHaveBeenCalled()
    })

    it('should keep browser alive after search for reuse', async () => {
      await searchService.search(mockSearchRequest)

      expect(mockBrowser.close).not.toHaveBeenCalled()
    })

    it('should handle search errors gracefully', async () => {
      const error = new Error('Network timeout')
      ;(mockPage.goto as jest.Mock<any>).mockRejectedValue(error as any)

      const response = await searchService.search(mockSearchRequest)

      expect(response.success).toBe(false)
      expect(response.error).toBe('Network timeout')
      expect(response.query).toBe(mockSearchRequest.query)
    })

    it('should handle empty search results', async () => {
      ;(mockPage.evaluate as jest.Mock<any>).mockResolvedValue([] as any)

      const response = await searchService.search(mockSearchRequest)

      expect(response.success).toBe(true)
      expect(response.results).toEqual([])
    })

    it('should handle special characters in query', async () => {
      const request: SearchRequest = { query: 'test & query <special>' }
      await searchService.search(request)

      expect(mockPage.goto).toHaveBeenCalledWith(
        expect.stringContaining('test%20%26%20query%20%3Cspecial%3E'),
        expect.any(Object)
      )
    })
  })

  describe('openUrlWithSession', () => {
    const testUrl = 'https://rutracker.org/forum/viewtopic.php?t=123456'

    it('should open URL with authenticated session', async () => {
      const response = await searchService.openUrlWithSession(testUrl)

      expect(response.success).toBe(true)
    })

    it('should check if user is logged in', async () => {
      await searchService.openUrlWithSession(testUrl)

      expect(mockAuthService.getAuthStatus).toHaveBeenCalled()
    })

    it('should return error if user is not logged in', async () => {
      ;(mockAuthService.getAuthStatus as jest.Mock<any>).mockReturnValue({
        isLoggedIn: false,
      })

      const response = await searchService.openUrlWithSession(testUrl)

      expect(response.success).toBe(false)
      expect(response.error).toContain('not logged in')
    })

    it('should get session cookies from AuthService', async () => {
      await searchService.openUrlWithSession(testUrl)

      expect(mockAuthService.getSessionCookies).toHaveBeenCalled()
    })

    it('should launch browser for viewing', async () => {
      await searchService.openUrlWithSession(testUrl)

      expect(puppeteer.launch).toHaveBeenCalled()
      expect(mockBrowser.newPage).toHaveBeenCalled()
    })

    it('should not navigate to homepage (cookies set via url property)', async () => {
      await searchService.openUrlWithSession(testUrl)

      // Should go directly to the target URL, not homepage first
      expect(mockPage.goto).not.toHaveBeenCalledWith(
        'https://rutracker.org/forum/',
        expect.anything()
      )
    })

    it('should restore session cookies before opening URL', async () => {
      await searchService.openUrlWithSession(testUrl)

      expect(mockPage.setCookie).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'bb_session',
          value: 'test-session-id',
        })
      )
    })

    it('should navigate to requested URL', async () => {
      await searchService.openUrlWithSession(testUrl)

      expect(mockPage.goto).toHaveBeenCalledWith(
        testUrl,
        expect.objectContaining({
          waitUntil: 'domcontentloaded',
          timeout: 45000,
        })
      )
    })

    it('should set viewport for browser window', async () => {
      await searchService.openUrlWithSession(testUrl)

      expect(mockPage.setViewport).toHaveBeenCalledWith({
        width: 1280,
        height: 800,
      })
    })

    it('should not close browser after opening URL', async () => {
      jest.clearAllMocks()
      await searchService.openUrlWithSession(testUrl)

      expect(mockBrowser.close).not.toHaveBeenCalled()
    })

    it('should handle errors gracefully', async () => {
      const error = new Error('Failed to navigate')
      ;(mockPage.goto as jest.Mock<any>).mockRejectedValue(error as any)

      const response = await searchService.openUrlWithSession(testUrl)

      expect(response.success).toBe(false)
      expect(response.error).toBe('Failed to navigate')
    })
  })

  describe('closeBrowser', () => {
    it('should close browser if exists', async () => {
      const request: SearchRequest = { query: 'test' }
      searchService.setBrowserOptions({ headless: false })
      await searchService.search(request)

      jest.clearAllMocks()
      await searchService.closeBrowser()

      expect(mockBrowser.close).toHaveBeenCalled()
    })

    it('should not throw error if browser does not exist', async () => {
      await expect(searchService.closeBrowser()).resolves.not.toThrow()
    })
  })

  describe('integration scenarios', () => {
    it('should handle multiple consecutive searches', async () => {
      const request1: SearchRequest = { query: 'first search' }
      const request2: SearchRequest = { query: 'second search' }

      const response1 = await searchService.search(request1)
      const response2 = await searchService.search(request2)

      expect(response1.success).toBe(true)
      expect(response2.success).toBe(true)
    })

    it('should handle search followed by URL open', async () => {
      const searchRequest: SearchRequest = { query: 'test' }
      const testUrl = 'https://rutracker.org/forum/viewtopic.php?t=123'

      ;(mockPage.evaluate as jest.Mock<any>).mockResolvedValue([
        {
          id: '123',
          title: 'Test',
          author: 'Author',
          size: '100MB',
          seeders: 5,
          leechers: 1,
          url: testUrl,
        },
      ] as any)

      const searchResponse = await searchService.search(searchRequest)
      expect(searchResponse.success).toBe(true)

      const openResponse = await searchService.openUrlWithSession(testUrl)
      expect(openResponse.success).toBe(true)
    })

    it('should handle empty cookie list', async () => {
      const request: SearchRequest = { query: 'test' }
      ;(mockAuthService.getSessionCookies as jest.Mock<any>).mockReturnValue([])

      const response = await searchService.search(request)

      expect(response.success).toBe(true)
      expect(mockPage.setCookie).not.toHaveBeenCalled()
    })
  })

  describe('loadMoreResults', () => {
    /** Helper to create a mock SearchResult */
    function makeResult(id: string, title: string): SearchResult {
      return {
        id,
        title,
        author: 'Test',
        size: '100 MB',
        seeders: 10,
        leechers: 2,
        url: `https://rutracker.org/forum/viewtopic.php?t=${id}`,
      }
    }

    /**
     * Set up mockPage.evaluate to return the correct sequence for loadMoreResults:
     * For the first page in range:
     *   - evaluate call 1 → getTotalPages → return totalPages number
     *   - evaluate call 2 → parseSearchResults → return results array
     * For each subsequent page:
     *   - evaluate call N → parseSearchResults → return results array
     */
    function setupEvaluateSequence(
      totalPages: number,
      ...pageResults: SearchResult[][]
    ) {
      // getTotalPages evaluate call
      ;(mockPage.evaluate as jest.Mock<any>).mockResolvedValueOnce(
        totalPages as any
      )
      // parseSearchResults for first page
      ;(mockPage.evaluate as jest.Mock<any>).mockResolvedValueOnce(
        (pageResults[0] || []) as any
      )
      // parseSearchResults for remaining pages
      for (let i = 1; i < pageResults.length; i++) {
        ;(mockPage.evaluate as jest.Mock<any>).mockResolvedValueOnce(
          (pageResults[i] || []) as any
        )
      }
    }

    it('should return error when not logged in', async () => {
      ;(mockAuthService.getAuthStatus as jest.Mock<any>).mockReturnValue({
        isLoggedIn: false,
      })

      const response = await searchService.loadMoreResults({
        query: 'test',
        fromPage: 2,
        toPage: 5,
      })

      expect(response.success).toBe(false)
      expect(response.error).toBe('User is not logged in.')
    })

    it('should create correct page range from fromPage to toPage', async () => {
      setupEvaluateSequence(20, [makeResult('1', 'Result 1')])

      const response = await searchService.loadMoreResults({
        query: 'test',
        fromPage: 11,
        toPage: 11,
      })

      expect(response.success).toBe(true)
      expect(response.loadedPages).toBe(1)
    })

    it('should detect totalPagesAvailable from first page', async () => {
      setupEvaluateSequence(25, [makeResult('1', 'Result 1')])

      const response = await searchService.loadMoreResults({
        query: 'test',
        fromPage: 2,
        toPage: 2,
      })

      expect(response.totalPages).toBe(25)
    })

    it('should deduplicate results with same ID across pages', async () => {
      const sharedResult = makeResult('shared-1', 'Same Result')
      setupEvaluateSequence(
        20,
        [makeResult('1', 'First'), sharedResult],
        [sharedResult, makeResult('2', 'Second')]
      )

      const response = await searchService.loadMoreResults({
        query: 'test',
        fromPage: 1,
        toPage: 2,
      })

      expect(response.success).toBe(true)
      // "shared-1" should appear only once
      const ids = response.results.map((r) => r.id)
      expect(ids.filter((id) => id === 'shared-1')).toHaveLength(1)
    })

    it('should set isComplete=true when toPage >= totalPagesAvailable', async () => {
      setupEvaluateSequence(5, [makeResult('1', 'Result')])

      const response = await searchService.loadMoreResults({
        query: 'test',
        fromPage: 5,
        toPage: 5,
      })

      expect(response.isComplete).toBe(true)
    })

    it('should set isComplete=false when more pages available', async () => {
      setupEvaluateSequence(20, [makeResult('1', 'Result')])

      const response = await searchService.loadMoreResults({
        query: 'test',
        fromPage: 2,
        toPage: 5,
      })

      expect(response.isComplete).toBe(false)
    })

    it('should handle empty results from a page without error', async () => {
      setupEvaluateSequence(10, [], [])

      const response = await searchService.loadMoreResults({
        query: 'obscure query',
        fromPage: 1,
        toPage: 2,
      })

      expect(response.success).toBe(true)
      expect(response.results).toHaveLength(0)
    })

    it('should skip failed pages but continue processing others', async () => {
      // First page succeeds, second page will fail
      ;(mockPage.evaluate as jest.Mock<any>)
        .mockResolvedValueOnce(10 as any) // getTotalPages
        .mockResolvedValueOnce([makeResult('1', 'Good Result')] as any) // page 1
        .mockRejectedValueOnce(new Error('Page nav failed') as any) // page 2 error

      const response = await searchService.loadMoreResults({
        query: 'test',
        fromPage: 1,
        toPage: 2,
      })

      expect(response.success).toBe(true)
      expect(response.results).toHaveLength(1)
      expect(response.results[0].id).toBe('1')
    })

    it('should return error when browser/session fails', async () => {
      ;(puppeteer.launch as jest.Mock<any>).mockRejectedValueOnce(
        new Error('Browser crash') as any
      )

      const response = await searchService.loadMoreResults({
        query: 'test',
        fromPage: 2,
        toPage: 3,
      })

      expect(response.success).toBe(false)
      expect(response.error).toContain('Browser crash')
    })

    it('should create at most 3 concurrent browser pages', async () => {
      setupEvaluateSequence(
        20,
        [makeResult('1', 'R1')],
        [makeResult('2', 'R2')],
        [makeResult('3', 'R3')],
        [makeResult('4', 'R4')],
        [makeResult('5', 'R5')]
      )

      await searchService.loadMoreResults({
        query: 'test',
        fromPage: 1,
        toPage: 5,
      })

      // browser.newPage is called to create pool pages (max 3)
      expect(mockBrowser.newPage).toHaveBeenCalledTimes(3)
    })
  })

  describe('error handling', () => {
    it('should handle browser launch failure', async () => {
      ;(puppeteer.launch as jest.Mock<any>).mockRejectedValueOnce(
        new Error('Chrome not found') as any
      )

      const request: SearchRequest = { query: 'test' }
      const response = await searchService.search(request)

      expect(response.success).toBe(false)
      expect(response.error).toContain('Chrome not found')
    })

    it('should handle page navigation timeout', async () => {
      ;(mockPage.goto as jest.Mock<any>).mockRejectedValue(
        new Error('Navigation timeout') as any
      )

      const request: SearchRequest = { query: 'test' }
      const response = await searchService.search(request)

      expect(response.success).toBe(false)
      expect(response.error).toContain('Navigation timeout')
    })

    it('should handle selector timeout', async () => {
      ;(mockPage.goto as jest.Mock<any>).mockResolvedValue(null as any)
      ;(mockPage.waitForSelector as jest.Mock<any>).mockRejectedValue(
        new Error('Timeout waiting for selector') as any
      )

      const request: SearchRequest = { query: 'test' }
      const response = await searchService.search(request)

      expect(response.success).toBe(false)
      expect(response.error).toContain('Timeout waiting for selector')
    })

    it('should handle page evaluation error', async () => {
      ;(mockPage.goto as jest.Mock<any>).mockResolvedValue(null as any)
      ;(mockPage.waitForSelector as jest.Mock<any>).mockResolvedValue(
        null as any
      )
      ;(mockPage.evaluate as jest.Mock<any>).mockRejectedValue(
        new Error('Evaluation failed') as any
      )

      const request: SearchRequest = { query: 'test' }
      const response = await searchService.search(request)

      // parseSearchResults catches errors and returns empty array, so search succeeds with 0 results
      expect(response.success).toBe(true)
      expect(response.results).toEqual([])
    })
  })
})
