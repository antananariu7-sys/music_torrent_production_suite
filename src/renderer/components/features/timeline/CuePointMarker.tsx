import { Box, Text } from '@chakra-ui/react'
import type { CuePoint } from '@shared/types/waveform.types'

interface CuePointMarkerProps {
  cuePoint: CuePoint
  x: number
  trackHeight: number
  onClick: (cuePoint: CuePoint) => void
}

const CUE_COLORS: Record<CuePoint['type'], string> = {
  'marker': '#3b82f6',
  'trim-start': '#22c55e',
  'trim-end': '#ef4444',
}

export function CuePointMarker({
  cuePoint,
  x,
  trackHeight,
  onClick,
}: CuePointMarkerProps): JSX.Element {
  const color = CUE_COLORS[cuePoint.type]

  return (
    <Box
      position="absolute"
      left={`${x}px`}
      top={0}
      h={`${trackHeight}px`}
      zIndex={2}
      cursor="pointer"
      onClick={(e) => {
        e.stopPropagation()
        onClick(cuePoint)
      }}
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
}
