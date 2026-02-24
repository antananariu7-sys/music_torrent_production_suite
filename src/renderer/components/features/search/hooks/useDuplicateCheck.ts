import { useState, useEffect, useRef, useMemo } from 'react'
import type { SearchResult } from '@shared/types/search.types'
import type { DuplicateMatch } from '@shared/types/duplicateDetection.types'

/** Debounce delay before running duplicate check after results change */
const DEBOUNCE_MS = 800

/**
 * Runs a debounced background duplicate check against the project's audio directory.
 * Returns a Map<resultId, DuplicateMatch> for easy lookup in table rows.
 */
export function useDuplicateCheck(
  results: SearchResult[],
  projectDirectory?: string
): Map<string, DuplicateMatch> {
  const [matches, setMatches] = useState<DuplicateMatch[]>([])
  const abortRef = useRef(0)

  // Stable key: sorted result IDs joined
  const resultIds = useMemo(
    () =>
      results
        .map((r) => r.id)
        .sort()
        .join(','),
    [results]
  )

  useEffect(() => {
    if (!projectDirectory || results.length === 0) {
      setMatches([])
      return
    }

    const generation = ++abortRef.current

    const timer = setTimeout(async () => {
      try {
        const response = await window.api.duplicate.check({
          projectDirectory,
          titles: results.map((r) => ({ id: r.id, title: r.title })),
        })

        // Only apply if this is still the latest request
        if (generation !== abortRef.current) return

        if (response.success) {
          setMatches(response.matches)
        }
      } catch {
        // Silently ignore — duplicate check is non-critical
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [resultIds, projectDirectory, results])

  return useMemo(() => {
    const map = new Map<string, DuplicateMatch>()
    for (const m of matches) {
      map.set(m.resultId, m)
    }
    return map
  }, [matches])
}
