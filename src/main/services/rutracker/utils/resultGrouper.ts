import type { SearchResult, ResultGroup, GroupedSearchResults } from '@shared/types/search.types'
import { isLikelyDiscography } from '@shared/utils/resultClassifier'

export { isLikelyDiscography }

/** Keywords for live album detection */
const LIVE_KEYWORDS = [
  'live',
  'concert',
  'tour',
  'концерт',
  'bootleg',
]

/** Keywords for compilation detection */
const COMPILATION_KEYWORDS = [
  'best of',
  'greatest hits',
  'collection',
  'anthology',
  'сборник',
  'compilation',
]

/**
 * Check if a title matches any keyword from a list
 */
function titleMatchesKeywords(titleLower: string, keywords: string[]): boolean {
  return keywords.some(keyword => titleLower.includes(keyword))
}

/**
 * Classify a search result into a group based on its title
 */
export function classifyResult(result: SearchResult): ResultGroup {
  const titleLower = result.title.toLowerCase()

  if (isLikelyDiscography(result.title)) {
    return 'discography'
  }

  if (titleMatchesKeywords(titleLower, COMPILATION_KEYWORDS)) {
    return 'compilation'
  }

  if (titleMatchesKeywords(titleLower, LIVE_KEYWORDS)) {
    return 'live'
  }

  return 'studio'
}

/**
 * Group search results by category
 */
export function groupResults(results: SearchResult[]): GroupedSearchResults {
  const groups: GroupedSearchResults = {
    studio: [],
    live: [],
    compilation: [],
    discography: [],
    other: [],
  }

  for (const result of results) {
    const group = classifyResult(result)
    groups[group].push(result)
  }

  return groups
}

/**
 * Filter search results to find likely discography pages
 */
export function filterDiscographyPages(results: SearchResult[]): SearchResult[] {
  return results.filter(result => isLikelyDiscography(result.title))
}
