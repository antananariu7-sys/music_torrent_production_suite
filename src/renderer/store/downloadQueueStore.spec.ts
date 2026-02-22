import { describe, it, expect, beforeEach, jest } from '@jest/globals'

const mockWindowApi = {
  webtorrent: {
    getAll: jest.fn<() => Promise<any>>(),
    getSettings: jest.fn<() => Promise<any>>(),
    add: jest.fn<() => Promise<any>>(),
    pause: jest.fn<() => Promise<any>>(),
    resume: jest.fn<() => Promise<any>>(),
    remove: jest.fn<() => Promise<any>>(),
    updateSettings: jest.fn<() => Promise<any>>(),
  },
}

;(globalThis as any).window = { api: mockWindowApi }

import { useDownloadQueueStore } from './downloadQueueStore'
import type {
  QueuedTorrent,
  QueuedTorrentProgress,
} from '@shared/types/torrent.types'

function makeTorrent(overrides: Partial<QueuedTorrent> = {}): QueuedTorrent {
  return {
    id: 'torrent-1',
    title: 'Test Torrent',
    magnetLink: 'magnet:?xt=urn:btih:test',
    status: 'queued',
    addedAt: '2024-01-01T00:00:00.000Z',
    progress: 0,
    downloadSpeed: 0,
    uploadSpeed: 0,
    downloaded: 0,
    uploaded: 0,
    totalSize: 1000,
    seeders: 5,
    leechers: 2,
    ratio: 0,
    files: [],
    ...overrides,
  } as QueuedTorrent
}

function makeProgress(
  overrides: Partial<QueuedTorrentProgress> = {}
): QueuedTorrentProgress {
  return {
    id: 'torrent-1',
    status: 'downloading',
    progress: 0.5,
    downloadSpeed: 1000,
    uploadSpeed: 200,
    downloaded: 500,
    uploaded: 100,
    totalSize: 1000,
    seeders: 5,
    leechers: 2,
    ratio: 0.2,
    files: [],
    ...overrides,
  } as QueuedTorrentProgress
}

