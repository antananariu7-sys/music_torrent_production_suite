/**
 * Shared result classification utilities
 * Can be imported by both main and renderer processes
 */

import type {
  SearchResult,
  ResultGroup,
  GroupedSearchResults,
} from '@shared/types/search.types'

/** Keywords for discography detection */
const DISCOGRAPHY_KEYWORDS = [
  'discography',
  'дискография',
  'complete',
  'all albums',
  'box set',
]

/** Keywords for live album detection */
const LIVE_KEYWORDS = ['live', 'concert', 'tour', 'концерт', 'bootleg']

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
 * Check if a title likely represents a discography page
 */
export function isLikelyDiscography(title: string): boolean {
  const titleLower = title.toLowerCase()
  return DISCOGRAPHY_KEYWORDS.some((keyword) => titleLower.includes(keyword))
}

/**
 * Check if a title matches any keyword from a list
 */
function titleMatchesKeywords(titleLower: string, keywords: string[]): boolean {
  return keywords.some((keyword) => titleLower.includes(keyword))
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
    albumMatch: [],
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
export function filterDiscographyPages(
  results: SearchResult[]
): SearchResult[] {
  return results.filter((result) => isLikelyDiscography(result.title))
}

/**
 * Normalize a title for album matching: lowercase, strip brackets/parens, collapse whitespace
 */
export function normalizeAlbumTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Check if a result title matches an album name (fuzzy substring match)
 */
export function isAlbumTitleMatch(
  resultTitle: string,
  albumName: string
): boolean {
  const a = normalizeAlbumTitle(resultTitle)
  const b = normalizeAlbumTitle(albumName)
  if (!b) return false
  if (a === b) return true
  if (a.includes(b) || b.includes(a)) return true
  return false
}
