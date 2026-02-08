import { useState } from 'react'
import { Box, HStack, VStack, Text, Button, Icon, IconButton } from '@chakra-ui/react'
import { FiDownload, FiCopy, FiTrash2, FiCheck, FiExternalLink } from 'react-icons/fi'
import { useTorrentCollectionStore } from '@/store/torrentCollectionStore'
import { toaster } from '@/components/ui/toaster'
import type { CollectedTorrent } from '@shared/types/torrent.types'

interface CollectedTorrentItemProps {
  torrent: CollectedTorrent
}

export function CollectedTorrentItem({ torrent }: CollectedTorrentItemProps): JSX.Element {
  const removeFromCollection = useTorrentCollectionStore((state) => state.removeFromCollection)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

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

  const formatDate = (isoDate: string): string => {
    const date = new Date(isoDate)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  const handleCopyMagnet = async () => {
    if (!torrent.magnetLink) return

    try {
      await navigator.clipboard.writeText(torrent.magnetLink)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)

      toaster.create({
        title: 'Magnet link copied',
        description: 'Open in your torrent client to start downloading.',
        type: 'success',
        duration: 3000,
      })
    } catch (err) {
      console.error('Failed to copy magnet link:', err)
      toaster.create({
        title: 'Failed to copy',
        description: 'Could not copy magnet link to clipboard.',
        type: 'error',
        duration: 3000,
      })
    }
  }

  const handleDownload = async () => {
    setIsDownloading(true)
    setDownloadError(null)

    try {
      let magnetUri = torrent.magnetLink

      // If no magnet link, extract it via the existing Puppeteer service
      if (!magnetUri) {
        const extractResponse = await window.api.torrent.download({
          torrentId: torrent.torrentId,
          pageUrl: torrent.pageUrl,
          title: torrent.title,
        })

        if (!extractResponse.success || !extractResponse.torrent?.magnetLink) {
          throw new Error(extractResponse.error || 'Could not extract magnet link')
        }
        magnetUri = extractResponse.torrent.magnetLink
      }

      // Get download path from torrent settings
      const settingsResponse = await window.api.torrent.getSettings()
      const downloadPath = settingsResponse.data?.torrentsFolder || ''

      if (!downloadPath) {
        throw new Error('Download directory not set. Please configure it in Settings.')
      }

      // Add to WebTorrent download queue
      const result = await window.api.webtorrent.add({
        magnetUri,
        projectId: torrent.projectId,
        name: torrent.title,
        downloadPath,
        fromCollectedTorrentId: torrent.id,
      })

      if (result.success) {
        toaster.create({
          title: 'Added to download queue',
          description: torrent.title,
          type: 'success',
          duration: 5000,
        })
      } else {
        throw new Error(result.error || 'Failed to add to queue')
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Download failed'
      setDownloadError(errorMsg)

      toaster.create({
        title: 'Download failed',
        description: errorMsg,
        type: 'error',
        duration: 5000,
      })
    } finally {
      setIsDownloading(false)
    }
  }

  const handleRemove = () => {
    removeFromCollection(torrent.id)

    toaster.create({
      title: 'Removed from collection',
      description: torrent.title,
      type: 'info',
      duration: 3000,
    })
  }

  const handleOpenPage = async () => {
    try {
      await window.api.search.openUrl(torrent.pageUrl)
    } catch (err) {
      console.error('Failed to open URL:', err)
    }
  }

  return (
    <Box
      p={4}
      borderRadius="md"
      bg="bg.elevated"
      borderWidth="1px"
      borderColor={downloadError ? 'red.500/50' : 'border.base'}
      transition="all 0.2s"
      _hover={{
        borderColor: downloadError ? 'red.500' : 'border.focus',
      }}
    >
      <HStack justify="space-between" align="start" gap={4}>
        {/* Torrent Info */}
        <VStack align="start" gap={2} flex="1" minW={0}>
          <Text fontSize="sm" fontWeight="medium" color="text.primary" lineClamp={2}>
            {torrent.title}
          </Text>

          <HStack gap={3} flexWrap="wrap">
            {torrent.metadata?.size && (
              <Text fontSize="xs" color="text.muted">
                {torrent.metadata.sizeBytes
                  ? formatSize(torrent.metadata.sizeBytes)
                  : torrent.metadata.size}
              </Text>
            )}
            {torrent.metadata?.seeders !== undefined && (
              <Text fontSize="xs" color="green.500">
                ↑ {torrent.metadata.seeders}
              </Text>
            )}
            {torrent.metadata?.leechers !== undefined && (
              <Text fontSize="xs" color="orange.500">
                ↓ {torrent.metadata.leechers}
              </Text>
            )}
            <Text fontSize="xs" color="text.muted">
              Added {formatDate(torrent.addedAt)}
            </Text>
          </HStack>

          {downloadError && (
            <Text fontSize="xs" color="red.500">
              {downloadError}
            </Text>
          )}
        </VStack>

        {/* Actions */}
        <HStack gap={2} flexShrink={0}>
          <IconButton
            aria-label="Open torrent page"
            size="sm"
            variant="ghost"
            onClick={handleOpenPage}
            title="Open torrent page"
          >
            <Icon as={FiExternalLink} boxSize={4} />
          </IconButton>

          <IconButton
            aria-label="Copy magnet link"
            size="sm"
            variant="ghost"
            onClick={handleCopyMagnet}
            disabled={!torrent.magnetLink}
            title={torrent.magnetLink ? 'Copy magnet link' : 'Magnet link unavailable'}
          >
            <Icon as={isCopied ? FiCheck : FiCopy} boxSize={4} color={isCopied ? 'green.500' : undefined} />
          </IconButton>

          <Button
            size="sm"
            colorPalette="blue"
            onClick={handleDownload}
            disabled={isDownloading}
          >
            <Icon as={FiDownload} mr={2} />
            {isDownloading ? 'Downloading...' : 'Download'}
          </Button>

          <IconButton
            aria-label="Remove from collection"
            size="sm"
            variant="ghost"
            colorPalette="red"
            onClick={handleRemove}
            title="Remove from collection"
          >
            <Icon as={FiTrash2} boxSize={4} />
          </IconButton>
        </HStack>
      </HStack>
    </Box>
  )
}
