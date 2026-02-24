import { readdirSync, statSync } from 'fs'
import { join, extname } from 'path'
import type {
  DuplicateCheckRequest,
  DuplicateCheckResponse,
  DuplicateMatch,
  AudioFileEntry,
} from '@shared/types/duplicateDetection.types'
import {
  normalizeForComparison,
  calculateSimilarity,
  DUPLICATE_THRESHOLD,
} from '@shared/utils/trackMatcher'

const AUDIO_EXTENSIONS = new Set([
  '.mp3',
  '.flac',
  '.wav',
  '.ogg',
  '.m4a',
  '.aac',
  '.opus',
  '.ape',
  '.wma',
  '.alac',
])

/** Cache of indexed audio files per project directory */
const indexCache = new Map<
  string,
  { entries: AudioFileEntry[]; mtime: number }
>()

/**
 * DuplicateDetectionService
 *
 * Scans project audio directory and checks search result titles
 * against existing files to detect potential duplicates.
 */
export class DuplicateDetectionService {
  /**
   * Scan the project audio directory and build an index of audio files.
   * Results are cached and invalidated when the directory mtime changes.
   */
  private indexAudioDirectory(projectDirectory: string): AudioFileEntry[] {
    const audioDir = join(projectDirectory, 'assets', 'audio')

    try {
      const dirStat = statSync(audioDir)
      const dirMtime = dirStat.mtimeMs

      // Check cache
      const cached = indexCache.get(audioDir)
      if (cached && cached.mtime === dirMtime) {
        return cached.entries
      }

      // Scan directory
      const files = readdirSync(audioDir)
      const entries: AudioFileEntry[] = []

      for (const file of files) {
        const ext = extname(file).toLowerCase()
        if (!AUDIO_EXTENSIONS.has(ext)) continue

        entries.push({
          normalizedName: normalizeForComparison(file),
          originalName: file,
        })
      }

      // Cache the result
      indexCache.set(audioDir, { entries, mtime: dirMtime })

      console.log(
        `[DuplicateDetection] Indexed ${entries.length} audio files in ${audioDir}`
      )

      return entries
    } catch (err) {
      // Directory doesn't exist or not readable
      console.log(
        `[DuplicateDetection] Audio directory not accessible: ${audioDir}`
      )
      return []
    }
  }

  /**
   * Check search result titles against the project's audio file index.
   */
  check(request: DuplicateCheckRequest): DuplicateCheckResponse {
    try {
      const entries = this.indexAudioDirectory(request.projectDirectory)

      if (entries.length === 0) {
        return {
          success: true,
          matches: [],
          indexedFileCount: 0,
        }
      }

      const matches: DuplicateMatch[] = []

      for (const { id, title } of request.titles) {
        const normalizedTitle = normalizeForComparison(title)
        const matchedFiles: string[] = []
        let bestScore = 0

        for (const entry of entries) {
          const score = calculateSimilarity(
            normalizedTitle,
            entry.normalizedName
          )
          if (score >= DUPLICATE_THRESHOLD) {
            matchedFiles.push(entry.originalName)
            bestScore = Math.max(bestScore, score)
          }
        }

        if (matchedFiles.length > 0) {
          matches.push({
            resultId: id,
            matchedFiles,
            confidence: bestScore,
          })
        }
      }

      console.log(
        `[DuplicateDetection] Checked ${request.titles.length} titles against ${entries.length} files: ${matches.length} matches`
      )

      return {
        success: true,
        matches,
        indexedFileCount: entries.length,
      }
    } catch (err) {
      console.error('[DuplicateDetection] Check failed:', err)
      return {
        success: false,
        matches: [],
        indexedFileCount: 0,
        error: err instanceof Error ? err.message : 'Duplicate check failed',
      }
    }
  }

  /**
   * Force rescan by invalidating the cache for a project directory.
   */
  rescan(projectDirectory: string): DuplicateCheckResponse {
    const audioDir = join(projectDirectory, 'assets', 'audio')
    indexCache.delete(audioDir)

    // Re-index
    const entries = this.indexAudioDirectory(projectDirectory)
    return {
      success: true,
      matches: [],
      indexedFileCount: entries.length,
    }
  }
}

export const duplicateDetectionService = new DuplicateDetectionService()
