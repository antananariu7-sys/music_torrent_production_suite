import { memo, useRef, useCallback } from 'react'
import { Box } from '@chakra-ui/react'
import { TrimHandle } from './TrimHandle'
import { snapToNearestBeat } from './utils/snapToBeat'

interface TrimOverlayProps {
  trimStart?: number
  trimEnd?: number
  /** Absolute time (seconds) corresponding to x=0 of the visible track */
  trackStartTime: number
  trackWidth: number
  trackHeight: number
  pixelsPerSecond: number
  songDuration: number
  onTrimStartDrag: (newTimestamp: number) => void
  onTrimEndDrag: (newTimestamp: number) => void
  onTrimDragEnd: () => void
  snapMode: 'off' | 'beat'
  bpm?: number
  firstBeatOffset?: number
}

/** Minimum gap in seconds between trimStart and trimEnd */
const MIN_TRIM_GAP = 1

/**
 * Semi-transparent overlay dimming waveform regions outside trim boundaries,
 * plus draggable handles at each trim edge.
 */
export const TrimOverlay = memo(function TrimOverlay({
  trimStart,
  trimEnd,
  trackStartTime,
  trackWidth,
  trackHeight,
  pixelsPerSecond,
  songDuration,
  onTrimStartDrag,
  onTrimEndDrag,
  onTrimDragEnd,
  snapMode,
  bpm,
  firstBeatOffset,
}: TrimOverlayProps): JSX.Element {
  // Capture initial value at drag start so delta-based computation works
  const initialStartRef = useRef(trimStart ?? 0)
  const initialEndRef = useRef(trimEnd ?? songDuration)

  // Pixel positions are relative to the visible track (offset by trackStartTime)
  const trimStartPx =
    trimStart != null ? (trimStart - trackStartTime) * pixelsPerSecond : 0
  const trimEndPx =
    trimEnd != null ? (trimEnd - trackStartTime) * pixelsPerSecond : trackWidth

  const canSnap =
    snapMode === 'beat' && bpm != null && bpm > 0 && firstBeatOffset != null

  // -- Drag start callbacks: capture current value --
  const handleStartDragStart = useCallback(() => {
    initialStartRef.current = trimStart ?? 0
  }, [trimStart])

  const handleEndDragStart = useCallback(() => {
    initialEndRef.current = trimEnd ?? songDuration
  }, [trimEnd, songDuration])

  // -- Drag move: compute clamped + snapped timestamp --
  const handleStartDrag = useCallback(
    (deltaSeconds: number) => {
      const effectiveEnd = trimEnd ?? songDuration
      let ts = initialStartRef.current + deltaSeconds
      ts = Math.max(0, Math.min(effectiveEnd - MIN_TRIM_GAP, ts))
      if (canSnap) {
        ts = snapToNearestBeat(ts, bpm!, firstBeatOffset!)
        ts = Math.max(0, Math.min(effectiveEnd - MIN_TRIM_GAP, ts))
      }
      onTrimStartDrag(ts)
    },
    [trimEnd, songDuration, canSnap, bpm, firstBeatOffset, onTrimStartDrag]
  )

  const handleEndDrag = useCallback(
    (deltaSeconds: number) => {
      const effectiveStart = trimStart ?? 0
      let ts = initialEndRef.current + deltaSeconds
      ts = Math.min(songDuration, Math.max(effectiveStart + MIN_TRIM_GAP, ts))
      if (canSnap) {
        ts = snapToNearestBeat(ts, bpm!, firstBeatOffset!)
        ts = Math.min(songDuration, Math.max(effectiveStart + MIN_TRIM_GAP, ts))
      }
      onTrimEndDrag(ts)
    },
    [trimStart, songDuration, canSnap, bpm, firstBeatOffset, onTrimEndDrag]
  )

  return (
    <>
      {/* Dim overlay: before trim start (visible when dragging start handle inward) */}
      {trimStartPx > 0 && (
        <Box
          position="absolute"
          left={0}
          top={0}
          w={`${trimStartPx}px`}
          h={`${trackHeight}px`}
          bg="blackAlpha.400"
          borderRadius="sm"
          pointerEvents="none"
          zIndex={1}
        />
      )}

      {/* Dim overlay: after trim end (visible when dragging end handle inward) */}
      {trimEndPx < trackWidth && (
        <Box
          position="absolute"
          left={`${trimEndPx}px`}
          top={0}
          w={`${Math.max(0, trackWidth - trimEndPx)}px`}
          h={`${trackHeight}px`}
          bg="blackAlpha.400"
          borderRadius="sm"
          pointerEvents="none"
          zIndex={1}
        />
      )}

      {/* Trim start handle */}
      <TrimHandle
        side="start"
        x={trimStartPx}
        trackHeight={trackHeight}
        pixelsPerSecond={pixelsPerSecond}
        onDragStart={handleStartDragStart}
        onDrag={handleStartDrag}
        onDragEnd={onTrimDragEnd}
      />

      {/* Trim end handle */}
      <TrimHandle
        side="end"
        x={trimEndPx > 0 ? trimEndPx : trackWidth}
        trackHeight={trackHeight}
        pixelsPerSecond={pixelsPerSecond}
        onDragStart={handleEndDragStart}
        onDrag={handleEndDrag}
        onDragEnd={onTrimDragEnd}
      />
    </>
  )
})
