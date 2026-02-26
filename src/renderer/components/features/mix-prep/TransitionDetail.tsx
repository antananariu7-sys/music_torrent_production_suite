import { Flex, VStack, Text, Icon } from '@chakra-ui/react'
import { FiMusic, FiArrowRight } from 'react-icons/fi'
import { TransitionWaveformPanel } from './TransitionWaveformPanel'
import { useTransitionData } from './hooks/useTransitionData'
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
 */
export function TransitionDetail({
  outgoingTrack,
  incomingTrack,
  songCount,
}: TransitionDetailProps): JSX.Element {
  const { outgoing, incoming } = useTransitionData(outgoingTrack, incomingTrack)

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
  if (songCount === 1 && incoming) {
    return (
      <VStack flex={1} gap={3} align="stretch" p={4}>
        <Text color="text.muted" fontSize="sm" textAlign="center">
          Add more tracks to see transitions
        </Text>
        <TransitionWaveformPanel
          song={incoming.song}
          peaks={incoming.peaks}
          isLoading={incoming.isLoading}
        />
      </VStack>
    )
  }

  // ── First track selected (no outgoing) ─────────────────────────────────────
  if (!outgoingTrack && incoming) {
    return (
      <VStack flex={1} gap={3} align="stretch" p={4}>
        <Text color="text.muted" fontSize="sm" textAlign="center">
          First track in mix — select track 2+ to see transitions
        </Text>
        <TransitionWaveformPanel
          song={incoming.song}
          peaks={incoming.peaks}
          isLoading={incoming.isLoading}
        />
      </VStack>
    )
  }

  // ── Normal transition view ─────────────────────────────────────────────────
  if (!outgoing || !incoming) return <></>

  return (
    <VStack flex={1} gap={0} align="stretch" p={4} overflowY="auto">
      {/* Outgoing waveform */}
      <TransitionWaveformPanel
        song={outgoing.song}
        peaks={outgoing.peaks}
        isLoading={outgoing.isLoading}
        color="#3b82f6"
      />

      {/* Comparison strip placeholder (Phase 3) */}
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
          {outgoing.song.bpm ? `${Math.round(outgoing.song.bpm)} BPM` : '? BPM'}
        </Text>
        <Icon as={FiArrowRight} boxSize={3} color="text.muted" />
        <Text fontSize="xs" color="text.muted">
          {incoming.song.bpm ? `${Math.round(incoming.song.bpm)} BPM` : '? BPM'}
        </Text>
      </Flex>

      {/* Incoming waveform */}
      <TransitionWaveformPanel
        song={incoming.song}
        peaks={incoming.peaks}
        isLoading={incoming.isLoading}
        color="#8b5cf6"
      />
    </VStack>
  )
}
