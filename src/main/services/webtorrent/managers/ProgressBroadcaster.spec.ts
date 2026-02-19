import { ProgressBroadcaster } from './ProgressBroadcaster'
import type { QueuedTorrent } from '@shared/types/torrent.types'
import type { Torrent } from 'webtorrent'

jest.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: jest.fn(),
  },
}))

jest.mock('@shared/constants', () => ({
  IPC_CHANNELS: {
    WEBTORRENT_PROGRESS: 'webtorrent:progress',
    WEBTORRENT_STATUS_CHANGE: 'webtorrent:status-change',
    WEBTORRENT_FILE_SELECTION_NEEDED: 'webtorrent:file-selection-needed',
  },
}))

jest.mock('../utils/fileCleanup', () => ({
  cleanupDeselectedFiles: jest.fn().mockResolvedValue(undefined),
}))

import { BrowserWindow } from 'electron'

function makeMockWindow() {
  return {
    isDestroyed: jest.fn().mockReturnValue(false),
    webContents: { send: jest.fn() },
  }
}

function makeQueuedTorrent(overrides: Partial<QueuedTorrent> = {}): QueuedTorrent {
  return {
    id: 'qt-1',
    name: 'Test Album',
    status: 'downloading',
    progress: 50,
    downloadSpeed: 0,
    uploadSpeed: 0,
    downloaded: 0,
    uploaded: 0,
    totalSize: 0,
    seeders: 0,
    leechers: 0,
    ratio: 0,
    files: [],
    downloadPath: '/downloads',
    magnetUri: 'magnet:?',
    addedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as QueuedTorrent
}

function makeMockTorrent(overrides: Partial<Record<string, unknown>> = {}): Torrent {
  return {
    downloadSpeed: 1000,
    uploadSpeed: 200,
    uploaded: 5000,
    numPeers: 10,
    progress: 0.5,
    downloaded: 500,
    length: 1000,
    files: [],
    destroy: jest.fn(),
    ...overrides,
  } as unknown as Torrent
}

describe('ProgressBroadcaster', () => {
  let deps: {
    queue: Map<string, QueuedTorrent>
    activeTorrents: Map<string, Torrent>
    settings: Record<string, unknown>
    persistQueue: jest.Mock
    processQueue: jest.Mock
  }
  let broadcaster: ProgressBroadcaster
  let mockWindow: ReturnType<typeof makeMockWindow>

  beforeEach(() => {
    jest.useFakeTimers()
    mockWindow = makeMockWindow()
    ;(BrowserWindow.getAllWindows as jest.Mock).mockReturnValue([mockWindow])

    deps = {
      queue: new Map(),
      activeTorrents: new Map(),
      settings: {
        maxConcurrentDownloads: 3,
        seedAfterDownload: false,
        maxUploadSpeed: 0,
        maxDownloadSpeed: 0,
      },
      persistQueue: jest.fn(),
      processQueue: jest.fn().mockResolvedValue(undefined),
    }
    broadcaster = new ProgressBroadcaster(deps as any)
  })

  afterEach(() => {
    broadcaster.stop()
    jest.useRealTimers()
  })

  describe('start / stop', () => {
    it('fires the broadcast interval after 1 second', () => {
      const qt = makeQueuedTorrent({ status: 'downloading' })
      const torrent = makeMockTorrent()
      deps.queue.set(qt.id, qt)
      deps.activeTorrents.set(qt.id, torrent)

      broadcaster.start()
      jest.advanceTimersByTime(1000)

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'webtorrent:progress',
        expect.any(Array)
      )
    })

    it('does not start a second interval when called twice', () => {
      broadcaster.start()
      broadcaster.start()
      // Should not throw or create duplicate intervals
      expect(() => jest.advanceTimersByTime(1000)).not.toThrow()
    })

    it('stops sending after stop() is called', () => {
      broadcaster.start()
      broadcaster.stop()

      const qt = makeQueuedTorrent({ status: 'downloading' })
      deps.queue.set(qt.id, qt)
      deps.activeTorrents.set(qt.id, makeMockTorrent())

      jest.advanceTimersByTime(2000)

      expect(mockWindow.webContents.send).not.toHaveBeenCalled()
    })

    it('stop() is safe to call when not started', () => {
      expect(() => broadcaster.stop()).not.toThrow()
    })
  })

  describe('progress calculation', () => {
    it('skips torrents not in downloading or seeding status', () => {
      const qt = makeQueuedTorrent({ status: 'queued' })
      deps.queue.set(qt.id, qt)
      deps.activeTorrents.set(qt.id, makeMockTorrent())

      broadcaster.start()
      jest.advanceTimersByTime(1000)

      expect(mockWindow.webContents.send).not.toHaveBeenCalled()
    })

    it('skips torrents that are not in activeTorrents map', () => {
      const qt = makeQueuedTorrent({ status: 'downloading' })
      deps.queue.set(qt.id, qt)
      // No entry in activeTorrents

      broadcaster.start()
      jest.advanceTimersByTime(1000)

      expect(mockWindow.webContents.send).not.toHaveBeenCalled()
    })

    it('calculates progress for full torrent download (no file selection)', () => {
      const qt = makeQueuedTorrent({ status: 'downloading' })
      const torrent = makeMockTorrent({ progress: 0.75, downloaded: 750, length: 1000, files: [] })
      deps.queue.set(qt.id, qt)
      deps.activeTorrents.set(qt.id, torrent)

      broadcaster.start()
      jest.advanceTimersByTime(1000)

      expect(qt.progress).toBe(75)
      expect(qt.downloaded).toBe(750)
      expect(qt.totalSize).toBe(1000)
    })

    it('calculates progress based on selected files only', () => {
      const qt = makeQueuedTorrent({
        status: 'downloading',
        selectedFileIndices: [0],
      })
      const torrent = makeMockTorrent({
        files: [
          { length: 1000, downloaded: 500, path: 'album/t1.mp3', name: 't1.mp3' },
          { length: 2000, downloaded: 0,   path: 'album/t2.mp3', name: 't2.mp3' },
        ],
      })
      deps.queue.set(qt.id, qt)
      deps.activeTorrents.set(qt.id, torrent)

      broadcaster.start()
      jest.advanceTimersByTime(1000)

      // file[0]: 500/1000 = 50%
      expect(qt.progress).toBe(50)
      expect(qt.totalSize).toBe(1000)
      expect(qt.downloaded).toBe(500)
    })

    it('does not broadcast when queue is empty', () => {
      broadcaster.start()
      jest.advanceTimersByTime(1000)

      expect(mockWindow.webContents.send).not.toHaveBeenCalled()
    })

    it('skips destroyed windows', () => {
      mockWindow.isDestroyed.mockReturnValue(true)
      const qt = makeQueuedTorrent({ status: 'downloading' })
      deps.queue.set(qt.id, qt)
      deps.activeTorrents.set(qt.id, makeMockTorrent())

      broadcaster.start()
      jest.advanceTimersByTime(1000)

      expect(mockWindow.webContents.send).not.toHaveBeenCalled()
    })

    it('includes seeding torrents in progress updates', () => {
      const qt = makeQueuedTorrent({ status: 'seeding' })
      const torrent = makeMockTorrent({ progress: 1.0, downloaded: 1000, length: 1000, files: [] })
      deps.queue.set(qt.id, qt)
      deps.activeTorrents.set(qt.id, torrent)

      broadcaster.start()
      jest.advanceTimersByTime(1000)

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'webtorrent:progress',
        expect.arrayContaining([expect.objectContaining({ id: qt.id })])
      )
    })
  })

  describe('partial download completion detection', () => {
    it('marks torrent complete when all selected files reach 100%', () => {
      const qt = makeQueuedTorrent({
        status: 'downloading',
        selectedFileIndices: [0],
      })
      const torrent = makeMockTorrent({
        files: [
          { length: 1000, downloaded: 1000, path: 'album/t1.mp3', name: 't1.mp3' },
          { length: 2000, downloaded: 0,    path: 'album/t2.mp3', name: 't2.mp3' },
        ],
        destroy: jest.fn(),
      })
      deps.queue.set(qt.id, qt)
      deps.activeTorrents.set(qt.id, torrent)

      broadcaster.start()
      jest.advanceTimersByTime(1000)

      expect(qt.status).toBe('completed')
      expect(qt.progress).toBe(100)
      expect(qt.downloadSpeed).toBe(0)
      expect(qt.uploadSpeed).toBe(0)
      expect((torrent.destroy as jest.Mock)).toHaveBeenCalled()
      expect(deps.activeTorrents.has(qt.id)).toBe(false)
      expect(deps.persistQueue).toHaveBeenCalled()
    })

    it('does not complete when selected files are not fully downloaded', () => {
      const qt = makeQueuedTorrent({
        status: 'downloading',
        selectedFileIndices: [0],
      })
      const torrent = makeMockTorrent({
        files: [
          { length: 1000, downloaded: 500, path: 'album/t1.mp3', name: 't1.mp3' },
        ],
        destroy: jest.fn(),
      })
      deps.queue.set(qt.id, qt)
      deps.activeTorrents.set(qt.id, torrent)

      broadcaster.start()
      jest.advanceTimersByTime(1000)

      expect(qt.status).toBe('downloading')
      expect((torrent.destroy as jest.Mock)).not.toHaveBeenCalled()
    })
  })

  describe('broadcastStatusChange', () => {
    it('sends status change to all windows', () => {
      const qt = makeQueuedTorrent()
      broadcaster.broadcastStatusChange(qt)
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('webtorrent:status-change', qt)
    })

    it('skips destroyed windows', () => {
      mockWindow.isDestroyed.mockReturnValue(true)
      broadcaster.broadcastStatusChange(makeQueuedTorrent())
      expect(mockWindow.webContents.send).not.toHaveBeenCalled()
    })
  })

  describe('broadcastFileSelectionNeeded', () => {
    it('sends file-selection-needed event with id, name, files', () => {
      const qt = makeQueuedTorrent({ files: [] })
      broadcaster.broadcastFileSelectionNeeded(qt)
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'webtorrent:file-selection-needed',
        { id: qt.id, name: qt.name, files: qt.files }
      )
    })
  })
})
