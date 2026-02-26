import { Box } from '@chakra-ui/react'
import { CrossfadeCurveCanvas } from './CrossfadeCurveCanvas'
import { TRACK_COLORS } from './TimelineLayout'
import type { Song } from '@shared/types/project.types'
import type { TrackPosition } from './TimelineLayout'

interface CrossfadeZonesProps {
  songs: Song[]
  positions: TrackPosition[]
  trackHeight: number
  onCrossfadeClick: (e: React.MouseEvent, songId: string) => void
}

export function CrossfadeZones({
  songs,
  positions,
  trackHeight,
  onCrossfadeClick,
}: CrossfadeZonesProps): JSX.Element | null {
  if (songs.length <= 1) return null

  return (
    <>
      {songs.map((song, index) => {
        if (index >= songs.length - 1) return null
        const thisPos = positions[index]
        const nextPos = positions[index + 1]
        const overlapStart = nextPos.left
        const overlapEnd = thisPos.left + thisPos.width
        const overlapWidth = overlapEnd - overlapStart
        if (overlapWidth <= 0) return null

        return (
          <Box
            key={`xfade-${song.id}`}
            position="absolute"
            left={`${overlapStart}px`}
            top={0}
            w={`${overlapWidth}px`}
            h={`${trackHeight}px`}
            cursor="pointer"
            onClick={(e) => onCrossfadeClick(e, song.id)}
            title="Click to edit crossfade"
          >
            <CrossfadeCurveCanvas
              width={overlapWidth}
              height={trackHeight}
              curveType={song.crossfadeCurveType ?? 'linear'}
              colorA={TRACK_COLORS[index % TRACK_COLORS.length]}
              colorB={TRACK_COLORS[(index + 1) % TRACK_COLORS.length]}
            />
          </Box>
        )
      })}
    </>
  )
}
