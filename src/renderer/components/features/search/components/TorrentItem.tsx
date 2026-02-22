import { useState, useCallback, memo } from 'react'
import { Box, VStack, Text, Button, HStack, Icon } from '@chakra-ui/react'
import { FiDownload, FiChevronUp, FiList, FiHardDrive } from 'react-icons/fi'
import type { SearchResult } from '@shared/types/search.types'
import type { TorrentPageMetadata } from '@shared/types/torrentMetadata.types'
import type { PageContentScanResult } from '@shared/types/discography.types'
import { AlbumFoundBadge } from '../DiscographyScanPanel'
import {
  TorrentTrackListPreview,
  TorrentTrackListLoading,
  TorrentTrackListError,
} from '../TorrentTrackListPreview'

interface TorrentItemProps {
  torrent: SearchResult
  onSelect?: (torrent: SearchResult) => void
  isDownloading?: boolean
  scanResult?: PageContentScanResult
  highlightSongName?: string
}

export const TorrentItem = memo(function TorrentItem({
  torrent,
  onSelect,
  isDownloading,
  scanResult,
  highlightSongName,
}: TorrentItemProps) {
  const [previewState, setPreviewState] = useState<
    'idle' | 'loading' | 'loaded' | 'error'
  >('idle')
  const [metadata, setMetadata] = useState<TorrentPageMetadata | null>(null)
  const [previewError, setPreviewError] = useState<string>('')
  const [isExpanded, setIsExpanded] = useState(false)

  const formatSize = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024)
    const mb = bytes / (1024 * 1024)
    return gb >= 1 ? `${gb.toFixed(2)} GB` : `${mb.toFixed(0)} MB`
  }

  const displaySize = (() => {
    if (torrent.sizeBytes) return formatSize(torrent.sizeBytes)
    const parsed = Number(torrent.size)
    if (!isNaN(parsed) && parsed > 0) return formatSize(parsed)
    return torrent.size
  })()

  const handlePreviewClick = useCallback(async () => {
    if (previewState === 'loaded') {
      setIsExpanded(!isExpanded)
      return
    }

    setPreviewState('loading')
    setIsExpanded(true)

    try {
      const response = await window.api.torrentMetadata.parse({
        torrentUrl: torrent.url,
        torrentId: torrent.id,
      })
      if (response.success && response.metadata) {
        setMetadata(response.metadata)
        setPreviewState('loaded')
      } else {
        setPreviewError(response.error || 'Unknown error')
        setPreviewState('error')
      }
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to load')
      setPreviewState('error')
    }
  }, [torrent.url, torrent.id, previewState, isExpanded])

  return (
    <Box
      borderRadius="sm"
      bg="bg.elevated"
      borderWidth="1px"
      borderColor="border.base"
      transition="all 0.2s"
      _hover={!isDownloading ? { borderColor: 'border.focus' } : {}}
    >
      {/* Main info row */}
      <VStack align="stretch" gap={0} p={3}>
        <HStack align="start">
          <Icon
            as={FiDownload}
            boxSize={5}
            color="interactive.base"
            flexShrink={0}
            mt={0.5}
          />
          <VStack align="start" gap={1} flex="1" minW={0}>
            <Text
              fontSize="sm"
              fontWeight="medium"
              color="text.primary"
              lineClamp={2}
            >
              {torrent.title}
            </Text>
            <HStack gap={3} flexWrap="wrap">
              {scanResult && <AlbumFoundBadge scanResult={scanResult} />}
              {torrent.searchSource === 'discography' && !scanResult && (
                <Text
                  fontSize="xs"
                  color="purple.300"
                  bg="purple.500/20"
                  px={2}
                  py={0.5}
                  borderRadius="sm"
                  fontWeight="medium"
                >
                  From discography
                </Text>
              )}
              {torrent.size && (
                <HStack
                  gap={1}
                  bg="bg.surface"
                  px={2}
                  py={0.5}
                  borderRadius="sm"
                >
                  <Icon as={FiHardDrive} boxSize={3} color="text.secondary" />
                  <Text
                    fontSize="xs"
                    fontWeight="medium"
                    color="text.secondary"
                  >
                    {displaySize}
                  </Text>
                </HStack>
              )}
              {torrent.seeders !== undefined && (
                <Text fontSize="xs" color="green.500">
                  ↑ {torrent.seeders}
                </Text>
              )}
              {torrent.leechers !== undefined && (
                <Text fontSize="xs" color="text.muted">
                  ↓ {torrent.leechers}
                </Text>
              )}
              {torrent.category && (
                <Text
                  fontSize="xs"
                  color="text.muted"
                  px={2}
                  py={0.5}
                  bg="bg.surface"
                  borderRadius="sm"
                >
                  {torrent.category}
                </Text>
              )}
            </HStack>
          </VStack>
        </HStack>

        {/* Action buttons row */}
        <HStack gap={2} mt={2} pl={7}>
          <Button
            size="xs"
            variant="outline"
            onClick={handlePreviewClick}
            loading={previewState === 'loading'}
          >
            <Icon
              as={
                isExpanded && previewState === 'loaded' ? FiChevronUp : FiList
              }
              boxSize={3}
            />
            {previewState === 'loaded'
              ? isExpanded
                ? 'Hide tracks'
                : 'Show tracks'
              : 'Preview tracks'}
          </Button>
          <Button
            size="xs"
            variant="solid"
            colorPalette="blue"
            onClick={() => !isDownloading && onSelect?.(torrent)}
            disabled={isDownloading}
          >
            <Icon as={FiDownload} boxSize={3} />
            Download
          </Button>
        </HStack>
      </VStack>

      {/* Expandable track list preview */}
      {isExpanded && (
        <Box px={3} pb={3} pl={10}>
          {previewState === 'loading' && <TorrentTrackListLoading />}
          {previewState === 'error' && (
            <TorrentTrackListError error={previewError} />
          )}
          {previewState === 'loaded' && metadata && (
            <TorrentTrackListPreview
              metadata={metadata}
              highlightSongName={highlightSongName}
            />
          )}
        </Box>
      )}
    </Box>
  )
})
