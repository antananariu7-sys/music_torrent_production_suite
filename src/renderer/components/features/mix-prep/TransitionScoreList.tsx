import { Box, HStack, Text, Icon } from '@chakra-ui/react'
import { FiCheck, FiAlertTriangle, FiMinus } from 'react-icons/fi'
import type { TransitionScore } from './hooks/useMixHealth'

interface TransitionScoreListProps {
  transitions: TransitionScore[]
  onNavigate: (songIndex: number) => void
}

const gradeColor = {
  good: 'green.400',
  warning: 'yellow.400',
  poor: 'red.400',
} as const

function CompatIcon({ compatible }: { compatible: boolean | null }) {
  if (compatible === true)
    return <Icon as={FiCheck} boxSize={3} color="green.400" />
  if (compatible === false)
    return <Icon as={FiAlertTriangle} boxSize={3} color="red.400" />
  return <Icon as={FiMinus} boxSize={3} color="text.muted" />
}

export function TransitionScoreList({
  transitions,
  onNavigate,
}: TransitionScoreListProps): JSX.Element {
  if (transitions.length === 0) {
    return (
      <Text fontSize="xs" color="text.muted" textAlign="center" py={2}>
        Add at least 2 tracks to see transition scores
      </Text>
    )
  }

  return (
    <Box>
      {transitions.map((t) => {
        const scoreDisplay = (t.overallScore * 10).toFixed(1)
        const outBpm = t.outgoing.bpm ? Math.round(t.outgoing.bpm) : '?'
        const inBpm = t.incoming.bpm ? Math.round(t.incoming.bpm) : '?'
        const outKey = t.outgoing.musicalKey ?? '?'
        const inKey = t.incoming.musicalKey ?? '?'
        const outBitrate = t.outgoing.bitrate ? `${t.outgoing.bitrate}k` : '?'
        const inBitrate = t.incoming.bitrate ? `${t.incoming.bitrate}k` : '?'

        return (
          <HStack
            key={t.index}
            px={2}
            py={1}
            gap={3}
            cursor="pointer"
            borderRadius="sm"
            _hover={{ bg: 'bg.elevated' }}
            onClick={() => onNavigate(t.index + 1)}
            title={`Go to transition ${t.index + 1}→${t.index + 2}`}
          >
            {/* Pair number */}
            <Text
              fontSize="2xs"
              color="text.muted"
              fontFamily="monospace"
              w="35px"
              flexShrink={0}
            >
              {t.index + 1}→{t.index + 2}
            </Text>

            {/* BPM */}
            <HStack gap={0.5} flexShrink={0}>
              <Text fontSize="2xs" color="text.muted">
                {outBpm}→{inBpm}
              </Text>
              <CompatIcon
                compatible={
                  t.bpmDelta <= 1 ? true : t.bpmDelta <= 3 ? null : false
                }
              />
            </HStack>

            {/* Key */}
            <HStack gap={0.5} flexShrink={0}>
              <Text fontSize="2xs" color="text.muted">
                {outKey}→{inKey}
              </Text>
              <CompatIcon compatible={t.keyCompatible} />
            </HStack>

            {/* Bitrate */}
            <Text fontSize="2xs" color="text.muted" flexShrink={0}>
              {outBitrate}→{inBitrate}
            </Text>

            {/* Score */}
            <Text
              fontSize="2xs"
              fontWeight="semibold"
              color={gradeColor[t.grade]}
              ml="auto"
              flexShrink={0}
            >
              {scoreDisplay}/10
            </Text>
          </HStack>
        )
      })}
    </Box>
  )
}
