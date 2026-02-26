import { useRef, useState, useEffect, useCallback } from 'react'
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
}

/** Lead-in/lead-out seconds around the crossfade zone */
const LEAD_SECONDS = 5
/** Number of gain curve samples for setValueCurveAtTime */
const CURVE_SAMPLES = 128

// ─── Gain curve generators ───────────────────────────────────────────

export function generateFadeOutCurve(
  type: CrossfadeCurveType,
  samples: number
): Float32Array {
  const curve = new Float32Array(samples)
  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1)
    switch (type) {
      case 'linear':
        curve[i] = 1 - t
        break
      case 'equal-power':
        curve[i] = Math.cos(t * Math.PI * 0.5)
        break
      case 's-curve':
        curve[i] = (1 + Math.cos(t * Math.PI)) / 2
        break
    }
  }
  return curve
}

export function generateFadeInCurve(
  type: CrossfadeCurveType,
  samples: number
): Float32Array {
  const curve = new Float32Array(samples)
  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1)
    switch (type) {
      case 'linear':
        curve[i] = t
        break
      case 'equal-power':
        curve[i] = Math.sin(t * Math.PI * 0.5)
        break
      case 's-curve':
        curve[i] = (1 - Math.cos(t * Math.PI)) / 2
        break
    }
  }
  return curve
}

// ─── Audio loading ───────────────────────────────────────────────────

async function fetchAndDecode(
  ctx: AudioContext,
  filePath: string
): Promise<AudioBuffer> {
  const url = `audio://play?path=${encodeURIComponent(filePath)}`
  const response = await fetch(url)
  const arrayBuffer = await response.arrayBuffer()
  return ctx.decodeAudioData(arrayBuffer)
}

// ─── Hook ────────────────────────────────────────────────────────────

