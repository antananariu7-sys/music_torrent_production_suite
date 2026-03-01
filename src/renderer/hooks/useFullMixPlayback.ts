import { useState, useRef, useCallback, useEffect } from 'react'
import { WebAudioEngine } from '@/services/WebAudioEngine'
import { useAudioPlayerStore } from '@/store/audioPlayerStore'
import type { Song, AudioRegion } from '@shared/types/project.types'

export interface MixPlaybackState {
  isLoading: boolean
  isPlaying: boolean
  /** Global playhead position in seconds from mix start */
  globalTime: number
  /** Index of the track currently playing at the playhead */
  activeTrackIndex: number
}

export interface MixPlayheadInfo {
  /** Index into the songs array */
  songIndex: number
  /** Absolute time within the track (seconds, in buffer time) */
  trackTime: number
}

export interface MixPlaybackActions {
  /** Start playing the full mix from the beginning (or from a track index + seek time) */
  play: (startTrackIndex?: number, seekTime?: number) => Promise<void>
  /** Stop all mix playback */
  stop: () => void
  /** Get current per-track playhead position (for rAF loops). Returns null when not playing. */
  getMixPlayhead: () => MixPlayheadInfo | null
}

export type FullMixPlaybackReturn = MixPlaybackState & MixPlaybackActions

// ── Internal types for scheduling ──

/** A kept segment in buffer time (gap between removed regions) */
interface KeptSegment {
  /** Buffer start time (seconds) */
  start: number
  /** Buffer end time (seconds) */
  end: number
}

/** Mapping info for one kept segment within a track's mix schedule */
interface SegmentMapping {
  /** Wall-clock offset from this track's mix start */
  wallOffset: number
  /** Wall-clock duration of this segment */
  wallDuration: number
  /** Buffer start time */
  bufferStart: number
  /** Buffer end time */
  bufferEnd: number
}

/** Per-track scheduling info stored in session */
interface ScheduledTrack {
  /** Mix offset (wall-clock seconds from mix start) */
  mixOffset: number
  /** Total wall-clock duration of this track in the mix */
  wallDuration: number
  /** Playback rate */
  rate: number
  /** Segment mappings for playhead → buffer time conversion */
  segments: SegmentMapping[]
  /** All source nodes (one per segment) */
  sources: AudioBufferSourceNode[]
  /** Gain node (shared across all segments) */
  gain: GainNode
}

// ── Helpers ──

/**
 * Compute kept segments within [trimStart, trimEnd] by removing enabled regions.
 */
function computeKeptSegments(
  trimStart: number,
  trimEnd: number,
  regions: AudioRegion[]
): KeptSegment[] {
  const enabled = regions
    .filter((r) => r.enabled)
    .sort((a, b) => a.startTime - b.startTime)

  if (enabled.length === 0) {
    return [{ start: trimStart, end: trimEnd }]
  }

  const kept: KeptSegment[] = []
  let cursor = trimStart

  for (const region of enabled) {
    const rStart = Math.max(region.startTime, trimStart)
    const rEnd = Math.min(region.endTime, trimEnd)
    if (rStart >= rEnd) continue // region outside trim bounds
    if (cursor < rStart) {
      kept.push({ start: cursor, end: rStart })
    }
    cursor = Math.max(cursor, rEnd)
  }
  if (cursor < trimEnd) {
    kept.push({ start: cursor, end: trimEnd })
  }

  return kept
}

/**
 * Hook for full-mix real-time preview playback on the Timeline tab.
 * Loads all track buffers, schedules sequential playback with crossfades,
 * supports seeking and skips removed regions.
 */
