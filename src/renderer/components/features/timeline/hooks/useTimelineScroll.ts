import {
  useCallback,
  useEffect,
  type RefObject,
  type MutableRefObject,
} from 'react'
import { useTimelineStore } from '@/store/timelineStore'
import { useAudioPlayerStore } from '@/store/audioPlayerStore'
import type { Song } from '@shared/types/project.types'
import type { TrackPosition } from '../TimelineLayout'

interface UseTimelineScrollOptions {
  containerRef: RefObject<HTMLDivElement | null>
  isScrollSyncing: MutableRefObject<boolean>
  userScrolledRef: MutableRefObject<boolean>
  songs: Song[]
  positions: TrackPosition[]
  pixelsPerSecond: number
}

export function useTimelineScroll({
  containerRef,
  isScrollSyncing,
  userScrolledRef,
  songs,
  positions,
  pixelsPerSecond,
}: UseTimelineScrollOptions) {
  const scrollPosition = useTimelineStore((s) => s.scrollPosition)
  const setScrollPosition = useTimelineStore((s) => s.setScrollPosition)
  const setViewportWidth = useTimelineStore((s) => s.setViewportWidth)

  // Measure container width and track viewport size
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setViewportWidth(entry.contentRect.width)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [setViewportWidth])

  // Sync store scroll position → DOM scroll
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    if (Math.abs(el.scrollLeft - scrollPosition) > 1) {
      isScrollSyncing.current = true
      el.scrollLeft = scrollPosition
      requestAnimationFrame(() => {
        isScrollSyncing.current = false
      })
    }
  }, [scrollPosition])

  // Sync DOM scroll → store (also detect manual scroll during playback)
  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el || isScrollSyncing.current) return
    setScrollPosition(el.scrollLeft)
    // If user manually scrolls during playback, disable auto-scroll
    if (useAudioPlayerStore.getState().isPlaying) {
      userScrolledRef.current = true
    }
  }, [setScrollPosition])

  // Auto-scroll to follow playhead during playback
  useEffect(() => {
    const unsub = useAudioPlayerStore.subscribe((state, prev) => {
      if (!state.isPlaying || !state.currentTrack) return
      // Reset user-scrolled flag when a new track starts playing
      if (state.currentTrack !== prev.currentTrack) {
        userScrolledRef.current = false
      }
      if (userScrolledRef.current) return

      const el = containerRef.current
      if (!el) return

      // Compute playhead pixel position
      const trackIndex = songs.findIndex(
        (s) =>
          (s.localFilePath ?? s.externalFilePath) ===
          state.currentTrack!.filePath
      )
      if (trackIndex === -1) return

      const pos = positions[trackIndex]
      const song = songs[trackIndex]
      const playheadX =
        pos.left + (state.currentTime - (song.trimStart ?? 0)) * pixelsPerSecond

      const viewportLeft = el.scrollLeft
      const viewportRight = el.scrollLeft + el.clientWidth

      // Scroll when playhead exits the visible viewport (with some margin)
      const margin = el.clientWidth * 0.15
      if (
        playheadX < viewportLeft + margin ||
        playheadX > viewportRight - margin
      ) {
        isScrollSyncing.current = true
        const newScroll = Math.max(0, playheadX - el.clientWidth * 0.3)
        el.scrollLeft = newScroll
        setScrollPosition(newScroll)
        requestAnimationFrame(() => {
          isScrollSyncing.current = false
        })
      }
    })
    return unsub
  }, [songs, positions, pixelsPerSecond, setScrollPosition])

  return { handleScroll }
}
