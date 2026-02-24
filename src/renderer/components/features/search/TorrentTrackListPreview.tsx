import { useState } from 'react'
import {
  Box,
  VStack,
  HStack,
  Text,
  Icon,
  IconButton,
  Spinner,
} from '@chakra-ui/react'
import {
  FiPlay,
  FiSquare,
  FiDisc,
  FiChevronDown,
  FiChevronRight,
} from 'react-icons/fi'
import type {
  TorrentPageMetadata,
  ParsedAlbum,
} from '@shared/types/torrentMetadata.types'
import { isSongMatch } from '@shared/utils/songMatcher'
import { useStreamPreviewStore } from '@/store/streamPreviewStore'

/** Normalize album title for matching: lowercase, strip brackets/parens, collapse whitespace */
function normalizeAlbumTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Check if an album/folder title matches the searched album name */
function isAlbumMatch(folderTitle: string, albumName: string): boolean {
  const a = normalizeAlbumTitle(folderTitle)
  const b = normalizeAlbumTitle(albumName)
  if (!b) return false
  if (a === b) return true
  if (a.includes(b) || b.includes(a)) return true
  return false
}

/** Audio extensions supported for stream preview */
const PREVIEWABLE_EXTENSIONS = new Set([
  '.mp3',
  '.flac',
  '.wav',
  '.ogg',
  '.m4a',
  '.aac',
  '.opus',
])

function getExtFromTitle(title: string): string {
  const match = title.match(/\.(\w{2,5})$/)
  return match ? `.${match[1].toLowerCase()}` : ''
}

function canPreview(title: string, format?: string): boolean {
  const ext = getExtFromTitle(title)
  if (ext) return PREVIEWABLE_EXTENSIONS.has(ext)
  // Fall back to metadata format
  if (format) {
    const normalized = format.toLowerCase()
    return ['mp3', 'flac', 'wav', 'ogg', 'aac', 'opus', 'm4a'].some((f) =>
      normalized.includes(f)
    )
  }
  // If no extension or format info, optimistically allow (service will reject unsupported)
  return true
}

interface TorrentTrackListPreviewProps {
  metadata: TorrentPageMetadata
  /** Song name to highlight in the track list (from song search flow) */
  highlightSongName?: string
  /** Album name to highlight matching album sections (from discography search) */
  highlightAlbumName?: string
}

/**
 * Displays parsed track listing from a torrent page.
 * Shows albums in collapsible sections with track listings.
 * Each track has a play button for stream preview (when magnetLink is available).
 */
export const TorrentTrackListPreview: React.FC<
  TorrentTrackListPreviewProps
> = ({ metadata, highlightSongName, highlightAlbumName }) => {
  const { albums, format, bitrate, magnetLink } = metadata

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
            <Text
              fontSize="xs"
              color="blue.300"
              bg="blue.500/15"
              px={2}
              py={0.5}
              borderRadius="sm"
              fontWeight="medium"
            >
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
        <SingleAlbumView
          album={albums[0]}
          highlightSongName={highlightSongName}
          highlightAlbumName={highlightAlbumName}
          magnetLink={magnetLink}
          format={format}
          trackOffset={0}
        />
      ) : (
        // Multiple albums — collapsible sections
        albums.reduce<{ elements: React.ReactNode[]; offset: number }>(
          (acc, album, index) => {
            acc.elements.push(
              <CollapsibleAlbumView
                key={`${album.title}-${index}`}
                album={album}
                highlightSongName={highlightSongName}
                highlightAlbumName={highlightAlbumName}
                magnetLink={magnetLink}
                format={format}
                trackOffset={acc.offset}
              />
            )
            acc.offset += album.tracks.length
            return acc
          },
          { elements: [], offset: 0 }
        ).elements
      )}
    </VStack>
  )
}

/** Shows tracks for a single album (no collapsing needed) */
const SingleAlbumView: React.FC<{
  album: ParsedAlbum
  highlightSongName?: string
  highlightAlbumName?: string
  magnetLink?: string
  format?: string
  trackOffset: number
}> = ({
  album,
  highlightSongName,
  highlightAlbumName,
  magnetLink,
  format,
  trackOffset,
}) => {
  const matched = highlightAlbumName
    ? isAlbumMatch(album.title, highlightAlbumName)
    : false

  return (
    <VStack
      align="stretch"
      gap={1}
      {...(matched && {
        borderLeft: '2px solid',
        borderLeftColor: 'brand.400',
        pl: 2,
      })}
    >
      <HStack gap={1}>
        <Icon
          as={FiDisc}
          boxSize={3}
          color={matched ? 'brand.400' : 'text.muted'}
        />
        <Text
          fontSize="xs"
          fontWeight="medium"
          color={matched ? 'brand.300' : 'text.primary'}
          lineClamp={1}
        >
          {album.title}
        </Text>
        {album.year && (
          <Text fontSize="xs" color="text.muted">
            ({album.year})
          </Text>
        )}
      </HStack>
      <TrackList
        tracks={album.tracks}
        highlightSongName={highlightSongName}
        magnetLink={magnetLink}
        format={format}
        trackOffset={trackOffset}
      />
    </VStack>
  )
}