export function useFullMixPlayback(songs: Song[]): FullMixPlaybackReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [globalTime, setGlobalTime] = useState(0)
  const [activeTrackIndex, setActiveTrackIndex] = useState(0)

  const rafRef = useRef(0)
  /** Incremented on each play() call so stale async calls bail out */
  const playGenRef = useRef(0)
  /** All live audio nodes — drained on every stop/play to guarantee cleanup */
  const liveNodesRef = useRef<{
    sources: AudioBufferSourceNode[]
    gains: GainNode[]
  }>({
    sources: [],
    gains: [],
  })
  const sessionRef = useRef<{
    tracks: ScheduledTrack[]
    mixStartCtx: number
    totalDuration: number
    startTrackIndex: number
  } | null>(null)

  const engine = WebAudioEngine.getInstance()

  /** Stop and disconnect all tracked audio nodes */
  const killAllNodes = useCallback(() => {
    const { sources, gains } = liveNodesRef.current
    for (const s of sources) {
      try {
        s.onended = null
        s.stop()
        s.disconnect()
      } catch {
        /* */
      }
    }
    for (const g of gains) {
      try {
        g.disconnect()
      } catch {
        /* */
      }
    }
    liveNodesRef.current = { sources: [], gains: [] }
  }, [])

  // ── rAF loop for playhead updates ──

  const updatePlayhead = useCallback(() => {
    const session = sessionRef.current
    if (!session) return

    const ctx = engine.getContextTime()
    const elapsed = Math.max(0, ctx - session.mixStartCtx)
    setGlobalTime(Math.min(elapsed, session.totalDuration))

    // Determine active track
    for (let i = session.tracks.length - 1; i >= 0; i--) {
      if (elapsed >= session.tracks[i].mixOffset) {
        setActiveTrackIndex(session.startTrackIndex + i)
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
    async (startTrackIndex = 0, seekTime?: number) => {
      if (songs.length === 0) return

      // Stop existing playback
      stop()
      useAudioPlayerStore.getState().pause()
      engine.stopAll()

      // Generation counter — if another play() fires while we await, bail out
      const gen = ++playGenRef.current

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

        // Bail out if a newer play() call has superseded this one
        if (gen !== playGenRef.current) return

        if (buffers.length === 0) return

        const ctx = await engine.getAudioContext()
        const now = ctx.currentTime + 0.05 // small offset for scheduling

        const scheduledTracks: ScheduledTrack[] = []
        const volume = engine.getVolume()
        let mixOffset = 0

        for (let i = 0; i < tracksToPlay.length; i++) {
          const song = tracksToPlay[i]
          const buffer = buffers[i]
          if (!buffer) continue

          const trimStart = song.trimStart ?? 0
          const trimEnd = song.trimEnd ?? buffer.duration
          const rate = song.tempoAdjustment ?? 1

          // Compute kept segments (skip muted regions)
          let keptSegments = computeKeptSegments(
            trimStart,
            trimEnd,
            song.regions ?? []
          )

          // For the first track, trim segments to start from seekTime
          if (i === 0 && seekTime != null && seekTime > trimStart) {
            keptSegments = keptSegments.reduce<KeptSegment[]>((acc, seg) => {
              if (seg.end <= seekTime) return acc
              if (seg.start < seekTime) {
                acc.push({ start: seekTime, end: seg.end })
              } else {
                acc.push(seg)
              }
              return acc
            }, [])
          }

          if (keptSegments.length === 0) continue

          // Create shared gain node for this track
          const gain = ctx.createGain()
          gain.gain.value = volume
          gain.connect(ctx.destination)
          liveNodesRef.current.gains.push(gain)

          // Schedule one source per kept segment
          const sources: AudioBufferSourceNode[] = []
          const segments: SegmentMapping[] = []
          let segWallOffset = 0

          for (const seg of keptSegments) {
            const segBufDuration = seg.end - seg.start
            const segWallDuration = segBufDuration / rate

            const source = ctx.createBufferSource()
            source.buffer = buffer
            source.playbackRate.value = rate
            source.connect(gain)

            const segCtxStart = now + mixOffset + segWallOffset
            source.start(segCtxStart, seg.start, segBufDuration)
            sources.push(source)
            liveNodesRef.current.sources.push(source)

            segments.push({
              wallOffset: segWallOffset,
              wallDuration: segWallDuration,
              bufferStart: seg.start,
              bufferEnd: seg.end,
            })

            segWallOffset += segWallDuration
          }

          const trackWallDuration = segWallOffset
          const ctxStart = now + mixOffset

          // Schedule fade-in from previous track's crossfade
          if (i > 0) {
            const prevSong = tracksToPlay[i - 1]
            const crossfade = prevSong.crossfadeDuration ?? 0
            if (crossfade > 0) {
              gain.gain.setValueAtTime(0, ctxStart)
              gain.gain.linearRampToValueAtTime(
                volume,
                ctxStart + crossfade / rate
              )
            }
          }

          // Schedule fade-out for crossfade into next track
          if (i < tracksToPlay.length - 1) {
            const crossfade = song.crossfadeDuration ?? 0
            if (crossfade > 0) {
              const fadeStart = ctxStart + trackWallDuration - crossfade / rate
              gain.gain.setValueAtTime(volume, fadeStart)
              gain.gain.linearRampToValueAtTime(0, fadeStart + crossfade / rate)
            }
          }

          scheduledTracks.push({
            mixOffset,
            wallDuration: trackWallDuration,
            rate,
            segments,
            sources,
            gain,
          })

          // Next track starts after this track minus crossfade overlap
          const crossfade =
            i < tracksToPlay.length - 1 ? (song.crossfadeDuration ?? 0) : 0
          mixOffset += trackWallDuration - crossfade / rate
        }

        if (scheduledTracks.length === 0) return

        const totalDuration = mixOffset
        // Auto-stop when last source of last track ends
        const lastTrack = scheduledTracks[scheduledTracks.length - 1]
        const lastSource = lastTrack.sources[lastTrack.sources.length - 1]
        lastSource.onended = () => {
          setIsPlaying(false)
          sessionRef.current = null
        }

        sessionRef.current = {
          tracks: scheduledTracks,
          mixStartCtx: now,
          totalDuration,
          startTrackIndex,
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
    killAllNodes()
    sessionRef.current = null
    cancelAnimationFrame(rafRef.current)
    setIsPlaying(false)
    setGlobalTime(0)
  }, [killAllNodes])

  // ── getMixPlayhead ──

  const getMixPlayhead = useCallback((): MixPlayheadInfo | null => {
    const session = sessionRef.current
    if (!session) return null

    const elapsed = Math.max(0, engine.getContextTime() - session.mixStartCtx)
    if (elapsed >= session.totalDuration) return null

    // Find active track
    let trackIdx = 0
    for (let i = session.tracks.length - 1; i >= 0; i--) {
      if (elapsed >= session.tracks[i].mixOffset) {
        trackIdx = i
        break
      }
    }

    const track = session.tracks[trackIdx]
    const trackElapsed = elapsed - track.mixOffset

    // Map wall-clock elapsed to buffer time using segment mappings
    let bufferTime = track.segments[0]?.bufferStart ?? 0
    for (const seg of track.segments) {
      if (trackElapsed < seg.wallOffset + seg.wallDuration) {
        const segElapsed = trackElapsed - seg.wallOffset
        bufferTime = seg.bufferStart + segElapsed * track.rate
        break
      }
      // Past this segment, default to end of last visited segment
      bufferTime = seg.bufferEnd
    }

    return {
      songIndex: session.startTrackIndex + trackIdx,
      trackTime: bufferTime,
    }
  }, [engine])

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
    getMixPlayhead,
  }
}
