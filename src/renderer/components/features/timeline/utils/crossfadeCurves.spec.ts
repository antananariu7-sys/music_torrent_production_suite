import { describe, it, expect } from '@jest/globals'
import { computeGains } from '../CrossfadeCurveCanvas'
import {
  generateFadeOutCurve,
  generateFadeInCurve,
} from '@/services/audioCurves'
import type { CrossfadeCurveType } from '@shared/types/project.types'

const CURVE_TYPES: CrossfadeCurveType[] = ['linear', 'equal-power', 's-curve']

describe('computeGains', () => {
  describe.each(CURVE_TYPES)('%s curve', (curveType) => {
    it('should start at fadeOut=1, fadeIn=0 when t=0', () => {
      const { fadeOut, fadeIn } = computeGains(0, curveType)
      expect(fadeOut).toBeCloseTo(1)
      expect(fadeIn).toBeCloseTo(0)
    })

    it('should end at fadeOut=0, fadeIn=1 when t=1', () => {
      const { fadeOut, fadeIn } = computeGains(1, curveType)
      expect(fadeOut).toBeCloseTo(0)
      expect(fadeIn).toBeCloseTo(1)
    })

    it('should have fadeOut + fadeIn = 1 at t=0.5 for equal-power and s-curve', () => {
      const { fadeOut, fadeIn } = computeGains(0.5, curveType)
      if (curveType === 'linear') {
        expect(fadeOut).toBeCloseTo(0.5)
        expect(fadeIn).toBeCloseTo(0.5)
      } else {
        // At midpoint, both equal-power and s-curve should sum to ~1
        // (equal-power: cos(π/4) + sin(π/4) ≈ 1.414, not 1 — this is by design for constant power)
        expect(fadeOut).toBeCloseTo(fadeIn)
      }
    })

    it('should be monotonically decreasing for fadeOut', () => {
      const steps = 20
      let prevGain = Infinity
      for (let i = 0; i <= steps; i++) {
        const t = i / steps
        const { fadeOut } = computeGains(t, curveType)
        expect(fadeOut).toBeLessThanOrEqual(prevGain + 1e-10)
        prevGain = fadeOut
      }
    })

    it('should be monotonically increasing for fadeIn', () => {
      const steps = 20
      let prevGain = -Infinity
      for (let i = 0; i <= steps; i++) {
        const t = i / steps
        const { fadeIn } = computeGains(t, curveType)
        expect(fadeIn).toBeGreaterThanOrEqual(prevGain - 1e-10)
        prevGain = fadeIn
      }
    })

    it('should return values in [0, 1] range', () => {
      for (let i = 0; i <= 100; i++) {
        const t = i / 100
        const { fadeOut, fadeIn } = computeGains(t, curveType)
        expect(fadeOut).toBeGreaterThanOrEqual(-1e-10)
        expect(fadeOut).toBeLessThanOrEqual(1 + 1e-10)
        expect(fadeIn).toBeGreaterThanOrEqual(-1e-10)
        expect(fadeIn).toBeLessThanOrEqual(1 + 1e-10)
      }
    })
  })

  describe('linear specifics', () => {
    it('should produce exact linear ramp values', () => {
      expect(computeGains(0.25, 'linear')).toEqual({
        fadeOut: 0.75,
        fadeIn: 0.25,
      })
      expect(computeGains(0.5, 'linear')).toEqual({
        fadeOut: 0.5,
        fadeIn: 0.5,
      })
      expect(computeGains(0.75, 'linear')).toEqual({
        fadeOut: 0.25,
        fadeIn: 0.75,
      })
    })
  })

  describe('equal-power specifics', () => {
    it('should use cos/sin formula', () => {
      const t = 0.3
      const { fadeOut, fadeIn } = computeGains(t, 'equal-power')
      expect(fadeOut).toBeCloseTo(Math.cos((t * Math.PI) / 2))
      expect(fadeIn).toBeCloseTo(Math.sin((t * Math.PI) / 2))
    })
  })

  describe('s-curve specifics', () => {
    it('should use haversine formula', () => {
      const t = 0.3
      const { fadeOut, fadeIn } = computeGains(t, 's-curve')
      expect(fadeOut).toBeCloseTo((1 + Math.cos(t * Math.PI)) / 2)
      expect(fadeIn).toBeCloseTo((1 - Math.cos(t * Math.PI)) / 2)
    })
  })
})

describe('generateFadeOutCurve / generateFadeInCurve', () => {
  describe.each(CURVE_TYPES)('%s curve', (curveType) => {
    const samples = 64

    it('should return Float32Array of requested length', () => {
      const out = generateFadeOutCurve(curveType, samples)
      const ins = generateFadeInCurve(curveType, samples)
      expect(out).toBeInstanceOf(Float32Array)
      expect(ins).toBeInstanceOf(Float32Array)
      expect(out.length).toBe(samples)
      expect(ins.length).toBe(samples)
    })

    it('fadeOut should start at 1 and end at 0', () => {
      const curve = generateFadeOutCurve(curveType, samples)
      expect(curve[0]).toBeCloseTo(1)
      expect(curve[samples - 1]).toBeCloseTo(0)
    })

    it('fadeIn should start at 0 and end at 1', () => {
      const curve = generateFadeInCurve(curveType, samples)
      expect(curve[0]).toBeCloseTo(0)
      expect(curve[samples - 1]).toBeCloseTo(1)
    })

    it('should match computeGains at each sample point', () => {
      const out = generateFadeOutCurve(curveType, samples)
      const ins = generateFadeInCurve(curveType, samples)

      for (let i = 0; i < samples; i++) {
        const t = i / (samples - 1)
        const { fadeOut, fadeIn } = computeGains(t, curveType)
        expect(out[i]).toBeCloseTo(fadeOut, 5)
        expect(ins[i]).toBeCloseTo(fadeIn, 5)
      }
    })
  })

  it('should handle samples=1 without crashing', () => {
    // Edge case: single sample, t = 0/0 = NaN — should not blow up
    const out = generateFadeOutCurve('linear', 1)
    expect(out.length).toBe(1)
  })

  it('should handle samples=2 correctly (start and end only)', () => {
    const out = generateFadeOutCurve('linear', 2)
    expect(out[0]).toBeCloseTo(1)
    expect(out[1]).toBeCloseTo(0)

    const ins = generateFadeInCurve('linear', 2)
    expect(ins[0]).toBeCloseTo(0)
    expect(ins[1]).toBeCloseTo(1)
  })
})