/** Collapsible album section for discography pages */
const CollapsibleAlbumView: React.FC<{
  album: ParsedAlbum
  highlightSongName?: string
  highlightAlbumName?: string
  magnetLink?: string
  format?: string
  trackOffset: number
}> = ({
  album,
  highlightSongName,
  highlightAlbumName,
  magnetLink,
  format,
  trackOffset,
}) => {
  const matched = highlightAlbumName
    ? isAlbumMatch(album.title, highlightAlbumName)
    : false
  const [isExpanded, setIsExpanded] = useState(matched)

  return (
    <Box
      {...(matched && {
        borderLeft: '2px solid',
        borderLeftColor: 'brand.400',
        pl: 1,
      })}
    >
      <HStack
        gap={1}
        cursor="pointer"
        onClick={() => setIsExpanded(!isExpanded)}
        _hover={{ color: 'text.primary' }}
        color="text.muted"
        transition="color 0.15s"
      >
        <Icon
          as={isExpanded ? FiChevronDown : FiChevronRight}
          boxSize={3}
          flexShrink={0}
        />
        <Icon
          as={FiDisc}
          boxSize={3}
          flexShrink={0}
          color={matched ? 'brand.400' : undefined}
        />
        <Text
          fontSize="xs"
          fontWeight="medium"
          color={matched ? 'brand.300' : 'text.primary'}
          lineClamp={1}
        >
          {album.title}
        </Text>
        {album.year && (
          <Text fontSize="xs" color="text.muted" flexShrink={0}>
            ({album.year})
          </Text>
        )}
        <Text fontSize="xs" color="text.muted" flexShrink={0}>
          — {album.tracks.length} tracks
        </Text>
      </HStack>
      {isExpanded && (
        <Box pl={5} pt={1}>
          <TrackList
            tracks={album.tracks}
            highlightSongName={highlightSongName}
            magnetLink={magnetLink}
            format={format}
            trackOffset={trackOffset}
          />
        </Box>
      )}
    </Box>
  )
}

/** Renders a list of tracks with optional song highlighting and stream preview buttons */
const TrackList: React.FC<{
  tracks: { position: number; title: string; duration?: string }[]
  highlightSongName?: string
  magnetLink?: string
  format?: string
  trackOffset: number
}> = ({ tracks, highlightSongName, magnetLink, format, trackOffset }) => {
  const status = useStreamPreviewStore((s) => s.status)
  const activeTrackKey = useStreamPreviewStore((s) => s.activeTrackKey)
  const error = useStreamPreviewStore((s) => s.error)
  const startPreview = useStreamPreviewStore((s) => s.startPreview)
  const stopPreview = useStreamPreviewStore((s) => s.stopPreview)

  if (tracks.length === 0) {
    return (
      <Text fontSize="xs" color="text.muted" fontStyle="italic">
        Track listing not available
      </Text>
    )
  }

  return (
    <VStack align="stretch" gap={0}>
      {tracks.map((track, index) => {
        const isHighlighted = highlightSongName
          ? isSongMatch(track.title, highlightSongName)
          : false

        // File index = offset (for multi-album) + position within this album (0-based)
        const fileIndex = trackOffset + index
        const trackKey = magnetLink ? `${magnetLink}:${fileIndex}` : null
        const isThisTrackActive =
          trackKey !== null && activeTrackKey === trackKey
        const isBuffering = isThisTrackActive && status === 'buffering'
        const isPlaying = isThisTrackActive && status === 'playing'
        const hasError = isThisTrackActive && status === 'error'
        const isPreviewable = magnetLink && canPreview(track.title, format)

        const handlePlayClick = (e: React.MouseEvent) => {
          e.stopPropagation()
          if (!magnetLink) return

          if (isBuffering || isPlaying) {
            stopPreview()
          } else {
            startPreview(magnetLink, fileIndex, track.title)
          }
        }

        return (
          <Box key={fileIndex}>
            <HStack
              gap={2}
              py={0.5}
              px={1}
              borderRadius="sm"
              bg={isHighlighted ? 'brand.500/15' : 'transparent'}
            >
              {/* Preview button or track number */}
              {isPreviewable ? (
                <Box
                  w="20px"
                  flexShrink={0}
                  display="flex"
                  justifyContent="center"
                >
                  {isBuffering ? (
                    <Spinner size="xs" color="blue.400" />
                  ) : (
                    <IconButton
                      aria-label={isPlaying ? 'Stop preview' : 'Preview track'}
                      size="2xs"
                      variant="ghost"
                      onClick={handlePlayClick}
                      title={isPlaying ? 'Stop preview' : 'Preview track'}
                      minW="auto"
                      h="auto"
                      p={0}
                    >
                      <Icon
                        as={isPlaying ? FiSquare : FiPlay}
                        boxSize={2.5}
                        color={isPlaying ? 'orange.400' : 'blue.400'}
                      />
                    </IconButton>
                  )}
                </Box>
              ) : (
                <Text
                  fontSize="xs"
                  color="text.muted"
                  w="20px"
                  textAlign="right"
                  flexShrink={0}
                >
                  {track.position}.
                </Text>
              )}
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
            {/* Inline error for this track */}
            {hasError && error && (
              <Text fontSize="xs" color="orange.400" pl={7} py={0.5}>
                {error}
              </Text>
            )}
          </Box>
        )
      })}
    </VStack>
  )
}

/** Loading state for the preview */
export const TorrentTrackListLoading: React.FC = () => (
  <HStack gap={2} py={2}>
    <Spinner size="xs" color="text.muted" />
    <Text fontSize="xs" color="text.muted">
      Loading track listing...
    </Text>
  </HStack>
)

/** Error state for the preview */
export const TorrentTrackListError: React.FC<{ error: string }> = ({
  error,
}) => (
  <Text fontSize="xs" color="red.400" py={2}>
    Failed to load tracks: {error}
  </Text>
)
