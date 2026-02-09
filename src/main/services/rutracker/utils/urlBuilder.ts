/**
 * Build RuTracker search URL
 *
 * @param query - Search query
 * @param page - Page number (1-indexed)
 * @returns Complete search URL
 */
export function buildSearchUrl(query: string, page: number = 1): string {
  const encodedQuery = encodeURIComponent(query)

  if (page === 1) {
    return `https://rutracker.org/forum/tracker.php?nm=${encodedQuery}`
  }

  const startOffset = (page - 1) * 50
  return `https://rutracker.org/forum/tracker.php?nm=${encodedQuery}&start=${startOffset}`
}

/**
 * RuTracker base URL
 */
export const RUTRACKER_BASE_URL = 'https://rutracker.org/forum/'

/**
 * Results per page on RuTracker
 */
export const RESULTS_PER_PAGE = 50
