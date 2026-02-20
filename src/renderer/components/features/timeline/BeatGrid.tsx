import { useMemo } from 'react'
import { Box } from '@chakra-ui/react'

interface BeatGridProps {
  bpm: number
  firstBeatOffset: number
  trackWidth: number
  trackHeight: number
  pixelsPerSecond: number
  trimStart: number
}

/**
 * Renders vertical beat grid lines overlaid on a track's waveform.
 * Downbeats (every 4th) are visually distinct. Skips rendering
 * when beat density is too high to avoid visual noise.
 */
export function BeatGrid({
  bpm,
  firstBeatOffset,
  trackWidth,
  trackHeight,
  pixelsPerSecond,
  trimStart,
}: BeatGridProps): JSX.Element | null {
  const beatInterval = 60 / bpm
  const beatWidthPx = beatInterval * pixelsPerSecond

  const beats = useMemo(() => {
    // Skip when beats are too dense (< 3px apart)
    if (beatWidthPx < 3) return []

    const result: { x: number; isDownbeat: boolean }[] = []
    const startTime = trimStart
    const endTime = startTime + trackWidth / pixelsPerSecond

    const firstBeatIndex = Math.ceil((startTime - firstBeatOffset) / beatInterval)

    for (let i = firstBeatIndex; ; i++) {
      const t = firstBeatOffset + i * beatInterval
      if (t > endTime) break
      const x = (t - startTime) * pixelsPerSecond
      if (x >= 0 && x <= trackWidth) {
        result.push({ x, isDownbeat: i % 4 === 0 })
      }
    }
    return result
  }, [bpm, firstBeatOffset, trackWidth, pixelsPerSecond, trimStart, beatInterval, beatWidthPx])

  if (beats.length === 0) return null

  return (
    <Box
      position="absolute"
      left={0}
      top={0}
      w={`${trackWidth}px`}
      h={`${trackHeight}px`}
      pointerEvents="none"
      zIndex={1}
    >
      {beats.map((beat, i) => (
        <Box
          key={i}
          position="absolute"
          left={`${beat.x}px`}
          top={0}
          w={beat.isDownbeat ? '2px' : '1px'}
          h="100%"
          bg={beat.isDownbeat ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.22)'}
        />
      ))}
    </Box>
  )
}
