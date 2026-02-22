import { memo, useRef, useCallback } from 'react'
import { Box, Text } from '@chakra-ui/react'
import { useDragInteraction } from './hooks/useDragInteraction'
import { snapToNearestBeat } from './utils/snapToBeat'
import type { CuePoint } from '@shared/types/waveform.types'

interface CuePointMarkerProps {
  cuePoint: CuePoint
  x: number
  trackHeight: number
  pixelsPerSecond: number
  onClick: (cuePoint: CuePoint) => void
  onDrag: (cuePoint: CuePoint, newTimestamp: number) => void
  onDragEnd: (cuePoint: CuePoint, newTimestamp: number) => void
  snapMode: 'off' | 'beat'
  bpm?: number
  firstBeatOffset?: number
  minTimestamp: number
  maxTimestamp: number
}

const CUE_COLORS: Record<CuePoint['type'], string> = {
  marker: '#3b82f6',
  'trim-start': '#22c55e',
  'trim-end': '#ef4444',
}

export const CuePointMarker = memo(
  function CuePointMarker({
    cuePoint,
    x,
    trackHeight,
    pixelsPerSecond,
    onClick,
    onDrag,
    onDragEnd,
    snapMode,
    bpm,
    firstBeatOffset,
    minTimestamp,
    maxTimestamp,
  }: CuePointMarkerProps): JSX.Element {
    const color = CUE_COLORS[cuePoint.type]
    const didDragRef = useRef(false)
    const initialTimestampRef = useRef(cuePoint.timestamp)
    const lastTimestampRef = useRef(cuePoint.timestamp)

    const canSnap =
      snapMode === 'beat' && bpm != null && bpm > 0 && firstBeatOffset != null

    const computeTimestamp = useCallback(
      (deltaX: number): number => {
        let ts = initialTimestampRef.current + deltaX / pixelsPerSecond
        ts = Math.max(minTimestamp, Math.min(maxTimestamp, ts))
        if (canSnap) {
          ts = snapToNearestBeat(ts, bpm!, firstBeatOffset!)
          ts = Math.max(minTimestamp, Math.min(maxTimestamp, ts))
        }
        return ts
      },
      [
        pixelsPerSecond,
        minTimestamp,
        maxTimestamp,
        canSnap,
        bpm,
        firstBeatOffset,
      ]
    )

    const { onPointerDown } = useDragInteraction({
      onDragStart: () => {
        didDragRef.current = true
        initialTimestampRef.current = cuePoint.timestamp
      },
      onDragMove: (deltaX) => {
        const ts = computeTimestamp(deltaX)
        lastTimestampRef.current = ts
        onDrag(cuePoint, ts)
      },
      onDragEnd: (deltaX) => {
        const ts = computeTimestamp(deltaX)
        onDragEnd(cuePoint, ts)
      },
      threshold: 3,
    })

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation()
        // Only fire click if not a drag gesture
        if (!didDragRef.current) {
          onClick(cuePoint)
        }
        didDragRef.current = false
      },
      [onClick, cuePoint]
    )

    return (
      <Box
        data-cue-marker
        position="absolute"
        left={`${x}px`}
        top={0}
        h={`${trackHeight}px`}
        zIndex={2}
        cursor="grab"
        onClick={handleClick}
        onPointerDown={onPointerDown}
      >
        {/* Vertical line */}
        <Box
          position="absolute"
          left="-1px"
          top={0}
          w="2px"
          h="100%"
          bg={color}
          opacity={0.8}
        />

        {/* Hit area for easier grabbing */}
        <Box
          position="absolute"
          left="-5px"
          top={0}
          w="10px"
          h="100%"
          opacity={0}
        />

        {/* Flag label */}
        <Box
          position="absolute"
          left="-1px"
          top="-16px"
          bg={color}
          px={1}
          borderRadius="sm"
          whiteSpace="nowrap"
        >
          <Text fontSize="2xs" color="white" lineHeight="14px">
            {cuePoint.label}
          </Text>
        </Box>
      </Box>
    )
  },
  (prev, next) =>
    prev.cuePoint.id === next.cuePoint.id &&
    prev.cuePoint.timestamp === next.cuePoint.timestamp &&
    prev.x === next.x &&
    prev.trackHeight === next.trackHeight &&
    prev.snapMode === next.snapMode &&
    prev.minTimestamp === next.minTimestamp &&
    prev.maxTimestamp === next.maxTimestamp
)
