import { useRef, useState, useEffect } from 'react'
import { Box, Flex, Text, Badge, Skeleton } from '@chakra-ui/react'
import { WaveformCanvas } from '@/components/features/timeline/WaveformCanvas'
import { useTimelineStore } from '@/store/timelineStore'
import type { Song } from '@shared/types/project.types'
import type { WaveformData } from '@shared/types/waveform.types'

interface TransitionWaveformPanelProps {
  song: Song
  peaks: WaveformData | null
  isLoading: boolean
  color?: string
}

/**
 * Single waveform panel for the transition detail view.
 * Shows: track metadata header + full-track WaveformCanvas + cue point markers + trim dimming.
 */
export function TransitionWaveformPanel({
  song,
  peaks,
  isLoading,
  color = '#3b82f6',
}: TransitionWaveformPanelProps): JSX.Element {
  const frequencyColorMode = useTimelineStore((s) => s.frequencyColorMode)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  // Observe container width for responsive waveform rendering
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(Math.floor(entry.contentRect.width))
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const duration = peaks?.duration ?? song.duration ?? 0

  return (
    <Box
      bg="bg.card"
      borderWidth="1px"
      borderColor="border.base"
      borderRadius="md"
      overflow="hidden"
    >
      {/* Metadata header */}
      <Flex
        px={3}
        py={2}
        align="center"
        gap={2}
        borderBottomWidth="1px"
        borderColor="border.base"
      >
        <Text
          fontSize="sm"
          fontWeight="medium"
          color="text.primary"
          flex={1}
          lineClamp={1}
        >
          {song.artist ? `${song.artist} — ${song.title}` : song.title}
        </Text>

        {song.bpm && (
          <Badge
            fontSize="2xs"
            colorPalette="purple"
            variant="subtle"
            flexShrink={0}
          >
            {Math.round(song.bpm)} BPM
          </Badge>
        )}

        {/* Key placeholder — wired in Phase 4 */}
        <Badge
          fontSize="2xs"
          colorPalette="gray"
          variant="subtle"
          flexShrink={0}
        >
          —
        </Badge>

        {song.bitrate && (
          <Text fontSize="2xs" color="text.muted" flexShrink={0}>
            {song.bitrate}k
          </Text>
        )}

        {song.format && (
          <Badge
            fontSize="2xs"
            colorPalette="blue"
            variant="subtle"
            textTransform="uppercase"
            flexShrink={0}
          >
            {song.format}
          </Badge>
        )}
      </Flex>

      {/* Waveform area */}
      <Box ref={containerRef} position="relative" px={1} py={1}>
        {isLoading || !peaks ? (
          <Skeleton height="100px" borderRadius="sm" />
        ) : containerWidth > 0 ? (
          <Box position="relative">
            <WaveformCanvas
              songId={song.id}
              peaks={peaks.peaks}
              peaksLow={peaks.peaksLow}
              peaksMid={peaks.peaksMid}
              peaksHigh={peaks.peaksHigh}
              frequencyColorMode={frequencyColorMode}
              width={containerWidth - 8} // account for px={1} padding
              height={100}
              color={color}
              fullTrack
            />

            {/* Trim dimming overlays */}
            {duration > 0 && song.trimStart != null && song.trimStart > 0 && (
              <Box
                position="absolute"
                left={0}
                top={0}
                width={`${(song.trimStart / duration) * 100}%`}
                height="100%"
                bg="blackAlpha.500"
                pointerEvents="none"
              />
            )}
            {duration > 0 &&
              song.trimEnd != null &&
              song.trimEnd < duration && (
                <Box
                  position="absolute"
                  right={0}
                  top={0}
                  width={`${((duration - song.trimEnd) / duration) * 100}%`}
                  height="100%"
                  bg="blackAlpha.500"
                  pointerEvents="none"
                />
              )}

            {/* Cue point markers (read-only) */}
            {song.cuePoints?.map((cue) => {
              if (duration <= 0) return null
              const pct = (cue.timestamp / duration) * 100
              const markerColor =
                cue.type === 'trim-start'
                  ? '#22c55e'
                  : cue.type === 'trim-end'
                    ? '#ef4444'
                    : '#3b82f6'
              return (
                <Box
                  key={cue.id}
                  position="absolute"
                  left={`${pct}%`}
                  top={0}
                  h="100%"
                  zIndex={2}
                  title={`${cue.label} (${formatTimestamp(cue.timestamp)})`}
                  cursor="default"
                >
                  <Box
                    position="absolute"
                    left="-1px"
                    top={0}
                    w="2px"
                    h="100%"
                    bg={markerColor}
                    opacity={0.8}
                  />
                  <Box
                    position="absolute"
                    left="-1px"
                    top="-14px"
                    bg={markerColor}
                    px={1}
                    borderRadius="sm"
                    whiteSpace="nowrap"
                  >
                    <Text fontSize="2xs" color="white" lineHeight="12px">
                      {cue.label}
                    </Text>
                  </Box>
                </Box>
              )
            })}
          </Box>
        ) : (
          <Box h="100px" />
        )}
      </Box>
    </Box>
  )
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
