import { memo, useCallback, useState } from 'react'
import { Table, Text, HStack, IconButton, Badge, Box } from '@chakra-ui/react'
import {
  FiExternalLink,
  FiChevronDown,
  FiChevronUp,
  FiDownload,
} from 'react-icons/fi'
import type { SearchResult } from '@shared/types/search.types'
import type { TorrentPageMetadata } from '@shared/types/torrentMetadata.types'
import type { PageContentScanResult } from '@shared/types/discography.types'
import { isFlacImage } from '@shared/utils/flacImageDetector'
import type { SearchTabType } from './SearchResultsTabs'
import {
  TorrentTrackListPreview,
  TorrentTrackListLoading,
  TorrentTrackListError,
} from './TorrentTrackListPreview'

interface SearchResultsRowProps {
  torrent: SearchResult
  onSelect?: (torrent: SearchResult) => void
  isDownloading?: boolean
  tabType?: SearchTabType
  scanResult?: PageContentScanResult
  isExpanded?: boolean
  onToggleExpand?: (id: string) => void
  highlightSongName?: string
  filterText?: string
}

/** Highlight matching filter text segments in a string */
function HighlightedText({
  text,
  highlight,
}: {
  text: string
  highlight?: string
}) {
  if (!highlight?.trim()) {
    return <>{text}</>
  }

  const lower = text.toLowerCase()
  const query = highlight.toLowerCase()
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let idx = lower.indexOf(query, lastIndex)

  while (idx !== -1) {
    if (idx > lastIndex) {
      parts.push(text.slice(lastIndex, idx))
    }
    parts.push(
      <Box key={idx} as="span" bg="yellow.500/30" borderRadius="sm" px={0.5}>
        {text.slice(idx, idx + query.length)}
      </Box>
    )
    lastIndex = idx + query.length
    idx = lower.indexOf(query, lastIndex)
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return <>{parts}</>
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

function getMatchBadgeText(scanResult?: PageContentScanResult): string | null {
  if (!scanResult?.albumFound) return null
  const firstMatch = scanResult.matchedAlbums[0]
  return firstMatch?.title ?? null
}

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen) + '\u2026' : text
}

export const SearchResultsRow = memo(function SearchResultsRow({
  torrent,
  onSelect,
  isDownloading,
  tabType,
  scanResult,
  isExpanded,
  onToggleExpand,
  highlightSongName,
  filterText,
}: SearchResultsRowProps) {
  const [previewState, setPreviewState] = useState<
    'idle' | 'loading' | 'loaded' | 'error'
  >('idle')
  const [metadata, setMetadata] = useState<TorrentPageMetadata | null>(null)
  const [previewError, setPreviewError] = useState('')

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

  const handleToggleExpand = useCallback(
    async (e?: React.MouseEvent) => {
      e?.stopPropagation()
      onToggleExpand?.(torrent.id)

      // Fetch metadata on first expansion
      if (!isExpanded && previewState === 'idle') {
        setPreviewState('loading')
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
      }
    },
    [torrent.id, torrent.url, isExpanded, previewState, onToggleExpand]
  )

  const handleRowClick = useCallback(() => {
    handleToggleExpand()
  }, [handleToggleExpand])

  const isDiscographyTab = tabType === 'discography'
  const matchText = isDiscographyTab ? getMatchBadgeText(scanResult) : null
  const showFlacImageBadge = !isDiscographyTab && isFlacImage(torrent)

  return (
    <>
      <Table.Row
        _hover={{ bg: 'bg.elevated' }}
        cursor="pointer"
        onClick={handleRowClick}
      >
        {/* Title */}
        <Table.Cell>
          <Text
            fontSize="sm"
            lineClamp={1}
            title={torrent.title}
            color="text.primary"
          >
            <HighlightedText text={torrent.title} highlight={filterText} />
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

        {/* Format (album tab) or Match (discography tab) */}
        <Table.Cell>
          {isDiscographyTab ? (
            matchText ? (
              <Badge
                size="sm"
                colorPalette="green"
                variant="subtle"
                title={matchText}
              >
                {'\u2705 '}
                {truncate(matchText, 15)}
              </Badge>
            ) : (
              <Text fontSize="sm" color="text.muted">
                —
              </Text>
            )
          ) : (
            <HStack gap={1}>
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
              {showFlacImageBadge && (
                <Badge
                  size="sm"
                  colorPalette="orange"
                  variant="subtle"
                  title="Single-file FLAC/APE image (CUE+FLAC). Needs splitting before adding to mix."
                >
                  IMG
                </Badge>
              )}
            </HStack>
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
              onClick={handleToggleExpand}
              title={isExpanded ? 'Hide tracks' : 'Preview tracks'}
            >
              {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
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

      {/* Expanded track list */}
      {isExpanded && (
        <Table.Row>
          <Table.Cell colSpan={6} py={2} px={4}>
            <Box pl={4}>
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
          </Table.Cell>
        </Table.Row>
      )}
    </>
  )
})
