import { Box, Text, VStack } from '@chakra-ui/react'
import { useTimelineStore } from '@/store/timelineStore'
import { WaveformCanvas } from './WaveformCanvas'
import { TrackInfoOverlay } from './TrackInfoOverlay'
import type { Song } from '@shared/types/project.types'
import type { WaveformData } from '@shared/types/waveform.types'

interface TimelineLayoutProps {
  songs: Song[]
  waveforms: Record<string, WaveformData>
  defaultCrossfade?: number
}

/** Base pixels per second at zoom 1× */
const PX_PER_SEC = 10

/** Track height in pixels */
const TRACK_HEIGHT = 80

/** Alternating track colors for visual distinction */
const TRACK_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4']

interface TrackPosition {
  songId: string
  left: number
  width: number
}

function computeTrackPositions(
  songs: Song[],
  pixelsPerSecond: number,
  defaultCrossfade: number
): TrackPosition[] {
  let currentOffset = 0
  return songs.map((song, i) => {
    const effectiveDuration = (song.trimEnd ?? song.duration ?? 0) - (song.trimStart ?? 0)
    const width = effectiveDuration * pixelsPerSecond
    const position: TrackPosition = { songId: song.id, left: currentOffset, width }
    const crossfade = i < songs.length - 1
      ? (song.crossfadeDuration ?? defaultCrossfade)
      : 0
    currentOffset += (effectiveDuration - crossfade) * pixelsPerSecond
    return position
  })
}

export function TimelineLayout({
  songs,
  waveforms,
  defaultCrossfade = 5,
}: TimelineLayoutProps): JSX.Element {
  const zoomLevel = useTimelineStore((s) => s.zoomLevel)
  const selectedTrackId = useTimelineStore((s) => s.selectedTrackId)
  const setSelectedTrack = useTimelineStore((s) => s.setSelectedTrack)

  const pixelsPerSecond = PX_PER_SEC * zoomLevel
  const positions = computeTrackPositions(songs, pixelsPerSecond, defaultCrossfade)
  const totalWidth = positions.length > 0
    ? Math.max(...positions.map((p) => p.left + p.width))
    : 0

  return (
    <Box
      overflowX="auto"
      bg="bg.surface"
      borderWidth="1px"
      borderColor="border.base"
      borderRadius="md"
      p={3}
    >
      <Box position="relative" h={`${TRACK_HEIGHT + 24}px`} minW={`${totalWidth}px`}>
        {songs.map((song, index) => {
          const pos = positions[index]
          const waveform = waveforms[song.id]
          const color = TRACK_COLORS[index % TRACK_COLORS.length]
          const isSelected = selectedTrackId === song.id

          return (
            <Box
              key={song.id}
              position="absolute"
              left={`${pos.left}px`}
              top={0}
              w={`${pos.width}px`}
              onClick={() => setSelectedTrack(song.id)}
            >
              {/* Track label */}
              <Text
                fontSize="2xs"
                color="text.muted"
                mb={0.5}
                isTruncated
                maxW={`${pos.width}px`}
                title={song.title}
              >
                {song.title}
              </Text>

              {/* Waveform or placeholder */}
              <Box position="relative">
                <TrackInfoOverlay song={song} />
                {waveform ? (
                  <WaveformCanvas
                    peaks={waveform.peaks}
                    width={pos.width}
                    height={TRACK_HEIGHT}
                    color={color}
                    isSelected={isSelected}
                  />
                ) : (
                  <WaveformPlaceholder width={pos.width} height={TRACK_HEIGHT} />
                )}
              </Box>
            </Box>
          )
        })}

        {/* Crossfade overlap zones */}
        {songs.length > 1 && songs.map((song, index) => {
          if (index >= songs.length - 1) return null
          const thisPos = positions[index]
          const nextPos = positions[index + 1]
          const overlapStart = nextPos.left
          const overlapEnd = thisPos.left + thisPos.width
          const overlapWidth = overlapEnd - overlapStart
          if (overlapWidth <= 0) return null

          return (
            <Box
              key={`xfade-${song.id}`}
              position="absolute"
              left={`${overlapStart}px`}
              top="14px"
              w={`${overlapWidth}px`}
              h={`${TRACK_HEIGHT}px`}
              bg="whiteAlpha.100"
              borderRadius="sm"
              pointerEvents="none"
            />
          )
        })}
      </Box>
    </Box>
  )
}

function WaveformPlaceholder({ width, height }: { width: number; height: number }): JSX.Element {
  return (
    <Box
      w={`${width}px`}
      h={`${height}px`}
      bg="bg.elevated"
      borderRadius="sm"
      borderWidth="1px"
      borderColor="border.base"
    >
      <VStack h="100%" justify="center">
        <Text fontSize="xs" color="text.muted">Loading...</Text>
      </VStack>
    </Box>
  )
}
