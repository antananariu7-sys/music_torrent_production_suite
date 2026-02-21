import { useRef, useEffect } from 'react'
import { Box } from '@chakra-ui/react'

/** Convert a hex color to rgba with the given alpha */
function colorWithAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/** Create a vertical gradient (bright at peaks, 40% alpha at center) */
function createBarGradient(
  ctx: CanvasRenderingContext2D,
  height: number,
  hex: string
): CanvasGradient {
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, hex)
  gradient.addColorStop(0.5, colorWithAlpha(hex, 0.4))
  gradient.addColorStop(1, hex)
  return gradient
}

/**
 * Frequency band colors per spec:
 * Bass-dominant (<250 Hz): warm red-orange
 * Mid-dominant (250 Hz – 4 kHz): yellow-green
 * High-dominant (>4 kHz): cyan-blue
 */
const BAND_COLORS = {
  low: '#ef4444',
  mid: '#22c55e',
  high: '#06b6d4',
}

/** Minimum peak threshold for reliable frequency coloring */
const FREQ_THRESHOLD = 0.02

interface WaveformCanvasProps {
  peaks: number[]
  peaksLow?: number[]
  peaksMid?: number[]
  peaksHigh?: number[]
  frequencyColorMode?: boolean
  width: number
  height?: number
  color?: string
  isSelected?: boolean
}

/**
 * Renders audio waveform peaks as mirrored vertical bars on a canvas.
 * Supports frequency-colored mode when 3-band peak data is available.
 */
export function WaveformCanvas({
  peaks,
  peaksLow,
  peaksMid,
  peaksHigh,
  frequencyColorMode = false,
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

    const hasFrequencyData =
      frequencyColorMode &&
      peaksLow &&
      peaksMid &&
      peaksHigh &&
      peaksLow.length === peaks.length

    if (hasFrequencyData) {
      // Frequency-colored mode: pre-create gradients for each band
      const gradientLow = createBarGradient(ctx, height, BAND_COLORS.low)
      const gradientMid = createBarGradient(ctx, height, BAND_COLORS.mid)
      const gradientHigh = createBarGradient(ctx, height, BAND_COLORS.high)
      const gradientFallback = createBarGradient(ctx, height, color)

      // Batch bars by band to minimize fillStyle switches
      const bars: Array<{
        x: number
        y: number
        w: number
        h: number
        band: 'low' | 'mid' | 'high' | 'fallback'
      }> = []

      for (let i = 0; i < peaks.length; i++) {
        const peakHeight = peaks[i] * halfHeight
        if (peakHeight < 0.5) continue

        let band: 'low' | 'mid' | 'high' | 'fallback' = 'fallback'
        if (peaks[i] >= FREQ_THRESHOLD) {
          const low = peaksLow![i]
          const mid = peaksMid![i]
          const high = peaksHigh![i]
          if (low >= mid && low >= high) band = 'low'
          else if (mid >= high) band = 'mid'
          else band = 'high'
        }

        bars.push({
          x: i * barWidth,
          y: centerY - peakHeight,
          w: minBarWidth,
          h: peakHeight * 2,
          band,
        })
      }

      // Draw by band to batch fillStyle changes
      const bandGradients = {
        low: gradientLow,
        mid: gradientMid,
        high: gradientHigh,
        fallback: gradientFallback,
      }
      for (const band of ['low', 'mid', 'high', 'fallback'] as const) {
        const bandBars = bars.filter((b) => b.band === band)
        if (bandBars.length === 0) continue
        ctx.fillStyle = bandGradients[band]
        for (const bar of bandBars) {
          ctx.fillRect(bar.x, bar.y, bar.w, bar.h)
        }
      }
    } else {
      // Single-color gradient mode (fallback when no frequency data)
      ctx.fillStyle = createBarGradient(ctx, height, color)
      for (let i = 0; i < peaks.length; i++) {
        const x = i * barWidth
        const peakHeight = peaks[i] * halfHeight
        if (peakHeight < 0.5) continue
        ctx.fillRect(x, centerY - peakHeight, minBarWidth, peakHeight * 2)
      }
    }
  }, [
    peaks,
    peaksLow,
    peaksMid,
    peaksHigh,
    frequencyColorMode,
    width,
    height,
    color,
  ])

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
