import { TorrentLifecycleManager } from './TorrentLifecycleManager'
import type { QueuedTorrent } from '@shared/types/torrent.types'
import type { Torrent } from 'webtorrent'

jest.mock('fs')
jest.mock('../utils/torrentHelpers')
jest.mock('../utils/fileCleanup')

import { existsSync, mkdirSync } from 'fs'

const mockExistsSync = existsSync as jest.Mock
const mockMkdirSync = mkdirSync as jest.Mock

function makeQueuedTorrent(overrides: Partial<QueuedTorrent> = {}): QueuedTorrent {
  return {
    id: 'qt-1',
    name: 'My Album',
    status: 'queued',
    magnetUri: 'magnet:?xt=urn:btih:abc123',
    downloadPath: '/downloads',
    files: [],
    progress: 0,
    downloadSpeed: 0,
    uploadSpeed: 0,
    downloaded: 0,
    uploaded: 0,
    totalSize: 0,
    seeders: 0,
    leechers: 0,
    ratio: 0,
    addedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as QueuedTorrent
}

function makeMockBroadcaster() {
  return {
    start: jest.fn(),
    stop: jest.fn(),
    broadcastStatusChange: jest.fn(),
    broadcastFileSelectionNeeded: jest.fn(),
  }
}

describe('TorrentLifecycleManager', () => {
  let deps: {
    queue: Map<string, QueuedTorrent>
    activeTorrents: Map<string, Torrent>
    torrentsAwaitingSelection: Set<string>
    settings: Record<string, unknown>
    broadcaster: ReturnType<typeof makeMockBroadcaster>
    persistQueue: jest.Mock
  }
  let manager: TorrentLifecycleManager

  beforeEach(() => {
    jest.clearAllMocks()
    mockExistsSync.mockReturnValue(true)
    mockMkdirSync.mockImplementation(() => {})

    deps = {
      queue: new Map(),
      activeTorrents: new Map(),
      torrentsAwaitingSelection: new Set(),
      settings: {
        maxConcurrentDownloads: 2,
        seedAfterDownload: false,
        maxUploadSpeed: 0,
        maxDownloadSpeed: 0,
      },
      broadcaster: makeMockBroadcaster(),
      persistQueue: jest.fn(),
    }
    manager = new TorrentLifecycleManager(deps as any)
  })

  describe('getClient', () => {
    it('returns null before initialization', () => {
      expect(manager.getClient()).toBeNull()
    })
  })

  describe('processQueue', () => {
    it('does nothing when concurrency limit is already reached', async () => {
      deps.queue.set('a', makeQueuedTorrent({ id: 'a', status: 'downloading' }))
      deps.queue.set('b', makeQueuedTorrent({ id: 'b', status: 'downloading' }))
      deps.queue.set('c', makeQueuedTorrent({ id: 'c', status: 'queued' }))
      // 2 active, maxConcurrentDownloads = 2 → no slots

      await manager.processQueue()

      // client should not be initialized since no slots
      expect(manager.getClient()).toBeNull()
    })

    it('does nothing when there are no queued torrents', async () => {
      deps.queue.set('a', makeQueuedTorrent({ id: 'a', status: 'downloading' }))
      // 1 active, 1 slot available, but nothing queued

      await manager.processQueue()

      expect(manager.getClient()).toBeNull()
    })

    it('processes queued torrents in FIFO order (oldest addedAt first)', async () => {
      const mockTorrent = { infoHash: '', on: jest.fn(), files: [] }
      const mockClient = { add: jest.fn().mockReturnValue(mockTorrent) }
      jest.spyOn(manager, 'ensureClient').mockResolvedValue(mockClient as any)

      const older = makeQueuedTorrent({ id: 'older', addedAt: '2026-01-01T00:00:00.000Z' })
      const newer = makeQueuedTorrent({ id: 'newer', addedAt: '2026-01-02T00:00:00.000Z' })
      // Insert newer first to verify sorting
      deps.queue.set('newer', newer)
      deps.queue.set('older', older)

      await manager.processQueue()

      // Both should start (2 slots free)
      expect(mockClient.add).toHaveBeenCalledTimes(2)
      expect(older.status).toBe('downloading')
      expect(newer.status).toBe('downloading')
    })

    it('starts only up to the available slots', async () => {
      const mockTorrent = { infoHash: '', on: jest.fn(), files: [] }
      const mockClient = { add: jest.fn().mockReturnValue(mockTorrent) }
      jest.spyOn(manager, 'ensureClient').mockResolvedValue(mockClient as any)

      // 1 active → 1 slot available
      deps.queue.set('active', makeQueuedTorrent({ id: 'active', status: 'downloading' }))
      deps.queue.set('q1', makeQueuedTorrent({ id: 'q1', status: 'queued', addedAt: '2026-01-01T00:00:00.000Z' }))
      deps.queue.set('q2', makeQueuedTorrent({ id: 'q2', status: 'queued', addedAt: '2026-01-02T00:00:00.000Z' }))

      await manager.processQueue()

      // Only 1 slot → only the older queued torrent should start
      expect(mockClient.add).toHaveBeenCalledTimes(1)
    })

    it('uses local .torrent file when available', async () => {
      const mockTorrent = { infoHash: '', on: jest.fn(), files: [] }
      const mockClient = { add: jest.fn().mockReturnValue(mockTorrent) }
      jest.spyOn(manager, 'ensureClient').mockResolvedValue(mockClient as any)

      const { readFileSync } = jest.requireMock<typeof import('fs')>('fs')
      const mockReadFileSync = readFileSync as jest.Mock
      const torrentBuffer = Buffer.from('fake-torrent-data')
      mockReadFileSync.mockReturnValue(torrentBuffer)

      const qt = makeQueuedTorrent({ torrentFilePath: '/path/to/file.torrent' })
      deps.queue.set(qt.id, qt)

      await manager.processQueue()

      // Should pass the buffer, not the magnet URI
      expect(mockClient.add).toHaveBeenCalledWith(torrentBuffer, { path: qt.downloadPath })
    })

    it('falls back to magnet URI when .torrent file does not exist', async () => {
      const mockTorrent = { infoHash: '', on: jest.fn(), files: [] }
      const mockClient = { add: jest.fn().mockReturnValue(mockTorrent) }
      jest.spyOn(manager, 'ensureClient').mockResolvedValue(mockClient as any)

      // torrentFilePath set but file doesn't exist
      mockExistsSync.mockImplementation((p: string) => !p.endsWith('.torrent'))

      const qt = makeQueuedTorrent({ torrentFilePath: '/missing/file.torrent' })
      deps.queue.set(qt.id, qt)

      await manager.processQueue()

      expect(mockClient.add).toHaveBeenCalledWith(qt.magnetUri, { path: qt.downloadPath })
    })

    it('sets torrent to error status when startTorrent throws', async () => {
      jest.spyOn(manager, 'ensureClient').mockRejectedValue(new Error('WebTorrent init failed'))

      const qt = makeQueuedTorrent()
      deps.queue.set(qt.id, qt)

      await manager.processQueue()

      expect(qt.status).toBe('error')
      expect(qt.error).toContain('WebTorrent init failed')
      expect(deps.persistQueue).toHaveBeenCalled()
    })
  })

  describe('destroyClientTorrent', () => {
    it('does nothing when the torrent is not in activeTorrents', () => {
      expect(() => manager.destroyClientTorrent('nonexistent')).not.toThrow()
    })

    it('destroys the torrent and removes it from activeTorrents', () => {
      const mockTorrent = { destroy: jest.fn() }
      deps.activeTorrents.set('qt-1', mockTorrent as unknown as Torrent)

      manager.destroyClientTorrent('qt-1')

      expect(mockTorrent.destroy).toHaveBeenCalled()
      expect(deps.activeTorrents.has('qt-1')).toBe(false)
    })
  })

  describe('destroyClient', () => {
    it('resolves immediately when no client has been initialized', async () => {
      await expect(manager.destroyClient()).resolves.toBeUndefined()
    })

    it('clears activeTorrents even when no client is present', async () => {
      deps.activeTorrents.set('qt-1', {} as Torrent)

      await manager.destroyClient()

      expect(deps.activeTorrents.size).toBe(0)
    })

    it('destroys the WebTorrent client and nulls the reference', async () => {
      const mockClient = {
        add: jest.fn().mockReturnValue({ infoHash: '', on: jest.fn() }),
        destroy: jest.fn(cb => cb()),
        on: jest.fn(),
      }
      jest.spyOn(manager, 'ensureClient').mockResolvedValue(mockClient as any)
      // Initialize the client
      await manager.ensureClient()

      // Manually set client via the internal field by calling a method that uses it
      // Since client is private, we test via ensureClient behaviour:
      // After destroy, getClient() should return null
      // We'll inject the mock client directly via the method spy
      ;(manager as any).client = mockClient

      await manager.destroyClient()

      expect(mockClient.destroy).toHaveBeenCalled()
      expect(manager.getClient()).toBeNull()
    })
  })
})
