import { isFlacImage } from './flacImageDetector'
import type { SearchResult } from '@shared/types/search.types'

/** Helper to create a minimal SearchResult */
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

const MB = 1024 * 1024

describe('isFlacImage', () => {
  describe('keyword detection in title', () => {
    it('should detect "image" keyword', () => {
      expect(isFlacImage(makeResult('Artist - Album (image)'))).toBe(true)
    })

    it('should detect "img" keyword', () => {
      expect(isFlacImage(makeResult('Artist - Album IMG'))).toBe(true)
    })

    it('should detect "cue" keyword', () => {
      expect(isFlacImage(makeResult('Artist - Album + CUE'))).toBe(true)
    })

    it('should detect Cyrillic "образ"', () => {
      expect(isFlacImage(makeResult('Артист - Альбом (образ)'))).toBe(true)
    })

    it('should detect "ape+cue"', () => {
      expect(isFlacImage(makeResult('Artist - Album [APE+CUE]'))).toBe(true)
    })

    it('should detect "flac+cue"', () => {
      expect(isFlacImage(makeResult('Artist - Album [FLAC+CUE]'))).toBe(true)
    })

    it('should be case-insensitive for keywords', () => {
      expect(isFlacImage(makeResult('Artist - Album IMAGE'))).toBe(true)
      expect(isFlacImage(makeResult('Artist - Album Image'))).toBe(true)
    })

    it('should match keyword as substring', () => {
      // "image" is substring of "imagery" — will match because includes() check
      expect(isFlacImage(makeResult('Digital Imagery Collection'))).toBe(true)
    })

    it('should NOT detect when no keywords and small size', () => {
      expect(isFlacImage(makeResult('Artist - Regular Album'))).toBe(false)
    })
  })

  describe('large file detection for lossless formats', () => {
    it('should detect FLAC format with size > 500 MB', () => {
      expect(
        isFlacImage(
          makeResult('Artist - Album', {
            format: 'flac',
            sizeBytes: 600 * MB,
          })
        )
      ).toBe(true)
    })

    it('should detect APE format with size > 500 MB', () => {
      expect(
        isFlacImage(
          makeResult('Artist - Album', {
            format: 'ape',
            sizeBytes: 600 * MB,
          })
        )
      ).toBe(true)
    })

    it('should NOT flag FLAC below threshold', () => {
      expect(
        isFlacImage(
          makeResult('Artist - Album', {
            format: 'flac',
            sizeBytes: 400 * MB,
          })
        )
      ).toBe(false)
    })

    it('should NOT flag MP3 even if large', () => {
      expect(
        isFlacImage(
          makeResult('Artist - Album', {
            format: 'mp3',
            sizeBytes: 600 * MB,
          })
        )
      ).toBe(false)
    })

    it('should NOT flag FLAC without sizeBytes', () => {
      expect(
        isFlacImage(
          makeResult('Artist - Album', {
            format: 'flac',
          })
        )
      ).toBe(false)
    })

    it('should detect lowercase format values', () => {
      expect(
        isFlacImage(
          makeResult('Artist - Album', {
            format: 'flac',
            sizeBytes: 600 * MB,
          })
        )
      ).toBe(true)
    })
  })
})
