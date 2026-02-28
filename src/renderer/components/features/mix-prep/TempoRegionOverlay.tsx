import { useRef, useEffect, useCallback, useState, memo } from 'react'
import type { TempoRegion } from '@shared/types/project.types'

interface TempoRegionOverlayProps {
  /** Tempo adjustment rate (e.g. 1.02 = +2%) */
  tempoAdjustment: number
  /** Tempo region defining where adjustment applies */
  tempoRegion: TempoRegion
  /** Total track duration in seconds */
  duration: number
  /** Canvas width in CSS pixels */
  width: number
  /** Canvas height in CSS pixels */
  height: number
  /** Called when user drags the end handle to resize the region */
  onRegionChange?: (region: TempoRegion) => void
}

/** Minimum drag distance before starting resize */
const HANDLE_WIDTH = 8

/**
 * Canvas overlay showing the tempo adjustment region on a waveform.
 * Displays constant-speed zone + ramp-back zone with draggable end handle.
 */
export const TempoRegionOverlay = memo(function TempoRegionOverlay({
  tempoAdjustment,
  tempoRegion,
  duration,
  width,
  height,
  onRegionChange,
}: TempoRegionOverlayProps): JSX.Element | null {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef({ startX: 0, originalEndTime: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || width <= 0 || height <= 0 || duration <= 0) return

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
    const startPx = tempoRegion.startTime * pxPerSec
    const endPx = tempoRegion.endTime * pxPerSec
    const rampStartPx =
      (tempoRegion.endTime - tempoRegion.rampDuration) * pxPerSec
    const constantEndPx = Math.max(startPx, rampStartPx)

    // Constant-speed zone (solid purple tint)
    if (constantEndPx > startPx) {
      ctx.fillStyle = 'rgba(139, 92, 246, 0.1)'
      ctx.fillRect(startPx, 0, constantEndPx - startPx, height)
    }

    // Ramp-back zone (gradient purple → transparent)
    if (tempoRegion.rampDuration > 0 && endPx > constantEndPx) {
      const grad = ctx.createLinearGradient(constantEndPx, 0, endPx, 0)
      grad.addColorStop(0, 'rgba(139, 92, 246, 0.1)')
      grad.addColorStop(1, 'rgba(139, 92, 246, 0)')
      ctx.fillStyle = grad
      ctx.fillRect(constantEndPx, 0, endPx - constantEndPx, height)

      // Dashed line at ramp start
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.3)'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(constantEndPx + 0.5, 0)
      ctx.lineTo(constantEndPx + 0.5, height)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // End handle (solid line)
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.6)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(endPx, 0)
    ctx.lineTo(endPx, height)
    ctx.stroke()

    // Speed label
    const pct = ((tempoAdjustment - 1) * 100).toFixed(1)
    const sign = tempoAdjustment >= 1 ? '+' : ''
    const label = `Speed: ${sign}${pct}% → normal`
    ctx.font = '9px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(139, 92, 246, 0.7)'
    const labelX = (startPx + Math.min(endPx, constantEndPx)) / 2
    ctx.fillText(label, Math.max(labelX, 50), height - 10)
  }, [tempoAdjustment, tempoRegion, duration, width, height])

  // ── Drag to resize end handle ──

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!onRegionChange) return
      const canvas = canvasRef.current
      if (!canvas || duration <= 0) return

      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const pxPerSec = width / duration
      const endPx = tempoRegion.endTime * pxPerSec

      // Check if near the end handle
      if (Math.abs(x - endPx) > HANDLE_WIDTH) return

      setIsDragging(true)
      dragRef.current = { startX: x, originalEndTime: tempoRegion.endTime }
      canvas.setPointerCapture(e.pointerId)
      e.stopPropagation()
    },
    [onRegionChange, tempoRegion.endTime, duration, width]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || !onRegionChange) return
      const canvas = canvasRef.current
      if (!canvas || duration <= 0) return

      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const pxPerSec = width / duration
      const newEndTime = Math.max(
        tempoRegion.startTime + 1,
        Math.min(duration, x / pxPerSec)
      )
      const newRampDuration = Math.min(
        tempoRegion.rampDuration,
        newEndTime - tempoRegion.startTime
      )

      onRegionChange({
        ...tempoRegion,
        endTime: newEndTime,
        rampDuration: newRampDuration,
      })
    },
    [isDragging, onRegionChange, tempoRegion, duration, width]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return
      setIsDragging(false)
      const canvas = canvasRef.current
      if (canvas) canvas.releasePointerCapture(e.pointerId)
    },
    [isDragging]
  )

  if (width <= 0 || height <= 0 || duration <= 0) return null
  if (tempoAdjustment === 1) return null

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width,
        height,
        pointerEvents: onRegionChange ? 'auto' : 'none',
        cursor: isDragging ? 'ew-resize' : undefined,
        zIndex: 1,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    />
  )
})
