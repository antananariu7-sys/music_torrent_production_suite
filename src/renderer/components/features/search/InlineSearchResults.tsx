import { useState, useMemo } from 'react'
import { Box, VStack, Text, Button, HStack, Icon, Heading, Grid, Image } from '@chakra-ui/react'
import { FiMusic, FiDisc, FiUser, FiDownload, FiChevronRight } from 'react-icons/fi'
import type { SearchClassificationResult, MusicBrainzAlbum } from '@shared/types/musicbrainz.types'
import type { SearchResult } from '@shared/types/search.types'
import type { DiscographySearchProgress, PageContentScanResult } from '@shared/types/discography.types'
import { DiscographyScanPanel, AlbumFoundBadge } from './DiscographyScanPanel'

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
    return torrents.filter((t) => {
      const titleLower = t.title.toLowerCase()
      return (
        titleLower.includes('discography') ||
        titleLower.includes('дискография') ||
        titleLower.includes('complete') ||
        titleLower.includes('collection') ||
        titleLower.includes('anthology') ||
        titleLower.includes('box set') ||
        titleLower.includes('all albums')
      )
    })
  }, [torrents])

  // Create a map of scan results by torrent ID
  const scanResultsMap = useMemo(() => {
    const map = new Map<string, PageContentScanResult>()
    discographyScanResults.forEach((r) => {
      map.set(r.searchResult.id, r)
    })
    return map
  }, [discographyScanResults])

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
            {sortedTorrents.map((torrent) => (
              <TorrentItem
                key={torrent.id}
                torrent={torrent}
                onSelect={onSelectTorrent}
                isDownloading={isDownloading}
                scanResult={scanResultsMap.get(torrent.id)}
              />
            ))}
          </VStack>
        </VStack>
      )}
    </Box>
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
}

const TorrentItem: React.FC<TorrentItemProps> = ({ torrent, onSelect, isDownloading, scanResult }) => {
  const formatSize = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024)
    const mb = bytes / (1024 * 1024)
    return gb >= 1 ? `${gb.toFixed(2)} GB` : `${mb.toFixed(0)} MB`
  }

  return (
    <HStack
      p={3}
      borderRadius="sm"
      bg="bg.elevated"
      borderWidth="1px"
      borderColor="border.base"
      cursor={isDownloading ? 'not-allowed' : 'pointer'}
      onClick={() => !isDownloading && onSelect?.(torrent)}
      opacity={isDownloading ? 0.6 : 1}
      transition="all 0.2s"
      _hover={!isDownloading ? {
        borderColor: 'border.focus',
        bg: 'bg.hover',
      } : {}}
      align="start"
    >
      <Icon as={FiDownload} boxSize={5} color="interactive.base" flexShrink={0} mt={0.5} />
      <VStack align="start" gap={1} flex="1" minW={0}>
        <Text fontSize="sm" fontWeight="medium" color="text.primary" lineClamp={2}>
          {torrent.title}
        </Text>
        <HStack gap={3} flexWrap="wrap">
          {scanResult && <AlbumFoundBadge scanResult={scanResult} />}
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
      <Icon as={FiChevronRight} boxSize={4} color="text.muted" flexShrink={0} />
    </HStack>
  )
}
