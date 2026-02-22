import { describe, it, expect, beforeEach, jest } from '@jest/globals'

const mockWindowApi = {
  torrentCollection: {
    save: jest
      .fn<(data: any) => Promise<any>>()
      .mockResolvedValue({ success: true } as never),
    load: jest
      .fn<(data: any) => Promise<any>>()
      .mockResolvedValue({ success: true, torrents: [] } as never),
  },
}

;(globalThis as any).window = { api: mockWindowApi }

import { useTorrentCollectionStore } from './torrentCollectionStore'
import type { SearchResult } from '@shared/types/search.types'

function makeSearchResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: 'sr-1',
    title: 'Test Torrent',
    url: 'https://rutracker.org/forum/viewtopic.php?t=123',
    size: '500 MB',
    sizeBytes: 500 * 1024 * 1024,
    seeders: 10,
    leechers: 2,
    author: 'uploader',
    category: 'Music',
    ...overrides,
  } as SearchResult
}

describe('torrentCollectionStore', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useTorrentCollectionStore.setState({
      collections: {},
      projectId: undefined,
      projectName: undefined,
      projectDirectory: undefined,
    })
  })

  describe('setProjectContext', () => {
    it('should set project context fields', () => {
      useTorrentCollectionStore
        .getState()
        .setProjectContext('p1', 'My Project', '/projects/p1')

      const state = useTorrentCollectionStore.getState()
      expect(state.projectId).toBe('p1')
      expect(state.projectName).toBe('My Project')
      expect(state.projectDirectory).toBe('/projects/p1')
    })
  })

  describe('loadCollectionFromProject', () => {
    it('should load collection from disk and store by projectId', async () => {
      const torrents = [{ id: 'ct-1', torrentId: 'sr-1', title: 'Test' }]
      mockWindowApi.torrentCollection.load.mockResolvedValue({
        success: true,
        torrents,
      } as never)

      await useTorrentCollectionStore
        .getState()
        .loadCollectionFromProject('p1', '/projects/p1')

      expect(useTorrentCollectionStore.getState().collections['p1']).toEqual(
        torrents
      )
    })

    it('should handle load failure gracefully', async () => {
      mockWindowApi.torrentCollection.load.mockRejectedValue(
        new Error('fail') as never
      )

      await useTorrentCollectionStore
        .getState()
        .loadCollectionFromProject('p1', '/projects/p1')

      expect(useTorrentCollectionStore.getState().collections['p1']).toEqual([])
    })
  })

  describe('addToCollection', () => {
    it('should add torrent to collection and auto-save', () => {
      useTorrentCollectionStore.setState({
        projectId: 'p1',
        projectName: 'Project',
        projectDirectory: '/proj',
        collections: {},
      })

      useTorrentCollectionStore.getState().addToCollection(makeSearchResult())

      const collection = useTorrentCollectionStore.getState().collections['p1']
      expect(collection).toHaveLength(1)
      expect(collection![0].torrentId).toBe('sr-1')
      expect(collection![0].title).toBe('Test Torrent')
      expect(mockWindowApi.torrentCollection.save).toHaveBeenCalled()
    })

    it('should prevent duplicates by torrentId', () => {
      useTorrentCollectionStore.setState({
        projectId: 'p1',
        projectName: 'Project',
        projectDirectory: '/proj',
        collections: {
          p1: [
            {
              id: 'ct-1',
              torrentId: 'sr-1',
              title: 'Existing',
              magnetLink: '',
              pageUrl: '',
              addedAt: '',
              metadata: {},
              projectId: 'p1',
            } as any,
          ],
        },
      })

      useTorrentCollectionStore
        .getState()
        .addToCollection(makeSearchResult({ id: 'sr-1' }))

      expect(
        useTorrentCollectionStore.getState().collections['p1']
      ).toHaveLength(1)
    })

    it('should do nothing without project context', () => {
      useTorrentCollectionStore.getState().addToCollection(makeSearchResult())

      expect(mockWindowApi.torrentCollection.save).not.toHaveBeenCalled()
    })

    it('should prepend new torrent to collection', () => {
      useTorrentCollectionStore.setState({
        projectId: 'p1',
        projectName: 'Project',
        projectDirectory: '/proj',
        collections: {
          p1: [
            {
              id: 'ct-1',
              torrentId: 'sr-existing',
              title: 'Existing',
            } as any,
          ],
        },
      })

      useTorrentCollectionStore
        .getState()
        .addToCollection(makeSearchResult({ id: 'sr-new' }))

      const collection = useTorrentCollectionStore.getState().collections['p1']!
      expect(collection).toHaveLength(2)
      expect(collection[0].torrentId).toBe('sr-new')
      expect(collection[1].torrentId).toBe('sr-existing')
    })

    it('should map SearchResult metadata correctly', () => {
      useTorrentCollectionStore.setState({
        projectId: 'p1',
        projectName: 'Project',
        projectDirectory: '/proj',
        collections: {},
      })

      useTorrentCollectionStore
        .getState()
        .addToCollection(
          makeSearchResult({ seeders: 42, leechers: 7, category: 'Lossless' })
        )

      const ct = useTorrentCollectionStore.getState().collections['p1']![0]
      expect(ct.metadata!.seeders).toBe(42)
      expect(ct.metadata!.leechers).toBe(7)
      expect(ct.metadata!.category).toBe('Lossless')
    })
  })

  describe('removeFromCollection', () => {
    it('should remove torrent by id and auto-save', () => {
      useTorrentCollectionStore.setState({
        projectId: 'p1',
        projectName: 'Project',
        projectDirectory: '/proj',
        collections: {
          p1: [
            { id: 'ct-1', torrentId: 'sr-1' } as any,
            { id: 'ct-2', torrentId: 'sr-2' } as any,
          ],
        },
      })

      useTorrentCollectionStore.getState().removeFromCollection('ct-1')

      const collection = useTorrentCollectionStore.getState().collections['p1']!
      expect(collection).toHaveLength(1)
      expect(collection[0].id).toBe('ct-2')
      expect(mockWindowApi.torrentCollection.save).toHaveBeenCalled()
    })

    it('should do nothing without project context', () => {
      useTorrentCollectionStore.getState().removeFromCollection('ct-1')
      expect(mockWindowApi.torrentCollection.save).not.toHaveBeenCalled()
    })
  })

  describe('updateMagnetLink', () => {
    it('should update magnet link for specific torrent and auto-save', () => {
      useTorrentCollectionStore.setState({
        projectId: 'p1',
        projectName: 'Project',
        projectDirectory: '/proj',
        collections: {
          p1: [{ id: 'ct-1', torrentId: 'sr-1', magnetLink: '' } as any],
        },
      })

      useTorrentCollectionStore
        .getState()
        .updateMagnetLink('ct-1', 'magnet:?new')

      expect(
        useTorrentCollectionStore.getState().collections['p1']![0].magnetLink
      ).toBe('magnet:?new')
      expect(mockWindowApi.torrentCollection.save).toHaveBeenCalled()
    })
  })

  describe('clearCollection', () => {
    it('should empty collection for current project and auto-save', () => {
      useTorrentCollectionStore.setState({
        projectId: 'p1',
        projectName: 'Project',
        projectDirectory: '/proj',
        collections: {
          p1: [{ id: 'ct-1' } as any, { id: 'ct-2' } as any],
        },
      })

      useTorrentCollectionStore.getState().clearCollection()

      expect(useTorrentCollectionStore.getState().collections['p1']).toEqual([])
      expect(mockWindowApi.torrentCollection.save).toHaveBeenCalledWith(
        expect.objectContaining({ torrents: [] })
      )
    })
  })

  describe('getCollection', () => {
    it('should return collection for current project', () => {
      const collection = [{ id: 'ct-1' } as any]
      useTorrentCollectionStore.setState({
        projectId: 'p1',
        collections: { p1: collection },
      })

      expect(useTorrentCollectionStore.getState().getCollection()).toEqual(
        collection
      )
    })

    it('should return empty array without project context', () => {
      expect(useTorrentCollectionStore.getState().getCollection()).toEqual([])
    })

    it('should return empty array for project with no collection', () => {
      useTorrentCollectionStore.setState({
        projectId: 'p1',
        collections: {},
      })

      expect(useTorrentCollectionStore.getState().getCollection()).toEqual([])
    })
  })
})
