import { memo } from 'react'
import { Box, Badge } from '@chakra-ui/react'
import type { Song } from '@shared/types/project.types'

interface TrackInfoOverlayProps {
  song: Song
}

function formatBitrate(song: Song): string {
  const bitrate = song.bitrate ?? song.metadata?.bitrate
  const format = (song.format ?? song.metadata?.format ?? '').toUpperCase()
  if (bitrate && format) return `${bitrate}k ${format}`
  if (format) return format
  return ''
}

function buildTooltipText(song: Song): string {
  const lines: string[] = []
  const format = song.format ?? song.metadata?.format
  if (format) lines.push(`Format: ${format.toUpperCase()}`)
  const bitrate = song.bitrate ?? song.metadata?.bitrate
  if (bitrate) lines.push(`Bitrate: ${bitrate} kbps`)
  const sr = song.sampleRate ?? song.metadata?.sampleRate
  if (sr) lines.push(`Sample rate: ${sr} Hz`)
  if (song.duration) {
    const min = Math.floor(song.duration / 60)
    const sec = Math.floor(song.duration % 60)
    lines.push(`Duration: ${min}:${sec.toString().padStart(2, '0')}`)
  }
  if (song.fileSize) {
    const mb = (song.fileSize / (1024 * 1024)).toFixed(1)
    lines.push(`Size: ${mb} MB`)
  }
  return lines.join(' | ')
}

/**
 * Overlay showing format badge on each track in the timeline.
 * Hover shows full metadata via native title tooltip.
 */
export const TrackInfoOverlay = memo(
  function TrackInfoOverlay({ song }: TrackInfoOverlayProps): JSX.Element {
    const label = formatBitrate(song)

    const hasBpm = song.bpm != null && song.bpm > 0

    if (!label && !hasBpm) return <></>

    return (
      <Box
        position="absolute"
        top={1}
        left={1}
        zIndex={1}
        display="flex"
        gap="4px"
      >
        {label && (
          <Badge
            fontSize="2xs"
            fontWeight="bold"
            textTransform="uppercase"
            colorPalette="blue"
            variant="subtle"
            cursor="default"
            title={buildTooltipText(song)}
          >
            {label}
          </Badge>
        )}
        {hasBpm && (
          <Badge
            fontSize="2xs"
            fontWeight="bold"
            colorPalette="purple"
            variant="subtle"
            cursor="default"
          >
            {Math.round(song.bpm!)} BPM
          </Badge>
        )}
      </Box>
    )
  },
  (prev, next) =>
    prev.song.id === next.song.id &&
    prev.song.bpm === next.song.bpm &&
    prev.song.bitrate === next.song.bitrate &&
    prev.song.format === next.song.format
)
