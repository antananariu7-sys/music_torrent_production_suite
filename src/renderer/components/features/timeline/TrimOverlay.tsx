import { Box } from '@chakra-ui/react'

interface TrimOverlayProps {
  trimStart?: number
  trimEnd?: number
  trackWidth: number
  trackHeight: number
  pixelsPerSecond: number
  songDuration: number
}

/**
 * Semi-transparent overlay dimming waveform regions outside trim boundaries.
 */
export function TrimOverlay({
  trimStart,
  trimEnd,
  trackWidth,
  trackHeight,
  pixelsPerSecond,
  songDuration,
}: TrimOverlayProps): JSX.Element {
  const trimStartPx = trimStart != null ? trimStart * pixelsPerSecond : 0
  const trimEndPx = trimEnd != null ? trimEnd * pixelsPerSecond : trackWidth
  const totalPx = songDuration * pixelsPerSecond

  return (
    <>
      {/* Before trim start */}
      {trimStart != null && trimStartPx > 0 && (
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

      {/* After trim end */}
      {trimEnd != null && trimEndPx < totalPx && (
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
    </>
  )
}
