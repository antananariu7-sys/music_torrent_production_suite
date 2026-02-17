import puppeteer, { Browser, Page } from 'puppeteer-core'
import { execSync } from 'child_process'
import { existsSync } from 'fs'
import type { AuthService } from './AuthService'
import type { SearchResult } from '@shared/types/search.types'
import { isLikelyDiscography as isLikelyDiscographyUtil, filterDiscographyPages as filterDiscographyPagesUtil } from './rutracker/utils/resultGrouper'
import type {
  DiscographySearchRequest,
  DiscographySearchResponse,
  PageContentScanResult,
  DiscographyAlbumEntry,
  DiscographySearchProgress,
} from '@shared/types/discography.types'

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

  /**
   * Find Chrome/Chromium executable path
   */
  private findChromePath(): string {
    const possiblePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ]

    for (const path of possiblePaths) {
      if (existsSync(path)) {
        return path
      }
    }

    try {
      const result = execSync('where chrome', { encoding: 'utf-8' })
      const chromePath = result.trim().split('\n')[0]
      if (existsSync(chromePath)) {
        return chromePath
      }
    } catch {
      // Ignore error
    }

    throw new Error('Chrome/Chromium executable not found.')
  }

  /**
   * Initialize browser instance
   */
  private async initBrowser(): Promise<Browser> {
    if (this.browser) {
      return this.browser
    }

    const executablePath = this.findChromePath()
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

  /**
   * Close browser instance
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
      console.log('[DiscographySearchService] Browser closed')
    }
  }

  /**
   * Search within multiple pages for an album
   *
   * Opens pages in parallel and scans content for the target album
   */
  async searchInPages(
    request: DiscographySearchRequest,
    onProgress?: (progress: DiscographySearchProgress) => void
  ): Promise<DiscographySearchResponse> {
    const { searchResults, albumName, artistName, maxConcurrent = 3, pageTimeout = 30000 } = request

    // Check auth status
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

      // Process pages in batches for controlled parallelism
      for (let i = 0; i < searchResults.length; i += maxConcurrent) {
        const batch = searchResults.slice(i, i + maxConcurrent)

        // Report progress
        if (onProgress) {
          onProgress({
            currentPage: i + 1,
            totalPages: searchResults.length,
            currentUrl: batch[0]?.url || '',
            message: `Scanning pages ${i + 1} to ${Math.min(i + maxConcurrent, searchResults.length)}...`,
          })
        }

        // Process batch in parallel
        const batchPromises = batch.map((searchResult, batchIndex) =>
          this.scanSinglePage(
            browser,
            sessionCookies,
            searchResult,
            albumName,
            artistName,
            pageTimeout
          ).then(result => {
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

      // Close browser in headless mode
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

  /**
   * Scan a single page for album content
   */
  private async scanSinglePage(
    browser: Browser,
    sessionCookies: Array<{ name: string; value: string; domain: string; path: string; expires: number }>,
    searchResult: SearchResult,
    albumName: string,
    artistName?: string,
    timeout: number = 30000
  ): Promise<PageContentScanResult> {
    let page: Page | null = null

    try {
      page = await browser.newPage()
      await page.setViewport({ width: 1280, height: 800 })

      // Set session cookies
      if (sessionCookies.length > 0) {
        await page.setCookie(...sessionCookies.map(cookie => ({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          expires: cookie.expires,
        })))
      }

      // Navigate to page
      await page.goto(searchResult.url, {
        waitUntil: 'domcontentloaded', // Faster than networkidle2
        timeout,
      })

      // Wait for content to load
      await page.waitForSelector('.post_body', { timeout: 10000 }).catch(() => {
        // Continue even if post_body not found
      })

      // Parse page content
      const parseResult = await this.parsePageContent(page, albumName, artistName)

      await page.close()

      return {
        searchResult,
        ...parseResult,
      }
    } catch (error) {
      if (page) {
        await page.close().catch(() => {})
      }

      return {
        searchResult,
        albumFound: false,
        matchedAlbums: [],
        allAlbums: [],
        isDiscography: false,
        pageTitle: searchResult.title,
        error: error instanceof Error ? error.message : 'Failed to scan page',
      }
    }
  }

  /**
   * Parse page content for discography album entries
   */
  private async parsePageContent(
    page: Page,
    albumName: string,
    artistName?: string
  ): Promise<Omit<PageContentScanResult, 'searchResult'>> {
    const result = await page.evaluate((albumNameArg: string, artistNameArg?: string) => {
      const allAlbums: Array<{
        title: string
        year?: string
        rawText: string
        duration?: string
        releaseInfo?: string
      }> = []

      // Get page title
      const pageTitle = document.title || 'Unknown'

      // Check if this looks like a discography page
      const bodyText = document.body?.textContent?.toLowerCase() || ''
      const isDiscography = bodyText.includes('discography') ||
                           bodyText.includes('дискография') ||
                           bodyText.includes('studio album') ||
                           bodyText.includes('студийные альбомы')

      // Parse album entries from sp-wrap sections (RuTracker discography format)
      const spWrapSections = document.querySelectorAll('.sp-wrap')

      spWrapSections.forEach((section) => {
        const header = section.querySelector('.sp-head span')
        if (header) {
          const rawText = header.textContent?.trim() || ''

          // Parse album info from header text
          // Format examples:
          // "1967 - The Piper At The Gates Of Dawn (1987, EMI CDP 7 46384 2, UK) (00:41:44)"
          // "1973 - The Dark Side of the Moon (2011, EMI 50999 029444 2 6, EU) (00:43:00)"
          const yearMatch = rawText.match(/^(\d{4})\s*-\s*/)
          const durationMatch = rawText.match(/\((\d{2}:\d{2}:\d{2})\)$/)
          const releaseInfoMatch = rawText.match(/\((\d{4},\s*[^)]+)\)/)

          let title = rawText
          if (yearMatch) {
            title = rawText.substring(yearMatch[0].length)
          }
          // Remove release info and duration from title
          if (releaseInfoMatch) {
            title = title.replace(releaseInfoMatch[0], '').trim()
          }
          if (durationMatch) {
            title = title.replace(durationMatch[0], '').trim()
          }

          allAlbums.push({
            title: title.trim(),
            year: yearMatch ? yearMatch[1] : undefined,
            rawText,
            duration: durationMatch ? durationMatch[1] : undefined,
            releaseInfo: releaseInfoMatch ? releaseInfoMatch[1] : undefined,
          })
        }
      })

      // Also check for album mentions in plain text (for non-structured pages)
      const postBody = document.querySelector('.post_body')
      if (postBody && allAlbums.length === 0) {
        // Try to find album patterns in post body
        const text = postBody.textContent || ''
        const lines = text.split('\n')

        for (const line of lines) {
          const trimmedLine = line.trim()
          // Look for year - album patterns
          const albumPattern = /^(\d{4})\s*[-–]\s*(.+?)(?:\s*\(|$)/
          const match = trimmedLine.match(albumPattern)

          if (match) {
            allAlbums.push({
              title: match[2].trim(),
              year: match[1],
              rawText: trimmedLine,
            })
          }
        }
      }

      // Search for the target album in found albums
      const albumNameLower = albumNameArg.toLowerCase()
      const artistNameLower = artistNameArg?.toLowerCase()

      const matchedAlbums = allAlbums.filter(album => {
        const titleLower = album.title.toLowerCase()
        const rawTextLower = album.rawText.toLowerCase()

        // Check if album name matches
        const albumMatches = titleLower.includes(albumNameLower) ||
                            rawTextLower.includes(albumNameLower)

        // If artist provided, also check artist match in page
        if (artistNameLower && albumMatches) {
          const pageText = document.body?.textContent?.toLowerCase() || ''
          return pageText.includes(artistNameLower)
        }

        return albumMatches
      })

      // Also do a full-text search in page content as fallback
      let albumFoundInText = false
      if (matchedAlbums.length === 0) {
        const fullPageText = document.body?.textContent?.toLowerCase() || ''
        albumFoundInText = fullPageText.includes(albumNameLower)

        // For fallback search, finding the album name is sufficient
        // Artist name check is too strict since MusicBrainz and RuTracker may use different names
        // (e.g., "Федор Чистяков и гр.Ноль" vs "Ноль")
      }

      return {
        allAlbums,
        matchedAlbums,
        albumFound: matchedAlbums.length > 0 || albumFoundInText,
        isDiscography: isDiscography || allAlbums.length > 3,
        pageTitle,
      }
    }, albumName, artistName)

    return {
      albumFound: result.albumFound,
      matchedAlbums: result.matchedAlbums as DiscographyAlbumEntry[],
      allAlbums: result.allAlbums as DiscographyAlbumEntry[],
      isDiscography: result.isDiscography,
      pageTitle: result.pageTitle,
    }
  }

  /**
   * Quick check if a page title suggests it's a discography
   */
  isLikelyDiscography(title: string): boolean {
    return isLikelyDiscographyUtil(title)
  }

  /**
   * Filter search results to find likely discography pages
   */
  filterDiscographyPages(results: SearchResult[]): SearchResult[] {
    return filterDiscographyPagesUtil(results)
  }
}
