// Discography search types for searching albums within page content

import type { SearchResult } from './search.types'

/**
 * Album entry found within a discography page
 */
export interface DiscographyAlbumEntry {
  /** Album title (e.g., "The Dark Side of the Moon") */
  title: string
  /** Album year if detected */
  year?: string
  /** Full raw text from the discography entry */
  rawText: string
  /** Duration if available */
  duration?: string
  /** Release info (label, catalog number, etc.) */
  releaseInfo?: string
}

/**
 * Result from scanning a single page for album content
 */
export interface PageContentScanResult {
  /** Original search result this scan is for */
  searchResult: SearchResult
  /** Whether the target album was found in the page content */
  albumFound: boolean
  /** Matched album entries from the page */
  matchedAlbums: DiscographyAlbumEntry[]
  /** All albums found in the discography (for reference) */
  allAlbums: DiscographyAlbumEntry[]
  /** Whether the page appears to be a discography page */
  isDiscography: boolean
  /** Page title */
  pageTitle: string
  /** Error if scan failed */
  error?: string
}

/**
 * Request for discography content search
 */
export interface DiscographySearchRequest {
  /** Search results to scan (pages to open) */
  searchResults: SearchResult[]
  /** Album name to search for within page content */
  albumName: string
  /** Artist name for better matching (optional) */
  artistName?: string
  /** Maximum number of pages to scan in parallel */
  maxConcurrent?: number
  /** Timeout per page in milliseconds */
  pageTimeout?: number
}

/**
 * Response from discography content search
 */
export interface DiscographySearchResponse {
  success: boolean
  /** Results from each scanned page */
  scanResults: PageContentScanResult[]
  /** Pages where the album was found */
  matchedPages: PageContentScanResult[]
  /** Total pages scanned */
  totalScanned: number
  /** Number of pages where album was found */
  matchCount: number
  /** Error if the entire operation failed */
  error?: string
}

/**
 * Progress update during discography search
 */
export interface DiscographySearchProgress {
  /** Current page being scanned */
  currentPage: number
  /** Total pages to scan */
  totalPages: number
  /** Current page URL */
  currentUrl: string
  /** Status message */
  message: string
}
