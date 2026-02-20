import { Box } from '@chakra-ui/react'
import { useAudioPlayerStore } from '@/store/audioPlayerStore'
import type { TrackPosition } from './TimelineLayout'
import type { Song } from '@shared/types/project.types'

interface PlayheadProps {
  positions: TrackPosition[]
  songs: Song[]
  pixelsPerSecond: number
  trackHeight: number
}

/**
 * Renders a moving vertical playhead line over the timeline,
 * synced to audioPlayerStore.currentTime.
 */
export function Playhead({
  positions,
  songs,
  pixelsPerSecond,
  trackHeight,
}: PlayheadProps): JSX.Element | null {
  const currentTrack = useAudioPlayerStore((s) => s.currentTrack)
  const currentTime = useAudioPlayerStore((s) => s.currentTime)
  const isPlaying = useAudioPlayerStore((s) => s.isPlaying)

  if (!currentTrack || (!isPlaying && currentTime === 0)) return null

  // Find which song matches the currently playing track
  const trackIndex = songs.findIndex(
    (s) => (s.localFilePath ?? s.externalFilePath) === currentTrack.filePath
  )
  if (trackIndex === -1) return null

  const pos = positions[trackIndex]
  const song = songs[trackIndex]
  const x = pos.left + (currentTime - (song.trimStart ?? 0)) * pixelsPerSecond

  // Don't render if playhead is outside track bounds
  if (x < pos.left || x > pos.left + pos.width) return null

  return (
    <Box
      position="absolute"
      left={`${x}px`}
      top={0}
      w="2px"
      h={`${trackHeight + 14}px`}
      bg="#f97316"
      zIndex={10}
      pointerEvents="none"
      transition="left 0.05s linear"
    />
  )
}
