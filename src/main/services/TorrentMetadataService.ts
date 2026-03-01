import puppeteer, { Browser } from 'puppeteer-core'
import type { AuthService } from './AuthService'
import type {
  TorrentMetadataRequest,
  TorrentMetadataResponse,
  TorrentPageMetadata,
} from '@shared/types/torrentMetadata.types'
import { parseAlbumsFromHtml } from './rutracker/utils/torrentPageParser'
import { findChromePath } from './utils/browserUtils'

interface BrowserOptions {
  headless: boolean
}

/**
 * TorrentMetadataService
 *
 * Fetches and parses torrent page HTML to extract track listings and metadata.
 * Uses Puppeteer to navigate authenticated pages, delegates parsing to pure functions.
 */
export class TorrentMetadataService {
  private browser: Browser | null = null
  private browserOptions: BrowserOptions
  private cache = new Map<string, TorrentPageMetadata>()

  constructor(
    private authService: AuthService,
    options: Partial<BrowserOptions> = {}
  ) {
    const headless = options.headless ?? process.env.DEBUG_BROWSER !== 'true'
    this.browserOptions = { headless }
  }

  /**
   * Initialize browser instance (lazy)
   */
  private async initBrowser(): Promise<Browser> {
    if (this.browser) {
      return this.browser
    }

    const executablePath = await findChromePath()
    console.log(
      `[TorrentMetadataService] Launching browser (headless: ${this.browserOptions.headless})`
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
   * Close browser instance
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
      console.log('[TorrentMetadataService] Browser closed')
    }
  }

  /**
   * Parse metadata from a torrent page
   */
  async parseMetadata(
    request: TorrentMetadataRequest
  ): Promise<TorrentMetadataResponse> {
    const { torrentUrl, torrentId } = request

    // Check cache first
    const cached = this.cache.get(torrentId)
    if (cached) {
      console.log(`[TorrentMetadataService] Cache hit for torrent ${torrentId}`)
      return { success: true, metadata: cached }
    }

    // Check auth
    const authState = this.authService.getAuthStatus()
    if (!authState.isLoggedIn) {
      return {
        success: false,
        error: 'User is not logged in. Please login first.',
      }
    }

    console.log(`[TorrentMetadataService] Parsing metadata for: ${torrentUrl}`)

    let page = null
    try {
      const browser = await this.initBrowser()
      const sessionCookies = this.authService.getSessionCookies()

      page = await browser.newPage()

      // Set cookies for authentication
      if (sessionCookies.length > 0) {
        await page.setCookie(...sessionCookies)
      }

      await page.goto(torrentUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })

      // Wait for the post body to be present
      await page.waitForSelector('.post_body', { timeout: 10000 })

      // Extract magnet link while on the page (for stream preview)
      let magnetLink: string | undefined
      try {
        const magnetSelector = 'a.magnet-link[href^="magnet:"]'
        await page.waitForSelector(magnetSelector, { timeout: 5000 })
        magnetLink =
          (await page.$eval(
            magnetSelector,
            (el) => (el as HTMLAnchorElement).href
          )) || undefined
      } catch {
        console.log(
          `[TorrentMetadataService] No magnet link found on page ${torrentId}`
        )
      }

      // Extract page HTML
      const html = await page.content()

      // Parse using pure function
      const metadata = parseAlbumsFromHtml(html)
      metadata.magnetLink = magnetLink

      // Cache result
      this.cache.set(torrentId, metadata)

      console.log(
        `[TorrentMetadataService] Parsed ${metadata.albums.length} albums from torrent ${torrentId}`
      )
      return { success: true, metadata }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(
        `[TorrentMetadataService] Failed to parse metadata:`,
        message
      )
      return { success: false, error: message }
    } finally {
      if (page) {
        await page.close().catch(() => {})
      }
    }
  }

  /**
   * Clear metadata cache
   */
  clearCache(): void {
    this.cache.clear()
  }
}
