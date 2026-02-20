import { Box, HStack, VStack, Text } from '@chakra-ui/react'
import type { Song } from '@shared/types/project.types'

interface TrackDetailPanelProps {
  song: Song
}

function formatDuration(seconds: number): string {
  const min = Math.floor(seconds / 60)
  const sec = Math.floor(seconds % 60)
  return `${min}:${sec.toString().padStart(2, '0')}`
}

/**
 * Bottom panel showing metadata for the selected track.
 */
export function TrackDetailPanel({ song }: TrackDetailPanelProps): JSX.Element {
  return (
    <Box
      bg="bg.card"
      borderWidth="1px"
      borderColor="border.base"
      borderRadius="md"
      p={4}
    >
      <VStack align="stretch" gap={2}>
        <Text fontSize="sm" fontWeight="semibold" color="text.primary">
          {song.title}
        </Text>
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
