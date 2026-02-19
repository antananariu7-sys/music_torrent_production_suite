import { existsSync } from 'fs'
import type { Song } from '@shared/types/project.types'

export interface ValidationResult {
  valid: Song[]
  missing: { songId: string; title: string }[]
}

/**
 * Resolve the audio file path for a song.
 * Prefers localFilePath (project assets), falls back to externalFilePath.
 */
export function resolveSongPath(song: Song): string | null {
  return song.localFilePath ?? song.externalFilePath ?? null
}

/**
 * Validate that all songs have accessible audio files.
 */
export function validateSongs(songs: Song[]): ValidationResult {
  const valid: Song[] = []
  const missing: { songId: string; title: string }[] = []

  for (const song of songs) {
    const filePath = resolveSongPath(song)
    if (filePath && existsSync(filePath)) {
      valid.push(song)
    } else {
      missing.push({ songId: song.id, title: song.title })
    }
  }

  return { valid, missing }
}

/**
 * Clamp crossfade duration to avoid exceeding track durations.
 * Returns the clamped value and whether clamping occurred.
 */
export function clampCrossfade(
  crossfade: number,
  currentDuration: number | undefined,
  nextDuration: number | undefined,
): { value: number; clamped: boolean } {
  if (!currentDuration || !nextDuration) {
    return { value: crossfade, clamped: false }
  }

  const maxAllowed = Math.min(currentDuration, nextDuration) - 1
  if (maxAllowed <= 0) {
    return { value: 0, clamped: crossfade > 0 }
  }

  if (crossfade > maxAllowed) {
    return { value: maxAllowed, clamped: true }
  }

  return { value: crossfade, clamped: false }
}
