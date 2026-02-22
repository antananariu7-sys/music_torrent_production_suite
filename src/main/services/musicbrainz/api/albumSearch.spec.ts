import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { findAlbumsBySong, getAlbumDetails } from './albumSearch'
import type { MusicBrainzApiClient } from '../MusicBrainzApiClient'

function makeClient(
  overrides: Partial<MusicBrainzApiClient> = {}
): MusicBrainzApiClient {
  return {
    request: jest.fn<any>(),
    getCoverArtUrl: jest.fn((id: string) => `https://coverart.org/${id}`),
    ...overrides,
  } as unknown as MusicBrainzApiClient
}

describe('albumSearch', () => {
  let client: MusicBrainzApiClient

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
    client = makeClient()
  })

  describe('findAlbumsBySong', () => {
    it('should return albums from recordings', async () => {
      ;(client.request as jest.Mock).mockResolvedValue({
        recordings: [
          {
            title: 'Creep',
            score: 95,
            'artist-credit': [{ artist: { name: 'Radiohead' } }],
            releases: [
              {
                id: 'rel-1',
                title: 'Pablo Honey',
                date: '1993-02-22',
                'release-group': { 'primary-type': 'Album' },
                'track-count': 12,
              },
            ],
          },
        ],
      } as never)

      const result = await findAlbumsBySong(client, {
        songTitle: 'Creep',
        artist: 'Radiohead',
      })

      expect(result.success).toBe(true)
      expect(result.albums).toHaveLength(1)
      expect(result.albums![0].title).toBe('Pablo Honey')
      expect(result.albums![0].artist).toBe('Radiohead')
      expect(result.albums![0].type).toBe('album')
      expect(result.albums![0].coverArtUrl).toBe('https://coverart.org/rel-1')
    })

    it('should build query with artist when provided', async () => {
      ;(client.request as jest.Mock).mockResolvedValue({
        recordings: [],
      } as never)

      await findAlbumsBySong(client, {
        songTitle: 'Creep',
        artist: 'Radiohead',
      })

      expect(client.request).toHaveBeenCalledWith('recording', {
        query: 'recording:"Creep" AND artist:"Radiohead"',
        limit: '10',
        fmt: 'json',
      })
    })

    it('should build query without artist when not provided', async () => {
      ;(client.request as jest.Mock).mockResolvedValue({
        recordings: [],
      } as never)

      await findAlbumsBySong(client, { songTitle: 'Creep' })

      expect(client.request).toHaveBeenCalledWith('recording', {
        query: 'recording:"Creep"',
        limit: '10',
        fmt: 'json',
      })
    })

    it('should return empty albums when no recordings found', async () => {
      ;(client.request as jest.Mock).mockResolvedValue({
        recordings: [],
      } as never)

      const result = await findAlbumsBySong(client, {
        songTitle: 'NonExistent',
      })

      expect(result.success).toBe(true)
      expect(result.albums).toEqual([])
    })

    it('should deduplicate releases by id', async () => {
      ;(client.request as jest.Mock).mockResolvedValue({
        recordings: [
          {
            title: 'Song',
            score: 90,
            'artist-credit': [{ artist: { name: 'Artist' } }],
            releases: [{ id: 'rel-1', title: 'Album' }],
          },
          {
            title: 'Song (live)',
            score: 80,
            'artist-credit': [{ artist: { name: 'Artist' } }],
            releases: [{ id: 'rel-1', title: 'Album' }], // same release
          },
        ],
      } as never)

      const result = await findAlbumsBySong(client, { songTitle: 'Song' })

      expect(result.albums).toHaveLength(1)
    })

    it('should skip recordings without releases', async () => {
      ;(client.request as jest.Mock).mockResolvedValue({
        recordings: [
          {
            title: 'Song',
            score: 90,
            'artist-credit': [{ artist: { name: 'A' } }],
          },
        ],
      } as never)

      const result = await findAlbumsBySong(client, { songTitle: 'Song' })

      expect(result.albums).toEqual([])
    })

    it('should fallback to "Unknown Artist" when artist-credit missing', async () => {
      ;(client.request as jest.Mock).mockResolvedValue({
        recordings: [
          {
            title: 'Song',
            score: 90,
            releases: [{ id: 'rel-1', title: 'Album' }],
          },
        ],
      } as never)

      const result = await findAlbumsBySong(client, { songTitle: 'Song' })

      expect(result.albums![0].artist).toBe('Unknown Artist')
    })

    it('should sort albums by score descending', async () => {
      ;(client.request as jest.Mock).mockResolvedValue({
        recordings: [
          {
            title: 'Song',
            score: 50,
            'artist-credit': [{ artist: { name: 'A' } }],
            releases: [{ id: 'rel-1', title: 'Low Score' }],
          },
          {
            title: 'Song',
            score: 95,
            'artist-credit': [{ artist: { name: 'A' } }],
            releases: [{ id: 'rel-2', title: 'High Score' }],
          },
        ],
      } as never)

      const result = await findAlbumsBySong(client, { songTitle: 'Song' })

      expect(result.albums![0].title).toBe('High Score')
      expect(result.albums![1].title).toBe('Low Score')
    })

    it('should return error on API failure', async () => {
      ;(client.request as jest.Mock).mockRejectedValue(
        new Error('Rate limited') as never
      )

      const result = await findAlbumsBySong(client, { songTitle: 'Test' })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Rate limited')
    })
  })

  describe('getAlbumDetails', () => {
    it('should return album with tracks', async () => {
      ;(client.request as jest.Mock).mockResolvedValue({
        id: 'rel-1',
        title: 'Pablo Honey',
        date: '1993-02-22',
        'artist-credit': [{ artist: { name: 'Radiohead' } }],
        'release-group': { 'primary-type': 'Album' },
        media: [
          {
            tracks: [
              {
                position: 1,
                title: 'You',
                recording: { title: 'You', length: 210000 },
              },
              {
                position: 2,
                title: 'Creep',
                recording: { title: 'Creep', length: 239000 },
              },
            ],
          },
        ],
      } as never)

      const album = await getAlbumDetails(client, 'rel-1')

      expect(album).not.toBeNull()
      expect(album!.title).toBe('Pablo Honey')
      expect(album!.artist).toBe('Radiohead')
      expect(album!.tracks).toHaveLength(2)
      expect(album!.tracks![0].title).toBe('You')
      expect(album!.tracks![1].title).toBe('Creep')
      expect(album!.trackCount).toBe(2)
    })

    it('should use track.title as fallback when recording.title is missing', async () => {
      ;(client.request as jest.Mock).mockResolvedValue({
        id: 'rel-1',
        title: 'Album',
        'artist-credit': [{ artist: { name: 'Artist' } }],
        media: [
          {
            tracks: [{ position: 1, title: 'Fallback Title' }],
          },
        ],
      } as never)

      const album = await getAlbumDetails(client, 'rel-1')

      expect(album!.tracks![0].title).toBe('Fallback Title')
    })

    it('should handle album with no media', async () => {
      ;(client.request as jest.Mock).mockResolvedValue({
        id: 'rel-1',
        title: 'Album',
        'artist-credit': [{ artist: { name: 'Artist' } }],
      } as never)

      const album = await getAlbumDetails(client, 'rel-1')

      expect(album!.tracks).toEqual([])
      expect(album!.trackCount).toBe(0)
    })

    it('should return null on error', async () => {
      ;(client.request as jest.Mock).mockRejectedValue(
        new Error('404') as never
      )

      const album = await getAlbumDetails(client, 'bad-id')

      expect(album).toBeNull()
    })
  })
})
