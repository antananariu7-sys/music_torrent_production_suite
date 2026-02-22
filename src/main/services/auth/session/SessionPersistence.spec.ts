import { describe, it, expect, jest, beforeEach } from '@jest/globals'

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn().mockReturnValue('/tmp/test-userdata'),
  },
}))

const mockFs = {
  existsSync: jest.fn<any>(),
  readFileSync: jest.fn<any>(),
  writeFileSync: jest.fn<any>(),
  mkdirSync: jest.fn<any>(),
}

jest.mock('fs', () => mockFs)

import { SessionPersistence, type SessionCookie } from './SessionPersistence'
import type { AuthState } from '@shared/types/auth.types'

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

function makeAuthState(overrides: Partial<AuthState> = {}): AuthState {
  return {
    isLoggedIn: true,
    username: 'testuser',
    sessionExpiry: new Date(Date.now() + 86400000),
    isSessionRestored: false,
    ...overrides,
  } as AuthState
}

describe('SessionPersistence', () => {
  let persistence: SessionPersistence

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
    // Constructor checks existsSync for session dir
    mockFs.existsSync.mockReturnValue(true)
    persistence = new SessionPersistence()
  })

  describe('constructor', () => {
    it('should create session directory if it does not exist', () => {
      mockFs.existsSync.mockReturnValue(false)
      new SessionPersistence()
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('sessions'),
        { recursive: true }
      )
    })

    it('should not create directory if it already exists', () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.mkdirSync.mockClear()
      new SessionPersistence()
      expect(mockFs.mkdirSync).not.toHaveBeenCalled()
    })
  })

  describe('save', () => {
    it('should write session data to file', () => {
      persistence.save(makeAuthState(), [makeCookie()])

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('rutracker-session.json'),
        expect.any(String),
        'utf-8'
      )

      const written = JSON.parse(
        mockFs.writeFileSync.mock.calls[0][1] as string
      )
      expect(written.username).toBe('testuser')
      expect(written.cookies).toHaveLength(1)
    })

    it('should not save when not logged in', () => {
      persistence.save(makeAuthState({ isLoggedIn: false }), [makeCookie()])

      expect(mockFs.writeFileSync).not.toHaveBeenCalled()
    })

    it('should not save when cookies are empty', () => {
      persistence.save(makeAuthState(), [])

      expect(mockFs.writeFileSync).not.toHaveBeenCalled()
    })

    it('should default username to empty string when missing', () => {
      persistence.save(makeAuthState({ username: undefined }), [makeCookie()])

      const written = JSON.parse(
        mockFs.writeFileSync.mock.calls[0][1] as string
      )
      expect(written.username).toBe('')
    })

    it('should handle write failure gracefully', () => {
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Disk full')
      })

      // Should not throw
      expect(() =>
        persistence.save(makeAuthState(), [makeCookie()])
      ).not.toThrow()
    })
  })

  describe('restore', () => {
    it('should return null when no session file exists', () => {
      mockFs.existsSync.mockReturnValue(false)

      const result = persistence.restore()

      expect(result).toBeNull()
    })

    it('should restore valid session', () => {
      const futureExpiry = Date.now() + 86400000
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          cookies: [makeCookie()],
          username: 'testuser',
          sessionExpiry: futureExpiry,
          savedAt: Date.now(),
        })
      )

      const result = persistence.restore()

      expect(result).not.toBeNull()
      expect(result!.username).toBe('testuser')
      expect(result!.cookies).toHaveLength(1)
      expect(result!.sessionExpiry).toBeInstanceOf(Date)
    })

    it('should return null and clear when session has expired', () => {
      const pastExpiry = Date.now() - 1000
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          cookies: [makeCookie()],
          username: 'testuser',
          sessionExpiry: pastExpiry,
          savedAt: Date.now() - 86400000,
        })
      )

      const result = persistence.restore()

      expect(result).toBeNull()
      // clear should have been called (writes empty string)
      expect(mockFs.writeFileSync).toHaveBeenCalled()
    })

    it('should return null and clear on corrupted JSON', () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue('not json{{{')

      const result = persistence.restore()

      expect(result).toBeNull()
    })

    it('should return null on read failure', () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Read error')
      })

      const result = persistence.restore()

      expect(result).toBeNull()
    })
  })

  describe('clear', () => {
    it('should write empty string to session file', () => {
      mockFs.existsSync.mockReturnValue(true)

      persistence.clear()

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('rutracker-session.json'),
        '',
        'utf-8'
      )
    })

    it('should do nothing if file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false)

      persistence.clear()

      expect(mockFs.writeFileSync).not.toHaveBeenCalled()
    })

    it('should handle write failure gracefully', () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('fail')
      })

      expect(() => persistence.clear()).not.toThrow()
    })
  })
})
