import { MusicBrainzService } from './MusicBrainzService'
import type { MusicBrainzAlbum } from '@shared/types/musicbrainz.types'

// Mock fetch globally
global.fetch = jest.fn()

describe('MusicBrainzService', () => {
  let service: MusicBrainzService

  beforeEach(() => {
    service = new MusicBrainzService()
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  /** Advance fake timers through all retry delays */
  async function flushRetries() {
    // Advance timers in steps to properly interleave with async code
    for (let i = 0; i < 10; i++) {
      await jest.advanceTimersByTimeAsync(10000)
    }
  }

  describe('createRuTrackerQuery', () => {
    it('should create correct query from album info', () => {
      const album: MusicBrainzAlbum = {
        id: '123',
        title: 'Thriller',
        artist: 'Michael Jackson',
      }

      const query = service.createRuTrackerQuery(album)
      expect(query).toBe('Michael Jackson - Thriller')
    })

    it('should handle albums with special characters', () => {
      const album: MusicBrainzAlbum = {
        id: '456',
        title: 'The Dark Side of the Moon',
        artist: 'Pink Floyd',
      }

      const query = service.createRuTrackerQuery(album)
      expect(query).toBe('Pink Floyd - The Dark Side of the Moon')
    })
  })

  describe('findAlbumsBySong', () => {
    it('should return albums containing the song', async () => {
      const mockResponse = {
        recordings: [
          {
            score: 100,
            'artist-credit': [{ artist: { name: 'The Beatles' } }],
            releases: [
              {
                id: 'album1',
                title: 'Abbey Road',
                date: '1969-09-26',
                'track-count': 17,
                'release-group': {
                  'primary-type': 'Album',
                },
              },
            ],
          },
        ],
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await service.findAlbumsBySong({
        songTitle: 'Come Together',
        artist: 'The Beatles',
      })

      expect(result.success).toBe(true)
      expect(result.albums).toHaveLength(1)
      expect(result.albums![0].title).toBe('Abbey Road')
      expect(result.albums![0].artist).toBe('The Beatles')
    })

    it('should handle API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })

      const promise = service.findAlbumsBySong({
        songTitle: 'Test Song',
      })

      await flushRetries()

      const result = await promise

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should return empty array when no recordings found', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ recordings: [] }),
      })

      const result = await service.findAlbumsBySong({
        songTitle: 'Nonexistent Song',
      })

      expect(result.success).toBe(true)
      expect(result.albums).toHaveLength(0)
    })
  })

  describe('getAlbumDetails', () => {
    it('should fetch album details with track list', async () => {
      const mockResponse = {
        id: 'album1',
        title: 'Abbey Road',
        date: '1969-09-26',
        'artist-credit': [{ name: 'The Beatles' }],
        'release-group': {
          'primary-type': 'Album',
        },
        media: [
          {
            tracks: [
              {
                position: 1,
                title: 'Come Together',
                recording: {
                  title: 'Come Together',
                  length: 259000,
                },
              },
              {
                position: 2,
                title: 'Something',
                recording: {
                  title: 'Something',
                  length: 182000,
                },
              },
            ],
          },
        ],
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      })

      const album = await service.getAlbumDetails('album1')

      expect(album).not.toBeNull()
      expect(album!.title).toBe('Abbey Road')
      expect(album!.tracks).toHaveLength(2)
      expect(album!.tracks![0].title).toBe('Come Together')
      expect(album!.tracks![0].duration).toBe(259000)
    })

    it('should handle missing tracks gracefully', async () => {
      const mockResponse = {
        id: 'album1',
        title: 'Test Album',
        'artist-credit': [{ name: 'Test Artist' }],
        media: [],
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      })

      const album = await service.getAlbumDetails('album1')

      expect(album).not.toBeNull()
      expect(album!.tracks).toHaveLength(0)
    })

    it('should return null on error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      const promise = service.getAlbumDetails('album1')

      await flushRetries()

      const album = await promise

      expect(album).toBeNull()
    })
  })

  describe('Rate Limiting', () => {
    it('should respect 1 second rate limit', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ recordings: [] }),
      }

      ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

      // First request completes immediately
      await service.findAlbumsBySong({ songTitle: 'Test 1' })

      // Second request triggers rate limiter - start it and advance timers
      const secondRequest = service.findAlbumsBySong({ songTitle: 'Test 2' })
      await jest.advanceTimersByTimeAsync(1100)
      await secondRequest

      // Both calls should have gone through
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })
})
