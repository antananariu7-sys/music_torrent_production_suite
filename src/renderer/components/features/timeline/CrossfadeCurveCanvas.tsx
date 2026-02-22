import { useRef, useEffect, memo } from 'react'
import type { CrossfadeCurveType } from '@shared/types/project.types'

interface CrossfadeCurveCanvasProps {
  width: number
  height: number
  curveType: CrossfadeCurveType
  colorA: string
  colorB: string
}

/** Number of sample points for curve rendering */
const CURVE_POINTS = 100

/**
 * Compute fade-out (descending) and fade-in (ascending) gain values
 * for a given curve type at normalized position t (0..1).
 */
export function computeGains(
  t: number,
  curveType: CrossfadeCurveType
): { fadeOut: number; fadeIn: number } {
  switch (curveType) {
    case 'linear':
      return { fadeOut: 1 - t, fadeIn: t }
    case 'equal-power':
      return {
        fadeOut: Math.cos((t * Math.PI) / 2),
        fadeIn: Math.sin((t * Math.PI) / 2),
      }
    case 's-curve':
      return {
        fadeOut: (1 + Math.cos(t * Math.PI)) / 2,
        fadeIn: (1 - Math.cos(t * Math.PI)) / 2,
      }
  }
}

/**
 * Canvas rendering of crossfade curves in the overlap zone.
 * Shows fade-out (descending) and fade-in (ascending) curves
 * with filled areas under each curve.
 */
export const CrossfadeCurveCanvas = memo(function CrossfadeCurveCanvas({
  width,
  height,
  curveType,
  colorA,
  colorB,
}: CrossfadeCurveCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || width <= 0 || height <= 0) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    // Draw filled area under fade-out curve (track A)
    drawCurve(ctx, width, height, curveType, colorA, 'fadeOut')
    // Draw filled area under fade-in curve (track B)
    drawCurve(ctx, width, height, curveType, colorB, 'fadeIn')
  }, [width, height, curveType, colorA, colorB])

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        width: `${width}px`,
        height: `${height}px`,
      }}
    />
  )
})

function drawCurve(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  curveType: CrossfadeCurveType,
  color: string,
  direction: 'fadeOut' | 'fadeIn'
): void {
  const path = new Path2D()
  path.moveTo(0, height)

  for (let i = 0; i <= CURVE_POINTS; i++) {
    const t = i / CURVE_POINTS
    const x = t * width
    const gains = computeGains(t, curveType)
    const gain = direction === 'fadeOut' ? gains.fadeOut : gains.fadeIn
    const y = height - gain * height
    if (i === 0) {
      path.lineTo(x, y)
    } else {
      path.lineTo(x, y)
    }
  }

  // Close path along the bottom
  path.lineTo(width, height)
  path.closePath()

  ctx.save()
  ctx.globalAlpha = 0.2
  ctx.fillStyle = color
  ctx.fill(path)

  // Draw the curve line itself
  ctx.globalAlpha = 0.6
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5

  const line = new Path2D()
  for (let i = 0; i <= CURVE_POINTS; i++) {
    const t = i / CURVE_POINTS
    const x = t * width
    const gains = computeGains(t, curveType)
    const gain = direction === 'fadeOut' ? gains.fadeOut : gains.fadeIn
    const y = height - gain * height
    if (i === 0) {
      line.moveTo(x, y)
    } else {
      line.lineTo(x, y)
    }
  }
  ctx.stroke(line)
  ctx.restore()
}
