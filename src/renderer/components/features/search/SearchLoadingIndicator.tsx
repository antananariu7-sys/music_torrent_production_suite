import { Box, Flex, Text, Icon, VStack } from '@chakra-ui/react'
import { FiSearch } from 'react-icons/fi'
import { keyframes } from '@emotion/react'

const slideAnimation = keyframes`
  0% { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
`

interface SearchLoadingIndicatorProps {
  message: string
  progress?: { currentPage: number; totalPages: number } | null
}

export const SearchLoadingIndicator: React.FC<SearchLoadingIndicatorProps> = ({ message, progress }) => {
  const hasProgress = progress && progress.totalPages > 0
  const percentage = hasProgress ? Math.round((progress.currentPage / progress.totalPages) * 100) : 0

  return (
    <Box
      p={4}
      borderRadius="md"
      bg="bg.surface"
      borderWidth="1px"
      borderColor="border.focus"
    >
      <VStack align="stretch" gap={3}>
        <Flex align="center" gap={3}>
          <Icon as={FiSearch} boxSize={5} color="interactive.base" />
          <Text fontSize="sm" fontWeight="medium" color="text.primary" flex={1}>
            {hasProgress
              ? `Searching RuTracker (page ${progress.currentPage}/${progress.totalPages})...`
              : message}
          </Text>
          {hasProgress && (
            <Text fontSize="xs" fontFamily="monospace" color="text.muted" flexShrink={0}>
              {percentage}%
            </Text>
          )}
        </Flex>
        <Box
          position="relative"
          h="4px"
          bg="bg.elevated"
          borderRadius="full"
          overflow="hidden"
        >
          {hasProgress ? (
            <Box
              position="absolute"
              top={0}
              left={0}
              h="full"
              w={`${percentage}%`}
              bg="interactive.base"
              borderRadius="full"
              transition="width 0.3s ease"
            />
          ) : (
            <Box
              position="absolute"
              top={0}
              left={0}
              h="full"
              w="50%"
              bg="interactive.base"
              borderRadius="full"
              css={{ animation: `${slideAnimation} 1.2s ease-in-out infinite` }}
            />
          )}
        </Box>
      </VStack>
    </Box>
  )
}
