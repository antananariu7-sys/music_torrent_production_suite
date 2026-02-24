import {
  isLikelyDiscography,
  classifyResult,
  groupResults,
  filterDiscographyPages,
} from './resultClassifier'
import type { SearchResult } from '@shared/types/search.types'

/** Helper to create a minimal SearchResult with a given title */
function makeResult(
  title: string,
  overrides?: Partial<SearchResult>
): SearchResult {
  return {
    id: '1',
    title,
    author: 'Test',
    size: '100 MB',
    seeders: 10,
    leechers: 2,
    url: 'https://example.com',
    ...overrides,
  }
}

describe('resultClassifier', () => {
  describe('isLikelyDiscography', () => {
    it('should detect "discography" (case-insensitive)', () => {
      expect(isLikelyDiscography('Artist - Discography (1990-2020)')).toBe(true)
      expect(isLikelyDiscography('DISCOGRAPHY')).toBe(true)
      expect(isLikelyDiscography('discography')).toBe(true)
    })

    it('should detect Cyrillic "дискография"', () => {
      expect(isLikelyDiscography('Артист - Дискография')).toBe(true)
    })

    it('should detect "complete" and "all albums"', () => {
      expect(isLikelyDiscography('Complete Studio Albums')).toBe(true)
      expect(isLikelyDiscography('All Albums Collection')).toBe(true)
    })

    it('should detect "box set"', () => {
      expect(isLikelyDiscography('Artist - Box Set (10CD)')).toBe(true)
    })

    it('should NOT match regular album titles', () => {
      expect(isLikelyDiscography('Thriller')).toBe(false)
      expect(isLikelyDiscography('Dark Side of the Moon')).toBe(false)
      expect(isLikelyDiscography('Abbey Road')).toBe(false)
    })

    it('should handle empty string', () => {
      expect(isLikelyDiscography('')).toBe(false)
    })

    it('should match keyword as substring', () => {
      // "discography" inside a compound word still matches
      expect(isLikelyDiscography('methodiscography')).toBe(true)
    })
  })

  describe('classifyResult', () => {
    it('should classify discography results', () => {
      expect(classifyResult(makeResult('Artist - Discography'))).toBe(
        'discography'
      )
    })

    it('should classify live results', () => {
      expect(classifyResult(makeResult('Artist - Live at Wembley'))).toBe(
        'live'
      )
      expect(classifyResult(makeResult('Concert Recording 2020'))).toBe('live')
      expect(classifyResult(makeResult('World Tour 2019'))).toBe('live')
      expect(classifyResult(makeResult('Bootleg from NYC'))).toBe('live')
    })

    it('should classify compilation results', () => {
      expect(classifyResult(makeResult('Best of Artist'))).toBe('compilation')
      expect(classifyResult(makeResult('Greatest Hits'))).toBe('compilation')
      expect(classifyResult(makeResult('Anthology 1962-1966'))).toBe(
        'compilation'
      )
      expect(classifyResult(makeResult('Сборник лучших песен'))).toBe(
        'compilation'
      )
    })

    it('should classify regular albums as studio', () => {
      expect(classifyResult(makeResult('Thriller'))).toBe('studio')
      expect(classifyResult(makeResult('Dark Side of the Moon'))).toBe('studio')
    })

    it('should prioritize discography over other classifications', () => {
      // Contains both "complete" (discography) and "collection" (compilation)
      expect(classifyResult(makeResult('Complete Collection'))).toBe(
        'discography'
      )
    })
  })

  describe('groupResults', () => {
    it('should group mixed results into categories', () => {
      const results = [
        makeResult('Thriller', { id: '1' }),
        makeResult('Live at Wembley', { id: '2' }),
        makeResult('Greatest Hits', { id: '3' }),
        makeResult('Discography 1990-2020', { id: '4' }),
        makeResult('Abbey Road', { id: '5' }),
      ]

      const groups = groupResults(results)
      expect(groups.studio).toHaveLength(2)
      expect(groups.live).toHaveLength(1)
      expect(groups.compilation).toHaveLength(1)
      expect(groups.discography).toHaveLength(1)
      expect(groups.other).toHaveLength(0)
    })

    it('should return empty groups for empty input', () => {
      const groups = groupResults([])
      expect(groups.studio).toHaveLength(0)
      expect(groups.live).toHaveLength(0)
      expect(groups.compilation).toHaveLength(0)
      expect(groups.discography).toHaveLength(0)
      expect(groups.other).toHaveLength(0)
    })

    it('should handle single item', () => {
      const groups = groupResults([makeResult('Thriller')])
      expect(groups.studio).toHaveLength(1)
      expect(groups.live).toHaveLength(0)
    })
  })

  describe('filterDiscographyPages', () => {
    it('should return only discography results', () => {
      const results = [
        makeResult('Thriller', { id: '1' }),
        makeResult('Discography 1990-2020', { id: '2' }),
        makeResult('Abbey Road', { id: '3' }),
        makeResult('Complete Albums', { id: '4' }),
      ]

      const filtered = filterDiscographyPages(results)
      expect(filtered).toHaveLength(2)
      expect(filtered[0].id).toBe('2')
      expect(filtered[1].id).toBe('4')
    })

    it('should return empty array when no discographies found', () => {
      const results = [makeResult('Thriller'), makeResult('Abbey Road')]
      expect(filterDiscographyPages(results)).toHaveLength(0)
    })

    it('should return empty array for empty input', () => {
      expect(filterDiscographyPages([])).toHaveLength(0)
    })
  })
})
