import { memo, useRef } from 'react'
import { Box, HStack, IconButton } from '@chakra-ui/react'
import { FiScissors, FiPlay, FiX } from 'react-icons/fi'
import { useDragInteraction } from './hooks/useDragInteraction'

interface RegionSelectionProps {
  startTime: number
  endTime: number
  pixelsPerSecond: number
  trackHeight: number
  trimStart: number
  /** Show toolbar + edge handles (false during live drag preview) */
  showToolbar?: boolean
  onTrimToSelection: () => void
  onPlaySelection: () => void
  onClear: () => void
  onEdgeDrag?: (side: 'start' | 'end', deltaSeconds: number) => void
  onEdgeDragStart?: (side: 'start' | 'end') => void
  onEdgeDragEnd?: () => void
}

export const RegionSelection = memo(function RegionSelection({
  startTime,
  endTime,
  pixelsPerSecond,
  trackHeight,
  trimStart,
  showToolbar = true,
  onTrimToSelection,
  onPlaySelection,
  onClear,
  onEdgeDrag,
  onEdgeDragStart,
  onEdgeDragEnd,
}: RegionSelectionProps): JSX.Element {
  const leftPx = (startTime - trimStart) * pixelsPerSecond
  const widthPx = (endTime - startTime) * pixelsPerSecond

  // --- Start edge handle ---
  const startInitialRef = useRef(startTime)
  const { onPointerDown: onStartPointerDown } = useDragInteraction({
    onDragStart: () => {
      startInitialRef.current = startTime
      onEdgeDragStart?.('start')
    },
    onDragMove: (deltaX) => {
      onEdgeDrag?.('start', deltaX / pixelsPerSecond)
    },
    onDragEnd: () => {
      onEdgeDragEnd?.()
    },
    threshold: 3,
  })

  // --- End edge handle ---
  const endInitialRef = useRef(endTime)
  const { onPointerDown: onEndPointerDown } = useDragInteraction({
    onDragStart: () => {
      endInitialRef.current = endTime
      onEdgeDragStart?.('end')
    },
    onDragMove: (deltaX) => {
      onEdgeDrag?.('end', deltaX / pixelsPerSecond)
    },
    onDragEnd: () => {
      onEdgeDragEnd?.()
    },
    threshold: 3,
  })

  return (
    <>
      {/* Blue highlight overlay */}
      <Box
        position="absolute"
        left={`${leftPx}px`}
        top={0}
        w={`${widthPx}px`}
        h={`${trackHeight}px`}
        bg="blue.500/20"
        borderWidth="1px"
        borderColor="blue.400"
        pointerEvents="none"
        zIndex={2}
      />

      {/* Edge drag handles (only when finalized) */}
      {showToolbar && (
        <>
          {/* Start edge handle */}
          <Box
            data-drag-handle
            position="absolute"
            left={`${leftPx - 4}px`}
            top={0}
            w="8px"
            h={`${trackHeight}px`}
            cursor="col-resize"
            zIndex={4}
            onPointerDown={(e) => {
              e.stopPropagation()
              onStartPointerDown(e)
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Box
              w="100%"
              h="100%"
              bg="blue.400"
              opacity={0.6}
              borderRadius="sm"
            />
          </Box>

          {/* End edge handle */}
          <Box
            data-drag-handle
            position="absolute"
            left={`${leftPx + widthPx - 4}px`}
            top={0}
            w="8px"
            h={`${trackHeight}px`}
            cursor="col-resize"
            zIndex={4}
            onPointerDown={(e) => {
              e.stopPropagation()
              onEndPointerDown(e)
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Box
              w="100%"
              h="100%"
              bg="blue.400"
              opacity={0.6}
              borderRadius="sm"
            />
          </Box>
        </>
      )}

      {/* Floating toolbar above the selection */}
      {showToolbar && (
        <Box
          position="absolute"
          left={`${leftPx + widthPx / 2}px`}
          top="-36px"
          transform="translateX(-50%)"
          zIndex={3}
          pointerEvents="auto"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <HStack
            gap={1}
            bg="bg.card"
            borderWidth="1px"
            borderColor="border.base"
            borderRadius="md"
            shadow="md"
            p={1}
          >
            <IconButton
              aria-label="Trim to selection"
              title="Trim to selection"
              size="2xs"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation()
                onTrimToSelection()
              }}
            >
              <FiScissors />
            </IconButton>
            <IconButton
              aria-label="Play selection"
              title="Play selection"
              size="2xs"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation()
                onPlaySelection()
              }}
            >
              <FiPlay />
            </IconButton>
            <IconButton
              aria-label="Clear selection"
              title="Clear selection"
              size="2xs"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation()
                onClear()
              }}
            >
              <FiX />
            </IconButton>
          </HStack>
        </Box>
      )}
    </>
  )
})
