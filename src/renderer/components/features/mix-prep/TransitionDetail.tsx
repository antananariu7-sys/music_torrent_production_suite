import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Flex,
  VStack,
  HStack,
  Text,
  Icon,
  Button,
  Input,
} from '@chakra-ui/react'
import { FiMusic, FiSliders, FiVolume2, FiScissors } from 'react-icons/fi'
import { TransitionWaveformPanel } from './TransitionWaveformPanel'
import { ComparisonStrip } from './ComparisonStrip'
import { TransitionCrossfadeControl } from './TransitionCrossfadeControl'
import { DualDeckControls } from './DualDeckControls'
import { TransitionEQPanel } from './TransitionEQPanel'
import { MixPointSuggestionCard } from './MixPointSuggestionCard'
import { PairNavigationBar } from './PairNavigationBar'
import { UndoRedoBar } from '@/components/common/UndoRedoBar'
import { useTransitionData } from './hooks/useTransitionData'
import { useDualDeck } from './hooks/useDualDeck'
import { useTrimDrag } from '@/components/features/timeline/hooks/useTrimDrag'
import { useVolumeEnvelope } from './hooks/useVolumeEnvelope'
import { useWaveformEditing } from './hooks/useWaveformEditing'
import { useCrossfadePreview } from '@/hooks/useCrossfadePreview'
import { WebAudioEngine } from '@/services/WebAudioEngine'
import { suggestMixPoint, scoreCrossfadeDuration } from './MixPointSuggester'
import type {
  CrossfadeScores,
  TrackInfo,
  SuggestOptions,
} from './MixPointSuggester'
import { useProjectStore } from '@/store/useProjectStore'
import { toaster } from '@/components/ui/toaster'
import type { Song, TempoRegion } from '@shared/types/project.types'
import type { MixPointPreferences } from '@shared/types/app.types'
import type { PairNavigation } from './hooks/usePairNavigation'

/**
 * Track accept/reject feedback for mix-point preference learning.
 * Persists running averages via app settings (fire-and-forget).
 */
