import { describe, it, expect } from '@jest/globals'
import { snapToNearestBeat } from './snapToBeat'

describe('snapToNearestBeat', () => {
  it('should snap to exact beat boundary', () => {
    // 120 BPM = 0.5s per beat, offset 0
    expect(snapToNearestBeat(1.0, 120, 0)).toBe(1.0)
    expect(snapToNearestBeat(2.5, 120, 0)).toBe(2.5)
  })

  it('should round to nearest beat', () => {
    // 120 BPM = 0.5s per beat, offset 0
    // Beats at: 0, 0.5, 1.0, 1.5, 2.0 ...
    expect(snapToNearestBeat(0.3, 120, 0)).toBe(0.5) // closer to 0.5
    expect(snapToNearestBeat(0.2, 120, 0)).toBe(0.0) // closer to 0.0
    expect(snapToNearestBeat(1.74, 120, 0)).toBe(1.5) // closer to 1.5
    expect(snapToNearestBeat(1.76, 120, 0)).toBe(2.0) // closer to 2.0
  })

  it('should handle first beat offset', () => {
    // 60 BPM = 1.0s per beat, offset 0.3
    // Beats at: 0.3, 1.3, 2.3, 3.3 ...
    expect(snapToNearestBeat(0.8, 60, 0.3)).toBe(1.3)
    expect(snapToNearestBeat(0.5, 60, 0.3)).toBe(0.3)
    expect(snapToNearestBeat(2.0, 60, 0.3)).toBe(2.3)
  })

  it('should handle 60 BPM (1 beat per second)', () => {
    expect(snapToNearestBeat(3.4, 60, 0)).toBe(3.0)
    expect(snapToNearestBeat(3.6, 60, 0)).toBe(4.0)
  })

  it('should handle high BPM (180)', () => {
    // 180 BPM = 0.333...s per beat, offset 0
    const interval = 60 / 180
    expect(snapToNearestBeat(0.1, 180, 0)).toBeCloseTo(0)
    expect(snapToNearestBeat(0.2, 180, 0)).toBeCloseTo(interval)
  })

  it('should handle timestamps before first beat offset', () => {
    // 120 BPM, offset 1.0 → beats at 1.0, 1.5, 2.0 ... and also 0.5, 0.0
    expect(snapToNearestBeat(0.1, 120, 1.0)).toBe(0.0)
    expect(snapToNearestBeat(0.6, 120, 1.0)).toBe(0.5)
  })

  it('should handle large timestamps stably', () => {
    // 128 BPM, offset 0.1, timestamp at ~600s (10 minutes)
    const result = snapToNearestBeat(600, 128, 0.1)
    const interval = 60 / 128
    const expectedIndex = Math.round((600 - 0.1) / interval)
    expect(result).toBeCloseTo(0.1 + expectedIndex * interval, 6)
  })
})
