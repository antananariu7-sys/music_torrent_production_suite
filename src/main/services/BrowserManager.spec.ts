import { describe, it, expect, beforeEach } from '@jest/globals'

// Declare mock variables before jest.mock (hoisted)
const mockClose = jest.fn()
const mockPage = {
  setViewport: jest.fn(),
  setCookie: jest.fn(),
  goto: jest.fn(),
  close: jest.fn(),
}
const mockBrowserOn = jest.fn()
const mockBrowser = {
  close: mockClose,
  newPage: jest.fn(),
  on: mockBrowserOn,
}
const mockLaunch = jest.fn()

jest.mock('puppeteer-core', () => ({
  __esModule: true,
  default: { launch: mockLaunch },
}))

jest.mock('./utils/browserUtils', () => ({
  findChromePath: jest.fn().mockResolvedValue('/usr/bin/chrome'),
}))

const mockCreatePageWithCookies = jest.fn()
const mockNavigateToUrl = jest.fn()
jest.mock('./rutracker/scrapers/PageScraper', () => ({
  PageScraper: jest.fn().mockImplementation(() => ({
    createPageWithCookies: mockCreatePageWithCookies,
    navigateToUrl: mockNavigateToUrl,
  })),
}))

import { BrowserManager } from './BrowserManager'
import type { AuthService } from './AuthService'

function makeAuthService(loggedIn = true): AuthService {
  return {
    getAuthStatus: () => ({
      isLoggedIn: loggedIn,
      username: loggedIn ? 'testuser' : undefined,
    }),
    getSessionCookies: () =>
      loggedIn
        ? [
            {
              name: 'bb_session',
              value: 'abc123',
              domain: '.rutracker.org',
              path: '/',
              expires: -1,
            },
          ]
        : [],
  } as unknown as AuthService
}

