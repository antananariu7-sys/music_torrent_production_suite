import { Box, HStack, Text, Icon, IconButton, Spinner } from '@chakra-ui/react'
import { FiPlay, FiSquare } from 'react-icons/fi'
import { isSongMatch } from '@shared/utils/songMatcher'
import { useStreamPreviewStore } from '@/store/streamPreviewStore'

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

interface TrackListRowProps {
  track: { position: number; title: string; duration?: string }
  fileIndex: number
  highlightSongName?: string
  magnetLink?: string
  format?: string
}

/**
 * Single track row with preview button, highlight logic, and stream preview integration.
 */
export const TrackListRow: React.FC<TrackListRowProps> = ({
  track,
  fileIndex,
  highlightSongName,
  magnetLink,
  format,
}) => {
  const status = useStreamPreviewStore((s) => s.status)
  const activeTrackKey = useStreamPreviewStore((s) => s.activeTrackKey)
  const error = useStreamPreviewStore((s) => s.error)
  const startPreview = useStreamPreviewStore((s) => s.startPreview)
  const stopPreview = useStreamPreviewStore((s) => s.stopPreview)

  const isHighlighted = highlightSongName
    ? isSongMatch(track.title, highlightSongName)
    : false

  const trackKey = magnetLink ? `${magnetLink}:${fileIndex}` : null
  const isThisTrackActive = trackKey !== null && activeTrackKey === trackKey
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
    <Box>
      <HStack
        gap={2}
        py={0.5}
        px={1}
        borderRadius="sm"
        bg={isHighlighted ? 'brand.500/15' : 'transparent'}
      >
        {/* Preview button or track number */}
        {isPreviewable ? (
          <Box w="20px" flexShrink={0} display="flex" justifyContent="center">
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
}
