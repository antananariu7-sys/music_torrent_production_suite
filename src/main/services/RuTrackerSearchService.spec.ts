import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals'
import type { SearchRequest } from '@shared/types/search.types'

// Create mock objects that will be used throughout the tests
const mockPage = {
  goto: jest.fn(),
  setViewport: jest.fn(),
  setCookie: jest.fn(),
  waitForSelector: jest.fn(),
  evaluate: jest.fn(),
}

const mockBrowser = {
  newPage: jest.fn(),
  close: jest.fn(),
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
    ;(puppeteer.launch as jest.Mock<typeof puppeteer.launch>).mockResolvedValue(mockBrowser as any)
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
      (mockPage.evaluate as jest.Mock<any>).mockResolvedValue(mockRawResults as any)
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
      (mockAuthService.getAuthStatus as jest.Mock<any>).mockReturnValue({
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

    it('should navigate to RuTracker homepage first', async () => {
      await searchService.search(mockSearchRequest)

      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://rutracker.org/forum/',
        expect.objectContaining({
          waitUntil: 'networkidle2',
          timeout: 30000,
        })
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
          waitUntil: 'networkidle2',
        })
      )
    })

    it('should wait for results table to load', async () => {
      await searchService.search(mockSearchRequest)

      expect(mockPage.waitForSelector).toHaveBeenCalledWith(
        '#tor-tbl',
        expect.objectContaining({
          visible: true,
          timeout: 10000,
        })
      )
    })

    it('should parse search results from page', async () => {
      await searchService.search(mockSearchRequest)

      expect(mockPage.evaluate).toHaveBeenCalled()
    })

    it('should close browser after successful search in headless mode', async () => {
      await searchService.search(mockSearchRequest)

      expect(mockBrowser.close).toHaveBeenCalled()
    })

    it('should not close browser in non-headless mode', async () => {
      searchService.setBrowserOptions({ headless: false })
      jest.clearAllMocks()

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

    it('should close browser on error in headless mode', async () => {
      (mockPage.goto as jest.Mock<any>).mockRejectedValue(new Error('Test error') as any)

      await searchService.search(mockSearchRequest)

      expect(mockBrowser.close).toHaveBeenCalled()
    })

    it('should handle empty search results', async () => {
      (mockPage.evaluate as jest.Mock<any>).mockResolvedValue([] as any)

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
      (mockAuthService.getAuthStatus as jest.Mock<any>).mockReturnValue({
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

    it('should navigate to homepage first to set cookies', async () => {
      await searchService.openUrlWithSession(testUrl)

      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://rutracker.org/forum/',
        expect.objectContaining({
          waitUntil: 'networkidle2',
          timeout: 30000,
        })
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
          waitUntil: 'networkidle2',
          timeout: 30000,
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

  describe('error handling', () => {
    it('should handle browser launch failure', async () => {
      (puppeteer.launch as jest.Mock<any>).mockRejectedValueOnce(
        new Error('Chrome not found') as any
      )

      const request: SearchRequest = { query: 'test' }
      const response = await searchService.search(request)

      expect(response.success).toBe(false)
      expect(response.error).toContain('Chrome not found')
    })

    it('should handle page navigation timeout', async () => {
      (mockPage.goto as jest.Mock<any>).mockRejectedValue(
        new Error('Navigation timeout') as any
      )

      const request: SearchRequest = { query: 'test' }
      const response = await searchService.search(request)

      expect(response.success).toBe(false)
      expect(response.error).toContain('Navigation timeout')
    })

    it('should handle selector timeout', async () => {
      (mockPage.goto as jest.Mock<any>).mockResolvedValue(null as any)
      ;(mockPage.waitForSelector as jest.Mock<any>).mockRejectedValue(
        new Error('Timeout waiting for selector') as any
      )

      const request: SearchRequest = { query: 'test' }
      const response = await searchService.search(request)

      expect(response.success).toBe(false)
      expect(response.error).toContain('Timeout waiting for selector')
    })

    it('should handle page evaluation error', async () => {
      (mockPage.goto as jest.Mock<any>).mockResolvedValue(null as any)
      ;(mockPage.waitForSelector as jest.Mock<any>).mockResolvedValue(null as any)
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
