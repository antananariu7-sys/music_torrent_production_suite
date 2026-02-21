import { memo, useRef, useEffect, useMemo } from 'react'
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

/** Determine dominant frequency band for a peak index */
function getDominantBand(
  i: number,
  peak: number,
  peaksLow: number[],
  peaksMid: number[],
  peaksHigh: number[]
): 'low' | 'mid' | 'high' | 'fallback' {
  if (peak < FREQ_THRESHOLD) return 'fallback'
  const low = peaksLow[i]
  const mid = peaksMid[i]
  const high = peaksHigh[i]
  if (low >= mid && low >= high) return 'low'
  if (mid >= high) return 'mid'
  return 'high'
}

/** Draw frequency-colored bars (used in bar mode) */
function drawFrequencyBars(
  ctx: CanvasRenderingContext2D,
  peaks: number[],
  peaksLow: number[],
  peaksMid: number[],
  peaksHigh: number[],
  barWidth: number,
  minBarWidth: number,
  centerY: number,
  halfHeight: number,
  canvasHeight: number,
  fallbackColor: string
): void {
  const gradientLow = createBarGradient(ctx, canvasHeight, BAND_COLORS.low)
  const gradientMid = createBarGradient(ctx, canvasHeight, BAND_COLORS.mid)
  const gradientHigh = createBarGradient(ctx, canvasHeight, BAND_COLORS.high)
  const gradientFallback = createBarGradient(ctx, canvasHeight, fallbackColor)

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
    const band = getDominantBand(i, peaks[i], peaksLow, peaksMid, peaksHigh)
    bars.push({
      x: i * barWidth,
      y: centerY - peakHeight,
      w: minBarWidth,
      h: peakHeight * 2,
      band,
    })
  }

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
}

/** Build a smooth bezier envelope path from peaks */
function buildEnvelopePath(
  peaks: number[],
  width: number,
  centerY: number,
  halfHeight: number,
  direction: 1 | -1
): Path2D {
  const path = new Path2D()
  const step = width / peaks.length

  // Start at center
  path.moveTo(0, centerY)

  // First point
  const firstPeak = peaks[0] * halfHeight * direction
  path.lineTo(0, centerY - firstPeak)

  // Quadratic bezier through each peak
  for (let i = 1; i < peaks.length; i++) {
    const x = i * step
    const peakY = centerY - peaks[i] * halfHeight * direction
    const prevX = (i - 1) * step
    const cpX = (prevX + x) / 2
    path.quadraticCurveTo(
      cpX,
      centerY - peaks[i - 1] * halfHeight * direction,
      x,
      peakY
    )
  }

  // Close back to center
  path.lineTo(width, centerY)

  return path
}

