import { useEffect, useState } from 'react'
import { Box, VStack, HStack, Text, Button, Icon, Heading } from '@chakra-ui/react'
import { FiClock, FiTrash2, FiFolder, FiExternalLink } from 'react-icons/fi'
import type { TorrentFile } from '@shared/types/torrent.types'

export function DownloadManager(): JSX.Element {
  const [history, setHistory] = useState<TorrentFile[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadHistory = async () => {
    try {
      const response = await window.api.torrent.getHistory()
      if (response.success && response.data) {
        setHistory(response.data)
      }
    } catch (err) {
      console.error('Failed to load download history:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const clearHistory = async () => {
    try {
      await window.api.torrent.clearHistory()
      setHistory([])
    } catch (err) {
      console.error('Failed to clear history:', err)
    }
  }

  useEffect(() => {
    loadHistory()
  }, [])

  const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return d.toLocaleDateString()
  }

  const formatSize = (bytes?: number): string => {
    if (!bytes) return ''
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let size = bytes
    let unitIndex = 0
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`
  }

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
          <Icon as={FiClock} boxSize={5} color="interactive.base" />
          <Heading size="md" color="text.primary">
            Download History
          </Heading>
          {history.length > 0 && (
            <Text
              fontSize="xs"
              bg="text.muted"
              color="white"
              px={2}
              py={0.5}
              borderRadius="full"
            >
              {history.length}
            </Text>
          )}
        </HStack>
        {history.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            colorPalette="red"
            onClick={clearHistory}
          >
            <Icon as={FiTrash2} mr={2} />
            Clear History
          </Button>
        )}
      </HStack>

      {isLoading ? (
        <Box p={6} textAlign="center">
          <Text fontSize="sm" color="text.muted">
            Loading history...
          </Text>
        </Box>
      ) : history.length === 0 ? (
        <Box p={6} textAlign="center">
          <Icon as={FiClock} boxSize={10} color="text.muted" mb={3} />
          <Text fontSize="sm" color="text.muted">
            No download history
          </Text>
          <Text fontSize="xs" color="text.muted" mt={1}>
            Downloaded torrents will appear here
          </Text>
        </Box>
      ) : (
        <VStack align="stretch" gap={2}>
          {history.map((item, index) => (
            <DownloadHistoryItem key={`${item.id}-${index}`} item={item} formatDate={formatDate} formatSize={formatSize} />
          ))}
        </VStack>
      )}
    </Box>
  )
}

interface DownloadHistoryItemProps {
  item: TorrentFile
  formatDate: (date: Date | string) => string
  formatSize: (bytes?: number) => string
}

function DownloadHistoryItem({ item, formatDate, formatSize }: DownloadHistoryItemProps): JSX.Element {
  const handleOpenPage = async () => {
    try {
      await window.api.search.openUrl(item.pageUrl)
    } catch (err) {
      console.error('Failed to open URL:', err)
    }
  }

  return (
    <Box
      p={3}
      borderRadius="sm"
      bg="bg.elevated"
      borderWidth="1px"
      borderColor="border.base"
      _hover={{
        borderColor: 'border.focus',
      }}
    >
      <HStack justify="space-between" gap={4}>
        <VStack align="start" gap={1} flex="1" minW={0}>
          <Text fontSize="sm" fontWeight="medium" color="text.primary" lineClamp={1}>
            {item.title}
          </Text>
          <HStack gap={3} flexWrap="wrap">
            {item.size && (
              <Text fontSize="xs" color="text.muted">
                {formatSize(item.size)}
              </Text>
            )}
            {item.metadata?.seeders !== undefined && (
              <Text fontSize="xs" color="green.500">
                ↑ {item.metadata.seeders}
              </Text>
            )}
            <Text fontSize="xs" color="text.muted">
              {formatDate(item.downloadedAt)}
            </Text>
            {item.magnetLink && (
              <HStack gap={1}>
                <Icon as={FiFolder} boxSize={3} color="blue.500" />
                <Text fontSize="xs" color="blue.500">
                  Magnet
                </Text>
              </HStack>
            )}
            {item.filePath && (
              <HStack gap={1}>
                <Icon as={FiFolder} boxSize={3} color="green.500" />
                <Text fontSize="xs" color="green.500">
                  File
                </Text>
              </HStack>
            )}
          </HStack>
        </VStack>

        <Button
          size="xs"
          variant="ghost"
          onClick={handleOpenPage}
          title="Open torrent page"
        >
          <Icon as={FiExternalLink} boxSize={4} />
        </Button>
      </HStack>
    </Box>
  )
}
