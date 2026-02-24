import { useState, useMemo, useCallback } from 'react'
import type { SearchResult, ResultGroup } from '@shared/types/search.types'
import { classifyResult } from '@shared/utils/resultClassifier'
import { isFlacImage } from '@shared/utils/flacImageDetector'

export type SortColumn = 'title' | 'size' | 'seeders' | 'relevance'
export type SortDirection = 'asc' | 'desc'

/** Group display order — discography results go into "other" until Phase 3 tabs */
const GROUP_ORDER: ResultGroup[] = ['studio', 'live', 'compilation', 'other']

interface GroupedRow {
  type: 'group'
  group: ResultGroup
  count: number
}

interface ResultRow {
  type: 'result'
  result: SearchResult
}

export type TableRow = GroupedRow | ResultRow

interface SearchTableState {
  /** Flattened rows for rendering (group headers + result rows) */
  rows: TableRow[]
  /** Current sort column */
  sortColumn: SortColumn
  /** Current sort direction */
  sortDirection: SortDirection
  /** Number of sort clicks on current column (for 3-click reset) */
  sortClicks: number
  /** Handle column header click */
  onSort: (column: SortColumn) => void
  /** Toggle group collapse */
  onToggleGroup: (group: ResultGroup) => void
  /** Whether a group is collapsed */
  isGroupCollapsed: (group: ResultGroup) => boolean
  /** Currently expanded row ID (single expansion) */
  expandedRowId: string | null
  /** Toggle row expansion */
  onToggleExpand: (id: string) => void
  /** Filter text for title search */
  filterText: string
  /** Set filter text (resets page to 1, collapses expanded row) */
  onFilterChange: (text: string) => void
  /** Current page number (1-indexed) */
  currentPage: number
  /** Page size */
  pageSize: number
  /** Total number of results after filtering */
  filteredCount: number
  /** Total number of results before filtering */
  totalCount: number
  /** Total pages */
  totalPages: number
  /** Set current page */
  onPageChange: (page: number) => void
  /** Set page size (resets to page 1) */
  onPageSizeChange: (size: number) => void
}

const DEFAULT_SORT_COLUMN: SortColumn = 'relevance'
const DEFAULT_SORT_DIRECTION: SortDirection = 'desc'

function compareResults(
  a: SearchResult,
  b: SearchResult,
  column: SortColumn,
  direction: SortDirection
): number {
  const dir = direction === 'asc' ? 1 : -1

  switch (column) {
    case 'title':
      return dir * a.title.localeCompare(b.title)
    case 'size': {
      const aSize = a.sizeBytes ?? 0
      const bSize = b.sizeBytes ?? 0
      return dir * (aSize - bSize)
    }
    case 'seeders':
      return dir * (a.seeders - b.seeders)
    case 'relevance': {
      const aScore = a.relevanceScore ?? 0
      const bScore = b.relevanceScore ?? 0
      return dir * (aScore - bScore)
    }
  }
}

