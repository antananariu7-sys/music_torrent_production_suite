import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'

// Mock electron before importing the service
jest.mock('electron', () => ({
  shell: {
    openExternal: jest.fn().mockResolvedValue(undefined as never),
    openPath: jest.fn().mockResolvedValue('' as never),
  },
}))

// Mock fs to control file I/O
const mockFs = {
  existsSync: jest.fn().mockReturnValue(false),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn().mockReturnValue('[]'),
  writeFileSync: jest.fn(),
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

import { TorrentDownloadService } from './TorrentDownloadService'
import { shell } from 'electron'
import type { AuthService } from './AuthService'
import type { TorrentFile } from '@shared/types/torrent.types'

// Mock AuthService following existing pattern from RuTrackerSearchService.spec.ts
function makeMockAuthService(overrides: Partial<AuthService> = {}): AuthService {
  return {
    getAuthStatus: jest.fn().mockReturnValue({ isLoggedIn: true, username: 'testuser' }),
    getSessionCookies: jest.fn().mockReturnValue([]),
    login: jest.fn(),
    logout: jest.fn(),
    cleanup: jest.fn(),
    getDebugInfo: jest.fn(),
    getStoredCredentials: jest.fn(),
    clearStoredCredentials: jest.fn(),
    isRestoredSession: jest.fn().mockReturnValue(false),
    ...overrides,
  } as unknown as AuthService
}

describe('TorrentDownloadService', () => {
  let service: TorrentDownloadService
  let mockAuthService: AuthService

  beforeEach(() => {
    jest.clearAllMocks()
    mockFs.existsSync.mockReturnValue(false)
    mockFs.readFileSync.mockReturnValue('[]')
    process.env.USERPROFILE = '/tmp/test-home'

    mockAuthService = makeMockAuthService()
    service = new TorrentDownloadService(mockAuthService)
  })

  afterEach(async () => {
    await service.closeBrowser()
  })

  // =========================================
  // constructor
  // =========================================

  describe('constructor', () => {
    it('should initialize with default settings', () => {
      const settings = service.getSettings()

      expect(settings.torrentsFolder).toContain('Torrents')
      expect(settings.autoOpen).toBe(false)
      expect(settings.keepHistory).toBe(true)
      expect(settings.preferMagnetLinks).toBe(true)
    })

    it('should merge provided settings with defaults', () => {
      const customService = new TorrentDownloadService(mockAuthService, {
        autoOpen: true,
        preferMagnetLinks: false,
      })

      const settings = customService.getSettings()

      expect(settings.autoOpen).toBe(true)
      expect(settings.preferMagnetLinks).toBe(false)
      // Defaults still apply for non-overridden fields
      expect(settings.keepHistory).toBe(true)
    })

    it('should create torrents folder if it does not exist', () => {
      mockFs.existsSync.mockReturnValue(false)

      new TorrentDownloadService(mockAuthService)

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('Torrents'),
        { recursive: true }
      )
    })

    it('should use provided torrentsFolder path', () => {
      const customService = new TorrentDownloadService(mockAuthService, {
        torrentsFolder: '/custom/torrents/path',
      })

      expect(customService.getSettings().torrentsFolder).toBe('/custom/torrents/path')
    })
  })

  // =========================================
  // getSettings() / updateSettings()
  // =========================================

  describe('getSettings', () => {
    it('should return current settings', () => {
      const settings = service.getSettings()

      expect(settings).toHaveProperty('torrentsFolder')
      expect(settings).toHaveProperty('autoOpen')
      expect(settings).toHaveProperty('keepHistory')
      expect(settings).toHaveProperty('preferMagnetLinks')
    })

    it('should return copy of settings (not reference)', () => {
      const a = service.getSettings()
      const b = service.getSettings()

      expect(a).toEqual(b)
      expect(a).not.toBe(b)
    })
  })

  describe('updateSettings', () => {
    it('should merge partial settings updates', () => {
      service.updateSettings({ autoOpen: true })

      const settings = service.getSettings()

      expect(settings.autoOpen).toBe(true)
      // Other settings unchanged
      expect(settings.keepHistory).toBe(true)
      expect(settings.preferMagnetLinks).toBe(true)
    })

    it('should ensure folder exists when torrentsFolder changes', () => {
      mockFs.mkdirSync.mockClear()
      mockFs.existsSync.mockReturnValue(false)

      service.updateSettings({ torrentsFolder: '/new/path' })

      expect(mockFs.mkdirSync).toHaveBeenCalledWith('/new/path', { recursive: true })
    })

    it('should not create folder for non-folder setting changes', () => {
      mockFs.mkdirSync.mockClear()

      service.updateSettings({ autoOpen: true })

      expect(mockFs.mkdirSync).not.toHaveBeenCalled()
    })
  })

  // =========================================
  // getHistory() / clearHistory()
  // =========================================

  describe('getHistory', () => {
    it('should return empty array when no history exists', () => {
      mockFs.existsSync.mockReturnValue(false)

      const history = service.getHistory()

      expect(history).toEqual([])
    })

    it('should load history from project-specific path when provided', () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(JSON.stringify([
        {
          id: '123',
          title: 'Test Torrent',
          pageUrl: 'https://example.com',
          downloadedAt: '2024-06-15T12:00:00.000Z',
        },
      ]))

      const history = service.getHistory('/project/dir')

      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.download-history.json'),
        'utf-8'
      )
      expect(history).toHaveLength(1)
      expect(history[0].title).toBe('Test Torrent')
    })

    it('should deserialize date strings back to Date objects', () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(JSON.stringify([
        {
          id: '123',
          title: 'Test',
          pageUrl: 'https://example.com',
          downloadedAt: '2024-06-15T12:00:00.000Z',
        },
      ]))

      const history = service.getHistory()

      expect(history[0].downloadedAt).toBeInstanceOf(Date)
      expect(history[0].downloadedAt.toISOString()).toBe('2024-06-15T12:00:00.000Z')
    })

    it('should handle corrupt JSON gracefully', () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue('not-valid-json{{{')

      const history = service.getHistory()

      expect(history).toEqual([])
    })
  })

  describe('clearHistory', () => {
    it('should reset history to empty array', () => {
      // First load some history
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(JSON.stringify([
        { id: '1', title: 'T1', pageUrl: 'url', downloadedAt: new Date().toISOString() },
      ]))
      service.getHistory()

      service.clearHistory()

      // After clearHistory, getHistory re-reads from disk, so mock the file to return empty
      mockFs.readFileSync.mockReturnValue('[]')

      expect(service.getHistory()).toEqual([])
    })

    it('should save empty array to disk', () => {
      mockFs.writeFileSync.mockClear()

      service.clearHistory()

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.download-history.json'),
        '[]'
      )
    })

    it('should clear project-specific history when projectDirectory provided', () => {
      mockFs.writeFileSync.mockClear()

      service.clearHistory('/my/project')

      // The path should contain the project directory
      const writePath = (mockFs.writeFileSync as jest.Mock<any>).mock.calls[0][0] as string
      expect(writePath).toContain('my')
    })
  })

  // =========================================
  // loadHistory (skip keepHistory=false)
  // =========================================

  describe('loadHistory', () => {
    it('should skip loading when keepHistory is false', () => {
      const noHistoryService = new TorrentDownloadService(mockAuthService, {
        keepHistory: false,
      })
      mockFs.readFileSync.mockClear()

      noHistoryService.getHistory()

      // readFileSync should not be called for history when keepHistory is false
      // Note: it may be called by constructor for initial load, but getHistory
      // should not trigger another read
      expect(mockFs.readFileSync).not.toHaveBeenCalled()
    })
  })

  // =========================================
  // openInTorrentClient()
  // =========================================

  describe('openInTorrentClient', () => {
    it('should open magnet link via shell.openExternal when available', async () => {
      const torrent: TorrentFile = {
        id: '1',
        title: 'Test',
        magnetLink: 'magnet:?xt=urn:btih:abc123',
        pageUrl: 'https://example.com',
        downloadedAt: new Date(),
      }

      const result = await service.openInTorrentClient(torrent)

      expect(result.success).toBe(true)
      expect(shell.openExternal).toHaveBeenCalledWith('magnet:?xt=urn:btih:abc123')
    })

    it('should fallback to shell.openPath for .torrent file', async () => {
      mockFs.existsSync.mockReturnValue(true)

      const torrent: TorrentFile = {
        id: '1',
        title: 'Test',
        filePath: '/path/to/file.torrent',
        pageUrl: 'https://example.com',
        downloadedAt: new Date(),
      }

      const result = await service.openInTorrentClient(torrent)

      expect(result.success).toBe(true)
      expect(shell.openPath).toHaveBeenCalledWith('/path/to/file.torrent')
    })

    it('should prefer magnet link over .torrent file when both present', async () => {
      mockFs.existsSync.mockReturnValue(true)

      const torrent: TorrentFile = {
        id: '1',
        title: 'Test',
        magnetLink: 'magnet:?xt=urn:btih:abc123',
        filePath: '/path/to/file.torrent',
        pageUrl: 'https://example.com',
        downloadedAt: new Date(),
      }

      const result = await service.openInTorrentClient(torrent)

      expect(result.success).toBe(true)
      expect(shell.openExternal).toHaveBeenCalled()
      expect(shell.openPath).not.toHaveBeenCalled()
    })

    it('should return error when neither magnet nor file available', async () => {
      const torrent: TorrentFile = {
        id: '1',
        title: 'Test',
        pageUrl: 'https://example.com',
        downloadedAt: new Date(),
      }

      const result = await service.openInTorrentClient(torrent)

      expect(result.success).toBe(false)
      expect(result.error).toContain('No magnet link or torrent file')
    })

    it('should handle shell.openExternal errors gracefully', async () => {
      (shell.openExternal as jest.Mock<any>).mockRejectedValue(new Error('Shell error'))

      const torrent: TorrentFile = {
        id: '1',
        title: 'Test',
        magnetLink: 'magnet:?xt=urn:btih:abc123',
        pageUrl: 'https://example.com',
        downloadedAt: new Date(),
      }

      const result = await service.openInTorrentClient(torrent)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Shell error')
    })

    it('should return error when .torrent file does not exist on disk', async () => {
      mockFs.existsSync.mockReturnValue(false)

      const torrent: TorrentFile = {
        id: '1',
        title: 'Test',
        filePath: '/path/to/missing.torrent',
        pageUrl: 'https://example.com',
        downloadedAt: new Date(),
      }

      const result = await service.openInTorrentClient(torrent)

      expect(result.success).toBe(false)
      expect(result.error).toContain('No magnet link or torrent file')
    })
  })
})
