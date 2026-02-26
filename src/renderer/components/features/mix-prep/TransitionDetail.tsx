import { useCallback, useEffect, useMemo, useState } from 'react'
import { Flex, VStack, Text, Icon } from '@chakra-ui/react'
import { FiMusic } from 'react-icons/fi'
import { TransitionWaveformPanel } from './TransitionWaveformPanel'
import { ComparisonStrip } from './ComparisonStrip'
import { TransitionCrossfadeControl } from './TransitionCrossfadeControl'
import { DualDeckControls } from './DualDeckControls'
import { PairNavigationBar } from './PairNavigationBar'
import { useTransitionData } from './hooks/useTransitionData'
import { useDualDeck } from './hooks/useDualDeck'
import { useTrimDrag } from '@/components/features/timeline/hooks/useTrimDrag'
import { useCrossfadePreview } from '@/hooks/useCrossfadePreview'
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
  const dualDeck = useDualDeck()

  // ── Trim drag (reused from timeline) ──────────────────────────────────────
  const {
    previewTrims,
    handleTrimStartDrag,
    handleTrimEndDrag,
    handleTrimDragEnd,
  } = useTrimDrag()

  // Merge preview trims into song objects so the waveform panel reflects live drag
  const outgoingSong = useMemo(() => {
    if (!outgoing) return null
    const preview = previewTrims[outgoing.song.id]
    return preview ? { ...outgoing.song, ...preview } : outgoing.song
  }, [outgoing, previewTrims])

  const incomingSong = useMemo(() => {
    if (!incoming) return null
    const preview = previewTrims[incoming.song.id]
    return preview ? { ...incoming.song, ...preview } : incoming.song
  }, [incoming, previewTrims])

  // ── Crossfade preview (lifted here so playheads reach waveform panels) ────
  const outFilePath =
    outgoingTrack?.localFilePath ?? outgoingTrack?.externalFilePath ?? ''
  const inFilePath =
    incomingTrack?.localFilePath ?? incomingTrack?.externalFilePath ?? ''

  const previewOptions = useMemo(
    () =>
      outFilePath && inFilePath
        ? {
            trackA: {
              filePath: outFilePath,
              duration: outgoingTrack?.duration ?? 0,
              trimEnd: outgoingTrack?.trimEnd,
            },
            trackB: {
              filePath: inFilePath,
              trimStart: incomingTrack?.trimStart,
            },
            crossfadeDuration: outgoingTrack?.crossfadeDuration ?? 5,
            curveType: outgoingTrack?.crossfadeCurveType ?? 'linear',
          }
        : null,
    [outFilePath, inFilePath, outgoingTrack, incomingTrack]
  )
  const crossfadePreview = useCrossfadePreview(previewOptions)

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

  // ── Tempo sync handlers ─────────────────────────────────────────────────────

  const handleApplySync = useCallback(
    async (rate: number) => {
      dualDeck.setPlaybackRate('B', rate)

      if (!incomingTrack) return
      const response = await window.api.mix.updateSong({
        projectId,
        songId: incomingTrack.id,
        updates: { tempoAdjustment: rate },
      })
      if (response.success && response.data) {
        setCurrentProject(response.data)
      }
    },
    [dualDeck, incomingTrack, projectId, setCurrentProject]
  )

  const handleResetSync = useCallback(async () => {
    dualDeck.setPlaybackRate('B', 1.0)

    if (!incomingTrack) return
    const response = await window.api.mix.updateSong({
      projectId,
      songId: incomingTrack.id,
      updates: { tempoAdjustment: undefined },
    })
    if (response.success && response.data) {
      setCurrentProject(response.data)
    }
  }, [dualDeck, incomingTrack, projectId, setCurrentProject])

  // Restore persisted tempo adjustment when pair changes
  useEffect(() => {
    if (incomingTrack?.tempoAdjustment) {
      dualDeck.setPlaybackRate('B', incomingTrack.tempoAdjustment)
    } else {
      dualDeck.setPlaybackRate('B', 1.0)
    }
  }, [incomingTrack?.id, incomingTrack?.tempoAdjustment, dualDeck])

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

  // Stop playback when navigating pairs
  const handlePrev = () => {
    crossfadePreview.stop()
    dualDeck.stopAll()
    pairNav.goPrev()
  }
  const handleNext = () => {
    crossfadePreview.stop()
    dualDeck.stopAll()
    pairNav.goNext()
  }

  return (
    <Flex flex={1} direction="column">
      <VStack flex={1} gap={0} align="stretch" p={4} overflowY="auto">
        {/* Outgoing waveform */}
        <TransitionWaveformPanel
          song={outgoingSong!}
          peaks={outgoing.peaks}
          isLoading={outgoing.isLoading}
          color="#3b82f6"
          playheadTime={
            crossfadePreview.isPlaying
              ? crossfadePreview.trackATime
              : dualDeck.deckA.currentTime
          }
          isPlaybackActive={
            crossfadePreview.isPlaying || dualDeck.deckA.isPlaying
          }
          trimHandleSide="end"
          onTrimDrag={(ts) => handleTrimEndDrag(outgoing.song.id, ts)}
          onTrimDragEnd={() => handleTrimDragEnd(outgoing.song.id)}
        />

        {/* Comparison strip + crossfade controls + dual deck */}
        <VStack my={1} gap={1} align="stretch">
          <ComparisonStrip
            outgoing={outgoing.song}
            incoming={incoming.song}
            tempoAdjustment={incomingTrack?.tempoAdjustment}
            onApplySync={handleApplySync}
            onResetSync={handleResetSync}
          />
          <TransitionCrossfadeControl
            outgoing={outgoing.song}
            incoming={incoming.song}
            projectId={projectId}
            onSuggestMixPoint={handleSuggestMixPoint}
            isSuggesting={isSuggesting}
            canSuggest={!!outgoing.peaks && !!incoming.peaks}
            preview={crossfadePreview}
          />
          <DualDeckControls
            outgoing={outgoing.song}
            incoming={incoming.song}
            dualDeck={dualDeck}
          />
        </VStack>

        {/* Incoming waveform */}
        <TransitionWaveformPanel
          song={incomingSong!}
          peaks={incoming.peaks}
          isLoading={incoming.isLoading}
          color="#8b5cf6"
          playheadTime={
            crossfadePreview.isPlaying
              ? crossfadePreview.trackBTime
              : dualDeck.deckB.currentTime
          }
          isPlaybackActive={
            crossfadePreview.trackBActive || dualDeck.deckB.isPlaying
          }
          trimHandleSide="start"
          onTrimDrag={(ts) => handleTrimStartDrag(incoming.song.id, ts)}
          onTrimDragEnd={() => handleTrimDragEnd(incoming.song.id)}
        />
      </VStack>

      {/* Pair navigation bar — stops playback on navigate */}
      <PairNavigationBar
        currentPairNumber={pairNav.currentPairNumber}
        pairCount={pairNav.pairCount}
        canPrev={pairNav.canPrev}
        canNext={pairNav.canNext}
        goPrev={handlePrev}
        goNext={handleNext}
      />
    </Flex>
  )
}
