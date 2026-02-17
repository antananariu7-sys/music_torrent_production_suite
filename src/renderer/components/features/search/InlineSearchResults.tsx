import { useState, useMemo, useCallback } from 'react'
import { Box, VStack, Text, Button, HStack, Icon, Heading, Grid, Image } from '@chakra-ui/react'
import { FiMusic, FiDisc, FiUser, FiDownload, FiChevronRight, FiChevronDown, FiChevronUp, FiInfo, FiList } from 'react-icons/fi'
import type { SearchClassificationResult, MusicBrainzAlbum } from '@shared/types/musicbrainz.types'
import type { SearchResult, ResultGroup } from '@shared/types/search.types'
import type { TorrentPageMetadata } from '@shared/types/torrentMetadata.types'
import { isLikelyDiscography, groupResults } from '@shared/utils/resultClassifier'
import type { DiscographySearchProgress, PageContentScanResult } from '@shared/types/discography.types'
import { DiscographyScanPanel, AlbumFoundBadge } from './DiscographyScanPanel'
import { TorrentTrackListPreview, TorrentTrackListLoading, TorrentTrackListError } from './TorrentTrackListPreview'

interface InlineSearchResultsProps {
  step: 'classification' | 'albums' | 'torrents'

  // Classification step
  classificationResults?: SearchClassificationResult[]
  onSelectClassification?: (result: SearchClassificationResult) => void

  // Albums step
  albums?: MusicBrainzAlbum[]
  onSelectAlbum?: (album: MusicBrainzAlbum) => void
  onSelectDiscography?: () => void
  selectedClassification?: SearchClassificationResult | null

  // Torrents step
  torrents?: SearchResult[]
  onSelectTorrent?: (torrent: SearchResult) => void
  isDownloading?: boolean

  // Discography scan props
  selectedAlbum?: MusicBrainzAlbum | null
  isScannningDiscography?: boolean
  discographyScanProgress?: DiscographySearchProgress | null
  discographyScanResults?: PageContentScanResult[]
  onStartDiscographyScan?: () => void
  onStopDiscographyScan?: () => void

  onCancel?: () => void
}

