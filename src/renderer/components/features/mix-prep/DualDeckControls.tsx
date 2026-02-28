import { useEffect } from 'react'
import { HStack, IconButton, Icon, Text, Spinner } from '@chakra-ui/react'
import { FiPlay, FiSquare } from 'react-icons/fi'
import type { DualDeckReturn } from './hooks/useDualDeck'
import type { Song } from '@shared/types/project.types'

interface DualDeckControlsProps {
  outgoing: Song
  incoming: Song
  dualDeck: DualDeckReturn
}

/**
 * Playback controls for dual-deck preview in the transition detail view.
 * Play A (outgoing), Play B (incoming), Play Both, Stop.
 */
export function DualDeckControls({
  outgoing,
  incoming,
  dualDeck,
}: DualDeckControlsProps): JSX.Element {
  const {
    deckA,
    deckB,
    isLoading,
    loadDecks,
    playDeck,
    scheduleCrossfade,
    stopAll,
  } = dualDeck

  const isAnythingPlaying = deckA.isPlaying || deckB.isPlaying

  const outFilePath = outgoing.localFilePath ?? outgoing.externalFilePath ?? ''
  const inFilePath = incoming.localFilePath ?? incoming.externalFilePath ?? ''

  // Auto-load decks when tracks change
  useEffect(() => {
    if (outFilePath && inFilePath) {
      loadDecks(outFilePath, inFilePath)
    }
  }, [outFilePath, inFilePath, loadDecks])

  const handlePlayA = () => {
    const start = outgoing.trimStart ?? 0
    playDeck('A', start)
  }

  const handlePlayB = () => {
    const start = incoming.trimStart ?? 0
    playDeck('B', start)
  }

  const handlePlayBoth = () => {
    // Play both with crossfade gain automation (matches crossfade preview)
    const aDuration = outgoing.duration ?? deckA.duration
    const crossfade = outgoing.crossfadeDuration ?? 8
    const aEnd = outgoing.trimEnd ?? aDuration
    const effectiveCrossfade = Math.min(crossfade, aEnd)
    const crossfadeStart = aEnd - effectiveCrossfade
    const aStart = Math.max(0, crossfadeStart - 5)
    const bStart = incoming.trimStart ?? 0
    scheduleCrossfade({
      crossfadeDuration: effectiveCrossfade,
      curveType: outgoing.crossfadeCurveType ?? 'linear',
      leadSeconds: crossfadeStart - aStart,
      deckAStartOffset: aStart,
      deckBStartOffset: bStart,
    })
  }

  if (isLoading) {
    return (
      <HStack justify="center" gap={2} py={1}>
        <Spinner size="xs" />
        <Text fontSize="xs" color="text.muted">
          Loading audio...
        </Text>
      </HStack>
    )
  }

  return (
    <HStack justify="center" gap={1} py={1}>
      {/* Play A */}
      <IconButton
        aria-label="Play outgoing track"
        size="2xs"
        variant={deckA.isPlaying && !deckB.isPlaying ? 'solid' : 'outline'}
        colorPalette="blue"
        onClick={handlePlayA}
        title={`Play ${outgoing.title} from ${formatTime(outgoing.trimStart ?? 0)}`}
      >
        <Icon as={FiPlay} boxSize={3} />
      </IconButton>
      <Text fontSize="2xs" color="text.muted" w="28px" textAlign="center">
        A
      </Text>

      {/* Play B */}
      <IconButton
        aria-label="Play incoming track"
        size="2xs"
        variant={deckB.isPlaying && !deckA.isPlaying ? 'solid' : 'outline'}
        colorPalette="purple"
        onClick={handlePlayB}
        title={`Play ${incoming.title} from ${formatTime(incoming.trimStart ?? 0)}`}
      >
        <Icon as={FiPlay} boxSize={3} />
      </IconButton>
      <Text fontSize="2xs" color="text.muted" w="28px" textAlign="center">
        B
      </Text>

      {/* Play Both */}
      <IconButton
        aria-label="Play both tracks"
        size="2xs"
        variant={deckA.isPlaying && deckB.isPlaying ? 'solid' : 'outline'}
        colorPalette="teal"
        onClick={handlePlayBoth}
        title="Play both tracks in crossfade zone"
      >
        <Icon as={FiPlay} boxSize={3} />
      </IconButton>
      <Text fontSize="2xs" color="text.muted" w="36px" textAlign="center">
        A+B
      </Text>

      {/* Stop */}
      <IconButton
        aria-label="Stop playback"
        size="2xs"
        variant="ghost"
        onClick={stopAll}
        disabled={!isAnythingPlaying}
        title="Stop all playback"
      >
        <Icon as={FiSquare} boxSize={3} />
      </IconButton>

      {/* Playhead times */}
      {isAnythingPlaying && (
        <Text fontSize="2xs" color="text.muted" ml={2}>
          {deckA.isPlaying && `A: ${formatTime(deckA.currentTime)}`}
          {deckA.isPlaying && deckB.isPlaying && ' | '}
          {deckB.isPlaying && `B: ${formatTime(deckB.currentTime)}`}
        </Text>
      )}
    </HStack>
  )
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
