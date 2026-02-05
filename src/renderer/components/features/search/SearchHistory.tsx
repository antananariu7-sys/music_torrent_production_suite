import { Box, Text, VStack, HStack, Icon, IconButton } from '@chakra-ui/react'
import { FiClock, FiCheckCircle, FiXCircle, FiX, FiTrash2 } from 'react-icons/fi'
import { useSearchHistory, useSmartSearchStore } from '@/store/smartSearchStore'
import type { SearchHistoryEntry } from '@/store/smartSearchStore'

interface SearchHistoryProps {
  onSelectQuery?: (query: string) => void
  maxEntries?: number
}

export const SearchHistory: React.FC<SearchHistoryProps> = ({
  onSelectQuery,
  maxEntries = 5
}) => {
  const searchHistory = useSearchHistory()
  const displayHistory = searchHistory.slice(0, maxEntries)

  return (
    <Box
      p={4}
      borderRadius="md"
      bg="bg.surface"
      borderWidth="1px"
      borderColor="border.base"
    >
      <HStack justify="space-between" mb={3}>
        <HStack gap={2}>
          <Icon as={FiClock} boxSize={4} color="text.muted" />
          <Text fontSize="sm" fontWeight="medium" color="text.secondary">
            Recent Searches
          </Text>
        </HStack>
        {searchHistory.length > maxEntries && (
          <Text fontSize="xs" color="text.muted">
            Showing {maxEntries} of {searchHistory.length}
          </Text>
        )}
      </HStack>

      {searchHistory.length === 0 ? (
        <Box p={4} textAlign="center">
          <Text fontSize="sm" color="text.muted">
            No search history yet
          </Text>
          <Text fontSize="xs" color="text.muted" mt={1}>
            Your searches will appear here
          </Text>
        </Box>
      ) : (
        <VStack align="stretch" gap={2}>
          {displayHistory.map((entry) => (
            <SearchHistoryItem
              key={entry.id}
              entry={entry}
              onSelectQuery={onSelectQuery}
            />
          ))}
        </VStack>
      )}
    </Box>
  )
}

interface SearchHistoryItemProps {
  entry: SearchHistoryEntry
  onSelectQuery?: (query: string) => void
}

const SearchHistoryItem: React.FC<SearchHistoryItemProps> = ({ entry, onSelectQuery }) => {
  const removeFromHistory = useSmartSearchStore((state) => state.removeFromHistory)

  const formatTimestamp = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - new Date(date).getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return new Date(date).toLocaleDateString()
  }

  const getStatusIcon = () => {
    switch (entry.status) {
      case 'completed':
        return FiCheckCircle
      case 'error':
        return FiXCircle
      case 'cancelled':
        return FiX
      default:
        return FiClock
    }
  }

  const getStatusColor = () => {
    switch (entry.status) {
      case 'completed':
        return 'green.500'
      case 'error':
        return 'red.500'
      case 'cancelled':
        return 'orange.500'
      default:
        return 'text.muted'
    }
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering the onSelectQuery
    removeFromHistory(entry.id)
  }

  const handleClick = () => {
    if (onSelectQuery) {
      onSelectQuery(entry.query)
    }
  }

  return (
    <Box
      p={3}
      borderRadius="sm"
      bg="bg.elevated"
      borderWidth="1px"
      borderColor="border.base"
      transition="all 0.2s"
      position="relative"
      _hover={{
        borderColor: 'border.focus',
        bg: 'bg.hover',
      }}
    >
      <HStack justify="space-between" align="start" gap={2}>
        <VStack
          align="start"
          gap={1}
          flex="1"
          cursor={onSelectQuery ? 'pointer' : 'default'}
          onClick={handleClick}
        >
          <Text fontSize="sm" fontWeight="medium" color="text.primary">
            {entry.query}
          </Text>
          {entry.result && (
            <Text fontSize="xs" color="text.muted">
              {entry.result}
            </Text>
          )}
        </VStack>

        <VStack align="end" gap={1} flexShrink={0}>
          <HStack gap={1}>
            <Icon
              as={getStatusIcon()}
              boxSize={3.5}
              color={getStatusColor()}
            />
            <IconButton
              aria-label="Delete search history entry"
              size="xs"
              variant="ghost"
              onClick={handleDelete}
              color="text.muted"
              _hover={{ bg: 'red.500/10', color: 'red.500' }}
            >
              <Icon as={FiTrash2} boxSize={3} />
            </IconButton>
          </HStack>
          <Text fontSize="xs" color="text.muted">
            {formatTimestamp(entry.timestamp)}
          </Text>
        </VStack>
      </HStack>
    </Box>
  )
}