async function trackSuggestionFeedback(
  action: 'accept' | 'reject',
  acceptedDuration?: number
): Promise<void> {
  try {
    const settings = await window.api.getSettings()
    const prefs: MixPointPreferences = settings.mixPointPreferences ?? {
      totalAccepted: 0,
      totalRejected: 0,
      avgAcceptedDuration: 8,
    }

    if (action === 'accept' && acceptedDuration != null) {
      prefs.totalAccepted++
      // Exponential moving average of accepted duration
      const alpha = 0.3
      prefs.avgAcceptedDuration =
        alpha * acceptedDuration + (1 - alpha) * prefs.avgAcceptedDuration
    } else {
      prefs.totalRejected++
    }

    await window.api.setSettings({ mixPointPreferences: prefs })
  } catch {
    // Non-critical — don't block UX
  }
}

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
  const [showEQ, setShowEQ] = useState(false)
  const [showVolume, setShowVolume] = useState(false)
  const [showRegionEdit, setShowRegionEdit] = useState(false)
  const [suggestedDuration, setSuggestedDuration] = useState<number | null>(
    null
  )
  const [currentDuration, setCurrentDuration] = useState(
    outgoingTrack?.crossfadeDuration ?? 5
  )
  const dualDeck = useDualDeck()

  // Volume envelope hooks for both tracks
  const outVol = useVolumeEnvelope({
    projectId,
    songId: outgoingTrack?.id,
    initialEnvelope: outgoingTrack?.volumeEnvelope,
    initialGainDb: outgoingTrack?.gainDb,
  })
  const inVol = useVolumeEnvelope({
    projectId,
    songId: incomingTrack?.id,
    initialEnvelope: incomingTrack?.volumeEnvelope,
    initialGainDb: incomingTrack?.gainDb,
  })

  // Waveform editing hooks for both tracks
  const outRegions = useWaveformEditing({
    projectId,
    songId: outgoingTrack?.id,
    initialRegions: outgoingTrack?.regions,
  })
  const inRegions = useWaveformEditing({
    projectId,
    songId: incomingTrack?.id,
    initialRegions: incomingTrack?.regions,
  })

  // ── Sync regions to the audio engine ──────────────────────────────────────
  useEffect(() => {
    const engine = WebAudioEngine.getInstance()
    engine.setDeckRegions('A', outRegions.activeRegions)
  }, [outRegions.activeRegions])

  useEffect(() => {
    const engine = WebAudioEngine.getInstance()
    engine.setDeckRegions('B', inRegions.activeRegions)
  }, [inRegions.activeRegions])

  // ── Sync volume envelopes to the audio engine ─────────────────────────────
  useEffect(() => {
    const engine = WebAudioEngine.getInstance()
    engine.setDeckVolumeEnvelope('A', outVol.envelope, outVol.gainDb)
  }, [outVol.envelope, outVol.gainDb])

  useEffect(() => {
    const engine = WebAudioEngine.getInstance()
    engine.setDeckVolumeEnvelope('B', inVol.envelope, inVol.gainDb)
  }, [inVol.envelope, inVol.gainDb])

  // ── Apply tempo region ramp when deck B plays ──────────────────────────────
  useEffect(() => {
    if (!incomingTrack?.tempoRegion || !incomingTrack?.tempoAdjustment) return
    if (incomingTrack.tempoAdjustment === 1) return

    const engine = WebAudioEngine.getInstance()
    const unsub = engine.addEventListener((event) => {
      if (event.deck === 'B' && event.type === 'play') {
        engine.applyTempoRegionRamp(
          'B',
          incomingTrack.tempoRegion!,
          incomingTrack.tempoAdjustment!
        )
      }
    })
    return unsub
  }, [incomingTrack?.tempoRegion, incomingTrack?.tempoAdjustment])

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

  // ── Scoring track info (memoized to avoid re-creating on every render) ─────
  const outTrackInfo: TrackInfo | null = useMemo(() => {
    if (!outgoing?.peaks || !outgoingTrack) return null
    return {
      duration: outgoing.peaks.duration ?? outgoingTrack.duration ?? 0,
      peaks: outgoing.peaks.peaks,
      energyProfile: outgoingTrack.energyProfile,
      bpm: outgoingTrack.bpm,
      firstBeatOffset: outgoingTrack.firstBeatOffset,
      trimEnd: outgoingTrack.trimEnd,
    }
  }, [outgoing?.peaks, outgoingTrack])

  const inTrackInfo: TrackInfo | null = useMemo(() => {
    if (!incoming?.peaks || !incomingTrack) return null
    return {
      duration: incoming.peaks.duration ?? incomingTrack.duration ?? 0,
      peaks: incoming.peaks.peaks,
      energyProfile: incomingTrack.energyProfile,
      bpm: incomingTrack.bpm,
      firstBeatOffset: incomingTrack.firstBeatOffset,
      trimStart: incomingTrack.trimStart,
    }
  }, [incoming?.peaks, incomingTrack])

  const scoreOptions: SuggestOptions | undefined = useMemo(() => {
    if (!outgoingTrack || !incomingTrack) return undefined
    return {
      outSections: outgoingTrack.sections,
      inSections: incomingTrack.sections,
      outKey: outgoingTrack.musicalKey,
      inKey: incomingTrack.musicalKey,
    }
  }, [outgoingTrack, incomingTrack])

  // Dynamic scores: recalculated whenever slider value changes
  const currentScores: CrossfadeScores | null = useMemo(() => {
    if (!outTrackInfo || !inTrackInfo || suggestedDuration === null) return null
    return scoreCrossfadeDuration(
      currentDuration,
      outTrackInfo,
      inTrackInfo,
      scoreOptions
    )
  }, [
    currentDuration,
    outTrackInfo,
    inTrackInfo,
    scoreOptions,
    suggestedDuration,
  ])

  // Reset suggestion when pair changes
  useEffect(() => {
    setSuggestedDuration(null)
    setCurrentDuration(outgoingTrack?.crossfadeDuration ?? 5)
  }, [outgoingTrack?.id, outgoingTrack?.crossfadeDuration])

  const handleDurationChange = useCallback((d: number) => {
    setCurrentDuration(d)
  }, [])

  const handleSuggestMixPoint = useCallback(() => {
    if (!outTrackInfo || !inTrackInfo) return

    setIsSuggesting(true)
    try {
      const result = suggestMixPoint(outTrackInfo, inTrackInfo, scoreOptions)
      setSuggestedDuration(result.crossfadeDuration)
    } finally {
      setIsSuggesting(false)
    }
  }, [outTrackInfo, inTrackInfo, scoreOptions])

  const handleUseSuggested = useCallback(async () => {
    if (suggestedDuration === null || !outgoingTrack) return
    const response = await window.api.mix.updateSong({
      projectId,
      songId: outgoingTrack.id,
      updates: { crossfadeDuration: suggestedDuration },
    })
    if (response.success && response.data) {
      setCurrentProject(response.data)
      toaster.create({
        title: `Crossfade set to ${suggestedDuration}s`,
        type: 'success',
      })
    }
    trackSuggestionFeedback('accept', suggestedDuration)
  }, [suggestedDuration, outgoingTrack, projectId, setCurrentProject])

  const handleDismissSuggestion = useCallback(() => {
    trackSuggestionFeedback('reject')
    setSuggestedDuration(null)
  }, [])

  // ── Tempo sync handlers ─────────────────────────────────────────────────────

  /** Build a default tempo region for a song when tempo adjustment is applied. */
  const buildDefaultTempoRegion = useCallback(
    (song: Song): TempoRegion => {
      const start = song.trimStart ?? 0
      const end = song.trimEnd ?? song.duration ?? 0
      const crossfade = outgoingTrack?.crossfadeDuration ?? 0
      const rampDuration = Math.min(crossfade, end - start)
      return {
        startTime: start,
        endTime: end - rampDuration,
        rampDuration,
        rampType: 'linear',
      }
    },
    [outgoingTrack?.crossfadeDuration]
  )

  const handleApplySync = useCallback(
    async (rate: number) => {
      dualDeck.setPlaybackRate('B', rate)

      if (!incomingTrack) return
      // Auto-create tempo region if none exists
      const tempoRegion =
        incomingTrack.tempoRegion ?? buildDefaultTempoRegion(incomingTrack)
      const response = await window.api.mix.updateSong({
        projectId,
        songId: incomingTrack.id,
        updates: { tempoAdjustment: rate, tempoRegion },
      })
      if (response.success && response.data) {
        setCurrentProject(response.data)
      }
    },
    [
      dualDeck,
      incomingTrack,
      projectId,
      setCurrentProject,
      buildDefaultTempoRegion,
    ]
  )

  const handleResetSync = useCallback(async () => {
    dualDeck.setPlaybackRate('B', 1.0)

    if (!incomingTrack) return
    const response = await window.api.mix.updateSong({
      projectId,
      songId: incomingTrack.id,
      updates: { tempoAdjustment: undefined, tempoRegion: undefined },
    })
    if (response.success && response.data) {
      setCurrentProject(response.data)
    }
  }, [dualDeck, incomingTrack, projectId, setCurrentProject])

  const handleTempoRegionChange = useCallback(
    async (region: TempoRegion) => {
      if (!incomingTrack) return
      const response = await window.api.mix.updateSong({
        projectId,
        songId: incomingTrack.id,
        updates: { tempoRegion: region },
      })
      if (response.success && response.data) {
        setCurrentProject(response.data)
      }
    },
    [incomingTrack, projectId, setCurrentProject]
  )

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
          showVolumeEditor={showVolume}
          volumeEnvelope={outVol.envelope}
          onVolumeEnvelopeChange={outVol.setEnvelope}
          regions={outRegions.regions}
          showRegionEditor={showRegionEdit}
          onAddRegion={outRegions.addRegion}
          onToggleRegion={outRegions.toggleRegion}
          onDeleteRegion={outRegions.deleteRegion}
          crossfadeDuration={outgoingTrack?.crossfadeDuration}
          crossfadeRole="outgoing"
          onWaveformClick={(time) => dualDeck.playDeck('A', time)}
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
            onDurationChange={handleDurationChange}
          />
          {suggestedDuration !== null && currentScores && (
            <MixPointSuggestionCard
              scores={currentScores}
              suggestedDuration={suggestedDuration}
              outBpm={outgoingTrack?.bpm}
              onUseSuggested={handleUseSuggested}
              onDismiss={handleDismissSuggestion}
            />
          )}
          <HStack justify="center" gap={2}>
            <UndoRedoBar showButtons />
            <DualDeckControls
              outgoing={outgoing.song}
              incoming={incoming.song}
              dualDeck={dualDeck}
            />
            <Button
              size="2xs"
              variant={showEQ ? 'solid' : 'outline'}
              onClick={() => setShowEQ((prev) => !prev)}
              title="Toggle 3-band EQ"
            >
              <Icon as={FiSliders} boxSize={3} />
              EQ
            </Button>
            <Button
              size="2xs"
              variant={showVolume ? 'solid' : 'outline'}
              onClick={() => {
                setShowVolume((prev) => !prev)
                setShowRegionEdit(false)
              }}
              title="Toggle volume envelope editor"
            >
              <Icon as={FiVolume2} boxSize={3} />
              Vol
            </Button>
            <Button
              size="2xs"
              variant={showRegionEdit ? 'solid' : 'outline'}
              onClick={() => {
                setShowRegionEdit((prev) => !prev)
                setShowVolume(false)
              }}
              title="Toggle waveform region editing"
            >
              <Icon as={FiScissors} boxSize={3} />
              Edit
            </Button>
          </HStack>
          {showEQ && <TransitionEQPanel />}
          {showRegionEdit &&
            (outRegions.regions.length > 0 || inRegions.regions.length > 0) && (
              <HStack justify="center" gap={3} py={1}>
                <Text fontSize="2xs" color="text.muted">
                  A: {outRegions.regions.length} region
                  {outRegions.regions.length !== 1 ? 's' : ''} | B:{' '}
                  {inRegions.regions.length} region
                  {inRegions.regions.length !== 1 ? 's' : ''}
                </Text>
                <Button
                  size="2xs"
                  variant="ghost"
                  onClick={() => {
                    outRegions.clearAllRegions()
                    inRegions.clearAllRegions()
                  }}
                  title="Clear all regions on both tracks"
                >
                  Clear All
                </Button>
              </HStack>
            )}
          {showVolume && (
            <HStack justify="center" gap={4} py={1}>
              <HStack gap={1}>
                <Text fontSize="2xs" color="text.muted" whiteSpace="nowrap">
                  A gain:
                </Text>
                <Input
                  size="2xs"
                  type="number"
                  w="60px"
                  textAlign="center"
                  value={outVol.gainDb}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value)
                    if (!isNaN(v))
                      outVol.setGainDb(Math.max(-20, Math.min(20, v)))
                  }}
                  step={0.5}
                  min={-20}
                  max={20}
                />
                <Text fontSize="2xs" color="text.muted">
                  dB
                </Text>
              </HStack>
              <HStack gap={1}>
                <Text fontSize="2xs" color="text.muted" whiteSpace="nowrap">
                  B gain:
                </Text>
                <Input
                  size="2xs"
                  type="number"
                  w="60px"
                  textAlign="center"
                  value={inVol.gainDb}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value)
                    if (!isNaN(v))
                      inVol.setGainDb(Math.max(-20, Math.min(20, v)))
                  }}
                  step={0.5}
                  min={-20}
                  max={20}
                />
                <Text fontSize="2xs" color="text.muted">
                  dB
                </Text>
              </HStack>
              <Button
                size="2xs"
                variant="ghost"
                onClick={() => {
                  outVol.resetEnvelope()
                  inVol.resetEnvelope()
                }}
                title="Reset both volume envelopes to flat unity"
              >
                Reset
              </Button>
            </HStack>
          )}
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
          showVolumeEditor={showVolume}
          volumeEnvelope={inVol.envelope}
          onVolumeEnvelopeChange={inVol.setEnvelope}
          regions={inRegions.regions}
          showRegionEditor={showRegionEdit}
          onAddRegion={inRegions.addRegion}
          onToggleRegion={inRegions.toggleRegion}
          onDeleteRegion={inRegions.deleteRegion}
          crossfadeDuration={outgoingTrack?.crossfadeDuration}
          crossfadeRole="incoming"
          onWaveformClick={(time) => dualDeck.playDeck('B', time)}
          tempoAdjustment={incomingTrack?.tempoAdjustment}
          tempoRegion={incomingTrack?.tempoRegion}
          onTempoRegionChange={handleTempoRegionChange}
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
