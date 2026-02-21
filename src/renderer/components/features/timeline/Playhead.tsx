import { memo, useRef, useEffect } from 'react'
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
 * Renders a moving vertical playhead line over the timeline.
 * Uses direct DOM updates via store subscription to avoid
 * triggering React re-renders at ~60fps.
 */
export const Playhead = memo(function Playhead({
  positions,
  songs,
  pixelsPerSecond,
  trackHeight,
}: PlayheadProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const update = () => {
      const { currentTrack, currentTime, isPlaying } =
        useAudioPlayerStore.getState()

      if (!currentTrack || (!isPlaying && currentTime === 0)) {
        el.style.display = 'none'
        return
      }

      const trackIndex = songs.findIndex(
        (s) => (s.localFilePath ?? s.externalFilePath) === currentTrack.filePath
      )
      if (trackIndex === -1) {
        el.style.display = 'none'
        return
      }

      const pos = positions[trackIndex]
      const song = songs[trackIndex]
      const x =
        pos.left + (currentTime - (song.trimStart ?? 0)) * pixelsPerSecond

      if (x < pos.left || x > pos.left + pos.width) {
        el.style.display = 'none'
        return
      }

      el.style.display = 'block'
      el.style.transform = `translateX(${x}px)`
    }

    // Initial position
    update()

    // Subscribe to store changes — direct DOM, no React re-renders
    const unsub = useAudioPlayerStore.subscribe(update)
    return unsub
  }, [songs, positions, pixelsPerSecond])

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '2px',
        height: `${trackHeight}px`,
        background: '#f97316',
        zIndex: 10,
        pointerEvents: 'none',
        willChange: 'transform',
        display: 'none',
      }}
    />
  )
})
