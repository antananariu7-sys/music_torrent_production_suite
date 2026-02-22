/**
 * Pure waveform drawing functions.
 * These operate on any CanvasRenderingContext2D (including OffscreenCanvas)
 * and contain no React or DOM dependencies.
 */

/** Convert a hex color to rgba with the given alpha */
export function colorWithAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/** Create a vertical gradient (bright at peaks, 40% alpha at center) */
export function createBarGradient(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
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
export const BAND_COLORS = {
  low: '#ef4444',
  mid: '#22c55e',
  high: '#06b6d4',
}

/** Minimum peak threshold for reliable frequency coloring */
export const FREQ_THRESHOLD = 0.02

/** Determine dominant frequency band for a peak index */
export function getDominantBand(
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
export function drawFrequencyBars(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
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

/**
 * Downsample a peaks array to targetCount using max-pooling.
 * Used for zoom-adaptive LOD: fewer peaks at low zoom, more at high zoom.
 */
export function downsampleArray(arr: number[], targetCount: number): number[] {
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

/**
 * Draw a complete waveform onto a canvas context.
 * This is the main entry point used by tile rendering and direct rendering.
 */
export function drawWaveform(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  peaks: number[],
  width: number,
  height: number,
  color: string,
  frequencyColorMode: boolean,
  peaksLow?: number[],
  peaksMid?: number[],
  peaksHigh?: number[]
): void {
  ctx.clearRect(0, 0, width, height)

  const centerY = height / 2
  const halfHeight = height / 2 - 2 // 2px padding
  const barWidth = width / peaks.length
  const minBarWidth = Math.max(1, barWidth)

  const hasFrequencyData =
    frequencyColorMode &&
    peaksLow != null &&
    peaksMid != null &&
    peaksHigh != null &&
    peaksLow.length === peaks.length

  if (hasFrequencyData) {
    drawFrequencyBars(
      ctx,
      peaks,
      peaksLow!,
      peaksMid!,
      peaksHigh!,
      barWidth,
      minBarWidth,
      centerY,
      halfHeight,
      height,
      color
    )
  } else {
    ctx.fillStyle = createBarGradient(ctx, height, color)
    for (let i = 0; i < peaks.length; i++) {
      const x = i * barWidth
      const peakHeight = peaks[i] * halfHeight
      if (peakHeight < 0.5) continue
      ctx.fillRect(x, centerY - peakHeight, minBarWidth, peakHeight * 2)
    }
  }
}
