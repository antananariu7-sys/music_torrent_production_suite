import {
  formatDuration,
  formatDate,
  formatFileSize,
  getUniqueFormats,
  calculateTotalDuration,
  calculateTotalSize,
} from './utils'
import type { Song } from '@shared/types/project.types'

describe('ProjectOverview Utils', () => {
  describe('formatDuration', () => {
    it('should format seconds to MM:SS format', () => {
      expect(formatDuration(90)).toBe('1:30')
      expect(formatDuration(65)).toBe('1:05')
      expect(formatDuration(5)).toBe('0:05')
    })

    it('should format hours to HH:MM:SS format', () => {
      expect(formatDuration(3661)).toBe('1:01:01')
      expect(formatDuration(7200)).toBe('2:00:00')
      expect(formatDuration(3600)).toBe('1:00:00')
    })

    it('should handle undefined gracefully', () => {
      expect(formatDuration(undefined)).toBe('--:--')
      expect(formatDuration(null as unknown as number)).toBe('--:--')
      expect(formatDuration(NaN)).toBe('--:--')
    })

    it('should handle zero', () => {
      expect(formatDuration(0)).toBe('0:00')
    })
  })

  describe('formatDate', () => {
    it('should format date to readable string', () => {
      const date = new Date('2024-01-15T10:30:00')
      expect(formatDate(date)).toBe('Jan 15, 2024')
    })

    it('should handle different months', () => {
      expect(formatDate(new Date('2024-12-25'))).toBe('Dec 25, 2024')
      expect(formatDate(new Date('2024-06-01'))).toBe('Jun 1, 2024')
    })

    it('should handle invalid dates gracefully', () => {
      expect(formatDate(null as unknown as Date)).toBe('Unknown')
      expect(formatDate(undefined as unknown as Date)).toBe('Unknown')
      expect(formatDate(new Date('invalid'))).toBe('Unknown')
    })
  })

  describe('formatFileSize', () => {
    it('should format bytes to readable format', () => {
      expect(formatFileSize(0)).toBe('0 B')
      expect(formatFileSize(512)).toBe('512.00 B')
      expect(formatFileSize(1024)).toBe('1.00 KB')
      expect(formatFileSize(1536)).toBe('1.50 KB')
    })

    it('should format kilobytes', () => {
      expect(formatFileSize(1024 * 100)).toBe('100.00 KB')
      expect(formatFileSize(1024 * 500)).toBe('500.00 KB')
    })

    it('should format megabytes', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1.00 MB')
      expect(formatFileSize(1024 * 1024 * 5.5)).toBe('5.50 MB')
      expect(formatFileSize(1024 * 1024 * 450)).toBe('450.00 MB')
    })

    it('should format gigabytes', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.00 GB')
      expect(formatFileSize(1024 * 1024 * 1024 * 2.75)).toBe('2.75 GB')
    })

    it('should handle undefined gracefully', () => {
      expect(formatFileSize(undefined)).toBe('Unknown')
      expect(formatFileSize(null as unknown as number)).toBe('Unknown')
      expect(formatFileSize(NaN)).toBe('Unknown')
    })
  })

  describe('getUniqueFormats', () => {
    const createSong = (format?: string): Song =>
      ({
        id: '1',
        title: 'Test',
        format,
        order: 1,
        addedAt: new Date(),
      }) as Song

    it('should extract unique formats from songs', () => {
      const songs = [
        createSong('mp3'),
        createSong('flac'),
        createSong('mp3'),
        createSong('wav'),
      ]
      expect(getUniqueFormats(songs)).toEqual(['FLAC', 'MP3', 'WAV'])
    })

    it('should convert formats to uppercase', () => {
      const songs = [createSong('mp3'), createSong('Mp3'), createSong('MP3')]
      expect(getUniqueFormats(songs)).toEqual(['MP3'])
    })

    it('should sort formats alphabetically', () => {
      const songs = [createSong('wav'), createSong('flac'), createSong('mp3')]
      expect(getUniqueFormats(songs)).toEqual(['FLAC', 'MP3', 'WAV'])
    })

    it('should handle songs without format', () => {
      const songs = [createSong('mp3'), createSong(undefined), createSong('flac')]
      expect(getUniqueFormats(songs)).toEqual(['FLAC', 'MP3'])
    })

    it('should handle empty array', () => {
      expect(getUniqueFormats([])).toEqual([])
    })

    it('should handle undefined input gracefully', () => {
      expect(getUniqueFormats(null as unknown as Song[])).toEqual([])
      expect(getUniqueFormats(undefined as unknown as Song[])).toEqual([])
    })
  })

  describe('calculateTotalDuration', () => {
    const createSong = (duration?: number): Song =>
      ({
        id: '1',
        title: 'Test',
        duration,
        order: 1,
        addedAt: new Date(),
      }) as Song

    it('should sum song durations', () => {
      const songs = [createSong(100), createSong(200), createSong(300)]
      expect(calculateTotalDuration(songs)).toBe(600)
    })

    it('should handle songs without duration', () => {
      const songs = [createSong(100), createSong(undefined), createSong(200)]
      expect(calculateTotalDuration(songs)).toBe(300)
    })

    it('should handle empty array', () => {
      expect(calculateTotalDuration([])).toBe(0)
    })

    it('should handle undefined input gracefully', () => {
      expect(calculateTotalDuration(null as unknown as Song[])).toBe(0)
      expect(calculateTotalDuration(undefined as unknown as Song[])).toBe(0)
    })

    it('should handle all songs without duration', () => {
      const songs = [createSong(undefined), createSong(undefined)]
      expect(calculateTotalDuration(songs)).toBe(0)
    })
  })

  describe('calculateTotalSize', () => {
    const createSong = (fileSize?: number): Song =>
      ({
        id: '1',
        title: 'Test',
        fileSize,
        order: 1,
        addedAt: new Date(),
      }) as Song

    it('should sum file sizes', () => {
      const songs = [createSong(1000), createSong(2000), createSong(3000)]
      expect(calculateTotalSize(songs)).toBe(6000)
    })

    it('should handle songs without fileSize', () => {
      const songs = [createSong(1000), createSong(undefined), createSong(2000)]
      expect(calculateTotalSize(songs)).toBe(3000)
    })

    it('should handle empty array', () => {
      expect(calculateTotalSize([])).toBe(0)
    })

    it('should handle undefined input gracefully', () => {
      expect(calculateTotalSize(null as unknown as Song[])).toBe(0)
      expect(calculateTotalSize(undefined as unknown as Song[])).toBe(0)
    })

    it('should handle all songs without fileSize', () => {
      const songs = [createSong(undefined), createSong(undefined)]
      expect(calculateTotalSize(songs)).toBe(0)
    })

    it('should handle large file sizes', () => {
      const songs = [
        createSong(1024 * 1024 * 1024), // 1 GB
        createSong(1024 * 1024 * 500), // 500 MB
      ]
      expect(calculateTotalSize(songs)).toBe(1024 * 1024 * 1024 + 1024 * 1024 * 500)
    })
  })
})
