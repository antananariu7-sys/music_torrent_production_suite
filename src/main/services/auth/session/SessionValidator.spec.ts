import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals'
import { SessionValidator, type SessionValidatorDeps } from './SessionValidator'
import type { AuthState } from '@shared/types/auth.types'
import type { SessionCookie } from './SessionPersistence'
import type { Browser, Page } from 'puppeteer-core'

function makeMockPage(hasLoginForm = false): Page {
  return {
    goto: jest.fn<any>().mockResolvedValue(undefined),
    setCookie: jest.fn<any>().mockResolvedValue(undefined),
    $: jest.fn<any>().mockResolvedValue(hasLoginForm ? {} : null),
    close: jest.fn<any>().mockResolvedValue(undefined),
  } as unknown as Page
}

function makeMockBrowser(page?: Page): Browser {
  return {
    newPage: jest.fn<any>().mockResolvedValue(page || makeMockPage()),
  } as unknown as Browser
}

function makeDeps(
  overrides: Partial<SessionValidatorDeps> = {}
): SessionValidatorDeps {
  return {
    getAuthState: jest.fn<() => AuthState>().mockReturnValue({
      isLoggedIn: true,
      username: 'testuser',
      sessionExpiry: new Date(Date.now() + 86400000),
      isSessionRestored: false,
    } as AuthState),
    getSessionCookies: jest.fn<() => SessionCookie[]>().mockReturnValue([
      {
        name: 'bb_session',
        value: 'abc',
        domain: '.rutracker.org',
        path: '/',
        expires: Date.now() / 1000 + 86400,
      },
    ]),
    initBrowser: jest
      .fn<() => Promise<Browser>>()
      .mockResolvedValue(makeMockBrowser()),
    onSessionExpired: jest.fn(),
    ...overrides,
  }
}

describe('SessionValidator', () => {
  let validator: SessionValidator
  let deps: SessionValidatorDeps

  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    deps = makeDeps()
    validator = new SessionValidator(deps)
  })

  afterEach(() => {
    validator.stop()
    jest.useRealTimers()
  })

  describe('start / stop', () => {
    it('should create validation interval', () => {
      validator.start()

      // Advance 15 minutes
      jest.advanceTimersByTime(15 * 60 * 1000)

      expect(deps.getAuthState).toHaveBeenCalled()
    })

    it('should skip validation when not logged in', () => {
      ;(deps.getAuthState as jest.Mock).mockReturnValue({
        isLoggedIn: false,
      } as AuthState)

      validator.start()
      jest.advanceTimersByTime(15 * 60 * 1000)

      expect(deps.initBrowser).not.toHaveBeenCalled()
    })

    it('should stop interval on stop()', () => {
      validator.start()
      validator.stop()

      jest.advanceTimersByTime(30 * 60 * 1000)

      // initBrowser should not be called after stop
      expect(deps.initBrowser).not.toHaveBeenCalled()
    })

    it('stop should be safe to call without start', () => {
      expect(() => validator.stop()).not.toThrow()
    })
  })

  describe('validate', () => {
    it('should return true when session is valid (no login form)', async () => {
      const mockPage = makeMockPage(false)
      const mockBrowser = makeMockBrowser(mockPage)
      ;(deps.initBrowser as jest.Mock).mockResolvedValue(mockBrowser)

      const result = await validator.validate()

      expect(result).toBe(true)
      expect(mockPage.goto).toHaveBeenCalledTimes(2)
      expect(mockPage.setCookie).toHaveBeenCalled()
      expect(mockPage.close).toHaveBeenCalled()
    })

    it('should return false and call onSessionExpired when login form found', async () => {
      const mockPage = makeMockPage(true)
      const mockBrowser = makeMockBrowser(mockPage)
      ;(deps.initBrowser as jest.Mock).mockResolvedValue(mockBrowser)

      const result = await validator.validate()

      expect(result).toBe(false)
      expect(deps.onSessionExpired).toHaveBeenCalled()
      expect(mockPage.close).toHaveBeenCalled()
    })

    it('should return false when not logged in', async () => {
      ;(deps.getAuthState as jest.Mock).mockReturnValue({
        isLoggedIn: false,
      } as AuthState)

      const result = await validator.validate()

      expect(result).toBe(false)
      expect(deps.initBrowser).not.toHaveBeenCalled()
    })

    it('should return false when no cookies', async () => {
      ;(deps.getSessionCookies as jest.Mock).mockReturnValue([])

      const result = await validator.validate()

      expect(result).toBe(false)
      expect(deps.initBrowser).not.toHaveBeenCalled()
    })

    it('should return false on network error and close page', async () => {
      const mockPage = makeMockPage()
      ;(mockPage.goto as jest.Mock).mockRejectedValue(new Error('Timeout'))
      const mockBrowser = makeMockBrowser(mockPage)
      ;(deps.initBrowser as jest.Mock).mockResolvedValue(mockBrowser)

      const result = await validator.validate()

      expect(result).toBe(false)
      expect(mockPage.close).toHaveBeenCalled()
    })

    it('should handle page close failure gracefully', async () => {
      const mockPage = makeMockPage()
      ;(mockPage.goto as jest.Mock).mockRejectedValue(new Error('fail'))
      ;(mockPage.close as jest.Mock).mockRejectedValue(
        new Error('close failed')
      )
      const mockBrowser = makeMockBrowser(mockPage)
      ;(deps.initBrowser as jest.Mock).mockResolvedValue(mockBrowser)

      // Should not throw
      const result = await validator.validate()
      expect(result).toBe(false)
    })
  })
})
