import { useRef, useEffect } from 'react'
import { Box } from '@chakra-ui/react'

interface TimeRulerProps {
  totalWidth: number
  pixelsPerSecond: number
}

const RULER_HEIGHT = 24

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
 * Horizontal time ruler rendered on a canvas.
 * Placed inside the same scroll container as the timeline
 * so it scrolls naturally with the waveforms.
 */
export function TimeRuler({ totalWidth, pixelsPerSecond }: TimeRulerProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || totalWidth <= 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = totalWidth * dpr
    canvas.height = RULER_HEIGHT * dpr
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, totalWidth, RULER_HEIGHT)

    const [majorInterval, minorInterval] = getTickIntervals(pixelsPerSecond)
    const totalSeconds = totalWidth / pixelsPerSecond

    // Draw minor ticks
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
    ctx.lineWidth = 1
    for (let t = 0; t <= totalSeconds; t += minorInterval) {
      const x = Math.round(t * pixelsPerSecond) + 0.5
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

    for (let t = 0; t <= totalSeconds; t += majorInterval) {
      const x = Math.round(t * pixelsPerSecond) + 0.5
      ctx.beginPath()
      ctx.moveTo(x, RULER_HEIGHT - 12)
      ctx.lineTo(x, RULER_HEIGHT)
      ctx.stroke()

      ctx.fillText(formatTime(t), x + 3, RULER_HEIGHT - 13)
    }
  }, [totalWidth, pixelsPerSecond])

  return (
    <Box h={`${RULER_HEIGHT}px`} minW={`${totalWidth}px`}>
      <canvas
        ref={canvasRef}
        style={{
          width: `${totalWidth}px`,
          height: `${RULER_HEIGHT}px`,
          display: 'block',
        }}
      />
    </Box>
  )
}
