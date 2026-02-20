import { Box, HStack, VStack, Text, IconButton } from '@chakra-ui/react'
import { FiTrash2 } from 'react-icons/fi'
import { useProjectStore } from '@/store/useProjectStore'
import type { Song } from '@shared/types/project.types'
import type { CuePoint } from '@shared/types/waveform.types'

interface TrackDetailPanelProps {
  song: Song
}

function formatDuration(seconds: number): string {
  const min = Math.floor(seconds / 60)
  const sec = Math.floor(seconds % 60)
  return `${min}:${sec.toString().padStart(2, '0')}`
}

function formatTimestamp(seconds: number): string {
  const min = Math.floor(seconds / 60)
  const sec = (seconds % 60).toFixed(1)
  return `${min}:${sec.padStart(4, '0')}`
}

const CUE_COLORS: Record<CuePoint['type'], string> = {
  'marker': '#3b82f6',
  'trim-start': '#22c55e',
  'trim-end': '#ef4444',
}

/**
 * Bottom panel showing metadata and cue points for the selected track.
 */
export function TrackDetailPanel({ song }: TrackDetailPanelProps): JSX.Element {
  const currentProject = useProjectStore((s) => s.currentProject)
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject)
  const cuePoints = [...(song.cuePoints ?? [])].sort((a, b) => a.timestamp - b.timestamp)

  async function handleDeleteCuePoint(cuePointId: string): Promise<void> {
    if (!currentProject) return

    const updatedCuePoints = (song.cuePoints ?? []).filter((cp) => cp.id !== cuePointId)
    const trimStart = updatedCuePoints.find((cp) => cp.type === 'trim-start')?.timestamp
    const trimEnd = updatedCuePoints.find((cp) => cp.type === 'trim-end')?.timestamp

    const response = await window.api.mix.updateSong({
      projectId: currentProject.id,
      songId: song.id,
      updates: {
        cuePoints: updatedCuePoints,
        trimStart,
        trimEnd,
      },
    })
    if (response.success && response.data) {
      setCurrentProject(response.data)
    }
  }

  return (
    <Box
      bg="bg.card"
      borderWidth="1px"
      borderColor="border.base"
      borderRadius="md"
      p={4}
    >
      <VStack align="stretch" gap={3}>
        <Text fontSize="sm" fontWeight="semibold" color="text.primary">
          {song.title}
        </Text>

        {/* Metadata row */}
        <HStack gap={6} flexWrap="wrap">
          {song.artist && (
            <DetailItem label="Artist" value={song.artist} />
          )}
          {song.duration != null && (
            <DetailItem label="Duration" value={formatDuration(song.duration)} />
          )}
          {song.format && (
            <DetailItem label="Format" value={song.format.toUpperCase()} />
          )}
          {song.bitrate != null && (
            <DetailItem label="Bitrate" value={`${song.bitrate} kbps`} />
          )}
          {song.bpm != null && song.bpm > 0 && (
            <DetailItem label="BPM" value={String(song.bpm)} />
          )}
          {song.sampleRate != null && (
            <DetailItem label="Sample Rate" value={`${song.sampleRate} Hz`} />
          )}
        </HStack>

        {/* Cue points list */}
        {cuePoints.length > 0 && (
          <VStack align="stretch" gap={1}>
            <Text fontSize="2xs" color="text.muted" textTransform="uppercase">
              Cue Points
            </Text>
            {cuePoints.map((cp) => (
              <HStack
                key={cp.id}
                gap={3}
                py={1}
                px={2}
                borderRadius="sm"
                _hover={{ bg: 'bg.elevated' }}
              >
                {/* Color dot */}
                <Box
                  w="8px"
                  h="8px"
                  borderRadius="full"
                  bg={CUE_COLORS[cp.type]}
                  flexShrink={0}
                />

                {/* Label */}
                <Text fontSize="xs" color="text.primary" flex={1}>
                  {cp.label}
                </Text>

                {/* Type badge */}
                <Text fontSize="2xs" color="text.muted" textTransform="uppercase">
                  {cp.type}
                </Text>

                {/* Timestamp */}
                <Text fontSize="xs" color="text.muted" fontFamily="monospace" w="50px" textAlign="right">
                  {formatTimestamp(cp.timestamp)}
                </Text>

                {/* Delete button */}
                <IconButton
                  aria-label="Delete cue point"
                  size="2xs"
                  variant="ghost"
                  colorPalette="red"
                  onClick={() => handleDeleteCuePoint(cp.id)}
                >
                  <FiTrash2 />
                </IconButton>
              </HStack>
            ))}
          </VStack>
        )}
      </VStack>
    </Box>
  )
}

function DetailItem({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <VStack gap={0} align="start">
      <Text fontSize="2xs" color="text.muted" textTransform="uppercase">
        {label}
      </Text>
      <Text fontSize="xs" color="text.primary">
        {value}
      </Text>
    </VStack>
  )
}
