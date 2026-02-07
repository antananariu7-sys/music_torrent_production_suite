import puppeteer, { Browser, Page } from 'puppeteer-core'
import { execSync } from 'child_process'
import { existsSync } from 'fs'
import type {
  SearchRequest,
  SearchResult,
  SearchResponse,
  FileFormat,
  SearchFilters,
  SearchSort,
  ProgressiveSearchRequest,
  SearchProgressEvent,
} from '@shared/types/search.types'
import type { AuthService } from './AuthService'

interface BrowserOptions {
  headless: boolean
}

/**
 * RuTrackerSearchService
 *
 * Handles search operations on RuTracker using Puppeteer.
 * Reuses session from AuthService for authenticated searches.
 */
export class RuTrackerSearchService {
  private browser: Browser | null = null
  private browserOptions: BrowserOptions

  constructor(
    private authService: AuthService,
    options: Partial<BrowserOptions> = {}
  ) {
    // Use DEBUG_BROWSER env var if no explicit option provided
    const headless = options.headless ?? (process.env.DEBUG_BROWSER !== 'true')
    this.browserOptions = {
      headless,
    }
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
        console.log(`[RuTrackerSearchService] Found Chrome via 'where': ${chromePath}`)
        return chromePath
      }
    } catch (error) {
      // Ignore error
    }

    throw new Error('Chrome/Chromium executable not found. Please install Google Chrome.')
  }

  /**
   * Initialize browser instance
   */
  private async initBrowser(): Promise<Browser> {
    if (this.browser) {
      return this.browser
    }

    const executablePath = this.findChromePath()
    console.log(`[RuTrackerSearchService] Launching browser (headless: ${this.browserOptions.headless})`)

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
   * Close browser instance
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
      console.log('[RuTrackerSearchService] Browser closed')
    }
  }

  /**
   * Open a RuTracker URL in browser with authenticated session
   * Useful for viewing torrent details while maintaining login
   *
   * @param url - RuTracker URL to open
   * @returns Success status
   */
  async openUrlWithSession(url: string): Promise<{ success: boolean; error?: string }> {
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
      const sessionCookies = this.authService.getSessionCookies()
      console.log(`[RuTrackerSearchService] Got ${sessionCookies.length} session cookies`)

      // Launch a separate browser instance for viewing (not reusing this.browser)
      // This prevents interfering with the search browser instance
      const executablePath = this.findChromePath()
      console.log('[RuTrackerSearchService] Launching separate browser instance for viewing')

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

      const page = await viewingBrowser.newPage()

      // Set viewport
      await page.setViewport({ width: 1280, height: 800 })

      // Navigate to RuTracker homepage first to set cookies
      console.log('[RuTrackerSearchService] Navigating to RuTracker homepage to set cookies')
      await page.goto('https://rutracker.org/forum/', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      })

      // Restore session cookies
      if (sessionCookies.length > 0) {
        console.log('[RuTrackerSearchService] Restoring session cookies')
        await page.setCookie(...sessionCookies.map(cookie => ({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          expires: cookie.expires,
        })))
      }

      // Navigate to the requested URL
      console.log(`[RuTrackerSearchService] Navigating to: ${url}`)
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      })

      console.log('[RuTrackerSearchService] ✅ URL opened successfully with session')
      console.log('[RuTrackerSearchService] Browser left open for user interaction')

      // Don't close the browser - leave it open for user to interact
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
      const sessionCookies = this.authService.getSessionCookies()
      console.log(`[RuTrackerSearchService] Got ${sessionCookies.length} session cookies from AuthService`)

      // Initialize browser
      const browser = await this.initBrowser()
      page = await browser.newPage()

      // Set viewport
      await page.setViewport({ width: 1280, height: 800 })

      // Navigate to RuTracker homepage first to set cookies
      console.log('[RuTrackerSearchService] Navigating to RuTracker homepage to set cookies')
      await page.goto('https://rutracker.org/forum/', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      })

      // Restore session cookies
      if (sessionCookies.length > 0) {
        console.log('[RuTrackerSearchService] Restoring session cookies')
        await page.setCookie(...sessionCookies.map(cookie => ({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          expires: cookie.expires,
        })))
      }

      // Navigate directly to RuTracker search results using URL parameter
      // Format: https://rutracker.org/forum/tracker.php?nm=<SEARCH_TERM>
      const encodedQuery = encodeURIComponent(request.query)
      const searchUrl = `https://rutracker.org/forum/tracker.php?nm=${encodedQuery}`
      console.log(`[RuTrackerSearchService] Navigating to ${searchUrl}`)

      await page.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      })

      // Wait for results table to load (using correct ID: tor-tbl)
      console.log('[RuTrackerSearchService] Waiting for results table to appear')
      await page.waitForSelector('#tor-tbl', { visible: true, timeout: 10000 })

      // Wait a bit for results to fully render
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Parse search results
      console.log('[RuTrackerSearchService] Parsing search results')
      let results = await this.parseSearchResults(page)

      console.log(`[RuTrackerSearchService] Found ${results.length} raw results`)

      // Store total results before filtering
      const totalResults = results.length

      // Calculate relevance scores
      results = this.calculateRelevanceScores(results, request.query)

      // Apply filters if provided
      if (request.filters) {
        console.log('[RuTrackerSearchService] Applying filters:', request.filters)
        results = this.applyFilters(results, request.filters)
        console.log(`[RuTrackerSearchService] ${results.length} results after filtering`)
      }

      // Apply sorting if provided
      if (request.sort) {
        console.log('[RuTrackerSearchService] Applying sort:', request.sort)
        results = this.applySorting(results, request.sort)
      } else {
        // Default: sort by relevance score (descending)
        results = this.applySorting(results, { by: 'relevance', order: 'desc' })
      }

      // Limit results if maxResults is specified
      if (request.maxResults && request.maxResults > 0) {
        results = results.slice(0, request.maxResults)
        console.log(`[RuTrackerSearchService] Limited to ${request.maxResults} results`)
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
    const allResults: SearchResult[] = []
    const maxPages = Math.min(request.maxPages || 10, 10) // Cap at 10 pages
    const CONCURRENT_PAGES = 3 // Number of pages to fetch in parallel

    try {
      // Check if user is logged in
      const authState = this.authService.getAuthStatus()
      if (!authState.isLoggedIn) {
        return {
          success: false,
          error: 'User is not logged in. Please login first.',
        }
      }

      console.log(`[RuTrackerSearchService] Progressive search for: "${request.query}" (max ${maxPages} pages, ${CONCURRENT_PAGES} concurrent)`)

      // Get session cookies from AuthService
      const sessionCookies = this.authService.getSessionCookies()

      // Initialize browser
      const browser = await this.initBrowser()

      // Helper to create a page with cookies
      const createPageWithCookies = async (): Promise<Page> => {
        const page = await browser.newPage()
        await page.setViewport({ width: 1280, height: 800 })

        // Navigate to RuTracker to set cookies
        await page.goto('https://rutracker.org/forum/', {
          waitUntil: 'networkidle2',
          timeout: 30000,
        })

        // Restore session cookies
        if (sessionCookies.length > 0) {
          await page.setCookie(...sessionCookies.map(cookie => ({
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            expires: cookie.expires,
          })))
        }

        return page
      }

      // Helper to fetch and parse a single page
      const fetchPage = async (page: Page, pageNum: number, encodedQuery: string): Promise<SearchResult[]> => {
        const startOffset = (pageNum - 1) * 50
        const pageUrl = pageNum === 1
          ? `https://rutracker.org/forum/tracker.php?nm=${encodedQuery}`
          : `https://rutracker.org/forum/tracker.php?nm=${encodedQuery}&start=${startOffset}`

        console.log(`[RuTrackerSearchService] Fetching page ${pageNum}: ${pageUrl}`)

        await page.goto(pageUrl, {
          waitUntil: 'networkidle2',
          timeout: 30000,
        })

        await page.waitForSelector('#tor-tbl', { visible: true, timeout: 10000 })
        await new Promise(resolve => setTimeout(resolve, 500))

        let results = await this.parseSearchResults(page)
        results = this.calculateRelevanceScores(results, request.query)

        if (request.filters) {
          results = this.applyFilters(results, request.filters)
        }

        return results
      }

      const encodedQuery = encodeURIComponent(request.query)

      // First, fetch page 1 to get total pages
      const firstPage = await createPageWithCookies()
      const firstPageResults = await fetchPage(firstPage, 1, encodedQuery)
      const totalPagesAvailable = await this.getTotalPages(firstPage)
      const totalPages = Math.min(totalPagesAvailable, maxPages)

      // Add first page results
      allResults.push(...firstPageResults)

      console.log(`[RuTrackerSearchService] Page 1: ${firstPageResults.length} results, total pages: ${totalPagesAvailable}, will fetch: ${totalPages}`)

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
        return {
          success: true,
          results: allResults,
          query: request.query,
          appliedFilters: request.filters,
          totalResults: allResults.length,
        }
      }

      // Create additional pages for parallel fetching
      const pages: Page[] = [firstPage]
      for (let i = 1; i < Math.min(CONCURRENT_PAGES, totalPages - 1); i++) {
        pages.push(await createPageWithCookies())
      }

      // Fetch remaining pages in parallel batches
      const remainingPageNums = Array.from({ length: totalPages - 1 }, (_, i) => i + 2)
      let pagesCompleted = 1

      // Process pages in batches using available browser pages
      while (remainingPageNums.length > 0) {
        const batch = remainingPageNums.splice(0, pages.length)

        const batchPromises = batch.map((pageNum, idx) => {
          const browserPage = pages[idx % pages.length]
          return fetchPage(browserPage, pageNum, encodedQuery)
            .then(results => ({ pageNum, results, error: null }))
            .catch(error => ({ pageNum, results: [] as SearchResult[], error }))
        })

        const batchResults = await Promise.all(batchPromises)

        // Process batch results
        const existingIds = new Set(allResults.map(r => r.id))

        for (const { pageNum, results, error } of batchResults) {
          if (error) {
            console.error(`[RuTrackerSearchService] Page ${pageNum} failed:`, error)
            continue
          }

          const uniqueResults = results.filter(r => !existingIds.has(r.id))
          uniqueResults.forEach(r => existingIds.add(r.id))
          allResults.push(...uniqueResults)

          console.log(`[RuTrackerSearchService] Page ${pageNum}: ${results.length} results (${uniqueResults.length} new)`)
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

      console.log(`[RuTrackerSearchService] Progressive search complete: ${allResults.length} total results`)

      return {
        success: true,
        results: allResults,
        query: request.query,
        appliedFilters: request.filters,
        totalResults: allResults.length,
      }
    } catch (error) {
      console.error('[RuTrackerSearchService] Progressive search failed:', error)

      // Report error in progress
      onProgress?.({
        currentPage: 0,
        totalPages: 0,
        results: allResults,
        isComplete: true,
        error: error instanceof Error ? error.message : 'Search failed',
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed',
        query: request.query,
        results: allResults.length > 0 ? allResults : undefined,
      }
    }
  }

  /**
   * Get total number of pages from pagination
   */
  private async getTotalPages(page: Page): Promise<number> {
    try {
      const totalPages = await page.evaluate(() => {
        // Look for pagination links with class="pg"
        const pgLinks = document.querySelectorAll('a.pg')
        let maxPage = 1

        pgLinks.forEach(link => {
          const text = link.textContent?.trim() || ''
          const pageNum = parseInt(text, 10)
          if (!isNaN(pageNum) && pageNum > maxPage) {
            maxPage = pageNum
          }
        })

        return maxPage
      })

      return totalPages
    } catch {
      return 1
    }
  }

  /**
   * Detect file format from title
   *
   * @param title - Torrent title
   * @returns Detected file format or undefined
   */
  private detectFileFormat(title: string): FileFormat | undefined {
    const titleLower = title.toLowerCase()

    if (titleLower.includes('flac')) return 'flac'
    if (titleLower.includes('mp3')) return 'mp3'
    if (titleLower.includes('wav')) return 'wav'
    if (titleLower.includes('aac')) return 'aac'
    if (titleLower.includes('ogg')) return 'ogg'
    if (titleLower.includes('alac') || titleLower.includes('apple lossless')) return 'alac'
    if (titleLower.includes('ape') || titleLower.includes('monkey')) return 'ape'

    return undefined
  }

  /**
   * Parse size string to bytes
   *
   * @param sizeStr - Size string (e.g., "1.5 GB", "500 MB")
   * @returns Size in bytes or undefined
   */
  private parseSizeToBytes(sizeStr: string): number | undefined {
    const match = sizeStr.match(/([\d.]+)\s*(GB|MB|KB|TB)/i)
    if (!match) return undefined

    const value = parseFloat(match[1])
    const unit = match[2].toUpperCase()

    const multipliers: Record<string, number> = {
      KB: 1024,
      MB: 1024 * 1024,
      GB: 1024 * 1024 * 1024,
      TB: 1024 * 1024 * 1024 * 1024,
    }

    return value * (multipliers[unit] || 1)
  }

  /**
   * Calculate relevance score for a search result
   *
   * @param result - Search result
   * @param query - Original search query
   * @returns Relevance score (0-100)
   */
  private calculateRelevance(result: SearchResult, query: string): number {
    let score = 0
    const titleLower = result.title.toLowerCase()
    const queryLower = query.toLowerCase()
    const queryWords = queryLower.split(/\s+/)

    // Title exact match: +40 points
    if (titleLower === queryLower) {
      score += 40
    }
    // Title contains full query: +30 points
    else if (titleLower.includes(queryLower)) {
      score += 30
    }
    // Title contains all query words: +20 points
    else if (queryWords.every(word => titleLower.includes(word))) {
      score += 20
    }
    // Title contains some query words: +10 points per word
    else {
      const matchedWords = queryWords.filter(word => titleLower.includes(word))
      score += matchedWords.length * 5
    }

    // Seeder boost: +1-30 points based on seeders
    if (result.seeders > 0) {
      score += Math.min(30, Math.log10(result.seeders + 1) * 10)
    }

    // Format boost: +10 points for lossless formats
    if (result.format && ['flac', 'alac', 'ape', 'wav'].includes(result.format)) {
      score += 10
    }

    return Math.min(100, Math.round(score))
  }

  /**
   * Calculate relevance scores for all results
   *
   * @param results - Search results
   * @param query - Original search query
   * @returns Results with relevance scores
   */
  private calculateRelevanceScores(results: SearchResult[], query: string): SearchResult[] {
    return results.map(result => ({
      ...result,
      relevanceScore: this.calculateRelevance(result, query),
    }))
  }

  /**
   * Apply filters to search results
   *
   * @param results - Search results
   * @param filters - Filters to apply
   * @returns Filtered results
   */
  private applyFilters(results: SearchResult[], filters: SearchFilters): SearchResult[] {
    return results.filter(result => {
      // Format filter
      if (filters.format && filters.format !== 'any') {
        if (result.format !== filters.format) {
          return false
        }
      }

      // Min seeders filter
      if (filters.minSeeders !== undefined) {
        if (result.seeders < filters.minSeeders) {
          return false
        }
      }

      // Size filters
      if (result.sizeBytes) {
        const sizeMB = result.sizeBytes / (1024 * 1024)

        if (filters.minSize !== undefined && sizeMB < filters.minSize) {
          return false
        }

        if (filters.maxSize !== undefined && sizeMB > filters.maxSize) {
          return false
        }
      }

      // Category filter
      if (filters.categories && filters.categories.length > 0) {
        if (!result.category || !filters.categories.includes(result.category)) {
          return false
        }
      }

      // Date filters (if uploadDate is available)
      if (result.uploadDate) {
        const uploadDate = new Date(result.uploadDate)

        if (filters.dateFrom && uploadDate < filters.dateFrom) {
          return false
        }

        if (filters.dateTo && uploadDate > filters.dateTo) {
          return false
        }
      }

      return true
    })
  }

  /**
   * Apply sorting to search results
   *
   * @param results - Search results
   * @param sort - Sort parameters
   * @returns Sorted results
   */
  private applySorting(results: SearchResult[], sort: SearchSort): SearchResult[] {
    const sorted = [...results]

    sorted.sort((a, b) => {
      let comparison = 0

      switch (sort.by) {
        case 'relevance':
          // Higher score first (desc by default)
          comparison = (a.relevanceScore || 0) - (b.relevanceScore || 0)
          break
        case 'seeders':
          // More seeders first (desc by default)
          comparison = a.seeders - b.seeders
          break
        case 'date':
          // Newer first (desc by default)
          if (a.uploadDate && b.uploadDate) {
            comparison = new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime()
          }
          break
        case 'size':
          // Larger first (desc by default)
          comparison = (a.sizeBytes || 0) - (b.sizeBytes || 0)
          break
        case 'title':
          // Alphabetical (asc by default)
          comparison = a.title.localeCompare(b.title)
          break
      }

      // For most fields, desc means reverse order
      // For title, asc is natural alphabetical order
      if (sort.by === 'title') {
        return sort.order === 'asc' ? comparison : -comparison
      } else {
        return sort.order === 'desc' ? -comparison : comparison
      }
    })

    return sorted
  }

  /**
   * Parse search results from RuTracker page
   *
   * @param page - Puppeteer page with search results
   * @returns Array of search results
   */
  private async parseSearchResults(page: Page): Promise<SearchResult[]> {
    try {
      // RuTracker search results are in a table with ID 'tor-tbl'
      // Each result is a row <tr> with torrent data
      const results = await page.evaluate(() => {
        const resultsArray: Array<{
          id: string
          title: string
          author: string
          size: string
          seeders: number
          leechers: number
          url: string
          category?: string
          uploadDate?: string
        }> = []

        // Find the results table using the correct ID
        const table = document.querySelector('#tor-tbl')
        console.log('[Browser] Looking for table with ID tor-tbl')

        if (!table) {
          console.log('[Browser] No results table found with ID tor-tbl')
          // Try to find any table as fallback
          const allTables = document.querySelectorAll('table')
          console.log(`[Browser] Found ${allTables.length} total tables on page`)
          return resultsArray
        }

        console.log('[Browser] Found tor-tbl table')

        // Get all rows in the table
        const allRows = table.querySelectorAll('tr')
        console.log(`[Browser] Total rows in table: ${allRows.length}`)

        // Get all result rows - look for rows with data-topic_id attribute
        const rows = table.querySelectorAll('tr[data-topic_id]')
        console.log(`[Browser] Found ${rows.length} result rows with data-topic_id`)

        // If no rows with data-topic_id, try tbody tr as fallback
        if (rows.length === 0) {
          const tbodyRows = table.querySelectorAll('tbody tr')
          console.log(`[Browser] Trying tbody tr fallback: ${tbodyRows.length} rows`)
        }

        rows.forEach((row: Element, index: number) => {
          try {
            // Extract topic ID from data attribute
            const topicId = row.getAttribute('data-topic_id') || `unknown-${index}`

            // Title - try multiple selectors
            const titleCell = row.querySelector('.t-title a.tLink') ||
                            row.querySelector('.t-title a') ||
                            row.querySelector('a.tLink')
            const title = titleCell?.textContent?.trim() || 'Unknown Title'
            const href = titleCell?.getAttribute('href') || ''
            const url = href ? `https://rutracker.org/forum/${href}` : ''

            // Author - try multiple selectors
            const authorCell = row.querySelector('.u-name a') ||
                              row.querySelector('td:nth-child(6) a')
            const author = authorCell?.textContent?.trim() || 'Unknown Author'

            // Size - try multiple selectors
            const sizeCell = row.querySelector('.tor-size[data-ts_text]') ||
                           row.querySelector('.tor-size') ||
                           row.querySelector('td:nth-child(5)')
            const size = sizeCell?.getAttribute('data-ts_text') ||
                        sizeCell?.textContent?.trim() ||
                        '0'

            // Seeders - try multiple selectors
            const seedersCell = row.querySelector('.seedmed') ||
                               row.querySelector('.seed') ||
                               row.querySelector('td:nth-child(7)')
            const seedersText = seedersCell?.textContent?.trim() || '0'
            const seeders = parseInt(seedersText.replace(/[^0-9]/g, '')) || 0

            // Leechers - try multiple selectors
            const leechersCell = row.querySelector('.leechmed') ||
                                row.querySelector('.leech') ||
                                row.querySelector('td:nth-child(8)')
            const leechersText = leechersCell?.textContent?.trim() || '0'
            const leechers = parseInt(leechersText.replace(/[^0-9]/g, '')) || 0

            console.log(`[Browser] Parsed row ${index}: ${title} (S:${seeders} L:${leechers})`)

            resultsArray.push({
              id: topicId,
              title,
              author,
              size,
              seeders,
              leechers,
              url,
              category: undefined, // Will be populated if available
              uploadDate: undefined, // Will be populated if available
            })
          } catch (error) {
            console.error(`[Browser] Error parsing row ${index}:`, error)
          }
        })

        console.log(`[Browser] Successfully parsed ${resultsArray.length} results`)
        return resultsArray
      })

      console.log(`[RuTrackerSearchService] Parser returned ${results.length} results`)

      // Post-process results: detect format and parse size
      const processedResults = results.map(result => ({
        ...result,
        format: this.detectFileFormat(result.title),
        sizeBytes: this.parseSizeToBytes(result.size),
      }))

      // Log first result for debugging
      if (processedResults.length > 0) {
        console.log('[RuTrackerSearchService] Sample result:', JSON.stringify(processedResults[0], null, 2))
      }

      return processedResults
    } catch (error) {
      console.error('[RuTrackerSearchService] Failed to parse results:', error)
      return []
    }
  }
}
