import { describe, it, expect, beforeEach } from '@jest/globals'

import { useSearchStore } from './useSearchStore'

describe('useSearchStore', () => {
  beforeEach(() => {
    useSearchStore.setState({
      isSearching: false,
      query: '',
      results: [],
      error: undefined,
    })
  })

  describe('setResults', () => {
    it('should set results and clear error', () => {
      useSearchStore.setState({ error: 'prev error' })

      useSearchStore
        .getState()
        .setResults([{ id: '1', title: 'Result' } as any])

      const state = useSearchStore.getState()
      expect(state.results).toHaveLength(1)
      expect(state.error).toBeUndefined()
    })
  })

  describe('setError', () => {
    it('should set error and clear results', () => {
      useSearchStore.setState({ results: [{ id: '1' } as any] })

      useSearchStore.getState().setError('Search failed')

      const state = useSearchStore.getState()
      expect(state.error).toBe('Search failed')
      expect(state.results).toEqual([])
    })
  })

  describe('clearResults', () => {
    it('should clear both results and error', () => {
      useSearchStore.setState({
        results: [{ id: '1' } as any],
        error: 'error',
      })

      useSearchStore.getState().clearResults()

      const state = useSearchStore.getState()
      expect(state.results).toEqual([])
      expect(state.error).toBeUndefined()
    })
  })

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      useSearchStore.setState({
        isSearching: true,
        query: 'test',
        results: [{ id: '1' } as any],
        error: 'error',
      })

      useSearchStore.getState().reset()

      const state = useSearchStore.getState()
      expect(state.isSearching).toBe(false)
      expect(state.query).toBe('')
      expect(state.results).toEqual([])
      expect(state.error).toBeUndefined()
    })
  })

  describe('setQuery', () => {
    it('should update query without affecting other state', () => {
      useSearchStore.setState({ results: [{ id: '1' } as any] })

      useSearchStore.getState().setQuery('new query')

      expect(useSearchStore.getState().query).toBe('new query')
      expect(useSearchStore.getState().results).toHaveLength(1)
    })
  })
})
