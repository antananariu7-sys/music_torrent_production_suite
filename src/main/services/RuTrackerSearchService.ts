import puppeteer, { Browser, Page } from 'puppeteer-core'
import { execSync } from 'child_process'
import { existsSync } from 'fs'
import type { SearchRequest, SearchResult, SearchResponse } from '@shared/types/search.types'
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
      const results = await this.parseSearchResults(page)

      console.log(`[RuTrackerSearchService] Found ${results.length} results`)

      // Close browser after successful search (in headless mode)
      if (this.browserOptions.headless) {
        await this.closeBrowser()
      } else {
        console.log('[RuTrackerSearchService] Browser left open for inspection (non-headless mode)')
      }

      return {
        success: true,
        results,
        query: request.query,
      }
    } catch (error) {
      console.error('[RuTrackerSearchService] Search failed:', error)

      // Leave browser open in non-headless mode for debugging
      if (!this.browserOptions.headless) {
        console.log('[RuTrackerSearchService] Browser left open for inspection')
      } else {
        await this.closeBrowser()
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed',
        query: request.query,
      }
    }
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

        rows.forEach((row, index) => {
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
            })
          } catch (error) {
            console.error(`[Browser] Error parsing row ${index}:`, error)
          }
        })

        console.log(`[Browser] Successfully parsed ${resultsArray.length} results`)
        return resultsArray
      })

      console.log(`[RuTrackerSearchService] Parser returned ${results.length} results`)

      // Log first result for debugging
      if (results.length > 0) {
        console.log('[RuTrackerSearchService] Sample result:', JSON.stringify(results[0], null, 2))
      }

      return results
    } catch (error) {
      console.error('[RuTrackerSearchService] Failed to parse results:', error)
      return []
    }
  }
}
