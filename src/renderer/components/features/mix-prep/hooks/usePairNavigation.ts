import { useState, useCallback, useMemo, useEffect } from 'react'
import type { Song } from '@shared/types/project.types'

export interface PairNavigation {
  /** Index of the currently selected track (1-based visual, 0-based internal) */
  selectedIndex: number
  /** The outgoing track (N-1), or null if first track selected */
  outgoingTrack: Song | null
  /** The incoming track (N), i.e. the selected track */
  incomingTrack: Song | null
  /** Whether we can navigate to the previous pair */
  canPrev: boolean
  /** Whether we can navigate to the next pair */
  canNext: boolean
  /** Navigate to next pair */
  goNext: () => void
  /** Navigate to previous pair */
  goPrev: () => void
  /** Select a specific track by index */
  selectIndex: (index: number) => void
  /** Navigate directly to a track index (alias for selectIndex, used by dashboard) */
  goToIndex: (index: number) => void
  /** Total number of transition pairs (songs.length - 1) */
  pairCount: number
  /** Current pair number (1-based, 0 if first track or no pair) */
  currentPairNumber: number
}

/**
 * Hook managing selected pair index and keyboard navigation for the mix preparation view.
 *
 * - Click Track N → shows pair (Track N-1, Track N)
 * - Track 0 selected → single-track view (no incoming transition)
 * - Default: index 1 (first transition pair), or 0 if only one track
 * - Arrow keys ← → step through pairs
 */
export function usePairNavigation(songs: Song[]): PairNavigation {
  const [selectedIndex, setSelectedIndex] = useState(() =>
    songs.length >= 2 ? 1 : 0
  )

  // Clamp selected index when songs change
  useEffect(() => {
    if (songs.length === 0) return
    setSelectedIndex((prev) => {
      if (prev >= songs.length) return songs.length - 1
      if (songs.length >= 2 && prev === 0) return 1
      return prev
    })
  }, [songs.length])

  const canPrev = selectedIndex > 1
  const canNext = selectedIndex < songs.length - 1

  const goNext = useCallback(() => {
    setSelectedIndex((prev) => Math.min(prev + 1, songs.length - 1))
  }, [songs.length])

  const goPrev = useCallback(() => {
    setSelectedIndex((prev) => Math.max(prev - 1, 1))
  }, [])

  const selectIndex = useCallback(
    (index: number) => {
      if (index >= 0 && index < songs.length) {
        setSelectedIndex(index)
      }
    },
    [songs.length]
  )

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      // Don't capture if user is typing in an input
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === 'ArrowRight' && canNext) {
        e.preventDefault()
        goNext()
      } else if (e.key === 'ArrowLeft' && canPrev) {
        e.preventDefault()
        goPrev()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canNext, canPrev, goNext, goPrev])

  const outgoingTrack = useMemo(
    () => (selectedIndex > 0 ? (songs[selectedIndex - 1] ?? null) : null),
    [songs, selectedIndex]
  )

  const incomingTrack = useMemo(
    () => songs[selectedIndex] ?? null,
    [songs, selectedIndex]
  )

  const pairCount = Math.max(0, songs.length - 1)
  const currentPairNumber = selectedIndex >= 1 ? selectedIndex : 0

  return {
    selectedIndex,
    outgoingTrack,
    incomingTrack,
    canPrev,
    canNext,
    goNext,
    goPrev,
    selectIndex,
    goToIndex: selectIndex,
    pairCount,
    currentPairNumber,
  }
}
