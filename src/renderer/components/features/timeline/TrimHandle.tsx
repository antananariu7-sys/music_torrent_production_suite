import { memo } from 'react'
import { Box } from '@chakra-ui/react'
import { useDragInteraction } from './hooks/useDragInteraction'

interface TrimHandleProps {
  side: 'start' | 'end'
  x: number
  trackHeight: number
  pixelsPerSecond: number
  onDragStart?: () => void
  onDrag: (deltaSeconds: number) => void
  onDragEnd: () => void
}

/**
 * Draggable grip handle at a trim boundary.
 * 8px-wide vertical bar with col-resize cursor and 3-line grip texture.
 */
export const TrimHandle = memo(function TrimHandle({
  side: _side,
  x,
  trackHeight,
  pixelsPerSecond,
  onDragStart,
  onDrag,
  onDragEnd,
}: TrimHandleProps): JSX.Element {
  const { onPointerDown } = useDragInteraction({
    onDragStart: () => onDragStart?.(),
    onDragMove: (deltaX) => onDrag(deltaX / pixelsPerSecond),
    onDragEnd: () => onDragEnd(),
    threshold: 3,
  })

  return (
    <Box
      position="absolute"
      left={`${x - 4}px`}
      top={0}
      w="8px"
      h={`${trackHeight}px`}
      cursor="col-resize"
      zIndex={3}
      onPointerDown={onPointerDown}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Background bar */}
      <Box
        w="100%"
        h="100%"
        bg="bg.elevated"
        opacity={0.85}
        borderWidth="1px"
        borderColor="border.base"
        borderRadius="sm"
      />
      {/* Grip texture: 3 horizontal lines */}
      <Box
        position="absolute"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
        display="flex"
        flexDirection="column"
        gap="2px"
      >
        {[0, 1, 2].map((i) => (
          <Box key={i} w="4px" h="1px" bg="text.muted" />
        ))}
      </Box>
    </Box>
  )
})
