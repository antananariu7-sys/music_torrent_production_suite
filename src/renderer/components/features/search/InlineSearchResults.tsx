import { useMemo } from 'react'
import { Box, VStack, Text, Button, HStack, Icon, Heading, Grid } from '@chakra-ui/react'
import { FiUser, FiInfo } from 'react-icons/fi'
import type { SearchClassificationResult, MusicBrainzAlbum } from '@shared/types/musicbrainz.types'
import type { SearchResult } from '@shared/types/search.types'
import { isLikelyDiscography, groupResults } from '@shared/utils/resultClassifier'
import type { DiscographySearchProgress, PageContentScanResult } from '@shared/types/discography.types'
import { DiscographyScanPanel } from './DiscographyScanPanel'
import { ClassificationItem } from './components/ClassificationItem'
import { AlbumItem } from './components/AlbumItem'
import { TorrentItem } from './components/TorrentItem'
import { GroupedTorrentList } from './components/GroupedTorrentList'

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
