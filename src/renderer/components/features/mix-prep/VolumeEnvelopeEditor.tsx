import { useRef, useEffect, useCallback, useState, memo } from 'react'
import type { VolumePoint } from '@shared/types/project.types'

const POINT_RADIUS = 5
const POINT_HIT_RADIUS = 10
const LINE_COLOR = 'rgba(255, 255, 255, 0.6)'
const FILL_COLOR = 'rgba(255, 255, 255, 0.08)'
const POINT_COLOR = 'rgba(255, 255, 255, 0.85)'
const POINT_HOVER_COLOR = '#3b82f6'
const POINT_ACTIVE_COLOR = '#60a5fa'

interface VolumeEnvelopeEditorProps {
  envelope: VolumePoint[]
  duration: number
  width: number
  height: number
  onChange: (envelope: VolumePoint[]) => void
  trimStart?: number
  trimEnd?: number
}

/**
 * Interactive canvas overlay for editing volume envelope breakpoints.
 * Positioned absolutely over the waveform.
 *
 * - Click empty area → add breakpoint
 * - Drag breakpoint → move in time/value
 * - Right-click breakpoint → delete (min 1 point)
 */
export const VolumeEnvelopeEditor = memo(function VolumeEnvelopeEditor({
  envelope,
  duration,
  width,
  height,
  onChange,
  trimStart,
  trimEnd,
}: VolumeEnvelopeEditorProps): JSX.Element | null {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  const effectiveStart = trimStart ?? 0
  const effectiveDuration = (trimEnd ?? duration) - effectiveStart

  // ── Coordinate conversion ───────────────────────────────────────────────

  const timeToX = useCallback(
    (time: number) => {
      if (effectiveDuration <= 0) return 0
      return ((time - effectiveStart) / effectiveDuration) * width
    },
    [effectiveStart, effectiveDuration, width]
  )

  const valueToY = useCallback(
    (value: number) => height - value * height,
    [height]
  )

  const xToTime = useCallback(
    (x: number) => {
      const time = effectiveStart + (x / width) * effectiveDuration
      return Math.max(effectiveStart, Math.min(trimEnd ?? duration, time))
    },
    [effectiveStart, effectiveDuration, width, trimEnd, duration]
  )

  const yToValue = useCallback(
    (y: number) => Math.max(0, Math.min(1, 1 - y / height)),
    [height]
  )

  // ── Find point under cursor ─────────────────────────────────────────────

  const findPointAt = useCallback(
    (x: number, y: number): number | null => {
      for (let i = 0; i < envelope.length; i++) {
        const px = timeToX(envelope[i].time)
        const py = valueToY(envelope[i].value)
        const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2)
        if (dist <= POINT_HIT_RADIUS) return i
      }
      return null
    },
    [envelope, timeToX, valueToY]
  )

  // ── Drawing ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || width <= 0 || height <= 0 || effectiveDuration <= 0) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    const sorted = [...envelope].sort((a, b) => a.time - b.time)
    if (sorted.length === 0) return

    // Draw filled area below curve
    ctx.beginPath()
    ctx.moveTo(0, valueToY(sorted[0].value))
    for (const p of sorted) {
      ctx.lineTo(timeToX(p.time), valueToY(p.value))
    }
    ctx.lineTo(width, valueToY(sorted[sorted.length - 1].value))
    ctx.lineTo(width, height)
    ctx.lineTo(0, height)
    ctx.closePath()
    ctx.fillStyle = FILL_COLOR
    ctx.fill()

    // Draw lines between points
    ctx.beginPath()
    ctx.moveTo(0, valueToY(sorted[0].value))
    for (const p of sorted) {
      ctx.lineTo(timeToX(p.time), valueToY(p.value))
    }
    ctx.lineTo(width, valueToY(sorted[sorted.length - 1].value))
    ctx.strokeStyle = LINE_COLOR
    ctx.lineWidth = 2
    ctx.stroke()

    // Draw breakpoints
    for (let i = 0; i < sorted.length; i++) {
      const origIdx = envelope.indexOf(sorted[i])
      const px = timeToX(sorted[i].time)
      const py = valueToY(sorted[i].value)
      const isHovered = origIdx === hoveredIdx
      const isDragging = origIdx === dragIdx

      ctx.beginPath()
      ctx.arc(px, py, POINT_RADIUS, 0, Math.PI * 2)
      ctx.fillStyle = isDragging
        ? POINT_ACTIVE_COLOR
        : isHovered
          ? POINT_HOVER_COLOR
          : POINT_COLOR
      ctx.fill()
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)'
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }, [
    envelope,
    width,
    height,
    effectiveDuration,
    hoveredIdx,
    dragIdx,
    timeToX,
    valueToY,
  ])

  // ── Mouse handlers ──────────────────────────────────────────────────────

  const getCanvasPos = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const { x, y } = getCanvasPos(e)

      if (dragIdx !== null) {
        const newTime = xToTime(x)
        const newValue = yToValue(y)
        const updated = envelope.map((p, i) =>
          i === dragIdx ? { time: newTime, value: newValue } : p
        )
        onChange(updated)
        return
      }

      setHoveredIdx(findPointAt(x, y))
    },
    [dragIdx, envelope, onChange, xToTime, yToValue, findPointAt, getCanvasPos]
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return // only left click
      const { x, y } = getCanvasPos(e)
      const idx = findPointAt(x, y)

      if (idx !== null) {
        // Start dragging existing point
        setDragIdx(idx)
      } else {
        // Add new point
        const newPoint: VolumePoint = {
          time: xToTime(x),
          value: yToValue(y),
        }
        onChange([...envelope, newPoint])
      }
    },
    [envelope, onChange, findPointAt, xToTime, yToValue, getCanvasPos]
  )

  const handleMouseUp = useCallback(() => {
    setDragIdx(null)
  }, [])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      if (envelope.length <= 1) return // keep at least 1 point

      const { x, y } = getCanvasPos(e)
      const idx = findPointAt(x, y)
      if (idx !== null) {
        onChange(envelope.filter((_, i) => i !== idx))
        setHoveredIdx(null)
      }
    },
    [envelope, onChange, findPointAt, getCanvasPos]
  )

  const handleMouseLeave = useCallback(() => {
    setHoveredIdx(null)
    if (dragIdx !== null) setDragIdx(null)
  }, [dragIdx])

  if (width <= 0 || height <= 0 || effectiveDuration <= 0) return null

  return (
    <canvas
      ref={canvasRef}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onContextMenu={handleContextMenu}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width,
        height,
        cursor:
          dragIdx !== null
            ? 'grabbing'
            : hoveredIdx !== null
              ? 'grab'
              : 'crosshair',
        zIndex: 1,
      }}
    />
  )
})