describe('downloadQueueStore', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    useDownloadQueueStore.setState({
      torrents: {},
      settings: null,
      isLoading: false,
    })
  })

  describe('loadAll', () => {
    it('should load torrents and index by id', async () => {
      const t1 = makeTorrent({ id: 'a' })
      const t2 = makeTorrent({ id: 'b' })
      mockWindowApi.webtorrent.getAll.mockResolvedValue({
        success: true,
        data: [t1, t2],
      } as never)

      await useDownloadQueueStore.getState().loadAll()

      const state = useDownloadQueueStore.getState()
      expect(state.torrents['a']).toEqual(t1)
      expect(state.torrents['b']).toEqual(t2)
      expect(state.isLoading).toBe(false)
    })

    it('should set isLoading during load', async () => {
      let capturedLoading = false
      mockWindowApi.webtorrent.getAll.mockImplementation(async () => {
        capturedLoading = useDownloadQueueStore.getState().isLoading
        return { success: true, data: [] }
      })

      await useDownloadQueueStore.getState().loadAll()

      expect(capturedLoading).toBe(true)
      expect(useDownloadQueueStore.getState().isLoading).toBe(false)
    })

    it('should handle API failure gracefully', async () => {
      mockWindowApi.webtorrent.getAll.mockRejectedValue(
        new Error('Network error') as never
      )

      await useDownloadQueueStore.getState().loadAll()

      const state = useDownloadQueueStore.getState()
      expect(state.torrents).toEqual({})
      expect(state.isLoading).toBe(false)
    })

    it('should handle unsuccessful response', async () => {
      mockWindowApi.webtorrent.getAll.mockResolvedValue({
        success: false,
      } as never)

      await useDownloadQueueStore.getState().loadAll()

      expect(useDownloadQueueStore.getState().torrents).toEqual({})
    })
  })

  describe('loadSettings', () => {
    it('should load settings from IPC', async () => {
      const settings = { maxConcurrentDownloads: 3, downloadPath: '/tmp' }
      mockWindowApi.webtorrent.getSettings.mockResolvedValue({
        success: true,
        data: settings,
      } as never)

      await useDownloadQueueStore.getState().loadSettings()

      expect(useDownloadQueueStore.getState().settings).toEqual(settings)
    })

    it('should handle failure gracefully', async () => {
      mockWindowApi.webtorrent.getSettings.mockRejectedValue(
        new Error('fail') as never
      )

      await useDownloadQueueStore.getState().loadSettings()

      expect(useDownloadQueueStore.getState().settings).toBeNull()
    })
  })

  describe('addTorrent', () => {
    it('should add torrent to state on success', async () => {
      const newTorrent = makeTorrent({ id: 'new-1' })
      mockWindowApi.webtorrent.add.mockResolvedValue({
        success: true,
        torrent: newTorrent,
      } as never)

      const result = await useDownloadQueueStore.getState().addTorrent({
        magnetLink: 'magnet:?test',
        projectId: 'proj-1',
      } as any)

      expect(result.success).toBe(true)
      expect(useDownloadQueueStore.getState().torrents['new-1']).toEqual(
        newTorrent
      )
    })

    it('should return error on failure', async () => {
      mockWindowApi.webtorrent.add.mockResolvedValue({
        success: false,
        error: 'Duplicate',
      } as never)

      const result = await useDownloadQueueStore.getState().addTorrent({
        magnetLink: 'magnet:?test',
        projectId: 'proj-1',
      } as any)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Duplicate')
    })

    it('should handle exception', async () => {
      mockWindowApi.webtorrent.add.mockRejectedValue(
        new Error('Network') as never
      )

      const result = await useDownloadQueueStore.getState().addTorrent({
        magnetLink: 'magnet:?test',
        projectId: 'proj-1',
      } as any)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network')
    })
  })

  describe('pauseTorrent', () => {
    it('should set status to paused and clear speeds', async () => {
      useDownloadQueueStore.setState({
        torrents: {
          t1: makeTorrent({
            id: 't1',
            status: 'downloading',
            downloadSpeed: 500,
          }),
        },
      })
      mockWindowApi.webtorrent.pause.mockResolvedValue({
        success: true,
      } as never)

      await useDownloadQueueStore.getState().pauseTorrent('t1')

      const t = useDownloadQueueStore.getState().torrents['t1']
      expect(t.status).toBe('paused')
      expect(t.downloadSpeed).toBe(0)
      expect(t.uploadSpeed).toBe(0)
    })

    it('should not update state on failure', async () => {
      useDownloadQueueStore.setState({
        torrents: { t1: makeTorrent({ id: 't1', status: 'downloading' }) },
      })
      mockWindowApi.webtorrent.pause.mockResolvedValue({
        success: false,
      } as never)

      await useDownloadQueueStore.getState().pauseTorrent('t1')

      expect(useDownloadQueueStore.getState().torrents['t1'].status).toBe(
        'downloading'
      )
    })
  })

  describe('resumeTorrent', () => {
    it('should set status to queued and clear error', async () => {
      useDownloadQueueStore.setState({
        torrents: {
          t1: makeTorrent({ id: 't1', status: 'paused', error: 'prev error' }),
        },
      })
      mockWindowApi.webtorrent.resume.mockResolvedValue({
        success: true,
      } as never)

      await useDownloadQueueStore.getState().resumeTorrent('t1')

      const t = useDownloadQueueStore.getState().torrents['t1']
      expect(t.status).toBe('queued')
      expect(t.error).toBeUndefined()
    })
  })

  describe('removeTorrent', () => {
    it('should remove torrent from state on success', async () => {
      useDownloadQueueStore.setState({
        torrents: {
          t1: makeTorrent({ id: 't1' }),
          t2: makeTorrent({ id: 't2' }),
        },
      })
      mockWindowApi.webtorrent.remove.mockResolvedValue({
        success: true,
      } as never)

      await useDownloadQueueStore.getState().removeTorrent('t1')

      const torrents = useDownloadQueueStore.getState().torrents
      expect(torrents['t1']).toBeUndefined()
      expect(torrents['t2']).toBeDefined()
    })

    it('should not remove on failure', async () => {
      useDownloadQueueStore.setState({
        torrents: { t1: makeTorrent({ id: 't1' }) },
      })
      mockWindowApi.webtorrent.remove.mockResolvedValue({
        success: false,
      } as never)

      await useDownloadQueueStore.getState().removeTorrent('t1')

      expect(useDownloadQueueStore.getState().torrents['t1']).toBeDefined()
    })
  })

  describe('updateSettings', () => {
    it('should update settings on success', async () => {
      const newSettings = { maxConcurrentDownloads: 5, downloadPath: '/new' }
      mockWindowApi.webtorrent.updateSettings.mockResolvedValue({
        success: true,
        data: newSettings,
      } as never)

      await useDownloadQueueStore
        .getState()
        .updateSettings({ maxConcurrentDownloads: 5 })

      expect(useDownloadQueueStore.getState().settings).toEqual(newSettings)
    })
  })

  describe('applyProgressUpdates', () => {
    it('should merge progress into existing torrents', () => {
      useDownloadQueueStore.setState({
        torrents: {
          t1: makeTorrent({ id: 't1', progress: 0 }),
          t2: makeTorrent({ id: 't2', progress: 0 }),
        },
      })

      useDownloadQueueStore
        .getState()
        .applyProgressUpdates([
          makeProgress({ id: 't1', progress: 0.5, status: 'downloading' }),
        ])

      expect(useDownloadQueueStore.getState().torrents['t1'].progress).toBe(0.5)
      expect(useDownloadQueueStore.getState().torrents['t1'].status).toBe(
        'downloading'
      )
      // t2 unchanged
      expect(useDownloadQueueStore.getState().torrents['t2'].progress).toBe(0)
    })

    it('should skip updates for unknown torrent ids', () => {
      useDownloadQueueStore.setState({
        torrents: { t1: makeTorrent({ id: 't1' }) },
      })

      useDownloadQueueStore
        .getState()
        .applyProgressUpdates([makeProgress({ id: 'unknown' })])

      expect(Object.keys(useDownloadQueueStore.getState().torrents)).toEqual([
        't1',
      ])
    })

    it('should handle multiple updates in one batch', () => {
      useDownloadQueueStore.setState({
        torrents: {
          t1: makeTorrent({ id: 't1' }),
          t2: makeTorrent({ id: 't2' }),
        },
      })

      useDownloadQueueStore
        .getState()
        .applyProgressUpdates([
          makeProgress({ id: 't1', progress: 0.3 }),
          makeProgress({ id: 't2', progress: 0.7 }),
        ])

      expect(useDownloadQueueStore.getState().torrents['t1'].progress).toBe(0.3)
      expect(useDownloadQueueStore.getState().torrents['t2'].progress).toBe(0.7)
    })
  })

  describe('applyStatusChange', () => {
    it('should replace torrent in state', () => {
      useDownloadQueueStore.setState({
        torrents: { t1: makeTorrent({ id: 't1', status: 'queued' }) },
      })

      const updated = makeTorrent({
        id: 't1',
        status: 'completed',
        progress: 1,
      })
      useDownloadQueueStore.getState().applyStatusChange(updated)

      expect(useDownloadQueueStore.getState().torrents['t1']).toEqual(updated)
    })
  })
})
