import { computeEnergyProfile } from './energyAnalyzer'

describe('computeEnergyProfile', () => {
  it('returns empty array for empty peaks', () => {
    expect(computeEnergyProfile([])).toEqual([])
  })

  it('returns empty array for zero pointCount', () => {
    expect(computeEnergyProfile([0.5, 0.6], 0)).toEqual([])
  })

  it('returns correct length', () => {
    const peaks = new Array(2000).fill(0.5)
    const result = computeEnergyProfile(peaks, 200)
    expect(result).toHaveLength(200)
  })

  it('returns values normalized to 0–1', () => {
    const peaks = new Array(1000).fill(0).map(() => Math.random())
    const result = computeEnergyProfile(peaks, 50)
    for (const v of result) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
    // At least one value should be 1 (the max)
    expect(Math.max(...result)).toBeCloseTo(1)
  })

  it('handles constant signal', () => {
    const peaks = new Array(100).fill(0.7)
    const result = computeEnergyProfile(peaks, 10)
    expect(result).toHaveLength(10)
    // All values should be approximately equal (and normalized to 1)
    for (const v of result) {
      expect(v).toBeCloseTo(1, 1)
    }
  })

  it('handles silence', () => {
    const peaks = new Array(100).fill(0)
    const result = computeEnergyProfile(peaks, 10)
    expect(result).toHaveLength(10)
    for (const v of result) {
      expect(v).toBe(0)
    }
  })

  it('detects energy increase', () => {
    // Ramp up: first half silent, second half loud
    const peaks = [...new Array(500).fill(0.1), ...new Array(500).fill(0.9)]
    const result = computeEnergyProfile(peaks, 10)
    // First values should be lower than last values
    expect(result[0]).toBeLessThan(result[result.length - 1])
  })

  it('caps pointCount to peaks length', () => {
    const peaks = [0.5, 0.7, 0.3]
    const result = computeEnergyProfile(peaks, 100)
    // Should cap to 3 points (peaks.length)
    expect(result.length).toBeLessThanOrEqual(3)
  })

  it('uses default pointCount of 200', () => {
    const peaks = new Array(2000).fill(0.5)
    const result = computeEnergyProfile(peaks)
    expect(result).toHaveLength(200)
  })

  it('preserves energy shape through smoothing', () => {
    // Create a peak in the middle
    const peaks = new Array(200).fill(0)
    for (let i = 90; i < 110; i++) peaks[i] = 1
    const result = computeEnergyProfile(peaks, 20)
    // Middle values should be highest
    const mid = Math.floor(result.length / 2)
    expect(result[mid]).toBeGreaterThan(result[0])
    expect(result[mid]).toBeGreaterThan(result[result.length - 1])
  })
})
