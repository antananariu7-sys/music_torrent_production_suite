import {
  dbToLinear,
  linearToDb,
  interpolateEnvelope,
} from './volumeInterpolation'

describe('dbToLinear', () => {
  it('converts 0 dB to 1.0', () => {
    expect(dbToLinear(0)).toBeCloseTo(1.0)
  })

  it('converts -6 dB to ~0.5', () => {
    expect(dbToLinear(-6)).toBeCloseTo(0.5012, 3)
  })

  it('converts +6 dB to ~2.0', () => {
    expect(dbToLinear(6)).toBeCloseTo(1.9953, 3)
  })

  it('converts -20 dB to 0.1', () => {
    expect(dbToLinear(-20)).toBeCloseTo(0.1)
  })
})

describe('linearToDb', () => {
  it('converts 1.0 to 0 dB', () => {
    expect(linearToDb(1.0)).toBeCloseTo(0)
  })

  it('converts 0.5 to ~-6 dB', () => {
    expect(linearToDb(0.5)).toBeCloseTo(-6.0206, 3)
  })

  it('returns -Infinity for 0', () => {
    expect(linearToDb(0)).toBe(-Infinity)
  })

  it('returns -Infinity for negative values', () => {
    expect(linearToDb(-1)).toBe(-Infinity)
  })
})

describe('interpolateEnvelope', () => {
  it('returns flat 1.0 for empty points', () => {
    const curve = interpolateEnvelope([], 10, 5)
    expect(Array.from(curve)).toEqual([1, 1, 1, 1, 1])
  })

  it('returns flat 1.0 for undefined points', () => {
    const curve = interpolateEnvelope(undefined, 10, 5)
    expect(Array.from(curve)).toEqual([1, 1, 1, 1, 1])
  })

  it('returns flat 1.0 for zero duration', () => {
    const curve = interpolateEnvelope([{ time: 0, value: 0.5 }], 0, 5)
    expect(Array.from(curve)).toEqual([1, 1, 1, 1, 1])
  })

  it('returns single value for single point at start', () => {
    const curve = interpolateEnvelope([{ time: 0, value: 0.5 }], 10, 5)
    // All samples should hold 0.5
    for (const v of curve) {
      expect(v).toBeCloseTo(0.5)
    }
  })

  it('interpolates linearly between two points', () => {
    const curve = interpolateEnvelope(
      [
        { time: 0, value: 1.0 },
        { time: 10, value: 0.0 },
      ],
      10,
      5
    )
    // t=0: 1.0, t=2.5: 0.75, t=5: 0.5, t=7.5: 0.25, t=10: 0.0
    expect(curve[0]).toBeCloseTo(1.0)
    expect(curve[1]).toBeCloseTo(0.75)
    expect(curve[2]).toBeCloseTo(0.5)
    expect(curve[3]).toBeCloseTo(0.25)
    expect(curve[4]).toBeCloseTo(0.0)
  })

  it('holds first point value before its time', () => {
    const curve = interpolateEnvelope(
      [
        { time: 5, value: 0.8 },
        { time: 10, value: 0.2 },
      ],
      10,
      5
    )
    // t=0 and t=2.5 are before first point at t=5 → hold 0.8
    expect(curve[0]).toBeCloseTo(0.8)
    expect(curve[1]).toBeCloseTo(0.8)
    // t=5: 0.8, t=7.5: 0.5, t=10: 0.2
    expect(curve[2]).toBeCloseTo(0.8)
    expect(curve[3]).toBeCloseTo(0.5)
    expect(curve[4]).toBeCloseTo(0.2)
  })

  it('holds last point value after its time', () => {
    const curve = interpolateEnvelope(
      [
        { time: 0, value: 1.0 },
        { time: 5, value: 0.5 },
      ],
      10,
      5
    )
    // t=0: 1.0, t=2.5: 0.75, t=5: 0.5, t=7.5: 0.5, t=10: 0.5
    expect(curve[0]).toBeCloseTo(1.0)
    expect(curve[1]).toBeCloseTo(0.75)
    expect(curve[2]).toBeCloseTo(0.5)
    expect(curve[3]).toBeCloseTo(0.5)
    expect(curve[4]).toBeCloseTo(0.5)
  })

  it('sorts unsorted points by time', () => {
    const curve = interpolateEnvelope(
      [
        { time: 10, value: 0.0 },
        { time: 0, value: 1.0 },
      ],
      10,
      5
    )
    expect(curve[0]).toBeCloseTo(1.0)
    expect(curve[4]).toBeCloseTo(0.0)
  })

  it('clamps values to 0–1', () => {
    const curve = interpolateEnvelope(
      [
        { time: 0, value: 2.0 },
        { time: 10, value: -0.5 },
      ],
      10,
      3
    )
    expect(curve[0]).toBeCloseTo(1.0) // clamped from 2.0
    expect(curve[2]).toBeCloseTo(0.0) // clamped from -0.5
  })

  it('handles three points with different segments', () => {
    const curve = interpolateEnvelope(
      [
        { time: 0, value: 1.0 },
        { time: 5, value: 0.5 },
        { time: 10, value: 1.0 },
      ],
      10,
      5
    )
    expect(curve[0]).toBeCloseTo(1.0) // t=0
    expect(curve[1]).toBeCloseTo(0.75) // t=2.5
    expect(curve[2]).toBeCloseTo(0.5) // t=5
    expect(curve[3]).toBeCloseTo(0.75) // t=7.5
    expect(curve[4]).toBeCloseTo(1.0) // t=10
  })
})
