/**
 * Normalize a title for fuzzy comparison.
 * Strips parenthetical suffixes, punctuation, extra whitespace, and lowercases.
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\(.*?\)/g, '')       // Remove parenthetical content
    .replace(/\[.*?\]/g, '')       // Remove bracketed content
    .replace(/feat\.?\s.*/i, '')   // Remove "feat." and everything after
    .replace(/[^\w\s]/g, ' ')      // Replace punctuation with spaces
    .replace(/\s+/g, ' ')          // Collapse whitespace
    .trim()
}

/**
 * Check if a track title matches the searched song name.
 * Uses substring containment after normalization for robustness.
 */
export function isSongMatch(trackTitle: string, songName: string): boolean {
  const normalizedTrack = normalizeTitle(trackTitle)
  const normalizedSong = normalizeTitle(songName)

  if (!normalizedSong) return false

  // Exact match after normalization
  if (normalizedTrack === normalizedSong) return true

  // One contains the other (handles "Song Name" matching "Song Name (Bonus Track)")
  if (normalizedTrack.includes(normalizedSong)) return true
  if (normalizedSong.includes(normalizedTrack) && normalizedTrack.length > 3) return true

  return false
}
