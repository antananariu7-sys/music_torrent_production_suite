import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { readdirSync, statSync } from 'fs'
import { DuplicateDetectionService } from './DuplicateDetectionService'

jest.mock('fs', () => ({
  readdirSync: jest.fn(),
  statSync: jest.fn(),
}))

const mockedReaddirSync = readdirSync as jest.MockedFunction<typeof readdirSync>
const mockedStatSync = statSync as jest.MockedFunction<typeof statSync>

/** Create a fake fs.Stats with given mtime */
function fakeStat(mtimeMs: number) {
  return { mtimeMs } as ReturnType<typeof statSync>
}

describe('DuplicateDetectionService', () => {
  let service: DuplicateDetectionService

  beforeEach(() => {
    jest.clearAllMocks()
    // Create a new instance for each test to avoid cross-test state
    // Note: indexCache is module-level, so we use rescan to clear it
    service = new DuplicateDetectionService()
  })

  describe('check — indexing', () => {
    it('should index only audio files from the directory', () => {
      mockedStatSync.mockReturnValue(fakeStat(1000))
      mockedReaddirSync.mockReturnValue([
        'song.mp3',
        'song.flac',
        'song.wav',
        'song.ogg',
        'readme.txt',
        'cover.jpg',
        'notes.pdf',
      ] as unknown as ReturnType<typeof readdirSync>)

      const result = service.check({
        projectDirectory: '/projects/test',
        titles: [],
      })

      expect(result.success).toBe(true)
      expect(result.indexedFileCount).toBe(4) // only audio files
    })

    it('should include .m4a, .aac, .opus, .ape, .wma, .alac extensions', () => {
      mockedStatSync.mockReturnValue(fakeStat(1000))
      mockedReaddirSync.mockReturnValue([
        'a.m4a',
        'b.aac',
        'c.opus',
        'd.ape',
        'e.wma',
        'f.alac',
      ] as unknown as ReturnType<typeof readdirSync>)

      const result = service.check({
        projectDirectory: '/projects/test-all-exts',
        titles: [],
      })

      expect(result.indexedFileCount).toBe(6)
    })

    it('should return empty for non-existent directory', () => {
      mockedStatSync.mockImplementation(() => {
        throw new Error('ENOENT')
      })

      const result = service.check({
        projectDirectory: '/projects/nonexistent',
        titles: [],
      })

      expect(result.success).toBe(true)
      expect(result.matches).toHaveLength(0)
      expect(result.indexedFileCount).toBe(0)
    })

    it('should return empty for empty directory', () => {
      mockedStatSync.mockReturnValue(fakeStat(1000))
      mockedReaddirSync.mockReturnValue(
        [] as unknown as ReturnType<typeof readdirSync>
      )

      const result = service.check({
        projectDirectory: '/projects/empty',
        titles: [],
      })

      expect(result.success).toBe(true)
      expect(result.indexedFileCount).toBe(0)
    })

    it('should use cache on second call with same mtime', () => {
      mockedStatSync.mockReturnValue(fakeStat(1000))
      mockedReaddirSync.mockReturnValue(['song.mp3'] as unknown as ReturnType<
        typeof readdirSync
      >)

      service.check({ projectDirectory: '/projects/cached', titles: [] })
      service.check({ projectDirectory: '/projects/cached', titles: [] })

      // readdirSync only called once — second call uses cache
      expect(mockedReaddirSync).toHaveBeenCalledTimes(1)
    })

    it('should re-scan when mtime changes', () => {
      mockedStatSync.mockReturnValueOnce(fakeStat(1000))
      mockedReaddirSync.mockReturnValueOnce([
        'song.mp3',
      ] as unknown as ReturnType<typeof readdirSync>)

      service.check({ projectDirectory: '/projects/changing', titles: [] })

      // Change mtime
      mockedStatSync.mockReturnValueOnce(fakeStat(2000))
      mockedReaddirSync.mockReturnValueOnce([
        'song.mp3',
        'song2.flac',
      ] as unknown as ReturnType<typeof readdirSync>)

      const result = service.check({
        projectDirectory: '/projects/changing',
        titles: [],
      })

      expect(result.indexedFileCount).toBe(2)
      expect(mockedReaddirSync).toHaveBeenCalledTimes(2)
    })
  })

  describe('check — matching', () => {
    beforeEach(() => {
      mockedStatSync.mockReturnValue(fakeStat(5000))
      mockedReaddirSync.mockReturnValue([
        'Blue Monday.mp3',
        'Bizarre Love Triangle.flac',
        'True Faith.wav',
      ] as unknown as ReturnType<typeof readdirSync>)
    })

    it('should return no matches when no audio files in directory', () => {
      mockedStatSync.mockReturnValue(fakeStat(9000))
      mockedReaddirSync.mockReturnValue(
        [] as unknown as ReturnType<typeof readdirSync>
      )

      const result = service.check({
        projectDirectory: '/projects/empty-audio',
        titles: [{ id: 'r1', title: 'Blue Monday' }],
      })

      expect(result.matches).toHaveLength(0)
      expect(result.indexedFileCount).toBe(0)
    })

    it('should match title at or above threshold', () => {
      const result = service.check({
        projectDirectory: '/projects/test',
        titles: [{ id: 'r1', title: 'Blue Monday' }],
      })

      expect(result.matches.length).toBeGreaterThanOrEqual(1)
      const match = result.matches.find((m) => m.resultId === 'r1')
      expect(match).toBeDefined()
      expect(match!.matchedFiles).toContain('Blue Monday.mp3')
      expect(match!.confidence).toBeGreaterThanOrEqual(85)
    })

    it('should NOT match titles below threshold', () => {
      const result = service.check({
        projectDirectory: '/projects/test',
        titles: [{ id: 'r1', title: 'Something Completely Different' }],
      })

      expect(result.matches).toHaveLength(0)
    })

    it('should check multiple titles independently', () => {
      const result = service.check({
        projectDirectory: '/projects/test',
        titles: [
          { id: 'r1', title: 'Blue Monday' },
          { id: 'r2', title: 'Something Else' },
          { id: 'r3', title: 'True Faith' },
        ],
      })

      const matchedIds = result.matches.map((m) => m.resultId)
      expect(matchedIds).toContain('r1')
      expect(matchedIds).toContain('r3')
      expect(matchedIds).not.toContain('r2')
    })

    it('should track best score correctly', () => {
      const result = service.check({
        projectDirectory: '/projects/test',
        titles: [{ id: 'r1', title: 'Blue Monday' }],
      })

      const match = result.matches.find((m) => m.resultId === 'r1')
      expect(match!.confidence).toBe(100) // exact match after normalization
    })
  })

  describe('rescan', () => {
    it('should invalidate cache and re-index', () => {
      mockedStatSync.mockReturnValue(fakeStat(1000))
      mockedReaddirSync.mockReturnValue(['song.mp3'] as unknown as ReturnType<
        typeof readdirSync
      >)

      // First index
      service.check({ projectDirectory: '/projects/rescan', titles: [] })

      // Now add more files and rescan (same mtime — normally cached)
      mockedReaddirSync.mockReturnValue([
        'song.mp3',
        'song2.flac',
      ] as unknown as ReturnType<typeof readdirSync>)

      const result = service.rescan('/projects/rescan')

      expect(result.success).toBe(true)
      expect(result.indexedFileCount).toBe(2)
      expect(mockedReaddirSync).toHaveBeenCalledTimes(2)
    })
  })
})