/** Draw smooth bezier waveform with optional frequency coloring */
function drawSmoothWaveform(
  ctx: CanvasRenderingContext2D,
  peaks: number[],
  width: number,
  centerY: number,
  halfHeight: number,
  freqData: {
    peaksLow: number[]
    peaksMid: number[]
    peaksHigh: number[]
  } | null,
  singleColor: string | null
): void {
  const canvasHeight = centerY * 2

  if (freqData) {
    // Frequency-colored smooth: draw segments by dominant band
    // We'll draw in band-colored strips using clipping regions
    const step = width / peaks.length

    // Build the combined envelope shape (top + bottom mirrored)
    const topPath = buildEnvelopePath(peaks, width, centerY, halfHeight, 1)
    const bottomPath = buildEnvelopePath(peaks, width, centerY, halfHeight, -1)

    // Create a combined fill path for the full waveform shape
    const fullShape = new Path2D()
    // Top envelope (left to right)
    fullShape.moveTo(0, centerY)
    const firstPeakTop = peaks[0] * halfHeight
    fullShape.lineTo(0, centerY - firstPeakTop)
    for (let i = 1; i < peaks.length; i++) {
      const x = i * step
      const peakY = centerY - peaks[i] * halfHeight
      const prevX = (i - 1) * step
      const cpX = (prevX + x) / 2
      fullShape.quadraticCurveTo(
        cpX,
        centerY - peaks[i - 1] * halfHeight,
        x,
        peakY
      )
    }
    // Right edge down to bottom envelope
    fullShape.lineTo(width, centerY)
    // Bottom envelope (right to left)
    const lastPeakBot = peaks[peaks.length - 1] * halfHeight
    fullShape.lineTo(width, centerY + lastPeakBot)
    for (let i = peaks.length - 2; i >= 0; i--) {
      const x = i * step
      const peakY = centerY + peaks[i] * halfHeight
      const nextX = (i + 1) * step
      const cpX = (nextX + x) / 2
      fullShape.quadraticCurveTo(
        cpX,
        centerY + peaks[i + 1] * halfHeight,
        x,
        peakY
      )
    }
    fullShape.lineTo(0, centerY)
    fullShape.closePath()

    // Draw band-colored vertical strips clipped to the waveform shape
    ctx.save()
    ctx.clip(fullShape)

    // Group consecutive peaks by band for fewer draw calls
    let segStart = 0
    let currentBand = getDominantBand(
      0,
      peaks[0],
      freqData.peaksLow,
      freqData.peaksMid,
      freqData.peaksHigh
    )

    const drawSegment = (start: number, end: number, band: string) => {
      const bandColor =
        band === 'low'
          ? BAND_COLORS.low
          : band === 'mid'
            ? BAND_COLORS.mid
            : band === 'high'
              ? BAND_COLORS.high
              : null
      if (!bandColor) return
      const gradient = createBarGradient(ctx, canvasHeight, bandColor)
      ctx.fillStyle = gradient
      const x0 = start * step
      const x1 = Math.min((end + 1) * step, width)
      ctx.fillRect(x0, 0, x1 - x0, canvasHeight)
    }

    for (let i = 1; i < peaks.length; i++) {
      const band = getDominantBand(
        i,
        peaks[i],
        freqData.peaksLow,
        freqData.peaksMid,
        freqData.peaksHigh
      )
      if (band !== currentBand) {
        drawSegment(segStart, i - 1, currentBand)
        segStart = i
        currentBand = band
      }
    }
    drawSegment(segStart, peaks.length - 1, currentBand)

    ctx.restore()

    // Thin edge stroke for definition
    ctx.strokeStyle = colorWithAlpha('#ffffff', 0.15)
    ctx.lineWidth = 1
    ctx.stroke(topPath)
    ctx.stroke(bottomPath)
  } else {
    // Single-color smooth waveform
    const gradient = createBarGradient(
      ctx,
      canvasHeight,
      singleColor ?? '#3b82f6'
    )

    // Build top and bottom envelope paths
    const topPath = buildEnvelopePath(peaks, width, centerY, halfHeight, 1)
    const bottomPath = buildEnvelopePath(peaks, width, centerY, halfHeight, -1)

    // Fill top half
    ctx.fillStyle = gradient
    ctx.fill(topPath)
    ctx.fill(bottomPath)

    // Thin edge stroke for definition
    ctx.strokeStyle = colorWithAlpha(singleColor ?? '#3b82f6', 0.3)
    ctx.lineWidth = 1
    ctx.stroke(topPath)
    ctx.stroke(bottomPath)
  }
}

/**
 * Downsample a peaks array to targetCount using max-pooling.
 * Used for zoom-adaptive LOD: fewer peaks at low zoom, more at high zoom.
 */
function downsampleArray(arr: number[], targetCount: number): number[] {
  if (arr.length <= targetCount) return arr
  const windowSize = arr.length / targetCount
  const result = new Array(targetCount)
  for (let i = 0; i < targetCount; i++) {
    const start = Math.floor(i * windowSize)
    const end = Math.floor((i + 1) * windowSize)
    let max = 0
    for (let j = start; j < end; j++) {
      if (arr[j] > max) max = arr[j]
    }
    result[i] = max
  }
  return result
}

interface WaveformCanvasProps {
  peaks: number[]
  peaksLow?: number[]
  peaksMid?: number[]
  peaksHigh?: number[]
  frequencyColorMode?: boolean
  waveformStyle?: 'bars' | 'smooth'
  width: number
  height?: number
  color?: string
  isSelected?: boolean
}

/**
 * Renders audio waveform peaks as mirrored vertical bars on a canvas.
 * Supports frequency-colored mode when 3-band peak data is available.
 */
