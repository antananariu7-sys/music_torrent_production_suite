import { HStack, VStack, Text, Box } from '@chakra-ui/react'
import { useProjectStore } from '@/store/useProjectStore'
import { useTimelineStore } from '@/store/timelineStore'
import { useWaveformData } from '@/hooks/useWaveformData'
import { TimelineLayout } from '@/components/features/timeline/TimelineLayout'
import { TrackDetailPanel } from '@/components/features/timeline/TrackDetailPanel'
import { formatDuration, calculateTotalDuration } from '../../utils'

export function TimelineTab(): JSX.Element {
  const currentProject = useProjectStore((state) => state.currentProject)
  const waveformCache = useTimelineStore((s) => s.waveformCache)
  const isLoading = useTimelineStore((s) => s.isLoadingWaveforms)
  const loadingProgress = useTimelineStore((s) => s.loadingProgress)
  const selectedTrackId = useTimelineStore((s) => s.selectedTrackId)

  // Trigger batch waveform loading
  useWaveformData(currentProject?.id)

  if (!currentProject) {
    return <></>
  }

  const songs = [...currentProject.songs].sort((a, b) => a.order - b.order)
  const totalDuration = calculateTotalDuration(songs)
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
          {totalDuration > 0 && (
            <Text fontSize="sm" color="text.muted">
              {formatDuration(totalDuration)}
            </Text>
          )}
        </HStack>
      </HStack>

      {/* Loading progress */}
      {isLoading && loadingProgress && (
        <Box>
          <Text fontSize="xs" color="text.muted" mb={1}>
            Generating waveforms... {loadingProgress.current}/{loadingProgress.total}
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

      {/* Timeline */}
      {songs.length > 0 && (
        <TimelineLayout
          songs={songs}
          waveforms={waveformCache}
          defaultCrossfade={currentProject.mixMetadata?.exportConfig?.defaultCrossfadeDuration ?? 5}
        />
      )}

      {/* Selected track detail panel */}
      {selectedSong && (
        <TrackDetailPanel song={selectedSong} />
      )}
    </VStack>
  )
}
