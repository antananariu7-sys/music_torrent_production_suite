import { FileSelectionHandler } from './FileSelectionHandler'
import type { QueuedTorrent } from '@shared/types/torrent.types'
import type { Torrent } from 'webtorrent'

jest.mock('fs')
jest.mock('../utils/torrentHelpers')
jest.mock('../utils/fileCleanup')

import { statSync } from 'fs'
import { mapTorrentFiles, mapCompletedFiles } from '../utils/torrentHelpers'
import { clearPreCreatedDirs } from '../utils/fileCleanup'

const mockStatSync = statSync as jest.Mock
const mockMapTorrentFiles = mapTorrentFiles as jest.Mock
const mockMapCompletedFiles = mapCompletedFiles as jest.Mock
const mockClearPreCreatedDirs = clearPreCreatedDirs as jest.Mock

function makeQueuedTorrent(overrides: Partial<QueuedTorrent> = {}): QueuedTorrent {
  return {
    id: 'qt-1',
    name: 'My Album',
    status: 'awaiting-file-selection',
    downloadPath: '/downloads',
    files: [],
    progress: 0,
    selectedFileIndices: undefined,
    torrentRootFolder: 'My Album',
    magnetUri: 'magnet:?',
    addedAt: '2026-01-01T00:00:00.000Z',
    downloadSpeed: 0,
    uploadSpeed: 0,
    downloaded: 0,
    uploaded: 0,
    totalSize: 0,
    seeders: 0,
    leechers: 0,
    ratio: 0,
    ...overrides,
  } as QueuedTorrent
}

function makeMockTorrent(fileCount = 3): Torrent {
  return {
    files: Array.from({ length: fileCount }, (_, i) => ({
      name: `track${i + 1}.mp3`,
      path: `My Album/track${i + 1}.mp3`,
      length: 1000 * (i + 1),
      downloaded: 0,
      select: jest.fn(),
      deselect: jest.fn(),
    })),
  } as unknown as Torrent
}

