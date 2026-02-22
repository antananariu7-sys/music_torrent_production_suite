import { describe, it, expect, jest, beforeEach } from '@jest/globals'

jest.mock('../utils/urlBuilder', () => ({
  RUTRACKER_BASE_URL: 'https://rutracker.org/forum/',
}))

import { PageScraper, type SessionCookie } from './PageScraper'
import type { Browser, Page } from 'puppeteer-core'

function makeMockPage(): Page {
  return {
    setViewport: jest.fn<any>().mockResolvedValue(undefined),
    goto: jest.fn<any>().mockResolvedValue(undefined),
    setCookie: jest.fn<any>().mockResolvedValue(undefined),
    waitForSelector: jest.fn<any>().mockResolvedValue(undefined),
  } as unknown as Page
}

function makeMockBrowser(page?: Page): Browser {
  return {
    newPage: jest.fn<any>().mockResolvedValue(page || makeMockPage()),
  } as unknown as Browser
}

function makeCookie(overrides: Partial<SessionCookie> = {}): SessionCookie {
  return {
    name: 'bb_session',
    value: 'abc123',
    domain: '.rutracker.org',
    path: '/',
    expires: Date.now() / 1000 + 86400,
    ...overrides,
  }
}

describe('PageScraper', () => {
  let scraper: PageScraper

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'log').mockImplementation(() => {})
    scraper = new PageScraper()
  })

  describe('createPageWithCookies', () => {
    it('should create page, set viewport, navigate, and restore cookies', async () => {
      const mockPage = makeMockPage()
      const browser = makeMockBrowser(mockPage)
      const cookies = [makeCookie()]

      const page = await scraper.createPageWithCookies(browser, cookies)

      expect(page).toBe(mockPage)
      expect(mockPage.setViewport).toHaveBeenCalledWith({
        width: 1280,
        height: 800,
      })
      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://rutracker.org/forum/',
        {
          waitUntil: 'domcontentloaded',
          timeout: 45000,
        }
      )
      expect(mockPage.setCookie).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'bb_session', value: 'abc123' })
      )
    })

    it('should skip setCookie when no cookies provided', async () => {
      const mockPage = makeMockPage()
      const browser = makeMockBrowser(mockPage)

      await scraper.createPageWithCookies(browser, [])

      expect(mockPage.setCookie).not.toHaveBeenCalled()
    })

    it('should set multiple cookies', async () => {
      const mockPage = makeMockPage()
      const browser = makeMockBrowser(mockPage)
      const cookies = [
        makeCookie({ name: 'cookie1', value: 'val1' }),
        makeCookie({ name: 'cookie2', value: 'val2' }),
      ]

      await scraper.createPageWithCookies(browser, cookies)

      expect(mockPage.setCookie).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'cookie1' }),
        expect.objectContaining({ name: 'cookie2' })
      )
    })
  })

  describe('navigateToSearchUrl', () => {
    it('should navigate and wait for results table', async () => {
      const mockPage = makeMockPage()

      await scraper.navigateToSearchUrl(
        mockPage,
        'https://rutracker.org/search?q=test'
      )

      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://rutracker.org/search?q=test',
        {
          waitUntil: 'domcontentloaded',
          timeout: 45000,
        }
      )
      expect(mockPage.waitForSelector).toHaveBeenCalledWith('#tor-tbl', {
        visible: true,
        timeout: 15000,
      })
    })
  })

  describe('navigateToUrl', () => {
    it('should navigate to any URL', async () => {
      const mockPage = makeMockPage()

      await scraper.navigateToUrl(
        mockPage,
        'https://rutracker.org/forum/viewtopic.php?t=123'
      )

      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://rutracker.org/forum/viewtopic.php?t=123',
        { waitUntil: 'domcontentloaded', timeout: 45000 }
      )
    })
  })
})
