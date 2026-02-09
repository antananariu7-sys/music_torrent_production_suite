import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'

// Mock electron before importing the service
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn().mockReturnValue('/tmp/test-auth'),
  },
}))

// Mock fs to control session file I/O
const mockFs = {
  existsSync: jest.fn().mockReturnValue(false),
  readFileSync: jest.fn().mockReturnValue(''),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}
jest.mock('fs', () => mockFs)

// Mock puppeteer-core to prevent real browser launch
jest.mock('puppeteer-core', () => ({
  default: { launch: jest.fn() },
  __esModule: true,
}))

// Mock child_process to prevent execSync calls
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}))

import { AuthService } from './AuthService'

describe('AuthService', () => {
  let service: AuthService

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    mockFs.existsSync.mockReturnValue(false)
    mockFs.readFileSync.mockReturnValue('')
    service = new AuthService()
  })

  afterEach(async () => {
    await service.cleanup()
    jest.useRealTimers()
  })

  // =========================================
  // getAuthStatus()
  // =========================================

  describe('getAuthStatus', () => {
    it('should return isLoggedIn: false initially', () => {
      const status = service.getAuthStatus()

      expect(status.isLoggedIn).toBe(false)
      expect(status.username).toBeUndefined()
      expect(status.sessionExpiry).toBeUndefined()
    })

    it('should return a copy of auth state (not reference)', () => {
      const a = service.getAuthStatus()
      const b = service.getAuthStatus()

      expect(a).toEqual(b)
      expect(a).not.toBe(b)
    })

    it('should return isLoggedIn: true when session is valid (restored)', () => {
      const futureExpiry = Date.now() + 24 * 60 * 60 * 1000 // 24h from now
      const sessionData = JSON.stringify({
        cookies: [{ name: 'bb_session', value: 'xyz', domain: '.rutracker.org', path: '/', expires: futureExpiry / 1000 }],
        username: 'testuser',
        sessionExpiry: futureExpiry,
        savedAt: Date.now(),
      })

      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(sessionData)

      const restoredService = new AuthService()
      const status = restoredService.getAuthStatus()

      expect(status.isLoggedIn).toBe(true)
      expect(status.username).toBe('testuser')

      restoredService.cleanup()
    })

    it('should clear auth state when session expires on check', () => {
      // Restore a session that is about to expire
      const soonExpiry = Date.now() + 1000 // expires in 1 second
      const sessionData = JSON.stringify({
        cookies: [{ name: 'bb_session', value: 'xyz', domain: '.rutracker.org', path: '/', expires: soonExpiry / 1000 }],
        username: 'testuser',
        sessionExpiry: soonExpiry,
        savedAt: Date.now(),
      })

      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(sessionData)

      const restoredService = new AuthService()
      expect(restoredService.getAuthStatus().isLoggedIn).toBe(true)

      // Advance time past expiry
      jest.advanceTimersByTime(2000)

      const status = restoredService.getAuthStatus()
      expect(status.isLoggedIn).toBe(false)
      expect(status.username).toBeUndefined()

      restoredService.cleanup()
    })
  })

  // =========================================
  // logout()
  // =========================================

  describe('logout', () => {
    it('should reset authState to logged-out state', async () => {
      // First restore a valid session
      const futureExpiry = Date.now() + 24 * 60 * 60 * 1000
      const sessionData = JSON.stringify({
        cookies: [{ name: 'bb_session', value: 'xyz', domain: '.rutracker.org', path: '/', expires: futureExpiry / 1000 }],
        username: 'testuser',
        sessionExpiry: futureExpiry,
        savedAt: Date.now(),
      })

      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(sessionData)

      const logoutService = new AuthService()
      expect(logoutService.getAuthStatus().isLoggedIn).toBe(true)

      await logoutService.logout()

      const status = logoutService.getAuthStatus()
      expect(status.isLoggedIn).toBe(false)
      expect(status.username).toBeUndefined()
      expect(status.sessionExpiry).toBeUndefined()

      logoutService.cleanup()
    })

    it('should clear session cookies', async () => {
      const futureExpiry = Date.now() + 24 * 60 * 60 * 1000
      const sessionData = JSON.stringify({
        cookies: [{ name: 'bb_session', value: 'xyz', domain: '.rutracker.org', path: '/', expires: futureExpiry / 1000 }],
        username: 'testuser',
        sessionExpiry: futureExpiry,
        savedAt: Date.now(),
      })

      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(sessionData)

      const logoutService = new AuthService()
      expect(logoutService.getSessionCookies()).toHaveLength(1)

      await logoutService.logout()

      expect(logoutService.getSessionCookies()).toHaveLength(0)

      logoutService.cleanup()
    })

    it('should clear isSessionRestored flag', async () => {
      const futureExpiry = Date.now() + 24 * 60 * 60 * 1000
      const sessionData = JSON.stringify({
        cookies: [{ name: 'bb_session', value: 'xyz', domain: '.rutracker.org', path: '/', expires: futureExpiry / 1000 }],
        username: 'testuser',
        sessionExpiry: futureExpiry,
        savedAt: Date.now(),
      })

      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(sessionData)

      const logoutService = new AuthService()
      expect(logoutService.isRestoredSession()).toBe(true)

      await logoutService.logout()

      expect(logoutService.isRestoredSession()).toBe(false)

      logoutService.cleanup()
    })

    it('should clear saved session file', async () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.writeFileSync.mockClear()

      await service.logout()

      // Should write empty string to session file
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('rutracker-session.json'),
        '',
        'utf-8'
      )
    })
  })

  // =========================================
  // getStoredCredentials() / clearStoredCredentials()
  // =========================================

  describe('getStoredCredentials', () => {
    it('should return object with undefined username initially', () => {
      const creds = service.getStoredCredentials()

      expect(creds.username).toBeUndefined()
    })

    it('should return a copy (not reference)', () => {
      const a = service.getStoredCredentials()
      const b = service.getStoredCredentials()

      expect(a).toEqual(b)
      expect(a).not.toBe(b)
    })
  })

  describe('clearStoredCredentials', () => {
    it('should reset stored credentials to empty', () => {
      service.clearStoredCredentials()

      const creds = service.getStoredCredentials()

      expect(creds.username).toBeUndefined()
    })
  })

  // =========================================
  // getSessionCookies()
  // =========================================

  describe('getSessionCookies', () => {
    it('should return empty array initially', () => {
      expect(service.getSessionCookies()).toEqual([])
    })

    it('should return a copy of cookies array', () => {
      const a = service.getSessionCookies()
      const b = service.getSessionCookies()

      expect(a).toEqual(b)
      expect(a).not.toBe(b)
    })
  })

  // =========================================
  // isRestoredSession()
  // =========================================

  describe('isRestoredSession', () => {
    it('should return false initially', () => {
      expect(service.isRestoredSession()).toBe(false)
    })

    it('should return true after successful restore', () => {
      const futureExpiry = Date.now() + 24 * 60 * 60 * 1000
      const sessionData = JSON.stringify({
        cookies: [{ name: 'bb_session', value: 'xyz', domain: '.rutracker.org', path: '/', expires: futureExpiry / 1000 }],
        username: 'testuser',
        sessionExpiry: futureExpiry,
        savedAt: Date.now(),
      })

      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(sessionData)

      const restoredService = new AuthService()

      expect(restoredService.isRestoredSession()).toBe(true)

      restoredService.cleanup()
    })
  })

  // =========================================
  // getDebugInfo()
  // =========================================

  describe('getDebugInfo', () => {
    it('should return cookie count and cookies array', () => {
      const info = service.getDebugInfo()

      expect(info.cookieCount).toBe(0)
      expect(info.cookies).toEqual([])
    })

    it('should return a copy of cookies', () => {
      const a = service.getDebugInfo()
      const b = service.getDebugInfo()

      expect(a.cookies).toEqual(b.cookies)
      expect(a.cookies).not.toBe(b.cookies)
    })
  })

  // =========================================
  // restoreSession (via constructor)
  // =========================================

  describe('restoreSession (via constructor)', () => {
    it('should restore valid session from file', () => {
      const futureExpiry = Date.now() + 24 * 60 * 60 * 1000
      const sessionData = JSON.stringify({
        cookies: [
          { name: 'bb_session', value: 'abc', domain: '.rutracker.org', path: '/', expires: futureExpiry / 1000 },
          { name: 'bb_data', value: 'def', domain: '.rutracker.org', path: '/', expires: futureExpiry / 1000 },
        ],
        username: 'restoreduser',
        sessionExpiry: futureExpiry,
        savedAt: Date.now(),
      })

      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(sessionData)

      const restoredService = new AuthService()

      expect(restoredService.getAuthStatus().isLoggedIn).toBe(true)
      expect(restoredService.getAuthStatus().username).toBe('restoreduser')
      expect(restoredService.getSessionCookies()).toHaveLength(2)

      restoredService.cleanup()
    })

    it('should not restore expired session', () => {
      const pastExpiry = Date.now() - 1000 // already expired
      const sessionData = JSON.stringify({
        cookies: [{ name: 'bb_session', value: 'xyz', domain: '.rutracker.org', path: '/', expires: pastExpiry / 1000 }],
        username: 'expireduser',
        sessionExpiry: pastExpiry,
        savedAt: Date.now() - 25 * 60 * 60 * 1000,
      })

      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(sessionData)

      const restoredService = new AuthService()

      expect(restoredService.getAuthStatus().isLoggedIn).toBe(false)
      expect(restoredService.isRestoredSession()).toBe(false)

      restoredService.cleanup()
    })

    it('should handle corrupt session file gracefully', () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue('not-valid-json{{{')

      // Should not throw
      const restoredService = new AuthService()

      expect(restoredService.getAuthStatus().isLoggedIn).toBe(false)

      restoredService.cleanup()
    })

    it('should set isSessionRestored flag when restored', () => {
      const futureExpiry = Date.now() + 24 * 60 * 60 * 1000
      const sessionData = JSON.stringify({
        cookies: [{ name: 'bb_session', value: 'xyz', domain: '.rutracker.org', path: '/', expires: futureExpiry / 1000 }],
        username: 'testuser',
        sessionExpiry: futureExpiry,
        savedAt: Date.now(),
      })

      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(sessionData)

      const restoredService = new AuthService()

      expect(restoredService.isRestoredSession()).toBe(true)
      expect(restoredService.getAuthStatus().isSessionRestored).toBe(true)

      restoredService.cleanup()
    })

    it('should not set isSessionRestored when no session file exists', () => {
      mockFs.existsSync.mockReturnValue(false)

      const freshService = new AuthService()

      expect(freshService.isRestoredSession()).toBe(false)

      freshService.cleanup()
    })
  })

  // =========================================
  // cleanup()
  // =========================================

  describe('cleanup', () => {
    it('should clear validation interval', async () => {
      // The constructor starts a validation interval
      await service.cleanup()

      // Advancing timers should not trigger validation
      // (No error thrown means interval was cleared)
      jest.advanceTimersByTime(10 * 60 * 1000)
    })
  })
})
