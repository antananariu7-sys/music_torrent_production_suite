import { useState, useRef, useCallback, useEffect } from 'react'
import { WebAudioEngine } from '@/services/WebAudioEngine'
import { useAudioPlayerStore } from '@/store/audioPlayerStore'
import type { Song } from '@shared/types/project.types'

export interface MixPlaybackState {
  isLoading: boolean
  isPlaying: boolean
  /** Global playhead position in seconds from mix start */
  globalTime: number
  /** Index of the track currently playing at the playhead */
  activeTrackIndex: number
}

export interface MixPlaybackActions {
  /** Start playing the full mix from the beginning (or from a track index) */
  play: (startTrackIndex?: number) => Promise<void>
  /** Stop all mix playback */
  stop: () => void
}

export type FullMixPlaybackReturn = MixPlaybackState & MixPlaybackActions

interface TrackSchedule {
  /** Global start time (AudioContext.currentTime) when this track starts */
  ctxStart: number
  /** Global mix offset in seconds (from mix start) */
  mixOffset: number
  /** Duration of this track's audio in the mix */
  duration: number
  /** Source node */
  source: AudioBufferSourceNode
  /** Gain node for crossfade automation */
  gain: GainNode
}

/**
 * Hook for full-mix real-time preview playback on the Timeline tab.
 * Loads all track buffers, schedules sequential playback with crossfades.
 */
export function useFullMixPlayback(songs: Song[]): FullMixPlaybackReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [globalTime, setGlobalTime] = useState(0)
  const [activeTrackIndex, setActiveTrackIndex] = useState(0)

  const rafRef = useRef(0)
  const sessionRef = useRef<{
    schedules: TrackSchedule[]
    mixStartCtx: number
    totalDuration: number
  } | null>(null)

  const engine = WebAudioEngine.getInstance()

  // ── rAF loop for playhead updates ──

  const updatePlayhead = useCallback(() => {
    const session = sessionRef.current
    if (!session) return

    const ctx = engine.getContextTime()
    const elapsed = Math.max(0, ctx - session.mixStartCtx)
    setGlobalTime(Math.min(elapsed, session.totalDuration))

    // Determine active track
    for (let i = session.schedules.length - 1; i >= 0; i--) {
      if (elapsed >= session.schedules[i].mixOffset) {
        setActiveTrackIndex(i)
        break
      }
    }

    if (elapsed < session.totalDuration) {
      rafRef.current = requestAnimationFrame(updatePlayhead)
    } else {
      setIsPlaying(false)
      sessionRef.current = null
    }
  }, [engine])

  // ── Play ──

  const play = useCallback(
    async (startTrackIndex = 0) => {
      if (songs.length === 0) return

      // Stop existing playback
      stop()
      useAudioPlayerStore.getState().pause()
      engine.stopAll()

      setIsLoading(true)

      try {
        // Load all buffers
        const tracksToPlay = songs.slice(startTrackIndex)
        const filePaths = tracksToPlay.map(
          (s) => s.localFilePath ?? s.externalFilePath ?? ''
        )
        const buffers = await Promise.all(
          filePaths.filter(Boolean).map((fp) => engine.loadFile(fp))
        )

        if (buffers.length === 0) return

        const ctx = await engine.getAudioContext()

        const now = ctx.currentTime + 0.05 // small offset for scheduling
        const schedules: TrackSchedule[] = []
        let mixOffset = 0

        for (let i = 0; i < tracksToPlay.length; i++) {
          const song = tracksToPlay[i]
          const buffer = buffers[i]
          if (!buffer) continue

          const trimStart = song.trimStart ?? 0
          const trimEnd = song.trimEnd ?? buffer.duration
          const trackDuration = trimEnd - trimStart
          const rate = song.tempoAdjustment ?? 1

          const source = ctx.createBufferSource()
          source.buffer = buffer
          source.playbackRate.value = rate

          const gain = ctx.createGain()
          gain.gain.value = engine.getVolume()

          source.connect(gain).connect(ctx.destination)

          const ctxStart = now + mixOffset / rate

          // Schedule fade-in from previous track's crossfade
          if (i > 0) {
            const prevSong = tracksToPlay[i - 1]
            const crossfade = prevSong.crossfadeDuration ?? 0
            if (crossfade > 0) {
              // Start with zero gain, ramp up during crossfade
              gain.gain.setValueAtTime(0, ctxStart)
              gain.gain.linearRampToValueAtTime(
                engine.getVolume(),
                ctxStart + crossfade / rate
              )
            }
          }

          // Schedule fade-out for crossfade into next track
          if (i < tracksToPlay.length - 1) {
            const crossfade = song.crossfadeDuration ?? 0
            if (crossfade > 0) {
              const fadeStart = ctxStart + (trackDuration - crossfade) / rate
              gain.gain.setValueAtTime(engine.getVolume(), fadeStart)
              gain.gain.linearRampToValueAtTime(0, fadeStart + crossfade / rate)
            }
          }

          // Start the source
          source.start(ctxStart, trimStart, trackDuration / rate)

          schedules.push({
            ctxStart,
            mixOffset,
            duration: trackDuration / rate,
            source,
            gain,
          })

          // Next track starts after this track minus crossfade overlap
          const crossfade =
            i < tracksToPlay.length - 1 ? (song.crossfadeDuration ?? 0) : 0
          mixOffset += (trackDuration - crossfade) / rate
        }

        const totalDuration = mixOffset
        const lastTrack = schedules[schedules.length - 1]
        if (lastTrack) {
          // Auto-stop when last source ends
          lastTrack.source.onended = () => {
            setIsPlaying(false)
            sessionRef.current = null
          }
        }

        sessionRef.current = {
          schedules,
          mixStartCtx: now,
          totalDuration,
        }

        setIsPlaying(true)
        setGlobalTime(0)
        setActiveTrackIndex(startTrackIndex)
        rafRef.current = requestAnimationFrame(updatePlayhead)
      } catch (err) {
        console.error('[useFullMixPlayback] Failed:', err)
      } finally {
        setIsLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stop is stable (no deps), adding it creates circular ref
    [songs, engine, updatePlayhead]
  )

  // ── Stop ──

  const stop = useCallback(() => {
    const session = sessionRef.current
    if (session) {
      for (const sched of session.schedules) {
        try {
          sched.source.stop()
          sched.source.disconnect()
          sched.gain.disconnect()
        } catch {
          /* already stopped */
        }
      }
      sessionRef.current = null
    }
    cancelAnimationFrame(rafRef.current)
    setIsPlaying(false)
    setGlobalTime(0)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop()
    }
  }, [stop])

  return {
    isLoading,
    isPlaying,
    globalTime,
    activeTrackIndex,
    play,
    stop,
  }
}
