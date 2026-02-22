import { useRef, useState, useCallback } from 'react'
import { useTimelineStore } from '@/store/timelineStore'
import { snapToNearestBeat } from '../utils/snapToBeat'
import type { Song } from '@shared/types/project.types'

interface RegionDragState {
  songId: string
  startX: number
  startTime: number
  trimStart: number
  trimEnd: number
  isDragging: boolean
}

interface PendingSelection {
  songId: string
  startTime: number
  endTime: number
}

/** Minimum region width in seconds */
const MIN_REGION_SECONDS = 0.5
/** Pixel threshold before drag activates */
const DRAG_THRESHOLD = 5

interface UseRegionSelectionOptions {
  pixelsPerSecond: number
  snapMode: 'off' | 'beat'
  containerRef: React.RefObject<HTMLDivElement | null>
}

export interface UseRegionSelectionReturn {
  pendingSelection: PendingSelection | null
  /** Set to true after a region drag completes — caller should skip click-to-play */
  didRegionSelect: React.MutableRefObject<boolean>
  handleRegionPointerDown: (
    e: React.PointerEvent,
    song: Song,
    trackLeft: number
  ) => void
}

export function useRegionSelection({
  pixelsPerSecond,
  snapMode,
  containerRef,
}: UseRegionSelectionOptions): UseRegionSelectionReturn {
  const setActiveSelection = useTimelineStore((s) => s.setActiveSelection)

  const regionDragRef = useRef<RegionDragState | null>(null)
  const didRegionSelectRef = useRef(false)
  const [pendingSelection, setPendingSelection] =
    useState<PendingSelection | null>(null)

  const handleRegionPointerDown = useCallback(
    (e: React.PointerEvent, song: Song, trackLeft: number) => {
      // Only left button
      if (e.button !== 0) return
      // Don't start region select if event originated from an interactive child
      const target = e.target as HTMLElement
      if (
        target.closest('[data-drag-handle]') ||
        target.closest('[data-cue-marker]')
      )
        return

      const el = containerRef.current
      if (!el) return

      const startX = e.clientX
      const clickXInTrack =
        e.clientX - el.getBoundingClientRect().left + el.scrollLeft - trackLeft
      const trimStart = song.trimStart ?? 0
      const trimEnd = song.trimEnd ?? song.duration ?? 0
      const startTime = Math.max(
        trimStart,
        Math.min(trimEnd, clickXInTrack / pixelsPerSecond + trimStart)
      )

      regionDragRef.current = {
        songId: song.id,
        startX,
        startTime,
        trimStart,
        trimEnd,
        isDragging: false,
      }

      const div = e.currentTarget as HTMLElement
      div.setPointerCapture(e.pointerId)
      const prevUserSelect = document.body.style.userSelect
      document.body.style.userSelect = 'none'

      const canSnap =
        snapMode === 'beat' &&
        song.bpm != null &&
        song.bpm > 0 &&
        song.firstBeatOffset != null

      const snapTime = (t: number, ts: number, te: number): number => {
        if (canSnap) {
          t = snapToNearestBeat(t, song.bpm!, song.firstBeatOffset!)
        }
        return Math.max(ts, Math.min(te, t))
      }

      const handleMove = (ev: PointerEvent): void => {
        const state = regionDragRef.current
        if (!state) return
        const deltaX = ev.clientX - state.startX
        if (!state.isDragging && Math.abs(deltaX) < DRAG_THRESHOLD) return
        state.isDragging = true

        const endTime = snapTime(
          state.startTime + deltaX / pixelsPerSecond,
          state.trimStart,
          state.trimEnd
        )

        const [s, en] =
          state.startTime < endTime
            ? [state.startTime, endTime]
            : [endTime, state.startTime]

        setPendingSelection({ songId: state.songId, startTime: s, endTime: en })
      }

      const handleUp = (ev: PointerEvent): void => {
        const state = regionDragRef.current
        div.releasePointerCapture(ev.pointerId)
        div.removeEventListener('pointermove', handleMove)
        div.removeEventListener('pointerup', handleUp)
        document.body.style.userSelect = prevUserSelect

        if (state?.isDragging) {
          const endTime = snapTime(
            state.startTime + (ev.clientX - state.startX) / pixelsPerSecond,
            state.trimStart,
            state.trimEnd
          )

          const [s, en] =
            state.startTime < endTime
              ? [state.startTime, endTime]
              : [endTime, state.startTime]

          // Enforce minimum selection width
          if (en - s >= MIN_REGION_SECONDS) {
            setActiveSelection({
              songId: state.songId,
              startTime: s,
              endTime: en,
            })
            didRegionSelectRef.current = true
          }
        }

        setPendingSelection(null)
        regionDragRef.current = null
      }

      div.addEventListener('pointermove', handleMove)
      div.addEventListener('pointerup', handleUp)
    },
    [pixelsPerSecond, snapMode, containerRef, setActiveSelection]
  )

  return {
    pendingSelection,
    didRegionSelect: didRegionSelectRef,
    handleRegionPointerDown,
  }
}
