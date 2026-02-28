import { Box, HStack, VStack, Text, Button, Icon } from '@chakra-ui/react'
import { FiX, FiZap } from 'react-icons/fi'
import type { CrossfadeScores } from './MixPointSuggester'

interface MixPointSuggestionCardProps {
  /** Dynamic scores for the current slider value */
  scores: CrossfadeScores
  /** Algorithm's recommended duration */
  suggestedDuration: number
  outBpm?: number
  /** Jump slider to suggested value */
  onUseSuggested: () => void
  /** Hide the card */
  onDismiss: () => void
}

/**
 * Dynamic quality meter showing scoring breakdown for the current crossfade duration.
 * Score bars update in real-time as the user drags the slider.
 */
export function MixPointSuggestionCard({
  scores,
  suggestedDuration,
  outBpm,
  onUseSuggested,
  onDismiss,
}: MixPointSuggestionCardProps): JSX.Element {
  const suggestedLabel = formatDurationLabel(suggestedDuration, outBpm)

  const overallScore =
    scores.energyScore * 0.5 +
    scores.phraseScore * 0.35 +
    scores.keyScore * 0.15

  return (
    <Box
      bg="bg.elevated"
      borderWidth="1px"
      borderColor="border.base"
      borderRadius="md"
      p={3}
      w="100%"
    >
      <VStack gap={2} align="stretch">
        {/* Header */}
        <HStack justify="space-between">
          <Text fontSize="xs" fontWeight="semibold" color="text.primary">
            Mix Point Analysis
          </Text>
          <Button
            size="2xs"
            variant="ghost"
            onClick={onDismiss}
            title="Dismiss"
            minW="auto"
            p={0}
          >
            <Icon as={FiX} boxSize={3} />
          </Button>
        </HStack>

        {/* Score bars */}
        <VStack gap={1} align="stretch">
          <ScoreBar
            label="Energy"
            score={scores.energyScore}
            detail={getScoreDetail(scores.breakdown, 'Energy')}
          />
          <ScoreBar
            label="Phrase"
            score={scores.phraseScore}
            detail={getScoreDetail(scores.breakdown, 'Phrase')}
          />
          <ScoreBar
            label="Key"
            score={scores.keyScore}
            detail={getScoreDetail(scores.breakdown, 'Key')}
          />
          <ScoreBar label="Overall" score={overallScore} bold />
        </VStack>

        {/* Use Suggested button */}
        <Button
          size="2xs"
          variant="solid"
          colorPalette="green"
          w="100%"
          onClick={onUseSuggested}
          title={`Set crossfade to ${suggestedLabel}`}
        >
          <Icon as={FiZap} boxSize={3} />
          Use Suggested: {suggestedLabel}
        </Button>
      </VStack>
    </Box>
  )
}

// ── Score bar sub-component ──────────────────────────────────────────────────

interface ScoreBarProps {
  label: string
  score: number
  detail?: string
  bold?: boolean
}

function ScoreBar({ label, score, detail, bold }: ScoreBarProps): JSX.Element {
  const pct = Math.round(score * 100)
  const barColor = getScoreColor(score)

  return (
    <HStack gap={2}>
      <Text
        fontSize="2xs"
        color="text.muted"
        w="42px"
        textAlign="right"
        fontWeight={bold ? 'semibold' : 'normal'}
      >
        {label}
      </Text>
      <Box flex={1} position="relative" h="10px" bg="bg.card" borderRadius="sm">
        <Box
          h="100%"
          w={`${pct}%`}
          bg={barColor}
          borderRadius="sm"
          transition="width 0.3s"
        />
      </Box>
      <Text
        fontSize="2xs"
        color="text.muted"
        w="28px"
        textAlign="right"
        fontWeight={bold ? 'semibold' : 'normal'}
      >
        {pct}%
      </Text>
      {detail && (
        <Text fontSize="2xs" color="text.muted" flex={1} lineClamp={1}>
          {detail}
        </Text>
      )}
    </HStack>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getScoreColor(score: number): string {
  if (score >= 0.7) return 'green.500'
  if (score >= 0.4) return 'yellow.500'
  return 'red.400'
}

function getScoreDetail(
  breakdown: string[],
  prefix: string
): string | undefined {
  const line = breakdown.find((b) => b.startsWith(prefix + ':'))
  if (!line) return undefined
  return line.slice(prefix.length + 2).trim()
}

function formatDurationLabel(duration: number, bpm?: number): string {
  let label = `${duration}s`
  if (bpm && bpm > 0) {
    const beatLength = 60 / bpm
    const bars = Math.round(duration / (beatLength * 4))
    if (bars > 0) {
      label += ` (${bars} bars at ${Math.round(bpm)} BPM)`
    }
  }
  return label
}
