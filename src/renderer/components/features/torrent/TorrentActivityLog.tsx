import { Box, Text, VStack, HStack, Icon, Button } from '@chakra-ui/react'
import { FiActivity, FiInfo, FiCheckCircle, FiAlertCircle, FiAlertTriangle, FiTrash2 } from 'react-icons/fi'
import { useTorrentActivityLog, useTorrentActivityStore } from '@/store/torrentActivityStore'
import type { TorrentActivityLogEntry } from '@shared/types/torrent.types'

interface TorrentActivityLogProps {
  maxEntries?: number
}

export function TorrentActivityLog({ maxEntries = 20 }: TorrentActivityLogProps): JSX.Element {
  const log = useTorrentActivityLog()
  const clearLog = useTorrentActivityStore((state) => state.clearLog)
  const displayLog = log.slice(-maxEntries).reverse()

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
          <Icon as={FiActivity} boxSize={4} color="text.muted" />
          <Text fontSize="sm" fontWeight="medium" color="text.secondary">
            Activity Log
          </Text>
        </HStack>
        <HStack gap={2}>
          {log.length > maxEntries && (
            <Text fontSize="xs" color="text.muted">
              Last {maxEntries} of {log.length}
            </Text>
          )}
          {log.length > 0 && (
            <Button
              size="xs"
              variant="ghost"
              onClick={clearLog}
              color="text.muted"
              _hover={{ color: 'text.primary', bg: 'bg.hover' }}
            >
              <Icon as={FiTrash2} boxSize={3} mr={1} />
              Clear
            </Button>
          )}
        </HStack>
      </HStack>

      {log.length === 0 ? (
        <Box p={4} textAlign="center">
          <Text fontSize="sm" color="text.muted">
            No activity yet
          </Text>
          <Text fontSize="xs" color="text.muted" mt={1}>
            Download activity will appear here
          </Text>
        </Box>
      ) : (
        <VStack align="stretch" gap={1.5} maxH="300px" overflowY="auto">
          {displayLog.map((entry) => (
            <ActivityLogItem key={entry.id} entry={entry} />
          ))}
        </VStack>
      )}
    </Box>
  )
}

interface ActivityLogItemProps {
  entry: TorrentActivityLogEntry
}

function ActivityLogItem({ entry }: ActivityLogItemProps): JSX.Element {
  const getTypeIcon = () => {
    switch (entry.type) {
      case 'success': return FiCheckCircle
      case 'error': return FiAlertCircle
      case 'warning': return FiAlertTriangle
      default: return FiInfo
    }
  }

  const getTypeColor = () => {
    switch (entry.type) {
      case 'success': return 'green.500'
      case 'error': return 'red.500'
      case 'warning': return 'orange.500'
      default: return 'blue.500'
    }
  }

  const getTypeBg = () => {
    switch (entry.type) {
      case 'success': return 'green.500/10'
      case 'error': return 'red.500/10'
      case 'warning': return 'orange.500/10'
      default: return 'blue.500/10'
    }
  }

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  }

  return (
    <HStack
      p={2}
      borderRadius="sm"
      bg={getTypeBg()}
      borderWidth="1px"
      borderColor="border.base"
      align="start"
      gap={2}
    >
      <Icon
        as={getTypeIcon()}
        boxSize={3.5}
        color={getTypeColor()}
        flexShrink={0}
        mt={0.5}
      />
      <VStack align="start" gap={0} flex="1" minW={0}>
        <Text fontSize="xs" color="text.primary" wordBreak="break-word">
          {entry.message}
        </Text>
      </VStack>
      <Text fontSize="xs" color="text.muted" flexShrink={0}>
        {formatTime(entry.timestamp)}
      </Text>
    </HStack>
  )
}
