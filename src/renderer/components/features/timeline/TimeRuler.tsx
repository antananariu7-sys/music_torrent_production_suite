import { useRef, useEffect } from 'react'
import { Box } from '@chakra-ui/react'
import { useTimelineStore } from '@/store/timelineStore'

interface TimeRulerProps {
  totalWidth: number
  pixelsPerSecond: number
}

const RULER_HEIGHT = 24
/** Extra pixels rendered beyond the visible viewport on each side */
const BUFFER = 300

function formatTime(seconds: number): string {
  const min = Math.floor(seconds / 60)
  const sec = Math.floor(seconds % 60)
  return `${min}:${sec.toString().padStart(2, '0')}`
}

/**
 * Determines tick intervals based on pixelsPerSecond (which embeds zoom).
 * Returns [majorInterval, minorInterval] in seconds.
 */
function getTickIntervals(pxPerSec: number): [number, number] {
  if (pxPerSec > 300) return [5, 1]
  if (pxPerSec > 150) return [10, 5]
  if (pxPerSec > 50) return [30, 10]
  return [60, 15]
}

/**
 * Horizontal time ruler rendered on a viewport-clipped canvas.
 * Only the visible portion + buffer is drawn to avoid exceeding
 * the browser's maximum canvas dimension at high zoom levels.
 */
export function TimeRuler({
  totalWidth,
  pixelsPerSecond,
}: TimeRulerProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scrollPosition = useTimelineStore((s) => s.scrollPosition)
  const viewportWidth = useTimelineStore((s) => s.viewportWidth)

  // Compute visible slice
  const visibleStart = Math.max(0, scrollPosition - BUFFER)
  const visibleEnd = Math.min(
    totalWidth,
    scrollPosition + viewportWidth + BUFFER
  )
  const visibleWidth = Math.max(0, visibleEnd - visibleStart)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || visibleWidth <= 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = visibleWidth * dpr
    canvas.height = RULER_HEIGHT * dpr
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, visibleWidth, RULER_HEIGHT)

    const [majorInterval, minorInterval] = getTickIntervals(pixelsPerSecond)
    const startTime = visibleStart / pixelsPerSecond
    const endTime = visibleEnd / pixelsPerSecond

    // Align to interval boundaries so ticks don't flicker during scroll
    const minorStart = Math.floor(startTime / minorInterval) * minorInterval
    const majorStart = Math.floor(startTime / majorInterval) * majorInterval

    // Draw minor ticks
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
    ctx.lineWidth = 1
    for (let t = minorStart; t <= endTime; t += minorInterval) {
      const x = Math.round(t * pixelsPerSecond - visibleStart) + 0.5
      if (x < -1 || x > visibleWidth + 1) continue
      ctx.beginPath()
      ctx.moveTo(x, RULER_HEIGHT - 6)
      ctx.lineTo(x, RULER_HEIGHT)
      ctx.stroke()
    }

    // Draw major ticks + labels
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
    ctx.font = '10px system-ui, sans-serif'
    ctx.textAlign = 'left'

    for (let t = majorStart; t <= endTime; t += majorInterval) {
      const x = Math.round(t * pixelsPerSecond - visibleStart) + 0.5
      if (x < -1 || x > visibleWidth + 1) continue
      ctx.beginPath()
      ctx.moveTo(x, RULER_HEIGHT - 12)
      ctx.lineTo(x, RULER_HEIGHT)
      ctx.stroke()

      ctx.fillText(formatTime(t), x + 3, RULER_HEIGHT - 13)
    }
  }, [visibleWidth, visibleStart, visibleEnd, pixelsPerSecond])

  return (
    <Box position="relative" h={`${RULER_HEIGHT}px`} minW={`${totalWidth}px`}>
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          left: `${visibleStart}px`,
          width: `${visibleWidth}px`,
          height: `${RULER_HEIGHT}px`,
          display: 'block',
        }}
      />
    </Box>
  )
}
