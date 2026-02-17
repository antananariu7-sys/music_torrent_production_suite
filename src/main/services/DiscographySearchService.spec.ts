import { describe, it, expect, beforeEach } from '@jest/globals'
import { DiscographySearchService } from './DiscographySearchService'
import type { SearchResult } from '@shared/types/search.types'

// Mock AuthService
const mockAuthService = {
  getAuthStatus: () => ({ isLoggedIn: true, username: 'testuser' }),
  getSessionCookies: () => [],
} as any

describe('DiscographySearchService', () => {
  let service: DiscographySearchService

  beforeEach(() => {
    service = new DiscographySearchService(mockAuthService, { headless: true })
  })

  describe('isLikelyDiscography', () => {
    it('should return true for titles containing "discography"', () => {
      expect(service.isLikelyDiscography('Pink Floyd - Discography (1967-2014)')).toBe(true)
      expect(service.isLikelyDiscography('The Beatles Discography FLAC')).toBe(true)
    })

    it('should return true for titles containing "дискография" (Russian)', () => {
      expect(service.isLikelyDiscography('Pink Floyd - Дискография')).toBe(true)
    })

    it('should return true for titles containing "complete"', () => {
      expect(service.isLikelyDiscography('Pink Floyd - Complete Studio Albums')).toBe(true)
    })

    it('should return false for titles containing "collection" (classified as compilation)', () => {
      expect(service.isLikelyDiscography('The Best Collection 1967-2020')).toBe(false)
    })

    it('should return false for titles containing "anthology" (classified as compilation)', () => {
      expect(service.isLikelyDiscography('Led Zeppelin Anthology')).toBe(false)
    })

    it('should return true for titles containing "box set"', () => {
      expect(service.isLikelyDiscography('Pink Floyd - Box Set (16 CD)')).toBe(true)
    })

    it('should return true for titles containing "all albums"', () => {
      expect(service.isLikelyDiscography('Artist - All Albums Collection')).toBe(true)
    })

    it('should return false for single album titles', () => {
      expect(service.isLikelyDiscography('Pink Floyd - The Dark Side of the Moon (1973)')).toBe(false)
      expect(service.isLikelyDiscography('The Beatles - Abbey Road [FLAC]')).toBe(false)
    })

    it('should be case insensitive', () => {
      expect(service.isLikelyDiscography('DISCOGRAPHY')).toBe(true)
      expect(service.isLikelyDiscography('Discography')).toBe(true)
      expect(service.isLikelyDiscography('COMPLETE WORKS')).toBe(true)
    })
  })

  describe('filterDiscographyPages', () => {
    const createSearchResult = (title: string): SearchResult => ({
      id: '1',
      title,
      author: 'test',
      size: '1 GB',
      seeders: 10,
      leechers: 5,
      url: 'https://example.com',
    })

    it('should filter only discography pages', () => {
      const results: SearchResult[] = [
        createSearchResult('Pink Floyd - Discography (1967-2014) FLAC'),
        createSearchResult('Pink Floyd - The Dark Side of the Moon (1973) FLAC'),
        createSearchResult('Pink Floyd - Complete Studio Albums'),
        createSearchResult('Pink Floyd - Wish You Were Here (1975) MP3'),
      ]

      const filtered = service.filterDiscographyPages(results)

      expect(filtered).toHaveLength(2)
      expect(filtered[0].title).toContain('Discography')
      expect(filtered[1].title).toContain('Complete')
    })

    it('should return empty array when no discography pages found', () => {
      const results: SearchResult[] = [
        createSearchResult('Pink Floyd - The Dark Side of the Moon'),
        createSearchResult('Pink Floyd - Animals'),
      ]

      const filtered = service.filterDiscographyPages(results)

      expect(filtered).toHaveLength(0)
    })

    it('should handle empty input array', () => {
      const filtered = service.filterDiscographyPages([])

      expect(filtered).toHaveLength(0)
    })
  })

  describe('searchInPages', () => {
    it('should return error when user is not logged in', async () => {
      const notLoggedInAuthService = {
        getAuthStatus: () => ({ isLoggedIn: false }),
        getSessionCookies: () => [],
      } as any

      const serviceNotLoggedIn = new DiscographySearchService(notLoggedInAuthService)

      const result = await serviceNotLoggedIn.searchInPages({
        searchResults: [],
        albumName: 'Test Album',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not logged in')
    })

    it('should return empty results when no search results provided', async () => {
      const result = await service.searchInPages({
        searchResults: [],
        albumName: 'Test Album',
      })

      expect(result.success).toBe(true)
      expect(result.scanResults).toHaveLength(0)
      expect(result.matchedPages).toHaveLength(0)
      expect(result.totalScanned).toBe(0)
      expect(result.matchCount).toBe(0)
    })
  })
})

describe('Album parsing logic', () => {
  // Test the album entry parsing patterns that would be used in page.evaluate
  describe('album entry pattern matching', () => {
    const parseAlbumEntry = (rawText: string) => {
      const yearMatch = rawText.match(/^(\d{4})\s*-\s*/)
      const durationMatch = rawText.match(/\((\d{2}:\d{2}:\d{2})\)$/)
      const releaseInfoMatch = rawText.match(/\((\d{4},\s*[^)]+)\)/)

      let title = rawText
      if (yearMatch) {
        title = rawText.substring(yearMatch[0].length)
      }
      if (releaseInfoMatch) {
        title = title.replace(releaseInfoMatch[0], '').trim()
      }
      if (durationMatch) {
        title = title.replace(durationMatch[0], '').trim()
      }

      return {
        title: title.trim(),
        year: yearMatch ? yearMatch[1] : undefined,
        rawText,
        duration: durationMatch ? durationMatch[1] : undefined,
        releaseInfo: releaseInfoMatch ? releaseInfoMatch[1] : undefined,
      }
    }

    it('should parse standard discography entry format', () => {
      const entry = parseAlbumEntry(
        '1967 - The Piper At The Gates Of Dawn (1987, EMI CDP 7 46384 2, UK) (00:41:44)'
      )

      expect(entry.year).toBe('1967')
      expect(entry.title).toBe('The Piper At The Gates Of Dawn')
      expect(entry.duration).toBe('00:41:44')
      expect(entry.releaseInfo).toBe('1987, EMI CDP 7 46384 2, UK')
    })

    it('should parse entry without release info', () => {
      const entry = parseAlbumEntry('1973 - The Dark Side of the Moon (00:43:00)')

      expect(entry.year).toBe('1973')
      expect(entry.title).toBe('The Dark Side of the Moon')
      expect(entry.duration).toBe('00:43:00')
      expect(entry.releaseInfo).toBeUndefined()
    })

    it('should parse entry with only year and title', () => {
      const entry = parseAlbumEntry('1979 - The Wall')

      expect(entry.year).toBe('1979')
      expect(entry.title).toBe('The Wall')
      expect(entry.duration).toBeUndefined()
      expect(entry.releaseInfo).toBeUndefined()
    })

    it('should handle entry without year prefix', () => {
      const entry = parseAlbumEntry('Animals (1977) [FLAC]')

      expect(entry.year).toBeUndefined()
      expect(entry.title).toBe('Animals (1977) [FLAC]')
    })

    it('should parse multi-CD entry', () => {
      const entry = parseAlbumEntry(
        '1969 - Ummagumma (1986, EMI CDS 7 46404 8, W.Germany) - 2CD (01:26:16)'
      )

      expect(entry.year).toBe('1969')
      expect(entry.title).toContain('Ummagumma')
      expect(entry.duration).toBe('01:26:16')
    })
  })

  describe('album name matching', () => {
    const matchesAlbum = (
      albumTitle: string,
      rawText: string,
      targetAlbum: string,
      _artistName?: string
    ): boolean => {
      const titleLower = albumTitle.toLowerCase()
      const rawTextLower = rawText.toLowerCase()
      const targetLower = targetAlbum.toLowerCase()

      return titleLower.includes(targetLower) || rawTextLower.includes(targetLower)
    }

    it('should match exact album name', () => {
      expect(
        matchesAlbum(
          'The Dark Side of the Moon',
          '1973 - The Dark Side of the Moon',
          'The Dark Side of the Moon'
        )
      ).toBe(true)
    })

    it('should match partial album name', () => {
      expect(
        matchesAlbum('The Dark Side of the Moon', '1973 - The Dark Side of the Moon', 'Dark Side')
      ).toBe(true)
    })

    it('should be case insensitive', () => {
      expect(
        matchesAlbum(
          'The Dark Side of the Moon',
          '1973 - The Dark Side of the Moon',
          'dark side of the moon'
        )
      ).toBe(true)
    })

    it('should not match different album', () => {
      expect(
        matchesAlbum('The Dark Side of the Moon', '1973 - The Dark Side of the Moon', 'The Wall')
      ).toBe(false)
    })

    it('should match from raw text even if title is different', () => {
      expect(matchesAlbum('DSOTM', '1973 - The Dark Side of the Moon (DSOTM)', 'Dark Side')).toBe(
        true
      )
    })
  })
})
