import { SimpleGrid, Box, VStack, Text, HStack } from '@chakra-ui/react'
import { formatDuration, formatFileSize, formatDate } from '../utils'

interface StatsGridProps {
  songCount: number
  totalDuration: number
  totalSize: number
  formats: string[]
  createdAt: Date
  updatedAt: Date
}

export function StatsGrid({
  songCount,
  totalDuration,
  totalSize,
  formats,
  createdAt,
  updatedAt,
}: StatsGridProps): JSX.Element {
  const statCards = [
    {
      icon: '📁',
      label: 'Songs',
      value: songCount.toString(),
      detail: formats.length > 0 ? formats.join(', ') : 'No formats',
    },
    {
      icon: '⏱️',
      label: 'Duration',
      value: formatDuration(totalDuration),
      detail: 'Total time',
    },
    {
      icon: '💾',
      label: 'Size',
      value: formatFileSize(totalSize),
      detail: 'Total size',
    },
    {
      icon: '📅',
      label: 'Timeline',
      value: formatDate(updatedAt),
      detail: `Created ${formatDate(createdAt)}`,
    },
  ]

  return (
    <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} gap={4}>
      {statCards.map((card, index) => (
        <Box
          key={index}
          bg="bg.card"
          borderWidth="1px"
          borderColor="border.base"
          borderRadius="md"
          p={6}
        >
          <VStack align="start" gap={3}>
            <HStack gap={3} align="center">
              <Text fontSize="3xl">{card.icon}</Text>
              <Text
                fontSize="xs"
                fontWeight="bold"
                textTransform="uppercase"
                color="text.muted"
                letterSpacing="wide"
              >
                {card.label}
              </Text>
            </HStack>
            <Text
              fontSize="2xl"
              fontWeight="bold"
              color="text.primary"
            >
              {card.value}
            </Text>
            <Text
              fontSize="sm"
              color="text.secondary"
            >
              {card.detail}
            </Text>
          </VStack>
        </Box>
      ))}
    </SimpleGrid>
  )
}