describe('FileSelectionHandler', () => {
  let deps: {
    queue: Map<string, QueuedTorrent>
    activeTorrents: Map<string, Torrent>
    torrentsAwaitingSelection: Set<string>
    persistQueue: jest.Mock
    broadcastStatusChange: jest.Mock
    processQueue: jest.Mock
  }
  let handler: FileSelectionHandler

  beforeEach(() => {
    jest.clearAllMocks()
    mockMapTorrentFiles.mockReturnValue([])
    mockMapCompletedFiles.mockReturnValue([])
    mockClearPreCreatedDirs.mockImplementation(() => {})

    deps = {
      queue: new Map(),
      activeTorrents: new Map(),
      torrentsAwaitingSelection: new Set(),
      persistQueue: jest.fn(),
      broadcastStatusChange: jest.fn(),
      processQueue: jest.fn().mockResolvedValue(undefined),
    }
    handler = new FileSelectionHandler(deps)
  })

  describe('selectFiles', () => {
    it('returns error when torrent is not in queue', () => {
      const result = handler.selectFiles('nonexistent', [0])
      expect(result).toEqual({ success: false, error: 'Torrent not found' })
    })

    it('returns error when torrent is not awaiting file selection', () => {
      const qt = makeQueuedTorrent({ status: 'downloading' })
      deps.queue.set(qt.id, qt)

      const result = handler.selectFiles(qt.id, [0])
      expect(result).toEqual({ success: false, error: 'Torrent is not awaiting file selection' })
    })

    it('returns error when active torrent instance is missing', () => {
      const qt = makeQueuedTorrent()
      deps.queue.set(qt.id, qt)
      // No activeTorrent set

      const result = handler.selectFiles(qt.id, [0])
      expect(result).toEqual({ success: false, error: 'Active torrent instance not found' })
    })

    it('returns error when download path is not set', () => {
      const qt = makeQueuedTorrent({ downloadPath: '' })
      const torrent = makeMockTorrent()
      deps.queue.set(qt.id, qt)
      deps.activeTorrents.set(qt.id, torrent)

      const result = handler.selectFiles(qt.id, [0])
      expect(result).toEqual({ success: false, error: 'Download path not set' })
    })

    it('marks torrent as completed when all selected files already exist with correct size', () => {
      const qt = makeQueuedTorrent()
      const torrent = makeMockTorrent(2) // file[0].length = 1000, file[1].length = 2000
      deps.queue.set(qt.id, qt)
      deps.activeTorrents.set(qt.id, torrent)
      deps.torrentsAwaitingSelection.add(qt.id)

      // Selecting only file[0] (length = 1000) — size matches
      mockStatSync.mockReturnValue({ size: 1000 })

      const result = handler.selectFiles(qt.id, [0])

      expect(result).toEqual({ success: true })
      expect(qt.status).toBe('completed')
      expect(qt.progress).toBe(100)
      expect(qt.selectedFileIndices).toEqual([0])
      expect(deps.torrentsAwaitingSelection.has(qt.id)).toBe(false)
      expect(deps.persistQueue).toHaveBeenCalled()
      expect(deps.broadcastStatusChange).toHaveBeenCalledWith(qt)
    })

    it('downloads files that do not exist on disk', () => {
      const qt = makeQueuedTorrent()
      const torrent = makeMockTorrent(3)
      deps.queue.set(qt.id, qt)
      deps.activeTorrents.set(qt.id, torrent)
      deps.torrentsAwaitingSelection.add(qt.id)

      // Files not on disk
      mockStatSync.mockImplementation(() => { throw new Error('ENOENT') })

      const result = handler.selectFiles(qt.id, [0, 1])

      expect(result).toEqual({ success: true })
      expect(qt.status).toBe('downloading')
      expect(torrent.files[0].select).toHaveBeenCalled()
      expect(torrent.files[1].select).toHaveBeenCalled()
      expect((torrent.files[2].select as jest.Mock)).not.toHaveBeenCalled()
      expect(qt.selectedFileIndices).toEqual([0, 1])
      expect(deps.torrentsAwaitingSelection.has(qt.id)).toBe(false)
    })

    it('deselects all files before selecting chosen ones', () => {
      const qt = makeQueuedTorrent()
      const torrent = makeMockTorrent(3)
      deps.queue.set(qt.id, qt)
      deps.activeTorrents.set(qt.id, torrent)

      mockStatSync.mockImplementation(() => { throw new Error('ENOENT') })

      handler.selectFiles(qt.id, [1])

      torrent.files.forEach(f => {
        expect(f.deselect).toHaveBeenCalled()
      })
    })

    it('skips out-of-bounds indices', () => {
      const qt = makeQueuedTorrent()
      const torrent = makeMockTorrent(2) // only indices 0 and 1 valid
      deps.queue.set(qt.id, qt)
      deps.activeTorrents.set(qt.id, torrent)

      mockStatSync.mockImplementation(() => { throw new Error('ENOENT') })

      const result = handler.selectFiles(qt.id, [0, 99])

      expect(result).toEqual({ success: true })
      // Only file[0] selected, index 99 skipped
      expect(torrent.files[0].select).toHaveBeenCalled()
    })

    it('re-downloads file if it exists but has wrong size', () => {
      const qt = makeQueuedTorrent()
      const torrent = makeMockTorrent(1) // file[0].length = 1000
      deps.queue.set(qt.id, qt)
      deps.activeTorrents.set(qt.id, torrent)

      // File exists but size doesn't match
      mockStatSync.mockReturnValue({ size: 500 }) // wrong size

      const result = handler.selectFiles(qt.id, [0])

      expect(result).toEqual({ success: true })
      expect(qt.status).toBe('downloading')
      expect(torrent.files[0].select).toHaveBeenCalled()
    })
  })

  describe('downloadMoreFiles', () => {
    it('returns error when torrent is not in queue', async () => {
      const result = await handler.downloadMoreFiles('nonexistent', [0])
      expect(result).toEqual({ success: false, error: 'Torrent not found' })
    })

    it('returns error when no file indices are specified', async () => {
      const qt = makeQueuedTorrent({ status: 'downloading' })
      deps.queue.set(qt.id, qt)

      const result = await handler.downloadMoreFiles(qt.id, [])
      expect(result).toEqual({ success: false, error: 'No files specified' })
    })

    it('selects additional files when torrent is still active', async () => {
      const qt = makeQueuedTorrent({ status: 'downloading', selectedFileIndices: [0] })
      const torrent = makeMockTorrent(3)
      deps.queue.set(qt.id, qt)
      deps.activeTorrents.set(qt.id, torrent)

      const result = await handler.downloadMoreFiles(qt.id, [1])

      expect(result).toEqual({ success: true })
      expect(qt.selectedFileIndices).toEqual([0, 1])
      expect(torrent.files[1].select).toHaveBeenCalled()
      expect(qt.status).toBe('downloading')
    })

    it('deduplicates indices when merging with existing selection', async () => {
      const qt = makeQueuedTorrent({ status: 'downloading', selectedFileIndices: [0, 1] })
      const torrent = makeMockTorrent(3)
      deps.queue.set(qt.id, qt)
      deps.activeTorrents.set(qt.id, torrent)

      await handler.downloadMoreFiles(qt.id, [0, 2]) // 0 is duplicate

      expect(qt.selectedFileIndices).toEqual([0, 1, 2])
    })

    it('re-queues a completed torrent when downloading more files', async () => {
      const qt = makeQueuedTorrent({ status: 'completed', selectedFileIndices: [0] })
      deps.queue.set(qt.id, qt)
      // No active torrent (destroyed after completion)

      const result = await handler.downloadMoreFiles(qt.id, [1])

      expect(result).toEqual({ success: true })
      expect(qt.status).toBe('queued')
      expect(qt.progress).toBe(0)
      expect(qt.selectedFileIndices).toEqual([0, 1])
      expect(deps.processQueue).toHaveBeenCalled()
    })

    it('re-queues an errored torrent when downloading more files', async () => {
      const qt = makeQueuedTorrent({ status: 'error', selectedFileIndices: [0] })
      deps.queue.set(qt.id, qt)

      const result = await handler.downloadMoreFiles(qt.id, [1])

      expect(result).toEqual({ success: true })
      expect(qt.status).toBe('queued')
    })

    it('returns error when torrent is in an invalid state for adding files', async () => {
      const qt = makeQueuedTorrent({ status: 'awaiting-file-selection' })
      deps.queue.set(qt.id, qt)
      // No active torrent

      const result = await handler.downloadMoreFiles(qt.id, [1])

      expect(result.success).toBe(false)
      expect(result.error).toContain('awaiting-file-selection')
    })
  })
})
