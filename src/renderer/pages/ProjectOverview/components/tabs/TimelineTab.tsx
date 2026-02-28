import { useEffect, useMemo } from 'react'
import {
  HStack,
  VStack,
  Text,
  Box,
  IconButton,
  Spinner,
} from '@chakra-ui/react'
import { FiRefreshCw, FiPlay, FiSquare } from 'react-icons/fi'
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
import { useFullMixPlayback } from '@/hooks/useFullMixPlayback'
import { calculateTotalDuration } from '../../utils'

export function TimelineTab(): JSX.Element {
  const currentProject = useProjectStore((state) => state.currentProject)
  const waveformCache = useTimelineStore((s) => s.waveformCache)
  const isLoading = useTimelineStore((s) => s.isLoadingWaveforms)
  const loadingProgress = useTimelineStore((s) => s.loadingProgress)
  const selectedTrackId = useTimelineStore((s) => s.selectedTrackId)
  const zoomLevel = useTimelineStore((s) => s.zoomLevel)

  // Trigger batch waveform loading and BPM detection
  const { rebuild: rebuildWaveforms } = useWaveformData(currentProject?.id)
  useBpmData(currentProject?.id)

  const projectSongs = currentProject?.songs
  const songs = useMemo(
    () =>
      projectSongs ? [...projectSongs].sort((a, b) => a.order - b.order) : [],
    [projectSongs]
  )
  const mixPlayback = useFullMixPlayback(songs)
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
        <HStack gap={2}>
          {songs.length > 0 && (
            <>
              <IconButton
                aria-label={
                  mixPlayback.isPlaying ? 'Stop mix playback' : 'Play full mix'
                }
                size="xs"
                variant={mixPlayback.isPlaying ? 'solid' : 'outline'}
                colorPalette="orange"
                disabled={mixPlayback.isLoading}
                onClick={() =>
                  mixPlayback.isPlaying
                    ? mixPlayback.stop()
                    : mixPlayback.play()
                }
                title={
                  mixPlayback.isPlaying
                    ? 'Stop mix playback'
                    : 'Play full mix preview'
                }
              >
                {mixPlayback.isLoading ? (
                  <Spinner size="xs" />
                ) : mixPlayback.isPlaying ? (
                  <FiSquare />
                ) : (
                  <FiPlay />
                )}
              </IconButton>
              <IconButton
                aria-label="Rebuild waveforms"
                size="xs"
                variant="ghost"
                disabled={isLoading}
                onClick={rebuildWaveforms}
              >
                <FiRefreshCw />
              </IconButton>
            </>
          )}
        </HStack>
      </HStack>

      {/* Full-page loading overlay */}
      {isLoading && loadingProgress && (
        <Box
          position="fixed"
          inset="0"
          display="flex"
          alignItems="center"
          justifyContent="center"
          bg="blackAlpha.600"
          zIndex="overlay"
        >
          <VStack
            bg="bg.elevated"
            borderRadius="lg"
            p={8}
            gap={4}
            minW="320px"
            boxShadow="lg"
          >
            <Spinner size="lg" color="blue.500" />
            <Text fontSize="md" fontWeight="medium" color="text.primary">
              Generating waveforms...
            </Text>
            <Text fontSize="sm" color="text.muted">
              {loadingProgress.current} / {loadingProgress.total} tracks
            </Text>
            <Box
              w="100%"
              h="6px"
              bg="bg.surface"
              borderRadius="full"
              overflow="hidden"
            >
              <Box
                h="100%"
                w={`${(loadingProgress.current / loadingProgress.total) * 100}%`}
                bg="blue.500"
                borderRadius="full"
                transition="width 0.3s ease"
              />
            </Box>
          </VStack>
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
            songs={songs}
            pixelsPerSecond={pixelsPerSecond}
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
