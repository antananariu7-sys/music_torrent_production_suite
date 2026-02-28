import type { VolumePoint } from '../types/project.types'

/** Convert decibels to linear gain. */
export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20)
}

/** Convert linear gain to decibels. Returns -Infinity for 0. */
export function linearToDb(linear: number): number {
  if (linear <= 0) return -Infinity
  return 20 * Math.log10(linear)
}

/**
 * Interpolate a volume envelope into a uniformly-sampled Float32Array.
 *
 * - Empty/undefined points → flat array at 1.0 (unity)
 * - Values clamped to 0–1
 * - Linear interpolation between consecutive breakpoints
 * - Before the first point: holds the first point's value
 * - After the last point: holds the last point's value
 *
 * @param points  Volume breakpoints (will be sorted by time internally)
 * @param duration  Total duration in seconds
 * @param samples  Number of output samples
 */
export function interpolateEnvelope(
  points: VolumePoint[] | undefined,
  duration: number,
  samples: number
): Float32Array {
  const curve = new Float32Array(samples)

  if (!points || points.length === 0 || duration <= 0 || samples <= 0) {
    curve.fill(1.0)
    return curve
  }

  // Sort by time and clamp values
  const sorted = [...points]
    .sort((a, b) => a.time - b.time)
    .map((p) => ({ time: p.time, value: Math.max(0, Math.min(1, p.value)) }))

  for (let i = 0; i < samples; i++) {
    const t = (i / (samples - 1)) * duration

    // Before first point — hold first value
    if (t <= sorted[0].time) {
      curve[i] = sorted[0].value
      continue
    }

    // After last point — hold last value
    if (t >= sorted[sorted.length - 1].time) {
      curve[i] = sorted[sorted.length - 1].value
      continue
    }

    // Find surrounding points and linearly interpolate
    for (let j = 0; j < sorted.length - 1; j++) {
      const p0 = sorted[j]
      const p1 = sorted[j + 1]
      if (t >= p0.time && t <= p1.time) {
        const dt = p1.time - p0.time
        const frac = dt > 0 ? (t - p0.time) / dt : 0
        curve[i] = p0.value + (p1.value - p0.value) * frac
        break
      }
    }
  }

  return curve
}
