import {
  buildSearchUrl,
  RUTRACKER_BASE_URL,
  RESULTS_PER_PAGE,
} from './urlBuilder'

describe('urlBuilder', () => {
  describe('buildSearchUrl', () => {
    it('should build URL for page 1 without start offset', () => {
      const url = buildSearchUrl('Pink Floyd')
      expect(url).toBe(
        'https://rutracker.org/forum/tracker.php?nm=Pink%20Floyd'
      )
    })

    it('should build URL for page 2 with start offset', () => {
      const url = buildSearchUrl('Pink Floyd', 2)
      expect(url).toBe(
        'https://rutracker.org/forum/tracker.php?nm=Pink%20Floyd&start=50'
      )
    })

    it('should build URL for page 3 with correct offset', () => {
      const url = buildSearchUrl('Pink Floyd', 3)
      expect(url).toBe(
        'https://rutracker.org/forum/tracker.php?nm=Pink%20Floyd&start=100'
      )
    })

    it('should encode special characters in query', () => {
      const url = buildSearchUrl('AC/DC & Friends')
      expect(url).toContain('nm=AC%2FDC%20%26%20Friends')
    })

    it('should encode Cyrillic characters', () => {
      const url = buildSearchUrl('Кино')
      expect(url).toContain('nm=%D0%9A%D0%B8%D0%BD%D0%BE')
    })

    it('should handle empty query', () => {
      const url = buildSearchUrl('')
      expect(url).toBe('https://rutracker.org/forum/tracker.php?nm=')
    })

    it('should default to page 1 when no page specified', () => {
      const url = buildSearchUrl('test')
      expect(url).not.toContain('start=')
    })
  })

  describe('constants', () => {
    it('should export correct base URL', () => {
      expect(RUTRACKER_BASE_URL).toBe('https://rutracker.org/forum/')
    })

    it('should export correct results per page', () => {
      expect(RESULTS_PER_PAGE).toBe(50)
    })
  })
})
