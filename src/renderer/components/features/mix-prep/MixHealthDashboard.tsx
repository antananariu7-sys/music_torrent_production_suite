import { Box, VStack, HStack, Text, Icon } from '@chakra-ui/react'
import { FiAlertTriangle } from 'react-icons/fi'
import { useMixHealth } from './hooks/useMixHealth'
import { TransitionScoreList } from './TransitionScoreList'
import { EnergyFlowGraph } from './EnergyFlowGraph'
import { KeyJourneyStrip } from './KeyJourneyStrip'
import type { Song } from '@shared/types/project.types'

interface MixHealthDashboardProps {
  songs: Song[]
  onNavigateToPair: (songIndex: number) => void
}

const gradeColor = {
  good: 'green.400',
  warning: 'yellow.400',
  poor: 'red.400',
} as const

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0)
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Bird's-eye view of the entire mix quality: transition scores,
 * energy flow, key journey, and format report.
 */
export function MixHealthDashboard({
  songs,
  onNavigateToPair,
}: MixHealthDashboardProps): JSX.Element {
  const health = useMixHealth(songs)

  if (health.trackCount === 0) {
    return (
      <VStack flex={1} justify="center" align="center" p={8}>
        <Text color="text.muted" fontSize="sm">
          Add tracks to see mix health analysis
        </Text>
      </VStack>
    )
  }

  const scoreDisplay = (health.overallScore * 10).toFixed(1)

  return (
    <VStack flex={1} align="stretch" p={4} gap={3} overflowY="auto">
      {/* Summary bar */}
      <HStack
        bg="bg.elevated"
        borderWidth="1px"
        borderColor="border.base"
        borderRadius="md"
        px={3}
        py={2}
        justify="space-around"
      >
        <VStack gap={0}>
          <Text fontSize="2xs" color="text.muted">
            Duration
          </Text>
          <Text fontSize="sm" fontWeight="semibold" color="text.primary">
            {formatDuration(health.totalDuration)}
          </Text>
        </VStack>
        <VStack gap={0}>
          <Text fontSize="2xs" color="text.muted">
            Tracks
          </Text>
          <Text fontSize="sm" fontWeight="semibold" color="text.primary">
            {health.trackCount}
          </Text>
        </VStack>
        <VStack gap={0}>
          <Text fontSize="2xs" color="text.muted">
            Score
          </Text>
          <Text
            fontSize="sm"
            fontWeight="semibold"
            color={gradeColor[health.overallGrade]}
          >
            {scoreDisplay}/10
          </Text>
        </VStack>
      </HStack>

      {/* Energy flow graph */}
      <Section title="Energy Flow">
        <EnergyFlowGraph songs={songs} />
      </Section>

      {/* Key journey strip */}
      <Section title="Key Journey">
        <KeyJourneyStrip songs={songs} />
      </Section>

      {/* Transition scores */}
      <Section title="Transitions">
        <TransitionScoreList
          transitions={health.transitions}
          onNavigate={onNavigateToPair}
        />
      </Section>

      {/* Issues */}
      {health.issues.length > 0 && (
        <Section title="Issues">
          <VStack align="start" gap={1}>
            {health.issues.map((issue, i) => (
              <HStack key={i} gap={1}>
                <Icon
                  as={FiAlertTriangle}
                  boxSize={3}
                  color="yellow.400"
                  flexShrink={0}
                />
                <Text fontSize="2xs" color="text.muted">
                  {issue}
                </Text>
              </HStack>
            ))}
          </VStack>
        </Section>
      )}
    </VStack>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <Box
      bg="bg.surface"
      borderWidth="1px"
      borderColor="border.base"
      borderRadius="md"
      px={3}
      py={2}
    >
      <Text fontSize="xs" fontWeight="semibold" color="text.primary" mb={1}>
        {title}
      </Text>
      {children}
    </Box>
  )
}
