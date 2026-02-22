import puppeteer, { Browser, Page } from 'puppeteer-core'
import { execSync } from 'child_process'
import { existsSync } from 'fs'
import type {
  SearchRequest,
  SearchResponse,
  ProgressiveSearchRequest,
  SearchProgressEvent,
} from '@shared/types/search.types'
import type { AuthService } from './AuthService'
import {
  PageScraper,
  type SessionCookie,
} from './rutracker/scrapers/PageScraper'
import { ResultParser } from './rutracker/scrapers/ResultParser'
import { PaginationHandler } from './rutracker/scrapers/PaginationHandler'
import { SearchFiltersApplier } from './rutracker/filters/SearchFilters'
import { calculateRelevanceScores } from './rutracker/utils/relevanceScorer'
import { buildSearchUrl } from './rutracker/utils/urlBuilder'

interface BrowserOptions {
  headless: boolean
}

/**
 * RuTrackerSearchService
 *
 * Handles search operations on RuTracker using Puppeteer.
 * Reuses session from AuthService for authenticated searches.
 */
const MAX_VIEWING_BROWSERS = 3

export class RuTrackerSearchService {
  private browser: Browser | null = null
  private viewingBrowsers: Set<Browser> = new Set()
  private browserOptions: BrowserOptions
  private pageScraper: PageScraper
  private resultParser: ResultParser
  private paginationHandler: PaginationHandler
  private filtersApplier: SearchFiltersApplier

  constructor(
    private authService: AuthService,
    options: Partial<BrowserOptions> = {}
  ) {
    // Use DEBUG_BROWSER env var if no explicit option provided
    const headless = options.headless ?? process.env.DEBUG_BROWSER !== 'true'
    this.browserOptions = {
      headless,
    }

    // Initialize helpers
    this.pageScraper = new PageScraper()
    this.resultParser = new ResultParser()
    this.paginationHandler = new PaginationHandler()
    this.filtersApplier = new SearchFiltersApplier()
  }

  /**
   * Set browser options (e.g., for debugging)
   */
  setBrowserOptions(options: Partial<BrowserOptions>): void {
    this.browserOptions = { ...this.browserOptions, ...options }
  }

  /**
   * Find Chrome/Chromium executable path
   */
  private findChromePath(): string {
    const possiblePaths = [
      // Windows paths
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
      // Linux paths
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      // macOS paths
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ]

    for (const path of possiblePaths) {
      if (existsSync(path)) {
        console.log(`[RuTrackerSearchService] Found Chrome at: ${path}`)
        return path
      }
    }

    // Try to find Chrome using 'where' on Windows
    try {
      const result = execSync('where chrome', { encoding: 'utf-8' })
      const chromePath = result.trim().split('\n')[0]
      if (existsSync(chromePath)) {
        console.log(
          `[RuTrackerSearchService] Found Chrome via 'where': ${chromePath}`
        )
        return chromePath
      }
    } catch (error) {
      // Ignore error
    }

    throw new Error(
      'Chrome/Chromium executable not found. Please install Google Chrome.'
    )
  }

  /**
   * Initialize browser instance
   */
  private async initBrowser(): Promise<Browser> {
    if (this.browser) {
      return this.browser
    }

    const executablePath = this.findChromePath()
    console.log(
      `[RuTrackerSearchService] Launching browser (headless: ${this.browserOptions.headless})`
    )

    this.browser = await puppeteer.launch({
      executablePath,
      headless: this.browserOptions.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    })

    return this.browser
  }

  /**
   * Close search browser and all viewing browser instances
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
    for (const b of this.viewingBrowsers) {
      await b.close().catch(() => {})
    }
    this.viewingBrowsers.clear()
    console.log('[RuTrackerSearchService] All browsers closed')
  }

  /**
   * Get session cookies from AuthService
   */
  private getSessionCookies(): SessionCookie[] {
    return this.authService.getSessionCookies()
  }

  /**
   * Open a RuTracker URL in browser with authenticated session
   * Useful for viewing torrent details while maintaining login
   *
   * @param url - RuTracker URL to open
   * @returns Success status
   */
  async openUrlWithSession(
    url: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if user is logged in
      const authState = this.authService.getAuthStatus()
      if (!authState.isLoggedIn) {
        return {
          success: false,
          error: 'User is not logged in. Please login first.',
        }
      }

      console.log(`[RuTrackerSearchService] Opening URL with session: ${url}`)

      // Get session cookies from AuthService
      const sessionCookies = this.getSessionCookies()
      console.log(
        `[RuTrackerSearchService] Got ${sessionCookies.length} session cookies`
      )

      // Launch a separate browser instance for viewing (not reusing this.browser)
      // This prevents interfering with the search browser instance
      const executablePath = this.findChromePath()
      console.log(
        '[RuTrackerSearchService] Launching separate browser instance for viewing'
      )

      // Close oldest viewing browser if at limit
      if (this.viewingBrowsers.size >= MAX_VIEWING_BROWSERS) {
        const oldest = this.viewingBrowsers.values().next().value!
        await oldest.close().catch(() => {})
        this.viewingBrowsers.delete(oldest)
      }

      const viewingBrowser = await puppeteer.launch({
        executablePath,
        headless: false, // Always visible for viewing
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
        ],
      })

