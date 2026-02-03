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

      // Navigate to RuTracker search page
      const searchUrl = `https://rutracker.org/forum/tracker.php`
      console.log(`[RuTrackerSearchService] Navigating to ${searchUrl}`)
      await page.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      })

      // Wait for search input to be visible
      console.log('[RuTrackerSearchService] Waiting for search input')
      const searchInputSelector = '#search-text'
      await page.waitForSelector(searchInputSelector, { visible: true, timeout: 10000 })

      // Type the search query
      console.log(`[RuTrackerSearchService] Typing search query: "${request.query}"`)
      await page.type(searchInputSelector, request.query)

      // Submit the search form
      console.log('[RuTrackerSearchService] Submitting search form')
      await page.keyboard.press('Enter')

      // Wait for navigation to search results
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 })

      // Wait a bit for results to load
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
      // RuTracker search results are in a table with class 'forumline'
      // Each result is a row <tr> with torrent data
      const results = await page.evaluate(() => {
        const resultsArray: SearchResult[] = []

        // Find the results table - usually has class 'forumline tablesorter'
        const table = document.querySelector('table.forumline')
        if (!table) {
          console.log('No results table found')
          return resultsArray
        }

        // Get all result rows (skip header row)
        const rows = table.querySelectorAll('tr[data-topic_id]')
        console.log(`Found ${rows.length} result rows`)

        rows.forEach((row, index) => {
          try {
            // Extract topic ID from data attribute
            const topicId = row.getAttribute('data-topic_id') || ''

            // Title is in the cell with class 't-title'
            const titleCell = row.querySelector('.t-title a.tLink')
            const title = titleCell?.textContent?.trim() || 'Unknown Title'
            const url = titleCell ? `https://rutracker.org/forum/${titleCell.getAttribute('href')}` : ''

            // Author is in the cell with class 'u-name'
            const authorCell = row.querySelector('.u-name a')
            const author = authorCell?.textContent?.trim() || 'Unknown Author'

            // Size is in the cell with data-ts_text attribute (file size)
            const sizeCell = row.querySelector('.tor-size[data-ts_text]')
            const size = sizeCell?.getAttribute('data-ts_text') || '0'

            // Seeders - cell with class 'seedmed' or 'seed'
            const seedersCell = row.querySelector('.seedmed, .seed')
            const seedersText = seedersCell?.textContent?.trim() || '0'
            const seeders = parseInt(seedersText) || 0

            // Leechers - cell with class 'leechmed' or 'leech'
            const leechersCell = row.querySelector('.leechmed, .leech')
            const leechersText = leechersCell?.textContent?.trim() || '0'
            const leechers = parseInt(leechersText) || 0

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
            console.error(`Error parsing row ${index}:`, error)
          }
        })

        return resultsArray
      })

      return results
    } catch (error) {
      console.error('[RuTrackerSearchService] Failed to parse results:', error)
      return []
    }
  }
}