describe('BrowserManager', () => {
  let manager: BrowserManager

  beforeEach(() => {
    jest.clearAllMocks()
    mockLaunch.mockResolvedValue(mockBrowser)
    mockClose.mockResolvedValue(undefined)
    mockBrowser.newPage.mockResolvedValue(mockPage)
    mockCreatePageWithCookies.mockResolvedValue(mockPage)
    mockNavigateToUrl.mockResolvedValue(undefined)
    manager = new BrowserManager(makeAuthService())
  })

  describe('initBrowser', () => {
    it('first call launches a new browser via puppeteer.launch and returns it', async () => {
      const browser = await manager.initBrowser()

      expect(mockLaunch).toHaveBeenCalledTimes(1)
      expect(mockLaunch).toHaveBeenCalledWith(
        expect.objectContaining({
          executablePath: '/usr/bin/chrome',
          args: expect.arrayContaining(['--no-sandbox']),
        })
      )
      expect(browser).toBe(mockBrowser)
    })

    it('second call returns the same browser instance without launching again', async () => {
      const first = await manager.initBrowser()
      const second = await manager.initBrowser()

      expect(mockLaunch).toHaveBeenCalledTimes(1)
      expect(first).toBe(second)
    })
  })

  describe('closeBrowser', () => {
    it('closes the search browser and all viewing browsers', async () => {
      // Initialise the search browser
      await manager.initBrowser()

      // Open two viewing browsers by simulating openUrlWithSession calls
      const mockViewingBrowser1 = {
        close: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
      }
      const mockViewingBrowser2 = {
        close: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
      }
      mockLaunch
        .mockResolvedValueOnce(mockViewingBrowser1)
        .mockResolvedValueOnce(mockViewingBrowser2)

      await manager.openUrlWithSession('https://rutracker.org/1')
      await manager.openUrlWithSession('https://rutracker.org/2')

      await manager.closeBrowser()

      expect(mockClose).toHaveBeenCalledTimes(1) // search browser
      expect(mockViewingBrowser1.close).toHaveBeenCalledTimes(1)
      expect(mockViewingBrowser2.close).toHaveBeenCalledTimes(1)
    })

    it('does not throw when called with no browsers open', async () => {
      await expect(manager.closeBrowser()).resolves.not.toThrow()
    })
  })

  describe('getSessionCookies', () => {
    it('delegates to authService.getSessionCookies and returns cookies', () => {
      const cookies = manager.getSessionCookies()

      expect(cookies).toEqual([
        {
          name: 'bb_session',
          value: 'abc123',
          domain: '.rutracker.org',
          path: '/',
          expires: -1,
        },
      ])
    })

    it('returns empty array when user is not logged in', () => {
      const guestManager = new BrowserManager(makeAuthService(false))
      const cookies = guestManager.getSessionCookies()

      expect(cookies).toEqual([])
    })
  })

  describe('openUrlWithSession', () => {
    it('returns failure when user is not logged in', async () => {
      const guestManager = new BrowserManager(makeAuthService(false))

      const result = await guestManager.openUrlWithSession(
        'https://rutracker.org/forum/viewtopic.php?t=1'
      )

      expect(result).toEqual({
        success: false,
        error: 'User is not logged in. Please login first.',
      })
      expect(mockLaunch).not.toHaveBeenCalled()
    })

    it('launches a headless:false browser, creates page with cookies, navigates, and returns success', async () => {
      const mockViewingBrowser = {
        close: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
      }
      mockLaunch.mockResolvedValueOnce(mockViewingBrowser)

      const result = await manager.openUrlWithSession(
        'https://rutracker.org/forum/viewtopic.php?t=42'
      )

      expect(result).toEqual({ success: true })
      expect(mockLaunch).toHaveBeenCalledWith(
        expect.objectContaining({
          headless: false,
          executablePath: '/usr/bin/chrome',
        })
      )
      expect(mockCreatePageWithCookies).toHaveBeenCalledWith(
        mockViewingBrowser,
        expect.arrayContaining([
          expect.objectContaining({ name: 'bb_session' }),
        ])
      )
      expect(mockNavigateToUrl).toHaveBeenCalledWith(
        mockPage,
        'https://rutracker.org/forum/viewtopic.php?t=42'
      )
    })

    it('closes the oldest viewing browser when MAX_VIEWING_BROWSERS (3) is already reached', async () => {
      const browsers = [
        { close: jest.fn().mockResolvedValue(undefined), on: jest.fn() },
        { close: jest.fn().mockResolvedValue(undefined), on: jest.fn() },
        { close: jest.fn().mockResolvedValue(undefined), on: jest.fn() },
        { close: jest.fn().mockResolvedValue(undefined), on: jest.fn() }, // 4th — triggers eviction
      ]
      mockLaunch
        .mockResolvedValueOnce(browsers[0])
        .mockResolvedValueOnce(browsers[1])
        .mockResolvedValueOnce(browsers[2])
        .mockResolvedValueOnce(browsers[3])

      await manager.openUrlWithSession('https://rutracker.org/1')
      await manager.openUrlWithSession('https://rutracker.org/2')
      await manager.openUrlWithSession('https://rutracker.org/3')
      // At this point 3 viewing browsers are open; the next call must evict the oldest
      await manager.openUrlWithSession('https://rutracker.org/4')

      expect(browsers[0].close).toHaveBeenCalledTimes(1)
      expect(browsers[1].close).not.toHaveBeenCalled()
      expect(browsers[2].close).not.toHaveBeenCalled()
      expect(browsers[3].close).not.toHaveBeenCalled()
    })

    it('returns failure with error message when navigation throws', async () => {
      const mockViewingBrowser = {
        close: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
      }
      mockLaunch.mockResolvedValueOnce(mockViewingBrowser)
      mockNavigateToUrl.mockRejectedValueOnce(
        new Error('net::ERR_CONNECTION_REFUSED')
      )

      const result = await manager.openUrlWithSession(
        'https://rutracker.org/forum/viewtopic.php?t=99'
      )

      expect(result).toEqual({
        success: false,
        error: 'net::ERR_CONNECTION_REFUSED',
      })
    })

    it('returns generic failure message when a non-Error is thrown', async () => {
      const mockViewingBrowser = {
        close: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
      }
      mockLaunch.mockResolvedValueOnce(mockViewingBrowser)
      mockNavigateToUrl.mockRejectedValueOnce('unexpected string rejection')

      const result = await manager.openUrlWithSession(
        'https://rutracker.org/forum/viewtopic.php?t=99'
      )

      expect(result).toEqual({ success: false, error: 'Failed to open URL' })
    })

    it('registers a disconnected listener that removes the browser from the viewing set', async () => {
      let disconnectCallback: (() => void) | undefined
      const mockViewingBrowser = {
        close: jest.fn().mockResolvedValue(undefined),
        on: jest.fn((event: string, cb: () => void) => {
          if (event === 'disconnected') disconnectCallback = cb
        }),
      }
      mockLaunch.mockResolvedValueOnce(mockViewingBrowser)

      await manager.openUrlWithSession(
        'https://rutracker.org/forum/viewtopic.php?t=7'
      )

      expect(mockViewingBrowser.on).toHaveBeenCalledWith(
        'disconnected',
        expect.any(Function)
      )

      // Simulate the browser disconnecting — subsequent closeBrowser should not try to close it again
      disconnectCallback!()
      mockClose.mockClear()
      mockViewingBrowser.close.mockClear()

      await manager.closeBrowser()
      expect(mockViewingBrowser.close).not.toHaveBeenCalled()
    })
  })

  describe('setBrowserOptions', () => {
    it('updates headless option which is reflected in the next initBrowser call', async () => {
      manager.setBrowserOptions({ headless: false })

      await manager.initBrowser()

      expect(mockLaunch).toHaveBeenCalledWith(
        expect.objectContaining({ headless: false })
      )
    })

    it('merges options rather than replacing them entirely', async () => {
      // Default headless derives from env; explicitly set it first so the merge is observable
      manager.setBrowserOptions({ headless: true })
      manager.setBrowserOptions({ headless: false })

      await manager.initBrowser()

      expect(mockLaunch).toHaveBeenCalledWith(
        expect.objectContaining({ headless: false })
      )
    })
  })
})
