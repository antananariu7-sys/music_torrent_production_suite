import type { SearchResult, SearchFilters, SearchSort } from '@shared/types/search.types'

/**
 * SearchFiltersApplier
 *
 * Handles filtering and sorting of search results
 */
export class SearchFiltersApplier {
  /**
   * Apply filters to search results
   *
   * @param results - Search results
   * @param filters - Filters to apply
   * @returns Filtered results
   */
  applyFilters(results: SearchResult[], filters: SearchFilters): SearchResult[] {
    return results.filter(result => {
      // Format filter
      if (filters.format && filters.format !== 'any') {
        if (result.format !== filters.format) {
          return false
        }
      }

      // Min seeders filter
      if (filters.minSeeders !== undefined) {
        if (result.seeders < filters.minSeeders) {
          return false
        }
      }

      // Size filters
      if (result.sizeBytes) {
        const sizeMB = result.sizeBytes / (1024 * 1024)

        if (filters.minSize !== undefined && sizeMB < filters.minSize) {
          return false
        }

        if (filters.maxSize !== undefined && sizeMB > filters.maxSize) {
          return false
        }
      }

      // Category filter
      if (filters.categories && filters.categories.length > 0) {
        if (!result.category || !filters.categories.includes(result.category)) {
          return false
        }
      }

      // Date filters (if uploadDate is available)
      if (result.uploadDate) {
        const uploadDate = new Date(result.uploadDate)

        if (filters.dateFrom && uploadDate < filters.dateFrom) {
          return false
        }

        if (filters.dateTo && uploadDate > filters.dateTo) {
          return false
        }
      }

      return true
    })
  }

  /**
   * Apply sorting to search results
   *
   * @param results - Search results
   * @param sort - Sort parameters
   * @returns Sorted results
   */
  applySorting(results: SearchResult[], sort: SearchSort): SearchResult[] {
    const sorted = [...results]

    sorted.sort((a, b) => {
      let comparison = 0

      switch (sort.by) {
        case 'relevance':
          // Higher score first (desc by default)
          comparison = (a.relevanceScore || 0) - (b.relevanceScore || 0)
          break
        case 'seeders':
          // More seeders first (desc by default)
          comparison = a.seeders - b.seeders
          break
        case 'date':
          // Newer first (desc by default)
          if (a.uploadDate && b.uploadDate) {
            comparison = new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime()
          }
          break
        case 'size':
          // Larger first (desc by default)
          comparison = (a.sizeBytes || 0) - (b.sizeBytes || 0)
          break
        case 'title':
          // Alphabetical (asc by default)
          comparison = a.title.localeCompare(b.title)
          break
      }

      // For most fields, desc means reverse order
      // For title, asc is natural alphabetical order
      if (sort.by === 'title') {
        return sort.order === 'asc' ? comparison : -comparison
      } else {
        return sort.order === 'desc' ? -comparison : comparison
      }
    })

    return sorted
  }
}