export const InlineSearchResults: React.FC<InlineSearchResultsProps> = ({
  step,
  classificationResults = [],
  onSelectClassification,
  albums = [],
  onSelectAlbum,
  onSelectDiscography,
  selectedClassification,
  torrents = [],
  onSelectTorrent,
  isDownloading = false,
  selectedAlbum,
  isScannningDiscography = false,
  discographyScanProgress = null,
  discographyScanResults = [],
  onStartDiscographyScan,
  onStopDiscographyScan,
  onCancel,
}) => {
  // Identify discography/collection pages from torrents
  const discographyTorrents = useMemo(() => {
    return torrents.filter((t) => isLikelyDiscography(t.title))
  }, [torrents])

  // Create a map of scan results by torrent ID
  const scanResultsMap = useMemo(() => {
    const map = new Map<string, PageContentScanResult>()
    discographyScanResults.forEach((r) => {
      map.set(r.searchResult.id, r)
    })
    return map
  }, [discographyScanResults])

  // Check if all results are from discography (no direct album results)
  const isDiscographyOnly = useMemo(() => {
    return torrents.length > 0 && torrents.every(t => t.searchSource === 'discography')
  }, [torrents])

  // Sort torrents: matched first, then by seeders
  const sortedTorrents = useMemo(() => {
    if (discographyScanResults.length === 0) return torrents

    return [...torrents].sort((a, b) => {
      const aResult = scanResultsMap.get(a.id)
      const bResult = scanResultsMap.get(b.id)

      // Matched albums come first
      if (aResult?.albumFound && !bResult?.albumFound) return -1
      if (!aResult?.albumFound && bResult?.albumFound) return 1

      // Then by seeders
      return b.seeders - a.seeders
    })
  }, [torrents, discographyScanResults, scanResultsMap])

  // Group results by category (only when enough results to make grouping useful)
  const grouped = useMemo(() => {
    if (sortedTorrents.length < 5) return null
    const groups = groupResults(sortedTorrents)
    // Only show groups if there's more than one non-empty category
    const nonEmpty = Object.values(groups).filter(g => g.length > 0)
    return nonEmpty.length > 1 ? groups : null
  }, [sortedTorrents])
  // Derive song name for track highlighting (only during song search flow)
  const searchedSongName = selectedClassification?.type === 'song'
    ? selectedClassification.name
    : undefined

  return (
    <Box
      p={4}
      borderRadius="md"
      bg="bg.surface"
      borderWidth="1px"
      borderColor="border.focus"
    >
      {/* Classification Results */}
      {step === 'classification' && (
        <VStack align="stretch" gap={3}>
          <HStack justify="space-between">
            <Heading size="sm" color="text.primary">
              What are you searching for?
            </Heading>
            {onCancel && (
              <Button size="sm" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </HStack>

          <VStack align="stretch" gap={2}>
            {classificationResults.map((result, index) => (
              <ClassificationItem
                key={`${result.name}-${result.type}-${index}`}
                result={result}
                onSelect={onSelectClassification}
              />
            ))}
          </VStack>
        </VStack>
      )}

      {/* Album Selection */}
      {step === 'albums' && (
        <VStack align="stretch" gap={3}>
          <HStack justify="space-between">
            <Heading size="sm" color="text.primary">
              {selectedClassification?.type === 'artist'
                ? `Albums by ${selectedClassification.artist || selectedClassification.name}`
                : selectedClassification?.type === 'song'
                  ? `Albums containing "${selectedClassification.name}"`
                  : 'Select an Album'}
            </Heading>
            {onCancel && (
              <Button size="sm" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </HStack>

          {selectedClassification?.type === 'artist' && onSelectDiscography && (
            <Button
              size="sm"
              variant="outline"
              onClick={onSelectDiscography}
            >
              <Icon as={FiUser} mr={2} />
              Search Full Discography
            </Button>
          )}

          <Grid
            templateColumns="repeat(auto-fill, minmax(250px, 1fr))"
            gap={3}
            maxH="400px"
            overflowY="auto"
          >
            {albums.map((album) => (
              <AlbumItem
                key={album.id}
                album={album}
                onSelect={onSelectAlbum}
              />
            ))}
          </Grid>
        </VStack>
      )}

      {/* Torrent Results */}
      {step === 'torrents' && (
        <VStack align="stretch" gap={3}>
          <HStack justify="space-between">
            <Heading size="sm" color="text.primary">
              Select a Torrent
            </Heading>
            {onCancel && (
              <Button size="sm" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </HStack>

          {/* No direct results notice */}
          {isDiscographyOnly && (
            <HStack
              p={3}
              borderRadius="sm"
              bg="yellow.500/10"
              borderWidth="1px"
              borderColor="yellow.500/30"
              gap={2}
            >
              <Icon as={FiInfo} boxSize={4} color="yellow.500" flexShrink={0} />
              <Text fontSize="sm" color="yellow.500">
                No direct results for {selectedAlbum ? `"${selectedAlbum.title}"` : 'this album'}.
                Showing results from artist discography — your album may be inside these torrents.
              </Text>
            </HStack>
          )}

          {/* Discography Scan Panel */}
          {discographyTorrents.length > 0 && onStartDiscographyScan && onStopDiscographyScan && (
            <DiscographyScanPanel
              isScanning={isScannningDiscography}
              progress={discographyScanProgress}
              scanResults={discographyScanResults}
              discographyTorrents={discographyTorrents}
              albumName={selectedAlbum?.title}
              onStartScan={onStartDiscographyScan}
              onStopScan={onStopDiscographyScan}
            />
          )}

          <VStack align="stretch" gap={2} maxH="500px" overflowY="auto">
            {grouped ? (
              // Grouped display
              <GroupedTorrentList
                grouped={grouped}
                onSelectTorrent={onSelectTorrent}
                isDownloading={isDownloading}
                scanResultsMap={scanResultsMap}
                highlightSongName={searchedSongName}
              />
            ) : (
              // Flat list (few results or single category)
              sortedTorrents.map((torrent) => (
                <TorrentItem
                  key={torrent.id}
                  torrent={torrent}
                  onSelect={onSelectTorrent}
                  isDownloading={isDownloading}
                  scanResult={scanResultsMap.get(torrent.id)}
                  highlightSongName={searchedSongName}
                />
              ))
            )}
          </VStack>
        </VStack>
      )}
    </Box>
  )
}

// Group labels and icons for each category
const GROUP_CONFIG: Record<ResultGroup, { label: string; icon: typeof FiDisc; color: string }> = {
  studio: { label: 'Studio Albums', icon: FiDisc, color: 'blue.400' },
  live: { label: 'Live / Concerts', icon: FiMusic, color: 'orange.400' },
  compilation: { label: 'Compilations', icon: FiList, color: 'purple.400' },
  discography: { label: 'Discography', icon: FiDisc, color: 'green.400' },
  other: { label: 'Other', icon: FiMusic, color: 'text.muted' },
}

// Display order for groups
const GROUP_ORDER: ResultGroup[] = ['studio', 'discography', 'live', 'compilation', 'other']

// Grouped Torrent List Component
interface GroupedTorrentListProps {
  grouped: ReturnType<typeof groupResults>
  onSelectTorrent?: (torrent: SearchResult) => void
  isDownloading?: boolean
  scanResultsMap: Map<string, PageContentScanResult>
  highlightSongName?: string
}

const GroupedTorrentList: React.FC<GroupedTorrentListProps> = ({
  grouped,
  onSelectTorrent,
  isDownloading,
  scanResultsMap,
  highlightSongName,
}) => {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<ResultGroup>>(new Set())

  const toggleGroup = (group: ResultGroup) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(group)) {
        next.delete(group)
      } else {
        next.add(group)
      }
      return next
    })
  }

  return (
    <>
      {GROUP_ORDER.map(group => {
        const items = grouped[group]
        if (items.length === 0) return null

        const config = GROUP_CONFIG[group]
        const isCollapsed = collapsedGroups.has(group)

        return (
          <VStack key={group} align="stretch" gap={1}>
            <HStack
              gap={2}
              py={1}
              cursor="pointer"
              onClick={() => toggleGroup(group)}
              _hover={{ color: 'text.primary' }}
              color="text.muted"
              transition="color 0.15s"
            >
              <Icon
                as={isCollapsed ? FiChevronRight : FiChevronDown}
                boxSize={3}
                flexShrink={0}
              />
              <Icon as={config.icon} boxSize={3.5} color={config.color} flexShrink={0} />
              <Text fontSize="xs" fontWeight="semibold" textTransform="uppercase" letterSpacing="wide">
                {config.label}
              </Text>
              <Text fontSize="xs" color="text.muted">
                ({items.length})
              </Text>
            </HStack>

            {!isCollapsed && (
              <VStack align="stretch" gap={2} pl={2}>
                {items.map(torrent => (
                  <TorrentItem
                    key={torrent.id}
                    torrent={torrent}
                    onSelect={onSelectTorrent}
                    isDownloading={isDownloading}
                    scanResult={scanResultsMap.get(torrent.id)}
                    highlightSongName={highlightSongName}
                  />
                ))}
              </VStack>
            )}
          </VStack>
        )
      })}
    </>
  )
}

// Classification Item Component
interface ClassificationItemProps {
  result: SearchClassificationResult
  onSelect?: (result: SearchClassificationResult) => void
}

const ClassificationItem: React.FC<ClassificationItemProps> = ({ result, onSelect }) => {
  const getIcon = () => {
    switch (result.type) {
      case 'song':
        return FiMusic
      case 'album':
        return FiDisc
      case 'artist':
        return FiUser
      default:
        return FiMusic
    }
  }

  const getTypeLabel = () => {
    return result.type.charAt(0).toUpperCase() + result.type.slice(1)
  }

  return (
    <HStack
      p={3}
      borderRadius="sm"
      bg="bg.elevated"
      borderWidth="1px"
      borderColor="border.base"
      cursor="pointer"
      onClick={() => onSelect?.(result)}
      transition="all 0.2s"
      _hover={{
        borderColor: 'border.focus',
        bg: 'bg.hover',
      }}
    >
      <Icon as={getIcon()} boxSize={5} color="interactive.base" flexShrink={0} />
      <VStack align="start" gap={0} flex="1" minW={0}>
        <Text fontSize="sm" fontWeight="medium" color="text.primary" lineClamp={1}>
          {result.name}
        </Text>
        {result.artist && (
          <Text fontSize="xs" color="text.muted" lineClamp={1}>
            by {result.artist}
          </Text>
        )}
      </VStack>
      <HStack gap={2} flexShrink={0}>
        <Text fontSize="xs" color="text.muted" px={2} py={1} bg="bg.surface" borderRadius="sm">
          {getTypeLabel()}
        </Text>
        <Icon as={FiChevronRight} boxSize={4} color="text.muted" />
      </HStack>
    </HStack>
  )
}

// Album Item Component
interface AlbumItemProps {
  album: MusicBrainzAlbum
  onSelect?: (album: MusicBrainzAlbum) => void
}

const AlbumItem: React.FC<AlbumItemProps> = ({ album, onSelect }) => {
  const [imageError, setImageError] = useState(false)
  const hasCover = album.coverArtUrl && !imageError
  const year = album.date ? new Date(album.date).getFullYear() : null

  // Format type label
  const typeLabel = album.type
    ? album.type.charAt(0).toUpperCase() + album.type.slice(1)
    : null

  return (
    <Box
      position="relative"
      h="100px"
      borderRadius="md"
      overflow="hidden"
      cursor="pointer"
      onClick={() => onSelect?.(album)}
      transition="all 0.2s"
      borderWidth="1px"
      borderColor="border.base"
      _hover={{
        borderColor: 'border.focus',
        transform: 'scale(1.02)',
      }}
    >
      {/* Background: Cover art or fallback gradient */}
      {hasCover ? (
        <Image
          src={album.coverArtUrl}
          alt=""
          position="absolute"
          inset={0}
          w="full"
          h="full"
          objectFit="cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <Box
          position="absolute"
          inset={0}
          bgGradient="to-br"
          gradientFrom="gray.700"
          gradientTo="gray.900"
        />
      )}

      {/* Dark overlay for text contrast */}
      <Box
        position="absolute"
        inset={0}
        bgGradient="to-t"
        gradientFrom="blackAlpha.900"
        gradientVia="blackAlpha.600"
        gradientTo="blackAlpha.300"
      />

      {/* Fallback icon when no cover */}
      {!hasCover && (
        <Icon
          as={FiDisc}
          position="absolute"
          top={2}
          right={2}
          boxSize={8}
          color="whiteAlpha.300"
        />
      )}

      {/* Content overlay */}
      <VStack
        position="relative"
        h="full"
        align="start"
        justify="flex-end"
        p={3}
        gap={0.5}
      >
        {/* Title */}
        <Text
          fontSize="sm"
          fontWeight="semibold"
          color="white"
          lineClamp={1}
          textShadow="0 1px 3px rgba(0,0,0,0.5)"
        >
          {album.title}
        </Text>

        {/* Artist */}
        <Text
          fontSize="xs"
          color="whiteAlpha.800"
          lineClamp={1}
          textShadow="0 1px 2px rgba(0,0,0,0.5)"
        >
          {album.artist}
        </Text>

        {/* Metadata row: year, type, tracks */}
        <HStack gap={2} mt={0.5}>
          {year && (
            <Text fontSize="xs" color="whiteAlpha.700">
              {year}
            </Text>
          )}
          {typeLabel && (
            <Text
              fontSize="xs"
              color="whiteAlpha.900"
              bg="whiteAlpha.200"
              px={1.5}
              py={0.5}
              borderRadius="sm"
            >
              {typeLabel}
            </Text>
          )}
          {album.trackCount && (
            <Text fontSize="xs" color="whiteAlpha.700">
              {album.trackCount} tracks
            </Text>
          )}
        </HStack>
      </VStack>

      {/* Score badge (top-right corner) */}
      {album.score !== undefined && album.score >= 80 && (
        <Box
          position="absolute"
          top={2}
          right={2}
          bg="green.500"
          color="white"
          fontSize="xs"
          fontWeight="bold"
          px={1.5}
          py={0.5}
          borderRadius="sm"
        >
          {album.score}%
        </Box>
      )}
    </Box>
  )
}

// Torrent Item Component
interface TorrentItemProps {
  torrent: SearchResult
  onSelect?: (torrent: SearchResult) => void
  isDownloading?: boolean
  scanResult?: PageContentScanResult
  highlightSongName?: string
}

const TorrentItem: React.FC<TorrentItemProps> = ({ torrent, onSelect, isDownloading, scanResult, highlightSongName }) => {
  const [previewState, setPreviewState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')
  const [metadata, setMetadata] = useState<TorrentPageMetadata | null>(null)
  const [previewError, setPreviewError] = useState<string>('')
  const [isExpanded, setIsExpanded] = useState(false)

  const formatSize = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024)
    const mb = bytes / (1024 * 1024)
    return gb >= 1 ? `${gb.toFixed(2)} GB` : `${mb.toFixed(0)} MB`
  }

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
          <Icon as={FiDownload} boxSize={5} color="interactive.base" flexShrink={0} mt={0.5} />
          <VStack align="start" gap={1} flex="1" minW={0}>
            <Text fontSize="sm" fontWeight="medium" color="text.primary" lineClamp={2}>
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
                <Text fontSize="xs" color="text.muted">
                  {torrent.sizeBytes ? formatSize(torrent.sizeBytes) : torrent.size}
                </Text>
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
                <Text fontSize="xs" color="text.muted" px={2} py={0.5} bg="bg.surface" borderRadius="sm">
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
            <Icon as={isExpanded && previewState === 'loaded' ? FiChevronUp : FiList} boxSize={3} />
            {previewState === 'loaded' ? (isExpanded ? 'Hide tracks' : 'Show tracks') : 'Preview tracks'}
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
          {previewState === 'error' && <TorrentTrackListError error={previewError} />}
          {previewState === 'loaded' && metadata && <TorrentTrackListPreview metadata={metadata} highlightSongName={highlightSongName} />}
        </Box>
      )}
    </Box>
  )
}