export function useSearchTableState(results: SearchResult[]): SearchTableState {
  const [sortColumn, setSortColumn] = useState<SortColumn>(DEFAULT_SORT_COLUMN)
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    DEFAULT_SORT_DIRECTION
  )
  const [sortClicks, setSortClicks] = useState(0)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<ResultGroup>>(
    () => new Set()
  )
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)
  const [filterText, setFilterText] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // Filter results by title substring (case-insensitive)
  const filteredResults = useMemo(() => {
    if (!filterText.trim()) return results
    const lower = filterText.toLowerCase()
    return results.filter((r) => r.title.toLowerCase().includes(lower))
  }, [results, filterText])

  const totalCount = results.length
  const filteredCount = filteredResults.length
  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize))

  // Classify filtered results into groups, merging 'discography' into 'other'
  const groupedResults = useMemo(() => {
    const groups: Record<ResultGroup, SearchResult[]> = {
      studio: [],
      live: [],
      compilation: [],
      discography: [],
      other: [],
    }

    for (const result of filteredResults) {
      const group = classifyResult(result)
      if (group === 'discography') {
        groups.other.push(result)
      } else {
        groups[group].push(result)
      }
    }

    return groups
  }, [filteredResults])

  // Sort within each group: FLAC images to bottom, then by active sort column
  const sortedGroups = useMemo(() => {
    const sorted: Record<string, SearchResult[]> = {}

    for (const group of GROUP_ORDER) {
      const items = groupedResults[group]
      if (items.length === 0) continue

      sorted[group] = [...items].sort((a, b) => {
        // FLAC images always sort to bottom
        const aIsImage = isFlacImage(a)
        const bIsImage = isFlacImage(b)
        if (aIsImage !== bIsImage) return aIsImage ? 1 : -1

        return compareResults(a, b, sortColumn, sortDirection)
      })
    }

    return sorted
  }, [groupedResults, sortColumn, sortDirection])

  // Build flat row list for rendering (all rows, before pagination)
  const allRows = useMemo<TableRow[]>(() => {
    const useGroups = filteredResults.length >= 5

    if (!useGroups) {
      // Flat table — sort all results together
      const allSorted = [...filteredResults].sort((a, b) => {
        const aIsImage = isFlacImage(a)
        const bIsImage = isFlacImage(b)
        if (aIsImage !== bIsImage) return aIsImage ? 1 : -1
        return compareResults(a, b, sortColumn, sortDirection)
      })
      return allSorted.map((result) => ({ type: 'result' as const, result }))
    }

    const rowList: TableRow[] = []

    for (const group of GROUP_ORDER) {
      const items = sortedGroups[group]
      if (!items || items.length === 0) continue

      rowList.push({ type: 'group', group, count: items.length })

      if (!collapsedGroups.has(group)) {
        for (const result of items) {
          rowList.push({ type: 'result', result })
        }
      }
    }

    return rowList
  }, [
    filteredResults,
    sortedGroups,
    sortColumn,
    sortDirection,
    collapsedGroups,
  ])

  // Paginate: slice result rows only, keeping group headers for visible results
  const rows = useMemo<TableRow[]>(() => {
    // Count only result rows for pagination
    const resultRows = allRows.filter((r) => r.type === 'result')
    const startIdx = (currentPage - 1) * pageSize
    const pageResultIds = new Set(
      resultRows.slice(startIdx, startIdx + pageSize).map((r) => {
        if (r.type === 'result') return r.result.id
        return ''
      })
    )

    // Include group headers if they have visible results
    return allRows.filter((row) => {
      if (row.type === 'result') return pageResultIds.has(row.result.id)
      // Include group header if at least one of its results is on this page
      if (row.type === 'group') {
        const groupItems = sortedGroups[row.group]
        return groupItems?.some((item) => pageResultIds.has(item.id)) ?? false
      }
      return false
    })
  }, [allRows, currentPage, pageSize, sortedGroups])

  const onSort = useCallback(
    (column: SortColumn) => {
      if (column === sortColumn) {
        // Same column — cycle: asc → desc → reset
        const nextClicks = sortClicks + 1
        if (nextClicks >= 3) {
          // Reset to default
          setSortColumn(DEFAULT_SORT_COLUMN)
          setSortDirection(DEFAULT_SORT_DIRECTION)
          setSortClicks(0)
        } else {
          setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
          setSortClicks(nextClicks)
        }
      } else {
        // New column — start with ascending
        setSortColumn(column)
        setSortDirection('asc')
        setSortClicks(1)
      }
      setCurrentPage(1)
    },
    [sortColumn, sortClicks]
  )

  const onToggleGroup = useCallback((group: ResultGroup) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(group)) {
        next.delete(group)
      } else {
        next.add(group)
      }
      return next
    })
  }, [])

  const isGroupCollapsed = useCallback(
    (group: ResultGroup) => collapsedGroups.has(group),
    [collapsedGroups]
  )

  const onToggleExpand = useCallback((id: string) => {
    setExpandedRowId((prev) => (prev === id ? null : id))
  }, [])

  const onFilterChange = useCallback((text: string) => {
    setFilterText(text)
    setCurrentPage(1)
    setExpandedRowId(null)
  }, [])

  const onPageChange = useCallback(
    (page: number) => {
      setCurrentPage(Math.max(1, Math.min(page, totalPages)))
    },
    [totalPages]
  )

  const onPageSizeChange = useCallback((size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }, [])

  return {
    rows,
    sortColumn,
    sortDirection,
    sortClicks,
    onSort,
    onToggleGroup,
    isGroupCollapsed,
    expandedRowId,
    onToggleExpand,
    filterText,
    onFilterChange,
    currentPage,
    pageSize,
    filteredCount,
    totalCount,
    totalPages,
    onPageChange,
    onPageSizeChange,
  }
}
