import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals'
import { MusicBrainzApiClient } from './MusicBrainzApiClient'

// Mock retryWithBackoff to execute the function directly (no retry delays)
jest.mock('../utils/retryWithBackoff', () => ({
  retryWithBackoff: jest.fn(async (fn: () => Promise<unknown>) => fn()),
}))

// Mock global fetch
const mockFetch = jest.fn() as jest.Mock
;(globalThis as any).fetch = mockFetch

function makeResponse(status: number, body: unknown, statusText = 'OK') {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: jest.fn().mockResolvedValue(body),
  }
}

describe('MusicBrainzApiClient', () => {
  let client: MusicBrainzApiClient

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    client = new MusicBrainzApiClient()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('request', () => {
    it('should return parsed JSON on success', async () => {
      const responseBody = { artists: [{ name: 'Pink Floyd' }] }
      mockFetch.mockResolvedValueOnce(makeResponse(200, responseBody))

      const result = await client.request('artist', {
        query: 'Pink Floyd',
        fmt: 'json',
      })

      expect(result).toEqual(responseBody)
    })

    it('should throw on non-OK response', async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(404, null, 'Not Found'))

      await expect(
        client.request('artist', { query: 'nonexistent', fmt: 'json' })
      ).rejects.toThrow('MusicBrainz API error: 404 Not Found')
    })

    it('should throw on 503 server error', async () => {
      mockFetch.mockResolvedValueOnce(
        makeResponse(503, null, 'Service Unavailable')
      )

      await expect(
        client.request('artist', { query: 'test', fmt: 'json' })
      ).rejects.toThrow('503')
    })

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('fetch failed'))

      await expect(
        client.request('artist', { query: 'test', fmt: 'json' })
      ).rejects.toThrow('fetch failed')
    })

    it('should build correct URL with params', async () => {
      const responseBody = { releases: [] }
      mockFetch.mockResolvedValueOnce(makeResponse(200, responseBody))

      await client.request('release', { query: 'test album', fmt: 'json' })

      const calledUrl = mockFetch.mock.calls[0][0] as string
      expect(calledUrl).toContain('musicbrainz.org/ws/2/release')
      expect(calledUrl).toContain('query=test+album')
      expect(calledUrl).toContain('fmt=json')
    })

    it('should include User-Agent header', async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, {}))

      await client.request('artist', { query: 'test', fmt: 'json' })

      const headers = (
        mockFetch.mock.calls[0][1] as { headers: Record<string, string> }
      ).headers
      expect(headers['User-Agent']).toContain('MusicProductionSuite')
    })
  })

  describe('getCoverArtUrl', () => {
    it('should build correct cover art URL', () => {
      const url = client.getCoverArtUrl('abc-123')
      expect(url).toBe('https://coverartarchive.org/release/abc-123/front-250')
    })
  })

  describe('rate limiting', () => {
    it('should delay sequential requests to respect rate limit', async () => {
      mockFetch.mockResolvedValue(makeResponse(200, {}))

      // First request — no delay
      await client.request('artist', { query: 'first', fmt: 'json' })

      // Advance time by 500ms (less than 1000ms rate limit)
      jest.advanceTimersByTime(500)

      // Second request should be delayed
      const secondPromise = client.request('artist', {
        query: 'second',
        fmt: 'json',
      })

      // Advance remaining time for rate limit
      jest.advanceTimersByTime(500)

      await secondPromise

      // Both requests should succeed
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })
})
