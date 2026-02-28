import { Box, HStack, VStack, Text, Button, Icon } from '@chakra-ui/react'
import { FiCheck, FiX, FiSliders } from 'react-icons/fi'
import type { EnhancedMixPointSuggestion } from './MixPointSuggester'

interface MixPointSuggestionCardProps {
  suggestion: EnhancedMixPointSuggestion
  outBpm?: number
  onAccept: () => void
  onReject: () => void
  onAdjust: () => void
}

/**
 * Rich suggestion card showing scoring breakdown with accept/reject/adjust actions.
 * Replaces the simple toast notification for mix-point suggestions.
 */
export function MixPointSuggestionCard({
  suggestion,
  outBpm,
  onAccept,
  onReject,
  onAdjust,
}: MixPointSuggestionCardProps): JSX.Element {
  const durationLabel = formatDurationLabel(
    suggestion.crossfadeDuration,
    outBpm
  )

  const overallScore =
    suggestion.energyScore * 0.5 +
    suggestion.phraseScore * 0.35 +
    suggestion.keyScore * 0.15

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
            Mix Point Suggestion
          </Text>
          <Text fontSize="xs" color="text.muted">
            {durationLabel}
          </Text>
        </HStack>

        {/* Score bars */}
        <VStack gap={1} align="stretch">
          <ScoreBar
            label="Energy"
            score={suggestion.energyScore}
            detail={getScoreDetail(suggestion.breakdown, 'Energy')}
          />
          <ScoreBar
            label="Phrase"
            score={suggestion.phraseScore}
            detail={getScoreDetail(suggestion.breakdown, 'Phrase')}
          />
          <ScoreBar
            label="Key"
            score={suggestion.keyScore}
            detail={getScoreDetail(suggestion.breakdown, 'Key')}
          />
          <ScoreBar label="Overall" score={overallScore} bold />
        </VStack>

        {/* Action buttons */}
        <HStack justify="flex-end" gap={1}>
          <Button
            size="2xs"
            variant="ghost"
            colorPalette="red"
            onClick={onReject}
            title="Reject suggestion"
          >
            <Icon as={FiX} boxSize={3} />
            Reject
          </Button>
          <Button
            size="2xs"
            variant="outline"
            onClick={onAdjust}
            title="Adjust crossfade manually"
          >
            <Icon as={FiSliders} boxSize={3} />
            Adjust
          </Button>
          <Button
            size="2xs"
            variant="solid"
            colorPalette="green"
            onClick={onAccept}
            title="Accept suggestion"
          >
            <Icon as={FiCheck} boxSize={3} />
            Accept
          </Button>
        </HStack>
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
