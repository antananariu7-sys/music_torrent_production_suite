import { useRef, useEffect, memo } from 'react'

interface EnergyOverlayProps {
  /** Energy profile values (0–1), typically ~200 points */
  energyProfile: number[]
  /** Canvas width in CSS pixels */
  width: number
  /** Canvas height in CSS pixels */
  height: number
}

/**
 * Renders a semi-transparent energy curve overlay on a canvas.
 * Positioned absolutely on top of the waveform.
 */
export const EnergyOverlay = memo(function EnergyOverlay({
  energyProfile,
  width,
  height,
}: EnergyOverlayProps): JSX.Element | null {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || energyProfile.length === 0 || width <= 0 || height <= 0)
      return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    const points = energyProfile.length
    const stepX = width / (points - 1 || 1)

    // Draw filled area
    ctx.beginPath()
    ctx.moveTo(0, height)
    for (let i = 0; i < points; i++) {
      const x = i * stepX
      const y = height - energyProfile[i] * height
      ctx.lineTo(x, y)
    }
    ctx.lineTo(width, height)
    ctx.closePath()
    ctx.fillStyle = 'rgba(99, 102, 241, 0.12)' // brand/indigo at 12% opacity
    ctx.fill()

    // Draw line on top
    ctx.beginPath()
    for (let i = 0; i < points; i++) {
      const x = i * stepX
      const y = height - energyProfile[i] * height
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)' // brand/indigo at 40% opacity
    ctx.lineWidth = 1.5
    ctx.stroke()
  }, [energyProfile, width, height])

  if (energyProfile.length === 0 || width <= 0 || height <= 0) return null

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