export const WaveformCanvas = memo(
  function WaveformCanvas({
    peaks,
    peaksLow,
    peaksMid,
    peaksHigh,
    frequencyColorMode = false,
    waveformStyle = 'smooth',
    width,
    height = 80,
    color = '#3b82f6',
    isSelected = false,
  }: WaveformCanvasProps): JSX.Element {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    // Zoom-adaptive LOD: downsample peaks to match visible pixel density
    // Cap at canvas width (no point having more peaks than pixels)
    const targetPeaks = useMemo(() => {
      // Use ~1 peak per 2 CSS pixels for smooth look, capped at source length
      const target = Math.min(peaks.length, Math.max(200, Math.ceil(width / 2)))
      return target
    }, [peaks.length, width])

    const lodPeaks = useMemo(
      () => downsampleArray(peaks, targetPeaks),
      [peaks, targetPeaks]
    )
    const lodPeaksLow = useMemo(
      () => (peaksLow ? downsampleArray(peaksLow, targetPeaks) : undefined),
      [peaksLow, targetPeaks]
    )
    const lodPeaksMid = useMemo(
      () => (peaksMid ? downsampleArray(peaksMid, targetPeaks) : undefined),
      [peaksMid, targetPeaks]
    )
    const lodPeaksHigh = useMemo(
      () => (peaksHigh ? downsampleArray(peaksHigh, targetPeaks) : undefined),
      [peaksHigh, targetPeaks]
    )

    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas || lodPeaks.length === 0) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const dpr = window.devicePixelRatio || 1
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.scale(dpr, dpr)

      // Clear
      ctx.clearRect(0, 0, width, height)

      // Draw mirrored waveform
      const centerY = height / 2
      const halfHeight = height / 2 - 2 // 2px padding
      const barWidth = width / lodPeaks.length
      const minBarWidth = Math.max(1, barWidth)

      const hasFrequencyData =
        frequencyColorMode &&
        lodPeaksLow &&
        lodPeaksMid &&
        lodPeaksHigh &&
        lodPeaksLow.length === lodPeaks.length

      if (waveformStyle === 'smooth') {
        // --- Smooth bezier curve rendering ---
        drawSmoothWaveform(
          ctx,
          lodPeaks,
          width,
          centerY,
          halfHeight,
          hasFrequencyData
            ? {
                peaksLow: lodPeaksLow!,
                peaksMid: lodPeaksMid!,
                peaksHigh: lodPeaksHigh!,
              }
            : null,
          hasFrequencyData ? null : color
        )
      } else {
        // --- Bar rendering ---
        if (hasFrequencyData) {
          drawFrequencyBars(
            ctx,
            lodPeaks,
            lodPeaksLow!,
            lodPeaksMid!,
            lodPeaksHigh!,
            barWidth,
            minBarWidth,
            centerY,
            halfHeight,
            height,
            color
          )
        } else {
          ctx.fillStyle = createBarGradient(ctx, height, color)
          for (let i = 0; i < lodPeaks.length; i++) {
            const x = i * barWidth
            const peakHeight = lodPeaks[i] * halfHeight
            if (peakHeight < 0.5) continue
            ctx.fillRect(x, centerY - peakHeight, minBarWidth, peakHeight * 2)
          }
        }
      }
    }, [
      lodPeaks,
      lodPeaksLow,
      lodPeaksMid,
      lodPeaksHigh,
      frequencyColorMode,
      waveformStyle,
      width,
      height,
      color,
    ])

    return (
      <Box
        borderWidth={isSelected ? '2px' : '0px'}
        borderColor={isSelected ? 'blue.500' : 'transparent'}
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
  },
  (prev, next) =>
    prev.peaks === next.peaks &&
    prev.peaksLow === next.peaksLow &&
    prev.peaksMid === next.peaksMid &&
    prev.peaksHigh === next.peaksHigh &&
    prev.frequencyColorMode === next.frequencyColorMode &&
    prev.waveformStyle === next.waveformStyle &&
    prev.width === next.width &&
    prev.height === next.height &&
    prev.color === next.color &&
    prev.isSelected === next.isSelected
)
