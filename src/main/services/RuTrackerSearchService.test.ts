import { RuTrackerSearchService } from './RuTrackerSearchService'
import type { SearchResult, SearchFilters, SearchSort } from '@shared/types/search.types'
import type { AuthService } from './AuthService'

// Mock AuthService
const mockAuthService: AuthService = {
  getAuthStatus: () => ({ isLoggedIn: true, username: 'testuser' }),
  getSessionCookies: () => [],
  login: jest.fn(),
  logout: jest.fn(),
  cleanup: jest.fn(),
  getDebugInfo: jest.fn(),
} as any

describe('RuTrackerSearchService - Filtering and Sorting', () => {
  let service: RuTrackerSearchService

  beforeEach(() => {
    service = new RuTrackerSearchService(mockAuthService)
  })

  describe('File Format Detection', () => {
    it('should detect FLAC format from title', () => {
      const result = (service as any).detectFileFormat('Artist - Album [2024, FLAC]')
      expect(result).toBe('flac')
    })

    it('should detect MP3 format from title', () => {
      const result = (service as any).detectFileFormat('Artist - Album [MP3 320kbps]')
      expect(result).toBe('mp3')
    })

    it('should detect WAV format from title', () => {
      const result = (service as any).detectFileFormat('Artist - Album (WAV 24bit)')
      expect(result).toBe('wav')
    })

    it('should return undefined for unrecognized format', () => {
      const result = (service as any).detectFileFormat('Artist - Album')
      expect(result).toBeUndefined()
    })
  })

  describe('Size Parsing', () => {
    it('should parse GB correctly', () => {
      const result = (service as any).parseSizeToBytes('1.5 GB')
      expect(result).toBe(1.5 * 1024 * 1024 * 1024)
    })

    it('should parse MB correctly', () => {
      const result = (service as any).parseSizeToBytes('500 MB')
      expect(result).toBe(500 * 1024 * 1024)
    })

    it('should parse KB correctly', () => {
      const result = (service as any).parseSizeToBytes('250 KB')
      expect(result).toBe(250 * 1024)
    })

    it('should return undefined for invalid format', () => {
      const result = (service as any).parseSizeToBytes('invalid')
      expect(result).toBeUndefined()
    })
  })

  describe('Relevance Scoring', () => {
    const baseResult: SearchResult = {
      id: '1',
      title: '',
      author: 'Artist',
      size: '100 MB',
      seeders: 10,
      leechers: 5,
      url: 'https://example.com',
    }

    it('should give high score for exact title match', () => {
      const result = { ...baseResult, title: 'test query' }
      const score = (service as any).calculateRelevance(result, 'test query')
      expect(score).toBeGreaterThan(40)
    })

    it('should give medium score for partial match', () => {
      const result = { ...baseResult, title: 'test query album' }
      const score = (service as any).calculateRelevance(result, 'test query')
      expect(score).toBeGreaterThan(20)
    })

    it('should boost score for high seeders', () => {
      const lowSeeders = { ...baseResult, title: 'test', seeders: 1 }
      const highSeeders = { ...baseResult, title: 'test', seeders: 1000 }

      const scoreLow = (service as any).calculateRelevance(lowSeeders, 'test')
      const scoreHigh = (service as any).calculateRelevance(highSeeders, 'test')

      expect(scoreHigh).toBeGreaterThan(scoreLow)
    })

    it('should boost score for lossless formats', () => {
      const mp3Result = { ...baseResult, title: 'test', format: 'mp3' as const }
      const flacResult = { ...baseResult, title: 'test', format: 'flac' as const }

      const scoreMp3 = (service as any).calculateRelevance(mp3Result, 'test')
      const scoreFlac = (service as any).calculateRelevance(flacResult, 'test')

      expect(scoreFlac).toBeGreaterThan(scoreMp3)
    })
  })

  describe('Filtering', () => {
    const mockResults: SearchResult[] = [
      {
        id: '1',
        title: 'Album 1',
        author: 'Artist 1',
        size: '100 MB',
        sizeBytes: 100 * 1024 * 1024,
        seeders: 50,
        leechers: 10,
        url: 'https://example.com/1',
        format: 'flac',
      },
      {
        id: '2',
        title: 'Album 2',
        author: 'Artist 2',
        size: '50 MB',
        sizeBytes: 50 * 1024 * 1024,
        seeders: 5,
        leechers: 2,
        url: 'https://example.com/2',
        format: 'mp3',
      },
      {
        id: '3',
        title: 'Album 3',
        author: 'Artist 3',
        size: '200 MB',
        sizeBytes: 200 * 1024 * 1024,
        seeders: 100,
        leechers: 20,
        url: 'https://example.com/3',
        format: 'flac',
      },
    ]

    it('should filter by format', () => {
      const filters: SearchFilters = { format: 'flac' }
      const filtered = (service as any).applyFilters(mockResults, filters)

      expect(filtered).toHaveLength(2)
      expect(filtered.every((r: SearchResult) => r.format === 'flac')).toBe(true)
    })

    it('should filter by minimum seeders', () => {
      const filters: SearchFilters = { minSeeders: 40 }
      const filtered = (service as any).applyFilters(mockResults, filters)

      expect(filtered).toHaveLength(2)
      expect(filtered.every((r: SearchResult) => r.seeders >= 40)).toBe(true)
    })

    it('should filter by size range', () => {
      const filters: SearchFilters = { minSize: 75, maxSize: 150 }
      const filtered = (service as any).applyFilters(mockResults, filters)

      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('1')
    })

    it('should apply multiple filters', () => {
      const filters: SearchFilters = {
        format: 'flac',
        minSeeders: 75,
      }
      const filtered = (service as any).applyFilters(mockResults, filters)

      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('3')
    })
  })

  describe('Sorting', () => {
    const mockResults: SearchResult[] = [
      {
        id: '1',
        title: 'C Album',
        author: 'Artist',
        size: '100 MB',
        sizeBytes: 100 * 1024 * 1024,
        seeders: 50,
        leechers: 10,
        url: 'https://example.com/1',
        relevanceScore: 75,
      },
      {
        id: '2',
        title: 'A Album',
        author: 'Artist',
        size: '200 MB',
        sizeBytes: 200 * 1024 * 1024,
        seeders: 100,
        leechers: 20,
        url: 'https://example.com/2',
        relevanceScore: 90,
      },
      {
        id: '3',
        title: 'B Album',
        author: 'Artist',
        size: '50 MB',
        sizeBytes: 50 * 1024 * 1024,
        seeders: 25,
        leechers: 5,
        url: 'https://example.com/3',
        relevanceScore: 60,
      },
    ]

    it('should sort by relevance (descending)', () => {
      const sort: SearchSort = { by: 'relevance', order: 'desc' }
      const sorted = (service as any).applySorting(mockResults, sort)

      expect(sorted[0].id).toBe('2') // 90
      expect(sorted[1].id).toBe('1') // 75
      expect(sorted[2].id).toBe('3') // 60
    })

    it('should sort by seeders (descending)', () => {
      const sort: SearchSort = { by: 'seeders', order: 'desc' }
      const sorted = (service as any).applySorting(mockResults, sort)

      expect(sorted[0].seeders).toBe(100)
      expect(sorted[1].seeders).toBe(50)
      expect(sorted[2].seeders).toBe(25)
    })

    it('should sort by size (ascending)', () => {
      const sort: SearchSort = { by: 'size', order: 'asc' }
      const sorted = (service as any).applySorting(mockResults, sort)

      expect(sorted[0].id).toBe('3') // 50 MB
      expect(sorted[1].id).toBe('1') // 100 MB
      expect(sorted[2].id).toBe('2') // 200 MB
    })

    it('should sort by title (alphabetically)', () => {
      const sort: SearchSort = { by: 'title', order: 'asc' }
      const sorted = (service as any).applySorting(mockResults, sort)

      expect(sorted[0].title).toBe('A Album')
      expect(sorted[1].title).toBe('B Album')
      expect(sorted[2].title).toBe('C Album')
    })
  })
})
