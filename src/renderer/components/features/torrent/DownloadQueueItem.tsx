import { Box, HStack, VStack, Text, IconButton, Icon, Badge } from '@chakra-ui/react'
import { FiPause, FiPlay, FiX } from 'react-icons/fi'
import { useDownloadQueueStore } from '@/store/downloadQueueStore'
import type { QueuedTorrent } from '@shared/types/torrent.types'

interface DownloadQueueItemProps {
  torrent: QueuedTorrent
}

const STATUS_COLOR: Record<string, string> = {
  queued: 'gray',
  downloading: 'blue',
  seeding: 'green',
  paused: 'yellow',
  completed: 'green',
  error: 'red',
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec === 0) return '0 B/s'
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  let speed = bytesPerSec
  let i = 0
  while (speed >= 1024 && i < units.length - 1) {
    speed /= 1024
    i++
  }
  return `${speed.toFixed(1)} ${units[i]}`
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let i = 0
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return `${size.toFixed(1)} ${units[i]}`
}

export function DownloadQueueItem({ torrent }: DownloadQueueItemProps): JSX.Element {
  const pauseTorrent = useDownloadQueueStore((s) => s.pauseTorrent)
  const resumeTorrent = useDownloadQueueStore((s) => s.resumeTorrent)
  const removeTorrent = useDownloadQueueStore((s) => s.removeTorrent)

  const canPause = torrent.status === 'downloading' || torrent.status === 'seeding'
  const canResume = torrent.status === 'paused' || torrent.status === 'error'
  const showProgress = torrent.status === 'downloading' || torrent.status === 'seeding' || torrent.status === 'paused'

  return (
    <Box
      p={4}
      borderRadius="md"
      bg="bg.elevated"
      borderWidth="1px"
      borderColor={torrent.status === 'error' ? 'red.500/50' : 'border.base'}
      transition="all 0.2s"
      _hover={{ borderColor: 'border.focus' }}
    >
      <VStack align="stretch" gap={2}>
        {/* Top row: name + status + actions */}
        <HStack justify="space-between" gap={4}>
          <VStack align="start" gap={1} flex="1" minW={0}>
            <Text fontSize="sm" fontWeight="medium" color="text.primary" lineClamp={1}>
              {torrent.name}
            </Text>
            <HStack gap={3} flexWrap="wrap">
              <Badge colorPalette={STATUS_COLOR[torrent.status]} variant="subtle" size="sm">
                {torrent.status}
              </Badge>
              {torrent.totalSize > 0 && (
                <Text fontSize="xs" color="text.muted">
                  {formatSize(torrent.downloaded)} / {formatSize(torrent.totalSize)}
                </Text>
              )}
              {torrent.status === 'downloading' && (
                <>
                  <Text fontSize="xs" color="green.500">
                    ↓ {formatSpeed(torrent.downloadSpeed)}
                  </Text>
                  <Text fontSize="xs" color="blue.500">
                    ↑ {formatSpeed(torrent.uploadSpeed)}
                  </Text>
                </>
              )}
              {torrent.status === 'seeding' && (
                <Text fontSize="xs" color="green.500">
                  ↑ {formatSpeed(torrent.uploadSpeed)}
                </Text>
              )}
              {torrent.seeders > 0 && (
                <Text fontSize="xs" color="text.muted">
                  {torrent.seeders} peers
                </Text>
              )}
            </HStack>
          </VStack>

          <HStack gap={1} flexShrink={0}>
            {canPause && (
              <IconButton
                aria-label="Pause"
                size="sm"
                variant="ghost"
                onClick={() => pauseTorrent(torrent.id)}
                title="Pause download"
              >
                <Icon as={FiPause} boxSize={4} />
              </IconButton>
            )}
            {canResume && (
              <IconButton
                aria-label="Resume"
                size="sm"
                variant="ghost"
                colorPalette="green"
                onClick={() => resumeTorrent(torrent.id)}
                title="Resume download"
              >
                <Icon as={FiPlay} boxSize={4} />
              </IconButton>
            )}
            <IconButton
              aria-label="Remove"
              size="sm"
              variant="ghost"
              colorPalette="red"
              onClick={() => removeTorrent(torrent.id)}
              title="Remove from queue"
            >
              <Icon as={FiX} boxSize={4} />
            </IconButton>
          </HStack>
        </HStack>

        {/* Progress bar */}
        {showProgress && (
          <Box>
            <Box h="6px" bg="bg.surface" borderRadius="full" overflow="hidden">
              <Box
                h="full"
                bg={torrent.status === 'paused' ? 'yellow.500' : 'interactive.base'}
                borderRadius="full"
                transition="width 0.5s ease"
                style={{ width: `${torrent.progress}%` }}
              />
            </Box>
            <Text fontSize="xs" color="text.muted" mt={1}>
              {torrent.progress}%
              {torrent.status === 'downloading' && torrent.downloadSpeed > 0 && torrent.totalSize > 0 && (
                <> — ETA {formatEta(torrent.totalSize - torrent.downloaded, torrent.downloadSpeed)}</>
              )}
            </Text>
          </Box>
        )}

        {/* Completed indicator */}
        {torrent.status === 'completed' && (
          <Text fontSize="xs" color="green.500">
            Download complete — {formatSize(torrent.totalSize)}
          </Text>
        )}

        {/* Error message */}
        {torrent.error && (
          <Text fontSize="xs" color="red.500">
            {torrent.error}
          </Text>
        )}
      </VStack>
    </Box>
  )
}

function formatEta(remainingBytes: number, speedBps: number): string {
  if (speedBps <= 0) return '∞'
  const seconds = Math.round(remainingBytes / speedBps)
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  const hours = Math.floor(seconds / 3600)
  const mins = Math.round((seconds % 3600) / 60)
  return `${hours}h ${mins}m`
}
