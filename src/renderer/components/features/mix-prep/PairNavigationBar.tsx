import { Flex, HStack, Text, IconButton, Icon } from '@chakra-ui/react'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'

interface PairNavigationBarProps {
  currentPairNumber: number
  pairCount: number
  canPrev: boolean
  canNext: boolean
  goPrev: () => void
  goNext: () => void
}

/**
 * Bottom navigation bar for stepping through transition pairs.
 * Keyboard shortcuts (← →) handled by usePairNavigation hook.
 */
export function PairNavigationBar({
  currentPairNumber,
  pairCount,
  canPrev,
  canNext,
  goPrev,
  goNext,
}: PairNavigationBarProps): JSX.Element {
  return (
    <Flex
      align="center"
      justify="center"
      gap={3}
      py={2}
      px={4}
      borderTopWidth="1px"
      borderColor="border.base"
    >
      <IconButton
        aria-label="Previous pair"
        size="xs"
        variant="ghost"
        disabled={!canPrev}
        onClick={goPrev}
        title="Previous pair (←)"
      >
        <Icon as={FiChevronLeft} boxSize={4} />
      </IconButton>

      <HStack gap={1}>
        <Text fontSize="xs" fontWeight="medium" color="text.primary">
          {currentPairNumber}
        </Text>
        <Text fontSize="xs" color="text.muted">
          /
        </Text>
        <Text fontSize="xs" fontWeight="medium" color="text.primary">
          {pairCount}
        </Text>
      </HStack>

      <IconButton
        aria-label="Next pair"
        size="xs"
        variant="ghost"
        disabled={!canNext}
        onClick={goNext}
        title="Next pair (→)"
      >
        <Icon as={FiChevronRight} boxSize={4} />
      </IconButton>

      <Text fontSize="2xs" color="text.muted">
        ← → keys
      </Text>
    </Flex>
  )
}
