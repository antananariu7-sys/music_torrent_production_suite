import type { Page } from 'puppeteer-core'
import type {
  SearchRequest,
  SearchResponse,
  ProgressiveSearchRequest,
  SearchProgressEvent,
  LoadMoreRequest,
  LoadMoreResponse,
} from '@shared/types/search.types'
import type { AuthService } from './AuthService'
import { BrowserManager } from './BrowserManager'
import { PageScraper } from './rutracker/scrapers/PageScraper'
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
 * Delegates browser lifecycle to BrowserManager.
 */
export class RuTrackerSearchService {
  private browserManager: BrowserManager
  private pageScraper: PageScraper
  private resultParser: ResultParser
  private paginationHandler: PaginationHandler
  private filtersApplier: SearchFiltersApplier

  constructor(
    private authService: AuthService,
    options: Partial<BrowserOptions> = {}
  ) {
    this.browserManager = new BrowserManager(authService, options)

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
    this.browserManager.setBrowserOptions(options)
  }

  /**
   * Close search browser and all viewing browser instances
   */
  async closeBrowser(): Promise<void> {
    return this.browserManager.closeBrowser()
  }

  /**
   * Open a RuTracker URL in browser with authenticated session
   */
  async openUrlWithSession(
    url: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.browserManager.openUrlWithSession(url)
  }

  /**
   * Search RuTracker for torrents
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
      const sessionCookies = this.browserManager.getSessionCookies()
      console.log(
        `[RuTrackerSearchService] Got ${sessionCookies.length} session cookies from AuthService`
      )

      // Initialize browser
      const browser = await this.browserManager.initBrowser()
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
      const sessionCookies = this.browserManager.getSessionCookies()

      // Initialize browser
      const browser = await this.browserManager.initBrowser()

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

  /**
   * Load additional search result pages beyond the initial search.
   */
  async loadMoreResults(request: LoadMoreRequest): Promise<LoadMoreResponse> {
    const pages: Page[] = []
    try {
      const authState = this.authService.getAuthStatus()
      if (!authState.isLoggedIn) {
        return {
          success: false,
          results: [],
          loadedPages: 0,
          totalPages: 0,
          isComplete: false,
          error: 'User is not logged in.',
        }
      }

      const sessionCookies = this.browserManager.getSessionCookies()
      const browser = await this.browserManager.initBrowser()

      const { query, fromPage, toPage, filters } = request
      const pageRange = Array.from(
        { length: toPage - fromPage + 1 },
        (_, i) => fromPage + i
      )

      console.log(
        `[RuTrackerSearchService] Load more: pages ${fromPage}-${toPage} for "${query}"`
      )

      // Create browser pages for parallel fetching (max 3 concurrent)
      const concurrentPages = Math.min(3, pageRange.length)
      for (let i = 0; i < concurrentPages; i++) {
        pages.push(
          await this.pageScraper.createPageWithCookies(browser, sessionCookies)
        )
      }

      // Detect total pages from first page in range
      const firstPage = pages[0]
      const firstUrl = buildSearchUrl(query, pageRange[0])
      await this.pageScraper.navigateToSearchUrl(firstPage, firstUrl)
      const totalPagesAvailable =
        await this.resultParser.getTotalPages(firstPage)

      // Parse results from the first page
      let firstResults = await this.resultParser.parseSearchResults(firstPage)
      firstResults = calculateRelevanceScores(firstResults, query)
      if (filters) {
        firstResults = this.filtersApplier.applyFilters(firstResults, filters)
      }

      const allResults = [...firstResults]
      const existingIds = new Set(allResults.map((r) => r.id))
      let loadedCount = 1

      // Fetch remaining pages in batches
      const remaining = pageRange.slice(1)
      while (remaining.length > 0) {
        const batch = remaining.splice(0, pages.length)
        const batchPromises = batch.map(async (pageNum, idx) => {
          const browserPage = pages[idx % pages.length]
          try {
            const pageUrl = buildSearchUrl(query, pageNum)
            await this.pageScraper.navigateToSearchUrl(browserPage, pageUrl)
            let results =
              await this.resultParser.parseSearchResults(browserPage)
            results = calculateRelevanceScores(results, query)
            if (filters) {
              results = this.filtersApplier.applyFilters(results, filters)
            }
            return { results, error: null }
          } catch (err) {
            return { results: [] as typeof allResults, error: err }
          }
        })

        const batchResults = await Promise.all(batchPromises)
        for (const { results, error } of batchResults) {
          if (error) continue
          const unique = results.filter((r) => !existingIds.has(r.id))
          unique.forEach((r) => existingIds.add(r.id))
          allResults.push(...unique)
          loadedCount++
        }
      }

      const isComplete = toPage >= totalPagesAvailable

      console.log(
        `[RuTrackerSearchService] Load more complete: ${allResults.length} results from ${loadedCount} pages (total available: ${totalPagesAvailable})`
      )

      return {
        success: true,
        results: allResults,
        loadedPages: loadedCount,
        totalPages: totalPagesAvailable,
        isComplete,
      }
    } catch (error) {
      console.error('[RuTrackerSearchService] Load more failed:', error)
      return {
        success: false,
        results: [],
        loadedPages: 0,
        totalPages: 0,
        isComplete: false,
        error: error instanceof Error ? error.message : 'Load more failed',
      }
    } finally {
      for (const page of pages) {
        await page.close().catch(() => {})
      }
    }
  }
}
