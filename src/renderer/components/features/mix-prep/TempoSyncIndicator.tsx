import { useMemo } from 'react'
import {
  Badge,
  Box,
  Button,
  HStack,
  VStack,
  Text,
  Icon,
} from '@chakra-ui/react'
import { FiCheck, FiAlertTriangle } from 'react-icons/fi'

interface TempoSyncIndicatorProps {
  outBpm?: number
  inBpm?: number
  tempoAdjustment?: number
  onApplySync?: (rate: number) => void
  onResetSync?: () => void
}

/** Half-range of the visual BPM slider (±MAX_RANGE BPM) */
const MAX_RANGE = 10

/**
 * Visual BPM sync indicator with colored zones and tempo adjustment suggestion.
 *
 * - Green zone: ≤1 BPM difference (matched)
 * - Yellow zone: 1–3 BPM difference (close)
 * - Red zone: >3 BPM difference (needs adjustment)
 *
 * Shows a needle at the current delta position and a text suggestion
 * for how much to speed up / slow down the incoming track.
 */
export function TempoSyncIndicator({
  outBpm,
  inBpm,
  tempoAdjustment,
  onApplySync,
  onResetSync,
}: TempoSyncIndicatorProps): JSX.Element {
  const { delta, absDelta, pctAdjust, zone, needlePosition } = useMemo(() => {
    if (!outBpm || !inBpm) {
      return {
        delta: null,
        absDelta: 0,
        pctAdjust: 0,
        zone: 'unknown' as const,
        needlePosition: 50,
      }
    }

    const d = inBpm - outBpm
    const abs = Math.abs(d)
    const pct = ((outBpm - inBpm) / inBpm) * 100
    const z: 'matched' | 'close' | 'far' =
      abs <= 1 ? 'matched' : abs <= 3 ? 'close' : 'far'

    // Needle position: 50% = centered (delta=0), clamped to 0-100%
    const pos = 50 + (d / MAX_RANGE) * 50
    const clamped = Math.max(2, Math.min(98, pos))

    return {
      delta: d,
      absDelta: abs,
      pctAdjust: pct,
      zone: z,
      needlePosition: clamped,
    }
  }, [outBpm, inBpm])

  // No BPM data
  if (!outBpm || !inBpm) {
    return (
      <HStack gap={1}>
        <Text fontSize="xs" color="text.muted">
          BPM:
        </Text>
        <Text fontSize="xs" color="text.muted">
          {outBpm ? Math.round(outBpm) : '?'} →{' '}
          {inBpm ? Math.round(inBpm) : '?'}
        </Text>
        <Text fontSize="2xs" color="text.muted" fontStyle="italic">
          Detect BPM to enable tempo sync
        </Text>
      </HStack>
    )
  }

  const zoneColor =
    zone === 'matched'
      ? 'green.400'
      : zone === 'close'
        ? 'yellow.400'
        : 'red.400'

  const suggestionText = getSuggestionText(delta!, pctAdjust)

  return (
    <VStack gap={0} align="stretch">
      {/* BPM values + delta */}
      <HStack gap={1} justify="center">
        <Text fontSize="xs" color="text.muted">
          BPM:
        </Text>
        <Text fontSize="xs" fontWeight="medium" color="text.primary">
          {Math.round(outBpm)}
        </Text>
        <Text fontSize="xs" color="text.muted">
          →
        </Text>
        <Text fontSize="xs" fontWeight="medium" color="text.primary">
          {Math.round(inBpm)}
        </Text>
        <Text fontSize="xs" fontWeight="medium" color={zoneColor}>
          ({delta! > 0 ? '+' : ''}
          {delta!.toFixed(1)})
        </Text>
        {zone === 'matched' && (
          <Icon as={FiCheck} boxSize={3} color="green.400" />
        )}
        {zone === 'far' && (
          <Icon as={FiAlertTriangle} boxSize={3} color="red.400" />
        )}
      </HStack>

      {/* Visual slider bar */}
      <Box position="relative" h="12px" mx={4} my={1}>
        {/* Track background with colored zones */}
        <Box
          position="absolute"
          inset={0}
          borderRadius="full"
          overflow="hidden"
          display="flex"
        >
          {/* Red left */}
          <Box flex="3.5" bg="red.900" opacity={0.4} />
          {/* Yellow left */}
          <Box flex="1" bg="yellow.800" opacity={0.4} />
          {/* Green center */}
          <Box flex="1" bg="green.800" opacity={0.5} />
          {/* Yellow right */}
          <Box flex="1" bg="yellow.800" opacity={0.4} />
          {/* Red right */}
          <Box flex="3.5" bg="red.900" opacity={0.4} />
        </Box>

        {/* Center line */}
        <Box
          position="absolute"
          left="50%"
          top={0}
          bottom={0}
          w="1px"
          bg="whiteAlpha.300"
          transform="translateX(-0.5px)"
        />

        {/* Needle */}
        <Box
          position="absolute"
          left={`${needlePosition}%`}
          top="1px"
          bottom="1px"
          w="6px"
          bg={zoneColor}
          borderRadius="full"
          transform="translateX(-3px)"
          boxShadow={`0 0 4px ${zone === 'matched' ? '#22c55e' : zone === 'close' ? '#eab308' : '#ef4444'}`}
          transition="left 0.3s ease"
        />
      </Box>

      {/* Suggestion text or sync controls */}
      {absDelta > 1 &&
        (tempoAdjustment ? (
          <HStack justify="center" gap={1} mt={1}>
            <Badge colorPalette="green" variant="subtle" fontSize="2xs">
              <Icon as={FiCheck} boxSize={3} />
              Synced ({((tempoAdjustment - 1) * 100).toFixed(1)}%)
            </Badge>
            <Button
              size="2xs"
              variant="ghost"
              colorPalette="red"
              onClick={onResetSync}
            >
              Reset
            </Button>
          </HStack>
        ) : (
          <>
            {suggestionText && (
              <Text fontSize="2xs" color="text.muted" textAlign="center">
                {suggestionText}
              </Text>
            )}
            <HStack justify="center" gap={1} mt={1}>
              <Button
                size="2xs"
                variant="outline"
                colorPalette="green"
                onClick={() => {
                  const rate = Math.round((outBpm! / inBpm!) * 10000) / 10000
                  onApplySync?.(rate)
                }}
              >
                <Icon as={FiCheck} boxSize={3} />
                Apply Sync
              </Button>
            </HStack>
          </>
        ))}
    </VStack>
  )
}

function getSuggestionText(delta: number, pctAdjust: number): string {
  const absDelta = Math.abs(delta)
  if (absDelta <= 1) return ''

  const direction = delta > 0 ? 'Slow down' : 'Speed up'
  const pctStr = Math.abs(pctAdjust).toFixed(1)

  return `${direction} Track B by ${pctStr}% to match`
}
