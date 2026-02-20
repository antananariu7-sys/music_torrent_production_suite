import { useRef, useEffect } from 'react'
import { Box } from '@chakra-ui/react'

interface WaveformCanvasProps {
  peaks: number[]
  width: number
  height?: number
  color?: string
  isSelected?: boolean
}

/**
 * Renders audio waveform peaks as mirrored vertical bars on a canvas.
 * One canvas per track for performance and hit detection simplicity.
 */
export function WaveformCanvas({
  peaks,
  width,
  height = 80,
  color = '#3b82f6',
  isSelected = false,
}: WaveformCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || peaks.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    // Clear
    ctx.clearRect(0, 0, width, height)

    // Draw mirrored waveform bars
    const centerY = height / 2
    const halfHeight = height / 2 - 2 // 2px padding
    const barWidth = width / peaks.length
    const minBarWidth = Math.max(1, barWidth)

    ctx.fillStyle = color

    for (let i = 0; i < peaks.length; i++) {
      const x = i * barWidth
      const peakHeight = peaks[i] * halfHeight
      if (peakHeight < 0.5) continue // skip silent parts for performance

      ctx.fillRect(
        x,
        centerY - peakHeight,
        minBarWidth,
        peakHeight * 2
      )
    }
  }, [peaks, width, height, color])

  return (
    <Box
      borderWidth={isSelected ? '2px' : '1px'}
      borderColor={isSelected ? 'blue.500' : 'border.base'}
      borderRadius="sm"
      overflow="hidden"
      cursor="pointer"
      transition="border-color 0.15s"
    >
      <canvas
        ref={canvasRef}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          display: 'block',
        }}
      />
    </Box>
  )
}
