// Search types for RuTracker integration

export type FileFormat = 'mp3' | 'flac' | 'wav' | 'aac' | 'ogg' | 'alac' | 'ape' | 'any'
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
