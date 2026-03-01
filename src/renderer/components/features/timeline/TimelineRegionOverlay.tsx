import { memo, useRef, useEffect } from 'react'
import type { AudioRegion } from '@shared/types/project.types'

interface TimelineRegionOverlayProps {
  regions: AudioRegion[]
  /** Visible start of the track (trimStart) */
  trimStart: number
  /** Visible end of the track (trimEnd) */
  trimEnd: number
  width: number
  height: number
}

/**
 * Display-only overlay that shows muted (enabled) regions on timeline tracks.
 * Uses a canvas with red tint + diagonal hatching, similar to mix-prep RegionOverlay
 * but mapped to the trimmed track range.
 */
export const TimelineRegionOverlay = memo(function TimelineRegionOverlay({
  regions,
  trimStart,
  trimEnd,
  width,
  height,
}: TimelineRegionOverlayProps): JSX.Element | null {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const visibleDuration = trimEnd - trimStart

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || width <= 0 || height <= 0 || visibleDuration <= 0) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    // Create diagonal hatching pattern
    const hatchCanvas = document.createElement('canvas')
    hatchCanvas.width = 8
    hatchCanvas.height = 8
    const hctx = hatchCanvas.getContext('2d')
    if (hctx) {
      hctx.strokeStyle = 'rgba(239, 68, 68, 0.35)'
      hctx.lineWidth = 1
      hctx.beginPath()
      hctx.moveTo(0, 8)
      hctx.lineTo(8, 0)
      hctx.stroke()
    }
    const hatchPattern = ctx.createPattern(hatchCanvas, 'repeat')

    for (const region of regions) {
      if (!region.enabled) continue // only show active (muted) regions

      // Clip region to visible trimmed range
      const rStart = Math.max(region.startTime, trimStart)
      const rEnd = Math.min(region.endTime, trimEnd)
      if (rStart >= rEnd) continue

      // Map to pixel coordinates within trimmed track
      const x = ((rStart - trimStart) / visibleDuration) * width
      const w = ((rEnd - rStart) / visibleDuration) * width
      if (w < 1) continue

      // Red tint fill
      ctx.fillStyle = 'rgba(239, 68, 68, 0.18)'
      ctx.fillRect(x, 0, w, height)

      // Hatching
      if (hatchPattern) {
        ctx.fillStyle = hatchPattern
        ctx.fillRect(x, 0, w, height)
      }

      // Border
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)'
      ctx.lineWidth = 1
      ctx.strokeRect(x + 0.5, 0.5, w - 1, height - 1)

      // Muted speaker icon for wide regions
      if (w > 40) {
        drawMutedSpeakerIcon(ctx, x + w / 2, height / 2)
      }
    }
  }, [regions, trimStart, visibleDuration, width, height])

  // Skip render when no enabled regions
  const hasEnabled = regions.some((r) => r.enabled)
  if (!hasEnabled || width <= 0 || height <= 0 || visibleDuration <= 0)
    return null

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width,
        height,
        pointerEvents: 'none',
        zIndex: 2,
      }}
    />
  )
})

/** Draw a small muted speaker icon centered at (cx, cy) */
function drawMutedSpeakerIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number
): void {
  const s = 6
  ctx.save()
  ctx.translate(cx, cy)
  ctx.fillStyle = 'rgba(239, 68, 68, 0.55)'
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.55)'
  ctx.lineWidth = 1.5
  ctx.lineCap = 'round'

  // Speaker body
  ctx.fillRect(-s, -s * 0.35, s * 0.5, s * 0.7)
  // Speaker cone
  ctx.beginPath()
  ctx.moveTo(-s * 0.5, -s * 0.35)
  ctx.lineTo(s * 0.15, -s * 0.8)
  ctx.lineTo(s * 0.15, s * 0.8)
  ctx.lineTo(-s * 0.5, s * 0.35)
  ctx.closePath()
  ctx.fill()

  // X mute lines
  ctx.beginPath()
  ctx.moveTo(s * 0.4, -s * 0.4)
  ctx.lineTo(s, s * 0.4)
  ctx.moveTo(s, -s * 0.4)
  ctx.lineTo(s * 0.4, s * 0.4)
  ctx.stroke()

  ctx.restore()
}
