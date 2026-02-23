import type { Browser, Page } from 'puppeteer-core'
import type {
  SearchResult,
  SearchFilters,
  SearchProgressEvent,
} from '@shared/types/search.types'
import { buildSearchUrl } from '../utils/urlBuilder'
import { calculateRelevanceScores } from '../utils/relevanceScorer'
import { PageScraper, type SessionCookie } from './PageScraper'
import { ResultParser } from './ResultParser'
import { SearchFiltersApplier } from '../filters/SearchFilters'

/**
 * Configuration for pagination
 */
export interface PaginationConfig {
  maxPages: number
  concurrentPages: number
}

/**
 * PaginationHandler
 *
 * Handles multi-page search operations with parallel fetching and progress reporting
 */
export class PaginationHandler {
  private pageScraper: PageScraper
  private resultParser: ResultParser
  private filtersApplier: SearchFiltersApplier

  constructor() {
    this.pageScraper = new PageScraper()
    this.resultParser = new ResultParser()
    this.filtersApplier = new SearchFiltersApplier()
  }

  /**
   * Fetch and parse a single page
   *
   * @param page - Puppeteer page
   * @param pageNum - Page number (1-indexed)
   * @param query - Search query
   * @param filters - Optional filters to apply
   * @returns Search results from the page
   */
  private async fetchPage(
    page: Page,
    pageNum: number,
    query: string,
    filters?: SearchFilters
  ): Promise<SearchResult[]> {
    const pageUrl = buildSearchUrl(query, pageNum)

    console.log(`[PaginationHandler] Fetching page ${pageNum}: ${pageUrl}`)

    await this.pageScraper.navigateToSearchUrl(page, pageUrl)

    let results = await this.resultParser.parseSearchResults(page)
    results = calculateRelevanceScores(results, query)

    if (filters) {
      results = this.filtersApplier.applyFilters(results, filters)
    }

    return results
  }

  /**
   * Execute progressive search with pagination
   *
   * @param browser - Puppeteer browser instance
   * @param query - Search query
   * @param sessionCookies - Session cookies for authentication
   * @param config - Pagination configuration
   * @param filters - Optional filters to apply
   * @param onProgress - Progress callback
   * @returns All search results from multiple pages
   */
  async executeProgressiveSearch(
    browser: Browser,
    query: string,
    sessionCookies: SessionCookie[],
    config: PaginationConfig,
    filters?: SearchFilters,
    onProgress?: (event: SearchProgressEvent) => void
  ): Promise<SearchResult[]> {
    const allResults: SearchResult[] = []
    const maxPages = config.maxPages
    const CONCURRENT_PAGES = config.concurrentPages

    console.log(
      `[PaginationHandler] Progressive search for: "${query}" (max ${maxPages} pages, ${CONCURRENT_PAGES} concurrent)`
    )

    // First, fetch page 1 to get total pages
    const firstPage = await this.pageScraper.createPageWithCookies(
      browser,
      sessionCookies
    )
    const firstPageResults = await this.fetchPage(firstPage, 1, query, filters)
    const totalPagesAvailable = await this.resultParser.getTotalPages(firstPage)
    const totalPages = Math.min(totalPagesAvailable, maxPages)

    // Add first page results
    allResults.push(...firstPageResults)

    console.log(
      `[PaginationHandler] Page 1: ${firstPageResults.length} results, total pages: ${totalPagesAvailable}, will fetch: ${totalPages}`
    )

    // Report first page progress
    onProgress?.({
      currentPage: 1,
      totalPages,
      results: [...allResults],
      isComplete: totalPages <= 1,
    })

    // If only 1 page, we're done
    if (totalPages <= 1) {
      await firstPage.close().catch(() => {})
      return allResults
    }

    // Create additional pages for parallel fetching
    const pages: Page[] = [firstPage]
    for (let i = 1; i < Math.min(CONCURRENT_PAGES, totalPages - 1); i++) {
      pages.push(
        await this.pageScraper.createPageWithCookies(browser, sessionCookies)
      )
    }

    // Fetch remaining pages in parallel batches
    const remainingPageNums = Array.from(
      { length: totalPages - 1 },
      (_, i) => i + 2
    )
    let pagesCompleted = 1

    // Process pages in batches using available browser pages
    while (remainingPageNums.length > 0) {
      const batch = remainingPageNums.splice(0, pages.length)

      const batchPromises = batch.map((pageNum, idx) => {
        const browserPage = pages[idx % pages.length]
        return this.fetchPage(browserPage, pageNum, query, filters)
          .then((results) => ({ pageNum, results, error: null }))
          .catch((error) => ({ pageNum, results: [] as SearchResult[], error }))
      })

      const batchResults = await Promise.all(batchPromises)

      // Process batch results
      const existingIds = new Set(allResults.map((r) => r.id))

      for (const { pageNum, results, error } of batchResults) {
        if (error) {
          console.error(`[PaginationHandler] Page ${pageNum} failed:`, error)
          continue
        }

        const uniqueResults = results.filter((r) => !existingIds.has(r.id))
        uniqueResults.forEach((r) => existingIds.add(r.id))
        allResults.push(...uniqueResults)

        console.log(
          `[PaginationHandler] Page ${pageNum}: ${results.length} results (${uniqueResults.length} new)`
        )
        pagesCompleted++
      }

      // Report progress after each batch
      onProgress?.({
        currentPage: pagesCompleted,
        totalPages,
        results: [...allResults],
        isComplete: remainingPageNums.length === 0,
      })
    }

    // Close all pages (keep browser alive for reuse)
    for (const page of pages) {
      await page.close().catch(() => {})
    }

    console.log(
      `[PaginationHandler] Progressive search complete: ${allResults.length} total results`
    )

    return allResults
  }
}
