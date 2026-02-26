/**
 * Compute a smoothed, normalized energy profile from waveform peaks.
 *
 * Algorithm:
 * 1. Divide peaks into `pointCount` windows
 * 2. Compute RMS (root mean square) energy per window
 * 3. Smooth with 3-point moving average
 * 4. Normalize to 0–1 range
 *
 * @param peaks - Normalized waveform peaks (0–1), typically ~2000 points
 * @param pointCount - Output resolution (default 200)
 * @returns Energy profile array of length `pointCount`, values 0–1
 */
export function computeEnergyProfile(
  peaks: number[],
  pointCount = 200
): number[] {
  if (peaks.length === 0) return []
  if (pointCount <= 0) return []

  const actualCount = Math.min(pointCount, peaks.length)
  const windowSize = peaks.length / actualCount
  const raw: number[] = []

  for (let i = 0; i < actualCount; i++) {
    const start = Math.floor(i * windowSize)
    const end = Math.min(Math.floor((i + 1) * windowSize), peaks.length)
    const count = end - start
    if (count === 0) {
      raw.push(0)
      continue
    }
    let sum = 0
    for (let j = start; j < end; j++) {
      sum += peaks[j] * peaks[j]
    }
    raw.push(Math.sqrt(sum / count))
  }

  const smoothed = smooth(raw)
  return normalize(smoothed)
}

/** 3-point moving average */
function smooth(arr: number[]): number[] {
  if (arr.length <= 2) return [...arr]
  const out: number[] = new Array(arr.length)
  out[0] = arr[0]
  out[arr.length - 1] = arr[arr.length - 1]
  for (let i = 1; i < arr.length - 1; i++) {
    out[i] = (arr[i - 1] + arr[i] + arr[i + 1]) / 3
  }
  return out
}

/** Normalize values to 0–1 range */
function normalize(arr: number[]): number[] {
  if (arr.length === 0) return []
  let max = 0
  for (const v of arr) {
    if (v > max) max = v
  }
  if (max === 0) return arr.map(() => 0)
  return arr.map((v) => v / max)
}
