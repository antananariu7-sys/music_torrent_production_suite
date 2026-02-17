import type { Browser, Page } from 'puppeteer-core'
import { RUTRACKER_BASE_URL } from '../utils/urlBuilder'

/**
 * Session cookie for RuTracker
 */
export interface SessionCookie {
  name: string
  value: string
  domain: string
  path: string
  expires?: number
}

/**
 * PageScraper
 *
 * Handles Puppeteer page setup, cookie restoration, and navigation
 */
export class PageScraper {
  /**
   * Create a new page with viewport and cookies
   *
   * @param browser - Puppeteer browser instance
   * @param sessionCookies - Session cookies to restore
   * @returns Configured page with cookies
   */
  async createPageWithCookies(browser: Browser, sessionCookies: SessionCookie[]): Promise<Page> {
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 800 })

    // Navigate to RuTracker to set cookies
    console.log('[PageScraper] Navigating to RuTracker homepage to set cookies')
    await page.goto(RUTRACKER_BASE_URL, {
      waitUntil: 'domcontentloaded', // Faster than networkidle2
      timeout: 45000, // Increased timeout
    })

    // Restore session cookies
    if (sessionCookies.length > 0) {
      console.log('[PageScraper] Restoring session cookies')
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

  /**
   * Navigate to search URL and wait for results
   *
   * @param page - Puppeteer page
   * @param searchUrl - RuTracker search URL
   * @returns Promise that resolves when results are loaded
   */
  async navigateToSearchUrl(page: Page, searchUrl: string): Promise<void> {
    console.log(`[PageScraper] Navigating to ${searchUrl}`)

    await page.goto(searchUrl, {
      waitUntil: 'domcontentloaded', // Faster and more reliable than networkidle2
      timeout: 45000, // Increased timeout for slower networks
    })

    // Wait for results table to load (using correct ID: tor-tbl)
    console.log('[PageScraper] Waiting for results table to appear')
    await page.waitForSelector('#tor-tbl', { visible: true, timeout: 15000 })

    // Wait a bit for results to fully render
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  /**
   * Navigate to any RuTracker URL and wait for page load
   *
   * @param page - Puppeteer page
   * @param url - RuTracker URL
   * @returns Promise that resolves when page is loaded
   */
  async navigateToUrl(page: Page, url: string): Promise<void> {
    console.log(`[PageScraper] Navigating to: ${url}`)
    await page.goto(url, {
      waitUntil: 'domcontentloaded', // Faster and more reliable
      timeout: 45000, // Increased timeout for slower networks
    })
  }
}
