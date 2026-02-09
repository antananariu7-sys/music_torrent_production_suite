import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'

// Mock electron before importing the service
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn().mockReturnValue('/tmp/test-userdata'),
  },
  BrowserWindow: {
    getAllWindows: jest.fn().mockReturnValue([]),
  },
}))

// Mock electron-store (same pattern as ConfigService.spec.ts)
jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => {
    let store: Record<string, unknown> = {}
    return {
      get: jest.fn((key: string, defaultValue?: unknown) =>
        store[key] !== undefined ? store[key] : defaultValue
      ),
      set: jest.fn((key: string, value: unknown) => {
        store[key] = value
      }),
      delete: jest.fn((key: string) => {
        delete store[key]
      }),
      clear: jest.fn(() => {
        store = {}
      }),
      has: jest.fn((key: string) => key in store),
    }
  })
})

// Mock fs to control persist/load behavior
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(false),
  readFileSync: jest.fn().mockReturnValue('[]'),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}))

// Track UUID calls for deterministic IDs
let uuidCounter = 0
jest.mock('uuid', () => ({
  v4: jest.fn(() => `test-uuid-${++uuidCounter}`),
}))

// Mock webtorrent to avoid real client initialization
// __esModule is required for dynamic import() to resolve .default correctly
jest.mock('webtorrent', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockReturnValue({
      infoHash: 'mock-infohash',
      name: 'Mock Torrent',
      length: 1000,
      files: [],
      progress: 0,
      downloadSpeed: 0,
      uploadSpeed: 0,
      downloaded: 0,
      uploaded: 0,
      numPeers: 0,
      on: jest.fn(),
      destroy: jest.fn(),
    }),
    on: jest.fn(),
    destroy: jest.fn((cb?: () => void) => cb?.()),
    throttleDownload: jest.fn(),
    throttleUpload: jest.fn(),
  })),
}))

import { WebTorrentService } from './WebTorrentService'
import { ConfigService } from './ConfigService'
import { writeFileSync } from 'fs'
import type { AddTorrentRequest } from '@shared/types/torrent.types'

function makeAddRequest(overrides: Partial<AddTorrentRequest> = {}): AddTorrentRequest {
  return {
    magnetUri: 'magnet:?xt=urn:btih:abc123',
    projectId: 'project-1',
    name: 'Test Torrent',
    downloadPath: '/tmp/downloads',
    ...overrides,
  }
}

