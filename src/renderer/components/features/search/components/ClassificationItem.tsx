import { HStack, VStack, Text, Icon } from '@chakra-ui/react'
import { FiMusic, FiDisc, FiUser, FiChevronRight } from 'react-icons/fi'
import type { SearchClassificationResult } from '@shared/types/musicbrainz.types'

interface ClassificationItemProps {
  result: SearchClassificationResult
  onSelect?: (result: SearchClassificationResult) => void
}

export const ClassificationItem: React.FC<ClassificationItemProps> = ({ result, onSelect }) => {
  const getIcon = () => {
    switch (result.type) {
      case 'song':
        return FiMusic
      case 'album':
        return FiDisc
      case 'artist':
        return FiUser
      default:
        return FiMusic
    }
  }

  const getTypeLabel = () => {
    return result.type.charAt(0).toUpperCase() + result.type.slice(1)
  }

  return (
    <HStack
      p={3}
      borderRadius="sm"
      bg="bg.elevated"
      borderWidth="1px"
      borderColor="border.base"
      cursor="pointer"
      onClick={() => onSelect?.(result)}
      transition="all 0.2s"
      _hover={{
        borderColor: 'border.focus',
        bg: 'bg.hover',
      }}
    >
      <Icon as={getIcon()} boxSize={5} color="interactive.base" flexShrink={0} />
      <VStack align="start" gap={0} flex="1" minW={0}>
        <Text fontSize="sm" fontWeight="medium" color="text.primary" lineClamp={1}>
          {result.name}
        </Text>
        {result.artist && (
          <Text fontSize="xs" color="text.muted" lineClamp={1}>
            by {result.artist}
          </Text>
        )}
      </VStack>
      <HStack gap={2} flexShrink={0}>
        <Text fontSize="xs" color="text.muted" px={2} py={1} bg="bg.surface" borderRadius="sm">
          {getTypeLabel()}
        </Text>
        <Icon as={FiChevronRight} boxSize={4} color="text.muted" />
      </HStack>
    </HStack>
  )
}
