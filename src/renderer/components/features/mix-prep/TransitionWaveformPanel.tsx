import { useRef, useState, useEffect, useMemo, useCallback } from 'react'
import { Box, Flex, Text, Badge, Skeleton } from '@chakra-ui/react'
import { WaveformCanvas } from '@/components/features/timeline/WaveformCanvas'
import { TrimHandle } from '@/components/features/timeline/TrimHandle'
import { EnergyOverlay } from './EnergyOverlay'
import { SectionBands } from './SectionBands'
import { VolumeEnvelopeEditor } from './VolumeEnvelopeEditor'
import type { VolumePoint } from '@shared/types/project.types'
import { useTimelineStore } from '@/store/timelineStore'
import { computeEnergyProfile } from '@shared/utils/energyAnalyzer'
import type { Song } from '@shared/types/project.types'
import type { WaveformData } from '@shared/types/waveform.types'

/** Minimum gap in seconds between trimStart and trimEnd */
const MIN_TRIM_GAP = 1

interface TransitionWaveformPanelProps {
  song: Song
  peaks: WaveformData | null
  isLoading: boolean
  color?: string
  /** Current playhead position in seconds (drives moving playhead line) */
  playheadTime?: number
  /** Whether this deck is actively playing */
  isPlaybackActive?: boolean
  /** Which trim handle to show: 'end' for outgoing, 'start' for incoming */
  trimHandleSide?: 'start' | 'end'
  /** Called during drag with the new trim timestamp */
  onTrimDrag?: (newTimestamp: number) => void
  /** Called when drag ends to persist the value */
  onTrimDragEnd?: () => void
  /** Volume envelope breakpoints (when volume editor is active) */
  volumeEnvelope?: VolumePoint[]
  /** Called when the volume envelope changes */
  onVolumeEnvelopeChange?: (envelope: VolumePoint[]) => void
  /** Whether to show the interactive volume envelope editor */
  showVolumeEditor?: boolean
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
  playheadTime,
  isPlaybackActive,
  trimHandleSide,
  onTrimDrag,
  onTrimDragEnd,
  volumeEnvelope,
  onVolumeEnvelopeChange,
  showVolumeEditor,
}: TransitionWaveformPanelProps): JSX.Element {
  const frequencyColorMode = useTimelineStore((s) => s.frequencyColorMode)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const initialTrimRef = useRef(0)

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

  // Compute energy profile from peaks (memoized)
  const energyProfile = useMemo(() => {
    if (song.energyProfile && song.energyProfile.length > 0)
      return song.energyProfile
    if (!peaks?.peaks || peaks.peaks.length === 0) return []
    return computeEnergyProfile(peaks.peaks)
  }, [song.energyProfile, peaks?.peaks])

  // ── Trim handle drag logic ──────────────────────────────────────────────────
  const waveformWidth = containerWidth > 0 ? containerWidth - 8 : 0
  const pixelsPerSecond = duration > 0 ? waveformWidth / duration : 0

  const trimHandleX = useMemo(() => {
    if (!trimHandleSide || pixelsPerSecond <= 0) return 0
    if (trimHandleSide === 'end') {
      return (song.trimEnd ?? duration) * pixelsPerSecond
    }
    return (song.trimStart ?? 0) * pixelsPerSecond
  }, [trimHandleSide, song.trimStart, song.trimEnd, duration, pixelsPerSecond])

  const handleTrimDragStart = useCallback(() => {
    if (trimHandleSide === 'end') {
      initialTrimRef.current = song.trimEnd ?? duration
    } else {
      initialTrimRef.current = song.trimStart ?? 0
    }
  }, [trimHandleSide, song.trimEnd, song.trimStart, duration])

  const handleTrimDrag = useCallback(
    (deltaSeconds: number) => {
      if (!onTrimDrag) return
      let ts = initialTrimRef.current + deltaSeconds
      if (trimHandleSide === 'end') {
        const effectiveStart = song.trimStart ?? 0
        ts = Math.min(duration, Math.max(effectiveStart + MIN_TRIM_GAP, ts))
      } else {
        const effectiveEnd = song.trimEnd ?? duration
        ts = Math.max(0, Math.min(effectiveEnd - MIN_TRIM_GAP, ts))
      }
      onTrimDrag(ts)
    },
    [trimHandleSide, song.trimStart, song.trimEnd, duration, onTrimDrag]
  )

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

        {song.musicalKey && (
          <Badge
            fontSize="2xs"
            colorPalette="teal"
            variant="subtle"
            flexShrink={0}
            title={`Key: ${song.musicalKey}${song.musicalKeyConfidence != null ? ` (confidence: ${(song.musicalKeyConfidence * 100).toFixed(0)}%)` : ''}`}
          >
            {song.musicalKey}
          </Badge>
        )}

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

            {/* Section bands overlay (behind energy) */}
            {song.sections && song.sections.length > 0 && duration > 0 && (
              <SectionBands
                sections={song.sections}
                duration={duration}
                width={containerWidth - 8}
                height={100}
              />
            )}

            {/* Energy overlay */}
            {energyProfile.length > 0 && (
              <EnergyOverlay
                energyProfile={energyProfile}
                width={containerWidth - 8}
                height={100}
              />
            )}

            {/* Volume envelope editor overlay */}
            {showVolumeEditor &&
              volumeEnvelope &&
              onVolumeEnvelopeChange &&
              duration > 0 && (
                <VolumeEnvelopeEditor
                  envelope={volumeEnvelope}
                  duration={duration}
                  width={containerWidth - 8}
                  height={100}
                  onChange={onVolumeEnvelopeChange}
                  trimStart={song.trimStart}
                  trimEnd={song.trimEnd}
                />
              )}

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

            {/* Playhead line (during dual-deck playback) */}
            {isPlaybackActive &&
              playheadTime != null &&
              duration > 0 &&
              playheadTime <= duration && (
                <Box
                  position="absolute"
                  left={`${(playheadTime / duration) * 100}%`}
                  top={0}
                  h="100%"
                  zIndex={3}
                  pointerEvents="none"
                >
                  <Box
                    position="absolute"
                    left="-1px"
                    top={0}
                    w="2px"
                    h="100%"
                    bg={color}
                    opacity={0.9}
                    boxShadow={`0 0 4px ${color}`}
                  />
                </Box>
              )}

            {/* Inline draggable trim handle */}
            {trimHandleSide && pixelsPerSecond > 0 && onTrimDragEnd && (
              <>
                <TrimHandle
                  side={trimHandleSide}
                  x={trimHandleX}
                  trackHeight={100}
                  pixelsPerSecond={pixelsPerSecond}
                  onDragStart={handleTrimDragStart}
                  onDrag={handleTrimDrag}
                  onDragEnd={onTrimDragEnd}
                />
                {/* Label next to handle */}
                {trimHandleSide === 'end' ? (
                  <Text
                    position="absolute"
                    left={`${trimHandleX - 4}px`}
                    top="2px"
                    fontSize="2xs"
                    fontWeight="semibold"
                    color="#ef4444"
                    bg="blackAlpha.600"
                    px={1}
                    borderRadius="sm"
                    pointerEvents="none"
                    whiteSpace="nowrap"
                    zIndex={4}
                    transform="translateX(-100%)"
                  >
                    Exit ▶
                  </Text>
                ) : (
                  <Text
                    position="absolute"
                    left={`${trimHandleX + 4}px`}
                    top="2px"
                    fontSize="2xs"
                    fontWeight="semibold"
                    color="#22c55e"
                    bg="blackAlpha.600"
                    px={1}
                    borderRadius="sm"
                    pointerEvents="none"
                    whiteSpace="nowrap"
                    zIndex={4}
                  >
                    ◀ Entry
                  </Text>
                )}
              </>
            )}
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
