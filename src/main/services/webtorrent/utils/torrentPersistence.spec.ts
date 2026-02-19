import { persistQueue, loadPersistedQueue } from './torrentPersistence'
import type { QueuedTorrent } from '@shared/types/torrent.types'

jest.mock('fs')

import { readFileSync, writeFileSync, existsSync } from 'fs'

const mockWriteFileSync = writeFileSync as jest.Mock
const mockReadFileSync = readFileSync as jest.Mock
const mockExistsSync = existsSync as jest.Mock

function makeQueuedTorrent(overrides: Partial<QueuedTorrent> = {}): QueuedTorrent {
  return {
    id: 'test-id',
    name: 'Test Album',
    magnetUri: 'magnet:?xt=urn:btih:abc123',
    status: 'queued',
    progress: 0,
    downloadSpeed: 100,
    uploadSpeed: 50,
    downloaded: 0,
    uploaded: 0,
    totalSize: 1000,
    seeders: 0,
    leechers: 0,
    ratio: 0,
    files: [],
    downloadPath: '/downloads',
    addedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as QueuedTorrent
}

describe('torrentPersistence', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('persistQueue', () => {
    it('writes serialized queue to the persist path', () => {
      const qt = makeQueuedTorrent({ downloadSpeed: 500, uploadSpeed: 200 })
      const queue = new Map([['test-id', qt]])

      persistQueue(queue, '/data/queue.json')

      expect(mockWriteFileSync).toHaveBeenCalledTimes(1)
      const [writePath, content] = mockWriteFileSync.mock.calls[0]
      expect(writePath).toBe('/data/queue.json')
      const parsed = JSON.parse(content)
      expect(parsed).toHaveLength(1)
    })

    it('resets download/upload speed to 0 on persist', () => {
      const qt = makeQueuedTorrent({ downloadSpeed: 500, uploadSpeed: 200 })
      const queue = new Map([['test-id', qt]])

      persistQueue(queue, '/data/queue.json')

      const content = mockWriteFileSync.mock.calls[0][1]
      const parsed = JSON.parse(content)
      expect(parsed[0].downloadSpeed).toBe(0)
      expect(parsed[0].uploadSpeed).toBe(0)
    })

    it('persists all queue entries', () => {
      const queue = new Map([
        ['id1', makeQueuedTorrent({ id: 'id1', name: 'Album 1' })],
        ['id2', makeQueuedTorrent({ id: 'id2', name: 'Album 2' })],
      ])

      persistQueue(queue, '/data/queue.json')

      const content = mockWriteFileSync.mock.calls[0][1]
      const parsed = JSON.parse(content)
      expect(parsed).toHaveLength(2)
    })

    it('does not throw when writeFileSync fails', () => {
      mockWriteFileSync.mockImplementation(() => { throw new Error('disk full') })
      const queue = new Map([['id1', makeQueuedTorrent()]])

      expect(() => persistQueue(queue, '/data/queue.json')).not.toThrow()
    })

    it('writes empty array for empty queue', () => {
      persistQueue(new Map(), '/data/queue.json')

      const content = mockWriteFileSync.mock.calls[0][1]
      expect(JSON.parse(content)).toEqual([])
    })
  })

  describe('loadPersistedQueue', () => {
    it('returns empty array when file does not exist', () => {
      mockExistsSync.mockReturnValue(false)
      const result = loadPersistedQueue('/data/queue.json')
      expect(result).toEqual([])
    })

    it('restores downloading status to queued', () => {
      mockExistsSync.mockReturnValue(true)
      const stored = [makeQueuedTorrent({ status: 'downloading', downloadSpeed: 500 })]
      mockReadFileSync.mockReturnValue(JSON.stringify(stored))

      const result = loadPersistedQueue('/data/queue.json')

      expect(result[0].status).toBe('queued')
      expect(result[0].downloadSpeed).toBe(0)
      expect(result[0].uploadSpeed).toBe(0)
    })

    it('restores seeding status to queued', () => {
      mockExistsSync.mockReturnValue(true)
      const stored = [makeQueuedTorrent({ status: 'seeding' })]
      mockReadFileSync.mockReturnValue(JSON.stringify(stored))

      const result = loadPersistedQueue('/data/queue.json')

      expect(result[0].status).toBe('queued')
    })

    it('restores awaiting-file-selection to queued', () => {
      mockExistsSync.mockReturnValue(true)
      const stored = [makeQueuedTorrent({ status: 'awaiting-file-selection' as QueuedTorrent['status'] })]
      mockReadFileSync.mockReturnValue(JSON.stringify(stored))

      const result = loadPersistedQueue('/data/queue.json')

      expect(result[0].status).toBe('queued')
    })

    it('preserves completed status unchanged', () => {
      mockExistsSync.mockReturnValue(true)
      const stored = [makeQueuedTorrent({ status: 'completed' })]
      mockReadFileSync.mockReturnValue(JSON.stringify(stored))

      const result = loadPersistedQueue('/data/queue.json')

      expect(result[0].status).toBe('completed')
    })

    it('preserves error status unchanged', () => {
      mockExistsSync.mockReturnValue(true)
      const stored = [makeQueuedTorrent({ status: 'error' })]
      mockReadFileSync.mockReturnValue(JSON.stringify(stored))

      const result = loadPersistedQueue('/data/queue.json')

      expect(result[0].status).toBe('error')
    })

    it('returns empty array when JSON is malformed', () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue('not valid json {{')

      const result = loadPersistedQueue('/data/queue.json')

      expect(result).toEqual([])
    })

    it('returns all entries from file', () => {
      mockExistsSync.mockReturnValue(true)
      const stored = [
        makeQueuedTorrent({ id: 'id1', status: 'completed' }),
        makeQueuedTorrent({ id: 'id2', status: 'error' }),
        makeQueuedTorrent({ id: 'id3', status: 'queued' }),
      ]
      mockReadFileSync.mockReturnValue(JSON.stringify(stored))

      const result = loadPersistedQueue('/data/queue.json')

      expect(result).toHaveLength(3)
    })
  })
})
