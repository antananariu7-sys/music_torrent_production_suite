import { Flex, VStack, Text, Icon, Box } from '@chakra-ui/react'
import { FiMusic, FiArrowRight } from 'react-icons/fi'
import type { Song } from '@shared/types/project.types'

interface TransitionDetailProps {
  /** The outgoing track (track N-1), null if first track selected */
  outgoingTrack: Song | null
  /** The incoming track (track N) */
  incomingTrack: Song | null
  /** Total number of songs in the mix */
  songCount: number
}

/**
 * Right-panel container: renders stacked waveforms + comparison strip.
 * Phase 1: placeholder panels. Phase 2+ fills in waveforms.
 */
export function TransitionDetail({
  outgoingTrack,
  incomingTrack,
  songCount,
}: TransitionDetailProps): JSX.Element {
  // ── Empty state: no songs ──────────────────────────────────────────────────
  if (songCount === 0) {
    return (
      <Flex flex={1} align="center" justify="center" p={8}>
        <VStack gap={3}>
          <Icon as={FiMusic} boxSize={10} color="text.muted" />
          <Text color="text.muted" fontSize="md" textAlign="center">
            Add songs from Search or import files to build your mix
          </Text>
        </VStack>
      </Flex>
    )
  }

  // ── Single track state ─────────────────────────────────────────────────────
  if (songCount === 1) {
    return (
      <Flex flex={1} align="center" justify="center" p={8}>
        <VStack gap={3}>
          <Icon as={FiMusic} boxSize={8} color="text.muted" />
          <Text color="text.muted" fontSize="sm" textAlign="center">
            Add more tracks to see transitions
          </Text>
        </VStack>
      </Flex>
    )
  }

  // ── First track selected (no outgoing) ─────────────────────────────────────
  if (!outgoingTrack && incomingTrack) {
    return (
      <Flex flex={1} align="center" justify="center" p={8}>
        <VStack gap={3}>
          <Text color="text.muted" fontSize="sm" textAlign="center">
            First track in mix — select track 2+ to see transitions
          </Text>
          <WaveformPlaceholder label={incomingTrack.title} />
        </VStack>
      </Flex>
    )
  }

  // ── Normal transition view ─────────────────────────────────────────────────
  if (!outgoingTrack || !incomingTrack) return <></>

  return (
    <VStack flex={1} gap={0} align="stretch" p={4} overflowY="auto">
      {/* Outgoing waveform placeholder */}
      <WaveformPlaceholder
        label={outgoingTrack.title}
        subtitle={outgoingTrack.artist}
      />

      {/* Comparison strip placeholder */}
      <Flex
        align="center"
        justify="center"
        gap={2}
        py={3}
        px={4}
        bg="bg.surface"
        borderWidth="1px"
        borderColor="border.base"
        borderRadius="md"
        my={2}
      >
        <Text fontSize="xs" color="text.muted">
          {outgoingTrack.bpm ? `${Math.round(outgoingTrack.bpm)} BPM` : '? BPM'}
        </Text>
        <Icon as={FiArrowRight} boxSize={3} color="text.muted" />
        <Text fontSize="xs" color="text.muted">
          {incomingTrack.bpm ? `${Math.round(incomingTrack.bpm)} BPM` : '? BPM'}
        </Text>
      </Flex>

      {/* Incoming waveform placeholder */}
      <WaveformPlaceholder
        label={incomingTrack.title}
        subtitle={incomingTrack.artist}
      />
    </VStack>
  )
}

// ── Placeholder component for waveform areas (replaced in Phase 2) ──────────

function WaveformPlaceholder({
  label,
  subtitle,
}: {
  label: string
  subtitle?: string
}): JSX.Element {
  return (
    <Box
      bg="bg.card"
      borderWidth="1px"
      borderColor="border.base"
      borderRadius="md"
      p={4}
      w="full"
    >
      <Text
        fontSize="xs"
        fontWeight="medium"
        color="text.primary"
        lineClamp={1}
      >
        {subtitle ? `${subtitle} — ${label}` : label}
      </Text>
      {/* Placeholder waveform bar */}
      <Box
        mt={2}
        h="80px"
        bg="bg.elevated"
        borderRadius="sm"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Text fontSize="xs" color="text.muted">
          Waveform (Phase 2)
        </Text>
      </Box>
    </Box>
  )
}
