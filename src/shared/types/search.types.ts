// Search types for RuTracker integration

export type FileFormat =
  | 'mp3'
  | 'flac'
  | 'wav'
  | 'aac'
  | 'ogg'
  | 'alac'
  | 'ape'
  | 'any'
export type SortBy = 'relevance' | 'seeders' | 'date' | 'size' | 'title'
export type SortOrder = 'asc' | 'desc'

export interface SearchFilters {
  /** File format filter (e.g., 'mp3', 'flac', 'any') */
  format?: FileFormat
  /** Minimum number of seeders */
  minSeeders?: number
  /** Minimum file size in MB */
  minSize?: number
  /** Maximum file size in MB */
  maxSize?: number
  /** Search only in specific RuTracker categories */
  categories?: string[]
  /** Date range - results newer than this date */
  dateFrom?: Date
  /** Date range - results older than this date */
  dateTo?: Date
}

export interface SearchSort {
  /** Field to sort by */
  by: SortBy
  /** Sort order */
  order: SortOrder
}

export interface SearchRequest {
  query: string
  /** Optional search filters */
  filters?: SearchFilters
  /** Optional sorting parameters */
  sort?: SearchSort
  /** Maximum number of results to return */
  maxResults?: number
}

/** Source of the search result */
export type SearchSource = 'album' | 'discography'

export interface SearchResult {
  id: string
  title: string
  author: string
  size: string
  /** Size in bytes for sorting/filtering */
  sizeBytes?: number
  seeders: number
  leechers: number
  url: string
  category?: string
  /** Upload date if available */
  uploadDate?: string
  /** Relevance score (0-100) for sorting */
  relevanceScore?: number
  /** Detected file format from title/description */
  format?: FileFormat
  /** Source of the result: direct album search or discography search */
  searchSource?: SearchSource
}

export interface SearchResponse {
  success: boolean
  results?: SearchResult[]
  error?: string
  query?: string
  /** Applied filters */
  appliedFilters?: SearchFilters
  /** Total results before filtering */
  totalResults?: number
}

export interface SearchState {
  isSearching: boolean
  query: string
  results: SearchResult[]
  error?: string
  filters?: SearchFilters
  sort?: SearchSort
}

/** Request for progressive multi-page search */
export interface ProgressiveSearchRequest {
  query: string
  /** Optional search filters */
  filters?: SearchFilters
  /** Maximum number of pages to fetch (default: 10, max: 10) */
  maxPages?: number
}

/** Result group category for RuTracker results */
export type ResultGroup =
  | 'studio'
  | 'live'
  | 'compilation'
  | 'discography'
  | 'other'

/** Search results grouped by category */
export interface GroupedSearchResults {
  studio: SearchResult[]
  live: SearchResult[]
  compilation: SearchResult[]
  discography: SearchResult[]
  other: SearchResult[]
}

/** Progress event for progressive search */
export interface SearchProgressEvent {
  /** Current page being processed (1-based) */
  currentPage: number
  /** Total pages to process */
  totalPages: number
  /** Results found so far */
  results: SearchResult[]
  /** Whether search is complete */
  isComplete: boolean
  /** Error message if any */
  error?: string
}

/** Request to load additional search result pages */
export interface LoadMoreRequest {
  /** Original search query */
  query: string
  /** First page to fetch (1-indexed) */
  fromPage: number
  /** Last page to fetch (inclusive) */
  toPage: number
  /** Optional filters to apply */
  filters?: SearchFilters
}

/** Response from load-more operation */
export interface LoadMoreResponse {
  success: boolean
  /** New results from fetched pages */
  results: SearchResult[]
  /** Number of pages successfully loaded */
  loadedPages: number
  /** Total available pages on the tracker */
  totalPages: number
  /** Whether all available pages have been loaded */
  isComplete: boolean
  /** Error if the operation failed */
  error?: string
}
