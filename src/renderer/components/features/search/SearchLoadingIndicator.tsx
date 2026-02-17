import { useState, useEffect, useRef } from 'react'
import { Box, Flex, Text, Icon, VStack, HStack } from '@chakra-ui/react'
import { FiSearch } from 'react-icons/fi'
import { keyframes } from '@emotion/react'

const slideAnimation = keyframes`
  0% { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
`

const STATUS_MESSAGES = [
  'Connecting to search engine...',
  'Fetching search results...',
  'Scanning pages for matches...',
  'Analyzing results...',
  'Still working...',
]

const MESSAGE_ROTATE_INTERVAL = 4000

interface SearchLoadingIndicatorProps {
  message: string
  progress?: { currentPage: number; totalPages: number } | null
}

export const SearchLoadingIndicator: React.FC<SearchLoadingIndicatorProps> = ({ message, progress }) => {
  const hasProgress = progress && progress.totalPages > 0
  const percentage = hasProgress ? Math.round((progress.currentPage / progress.totalPages) * 100) : 0

  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [statusIndex, setStatusIndex] = useState(-1)
  const startTimeRef = useRef(Date.now())

  // Reset timer when component mounts (new search starts)
  useEffect(() => {
    startTimeRef.current = Date.now()
    setElapsedSeconds(0)
    setStatusIndex(-1)

    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
      setElapsedSeconds(elapsed)
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Rotate status messages when no real progress
  useEffect(() => {
    if (hasProgress) return

    const timer = setInterval(() => {
      setStatusIndex((prev) => {
        const next = prev + 1
        return next < STATUS_MESSAGES.length ? next : STATUS_MESSAGES.length - 1
      })
    }, MESSAGE_ROTATE_INTERVAL)

    return () => clearInterval(timer)
  }, [hasProgress])

  const formatElapsed = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  const displayMessage = hasProgress
    ? `Searching RuTracker (page ${progress.currentPage}/${progress.totalPages})...`
    : statusIndex >= 0
      ? STATUS_MESSAGES[statusIndex]
      : message

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
            {displayMessage}
          </Text>
          <HStack gap={2} flexShrink={0}>
            {hasProgress && (
              <Text fontSize="xs" fontFamily="monospace" color="text.muted">
                {percentage}%
              </Text>
            )}
            <Text fontSize="xs" fontFamily="monospace" color="text.muted">
              {formatElapsed(elapsedSeconds)}
            </Text>
          </HStack>
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
              h="4px"
              borderRadius="full"
              style={{ width: `${percentage}%`, transition: 'width 0.3s ease', background: '#3b82f6' }}
            />
          ) : (
            <Box
              position="absolute"
              top={0}
              left={0}
              h="4px"
              w="50%"
              borderRadius="full"
              css={{ animation: `${slideAnimation} 1.2s ease-in-out infinite`, background: '#3b82f6' }}
            />
          )}
        </Box>
      </VStack>
    </Box>
  )
}
