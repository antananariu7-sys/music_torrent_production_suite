import puppeteer, { Browser } from 'puppeteer-core'
import type { AuthService } from './AuthService'
import {
  PageScraper,
  type SessionCookie,
} from './rutracker/scrapers/PageScraper'
import { findChromePath } from './utils/browserUtils'

interface BrowserOptions {
  headless: boolean
}

const MAX_VIEWING_BROWSERS = 3

/**
 * Manages Puppeteer browser instances for search and URL viewing.
 */
export class BrowserManager {
  private browser: Browser | null = null
  private viewingBrowsers: Set<Browser> = new Set()
  private browserOptions: BrowserOptions
  private pageScraper: PageScraper

  constructor(
    private authService: AuthService,
    options: Partial<BrowserOptions> = {}
  ) {
    const headless = options.headless ?? process.env.DEBUG_BROWSER !== 'true'
    this.browserOptions = { headless }
    this.pageScraper = new PageScraper()
  }

  /**
   * Set browser options (e.g., for debugging)
   */
  setBrowserOptions(options: Partial<BrowserOptions>): void {
    this.browserOptions = { ...this.browserOptions, ...options }
  }

  /**
   * Initialize or reuse the shared search browser instance.
   */
  async initBrowser(): Promise<Browser> {
    if (this.browser) {
      return this.browser
    }

    const executablePath = await findChromePath()
    console.log(
      `[BrowserManager] Launching browser (headless: ${this.browserOptions.headless})`
    )

    this.browser = await puppeteer.launch({
      executablePath,
      headless: this.browserOptions.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        // Required for RuTracker page scraping (cross-origin content access)
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    })

    return this.browser
  }

  /**
   * Close search browser and all viewing browser instances.
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
    console.log('[BrowserManager] All browsers closed')
  }

  /**
   * Get session cookies from AuthService.
   */
  getSessionCookies(): SessionCookie[] {
    return this.authService.getSessionCookies()
  }

  /**
   * Open a RuTracker URL in browser with authenticated session.
   * Useful for viewing torrent details while maintaining login.
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

      console.log(`[BrowserManager] Opening URL with session: ${url}`)

      // Get session cookies from AuthService
      const sessionCookies = this.getSessionCookies()
      console.log(
        `[BrowserManager] Got ${sessionCookies.length} session cookies`
      )

      // Launch a separate browser instance for viewing (not reusing this.browser)
      // This prevents interfering with the search browser instance
      const executablePath = await findChromePath()
      console.log(
        '[BrowserManager] Launching separate browser instance for viewing'
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

      console.log('[BrowserManager] URL opened successfully with session')

      return {
        success: true,
      }
    } catch (error) {
      console.error('[BrowserManager] Failed to open URL:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open URL',
      }
    }
  }
}
