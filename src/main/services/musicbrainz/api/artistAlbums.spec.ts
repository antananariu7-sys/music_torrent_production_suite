import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { getArtistAlbums } from './artistAlbums'
import type { MusicBrainzApiClient } from '../MusicBrainzApiClient'

function makeClient(): MusicBrainzApiClient {
  return {
    request: jest.fn<any>(),
    getCoverArtUrl: jest.fn((id: string) => `https://coverart.org/${id}`),
  } as unknown as MusicBrainzApiClient
}

describe('artistAlbums', () => {
  let client: MusicBrainzApiClient

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
    client = makeClient()
  })

  describe('getArtistAlbums', () => {
    it('should return artist info and albums', async () => {
      ;(client.request as jest.Mock)
        .mockResolvedValueOnce({
          id: 'a1',
          name: 'Radiohead',
          type: 'Group',
        } as never)
        .mockResolvedValueOnce({
          releases: [
            {
              id: 'r1',
              title: 'OK Computer',
              date: '1997-05-21',
              'release-group': { 'primary-type': 'Album' },
              'track-count': 12,
            },
            {
              id: 'r2',
              title: 'Kid A',
              date: '2000-10-02',
              'release-group': { 'primary-type': 'Album' },
              'track-count': 10,
            },
          ],
        } as never)

      const result = await getArtistAlbums(client, { artistId: 'a1' })

      expect(result.success).toBe(true)
      expect(result.artist).toEqual({
        id: 'a1',
        name: 'Radiohead',
        type: 'Group',
      })
      expect(result.albums).toHaveLength(2)
      expect(result.albums![0].title).toBe('OK Computer')
      expect(result.albums![0].artist).toBe('Radiohead')
      expect(result.albums![0].type).toBe('album')
      expect(result.albums![0].coverArtUrl).toBe('https://coverart.org/r1')
    })

    it('should use default limit of 50', async () => {
      ;(client.request as jest.Mock)
        .mockResolvedValueOnce({ id: 'a1', name: 'A', type: 'Person' } as never)
        .mockResolvedValueOnce({ releases: [] } as never)

      await getArtistAlbums(client, { artistId: 'a1' })

      expect(client.request).toHaveBeenCalledWith('release', {
        artist: 'a1',
        limit: '50',
        fmt: 'json',
      })
    })

    it('should use custom limit when provided', async () => {
      ;(client.request as jest.Mock)
        .mockResolvedValueOnce({ id: 'a1', name: 'A', type: 'Person' } as never)
        .mockResolvedValueOnce({ releases: [] } as never)

      await getArtistAlbums(client, { artistId: 'a1', limit: 100 })

      expect(client.request).toHaveBeenCalledWith('release', {
        artist: 'a1',
        limit: '100',
        fmt: 'json',
      })
    })

    it('should return empty albums when no releases', async () => {
      ;(client.request as jest.Mock)
        .mockResolvedValueOnce({
          id: 'a1',
          name: 'New Artist',
          type: 'Person',
        } as never)
        .mockResolvedValueOnce({ releases: [] } as never)

      const result = await getArtistAlbums(client, { artistId: 'a1' })

      expect(result.success).toBe(true)
      expect(result.albums).toEqual([])
    })

    it('should handle missing release-group primary-type', async () => {
      ;(client.request as jest.Mock)
        .mockResolvedValueOnce({ id: 'a1', name: 'A', type: 'Group' } as never)
        .mockResolvedValueOnce({
          releases: [{ id: 'r1', title: 'Album', date: '2024' }],
        } as never)

      const result = await getArtistAlbums(client, { artistId: 'a1' })

      expect(result.albums![0].type).toBeUndefined()
    })

    it('should return error on API failure', async () => {
      ;(client.request as jest.Mock).mockRejectedValue(
        new Error('Not found') as never
      )

      const result = await getArtistAlbums(client, { artistId: 'bad-id' })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Not found')
    })
  })
})
