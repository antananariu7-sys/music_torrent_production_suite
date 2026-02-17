/**
 * Shared result classification utilities
 * Can be imported by both main and renderer processes
 */

/** Keywords for discography detection */
const DISCOGRAPHY_KEYWORDS = [
  'discography',
  'дискография',
  'complete',
  'all albums',
  'box set',
]

/**
 * Check if a title likely represents a discography page
 */
export function isLikelyDiscography(title: string): boolean {
  const titleLower = title.toLowerCase()
  return DISCOGRAPHY_KEYWORDS.some(keyword => titleLower.includes(keyword))
}
