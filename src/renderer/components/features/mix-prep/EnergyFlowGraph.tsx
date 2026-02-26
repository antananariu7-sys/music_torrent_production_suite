import { useRef, useEffect, useState, useCallback } from 'react'
import { Box } from '@chakra-ui/react'
import type { Song } from '@shared/types/project.types'

interface EnergyFlowGraphProps {
  songs: Song[]
  height?: number
}

/**
 * Canvas-based full-mix energy flow visualization.
 * Concatenates each track's energyProfile into a continuous area chart
 * with gradient coloring and track boundary markers.
 */
export function EnergyFlowGraph({
  songs,
  height = 80,
}: EnergyFlowGraphProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [width, setWidth] = useState(0)

  // Track container width with ResizeObserver
  const handleResize = useCallback(() => {
    if (containerRef.current) {
      setWidth(containerRef.current.clientWidth)
    }
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver(handleResize)
    observer.observe(el)
    handleResize()

    return () => observer.disconnect()
  }, [handleResize])

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || width <= 0 || songs.length === 0) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    // Build concatenated energy data with track boundaries
    const segments: { points: number[]; title: string }[] = []
    let totalPoints = 0

    for (const song of songs) {
      const profile =
        song.energyProfile && song.energyProfile.length > 0
          ? song.energyProfile
          : Array(20).fill(0.5)
      segments.push({ points: profile, title: song.title })
      totalPoints += profile.length
    }

    if (totalPoints === 0) return

    // Draw filled area chart with gradient
    const gradient = ctx.createLinearGradient(0, height, 0, 0)
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.1)')
    gradient.addColorStop(0.5, 'rgba(245, 158, 11, 0.3)')
    gradient.addColorStop(1, 'rgba(239, 68, 68, 0.4)')

    ctx.beginPath()
    ctx.moveTo(0, height)

    let xOffset = 0
    for (const seg of segments) {
      const segWidth = (seg.points.length / totalPoints) * width
      for (let i = 0; i < seg.points.length; i++) {
        const x = xOffset + (i / (seg.points.length - 1 || 1)) * segWidth
        const y = height - seg.points[i] * height * 0.9 // Leave 10% margin at top
        ctx.lineTo(x, y)
      }
      xOffset += segWidth
    }

    ctx.lineTo(width, height)
    ctx.closePath()
    ctx.fillStyle = gradient
    ctx.fill()

    // Draw curve line
    ctx.beginPath()
    xOffset = 0
    for (const seg of segments) {
      const segWidth = (seg.points.length / totalPoints) * width
      for (let i = 0; i < seg.points.length; i++) {
        const x = xOffset + (i / (seg.points.length - 1 || 1)) * segWidth
        const y = height - seg.points[i] * height * 0.9
        if (xOffset === 0 && i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }
      xOffset += segWidth
    }
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.7)'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Draw vertical dashed lines at track boundaries + labels
    ctx.setLineDash([3, 3])
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
    ctx.lineWidth = 1
    ctx.font = '9px system-ui'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'

    xOffset = 0
    for (let s = 0; s < segments.length; s++) {
      const segWidth = (segments[s].points.length / totalPoints) * width

      // Track label at top
      const labelX = xOffset + 4
      ctx.fillText(truncateLabel(segments[s].title, segWidth - 8), labelX, 10)

      // Boundary line (skip first)
      if (s > 0) {
        ctx.beginPath()
        ctx.moveTo(xOffset, 0)
        ctx.lineTo(xOffset, height)
        ctx.stroke()
      }

      xOffset += segWidth
    }
    ctx.setLineDash([])
  }, [width, height, songs])

  return (
    <Box ref={containerRef} w="100%">
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: `${height}px` }}
      />
    </Box>
  )
}

function truncateLabel(text: string, maxWidth: number): string {
  // Rough estimate: ~5px per character at 9px font
  const maxChars = Math.floor(maxWidth / 5)
  if (maxChars < 3) return ''
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars - 1) + '…'
}
