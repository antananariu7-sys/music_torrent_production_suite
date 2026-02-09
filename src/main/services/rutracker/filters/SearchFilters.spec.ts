import { SearchFiltersApplier } from './SearchFilters'
import type { SearchResult, SearchFilters, SearchSort } from '@shared/types/search.types'

describe('SearchFiltersApplier', () => {
  let applier: SearchFiltersApplier
  let mockResults: SearchResult[]

  beforeEach(() => {
    applier = new SearchFiltersApplier()
    mockResults = [
      {
        id: '1',
        title: 'First Result',
        author: 'Author 1',
        size: '100 MB',
        sizeBytes: 100 * 1024 * 1024,
        seeders: 50,
        leechers: 10,
        url: 'https://example.com/1',
        format: 'flac',
        relevanceScore: 80,
      },
      {
        id: '2',
        title: 'Second Result',
        author: 'Author 2',
        size: '200 MB',
        sizeBytes: 200 * 1024 * 1024,
        seeders: 30,
        leechers: 5,
        url: 'https://example.com/2',
        format: 'mp3',
        relevanceScore: 60,
      },
      {
        id: '3',
        title: 'Third Result',
        author: 'Author 3',
        size: '50 MB',
        sizeBytes: 50 * 1024 * 1024,
        seeders: 100,
        leechers: 20,
        url: 'https://example.com/3',
        format: 'flac',
        relevanceScore: 90,
      },
    ]
  })

  describe('applyFilters', () => {
    it('should filter by format', () => {
      const filters: SearchFilters = { format: 'flac' }
      const filtered = applier.applyFilters(mockResults, filters)

      expect(filtered).toHaveLength(2)
      expect(filtered.every(r => r.format === 'flac')).toBe(true)
    })

    it('should filter by minimum seeders', () => {
      const filters: SearchFilters = { minSeeders: 40 }
      const filtered = applier.applyFilters(mockResults, filters)

      expect(filtered).toHaveLength(2)
      expect(filtered.every(r => r.seeders >= 40)).toBe(true)
    })

    it('should filter by size range', () => {
      const filters: SearchFilters = { minSize: 75, maxSize: 150 }
      const filtered = applier.applyFilters(mockResults, filters)

      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('1')
    })

    it('should apply multiple filters', () => {
      const filters: SearchFilters = {
        format: 'flac',
        minSeeders: 75,
      }
      const filtered = applier.applyFilters(mockResults, filters)

      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('3')
      expect(filtered[0].format).toBe('flac')
      expect(filtered[0].seeders).toBeGreaterThanOrEqual(75)
    })

    it('should return all results when no filters match', () => {
      const filters: SearchFilters = {}
      const filtered = applier.applyFilters(mockResults, filters)

      expect(filtered).toHaveLength(3)
    })

    it('should return empty array when no results match filters', () => {
      const filters: SearchFilters = { minSeeders: 200 }
      const filtered = applier.applyFilters(mockResults, filters)

      expect(filtered).toHaveLength(0)
    })
  })

  describe('applySorting', () => {
    it('should sort by relevance (descending)', () => {
      const sort: SearchSort = { by: 'relevance', order: 'desc' }
      const sorted = applier.applySorting(mockResults, sort)

      expect(sorted[0].id).toBe('3') // relevanceScore: 90
      expect(sorted[1].id).toBe('1') // relevanceScore: 80
      expect(sorted[2].id).toBe('2') // relevanceScore: 60
    })

    it('should sort by seeders (descending)', () => {
      const sort: SearchSort = { by: 'seeders', order: 'desc' }
      const sorted = applier.applySorting(mockResults, sort)

      expect(sorted[0].id).toBe('3') // 100 seeders
      expect(sorted[1].id).toBe('1') // 50 seeders
      expect(sorted[2].id).toBe('2') // 30 seeders
    })

    it('should sort by size (ascending)', () => {
      const sort: SearchSort = { by: 'size', order: 'asc' }
      const sorted = applier.applySorting(mockResults, sort)

      expect(sorted[0].id).toBe('3') // 50 MB
      expect(sorted[1].id).toBe('1') // 100 MB
      expect(sorted[2].id).toBe('2') // 200 MB
    })

    it('should sort by title (alphabetically)', () => {
      const sort: SearchSort = { by: 'title', order: 'asc' }
      const sorted = applier.applySorting(mockResults, sort)

      expect(sorted[0].title).toBe('First Result')
      expect(sorted[1].title).toBe('Second Result')
      expect(sorted[2].title).toBe('Third Result')
    })

    it('should sort by title (reverse alphabetically)', () => {
      const sort: SearchSort = { by: 'title', order: 'desc' }
      const sorted = applier.applySorting(mockResults, sort)

      expect(sorted[0].title).toBe('Third Result')
      expect(sorted[1].title).toBe('Second Result')
      expect(sorted[2].title).toBe('First Result')
    })

    it('should not mutate original array', () => {
      const originalIds = mockResults.map(r => r.id)
      const sort: SearchSort = { by: 'seeders', order: 'desc' }

      applier.applySorting(mockResults, sort)

      expect(mockResults.map(r => r.id)).toEqual(originalIds)
    })
  })
})
