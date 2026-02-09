import { calculateRelevance, calculateRelevanceScores } from './relevanceScorer'
import type { SearchResult } from '@shared/types/search.types'

describe('relevanceScorer', () => {
  const baseResult: SearchResult = {
    id: '1',
    title: 'Test Album',
    author: 'Test Author',
    size: '100 MB',
    seeders: 10,
    leechers: 5,
    url: 'https://example.com',
  }

  describe('calculateRelevance', () => {
    it('should give high score for exact title match', () => {
      const result = { ...baseResult, title: 'test query' }
      const score = calculateRelevance(result, 'test query')
      expect(score).toBeGreaterThanOrEqual(40)
    })

    it('should give medium score for partial match', () => {
      const result = { ...baseResult, title: 'test query album' }
      const score = calculateRelevance(result, 'test query')
      expect(score).toBeGreaterThanOrEqual(30)
    })

    it('should give score for word matches', () => {
      const result = { ...baseResult, title: 'test album music' }
      const score = calculateRelevance(result, 'test music')
      expect(score).toBeGreaterThanOrEqual(20)
    })

    it('should boost score for high seeders', () => {
      const lowSeeders = { ...baseResult, title: 'test', seeders: 1 }
      const highSeeders = { ...baseResult, title: 'test', seeders: 1000 }

      const lowScore = calculateRelevance(lowSeeders, 'test')
      const highScore = calculateRelevance(highSeeders, 'test')

      expect(highScore).toBeGreaterThan(lowScore)
    })

    it('should boost score for lossless formats', () => {
      const mp3Result = { ...baseResult, title: 'test', format: 'mp3' as const }
      const flacResult = { ...baseResult, title: 'test', format: 'flac' as const }

      const mp3Score = calculateRelevance(mp3Result, 'test')
      const flacScore = calculateRelevance(flacResult, 'test')

      expect(flacScore).toBeGreaterThan(mp3Score)
    })

    it('should not exceed score of 100', () => {
      const result = {
        ...baseResult,
        title: 'test query',
        seeders: 10000,
        format: 'flac' as const,
      }
      const score = calculateRelevance(result, 'test query')
      expect(score).toBeLessThanOrEqual(100)
    })
  })

  describe('calculateRelevanceScores', () => {
    it('should add relevance scores to all results', () => {
      const results: SearchResult[] = [
        { ...baseResult, id: '1', title: 'exact match' },
        { ...baseResult, id: '2', title: 'partial exact match result' },
        { ...baseResult, id: '3', title: 'other result' },
      ]

      const scored = calculateRelevanceScores(results, 'exact match')

      expect(scored).toHaveLength(3)
      scored.forEach(result => {
        expect(result.relevanceScore).toBeDefined()
        expect(typeof result.relevanceScore).toBe('number')
      })
    })

    it('should maintain result order', () => {
      const results: SearchResult[] = [
        { ...baseResult, id: '1', title: 'first' },
        { ...baseResult, id: '2', title: 'second' },
        { ...baseResult, id: '3', title: 'third' },
      ]

      const scored = calculateRelevanceScores(results, 'query')

      expect(scored[0].id).toBe('1')
      expect(scored[1].id).toBe('2')
      expect(scored[2].id).toBe('3')
    })
  })
})
