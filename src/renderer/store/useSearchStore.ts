import { create } from 'zustand'
import type { SearchResult } from '@shared/types/search.types'

interface SearchStore {
  // State
  isSearching: boolean
  query: string
  results: SearchResult[]
  error: string | undefined

  // Actions
  setSearching: (isSearching: boolean) => void
  setQuery: (query: string) => void
  setResults: (results: SearchResult[]) => void
  setError: (error: string | undefined) => void
  clearResults: () => void
  reset: () => void
}

export const useSearchStore = create<SearchStore>((set) => ({
  // Initial state
  isSearching: false,
  query: '',
  results: [],
  error: undefined,

  // Actions
  setSearching: (isSearching) => set({ isSearching }),

  setQuery: (query) => set({ query }),

  setResults: (results) => set({ results, error: undefined }),

  setError: (error) => set({ error, results: [] }),

  clearResults: () => set({ results: [], error: undefined }),

  reset: () => set({ isSearching: false, query: '', results: [], error: undefined }),
}))
