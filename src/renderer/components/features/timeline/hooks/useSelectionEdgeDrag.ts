import { useRef, useCallback } from 'react'
import { useTimelineStore } from '@/store/timelineStore'
import { snapToNearestBeat } from '../utils/snapToBeat'
import type { Song } from '@shared/types/project.types'

export function useSelectionEdgeDrag() {
  const snapMode = useTimelineStore((s) => s.snapMode)
  const setActiveSelection = useTimelineStore((s) => s.setActiveSelection)

  const selEdgeRef = useRef<{
    side: 'start' | 'end'
    initialStart: number
    initialEnd: number
    trimStart: number
    trimEnd: number
    songBpm?: number
    songFirstBeatOffset?: number
  } | null>(null)

  const handleSelectionEdgeDragStart = useCallback(
    (song: Song, side: 'start' | 'end') => {
      const sel = useTimelineStore.getState().activeSelection
      if (!sel) return
      selEdgeRef.current = {
        side,
        initialStart: sel.startTime,
        initialEnd: sel.endTime,
        trimStart: song.trimStart ?? 0,
        trimEnd: song.trimEnd ?? song.duration ?? 0,
        songBpm: song.bpm,
        songFirstBeatOffset: song.firstBeatOffset,
      }
    },
    []
  )

  const handleSelectionEdgeDrag = useCallback(
    (songId: string, side: 'start' | 'end', deltaSeconds: number) => {
      const ref = selEdgeRef.current
      if (!ref) return

      const canSnap =
        snapMode === 'beat' &&
        ref.songBpm != null &&
        ref.songBpm > 0 &&
        ref.songFirstBeatOffset != null

      if (side === 'start') {
        let newStart = ref.initialStart + deltaSeconds
        newStart = Math.max(
          ref.trimStart,
          Math.min(ref.initialEnd - 0.5, newStart)
        )
        if (canSnap) {
          newStart = snapToNearestBeat(
            newStart,
            ref.songBpm!,
            ref.songFirstBeatOffset!
          )
          newStart = Math.max(
            ref.trimStart,
            Math.min(ref.initialEnd - 0.5, newStart)
          )
        }
        setActiveSelection({
          songId,
          startTime: newStart,
          endTime: ref.initialEnd,
        })
      } else {
        let newEnd = ref.initialEnd + deltaSeconds
        newEnd = Math.min(ref.trimEnd, Math.max(ref.initialStart + 0.5, newEnd))
        if (canSnap) {
          newEnd = snapToNearestBeat(
            newEnd,
            ref.songBpm!,
            ref.songFirstBeatOffset!
          )
          newEnd = Math.min(
            ref.trimEnd,
            Math.max(ref.initialStart + 0.5, newEnd)
          )
        }
        setActiveSelection({
          songId,
          startTime: ref.initialStart,
          endTime: newEnd,
        })
      }
    },
    [snapMode, setActiveSelection]
  )

  const handleSelectionEdgeDragEnd = useCallback(() => {
    selEdgeRef.current = null
  }, [])

  return {
    handleSelectionEdgeDragStart,
    handleSelectionEdgeDrag,
    handleSelectionEdgeDragEnd,
  }
}
