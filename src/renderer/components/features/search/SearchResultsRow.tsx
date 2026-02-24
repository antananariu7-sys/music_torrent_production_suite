import { memo, useCallback } from 'react'
import { Table, Text, HStack, IconButton, Badge } from '@chakra-ui/react'
import { FiExternalLink, FiChevronDown, FiDownload } from 'react-icons/fi'
import type { SearchResult } from '@shared/types/search.types'

interface SearchResultsRowProps {
  torrent: SearchResult
  onSelect?: (torrent: SearchResult) => void
  isDownloading?: boolean
}

function formatSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024)
  const mb = bytes / (1024 * 1024)
  return gb >= 1 ? `${gb.toFixed(2)} GB` : `${mb.toFixed(0)} MB`
}

function getDisplaySize(torrent: SearchResult): string {
  if (torrent.sizeBytes) return formatSize(torrent.sizeBytes)
  const parsed = Number(torrent.size)
  if (!isNaN(parsed) && parsed > 0) return formatSize(parsed)
  return torrent.size
}

function getFormatBadgeColor(format?: string): string {
  switch (format?.toLowerCase()) {
    case 'flac':
    case 'alac':
    case 'ape':
      return 'green'
    case 'mp3':
      return 'blue'
    case 'wav':
      return 'purple'
    default:
      return 'gray'
  }
}

function getRelevanceColor(score?: number): string {
  if (!score && score !== 0) return 'gray'
  if (score > 70) return 'green'
  if (score >= 40) return 'yellow'
  return 'red'
}

export const SearchResultsRow = memo(function SearchResultsRow({
  torrent,
  onSelect,
  isDownloading,
}: SearchResultsRowProps) {
  const handleOpenPage = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      window.api.search.openUrl(torrent.url)
    },
    [torrent.url]
  )

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (!isDownloading) onSelect?.(torrent)
    },
    [isDownloading, onSelect, torrent]
  )

  return (
    <Table.Row _hover={{ bg: 'bg.elevated' }} cursor="pointer">
      {/* Title */}
      <Table.Cell>
        <Text
          fontSize="sm"
          lineClamp={1}
          title={torrent.title}
          color="text.primary"
        >
          {torrent.title}
        </Text>
      </Table.Cell>

      {/* Size */}
      <Table.Cell>
        <Text fontSize="sm" color="text.secondary" whiteSpace="nowrap">
          {getDisplaySize(torrent)}
        </Text>
      </Table.Cell>

      {/* S/L */}
      <Table.Cell>
        <HStack gap={1}>
          <Text fontSize="sm" color="green.400">
            {torrent.seeders}↑
          </Text>
          <Text fontSize="sm" color="text.muted">
            /
          </Text>
          <Text fontSize="sm" color="text.muted">
            {torrent.leechers}↓
          </Text>
        </HStack>
      </Table.Cell>

      {/* Relevance */}
      <Table.Cell>
        {torrent.relevanceScore != null ? (
          <Badge
            size="sm"
            colorPalette={getRelevanceColor(torrent.relevanceScore)}
            variant="subtle"
          >
            {torrent.relevanceScore}%
          </Badge>
        ) : (
          <Text fontSize="sm" color="text.muted">
            —
          </Text>
        )}
      </Table.Cell>

      {/* Format */}
      <Table.Cell>
        {torrent.format ? (
          <Badge
            size="sm"
            colorPalette={getFormatBadgeColor(torrent.format)}
            variant="subtle"
          >
            {torrent.format.toUpperCase()}
          </Badge>
        ) : (
          <Text fontSize="sm" color="text.muted">
            —
          </Text>
        )}
      </Table.Cell>

      {/* Actions */}
      <Table.Cell>
        <HStack gap={1}>
          <IconButton
            aria-label="Open page"
            size="xs"
            variant="ghost"
            onClick={handleOpenPage}
            title="Open RuTracker page"
          >
            <FiExternalLink />
          </IconButton>
          <IconButton
            aria-label="Preview tracks"
            size="xs"
            variant="ghost"
            disabled
            title="Preview tracks (coming soon)"
          >
            <FiChevronDown />
          </IconButton>
          <IconButton
            aria-label="Download"
            size="xs"
            variant="ghost"
            onClick={handleDownload}
            disabled={isDownloading}
            title="Add to collection"
          >
            <FiDownload />
          </IconButton>
        </HStack>
      </Table.Cell>
    </Table.Row>
  )
})
