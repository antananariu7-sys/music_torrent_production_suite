import type { SearchResult } from '@shared/types/search.types'

/**
 * Calculate relevance score for a search result
 *
 * @param result - Search result
 * @param query - Original search query
 * @returns Relevance score (0-100)
 */
export function calculateRelevance(result: SearchResult, query: string): number {
  let score = 0
  const titleLower = result.title.toLowerCase()
  const queryLower = query.toLowerCase()
  const queryWords = queryLower.split(/\s+/)

  // Title exact match: +40 points
  if (titleLower === queryLower) {
    score += 40
  }
  // Title contains full query: +30 points
  else if (titleLower.includes(queryLower)) {
    score += 30
  }
  // Title contains all query words: +20 points
  else if (queryWords.every(word => titleLower.includes(word))) {
    score += 20
  }
  // Title contains some query words: +10 points per word
  else {
    const matchedWords = queryWords.filter(word => titleLower.includes(word))
    score += matchedWords.length * 5
  }

  // Seeder boost: +1-30 points based on seeders
  if (result.seeders > 0) {
    score += Math.min(30, Math.log10(result.seeders + 1) * 10)
  }

  // Format boost: +10 points for lossless formats
  if (result.format && ['flac', 'alac', 'ape', 'wav'].includes(result.format)) {
    score += 10
  }

  return Math.min(100, Math.round(score))
}

/**
 * Calculate relevance scores for all results
 *
 * @param results - Search results
 * @param query - Original search query
 * @returns Results with relevance scores
 */
export function calculateRelevanceScores(results: SearchResult[], query: string): SearchResult[] {
  return results.map(result => ({
    ...result,
    relevanceScore: calculateRelevance(result, query),
  }))
}
