import { useEffect } from 'react'
import { Box, VStack, HStack, Text, Heading, Icon } from '@chakra-ui/react'
import { FiActivity } from 'react-icons/fi'
import {
  useDownloadQueueStore,
  useQueuedTorrents,
} from '@/store/downloadQueueStore'
import { useDownloadQueueListener } from '@/hooks/useDownloadQueueListener'
import { DownloadQueueItem } from './DownloadQueueItem'

export function DownloadQueue(): JSX.Element {
  const loadAll = useDownloadQueueStore((s) => s.loadAll)
  const isLoading = useDownloadQueueStore((s) => s.isLoading)
  const torrents = useQueuedTorrents()

  // Subscribe to progress and status change events
  useDownloadQueueListener()

  // Load queue on mount
  useEffect(() => {
    loadAll()
  }, [loadAll])

  const activeCount = torrents.filter(
    t => t.status === 'downloading' || t.status === 'queued'
  ).length

  return (
    <Box
      p={6}
      borderRadius="md"
      bg="bg.surface"
      borderWidth="1px"
      borderColor="border.base"
    >
      <HStack justify="space-between" mb={4}>
        <HStack gap={2}>
          <Icon as={FiActivity} boxSize={5} color="interactive.base" />
          <Heading size="md" color="text.primary">
            Download Queue
          </Heading>
          {activeCount > 0 && (
            <Text
              fontSize="xs"
              bg="green.500"
              color="white"
              px={2}
              py={0.5}
              borderRadius="full"
            >
              {activeCount} active
            </Text>
          )}
        </HStack>
      </HStack>

      {isLoading ? (
        <Box p={6} textAlign="center">
          <Text fontSize="sm" color="text.muted">
            Loading queue...
          </Text>
        </Box>
      ) : torrents.length === 0 ? (
        <Box p={6} textAlign="center">
          <Icon as={FiActivity} boxSize={10} color="text.muted" mb={3} />
          <Text fontSize="sm" color="text.muted">
            No active downloads
          </Text>
          <Text fontSize="xs" color="text.muted" mt={1}>
            Click &quot;Download&quot; on a collected torrent to start
          </Text>
        </Box>
      ) : (
        <VStack align="stretch" gap={3}>
          {torrents.map((torrent) => (
            <DownloadQueueItem key={torrent.id} torrent={torrent} />
          ))}
        </VStack>
      )}
    </Box>
  )
}
