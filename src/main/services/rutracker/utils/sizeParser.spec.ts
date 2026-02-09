import { parseSizeToBytes } from './sizeParser'

describe('sizeParser', () => {
  describe('parseSizeToBytes', () => {
    it('should parse GB correctly', () => {
      expect(parseSizeToBytes('1.5 GB')).toBe(1.5 * 1024 * 1024 * 1024)
      expect(parseSizeToBytes('2 GB')).toBe(2 * 1024 * 1024 * 1024)
    })

    it('should parse MB correctly', () => {
      expect(parseSizeToBytes('500 MB')).toBe(500 * 1024 * 1024)
      expect(parseSizeToBytes('100.5 MB')).toBe(100.5 * 1024 * 1024)
    })

    it('should parse KB correctly', () => {
      expect(parseSizeToBytes('1024 KB')).toBe(1024 * 1024)
      expect(parseSizeToBytes('512 KB')).toBe(512 * 1024)
    })

    it('should parse TB correctly', () => {
      expect(parseSizeToBytes('1 TB')).toBe(1024 * 1024 * 1024 * 1024)
    })

    it('should handle different spacing', () => {
      expect(parseSizeToBytes('1.5GB')).toBe(1.5 * 1024 * 1024 * 1024)
      expect(parseSizeToBytes('100  MB')).toBe(100 * 1024 * 1024)
    })

    it('should be case insensitive', () => {
      expect(parseSizeToBytes('1 gb')).toBe(1024 * 1024 * 1024)
      expect(parseSizeToBytes('100 mb')).toBe(100 * 1024 * 1024)
    })

    it('should return undefined for invalid format', () => {
      expect(parseSizeToBytes('invalid')).toBeUndefined()
      expect(parseSizeToBytes('100')).toBeUndefined()
      expect(parseSizeToBytes('')).toBeUndefined()
    })
  })
})
