import { useRef, useEffect, useCallback } from 'react'
import { Box } from '@chakra-ui/react'
import { useTimelineStore } from '@/store/timelineStore'
import type { WaveformData } from '@shared/types/waveform.types'

interface TrackPosition {
  songId: string
  left: number
  width: number
}

interface MinimapProps {
  waveforms: Record<string, WaveformData>
  positions: TrackPosition[]
  totalWidth: number
  trackColors: string[]
}

const MINIMAP_HEIGHT = 40

/**
 * Downsample peaks to a target count for minimap rendering.
 */
function downsamplePeaks(peaks: number[], targetCount: number): number[] {
  if (peaks.length <= targetCount) return peaks
  const windowSize = Math.floor(peaks.length / targetCount)
  const result: number[] = []
  for (let i = 0; i < targetCount; i++) {
    let max = 0
    const start = i * windowSize
    const end = Math.min(start + windowSize, peaks.length)
    for (let j = start; j < end; j++) {
      if (peaks[j] > max) max = peaks[j]
    }
    result.push(max)
  }
  return result
}

/**
 * Small canvas showing full-mix overview with a draggable viewport rectangle.
 * Click to jump, drag viewport to scroll the main timeline.
 */
export function Minimap({
  waveforms,
  positions,
  totalWidth,
  trackColors,
}: MinimapProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  const scrollPosition = useTimelineStore((s) => s.scrollPosition)
  const viewportWidth = useTimelineStore((s) => s.viewportWidth)
  const setScrollPosition = useTimelineStore((s) => s.setScrollPosition)

  // Get measured container width for canvas sizing
  const containerWidth = useRef(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        containerWidth.current = entry.contentRect.width
        // Trigger re-draw by dispatching a state update
        drawMinimap()
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const drawMinimap = useCallback(() => {
    const canvas = canvasRef.current
    const cw = containerWidth.current
    if (!canvas || cw <= 0 || totalWidth <= 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = cw * dpr
    canvas.height = MINIMAP_HEIGHT * dpr
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, cw, MINIMAP_HEIGHT)

    // Draw background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)'
    ctx.fillRect(0, 0, cw, MINIMAP_HEIGHT)

    // Scale factor from timeline pixels to minimap pixels
    const scale = cw / totalWidth

    // Draw each track's waveform
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i]
      const waveform = waveforms[pos.songId]
      if (!waveform) continue

      const trackLeft = pos.left * scale
      const trackWidth = pos.width * scale
      const color = trackColors[i % trackColors.length]

      const miniPeaks = downsamplePeaks(waveform.peaks, Math.max(10, Math.floor(trackWidth)))
      const centerY = MINIMAP_HEIGHT / 2
      const halfHeight = MINIMAP_HEIGHT / 2 - 2
      const barWidth = trackWidth / miniPeaks.length

      ctx.fillStyle = color
      ctx.globalAlpha = 0.6

      for (let j = 0; j < miniPeaks.length; j++) {
        const x = trackLeft + j * barWidth
        const peakHeight = miniPeaks[j] * halfHeight
        if (peakHeight < 0.3) continue
        ctx.fillRect(x, centerY - peakHeight, Math.max(1, barWidth), peakHeight * 2)
      }
    }

    ctx.globalAlpha = 1.0

    // Draw viewport rectangle
    const vpLeft = scrollPosition * scale
    const vpWidth = Math.max(4, viewportWidth * scale)

    ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)'
    ctx.lineWidth = 1.5
    ctx.strokeRect(vpLeft + 0.5, 0.5, vpWidth - 1, MINIMAP_HEIGHT - 1)

    ctx.fillStyle = 'rgba(59, 130, 246, 0.1)'
    ctx.fillRect(vpLeft, 0, vpWidth, MINIMAP_HEIGHT)
  }, [positions, waveforms, totalWidth, trackColors, scrollPosition, viewportWidth])

  useEffect(() => {
    drawMinimap()
  }, [drawMinimap])

  const handleMouseEvent = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current
      const cw = containerWidth.current
      if (!canvas || cw <= 0 || totalWidth <= 0) return

      const rect = canvas.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      const scale = cw / totalWidth

      // Center viewport at clicked position
      const timelineX = clickX / scale
      const newScroll = Math.max(0, timelineX - viewportWidth / 2)
      setScrollPosition(newScroll)
    },
    [totalWidth, viewportWidth, setScrollPosition]
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isDragging.current = true
      handleMouseEvent(e)
    },
    [handleMouseEvent]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging.current) return
      handleMouseEvent(e)
    },
    [handleMouseEvent]
  )

  const handleMouseUp = useCallback(() => {
    isDragging.current = false
  }, [])

  return (
    <Box
      ref={containerRef}
      h={`${MINIMAP_HEIGHT}px`}
      bg="bg.surface"
      borderWidth="1px"
      borderColor="border.base"
      borderRadius="sm"
      overflow="hidden"
      cursor="pointer"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: `${MINIMAP_HEIGHT}px`,
          display: 'block',
        }}
      />
    </Box>
  )
}
