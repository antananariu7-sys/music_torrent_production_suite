import { useRef, useState, useEffect, useCallback } from 'react'
import { WebAudioEngine } from '@/services/WebAudioEngine'
import type { CrossfadePlaybackInfo } from '@/services/WebAudioEngine'
import { useAudioPlayerStore } from '@/store/audioPlayerStore'
import type { CrossfadeCurveType } from '@shared/types/project.types'

interface CrossfadePreviewOptions {
  trackA: { filePath: string; duration: number; trimEnd?: number }
  trackB: { filePath: string; trimStart?: number }
  crossfadeDuration: number
  curveType: CrossfadeCurveType
}

export interface CrossfadePreviewReturn {
  isLoading: boolean
  isPlaying: boolean
  play: () => Promise<void>
  stop: () => void
  /** Current absolute position within track A (seconds) */
  trackATime: number
  /** Current absolute position within track B (seconds) */
  trackBTime: number
  /** Whether track B has actually started playing (after lead-in) */
  trackBActive: boolean
}

/** Lead-in/lead-out seconds around the crossfade zone */
const LEAD_SECONDS = 5

/**
 * Thin wrapper around WebAudioEngine.scheduleCrossfade().
 * Manages loading state, playhead tracking via rAF, and auto-stop.
 */
export function useCrossfadePreview(
  options: CrossfadePreviewOptions | null
): CrossfadePreviewReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [trackATime, setTrackATime] = useState(0)
  const [trackBTime, setTrackBTime] = useState(0)
  const [trackBActive, setTrackBActive] = useState(false)

  const rafRef = useRef<number>(0)
  const infoRef = useRef<CrossfadePlaybackInfo | null>(null)
  const trackBActiveRef = useRef(false)

  const engine = WebAudioEngine.getInstance()

  // ── rAF loop for smooth playhead updates ──────────────────────────────

  const updatePlayheads = useCallback(() => {
    const info = infoRef.current
    if (!info) return

    const elapsed = engine.getContextTime() - info.startTime
    setTrackATime(info.deckAOffset + elapsed)

    if (elapsed >= info.fadeStartDelay) {
      if (!trackBActiveRef.current) {
        trackBActiveRef.current = true
        setTrackBActive(true)
      }
      setTrackBTime(info.deckBOffset + (elapsed - info.fadeStartDelay))
    }

    if (engine.isAnyPlaying()) {
      rafRef.current = requestAnimationFrame(updatePlayheads)
    }
  }, [engine])

  // ── Stop ───────────────────────────────────────────────────────────────

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    infoRef.current = null
    engine.stopAll()
    setIsPlaying(false)
    trackBActiveRef.current = false
    setTrackBActive(false)
  }, [engine])

  // ── Play ───────────────────────────────────────────────────────────────

  const play = useCallback(async () => {
    if (!options) return
    const { trackA, trackB, crossfadeDuration, curveType } = options
    if (!trackA.filePath || !trackB.filePath || crossfadeDuration <= 0) return

    stop()
    setIsLoading(true)

    try {
      // Pause main audio player to avoid overlap
      useAudioPlayerStore.getState().pause()

      // Load buffers via engine (uses cache)
      await engine.loadDeck('A', trackA.filePath)
      await engine.loadDeck('B', trackB.filePath)

      // Compute start offsets
      const aEnd = trackA.trimEnd ?? trackA.duration
      const effectiveCrossfade = Math.min(crossfadeDuration, aEnd)
      if (effectiveCrossfade <= 0) return
      const crossfadeStart = aEnd - effectiveCrossfade
      const aOffset = Math.max(0, crossfadeStart - LEAD_SECONDS)
      const bOffset = trackB.trimStart ?? 0

      // Schedule crossfade via engine
      const info = engine.scheduleCrossfade({
        crossfadeDuration: effectiveCrossfade,
        curveType,
        leadSeconds: crossfadeStart - aOffset,
        deckAStartOffset: aOffset,
        deckBStartOffset: bOffset,
      })

      infoRef.current = info
      setTrackATime(info.deckAOffset)
      setTrackBTime(info.deckBOffset)
      setIsPlaying(true)
      setIsLoading(false)

      // Start playhead update loop
      rafRef.current = requestAnimationFrame(updatePlayheads)

      // Fallback timeout in case onended doesn't fire
      setTimeout(
        () => {
          if (infoRef.current === info) {
            stop()
          }
        },
        (info.totalDuration + 1) * 1000
      )
    } catch (error) {
      console.error('[CrossfadePreview] Failed:', error)
      setIsLoading(false)
      setIsPlaying(false)
    }
  }, [options, stop, engine, updatePlayheads])

  // ── Listen for engine stop/ended events ────────────────────────────────

  useEffect(() => {
    const unsubscribe = engine.addEventListener((event) => {
      if (event.type === 'ended' && !engine.isAnyPlaying() && infoRef.current) {
        cancelAnimationFrame(rafRef.current)
        infoRef.current = null
        setIsPlaying(false)
        trackBActiveRef.current = false
        setTrackBActive(false)
      }
    })
    return unsubscribe
  }, [engine])

  // ── Cleanup on unmount ─────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current)
      // Don't call stopAll — other hooks may be using the engine
    }
  }, [])

  return {
    isLoading,
    isPlaying,
    play,
    stop,
    trackATime,
    trackBTime,
    trackBActive,
  }
}