      // Track instance and auto-cleanup when user closes the window
      this.viewingBrowsers.add(viewingBrowser)
      viewingBrowser.on('disconnected', () => {
        this.viewingBrowsers.delete(viewingBrowser)
      })

      const page = await this.pageScraper.createPageWithCookies(
        viewingBrowser,
        sessionCookies
      )

      // Navigate to the requested URL
      await this.pageScraper.navigateToUrl(page, url)

      console.log(
        '[RuTrackerSearchService] URL opened successfully with session'
      )

      return {
        success: true,
      }
    } catch (error) {
      console.error('[RuTrackerSearchService] Failed to open URL:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open URL',
      }
    }
  }

  /**
   * Search RuTracker for torrents
   *
   * @param request - Search request with query and optional category
   * @returns Search response with results or error
   */
  async search(request: SearchRequest): Promise<SearchResponse> {
    let page: Page | null = null

    try {
      // Check if user is logged in
      const authState = this.authService.getAuthStatus()
      if (!authState.isLoggedIn) {
        return {
          success: false,
          error: 'User is not logged in. Please login first.',
        }
      }

      console.log(`[RuTrackerSearchService] Searching for: "${request.query}"`)

      // Get session cookies from AuthService
      const sessionCookies = this.getSessionCookies()
      console.log(
        `[RuTrackerSearchService] Got ${sessionCookies.length} session cookies from AuthService`
      )

      // Initialize browser
      const browser = await this.initBrowser()
      page = await this.pageScraper.createPageWithCookies(
        browser,
        sessionCookies
      )

      // Navigate to search URL
      const searchUrl = buildSearchUrl(request.query, 1)
      await this.pageScraper.navigateToSearchUrl(page, searchUrl)

      // Parse search results
      console.log('[RuTrackerSearchService] Parsing search results')
      let results = await this.resultParser.parseSearchResults(page)

      console.log(
        `[RuTrackerSearchService] Found ${results.length} raw results`
      )

      // Store total results before filtering
      const totalResults = results.length

      // Calculate relevance scores
      results = calculateRelevanceScores(results, request.query)

      // Apply filters if provided
      if (request.filters) {
        console.log(
          '[RuTrackerSearchService] Applying filters:',
          request.filters
        )
        results = this.filtersApplier.applyFilters(results, request.filters)
        console.log(
          `[RuTrackerSearchService] ${results.length} results after filtering`
        )
      }

      // Apply sorting if provided
      if (request.sort) {
        console.log('[RuTrackerSearchService] Applying sort:', request.sort)
        results = this.filtersApplier.applySorting(results, request.sort)
      } else {
        // Default: sort by relevance score (descending)
        results = this.filtersApplier.applySorting(results, {
          by: 'relevance',
          order: 'desc',
        })
      }

      // Limit results if maxResults is specified
      if (request.maxResults && request.maxResults > 0) {
        results = results.slice(0, request.maxResults)
        console.log(
          `[RuTrackerSearchService] Limited to ${request.maxResults} results`
        )
      }

      return {
        success: true,
        results,
        query: request.query,
        appliedFilters: request.filters,
        totalResults,
      }
    } catch (error) {
      console.error('[RuTrackerSearchService] Search failed:', error)

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed',
        query: request.query,
      }
    } finally {
      // Close the page but keep the browser alive for reuse
      if (page) {
        await page.close().catch(() => {})
      }
    }
  }

  /**
   * Search RuTracker with pagination support (progressive results)
   * Fetches multiple pages in parallel and reports progress
   *
   * @param request - Progressive search request
   * @param onProgress - Callback for progress updates with partial results
   * @returns Final search response with all results
   */
  async searchProgressive(
    request: ProgressiveSearchRequest,
    onProgress?: (event: SearchProgressEvent) => void
  ): Promise<SearchResponse> {
    try {
      // Check if user is logged in
      const authState = this.authService.getAuthStatus()
      if (!authState.isLoggedIn) {
        return {
          success: false,
          error: 'User is not logged in. Please login first.',
        }
      }

      console.log(
        `[RuTrackerSearchService] Progressive search for: "${request.query}"`
      )

      // Get session cookies from AuthService
      const sessionCookies = this.getSessionCookies()

      // Initialize browser
      const browser = await this.initBrowser()

      // Execute progressive search using pagination handler
      const allResults = await this.paginationHandler.executeProgressiveSearch(
        browser,
        request.query,
        sessionCookies,
        {
          maxPages: request.maxPages || 10,
          concurrentPages: 3,
        },
        request.filters,
        onProgress
      )

      console.log(
        `[RuTrackerSearchService] Progressive search complete: ${allResults.length} total results`
      )

      return {
        success: true,
        results: allResults,
        query: request.query,
        appliedFilters: request.filters,
        totalResults: allResults.length,
      }
    } catch (error) {
      console.error(
        '[RuTrackerSearchService] Progressive search failed:',
        error
      )

      // Report error in progress
      onProgress?.({
        currentPage: 0,
        totalPages: 0,
        results: [],
        isComplete: true,
        error: error instanceof Error ? error.message : 'Search failed',
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed',
        query: request.query,
      }
    }
  }
}
