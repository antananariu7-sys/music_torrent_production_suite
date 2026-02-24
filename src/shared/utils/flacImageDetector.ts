import type { SearchResult } from '@shared/types/search.types'

/** Keywords in title suggesting a FLAC/APE disc image */
const IMAGE_KEYWORDS = ['image', 'img', 'cue', 'образ', 'ape+cue', 'flac+cue']

/** Threshold for suspicious single-file size (500 MB) */
const LARGE_SINGLE_FILE_BYTES = 500 * 1024 * 1024

/**
 * Detect whether a search result is likely a FLAC/APE disc image
 * rather than individual tracks.
 */
export function isFlacImage(result: SearchResult): boolean {
  const titleLower = result.title.toLowerCase()

  // Check title keywords
  if (IMAGE_KEYWORDS.some((kw) => titleLower.includes(kw))) {
    return true
  }

  // Large single file for lossless format suggests disc image
  const format = result.format?.toLowerCase()
  if (
    (format === 'flac' || format === 'ape') &&
    result.sizeBytes &&
    result.sizeBytes > LARGE_SINGLE_FILE_BYTES
  ) {
    return true
  }

  return false
}
