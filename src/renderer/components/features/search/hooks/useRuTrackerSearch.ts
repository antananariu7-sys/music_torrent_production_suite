import { useState } from 'react'
import type { MusicBrainzAlbum } from '@shared/types/musicbrainz.types'
import type { SearchResult } from '@shared/types/search.types'

export interface UseRuTrackerSearchDeps {
  addActivityLog: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void
  setRuTrackerResults: (query: string, results: SearchResult[]) => void
  setError: (error: string) => void
}

/**
 * useRuTrackerSearch
 *
 * Handles the parallel RuTracker search: direct album search + progressive discography search.
 * Returns a `searchRuTracker` callback and the current progress state.
 */
export function useRuTrackerSearch({ addActivityLog, setRuTrackerResults, setError }: UseRuTrackerSearchDeps) {
  const [searchProgress, setSearchProgress] = useState<{ currentPage: number; totalPages: number } | null>(null)

  const searchRuTracker = async (album: MusicBrainzAlbum) => {
    try {
      addActivityLog('Creating optimized RuTracker search query...', 'info')
      const queryResponse = await window.api.musicBrainz.createRuTrackerQuery(album.id)

      if (!queryResponse.success || !queryResponse.data) {
        addActivityLog('Failed to create RuTracker query', 'error')
        setError('Failed to create RuTracker query')
        return
      }

      const albumQuery = queryResponse.data
      const discographyQuery = album.artist

      console.log('[SmartSearch] RuTracker search queries:', { albumQuery, discographyQuery })
      addActivityLog(`Searching RuTracker: "${albumQuery}" + artist pages...`, 'info')

      const cleanupProgress = window.api.search.onProgress((progress) => {
        setSearchProgress({ currentPage: progress.currentPage, totalPages: progress.totalPages })
      })

      const [albumResponse, discographyResponse] = await Promise.allSettled([
        window.api.search.start({
          query: albumQuery,
          filters: { format: 'any', minSeeders: 5 },
          sort: { by: 'relevance', order: 'desc' },
          maxResults: 50,
        }),
        window.api.search.startProgressive({
          query: discographyQuery,
          filters: { minSeeders: 5 },
          maxPages: 50,
        }),
      ])

      cleanupProgress()
      setSearchProgress(null)

      const albumResults: SearchResult[] =
        albumResponse.status === 'fulfilled' && albumResponse.value.success
          ? (albumResponse.value.results || []).map(r => ({ ...r, searchSource: 'album' as const }))
          : []

      const discographyResults: SearchResult[] =
        discographyResponse.status === 'fulfilled' && discographyResponse.value.success
          ? (discographyResponse.value.results || [])
          : []

      // Merge results, deduplicate by ID
      const finalSeenIds = new Set<string>()
      const finalResults: SearchResult[] = []

      for (const r of albumResults) {
        if (!finalSeenIds.has(r.id)) {
          finalSeenIds.add(r.id)
          finalResults.push(r)
        }
      }

      for (const r of discographyResults) {
        if (!finalSeenIds.has(r.id)) {
          finalSeenIds.add(r.id)
          finalResults.push({ ...r, searchSource: 'discography' as const })
        }
      }

      if (finalResults.length > 0) {
        const albumCount = albumResults.length
        const discographyCount = finalResults.filter(r => r.searchSource === 'discography').length

        if (albumCount === 0 && discographyCount > 0) {
          addActivityLog(
            `No direct results for "${album.title}", showing ${discographyCount} results from artist discography`,
            'warning'
          )
        } else {
          const logMsg = discographyCount > 0
            ? `Found ${albumCount} direct + ${discographyCount} from artist search`
            : `Found ${albumCount} torrents on RuTracker`
          addActivityLog(logMsg, 'success')
        }
        setRuTrackerResults(albumQuery, finalResults)
      } else {
        const errorMsg = 'No torrents found on RuTracker'
        addActivityLog(errorMsg, 'warning')
        setError(errorMsg)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to search RuTracker'
      addActivityLog(errorMsg, 'error')
      setError(errorMsg)
    }
  }

  return { searchRuTracker, searchProgress }
}
