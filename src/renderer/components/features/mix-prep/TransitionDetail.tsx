import { Flex, VStack, Text, Icon } from '@chakra-ui/react'
import { FiMusic } from 'react-icons/fi'
import { TransitionWaveformPanel } from './TransitionWaveformPanel'
import { ComparisonStrip } from './ComparisonStrip'
import { TransitionCrossfadeControl } from './TransitionCrossfadeControl'
import { PairNavigationBar } from './PairNavigationBar'
import { useTransitionData } from './hooks/useTransitionData'
import type { Song } from '@shared/types/project.types'
import type { PairNavigation } from './hooks/usePairNavigation'

interface TransitionDetailProps {
  /** The outgoing track (track N-1), null if first track selected */
  outgoingTrack: Song | null
  /** The incoming track (track N) */
  incomingTrack: Song | null
  /** Total number of songs in the mix */
  songCount: number
  /** Project ID for persisting crossfade changes */
  projectId: string
  /** Pair navigation state */
  pairNav: PairNavigation
}

/**
 * Right-panel container: renders stacked waveforms + comparison strip +
 * crossfade controls + pair navigation bar.
 */
export function TransitionDetail({
  outgoingTrack,
  incomingTrack,
  songCount,
  projectId,
  pairNav,
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
      <Flex flex={1} direction="column">
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
        {pairNav.pairCount > 0 && (
          <PairNavigationBar
            currentPairNumber={pairNav.currentPairNumber}
            pairCount={pairNav.pairCount}
            canPrev={pairNav.canPrev}
            canNext={pairNav.canNext}
            goPrev={pairNav.goPrev}
            goNext={pairNav.goNext}
          />
        )}
      </Flex>
    )
  }

  // ── Normal transition view ─────────────────────────────────────────────────
  if (!outgoing || !incoming) return <></>

  return (
    <Flex flex={1} direction="column">
      <VStack flex={1} gap={0} align="stretch" p={4} overflowY="auto">
        {/* Outgoing waveform */}
        <TransitionWaveformPanel
          song={outgoing.song}
          peaks={outgoing.peaks}
          isLoading={outgoing.isLoading}
          color="#3b82f6"
        />

        {/* Comparison strip + crossfade controls */}
        <VStack my={2} gap={0} align="stretch">
          <ComparisonStrip outgoing={outgoing.song} incoming={incoming.song} />
          <TransitionCrossfadeControl
            outgoing={outgoing.song}
            incoming={incoming.song}
            projectId={projectId}
          />
        </VStack>

        {/* Incoming waveform */}
        <TransitionWaveformPanel
          song={incoming.song}
          peaks={incoming.peaks}
          isLoading={incoming.isLoading}
          color="#8b5cf6"
        />
      </VStack>

      {/* Pair navigation bar */}
      <PairNavigationBar
        currentPairNumber={pairNav.currentPairNumber}
        pairCount={pairNav.pairCount}
        canPrev={pairNav.canPrev}
        canNext={pairNav.canNext}
        goPrev={pairNav.goPrev}
        goNext={pairNav.goNext}
      />
    </Flex>
  )
}
