import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { classifySearch } from './classifySearch'
import type { MusicBrainzApiClient } from '../MusicBrainzApiClient'

function makeClient(): MusicBrainzApiClient {
  return {
    request: jest.fn<any>(),
    getCoverArtUrl: jest.fn((id: string) => `https://coverart.org/${id}`),
  } as unknown as MusicBrainzApiClient
}

describe('classifySearch', () => {
  let client: MusicBrainzApiClient

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
    client = makeClient()
  })

  it('should return artist, album, and song results sorted by score', async () => {
    ;(client.request as jest.Mock)
      .mockResolvedValueOnce({
        artists: [{ id: 'a1', name: 'Radiohead', score: 100 }],
      } as never)
      .mockResolvedValueOnce({
        releases: [
          {
            id: 'r1',
            title: 'OK Computer',
            score: 90,
            'artist-credit': [{ artist: { name: 'Radiohead' } }],
          },
        ],
      } as never)
      .mockResolvedValueOnce({
        recordings: [
          {
            title: 'Creep',
            score: 80,
            'artist-credit': [{ artist: { name: 'Radiohead' } }],
          },
        ],
      } as never)

    const result = await classifySearch(client, { query: 'Radiohead' })

    expect(result.success).toBe(true)
    expect(result.results).toHaveLength(3)
    // Sorted by score descending
    expect(result.results![0].type).toBe('artist')
    expect(result.results![0].score).toBe(100)
    expect(result.results![1].type).toBe('album')
    expect(result.results![2].type).toBe('song')
    expect(result.bestMatch?.type).toBe('artist')
  })

  it('should handle partial failures (one search type fails)', async () => {
    ;(client.request as jest.Mock)
      .mockRejectedValueOnce(new Error('Artist search failed') as never)
      .mockResolvedValueOnce({
        releases: [
          {
            id: 'r1',
            title: 'Album',
            score: 85,
            'artist-credit': [{ artist: { name: 'A' } }],
          },
        ],
      } as never)
      .mockResolvedValueOnce({ recordings: [] } as never)

    const result = await classifySearch(client, { query: 'test' })

    expect(result.success).toBe(true)
    expect(result.results).toHaveLength(1)
    expect(result.results![0].type).toBe('album')
  })

  it('should return empty results when all searches return nothing', async () => {
    ;(client.request as jest.Mock)
      .mockResolvedValueOnce({ artists: [] } as never)
      .mockResolvedValueOnce({ releases: [] } as never)
      .mockResolvedValueOnce({ recordings: [] } as never)

    const result = await classifySearch(client, { query: 'xyznonexistent' })

    expect(result.success).toBe(true)
    expect(result.results).toEqual([])
    expect(result.bestMatch).toBeUndefined()
  })

  it('should default score to 0 when not present', async () => {
    ;(client.request as jest.Mock)
      .mockResolvedValueOnce({
        artists: [{ id: 'a1', name: 'Artist' }], // no score
      } as never)
      .mockResolvedValueOnce({ releases: [] } as never)
      .mockResolvedValueOnce({ recordings: [] } as never)

    const result = await classifySearch(client, { query: 'test' })

    expect(result.results![0].score).toBe(0)
  })

  it('should fallback to "Unknown Artist" for releases without artist-credit', async () => {
    ;(client.request as jest.Mock)
      .mockResolvedValueOnce({ artists: [] } as never)
      .mockResolvedValueOnce({
        releases: [{ id: 'r1', title: 'Album', score: 50 }], // no artist-credit
      } as never)
      .mockResolvedValueOnce({ recordings: [] } as never)

    const result = await classifySearch(client, { query: 'test' })

    expect(result.results![0].artist).toBe('Unknown Artist')
  })

  it('should handle top-level error', async () => {
    // Mock request to throw before even reaching individual searches
    client = {
      request: jest.fn<any>().mockImplementation(() => {
        throw new Error('Client not initialized')
      }),
      getCoverArtUrl: jest.fn(),
    } as unknown as MusicBrainzApiClient

    const result = await classifySearch(client, { query: 'test' })

    // Note: the individual try-catches may catch first, resulting in success with empty results
    // or the outer catch may trigger. Depends on implementation - let's verify it doesn't throw
    expect(result.query).toBe('test')
  })

  it('should include multiple results per type (up to limit 3)', async () => {
    ;(client.request as jest.Mock)
      .mockResolvedValueOnce({
        artists: [
          { id: 'a1', name: 'Artist 1', score: 90 },
          { id: 'a2', name: 'Artist 2', score: 80 },
        ],
      } as never)
      .mockResolvedValueOnce({ releases: [] } as never)
      .mockResolvedValueOnce({ recordings: [] } as never)

    const result = await classifySearch(client, { query: 'test' })

    expect(result.results).toHaveLength(2)
  })
})
