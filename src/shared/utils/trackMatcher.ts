/**
 * Normalize a file/track name for duplicate comparison.
 * Strips extension, track number prefixes, punctuation, brackets, and lowercases.
 */
export function normalizeForComparison(name: string): string {
  return (
    name
      .toLowerCase()
      // Strip file extension
      .replace(/\.\w{2,5}$/, '')
      // Strip leading track numbers: "01.", "01 -", "01 ", "1."
      .replace(/^\d{1,3}[\s.\-_]+/, '')
      // Strip bracketed/parenthetical content
      .replace(/\[.*?\]/g, '')
      .replace(/\(.*?\)/g, '')
      // Strip common tags
      .replace(/\b(flac|mp3|wav|aac|ogg|ape|lossless|320|192|128|kbps)\b/gi, '')
      // Replace punctuation with spaces
      .replace(/[^\w\s]/g, ' ')
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      .trim()
  )
}

/**
 * Calculate similarity between two normalized strings (0-100).
 * Uses a combination of substring containment and token overlap.
 */
export function calculateSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 100

  // Substring containment
  if (a.includes(b) || b.includes(a)) {
    const shorter = a.length < b.length ? a : b
    const longer = a.length >= b.length ? a : b
    return Math.round((shorter.length / longer.length) * 100)
  }

  // Token overlap (Jaccard-like)
  const tokensA = new Set(a.split(' ').filter((t) => t.length > 1))
  const tokensB = new Set(b.split(' ').filter((t) => t.length > 1))
  if (tokensA.size === 0 || tokensB.size === 0) return 0

  let overlap = 0
  for (const token of tokensA) {
    if (tokensB.has(token)) overlap++
  }

  const union = new Set([...tokensA, ...tokensB]).size
  return Math.round((overlap / union) * 100)
}

/** Threshold for considering a match as a likely duplicate */
export const DUPLICATE_THRESHOLD = 85
