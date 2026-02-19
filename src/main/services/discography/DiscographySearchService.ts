import puppeteer, { Browser } from 'puppeteer-core'
import type { AuthService } from '../AuthService'
import type { SearchResult } from '@shared/types/search.types'
import {
  isLikelyDiscography as isLikelyDiscographyUtil,
  filterDiscographyPages as filterDiscographyPagesUtil,
} from '../rutracker/utils/resultGrouper'
import type {
  DiscographySearchRequest,
  DiscographySearchResponse,
  PageContentScanResult,
  DiscographySearchProgress,
} from '@shared/types/discography.types'
import { findChromePath } from '../utils/browserUtils'
import { scanSinglePage } from './PageContentParser'

interface BrowserOptions {
  headless: boolean
}

/**
 * DiscographySearchService
 *
 * Searches within page content for albums that may be part of discographies.
 * Opens multiple pages in parallel to scan for album names.
 */
export class DiscographySearchService {
  private browser: Browser | null = null
  private browserOptions: BrowserOptions

  constructor(
    private authService: AuthService,
    options: Partial<BrowserOptions> = {}
  ) {
    const headless = options.headless ?? (process.env.DEBUG_BROWSER !== 'true')
    this.browserOptions = { headless }
  }

  private async initBrowser(): Promise<Browser> {
    if (this.browser) {
      return this.browser
    }

    const executablePath = findChromePath()
    console.log(`[DiscographySearchService] Launching browser (headless: ${this.browserOptions.headless})`)

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

  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
      console.log('[DiscographySearchService] Browser closed')
    }
  }

  /**
   * Search within multiple pages for an album.
   * Opens pages in parallel (up to maxConcurrent) and scans content for the target album.
   */
  async searchInPages(
    request: DiscographySearchRequest,
    onProgress?: (progress: DiscographySearchProgress) => void
  ): Promise<DiscographySearchResponse> {
    const { searchResults, albumName, artistName, maxConcurrent = 3, pageTimeout = 30000 } = request

    const authState = this.authService.getAuthStatus()
    if (!authState.isLoggedIn) {
      return {
        success: false,
        scanResults: [],
        matchedPages: [],
        totalScanned: 0,
        matchCount: 0,
        error: 'User is not logged in. Please login first.',
      }
    }

    console.log(`[DiscographySearchService] Starting scan of ${searchResults.length} pages for album: "${albumName}"`)

    try {
      const browser = await this.initBrowser()
      const sessionCookies = this.authService.getSessionCookies()

      const scanResults: PageContentScanResult[] = []
      const matchedPages: PageContentScanResult[] = []

      for (let i = 0; i < searchResults.length; i += maxConcurrent) {
        const batch = searchResults.slice(i, i + maxConcurrent)

        if (onProgress) {
          onProgress({
            currentPage: i + 1,
            totalPages: searchResults.length,
            currentUrl: batch[0]?.url || '',
            message: `Scanning pages ${i + 1} to ${Math.min(i + maxConcurrent, searchResults.length)}...`,
          })
        }

        const batchPromises = batch.map((searchResult, batchIndex) =>
          scanSinglePage(browser, sessionCookies, searchResult, albumName, artistName, pageTimeout)
            .then(result => {
              console.log(
                `[DiscographySearchService] Page ${i + batchIndex + 1}/${searchResults.length}: ` +
                `${result.albumFound ? 'FOUND' : 'not found'} in "${result.pageTitle}"`
              )
              return result
            })
        )

        const batchResults = await Promise.all(batchPromises)

        for (const result of batchResults) {
          scanResults.push(result)
          if (result.albumFound) {
            matchedPages.push(result)
          }
        }
      }

      if (this.browserOptions.headless) {
        await this.closeBrowser()
      }

      console.log(`[DiscographySearchService] Scan complete: ${matchedPages.length}/${scanResults.length} pages contain the album`)

      return {
        success: true,
        scanResults,
        matchedPages,
        totalScanned: scanResults.length,
        matchCount: matchedPages.length,
      }
    } catch (error) {
      console.error('[DiscographySearchService] Search failed:', error)
      await this.closeBrowser()

      return {
        success: false,
        scanResults: [],
        matchedPages: [],
        totalScanned: 0,
        matchCount: 0,
        error: error instanceof Error ? error.message : 'Search failed',
      }
    }
  }

  isLikelyDiscography(title: string): boolean {
    return isLikelyDiscographyUtil(title)
  }

  filterDiscographyPages(results: SearchResult[]): SearchResult[] {
    return filterDiscographyPagesUtil(results)
  }
}
