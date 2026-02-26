import { Flex, HStack, Text, Icon, Badge, Box } from '@chakra-ui/react'
import { FiAlertTriangle } from 'react-icons/fi'
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

        {/* Key comparison — placeholder until Phase 4 */}
        <HStack gap={1}>
          <Text fontSize="xs" color="text.muted">
            Key:
          </Text>
          <Text fontSize="xs" color="text.muted">
            — → —
          </Text>
        </HStack>

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
