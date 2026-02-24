import { isSongMatch } from './songMatcher'

describe('songMatcher', () => {
  describe('isSongMatch', () => {
    it('should match exact titles', () => {
      expect(isSongMatch('Blue Monday', 'Blue Monday')).toBe(true)
    })

    it('should match case-insensitively', () => {
      expect(isSongMatch('blue monday', 'Blue Monday')).toBe(true)
      expect(isSongMatch('BLUE MONDAY', 'blue monday')).toBe(true)
    })

    it('should match when track has parenthetical suffix', () => {
      expect(isSongMatch('Blue Monday (Extended Mix)', 'Blue Monday')).toBe(
        true
      )
      expect(isSongMatch('Blue Monday (Remastered 2020)', 'Blue Monday')).toBe(
        true
      )
    })

    it('should match when track has bracketed suffix', () => {
      expect(isSongMatch('Blue Monday [Bonus Track]', 'Blue Monday')).toBe(true)
    })

    it('should match when track has "feat." suffix', () => {
      expect(isSongMatch('Blue Monday feat. Someone', 'Blue Monday')).toBe(true)
    })

    it('should match identical punctuation after normalization', () => {
      expect(isSongMatch("Don't Stop Me Now", "Don't Stop Me Now")).toBe(true)
    })

    it('should NOT match when apostrophe creates different tokens', () => {
      // "Don't" → "don t" vs "Dont" → "dont" — different after normalization
      expect(isSongMatch("Don't Stop", 'Dont Stop')).toBe(false)
    })

    it('should NOT match completely different songs', () => {
      expect(isSongMatch('Blue Monday', 'Bizarre Love Triangle')).toBe(false)
      expect(isSongMatch('Yesterday', 'Tomorrow Never Knows')).toBe(false)
    })

    it('should return false for empty song name', () => {
      expect(isSongMatch('Blue Monday', '')).toBe(false)
      expect(isSongMatch('Blue Monday', '   ')).toBe(false)
    })

    it('should handle reverse containment for longer search', () => {
      // Song name contains normalized track title (track title > 3 chars)
      expect(isSongMatch('Blue Monday', 'Blue Monday Extended')).toBe(true)
    })

    it('should NOT match very short track titles via reverse containment', () => {
      // Track title <= 3 chars after normalization — reverse containment blocked
      expect(isSongMatch('Go', 'Go Away')).toBe(false)
    })

    it('should handle extra whitespace', () => {
      expect(isSongMatch('  Blue   Monday  ', 'Blue Monday')).toBe(true)
    })
  })
})
