import { describe, it, expect, beforeEach, jest } from '@jest/globals'

const mockPage = {
  goto: jest.fn(),
  setCookie: jest.fn(),
  waitForSelector: jest.fn(),
  $eval: jest.fn(),
  content: jest.fn(),
  close: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}

const mockBrowser = {
  newPage: jest.fn(),
  close: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}

jest.mock('puppeteer-core', () => ({
  launch: jest.fn(),
}))
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}))
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
}))
jest.mock('./rutracker/utils/torrentPageParser', () => ({
  parseAlbumsFromHtml: jest.fn().mockReturnValue({
    albums: [{ title: 'Test Album', tracks: [] }],
  }),
}))

import puppeteer from 'puppeteer-core'
import { TorrentMetadataService } from './TorrentMetadataService'
import type { AuthService } from './AuthService'

const mockAuthService = {
  getAuthStatus: jest.fn(),
  getSessionCookies: jest.fn().mockReturnValue([]),
  login: jest.fn(),
  logout: jest.fn(),
  cleanup: jest.fn(),
  getDebugInfo: jest.fn(),
} as unknown as AuthService

describe('TorrentMetadataService', () => {
  let service: TorrentMetadataService

  beforeEach(() => {
    jest.clearAllMocks()
    ;(puppeteer.launch as jest.Mock<any>).mockResolvedValue(mockBrowser as any)
    ;(mockBrowser.newPage as jest.Mock<any>).mockResolvedValue(mockPage as any)
    ;(mockPage.goto as jest.Mock<any>).mockResolvedValue(null as any)
    ;(mockPage.setCookie as jest.Mock<any>).mockResolvedValue(null as any)
    ;(mockPage.waitForSelector as jest.Mock<any>).mockResolvedValue(null as any)
    ;(mockPage.$eval as jest.Mock<any>).mockResolvedValue('magnet:?test' as any)
    ;(mockPage.content as jest.Mock<any>).mockResolvedValue(
      '<html></html>' as any
    )
    ;(mockAuthService.getAuthStatus as jest.Mock<any>).mockReturnValue({
      isLoggedIn: true,
      username: 'testuser',
    })

    service = new TorrentMetadataService(mockAuthService, { headless: true })
  })

  describe('parseMetadata', () => {
    it('should return error when not logged in', async () => {
      ;(mockAuthService.getAuthStatus as jest.Mock<any>).mockReturnValue({
        isLoggedIn: false,
      })

      const result = await service.parseMetadata({
        torrentUrl: 'https://rutracker.org/forum/viewtopic.php?t=12345',
        torrentId: '12345',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not logged in')
    })

    it('should fetch and return metadata on first call', async () => {
      const result = await service.parseMetadata({
        torrentUrl: 'https://rutracker.org/forum/viewtopic.php?t=12345',
        torrentId: '12345',
      })

      expect(result.success).toBe(true)
      expect(result.metadata).toBeDefined()
      expect(result.metadata!.albums).toHaveLength(1)
    })

    it('should return cached result on second call', async () => {
      await service.parseMetadata({
        torrentUrl: 'https://rutracker.org/forum/viewtopic.php?t=12345',
        torrentId: '12345',
      })

      const result = await service.parseMetadata({
        torrentUrl: 'https://rutracker.org/forum/viewtopic.php?t=12345',
        torrentId: '12345',
      })

      expect(result.success).toBe(true)
      // Browser newPage should only be called once (cached on second call)
      expect(mockBrowser.newPage).toHaveBeenCalledTimes(1)
    })

    it('should return error when page navigation fails', async () => {
      ;(mockPage.goto as jest.Mock<any>).mockRejectedValueOnce(
        new Error('Navigation timeout') as any
      )

      const result = await service.parseMetadata({
        torrentUrl: 'https://invalid-url.com',
        torrentId: '99999',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Navigation timeout')
    })

    it('should return error when browser launch fails', async () => {
      ;(puppeteer.launch as jest.Mock<any>).mockRejectedValueOnce(
        new Error('Chrome not found') as any
      )

      // New service to trigger fresh browser init
      const freshService = new TorrentMetadataService(mockAuthService, {
        headless: true,
      })
      const result = await freshService.parseMetadata({
        torrentUrl: 'https://rutracker.org/forum/viewtopic.php?t=12345',
        torrentId: '12345',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Chrome not found')
    })
  })

  describe('clearCache', () => {
    it('should force re-fetch after clearing cache', async () => {
      // First call caches
      await service.parseMetadata({
        torrentUrl: 'https://rutracker.org/forum/viewtopic.php?t=12345',
        torrentId: '12345',
      })

      service.clearCache()

      // Second call should re-fetch (not use cache)
      await service.parseMetadata({
        torrentUrl: 'https://rutracker.org/forum/viewtopic.php?t=12345',
        torrentId: '12345',
      })

      expect(mockBrowser.newPage).toHaveBeenCalledTimes(2)
    })
  })
})
