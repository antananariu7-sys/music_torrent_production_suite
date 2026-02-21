import { memo, useRef, useEffect } from 'react'

interface BeatGridProps {
  bpm: number
  firstBeatOffset: number
  trackWidth: number
  trackHeight: number
  pixelsPerSecond: number
  trimStart: number
}

/**
 * Renders vertical beat grid lines overlaid on a track's waveform.
 * Uses canvas for performance — draws hundreds of lines without DOM overhead.
 * Downbeats (every 4th) are visually distinct. Skips rendering
 * when beat density is too high to avoid visual noise.
 */
export const BeatGrid = memo(function BeatGrid({
  bpm,
  firstBeatOffset,
  trackWidth,
  trackHeight,
  pixelsPerSecond,
  trimStart,
}: BeatGridProps): JSX.Element | null {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const beatInterval = 60 / bpm
  const beatWidthPx = beatInterval * pixelsPerSecond

  // Skip when beats are too dense (< 3px apart)
  if (beatWidthPx < 3) return null

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width = trackWidth
    canvas.height = trackHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, trackWidth, trackHeight)

    const startTime = trimStart
    const endTime = startTime + trackWidth / pixelsPerSecond
    const firstBeatIndex = Math.ceil(
      (startTime - firstBeatOffset) / beatInterval
    )

    for (let i = firstBeatIndex; ; i++) {
      const t = firstBeatOffset + i * beatInterval
      if (t > endTime) break
      const x = (t - startTime) * pixelsPerSecond
      if (x < 0 || x > trackWidth) continue

      const isDownbeat = i % 4 === 0
      ctx.fillStyle = isDownbeat
        ? 'rgba(255,255,255,0.5)'
        : 'rgba(255,255,255,0.22)'
      ctx.fillRect(Math.round(x), 0, isDownbeat ? 2 : 1, trackHeight)
    }
  }, [
    firstBeatOffset,
    trackWidth,
    trackHeight,
    pixelsPerSecond,
    trimStart,
    beatInterval,
    beatWidthPx,
  ])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: `${trackWidth}px`,
        height: `${trackHeight}px`,
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  )
})