describe('WebTorrentService', () => {
  let service: WebTorrentService
  let configService: ConfigService

  beforeEach(() => {
    jest.clearAllMocks()
    uuidCounter = 0
    configService = new ConfigService()
    service = new WebTorrentService(configService)
  })

  afterEach(async () => {
    await service.destroy()
  })

  // =========================================
  // add()
  // =========================================

  describe('add', () => {
    it('should add torrent to queue and start downloading', async () => {
      const result = await service.add(makeAddRequest())

      expect(result.success).toBe(true)
      expect(result.torrent).toBeDefined()
      expect(result.torrent!.id).toBe('test-uuid-1')
      // After add(), processQueue runs and starts the torrent immediately
      expect(result.torrent!.status).toBe('downloading')
    })

    it('should set all initial numeric fields to 0', async () => {
      const result = await service.add(makeAddRequest())
      const t = result.torrent!

      expect(t.progress).toBe(0)
      expect(t.downloadSpeed).toBe(0)
      expect(t.uploadSpeed).toBe(0)
      expect(t.downloaded).toBe(0)
      expect(t.uploaded).toBe(0)
      expect(t.totalSize).toBe(0)
      expect(t.seeders).toBe(0)
      expect(t.leechers).toBe(0)
      expect(t.ratio).toBe(0)
    })

    it('should set addedAt as ISO string', async () => {
      const result = await service.add(makeAddRequest())

      expect(result.torrent!.addedAt).toBeDefined()
      // Should parse as a valid date
      expect(new Date(result.torrent!.addedAt).getTime()).not.toBeNaN()
    })

    it('should persist queue after adding', async () => {
      await service.add(makeAddRequest())

      expect(writeFileSync).toHaveBeenCalled()
    })

    it('should detect duplicate by magnetUri', async () => {
      const request = makeAddRequest()
      await service.add(request)

      const result = await service.add(request)

      expect(result.success).toBe(false)
      expect(result.error).toContain('already in the queue')
    })

    it('should detect duplicate by torrentFilePath', async () => {
      const request = makeAddRequest({
        torrentFilePath: '/path/to/file.torrent',
      })
      await service.add(request)

      const result = await service.add(
        makeAddRequest({
          magnetUri: 'magnet:?xt=urn:btih:different',
          torrentFilePath: '/path/to/file.torrent',
        })
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('already in the queue')
    })

    it('should allow re-add if existing has "error" status', async () => {
      const request = makeAddRequest()
      await service.add(request)

      // Manually set the torrent to error status
      const all = service.getAll()
      all[0].status = 'error'

      const result = await service.add(request)

      expect(result.success).toBe(true)
    })

    it('should allow re-add if existing has "completed" status', async () => {
      const request = makeAddRequest()
      await service.add(request)

      // Manually set the torrent to completed status
      const all = service.getAll()
      all[0].status = 'completed'

      const result = await service.add(request)

      expect(result.success).toBe(true)
    })

    it('should preserve request fields on queued torrent', async () => {
      const request = makeAddRequest({
        projectId: 'proj-42',
        name: 'My Album',
        downloadPath: '/my/downloads',
        fromCollectedTorrentId: 'coll-7',
      })

      const result = await service.add(request)
      const t = result.torrent!

      expect(t.projectId).toBe('proj-42')
      expect(t.name).toBe('My Album')
      expect(t.downloadPath).toBe('/my/downloads')
      expect(t.fromCollectedTorrentId).toBe('coll-7')
      expect(t.magnetUri).toBe(request.magnetUri)
    })
  })

  // =========================================
  // pause()
  // =========================================

  describe('pause', () => {
    it('should return error for non-existent torrent', () => {
      const result = service.pause('nonexistent')

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('should pause a "downloading" torrent', async () => {
      await service.add(makeAddRequest())
      const id = service.getAll()[0].id
      // Manually set status to downloading for test
      service.getAll()[0].status = 'downloading'

      const result = service.pause(id)

      expect(result.success).toBe(true)
      expect(service.getAll()[0].status).toBe('paused')
    })

    it('should pause a "seeding" torrent', async () => {
      await service.add(makeAddRequest())
      const id = service.getAll()[0].id
      service.getAll()[0].status = 'seeding'

      const result = service.pause(id)

      expect(result.success).toBe(true)
      expect(service.getAll()[0].status).toBe('paused')
    })

    it('should return error when pausing "queued" torrent', async () => {
      await service.add(makeAddRequest())
      const id = service.getAll()[0].id
      service.getAll()[0].status = 'queued'

      const result = service.pause(id)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Cannot pause')
    })

    it('should return error when pausing "paused" torrent', async () => {
      await service.add(makeAddRequest())
      const id = service.getAll()[0].id
      service.getAll()[0].status = 'paused'

      const result = service.pause(id)

      expect(result.success).toBe(false)
    })

    it('should return error when pausing "completed" torrent', async () => {
      await service.add(makeAddRequest())
      const id = service.getAll()[0].id
      service.getAll()[0].status = 'completed'

      const result = service.pause(id)

      expect(result.success).toBe(false)
    })

    it('should reset downloadSpeed and uploadSpeed to 0', async () => {
      await service.add(makeAddRequest())
      const torrent = service.getAll()[0]
      torrent.status = 'downloading'
      torrent.downloadSpeed = 50000
      torrent.uploadSpeed = 10000

      service.pause(torrent.id)

      expect(service.getAll()[0].downloadSpeed).toBe(0)
      expect(service.getAll()[0].uploadSpeed).toBe(0)
    })
  })

  // =========================================
  // resume()
  // =========================================

  describe('resume', () => {
    it('should return error for non-existent torrent', () => {
      const result = service.resume('nonexistent')

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('should resume a "paused" torrent (sets status to "queued")', async () => {
      await service.add(makeAddRequest())
      const torrent = service.getAll()[0]
      torrent.status = 'paused'

      const result = service.resume(torrent.id)

      expect(result.success).toBe(true)
      expect(service.getAll()[0].status).toBe('queued')
    })

    it('should resume an "error" torrent (sets status to "queued")', async () => {
      await service.add(makeAddRequest())
      const torrent = service.getAll()[0]
      torrent.status = 'error'
      torrent.error = 'Some error'

      const result = service.resume(torrent.id)

      expect(result.success).toBe(true)
      expect(service.getAll()[0].status).toBe('queued')
    })

    it('should clear error field on resume', async () => {
      await service.add(makeAddRequest())
      const torrent = service.getAll()[0]
      torrent.status = 'error'
      torrent.error = 'Connection failed'

      service.resume(torrent.id)

      expect(service.getAll()[0].error).toBeUndefined()
    })

    it('should return error when resuming "downloading" torrent', async () => {
      await service.add(makeAddRequest())
      const torrent = service.getAll()[0]
      torrent.status = 'downloading'

      const result = service.resume(torrent.id)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Cannot resume')
    })

    it('should return error when resuming "queued" torrent', async () => {
      await service.add(makeAddRequest())
      const torrent = service.getAll()[0]
      torrent.status = 'queued'

      const result = service.resume(torrent.id)

      expect(result.success).toBe(false)
    })
  })

  // =========================================
  // remove()
  // =========================================

  describe('remove', () => {
    it('should return error for non-existent torrent', () => {
      const result = service.remove('nonexistent')

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('should remove torrent from queue', async () => {
      await service.add(makeAddRequest())
      const id = service.getAll()[0].id

      expect(service.getAll()).toHaveLength(1)

      const result = service.remove(id)

      expect(result.success).toBe(true)
      expect(service.getAll()).toHaveLength(0)
    })

    it('should persist queue after removal', async () => {
      await service.add(makeAddRequest())
      const id = service.getAll()[0].id

      ;(writeFileSync as jest.Mock<any>).mockClear()
      service.remove(id)

      expect(writeFileSync).toHaveBeenCalled()
    })
  })

  // =========================================
  // getAll()
  // =========================================

  describe('getAll', () => {
    it('should return empty array when no torrents', () => {
      expect(service.getAll()).toEqual([])
    })

    it('should return all queued torrents as array', async () => {
      await service.add(makeAddRequest({ name: 'Torrent 1' }))
      await service.add(
        makeAddRequest({
          name: 'Torrent 2',
          magnetUri: 'magnet:?xt=urn:btih:def456',
        })
      )

      const all = service.getAll()

      expect(all).toHaveLength(2)
      expect(all.map((t) => t.name)).toContain('Torrent 1')
      expect(all.map((t) => t.name)).toContain('Torrent 2')
    })
  })

  // =========================================
  // getSettings() / updateSettings()
  // =========================================

  describe('getSettings', () => {
    it('should return default settings initially', () => {
      const settings = service.getSettings()

      expect(settings.maxConcurrentDownloads).toBe(3)
      expect(settings.seedAfterDownload).toBe(false)
      expect(settings.maxUploadSpeed).toBe(0)
      expect(settings.maxDownloadSpeed).toBe(0)
    })

    it('should return copy (not reference) of settings', () => {
      const a = service.getSettings()
      const b = service.getSettings()

      expect(a).toEqual(b)
      expect(a).not.toBe(b)
    })
  })

  describe('updateSettings', () => {
    it('should merge partial updates with existing settings', () => {
      service.updateSettings({ maxConcurrentDownloads: 5 })

      const settings = service.getSettings()

      expect(settings.maxConcurrentDownloads).toBe(5)
      // Other settings remain unchanged
      expect(settings.seedAfterDownload).toBe(false)
      expect(settings.maxUploadSpeed).toBe(0)
    })

    it('should persist settings to ConfigService', () => {
      service.updateSettings({ seedAfterDownload: true })

      const saved = configService.getSetting<any>('webtorrentSettings')

      expect(saved).toBeDefined()
      expect(saved.seedAfterDownload).toBe(true)
    })

    it('should return updated settings copy', () => {
      const result = service.updateSettings({ maxDownloadSpeed: 1000 })

      expect(result.maxDownloadSpeed).toBe(1000)
      // Returned value should be a copy
      result.maxDownloadSpeed = 9999
      expect(service.getSettings().maxDownloadSpeed).toBe(1000)
    })
  })

  // =========================================
  // getProjectDownloadPath() / setProjectDownloadPath()
  // =========================================

  describe('getProjectDownloadPath', () => {
    it('should return empty string when no path is set', () => {
      const path = service.getProjectDownloadPath('proj-1')

      expect(path).toBe('')
    })

    it('should return saved download path for project', () => {
      service.setProjectDownloadPath('proj-1', '/my/music/downloads')

      const path = service.getProjectDownloadPath('proj-1')

      expect(path).toBe('/my/music/downloads')
    })
  })

  describe('setProjectDownloadPath', () => {
    it('should store path with correct prefixed key', () => {
      service.setProjectDownloadPath('proj-42', '/downloads/music')

      // Verify it's stored with the correct key pattern
      const result = configService.getSetting<string>('webtorrent-download-path:proj-42')

      expect(result).toBe('/downloads/music')
    })

    it('should store paths independently per project', () => {
      service.setProjectDownloadPath('proj-1', '/path/one')
      service.setProjectDownloadPath('proj-2', '/path/two')

      expect(service.getProjectDownloadPath('proj-1')).toBe('/path/one')
      expect(service.getProjectDownloadPath('proj-2')).toBe('/path/two')
    })
  })
})
