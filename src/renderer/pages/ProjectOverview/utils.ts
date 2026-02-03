import type { Song } from '@shared/types/project.types'

/**
 * Format duration in seconds to HH:MM:SS or MM:SS format
 * @param seconds - Duration in seconds
 * @returns Formatted duration string
 */
export function formatDuration(seconds?: number): string {
  if (seconds === undefined || seconds === null || isNaN(seconds)) {
    return '--:--'
  }

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

/**
 * Format date to readable string (e.g., "Jan 15, 2024")
 * @param date - Date object
 * @returns Formatted date string
 */
export function formatDate(date: Date): string {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return 'Unknown'
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Format file size in bytes to human-readable format (KB/MB/GB)
 * @param bytes - File size in bytes
 * @returns Formatted file size string
 */
export function formatFileSize(bytes?: number): string {
  if (bytes === undefined || bytes === null || isNaN(bytes)) {
    return 'Unknown'
  }

  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`
}

/**
 * Extract unique file formats from songs array
 * @param songs - Array of songs
 * @returns Array of unique format strings
 */
export function getUniqueFormats(songs: Song[]): string[] {
  if (!songs || songs.length === 0) {
    return []
  }

  const formats = songs
    .map((song) => song.format)
    .filter((format): format is string => !!format)
    .map((format) => format.toUpperCase())

  return Array.from(new Set(formats)).sort()
}

/**
 * Calculate total duration of all songs
 * @param songs - Array of songs
 * @returns Total duration in seconds
 */
export function calculateTotalDuration(songs: Song[]): number {
  if (!songs || songs.length === 0) {
    return 0
  }

  return songs.reduce((total, song) => {
    const duration = song.duration ?? 0
    return total + duration
  }, 0)
}

/**
 * Calculate total file size of all songs
 * @param songs - Array of songs
 * @returns Total file size in bytes
 */
export function calculateTotalSize(songs: Song[]): number {
  if (!songs || songs.length === 0) {
    return 0
  }

  return songs.reduce((total, song) => {
    const size = song.fileSize ?? 0
    return total + size
  }, 0)
}
