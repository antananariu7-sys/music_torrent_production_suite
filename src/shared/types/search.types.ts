// Search types for RuTracker integration

export interface SearchRequest {
  query: string
  category?: string
}

export interface SearchResult {
  id: string
  title: string
  author: string
  size: string
  seeders: number
  leechers: number
  url: string
  category?: string
}

export interface SearchResponse {
  success: boolean
  results?: SearchResult[]
  error?: string
  query?: string
}

export interface SearchState {
  isSearching: boolean
  query: string
  results: SearchResult[]
  error?: string
}
