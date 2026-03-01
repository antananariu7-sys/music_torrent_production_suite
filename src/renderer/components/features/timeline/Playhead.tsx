import { memo, useRef, useEffect } from 'react'
import { useAudioPlayerStore } from '@/store/audioPlayerStore'
import type { TrackPosition } from './TimelineLayout'
import type { Song } from '@shared/types/project.types'
import type { MixPlayheadInfo } from '@/hooks/useFullMixPlayback'

interface PlayheadProps {
  positions: TrackPosition[]
  songs: Song[]
  pixelsPerSecond: number
  trackHeight: number
  /** Get current mix playhead position (rAF-safe) */
  getMixPlayhead?: () => MixPlayheadInfo | null
  /** Whether mix playback is active */
  isMixPlaying?: boolean
}

/**
 * Renders a moving vertical playhead line over the timeline.
 * Supports both single-track (audioPlayerStore) and full-mix playback.
 * Uses direct DOM updates via rAF / store subscription to avoid React re-renders.
 */
export const Playhead = memo(function Playhead({
  positions,
  songs,
  pixelsPerSecond,
  trackHeight,
  getMixPlayhead,
  isMixPlaying,
}: PlayheadProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const rafRef = useRef(0)

  // ── Mix playback: rAF-driven loop ──
  useEffect(() => {
    const el = ref.current
    if (!el || !isMixPlaying || !getMixPlayhead) return

    const tick = () => {
      const info = getMixPlayhead()
      if (!info) {
        el.style.display = 'none'
      } else {
        const pos = positions[info.songIndex]
        const song = songs[info.songIndex]
        if (!pos || !song) {
          el.style.display = 'none'
        } else {
          const x =
            pos.left +
            (info.trackTime - (song.trimStart ?? 0)) * pixelsPerSecond

          if (x < pos.left || x > pos.left + pos.width) {
            el.style.display = 'none'
          } else {
            el.style.display = 'block'
            el.style.transform = `translateX(${x}px)`
          }
        }
      }

      // Always continue the loop — only useEffect cleanup should stop it
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [isMixPlaying, getMixPlayhead, songs, positions, pixelsPerSecond])

  // ── Single-track playback: store subscription ──
  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Skip store-based updates when mix is playing
    if (isMixPlaying) return

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

    update()

    const unsub = useAudioPlayerStore.subscribe(update)
    return unsub
  }, [songs, positions, pixelsPerSecond, isMixPlaying])

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
