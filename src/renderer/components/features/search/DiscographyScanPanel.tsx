import { Box, VStack, HStack, Text, Button, Icon, Badge } from '@chakra-ui/react'
import { FiSearch, FiCheckCircle, FiLoader } from 'react-icons/fi'
import type { DiscographySearchProgress, PageContentScanResult } from '@shared/types/discography.types'
import type { SearchResult } from '@shared/types/search.types'

interface DiscographyScanPanelProps {
  /** Whether scan is in progress */
  isScanning: boolean
  /** Current scan progress */
  progress: DiscographySearchProgress | null
  /** Scan results */
  scanResults: PageContentScanResult[]
  /** Torrents to scan (discography pages) */
  discographyTorrents: SearchResult[]
  /** Album name being searched for */
  albumName?: string
  /** Handler to start scan */
  onStartScan: () => void
  /** Handler to stop scan */
  onStopScan: () => void
}

export const DiscographyScanPanel: React.FC<DiscographyScanPanelProps> = ({
  isScanning,
  progress,
  scanResults,
  discographyTorrents,
  albumName,
  onStartScan,
  onStopScan,
}) => {
  const matchedCount = scanResults.filter((r) => r.albumFound).length

  // Don't show if no discography pages found
  if (discographyTorrents.length === 0 && !isScanning && scanResults.length === 0) {
    return null
  }

  return (
    <Box
      p={3}
      mb={3}
      borderRadius="md"
      bg="bg.elevated"
      borderWidth="1px"
      borderColor="border.base"
    >
      <VStack align="stretch" gap={2}>
        {/* Header */}
        <HStack justify="space-between">
          <HStack gap={2}>
            <Icon as={FiSearch} color="interactive.base" />
            <Text fontSize="sm" fontWeight="medium" color="text.primary">
              Discography Page Scanner
            </Text>
          </HStack>

          {!isScanning && discographyTorrents.length > 0 && (
            <Badge colorPalette="blue" variant="subtle">
              {discographyTorrents.length} pages to scan
            </Badge>
          )}
        </HStack>

        {/* Description */}
        {!isScanning && scanResults.length === 0 && (
          <Text fontSize="xs" color="text.muted">
            Found {discographyTorrents.length} discography/collection pages.
            {albumName && ` Scan to find "${albumName}" within these pages.`}
          </Text>
        )}

        {/* Scanning Progress */}
        {isScanning && progress && (
          <Box>
            <HStack gap={2} mb={1}>
              <Icon as={FiLoader} color="interactive.base" className="animate-spin" />
              <Text fontSize="xs" color="text.muted">
                Scanning page {progress.currentPage} of {progress.totalPages}...
              </Text>
            </HStack>
            <Box
              h="4px"
              bg="bg.surface"
              borderRadius="full"
              overflow="hidden"
            >
              <Box
                h="full"
                bg="interactive.base"
                borderRadius="full"
                transition="width 0.3s"
                style={{ width: `${(progress.currentPage / progress.totalPages) * 100}%` }}
              />
            </Box>
          </Box>
        )}

        {/* Scan Results Summary */}
        {!isScanning && scanResults.length > 0 && (
          <HStack gap={2}>
            <Icon
              as={FiCheckCircle}
              color={matchedCount > 0 ? 'green.500' : 'text.muted'}
            />
            <Text fontSize="xs" color={matchedCount > 0 ? 'green.500' : 'text.muted'}>
              {matchedCount > 0
                ? `Album found in ${matchedCount} of ${scanResults.length} pages`
                : `Album not found in ${scanResults.length} scanned pages`}
            </Text>
          </HStack>
        )}

        {/* Action Button */}
        <HStack gap={2}>
          {!isScanning ? (
            <Button
              size="sm"
              variant="outline"
              onClick={onStartScan}
              disabled={discographyTorrents.length === 0}
            >
              <Icon as={FiSearch} mr={2} />
              {scanResults.length > 0 ? 'Scan Again' : 'Scan for Album'}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              colorPalette="red"
              onClick={onStopScan}
            >
              Stop Scanning
            </Button>
          )}
        </HStack>
      </VStack>
    </Box>
  )
}

/**
 * Badge component to show on torrents that contain the album
 */
interface AlbumFoundBadgeProps {
  scanResult?: PageContentScanResult
}

export const AlbumFoundBadge: React.FC<AlbumFoundBadgeProps> = ({ scanResult }) => {
  if (!scanResult) return null

  if (scanResult.albumFound) {
    return (
      <Badge colorPalette="green" variant="solid" size="sm" px={2} py={0.5}>
        Album Found
      </Badge>
    )
  }

  if (scanResult.isDiscography) {
    return (
      <Badge colorPalette="gray" variant="subtle" size="sm" px={2} py={0.5}>
        Scanned - Not Found
      </Badge>
    )
  }

  return null
}
