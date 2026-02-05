import { useState } from 'react'
import { Box, VStack, Text, Button, HStack, Icon, Heading, Grid, Image } from '@chakra-ui/react'
import { FiMusic, FiDisc, FiUser, FiDownload, FiChevronRight } from 'react-icons/fi'
import type { SearchClassificationResult, MusicBrainzAlbum } from '@shared/types/musicbrainz.types'
import type { SearchResult } from '@shared/types/search.types'

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
  onCancel,
}) => {
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

          <VStack align="stretch" gap={2} maxH="500px" overflowY="auto">
            {torrents.map((torrent) => (
              <TorrentItem
                key={torrent.id}
                torrent={torrent}
                onSelect={onSelectTorrent}
                isDownloading={isDownloading}
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

  return (
    <Box
      p={3}
      borderRadius="sm"
      bg="bg.elevated"
      borderWidth="1px"
      borderColor="border.base"
      cursor="pointer"
      onClick={() => onSelect?.(album)}
      transition="all 0.2s"
      _hover={{
        borderColor: 'border.focus',
        bg: 'bg.hover',
      }}
    >
      <VStack align="start" gap={2}>
        {album.coverArtUrl && !imageError ? (
          <Image
            src={album.coverArtUrl}
            alt={`${album.title} cover`}
            boxSize="80px"
            objectFit="cover"
            borderRadius="sm"
            onError={() => setImageError(true)}
          />
        ) : (
          <Icon as={FiDisc} boxSize={10} color="interactive.base" />
        )}
        <VStack align="start" gap={0.5}>
          <Text fontSize="sm" fontWeight="medium" color="text.primary" lineClamp={2}>
            {album.title}
          </Text>
          <Text fontSize="xs" color="text.muted">
            {album.artist}
          </Text>
          {album.date && (
            <Text fontSize="xs" color="text.muted">
              {new Date(album.date).getFullYear()}
            </Text>
          )}
        </VStack>
      </VStack>
    </Box>
  )
}

// Torrent Item Component
interface TorrentItemProps {
  torrent: SearchResult
  onSelect?: (torrent: SearchResult) => void
  isDownloading?: boolean
}

const TorrentItem: React.FC<TorrentItemProps> = ({ torrent, onSelect, isDownloading }) => {
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
