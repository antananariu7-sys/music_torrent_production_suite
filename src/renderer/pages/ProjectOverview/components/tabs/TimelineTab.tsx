import { useEffect, useMemo } from 'react'
import { HStack, VStack, Text, Box } from '@chakra-ui/react'
import { useProjectStore } from '@/store/useProjectStore'
import { useTimelineStore } from '@/store/timelineStore'
import { useAudioPlayerStore } from '@/store/audioPlayerStore'
import { useWaveformData } from '@/hooks/useWaveformData'
import { useBpmData } from '@/hooks/useBpmData'
import {
  TimelineLayout,
  computeTrackPositions,
  PX_PER_SEC,
  TRACK_COLORS,
} from '@/components/features/timeline/TimelineLayout'
import { TrackDetailPanel } from '@/components/features/timeline/TrackDetailPanel'
import { ZoomControls } from '@/components/features/timeline/ZoomControls'
import { Minimap } from '@/components/features/timeline/Minimap'
import { calculateTotalDuration } from '../../utils'

export function TimelineTab(): JSX.Element {
  const currentProject = useProjectStore((state) => state.currentProject)
  const waveformCache = useTimelineStore((s) => s.waveformCache)
  const isLoading = useTimelineStore((s) => s.isLoadingWaveforms)
  const loadingProgress = useTimelineStore((s) => s.loadingProgress)
  const selectedTrackId = useTimelineStore((s) => s.selectedTrackId)
  const zoomLevel = useTimelineStore((s) => s.zoomLevel)

  // Trigger batch waveform loading and BPM detection
  useWaveformData(currentProject?.id)
  useBpmData(currentProject?.id)

  const projectSongs = currentProject?.songs
  const songs = useMemo(
    () =>
      projectSongs ? [...projectSongs].sort((a, b) => a.order - b.order) : [],
    [projectSongs]
  )
  const totalDuration = useMemo(() => calculateTotalDuration(songs), [songs])
  const defaultCrossfade =
    currentProject?.mixMetadata?.exportConfig?.defaultCrossfadeDuration ?? 5

  // Compute positions for Minimap (shared with TimelineLayout)
  const pixelsPerSecond = PX_PER_SEC * zoomLevel
  const positions = useMemo(
    () => computeTrackPositions(songs, pixelsPerSecond, defaultCrossfade),
    [songs, pixelsPerSecond, defaultCrossfade]
  )
  const totalWidth = useMemo(
    () =>
      positions.length > 0
        ? Math.max(...positions.map((p) => p.left + p.width))
        : 0,
    [positions]
  )

  // Space bar to toggle play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === 'Space' &&
        !(
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        )
      ) {
        e.preventDefault()
        useAudioPlayerStore.getState().togglePlayPause()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (!currentProject) {
    return <></>
  }

  const selectedSong = selectedTrackId
    ? songs.find((s) => s.id === selectedTrackId)
    : undefined

  return (
    <VStack align="stretch" gap={4}>
      {/* Header */}
      <HStack justify="space-between" align="center">
        <HStack gap={6}>
          <Text fontSize="lg" fontWeight="semibold" color="text.primary">
            Timeline
          </Text>
          <Text fontSize="sm" color="text.muted">
            {songs.length} {songs.length === 1 ? 'track' : 'tracks'}
          </Text>
        </HStack>
      </HStack>

      {/* Loading progress */}
      {isLoading && loadingProgress && (
        <Box>
          <Text fontSize="xs" color="text.muted" mb={1}>
            Generating waveforms... {loadingProgress.current}/
            {loadingProgress.total}
          </Text>
          <Box h="4px" bg="bg.surface" borderRadius="full" overflow="hidden">
            <Box
              h="100%"
              w={`${(loadingProgress.current / loadingProgress.total) * 100}%`}
              bg="blue.500"
              borderRadius="full"
              transition="width 0.3s ease"
            />
          </Box>
        </Box>
      )}

      {/* Empty state */}
      {songs.length === 0 && (
        <Box
          bg="bg.card"
          borderWidth="1px"
          borderColor="border.base"
          borderRadius="md"
          p={8}
          textAlign="center"
        >
          <Text color="text.muted">
            No tracks in mix. Add tracks in the Mix tab to see the timeline.
          </Text>
        </Box>
      )}

      {/* Zoom controls + Minimap + Timeline */}
      {songs.length > 0 && (
        <>
          <ZoomControls totalDuration={totalDuration} />

          <Minimap
            waveforms={waveformCache}
            positions={positions}
            totalWidth={totalWidth}
            trackColors={TRACK_COLORS}
          />

          <TimelineLayout
            songs={songs}
            waveforms={waveformCache}
            defaultCrossfade={defaultCrossfade}
          />
        </>
      )}

      {/* Selected track detail panel */}
      {selectedSong && <TrackDetailPanel song={selectedSong} />}
    </VStack>
  )
}
