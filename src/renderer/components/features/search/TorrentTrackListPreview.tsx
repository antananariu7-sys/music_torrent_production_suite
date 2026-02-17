import { useState } from 'react'
import { Box, VStack, HStack, Text, Icon, Spinner } from '@chakra-ui/react'
import { FiMusic, FiDisc, FiChevronDown, FiChevronRight } from 'react-icons/fi'
import type { TorrentPageMetadata, ParsedAlbum } from '@shared/types/torrentMetadata.types'
import { isSongMatch } from '@shared/utils/songMatcher'

interface TorrentTrackListPreviewProps {
  metadata: TorrentPageMetadata
  /** Song name to highlight in the track list (from song search flow) */
  highlightSongName?: string
}

/**
 * Displays parsed track listing from a torrent page.
 * Shows albums in collapsible sections with track listings.
 */
export const TorrentTrackListPreview: React.FC<TorrentTrackListPreviewProps> = ({ metadata, highlightSongName }) => {
  const { albums, format, bitrate } = metadata

  if (albums.length === 0) {
    return (
      <Text fontSize="xs" color="text.muted" py={2}>
        No track listing found on this page.
      </Text>
    )
  }

  return (
    <VStack align="stretch" gap={2} py={2}>
      {/* Format info */}
      {(format || bitrate) && (
        <HStack gap={2}>
          {format && (
            <Text fontSize="xs" color="blue.300" bg="blue.500/15" px={2} py={0.5} borderRadius="sm" fontWeight="medium">
              {format}
            </Text>
          )}
          {bitrate && (
            <Text fontSize="xs" color="text.muted">
              {bitrate}
            </Text>
          )}
        </HStack>
      )}

      {/* Album sections */}
      {albums.length === 1 ? (
        // Single album — show tracks directly
        <SingleAlbumView album={albums[0]} highlightSongName={highlightSongName} />
      ) : (
        // Multiple albums — collapsible sections
        albums.map((album, index) => (
          <CollapsibleAlbumView key={`${album.title}-${index}`} album={album} highlightSongName={highlightSongName} />
        ))
      )}
    </VStack>
  )
}

/** Shows tracks for a single album (no collapsing needed) */
const SingleAlbumView: React.FC<{ album: ParsedAlbum; highlightSongName?: string }> = ({ album, highlightSongName }) => {
  return (
    <VStack align="stretch" gap={1}>
      <HStack gap={1}>
        <Icon as={FiDisc} boxSize={3} color="text.muted" />
        <Text fontSize="xs" fontWeight="medium" color="text.primary" lineClamp={1}>
          {album.title}
        </Text>
        {album.year && (
          <Text fontSize="xs" color="text.muted">({album.year})</Text>
        )}
      </HStack>
      <TrackList tracks={album.tracks} highlightSongName={highlightSongName} />
    </VStack>
  )
}

/** Collapsible album section for discography pages */
const CollapsibleAlbumView: React.FC<{ album: ParsedAlbum; highlightSongName?: string }> = ({ album, highlightSongName }) => {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <Box>
      <HStack
        gap={1}
        cursor="pointer"
        onClick={() => setIsExpanded(!isExpanded)}
        _hover={{ color: 'text.primary' }}
        color="text.muted"
        transition="color 0.15s"
      >
        <Icon as={isExpanded ? FiChevronDown : FiChevronRight} boxSize={3} flexShrink={0} />
        <Icon as={FiDisc} boxSize={3} flexShrink={0} />
        <Text fontSize="xs" fontWeight="medium" color="text.primary" lineClamp={1}>
          {album.title}
        </Text>
        {album.year && (
          <Text fontSize="xs" color="text.muted" flexShrink={0}>({album.year})</Text>
        )}
        <Text fontSize="xs" color="text.muted" flexShrink={0}>
          — {album.tracks.length} tracks
        </Text>
      </HStack>
      {isExpanded && (
        <Box pl={5} pt={1}>
          <TrackList tracks={album.tracks} highlightSongName={highlightSongName} />
        </Box>
      )}
    </Box>
  )
}

/** Renders a list of tracks with optional song highlighting */
const TrackList: React.FC<{
  tracks: { position: number; title: string; duration?: string }[]
  highlightSongName?: string
}> = ({ tracks, highlightSongName }) => {
  if (tracks.length === 0) {
    return (
      <Text fontSize="xs" color="text.muted" fontStyle="italic">
        Track listing not available
      </Text>
    )
  }

  return (
    <VStack align="stretch" gap={0}>
      {tracks.map((track) => {
        const isHighlighted = highlightSongName
          ? isSongMatch(track.title, highlightSongName)
          : false

        return (
          <HStack
            key={track.position}
            gap={2}
            py={0.5}
            px={1}
            borderRadius="sm"
            bg={isHighlighted ? 'brand.500/15' : 'transparent'}
          >
            <Text fontSize="xs" color="text.muted" w="20px" textAlign="right" flexShrink={0}>
              {track.position}.
            </Text>
            <Icon
              as={FiMusic}
              boxSize={2.5}
              color={isHighlighted ? 'brand.400' : 'text.muted'}
              flexShrink={0}
            />
            <Text
              fontSize="xs"
              color={isHighlighted ? 'brand.300' : 'text.primary'}
              fontWeight={isHighlighted ? 'semibold' : 'normal'}
              lineClamp={1}
              flex={1}
            >
              {track.title}
            </Text>
            {track.duration && (
              <Text fontSize="xs" color="text.muted" flexShrink={0}>
                {track.duration}
              </Text>
            )}
          </HStack>
        )
      })}
    </VStack>
  )
}

/** Loading state for the preview */
export const TorrentTrackListLoading: React.FC = () => (
  <HStack gap={2} py={2}>
    <Spinner size="xs" color="text.muted" />
    <Text fontSize="xs" color="text.muted">Loading track listing...</Text>
  </HStack>
)

/** Error state for the preview */
export const TorrentTrackListError: React.FC<{ error: string }> = ({ error }) => (
  <Text fontSize="xs" color="red.400" py={2}>
    Failed to load tracks: {error}
  </Text>
)
