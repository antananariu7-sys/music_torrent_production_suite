import { useCallback, useState } from 'react'
import { Flex, VStack, HStack, Text, Icon, Button } from '@chakra-ui/react'
import { FiMusic, FiZap } from 'react-icons/fi'
import { TransitionWaveformPanel } from './TransitionWaveformPanel'
import { ComparisonStrip } from './ComparisonStrip'
import { TransitionCrossfadeControl } from './TransitionCrossfadeControl'
import { PairNavigationBar } from './PairNavigationBar'
import { useTransitionData } from './hooks/useTransitionData'
import { suggestMixPoint } from './MixPointSuggester'
import { useProjectStore } from '@/store/useProjectStore'
import { toaster } from '@/components/ui/toaster'
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
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject)
  const [isSuggesting, setIsSuggesting] = useState(false)

  const handleSuggestMixPoint = useCallback(async () => {
    if (!outgoing?.peaks || !incoming?.peaks || !outgoingTrack) return

    setIsSuggesting(true)
    try {
      const suggestion = suggestMixPoint(
        {
          duration: outgoing.peaks.duration ?? outgoingTrack.duration ?? 0,
          peaks: outgoing.peaks.peaks,
          energyProfile: outgoingTrack.energyProfile,
          bpm: outgoingTrack.bpm,
          firstBeatOffset: outgoingTrack.firstBeatOffset,
          trimEnd: outgoingTrack.trimEnd,
        },
        {
          duration: incoming.peaks.duration ?? incomingTrack!.duration ?? 0,
          peaks: incoming.peaks.peaks,
          energyProfile: incomingTrack!.energyProfile,
          bpm: incomingTrack!.bpm,
          firstBeatOffset: incomingTrack!.firstBeatOffset,
          trimStart: incomingTrack!.trimStart,
        }
      )

      // Apply suggestion: update crossfade duration on outgoing track
      const response = await window.api.mix.updateSong({
        projectId,
        songId: outgoingTrack.id,
        updates: { crossfadeDuration: suggestion.crossfadeDuration },
      })
      if (response.success && response.data) {
        setCurrentProject(response.data)
        toaster.create({
          title: `Crossfade set to ${suggestion.crossfadeDuration}s`,
          description: suggestion.reason,
          type: 'success',
        })
      }
    } finally {
      setIsSuggesting(false)
    }
  }, [
    outgoing,
    incoming,
    outgoingTrack,
    incomingTrack,
    projectId,
    setCurrentProject,
  ])

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

        {/* Comparison strip + crossfade controls + suggest button */}
        <VStack my={2} gap={1} align="stretch">
          <ComparisonStrip outgoing={outgoing.song} incoming={incoming.song} />
          <TransitionCrossfadeControl
            outgoing={outgoing.song}
            incoming={incoming.song}
            projectId={projectId}
          />
          <HStack justify="center">
            <Button
              size="2xs"
              variant="outline"
              colorPalette="blue"
              onClick={handleSuggestMixPoint}
              disabled={!outgoing.peaks || !incoming.peaks || isSuggesting}
              loading={isSuggesting}
              title="Analyze energy profiles to suggest optimal crossfade duration"
            >
              <Icon as={FiZap} boxSize={3} />
              Suggest Mix Point
            </Button>
          </HStack>
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
