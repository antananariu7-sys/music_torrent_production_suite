import { useRef, useEffect, memo } from 'react'

interface CrossfadeOverlayProps {
  /** Crossfade duration in seconds */
  crossfadeDuration: number
  /** Track trim start in seconds */
  trimStart: number
  /** Track trim end in seconds */
  trimEnd: number
  /** Total track duration in seconds */
  duration: number
  /** Canvas width in CSS pixels */
  width: number
  /** Canvas height in CSS pixels */
  height: number
  /** 'outgoing' = gradient at right edge, 'incoming' = gradient at left edge */
  role: 'outgoing' | 'incoming'
}

/**
 * Canvas overlay showing the crossfade zone on a waveform panel.
 * Outgoing: gradient from transparent → amber at the right edge (last N seconds).
 * Incoming: gradient from amber → transparent at the left edge (first N seconds).
 */
export const CrossfadeOverlay = memo(function CrossfadeOverlay({
  crossfadeDuration,
  trimStart,
  trimEnd,
  duration,
  width,
  height,
  role,
}: CrossfadeOverlayProps): JSX.Element | null {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || width <= 0 || height <= 0 || duration <= 0) return
    if (crossfadeDuration <= 0) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    const pxPerSec = width / duration
    const fadeWidthPx = crossfadeDuration * pxPerSec

    if (role === 'outgoing') {
      // Gradient zone at the right edge of the trimmed region
      const endPx = (trimEnd ?? duration) * pxPerSec
      const startPx = Math.max(0, endPx - fadeWidthPx)
      const grad = ctx.createLinearGradient(startPx, 0, endPx, 0)
      grad.addColorStop(0, 'rgba(245, 158, 11, 0)')
      grad.addColorStop(1, 'rgba(245, 158, 11, 0.2)')
      ctx.fillStyle = grad
      ctx.fillRect(startPx, 0, endPx - startPx, height)

      // Border line at fade start
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 3])
      ctx.beginPath()
      ctx.moveTo(startPx + 0.5, 0)
      ctx.lineTo(startPx + 0.5, height)
      ctx.stroke()
      ctx.setLineDash([])

      // Label
      drawLabel(ctx, `Crossfade ${crossfadeDuration}s`, startPx, endPx, height)
    } else {
      // Gradient zone at the left edge of the trimmed region
      const startPx = (trimStart ?? 0) * pxPerSec
      const endPx = Math.min(width, startPx + fadeWidthPx)
      const grad = ctx.createLinearGradient(startPx, 0, endPx, 0)
      grad.addColorStop(0, 'rgba(245, 158, 11, 0.2)')
      grad.addColorStop(1, 'rgba(245, 158, 11, 0)')
      ctx.fillStyle = grad
      ctx.fillRect(startPx, 0, endPx - startPx, height)

      // Border line at fade end
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 3])
      ctx.beginPath()
      ctx.moveTo(endPx + 0.5, 0)
      ctx.lineTo(endPx + 0.5, height)
      ctx.stroke()
      ctx.setLineDash([])

      // Label
      drawLabel(ctx, `Crossfade ${crossfadeDuration}s`, startPx, endPx, height)
    }
  }, [crossfadeDuration, trimStart, trimEnd, duration, width, height, role])

  if (crossfadeDuration <= 0 || width <= 0 || height <= 0 || duration <= 0) {
    return null
  }

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
      }}
    />
  )
})

function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  startPx: number,
  endPx: number,
  height: number
): void {
  const zoneMid = (startPx + endPx) / 2
  ctx.font = '9px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(245, 158, 11, 0.7)'
  ctx.fillText(text, zoneMid, height - 10)
}
