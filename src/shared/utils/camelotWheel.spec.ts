import { describe, it, expect } from '@jest/globals'
import {
  toCamelot,
  parseCamelot,
  isCompatible,
  getCompatibilityLabel,
} from './camelotWheel'

describe('camelotWheel', () => {
  describe('toCamelot', () => {
    it('converts major keys correctly', () => {
      expect(toCamelot('C major')).toBe('8B')
      expect(toCamelot('D major')).toBe('10B')
      expect(toCamelot('G major')).toBe('9B')
      expect(toCamelot('B major')).toBe('1B')
    })

    it('converts minor keys correctly', () => {
      expect(toCamelot('A minor')).toBe('8A')
      expect(toCamelot('D minor')).toBe('7A')
      expect(toCamelot('E minor')).toBe('9A')
      expect(toCamelot('B minor')).toBe('10A')
    })

    it('handles enharmonic equivalents', () => {
      expect(toCamelot('F# major')).toBe('2B')
      expect(toCamelot('Gb major')).toBe('2B')
      expect(toCamelot('C# minor')).toBe('12A')
      expect(toCamelot('Db minor')).toBe('12A')
    })

    it('returns null for unrecognized keys', () => {
      expect(toCamelot('H major')).toBeNull()
      expect(toCamelot('invalid')).toBeNull()
      expect(toCamelot('')).toBeNull()
    })
  })

  describe('parseCamelot', () => {
    it('parses valid Camelot keys', () => {
      expect(parseCamelot('8A')).toEqual({ number: 8, letter: 'A' })
      expect(parseCamelot('12B')).toEqual({ number: 12, letter: 'B' })
      expect(parseCamelot('1A')).toEqual({ number: 1, letter: 'A' })
    })

    it('returns null for invalid strings', () => {
      expect(parseCamelot('0A')).toBeNull()
      expect(parseCamelot('13B')).toBeNull()
      expect(parseCamelot('8C')).toBeNull()
      expect(parseCamelot('AB')).toBeNull()
      expect(parseCamelot('')).toBeNull()
    })
  })

  describe('isCompatible', () => {
    it('same key is compatible', () => {
      expect(isCompatible('8A', '8A')).toBe(true)
      expect(isCompatible('12B', '12B')).toBe(true)
    })

    it('+1/-1 on same letter is compatible', () => {
      expect(isCompatible('8A', '7A')).toBe(true)
      expect(isCompatible('8A', '9A')).toBe(true)
      expect(isCompatible('5B', '4B')).toBe(true)
      expect(isCompatible('5B', '6B')).toBe(true)
    })

    it('wraps around 12→1', () => {
      expect(isCompatible('12A', '1A')).toBe(true)
      expect(isCompatible('1B', '12B')).toBe(true)
    })

    it('same number different letter is compatible', () => {
      expect(isCompatible('8A', '8B')).toBe(true)
      expect(isCompatible('3B', '3A')).toBe(true)
    })

    it('non-adjacent keys are not compatible', () => {
      expect(isCompatible('8A', '6A')).toBe(false)
      expect(isCompatible('8A', '10A')).toBe(false)
      expect(isCompatible('1A', '3A')).toBe(false)
    })

    it('different letter + different number is not compatible', () => {
      expect(isCompatible('8A', '9B')).toBe(false)
      expect(isCompatible('3A', '5B')).toBe(false)
    })

    it('returns false for invalid keys', () => {
      expect(isCompatible('invalid', '8A')).toBe(false)
      expect(isCompatible('8A', '')).toBe(false)
    })
  })

  describe('getCompatibilityLabel', () => {
    it('returns dash when either key is undefined', () => {
      expect(getCompatibilityLabel(undefined, '8A')).toEqual({
        label: '—',
        compatible: null,
      })
      expect(getCompatibilityLabel('8A', undefined)).toEqual({
        label: '—',
        compatible: null,
      })
    })

    it('returns Compatible for harmonic pairs', () => {
      expect(getCompatibilityLabel('8A', '8B')).toEqual({
        label: 'Compatible',
        compatible: true,
      })
    })

    it('returns Key clash for non-harmonic pairs', () => {
      expect(getCompatibilityLabel('8A', '3B')).toEqual({
        label: 'Key clash',
        compatible: false,
      })
    })
  })
})
