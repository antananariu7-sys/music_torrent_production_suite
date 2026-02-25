import {
  classifyResult,
  groupResults,
  isLikelyDiscography,
  filterDiscographyPages,
} from './resultGrouper'
import type { SearchResult } from '@shared/types/search.types'

describe('resultGrouper', () => {
  const baseResult: SearchResult = {
    id: '1',
    title: 'Test Album',
    author: 'Test Author',
    size: '100 MB',
    seeders: 10,
    leechers: 5,
    url: 'https://example.com',
  }

  describe('classifyResult', () => {
    it('should classify discography pages (EN)', () => {
      expect(
        classifyResult({ ...baseResult, title: 'Artist - Discography (10 CD)' })
      ).toBe('discography')
      expect(
        classifyResult({ ...baseResult, title: 'Complete Albums Collection' })
      ).toBe('discography')
      expect(
        classifyResult({
          ...baseResult,
          title: 'Artist - All Albums - 1990-2020',
        })
      ).toBe('discography')
      expect(classifyResult({ ...baseResult, title: 'Box Set Edition' })).toBe(
        'discography'
      )
    })

    it('should classify discography pages (RU)', () => {
      expect(
        classifyResult({ ...baseResult, title: 'Ноль - Дискография (53 CD)' })
      ).toBe('discography')
    })

    it('should classify live albums', () => {
      expect(
        classifyResult({ ...baseResult, title: 'Artist - Live at Wembley' })
      ).toBe('live')
      expect(
        classifyResult({ ...baseResult, title: 'Concert in Moscow' })
      ).toBe('live')
      expect(classifyResult({ ...baseResult, title: 'World Tour 2020' })).toBe(
        'live'
      )
      expect(
        classifyResult({ ...baseResult, title: 'Bootleg Recording 1985' })
      ).toBe('live')
      expect(
        classifyResult({ ...baseResult, title: 'Концерт в Лужниках' })
      ).toBe('live')
    })

    it('should classify compilations', () => {
      expect(classifyResult({ ...baseResult, title: 'Best Of Artist' })).toBe(
        'compilation'
      )
      expect(
        classifyResult({ ...baseResult, title: 'Greatest Hits 2020' })
      ).toBe('compilation')
      expect(
        classifyResult({ ...baseResult, title: 'Collection of Songs' })
      ).toBe('compilation')
      expect(
        classifyResult({ ...baseResult, title: 'Anthology Volume 1' })
      ).toBe('compilation')
      expect(
        classifyResult({ ...baseResult, title: 'Сборник лучших песен' })
      ).toBe('compilation')
      expect(
        classifyResult({ ...baseResult, title: 'Compilation Album' })
      ).toBe('compilation')
    })

    it('should classify studio albums as default', () => {
      expect(
        classifyResult({ ...baseResult, title: 'Dark Side of the Moon' })
      ).toBe('studio')
      expect(
        classifyResult({
          ...baseResult,
          title: 'Artist - Album Name (2020, FLAC)',
        })
      ).toBe('studio')
      expect(
        classifyResult({
          ...baseResult,
          title: '(Rock) [CD] Nevermind - 1991, FLAC',
        })
      ).toBe('studio')
    })

    it('should handle case-insensitive matching', () => {
      expect(
        classifyResult({ ...baseResult, title: 'DISCOGRAPHY (10 CD)' })
      ).toBe('discography')
      expect(classifyResult({ ...baseResult, title: 'LIVE AT WEMBLEY' })).toBe(
        'live'
      )
      expect(classifyResult({ ...baseResult, title: 'BEST OF ARTIST' })).toBe(
        'compilation'
      )
    })

    it('should prioritize discography over other categories', () => {
      // A discography page with "live" in it should still be classified as discography
      expect(
        classifyResult({
          ...baseResult,
          title: 'Complete Discography (Live + Studio)',
        })
      ).toBe('discography')
    })

    it('should prioritize compilation over live', () => {
      // "Best of Live" should be compilation
      expect(
        classifyResult({ ...baseResult, title: 'Best Of Live Recordings' })
      ).toBe('compilation')
    })
  })

  describe('groupResults', () => {
    it('should group mixed results into categories', () => {
      const results: SearchResult[] = [
        { ...baseResult, id: '1', title: 'Studio Album One' },
        { ...baseResult, id: '2', title: 'Artist - Discography' },
        { ...baseResult, id: '3', title: 'Live at Wembley' },
        { ...baseResult, id: '4', title: 'Best Of Artist' },
        { ...baseResult, id: '5', title: 'Another Studio Album' },
      ]

      const groups = groupResults(results)

      expect(groups.albumMatch).toHaveLength(0)
      expect(groups.studio).toHaveLength(2)
      expect(groups.discography).toHaveLength(1)
      expect(groups.live).toHaveLength(1)
      expect(groups.compilation).toHaveLength(1)
      expect(groups.other).toHaveLength(0)
    })

    it('should return empty groups when no results', () => {
      const groups = groupResults([])

      expect(groups.albumMatch).toHaveLength(0)
      expect(groups.studio).toHaveLength(0)
      expect(groups.live).toHaveLength(0)
      expect(groups.compilation).toHaveLength(0)
      expect(groups.discography).toHaveLength(0)
      expect(groups.other).toHaveLength(0)
    })

    it('should preserve result order within groups', () => {
      const results: SearchResult[] = [
        { ...baseResult, id: '1', title: 'First Studio' },
        { ...baseResult, id: '2', title: 'Second Studio' },
        { ...baseResult, id: '3', title: 'Third Studio' },
      ]

      const groups = groupResults(results)

      expect(groups.studio[0].id).toBe('1')
      expect(groups.studio[1].id).toBe('2')
      expect(groups.studio[2].id).toBe('3')
    })

    it('should handle all results in one category', () => {
      const results: SearchResult[] = [
        { ...baseResult, id: '1', title: 'Live in Tokyo' },
        { ...baseResult, id: '2', title: 'Concert 2020' },
      ]

      const groups = groupResults(results)

      expect(groups.live).toHaveLength(2)
      expect(groups.studio).toHaveLength(0)
    })
  })

  describe('isLikelyDiscography', () => {
    it('should detect discography pages', () => {
      expect(isLikelyDiscography('Artist - Discography (10 CD)')).toBe(true)
      expect(isLikelyDiscography('Дискография (53 CD)')).toBe(true)
      expect(isLikelyDiscography('Complete Studio Albums')).toBe(true)
    })

    it('should not match non-discography pages', () => {
      expect(isLikelyDiscography('Dark Side of the Moon')).toBe(false)
      expect(isLikelyDiscography('Live at Wembley')).toBe(false)
    })
  })

  describe('filterDiscographyPages', () => {
    it('should filter only discography results', () => {
      const results: SearchResult[] = [
        { ...baseResult, id: '1', title: 'Studio Album' },
        { ...baseResult, id: '2', title: 'Artist - Discography' },
        { ...baseResult, id: '3', title: 'Live Concert' },
        { ...baseResult, id: '4', title: 'Дискография (10 CD)' },
      ]

      const filtered = filterDiscographyPages(results)

      expect(filtered).toHaveLength(2)
      expect(filtered[0].id).toBe('2')
      expect(filtered[1].id).toBe('4')
    })
  })
})
