/**
 * @jest-environment jsdom
 */
import { describe, it, expect } from '@jest/globals'
import { renderHook, act } from '@testing-library/react'
import { useSearchTableState } from './useSearchTableState'
import type { SearchResult } from '@shared/types/search.types'

// Mock the utility functions
jest.mock('@shared/utils/resultClassifier', () => ({
  classifyResult: jest.fn((result: any) => {
    const title = result.title.toLowerCase()
    if (title.includes('live') || title.includes('concert')) return 'live'
    if (title.includes('best of') || title.includes('greatest'))
      return 'compilation'
    if (title.includes('discography')) return 'discography'
    return 'studio'
  }),
}))

jest.mock('@shared/utils/flacImageDetector', () => ({
  isFlacImage: jest.fn((result: any) =>
    result.title.toLowerCase().includes('image')
  ),
}))

jest.mock('@shared/utils/nonAudioDetector', () => ({
  isNonAudioResult: jest.fn((result: any) =>
    result.title.toLowerCase().includes('[video]')
  ),
}))

function makeResult(
  id: string,
  title: string,
  overrides: Partial<SearchResult> = {}
): SearchResult {
  return {
    id,
    title,
    author: 'artist',
    size: '500 MB',
    sizeBytes: 500 * 1024 * 1024,
    seeders: 10,
    leechers: 2,
    url: `https://example.com/${id}`,
    relevanceScore: 50,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

describe('useSearchTableState — filtering', () => {
  it('returns all results in rows when filter is empty', () => {
    const results = [
      makeResult('1', 'Album One'),
      makeResult('2', 'Album Two'),
      makeResult('3', 'Album Three'),
    ]
    const { result } = renderHook(() => useSearchTableState(results))

    expect(result.current.filteredCount).toBe(3)
  })

  it('filters results by case-insensitive title substring', () => {
    const results = [
      makeResult('1', 'The Dark Side of the Moon'),
      makeResult('2', 'Abbey Road'),
      makeResult('3', 'dark star album'),
    ]
    const { result } = renderHook(() => useSearchTableState(results))

    act(() => {
      result.current.onFilterChange('dark')
    })

    expect(result.current.filteredCount).toBe(2)
    const resultRows = result.current.rows.filter((r) => r.type === 'result')
    const titles = resultRows.map((r) => (r as any).result.title)
    expect(titles).toContain('The Dark Side of the Moon')
    expect(titles).toContain('dark star album')
    expect(titles).not.toContain('Abbey Road')
  })

  it('filter is case-insensitive (upper-case query matches lower-case title)', () => {
    const results = [
      makeResult('1', 'abbey road'),
      makeResult('2', 'Let It Be'),
    ]
    const { result } = renderHook(() => useSearchTableState(results))

    act(() => {
      result.current.onFilterChange('ABBEY')
    })

    expect(result.current.filteredCount).toBe(1)
  })

  it('filter change resets current page to 1', () => {
    // Use enough results to push onto page 2
    const results = Array.from({ length: 60 }, (_, i) =>
      makeResult(String(i), `Album ${i}`, { relevanceScore: i })
    )
    const { result } = renderHook(() => useSearchTableState(results))

    act(() => {
      result.current.onPageChange(2)
    })
    expect(result.current.currentPage).toBe(2)

    act(() => {
      result.current.onFilterChange('Album')
    })
    expect(result.current.currentPage).toBe(1)
  })

  it('filter change collapses the currently expanded row', () => {
    const results = [makeResult('1', 'Foo Album'), makeResult('2', 'Bar Album')]
    const { result } = renderHook(() => useSearchTableState(results))

    act(() => {
      result.current.onToggleExpand('1')
    })
    expect(result.current.expandedRowId).toBe('1')

    act(() => {
      result.current.onFilterChange('foo')
    })
    expect(result.current.expandedRowId).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Non-audio hiding
// ---------------------------------------------------------------------------

describe('useSearchTableState — non-audio hiding', () => {
  it('excludes [video] results from the main table rows', () => {
    const results = [
      makeResult('1', 'Normal Album'),
      makeResult('2', 'Concert [Video]'),
    ]
    const { result } = renderHook(() => useSearchTableState(results))

    const resultRows = result.current.rows.filter((r) => r.type === 'result')
    const ids = resultRows.map((r) => (r as any).result.id)
    expect(ids).not.toContain('2')
    expect(ids).toContain('1')
  })

  it('hiddenCount reflects the number of non-audio results', () => {
    const results = [
      makeResult('1', 'Normal Album'),
      makeResult('2', 'Concert [Video]'),
      makeResult('3', 'Live Show [Video]'),
    ]
    const { result } = renderHook(() => useSearchTableState(results))

    expect(result.current.hiddenCount).toBe(2)
  })

  it('hiddenResults contains non-audio results sorted by active sort column', () => {
    const results = [
      makeResult('1', 'Normal Album'),
      makeResult('2', 'A [Video]', { relevanceScore: 80 }),
      makeResult('3', 'Z [Video]', { relevanceScore: 20 }),
    ]
    const { result } = renderHook(() => useSearchTableState(results))

    // Default sort is relevance desc — hidden results should follow same ordering
    expect(result.current.hiddenResults[0].id).toBe('2')
    expect(result.current.hiddenResults[1].id).toBe('3')
  })
})

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

describe('useSearchTableState — grouping (album tab)', () => {
  // 8 results to exceed the threshold of 5
  const results = [
    makeResult('s1', 'Studio Album One', { relevanceScore: 90 }),
    makeResult('s2', 'Studio Album Two', { relevanceScore: 80 }),
    makeResult('s3', 'Studio Album Three', { relevanceScore: 70 }),
    makeResult('l1', 'Live at the Forum', { relevanceScore: 60 }),
    makeResult('l2', 'Live Concert 2005', { relevanceScore: 50 }),
    makeResult('c1', 'Best Of Collection', { relevanceScore: 40 }),
    makeResult('o1', 'Discography Pack', { relevanceScore: 30 }),
    makeResult('o2', 'Discography Complete', { relevanceScore: 20 }),
  ]

  it('produces group header rows for non-empty groups', () => {
    const { result } = renderHook(() => useSearchTableState(results))

    const groupRows = result.current.rows.filter((r) => r.type === 'group')
    const groups = groupRows.map((r) => (r as any).group)

    expect(groups).toContain('studio')
    expect(groups).toContain('live')
    expect(groups).toContain('compilation')
    // 'discography' results are merged into 'other'
    expect(groups).toContain('other')
  })

  it('does not produce group headers for empty groups', () => {
    // No compilation results
    const noCompilation = results.filter(
      (r) => !r.title.toLowerCase().includes('best of')
    )
    const { result } = renderHook(() => useSearchTableState(noCompilation))

    const groupRows = result.current.rows.filter((r) => r.type === 'group')
    const groups = groupRows.map((r) => (r as any).group)
    expect(groups).not.toContain('compilation')
  })

  it('results classified as discography are merged into the other group', () => {
    const { result } = renderHook(() => useSearchTableState(results))

    const groupRows = result.current.rows.filter((r) => r.type === 'group')
    const groups = groupRows.map((r) => (r as any).group)
    expect(groups).not.toContain('discography')

    const otherGroup = groupRows.find(
      (r) => (r as any).group === 'other'
    ) as any
    // Both discography results should be counted in 'other'
    expect(otherGroup.count).toBe(2)
  })

  it('uses flat table (no group headers) when total filtered results < 5', () => {
    const fewResults = [
      makeResult('s1', 'Studio Album One'),
      makeResult('l1', 'Live at the Forum'),
      makeResult('c1', 'Best Of Collection'),
    ]
    const { result } = renderHook(() => useSearchTableState(fewResults))

    const groupRows = result.current.rows.filter((r) => r.type === 'group')
    expect(groupRows).toHaveLength(0)
  })

  it('exactly 5 results produces grouped rows (threshold is >= 5)', () => {
    const fiveResults = [
      makeResult('s1', 'Studio Album One'),
      makeResult('s2', 'Studio Album Two'),
      makeResult('l1', 'Live at the Forum'),
      makeResult('l2', 'Live Concert 2005'),
      makeResult('c1', 'Best Of Collection'),
    ]
    const { result } = renderHook(() => useSearchTableState(fiveResults))

    const groupRows = result.current.rows.filter((r) => r.type === 'group')
    expect(groupRows.length).toBeGreaterThan(0)
  })
})

describe('useSearchTableState — grouping (discography tab)', () => {
  const results = [
    makeResult('s1', 'Studio Album One', { relevanceScore: 90 }),
    makeResult('s2', 'Studio Album Two', { relevanceScore: 80 }),
    makeResult('l1', 'Live at the Forum', { relevanceScore: 70 }),
    makeResult('l2', 'Live Concert 2005', { relevanceScore: 60 }),
    makeResult('c1', 'Best Of Collection', { relevanceScore: 50 }),
    makeResult('o1', 'Other Release', { relevanceScore: 40 }),
    makeResult('o2', 'Another Release', { relevanceScore: 30 }),
  ]

  it('discography tab group order starts with albumMatch then studio/live/compilation/other', () => {
    const scanResultsMap = new Map([
      ['s1', { albumFound: true, tracks: [], confidence: 1 }],
    ])

    const { result } = renderHook(() =>
      useSearchTableState(results, {
        scanResultsMap: scanResultsMap as any,
        tabType: 'discography',
      })
    )

    const groupRows = result.current.rows.filter((r) => r.type === 'group')
    const groups = groupRows.map((r) => (r as any).group)

    // albumMatch should appear first if present
    expect(groups[0]).toBe('albumMatch')
    // studio should follow
    expect(groups).toContain('studio')
    expect(groups).toContain('live')
    expect(groups).toContain('compilation')
  })

  it('albumMatch group is omitted when no scan-confirmed matches exist', () => {
    const { result } = renderHook(() =>
      useSearchTableState(results, { tabType: 'discography' })
    )

    const groupRows = result.current.rows.filter((r) => r.type === 'group')
    const groups = groupRows.map((r) => (r as any).group)
    expect(groups).not.toContain('albumMatch')
  })
})

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

describe('useSearchTableState — sorting', () => {
  const results = [
    makeResult('1', 'Alpha', {
      relevanceScore: 10,
      seeders: 5,
      sizeBytes: 100,
    }),
    makeResult('2', 'Beta', {
      relevanceScore: 50,
      seeders: 30,
      sizeBytes: 300,
    }),
    makeResult('3', 'Gamma', {
      relevanceScore: 90,
      seeders: 15,
      sizeBytes: 200,
    }),
  ]

  it('default sort is relevance descending', () => {
    const { result } = renderHook(() => useSearchTableState(results))

    expect(result.current.sortColumn).toBe('relevance')
    expect(result.current.sortDirection).toBe('desc')
    expect(result.current.sortClicks).toBe(0)
  })

  it('clicking a new column sets ascending sort with sortClicks = 1', () => {
    const { result } = renderHook(() => useSearchTableState(results))

    act(() => {
      result.current.onSort('title')
    })

    expect(result.current.sortColumn).toBe('title')
    expect(result.current.sortDirection).toBe('asc')
    expect(result.current.sortClicks).toBe(1)
  })

  it('clicking the same column a second time sets descending with sortClicks = 2', () => {
    const { result } = renderHook(() => useSearchTableState(results))

    act(() => {
      result.current.onSort('title')
    })
    act(() => {
      result.current.onSort('title')
    })

    expect(result.current.sortColumn).toBe('title')
    expect(result.current.sortDirection).toBe('desc')
    expect(result.current.sortClicks).toBe(2)
  })

  it('clicking the same column a third time resets to default relevance desc with sortClicks = 0', () => {
    const { result } = renderHook(() => useSearchTableState(results))

    act(() => {
      result.current.onSort('title')
    })
    act(() => {
      result.current.onSort('title')
    })
    act(() => {
      result.current.onSort('title')
    })

    expect(result.current.sortColumn).toBe('relevance')
    expect(result.current.sortDirection).toBe('desc')
    expect(result.current.sortClicks).toBe(0)
  })

  it('clicking a different column resets sortClicks to 1 on the new column', () => {
    const { result } = renderHook(() => useSearchTableState(results))

    act(() => {
      result.current.onSort('title')
    })
    act(() => {
      result.current.onSort('title')
    })
    // sortClicks is 2, now switch to a different column
    act(() => {
      result.current.onSort('seeders')
    })

    expect(result.current.sortColumn).toBe('seeders')
    expect(result.current.sortDirection).toBe('asc')
    expect(result.current.sortClicks).toBe(1)
  })

  it('FLAC image results sort to bottom within their group', () => {
    // Need >= 5 results for grouping
    const imageResults = [
      makeResult('img1', 'Studio Image FLAC', { relevanceScore: 99 }),
      makeResult('s1', 'Studio Album One', { relevanceScore: 90 }),
      makeResult('s2', 'Studio Album Two', { relevanceScore: 80 }),
      makeResult('s3', 'Studio Album Three', { relevanceScore: 70 }),
      makeResult('s4', 'Studio Album Four', { relevanceScore: 60 }),
      makeResult('s5', 'Studio Album Five', { relevanceScore: 50 }),
    ]
    const { result } = renderHook(() => useSearchTableState(imageResults))

    // Find the studio group result rows
    let inStudioGroup = false
    const studioResultRows: string[] = []
    for (const row of result.current.rows) {
      if (row.type === 'group' && (row as any).group === 'studio') {
        inStudioGroup = true
        continue
      }
      if (row.type === 'group') {
        inStudioGroup = false
        continue
      }
      if (inStudioGroup && row.type === 'result') {
        studioResultRows.push((row as any).result.id)
      }
    }

    // The image result should be last within the studio group
    expect(studioResultRows[studioResultRows.length - 1]).toBe('img1')
  })

  it('sort change resets current page to 1', () => {
    const manyResults = Array.from({ length: 60 }, (_, i) =>
      makeResult(String(i), `Album ${i}`, { relevanceScore: i })
    )
    const { result } = renderHook(() => useSearchTableState(manyResults))

    act(() => {
      result.current.onPageChange(2)
    })
    expect(result.current.currentPage).toBe(2)

    act(() => {
      result.current.onSort('title')
    })
    expect(result.current.currentPage).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

describe('useSearchTableState — pagination', () => {
  it('default page size is 50', () => {
    const { result } = renderHook(() => useSearchTableState([]))

    expect(result.current.pageSize).toBe(50)
  })

  it('totalPages equals ceil(filteredCount / pageSize)', () => {
    const results = Array.from({ length: 110 }, (_, i) =>
      makeResult(String(i), `Album ${i}`, { relevanceScore: i })
    )
    const { result } = renderHook(() => useSearchTableState(results))

    // 110 / 50 = 2.2 → ceil = 3
    expect(result.current.totalPages).toBe(3)
  })

  it('onPageSizeChange resets to page 1', () => {
    const results = Array.from({ length: 110 }, (_, i) =>
      makeResult(String(i), `Album ${i}`, { relevanceScore: i })
    )
    const { result } = renderHook(() => useSearchTableState(results))

    act(() => {
      result.current.onPageChange(2)
    })
    expect(result.current.currentPage).toBe(2)

    act(() => {
      result.current.onPageSizeChange(25)
    })
    expect(result.current.currentPage).toBe(1)
    expect(result.current.pageSize).toBe(25)
  })

  it('onPageChange clamps to valid range (does not go below 1 or above totalPages)', () => {
    const results = Array.from({ length: 60 }, (_, i) =>
      makeResult(String(i), `Album ${i}`, { relevanceScore: i })
    )
    const { result } = renderHook(() => useSearchTableState(results))

    act(() => {
      result.current.onPageChange(0)
    })
    expect(result.current.currentPage).toBe(1)

    act(() => {
      result.current.onPageChange(999)
    })
    expect(result.current.currentPage).toBe(result.current.totalPages)
  })
})

// ---------------------------------------------------------------------------
// Row expansion
// ---------------------------------------------------------------------------

describe('useSearchTableState — row expansion', () => {
  const results = [makeResult('1', 'Album One'), makeResult('2', 'Album Two')]

  it('expandedRowId is null by default', () => {
    const { result } = renderHook(() => useSearchTableState(results))

    expect(result.current.expandedRowId).toBeNull()
  })

  it('onToggleExpand(id) expands the given row', () => {
    const { result } = renderHook(() => useSearchTableState(results))

    act(() => {
      result.current.onToggleExpand('1')
    })

    expect(result.current.expandedRowId).toBe('1')
  })

  it('expanding a different row collapses the previous one', () => {
    const { result } = renderHook(() => useSearchTableState(results))

    act(() => {
      result.current.onToggleExpand('1')
    })
    act(() => {
      result.current.onToggleExpand('2')
    })

    expect(result.current.expandedRowId).toBe('2')
  })

  it('expanding the already expanded row collapses it (toggles off)', () => {
    const { result } = renderHook(() => useSearchTableState(results))

    act(() => {
      result.current.onToggleExpand('1')
    })
    act(() => {
      result.current.onToggleExpand('1')
    })

    expect(result.current.expandedRowId).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Group collapse
// ---------------------------------------------------------------------------

describe('useSearchTableState — group collapse', () => {
  // 8 results to ensure grouping is enabled
  const results = [
    makeResult('s1', 'Studio Album One', { relevanceScore: 90 }),
    makeResult('s2', 'Studio Album Two', { relevanceScore: 80 }),
    makeResult('s3', 'Studio Album Three', { relevanceScore: 70 }),
    makeResult('s4', 'Studio Album Four', { relevanceScore: 60 }),
    makeResult('l1', 'Live at the Forum', { relevanceScore: 50 }),
    makeResult('l2', 'Live Concert 2005', { relevanceScore: 40 }),
    makeResult('l3', 'Live Session 2010', { relevanceScore: 30 }),
    makeResult('l4', 'Live in Tokyo', { relevanceScore: 20 }),
  ]

  it('isGroupCollapsed returns false for all groups by default', () => {
    const { result } = renderHook(() => useSearchTableState(results))

    expect(result.current.isGroupCollapsed('studio')).toBe(false)
    expect(result.current.isGroupCollapsed('live')).toBe(false)
  })

  it('onToggleGroup collapses the group and hides its result rows from output', () => {
    const { result } = renderHook(() => useSearchTableState(results))

    const studioResultsBefore = result.current.rows.filter(
      (r) =>
        r.type === 'result' &&
        ['s1', 's2', 's3', 's4'].includes((r as any).result.id)
    )
    expect(studioResultsBefore.length).toBe(4)

    act(() => {
      result.current.onToggleGroup('studio')
    })

    expect(result.current.isGroupCollapsed('studio')).toBe(true)

    const studioResultsAfter = result.current.rows.filter(
      (r) =>
        r.type === 'result' &&
        ['s1', 's2', 's3', 's4'].includes((r as any).result.id)
    )
    expect(studioResultsAfter).toHaveLength(0)

    // Group header is also removed from paginated rows because the pagination
    // logic only includes group headers when at least one of their results
    // is visible on the current page. Collapsed groups have no visible results.
    const groupRow = result.current.rows.find(
      (r) => r.type === 'group' && (r as any).group === 'studio'
    )
    expect(groupRow).toBeUndefined()
  })

  it('toggling a collapsed group again expands it and restores result rows', () => {
    const { result } = renderHook(() => useSearchTableState(results))

    act(() => {
      result.current.onToggleGroup('live')
    })
    expect(result.current.isGroupCollapsed('live')).toBe(true)

    act(() => {
      result.current.onToggleGroup('live')
    })
    expect(result.current.isGroupCollapsed('live')).toBe(false)

    const liveResultRows = result.current.rows.filter(
      (r) =>
        r.type === 'result' &&
        ['l1', 'l2', 'l3', 'l4'].includes((r as any).result.id)
    )
    expect(liveResultRows.length).toBe(4)
  })

  it('collapsing one group does not affect other groups', () => {
    const { result } = renderHook(() => useSearchTableState(results))

    act(() => {
      result.current.onToggleGroup('studio')
    })

    expect(result.current.isGroupCollapsed('live')).toBe(false)

    const liveResultRows = result.current.rows.filter(
      (r) =>
        r.type === 'result' &&
        ['l1', 'l2', 'l3', 'l4'].includes((r as any).result.id)
    )
    expect(liveResultRows.length).toBe(4)
  })
})
