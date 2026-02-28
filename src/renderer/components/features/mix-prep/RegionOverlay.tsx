import { useRef, useEffect, useCallback, useState, memo } from 'react'
import type { AudioRegion } from '@shared/types/project.types'

interface RegionOverlayProps {
  regions: AudioRegion[]
  duration: number
  width: number
  height: number
  isEditing: boolean
  onToggleRegion?: (regionId: string) => void
  onDeleteRegion?: (regionId: string) => void
  onAddRegion?: (startTime: number, endTime: number) => void
}

/** Minimum drag distance (px) to create a region */
const MIN_DRAG_PX = 8

/** Draw a small muted speaker icon centered at (cx, cy) using canvas paths. */
function drawMutedSpeakerIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number
): void {
  const s = 6 // half-size of the icon
  ctx.save()
  ctx.translate(cx, cy)
  ctx.fillStyle = 'rgba(239, 68, 68, 0.55)'
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.55)'
  ctx.lineWidth = 1.5
  ctx.lineCap = 'round'

  // Speaker body (rectangle)
  ctx.fillRect(-s, -s * 0.35, s * 0.5, s * 0.7)
  // Speaker cone (triangle)
  ctx.beginPath()
  ctx.moveTo(-s * 0.5, -s * 0.35)
  ctx.lineTo(s * 0.15, -s * 0.8)
  ctx.lineTo(s * 0.15, s * 0.8)
  ctx.lineTo(-s * 0.5, s * 0.35)
  ctx.closePath()
  ctx.fill()

  // "X" mute slash lines
  ctx.beginPath()
  ctx.moveTo(s * 0.4, -s * 0.4)
  ctx.lineTo(s, s * 0.4)
  ctx.moveTo(s, -s * 0.4)
  ctx.lineTo(s * 0.4, s * 0.4)
  ctx.stroke()

  ctx.restore()
}

/**
 * Canvas overlay that renders removed audio regions with hatching.
 * When editing, supports drag-to-select (create), click (toggle), right-click (delete).
 */
export const RegionOverlay = memo(function RegionOverlay({
  regions,
  duration,
  width,
  height,
  isEditing,
  onToggleRegion,
  onDeleteRegion,
  onAddRegion,
}: RegionOverlayProps): JSX.Element | null {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dragStart, setDragStart] = useState<number | null>(null)
  const [dragEnd, setDragEnd] = useState<number | null>(null)

  // ── Drawing ──────────────────────────────────────────────────────────────────

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
      const x = (region.startTime / duration) * width
      const w = ((region.endTime - region.startTime) / duration) * width
      if (w <= 0) continue

      if (region.enabled) {
        // Enabled (removed) — red tint + hatch
        ctx.fillStyle = 'rgba(239, 68, 68, 0.18)'
        ctx.fillRect(x, 0, w, height)

        if (hatchPattern) {
          ctx.fillStyle = hatchPattern
          ctx.fillRect(x, 0, w, height)
        }

        ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)'
        ctx.lineWidth = 1
        ctx.strokeRect(x + 0.5, 0.5, w - 1, height - 1)

        // Draw muted speaker icon if region is wide enough
        if (w > 40) {
          drawMutedSpeakerIcon(ctx, x + w / 2, height / 2)
        }
      } else {
        // Disabled (restored) — faint gray dashed outline
        ctx.setLineDash([4, 3])
        ctx.strokeStyle = 'rgba(107, 114, 128, 0.4)'
        ctx.lineWidth = 1
        ctx.strokeRect(x + 0.5, 0.5, w - 1, height - 1)
        ctx.setLineDash([])
      }
    }

    // Draw drag preview
    if (dragStart != null && dragEnd != null) {
      const sx = Math.min(dragStart, dragEnd)
      const ex = Math.max(dragStart, dragEnd)
      const pw = ex - sx
      if (pw > MIN_DRAG_PX) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.15)'
        ctx.fillRect(sx, 0, pw, height)
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)'
        ctx.lineWidth = 1
        ctx.setLineDash([3, 3])
        ctx.strokeRect(sx + 0.5, 0.5, pw - 1, height - 1)
        ctx.setLineDash([])
      }
    }
  }, [regions, duration, width, height, dragStart, dragEnd])

  // ── Hit test ─────────────────────────────────────────────────────────────────

  const hitTestRegion = useCallback(
    (clientX: number): AudioRegion | null => {
      const canvas = canvasRef.current
      if (!canvas || duration <= 0) return null
      const rect = canvas.getBoundingClientRect()
      const x = clientX - rect.left
      const time = (x / width) * duration

      for (const region of regions) {
        if (time >= region.startTime && time <= region.endTime) {
          return region
        }
      }
      return null
    },
    [regions, duration, width]
  )

  // ── Drag to select ───────────────────────────────────────────────────────────

  const isDragging = useRef(false)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isEditing || e.button !== 0) return

      // If clicking on an existing region, toggle it
      const hit = hitTestRegion(e.clientX)
      if (hit) {
        onToggleRegion?.(hit.id)
        return
      }

      // Start drag-to-select
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      setDragStart(x)
      setDragEnd(x)
      isDragging.current = true
      canvas.setPointerCapture(e.pointerId)
    },
    [isEditing, hitTestRegion, onToggleRegion]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const x = Math.max(0, Math.min(width, e.clientX - rect.left))
      setDragEnd(x)
    },
    [width]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return
      isDragging.current = false

      const canvas = canvasRef.current
      if (canvas) canvas.releasePointerCapture(e.pointerId)

      if (dragStart != null && dragEnd != null) {
        const pxDist = Math.abs(dragEnd - dragStart)
        if (pxDist > MIN_DRAG_PX && duration > 0) {
          const t1 = (Math.min(dragStart, dragEnd) / width) * duration
          const t2 = (Math.max(dragStart, dragEnd) / width) * duration
          onAddRegion?.(t1, t2)
        }
      }

      setDragStart(null)
      setDragEnd(null)
    },
    [dragStart, dragEnd, duration, width, onAddRegion]
  )

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!isEditing) return
      e.preventDefault()
      const hit = hitTestRegion(e.clientX)
      if (hit) {
        onDeleteRegion?.(hit.id)
      }
    },
    [isEditing, hitTestRegion, onDeleteRegion]
  )

  if (width <= 0 || height <= 0 || duration <= 0) return null
  if (regions.length === 0 && !isEditing) return null

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width,
        height,
        pointerEvents: isEditing ? 'auto' : 'none',
        cursor: isEditing ? 'crosshair' : 'default',
        zIndex: isEditing ? 5 : 1,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onContextMenu={handleContextMenu}
    />
  )
})
