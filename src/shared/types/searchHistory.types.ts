/**
 * Persistent search history types for storing to disk
 */

export interface SearchHistoryEntry {
  id: string
  query: string
  timestamp: string // ISO 8601 format for JSON serialization
  status: 'completed' | 'error' | 'cancelled'
  result?: string
}

export interface SearchHistoryFile {
  projectId: string
  projectName: string
  history: SearchHistoryEntry[]
  lastUpdated: string // ISO 8601 format
}

export interface SaveSearchHistoryRequest {
  projectId: string
  projectName: string
  history: SearchHistoryEntry[]
}

export interface LoadSearchHistoryRequest {
  projectId: string
}

export interface SearchHistoryResponse {
  success: boolean
  history?: SearchHistoryEntry[]
  error?: string
}
