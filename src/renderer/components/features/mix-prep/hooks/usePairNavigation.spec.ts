/**
 * @jest-environment jsdom
 */
import { describe, it, expect } from '@jest/globals'
import { renderHook, act } from '@testing-library/react'
import { usePairNavigation } from './usePairNavigation'
import type { Song } from '@shared/types/project.types'

function makeSong(id: string, order: number): Song {
  return {
    id,
    title: `Track ${id}`,
    addedAt: new Date(),
    order,
  }
}

describe('usePairNavigation', () => {
  const songs3 = [makeSong('a', 0), makeSong('b', 1), makeSong('c', 2)]
  const songs1 = [makeSong('a', 0)]
  const songs2 = [makeSong('a', 0), makeSong('b', 1)]

  describe('initial state', () => {
    it('defaults to index 1 (first pair) when 2+ songs', () => {
      const { result } = renderHook(() => usePairNavigation(songs3))
      expect(result.current.selectedIndex).toBe(1)
      expect(result.current.outgoingTrack?.id).toBe('a')
      expect(result.current.incomingTrack?.id).toBe('b')
    })

    it('defaults to index 0 when only 1 song', () => {
      const { result } = renderHook(() => usePairNavigation(songs1))
      expect(result.current.selectedIndex).toBe(0)
      expect(result.current.outgoingTrack).toBeNull()
      expect(result.current.incomingTrack?.id).toBe('a')
    })

    it('returns empty pair count for 0 songs', () => {
      const { result } = renderHook(() => usePairNavigation([]))
      expect(result.current.pairCount).toBe(0)
    })
  })

  describe('pair computation', () => {
    it('clicking track N selects pair (N-1, N)', () => {
      const { result } = renderHook(() => usePairNavigation(songs3))

      act(() => result.current.selectIndex(2))

      expect(result.current.selectedIndex).toBe(2)
      expect(result.current.outgoingTrack?.id).toBe('b')
      expect(result.current.incomingTrack?.id).toBe('c')
    })

    it('selecting track 0 gives null outgoing (first track)', () => {
      const { result } = renderHook(() => usePairNavigation(songs3))

      act(() => result.current.selectIndex(0))

      expect(result.current.outgoingTrack).toBeNull()
      expect(result.current.incomingTrack?.id).toBe('a')
    })

    it('pairCount is songs.length - 1', () => {
      const { result } = renderHook(() => usePairNavigation(songs3))
      expect(result.current.pairCount).toBe(2)
    })

    it('currentPairNumber is 0 for first track, otherwise selectedIndex', () => {
      const { result } = renderHook(() => usePairNavigation(songs3))

      // Default: index 1 → pair number 1
      expect(result.current.currentPairNumber).toBe(1)

      act(() => result.current.selectIndex(0))
      expect(result.current.currentPairNumber).toBe(0)

      act(() => result.current.selectIndex(2))
      expect(result.current.currentPairNumber).toBe(2)
    })
  })

  describe('navigation', () => {
    it('goNext advances to next pair', () => {
      const { result } = renderHook(() => usePairNavigation(songs3))

      expect(result.current.selectedIndex).toBe(1)
      act(() => result.current.goNext())
      expect(result.current.selectedIndex).toBe(2)
    })

    it('goPrev goes to previous pair', () => {
      const { result } = renderHook(() => usePairNavigation(songs3))

      act(() => result.current.selectIndex(2))
      act(() => result.current.goPrev())
      expect(result.current.selectedIndex).toBe(1)
    })

    it('canNext is false at last track', () => {
      const { result } = renderHook(() => usePairNavigation(songs3))

      act(() => result.current.selectIndex(2))
      expect(result.current.canNext).toBe(false)
    })

    it('canPrev is false at track 1 (index 1)', () => {
      const { result } = renderHook(() => usePairNavigation(songs3))

      // Default index 1
      expect(result.current.canPrev).toBe(false)
    })

    it('goNext does not go past last track', () => {
      const { result } = renderHook(() => usePairNavigation(songs2))

      // index 1 is already last
      expect(result.current.canNext).toBe(false)
      act(() => result.current.goNext())
      expect(result.current.selectedIndex).toBe(1)
    })

    it('goPrev does not go below index 1', () => {
      const { result } = renderHook(() => usePairNavigation(songs3))

      act(() => result.current.goPrev())
      expect(result.current.selectedIndex).toBe(1)
    })
  })

  describe('selectIndex bounds', () => {
    it('ignores out-of-range indices', () => {
      const { result } = renderHook(() => usePairNavigation(songs3))

      act(() => result.current.selectIndex(-1))
      expect(result.current.selectedIndex).toBe(1) // unchanged

      act(() => result.current.selectIndex(5))
      expect(result.current.selectedIndex).toBe(1) // unchanged
    })
  })

  describe('keyboard navigation', () => {
    it('ArrowRight calls goNext', () => {
      const { result } = renderHook(() => usePairNavigation(songs3))

      act(() => {
        window.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowRight' })
        )
      })

      expect(result.current.selectedIndex).toBe(2)
    })

    it('ArrowLeft calls goPrev when possible', () => {
      const { result } = renderHook(() => usePairNavigation(songs3))

      // Move to index 2 first
      act(() => result.current.selectIndex(2))

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
      })

      expect(result.current.selectedIndex).toBe(1)
    })

    it('does not navigate when at boundaries', () => {
      const { result } = renderHook(() => usePairNavigation(songs3))

      // At index 1, ArrowLeft should not change
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
      })
      expect(result.current.selectedIndex).toBe(1)
    })
  })

  describe('songs list changes', () => {
    it('clamps index when songs shrink', () => {
      const { result, rerender } = renderHook(
        ({ songs }) => usePairNavigation(songs),
        { initialProps: { songs: songs3 } }
      )

      act(() => result.current.selectIndex(2))
      expect(result.current.selectedIndex).toBe(2)

      // Shrink to 2 songs — index 2 should clamp to 1
      rerender({ songs: songs2 })
      expect(result.current.selectedIndex).toBe(1)
    })
  })
})