export function useCrossfadePreview(
  options: CrossfadePreviewOptions | null
): CrossfadePreviewReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [trackATime, setTrackATime] = useState(0)
  const [trackBTime, setTrackBTime] = useState(0)

  const ctxRef = useRef<AudioContext | null>(null)
  const sourceARef = useRef<AudioBufferSourceNode | null>(null)
  const sourceBRef = useRef<AudioBufferSourceNode | null>(null)
  const rafRef = useRef<number>(0)
  const playbackParamsRef = useRef<{
    startTime: number
    aOffset: number
    fadeStartTime: number
    bOffset: number
  } | null>(null)
  const cacheRef = useRef<{
    pathA: string
    pathB: string
    bufferA: AudioBuffer
    bufferB: AudioBuffer
  } | null>(null)

  // rAF loop for smooth playhead updates
  const updatePlayheads = useCallback(() => {
    const ctx = ctxRef.current
    const params = playbackParamsRef.current
    if (!ctx || !params) return

    const elapsed = ctx.currentTime - params.startTime
    setTrackATime(params.aOffset + elapsed)

    if (elapsed >= params.fadeStartTime) {
      setTrackBTime(params.bOffset + (elapsed - params.fadeStartTime))
    }

    if (sourceARef.current || sourceBRef.current) {
      rafRef.current = requestAnimationFrame(updatePlayheads)
    }
  }, [])

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    playbackParamsRef.current = null
    try {
      sourceARef.current?.stop()
    } catch {
      /* already stopped */
    }
    try {
      sourceBRef.current?.stop()
    } catch {
      /* already stopped */
    }
    sourceARef.current?.disconnect()
    sourceBRef.current?.disconnect()
    sourceARef.current = null
    sourceBRef.current = null
    setIsPlaying(false)
  }, [])

  const play = useCallback(async () => {
    if (!options) return

    const { trackA, trackB, crossfadeDuration, curveType } = options
    if (!trackA.filePath || !trackB.filePath || crossfadeDuration <= 0) return

    // Stop any existing preview
    stop()

    setIsLoading(true)

    try {
      // Lazy-create AudioContext
      if (!ctxRef.current || ctxRef.current.state === 'closed') {
        ctxRef.current = new AudioContext()
      }
      const ctx = ctxRef.current

      // Resume if suspended (browser autoplay policy)
      if (ctx.state === 'suspended') {
        await ctx.resume()
      }

      // Pause main audio player
      useAudioPlayerStore.getState().pause()

      // Decode (use cache if same files)
      let bufferA: AudioBuffer
      let bufferB: AudioBuffer

      if (
        cacheRef.current &&
        cacheRef.current.pathA === trackA.filePath &&
        cacheRef.current.pathB === trackB.filePath
      ) {
        bufferA = cacheRef.current.bufferA
        bufferB = cacheRef.current.bufferB
      } else {
        ;[bufferA, bufferB] = await Promise.all([
          fetchAndDecode(ctx, trackA.filePath),
          fetchAndDecode(ctx, trackB.filePath),
        ])
        cacheRef.current = {
          pathA: trackA.filePath,
          pathB: trackB.filePath,
          bufferA,
          bufferB,
        }
      }

      // Compute playback window (clamp crossfade to track length)
      const aEnd = trackA.trimEnd ?? trackA.duration
      const effectiveCrossfade = Math.min(crossfadeDuration, aEnd)
      if (effectiveCrossfade <= 0) return
      const crossfadeStart = aEnd - effectiveCrossfade
      const aOffset = Math.max(0, crossfadeStart - LEAD_SECONDS)
      const aDuration = aEnd - aOffset

      const bTrimStart = trackB.trimStart ?? 0
      const bOffset = bTrimStart
      const bDuration = effectiveCrossfade + LEAD_SECONDS

      // Time within the preview when the crossfade zone begins
      const fadeStartTime = crossfadeStart - aOffset

      // Create source + gain for track A
      const sourceA = ctx.createBufferSource()
      sourceA.buffer = bufferA
      const gainA = ctx.createGain()
      gainA.gain.value = 1
      sourceA.connect(gainA).connect(ctx.destination)

      // Create source + gain for track B
      const sourceB = ctx.createBufferSource()
      sourceB.buffer = bufferB
      const gainB = ctx.createGain()
      gainB.gain.value = 0
      sourceB.connect(gainB).connect(ctx.destination)

      // Schedule gain automation
      const fadeOut = generateFadeOutCurve(curveType, CURVE_SAMPLES)
      const fadeIn = generateFadeInCurve(curveType, CURVE_SAMPLES)

      const now = ctx.currentTime
      gainA.gain.setValueCurveAtTime(
        fadeOut,
        now + fadeStartTime,
        effectiveCrossfade
      )
      gainB.gain.setValueCurveAtTime(
        fadeIn,
        now + fadeStartTime,
        effectiveCrossfade
      )

      // Start sources
      sourceA.start(now, aOffset, aDuration)
      sourceB.start(now + fadeStartTime, bOffset, bDuration)

      sourceARef.current = sourceA
      sourceBRef.current = sourceB

      // Store scheduling params for rAF playhead tracking
      playbackParamsRef.current = {
        startTime: now,
        aOffset,
        fadeStartTime,
        bOffset,
      }

      setIsPlaying(true)
      setIsLoading(false)

      // Start playhead update loop
      rafRef.current = requestAnimationFrame(updatePlayheads)

      // Auto-stop when both sources finish
      const totalDuration = fadeStartTime + effectiveCrossfade + LEAD_SECONDS
      sourceB.onended = () => {
        cancelAnimationFrame(rafRef.current)
        playbackParamsRef.current = null
        setIsPlaying(false)
        sourceARef.current = null
        sourceBRef.current = null
      }
      // Fallback timeout in case onended doesn't fire
      setTimeout(
        () => {
          if (sourceARef.current === sourceA) {
            stop()
          }
        },
        (totalDuration + 1) * 1000
      )
    } catch (error) {
      console.error('[CrossfadePreview] Failed:', error)
      setIsLoading(false)
      setIsPlaying(false)
    }
  }, [options, stop, updatePlayheads])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop()
      if (ctxRef.current && ctxRef.current.state !== 'closed') {
        ctxRef.current.close()
      }
      cacheRef.current = null
    }
  }, [stop])

  return { isLoading, isPlaying, play, stop, trackATime, trackBTime }
}
