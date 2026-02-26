import { Flex, HStack, Text, Icon, Badge, Box } from '@chakra-ui/react'
import { FiAlertTriangle, FiCheck } from 'react-icons/fi'
import { getCompatibilityLabel } from '@shared/utils/camelotWheel'
import type { Song } from '@shared/types/project.types'

interface ComparisonStripProps {
  outgoing: Song
  incoming: Song
}

/**
 * Horizontal strip between waveforms showing BPM delta,
 * key compatibility (placeholder), and bitrate/format comparison.
 */
export function ComparisonStrip({
  outgoing,
  incoming,
}: ComparisonStripProps): JSX.Element {
  return (
    <Box
      bg="bg.surface"
      borderWidth="1px"
      borderColor="border.base"
      borderRadius="md"
      px={4}
      py={2}
    >
      <Flex align="center" justify="center" gap={6} wrap="wrap">
        {/* BPM comparison */}
        <BpmComparison outBpm={outgoing.bpm} inBpm={incoming.bpm} />

        {/* Key comparison */}
        <KeyComparison
          outKey={outgoing.musicalKey}
          inKey={incoming.musicalKey}
          outConfidence={outgoing.musicalKeyConfidence}
          inConfidence={incoming.musicalKeyConfidence}
        />

        {/* Bitrate/format comparison */}
        <BitrateComparison outgoing={outgoing} incoming={incoming} />
      </Flex>
    </Box>
  )
}

// ── BPM comparison ─────────────────────────────────────────────────────────

function BpmComparison({
  outBpm,
  inBpm,
}: {
  outBpm?: number
  inBpm?: number
}): JSX.Element {
  const outLabel = outBpm ? String(Math.round(outBpm)) : '?'
  const inLabel = inBpm ? String(Math.round(inBpm)) : '?'

  let delta: number | null = null
  let deltaColor = 'text.muted'
  let showWarning = false

  if (outBpm && inBpm) {
    delta = Math.round(inBpm - outBpm)
    const absDelta = Math.abs(delta)
    if (absDelta > 10) {
      deltaColor = 'red.400'
      showWarning = true
    } else if (absDelta > 3) {
      deltaColor = 'orange.400'
      showWarning = true
    } else {
      deltaColor = 'green.400'
    }
  }

  return (
    <HStack gap={1}>
      <Text fontSize="xs" color="text.muted">
        BPM:
      </Text>
      <Text fontSize="xs" fontWeight="medium" color="text.primary">
        {outLabel}
      </Text>
      <Text fontSize="xs" color="text.muted">
        →
      </Text>
      <Text fontSize="xs" fontWeight="medium" color="text.primary">
        {inLabel}
      </Text>
      {delta !== null && (
        <Badge
          fontSize="2xs"
          colorPalette={
            delta === 0
              ? 'green'
              : Math.abs(delta) > 10
                ? 'red'
                : Math.abs(delta) > 3
                  ? 'orange'
                  : 'green'
          }
          variant="subtle"
        >
          {delta > 0 ? `+${delta}` : delta}
        </Badge>
      )}
      {showWarning && (
        <Icon as={FiAlertTriangle} boxSize={3} color={deltaColor} />
      )}
    </HStack>
  )
}

// ── Key comparison ────────────────────────────────────────────────────────

function KeyComparison({
  outKey,
  inKey,
  outConfidence,
  inConfidence,
}: {
  outKey?: string
  inKey?: string
  outConfidence?: number
  inConfidence?: number
}): JSX.Element {
  const outLabel = outKey || '?'
  const inLabel = inKey || '?'

  function confTip(key?: string, confidence?: number): string {
    if (!key) return '?'
    if (confidence == null) return key
    return `${key} (confidence: ${(confidence * 100).toFixed(0)}%)`
  }

  let compat: { label: string; compatible: boolean | null } | null = null
  if (outKey && inKey) {
    compat = getCompatibilityLabel(outKey, inKey)
  }

  const color = compat
    ? compat.compatible
      ? 'green.400'
      : 'orange.400'
    : 'text.muted'

  return (
    <HStack gap={1}>
      <Text fontSize="xs" color="text.muted">
        Key:
      </Text>
      <Text
        fontSize="xs"
        fontWeight="medium"
        color="text.primary"
        title={confTip(outKey, outConfidence)}
      >
        {outLabel}
      </Text>
      <Text fontSize="xs" color="text.muted">
        →
      </Text>
      <Text
        fontSize="xs"
        fontWeight="medium"
        color="text.primary"
        title={confTip(inKey, inConfidence)}
      >
        {inLabel}
      </Text>
      {compat && (
        <Badge
          fontSize="2xs"
          colorPalette={compat.compatible ? 'green' : 'orange'}
          variant="subtle"
          title={
            compat.compatible
              ? 'Keys are harmonically compatible — safe to mix'
              : 'Keys are not harmonically adjacent on the Camelot wheel — mixing may sound dissonant'
          }
        >
          {compat.label}
        </Badge>
      )}
      {compat && compat.compatible && (
        <Icon as={FiCheck} boxSize={3} color="green.400" />
      )}
      {compat && !compat.compatible && (
        <Icon as={FiAlertTriangle} boxSize={3} color={color} />
      )}
    </HStack>
  )
}

// ── Bitrate/format comparison ──────────────────────────────────────────────

function BitrateComparison({
  outgoing,
  incoming,
}: {
  outgoing: Song
  incoming: Song
}): JSX.Element {
  const outBitrate = outgoing.bitrate
  const inBitrate = incoming.bitrate
  const outFormat = outgoing.format?.toUpperCase()
  const inFormat = incoming.format?.toUpperCase()

  let bitrateWarning = false
  let formatWarning = false

  if (outBitrate && inBitrate && outBitrate - inBitrate > 64) {
    bitrateWarning = true
  }
  if (outFormat && inFormat && outFormat !== inFormat) {
    formatWarning = true
  }

  const hasWarning = bitrateWarning || formatWarning
  const color = hasWarning ? 'orange.400' : 'green.400'

  return (
    <HStack gap={1}>
      <Text fontSize="xs" color="text.muted">
        Quality:
      </Text>
      <Text fontSize="xs" color={color}>
        {outBitrate ? `${outBitrate}k` : '?'}
        {outFormat ? ` ${outFormat}` : ''}
      </Text>
      <Text fontSize="xs" color="text.muted">
        →
      </Text>
      <Text fontSize="xs" color={color}>
        {inBitrate ? `${inBitrate}k` : '?'}
        {inFormat ? ` ${inFormat}` : ''}
      </Text>
      {hasWarning && (
        <Icon as={FiAlertTriangle} boxSize={3} color="orange.400" />
      )}
    </HStack>
  )
}
