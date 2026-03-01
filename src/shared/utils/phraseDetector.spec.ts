import { describe, it, expect } from '@jest/globals'
import { detectPhrases, getPhraseScoringForTime } from './phraseDetector'
import type { PhraseBoundary } from './phraseDetector'

// BPM=120: beatLength=0.5s, barLength=2s
const BPM = 120
const BAR_LENGTH = 2 // (4 * 60) / 120

describe('phraseDetector', () => {
  describe('detectPhrases — guards', () => {
    it('returns empty array when bpm <= 0', () => {
      expect(
        detectPhrases({ bpm: 0, firstBeatOffset: 0, duration: 120 })
      ).toEqual([])
      expect(
        detectPhrases({ bpm: -10, firstBeatOffset: 0, duration: 120 })
      ).toEqual([])
    })

    it('returns empty array when duration <= 0', () => {
      expect(
        detectPhrases({ bpm: BPM, firstBeatOffset: 0, duration: 0 })
      ).toEqual([])
      expect(
        detectPhrases({ bpm: BPM, firstBeatOffset: 0, duration: -5 })
      ).toEqual([])
    })

    it('returns empty array when duration is too short for even one bar', () => {
      // barLength at BPM=120 is 2s; if duration < firstBeatOffset + barLength, totalBars=0
      expect(
        detectPhrases({ bpm: BPM, firstBeatOffset: 0, duration: 1 })
      ).toEqual([])
    })
  })

  describe('detectPhrases — phrase types by bar number', () => {
    // Use a duration long enough to include bar 32 (32 bars * 2s = 64s)
    const duration = 70
    const firstBeatOffset = 0

    it('assigns phrase-32 to bar 0', () => {
      const boundaries = detectPhrases({ bpm: BPM, firstBeatOffset, duration })
      const bar0 = boundaries.find((b) => b.barNumber === 0)
      expect(bar0).toBeDefined()
      expect(bar0!.type).toBe('phrase-32')
    })

    it('assigns phrase-4 to bar 4', () => {
      const boundaries = detectPhrases({ bpm: BPM, firstBeatOffset, duration })
      const bar4 = boundaries.find((b) => b.barNumber === 4)
      expect(bar4).toBeDefined()
      expect(bar4!.type).toBe('phrase-4')
    })

    it('assigns phrase-8 to bar 8', () => {
      const boundaries = detectPhrases({ bpm: BPM, firstBeatOffset, duration })
      const bar8 = boundaries.find((b) => b.barNumber === 8)
      expect(bar8).toBeDefined()
      expect(bar8!.type).toBe('phrase-8')
    })

    it('assigns phrase-16 to bar 16', () => {
      const boundaries = detectPhrases({ bpm: BPM, firstBeatOffset, duration })
      const bar16 = boundaries.find((b) => b.barNumber === 16)
      expect(bar16).toBeDefined()
      expect(bar16!.type).toBe('phrase-16')
    })

    it('assigns phrase-32 to bar 32', () => {
      const boundaries = detectPhrases({ bpm: BPM, firstBeatOffset, duration })
      const bar32 = boundaries.find((b) => b.barNumber === 32)
      expect(bar32).toBeDefined()
      expect(bar32!.type).toBe('phrase-32')
    })

    it('skips bars 1, 2, and 3 (no phrase boundary)', () => {
      const boundaries = detectPhrases({ bpm: BPM, firstBeatOffset, duration })
      const barNumbers = boundaries.map((b) => b.barNumber)
      expect(barNumbers).not.toContain(1)
      expect(barNumbers).not.toContain(2)
      expect(barNumbers).not.toContain(3)
    })

    it('computes time correctly as firstBeatOffset + bar * barLength', () => {
      const offset = 1.5
      const boundaries = detectPhrases({
        bpm: BPM,
        firstBeatOffset: offset,
        duration: 70,
      })
      for (const b of boundaries) {
        const expectedTime = offset + b.barNumber * BAR_LENGTH
        expect(b.time).toBeCloseTo(expectedTime, 5)
      }
    })
  })

  describe('detectPhrases — base strength per phrase type', () => {
    const duration = 70
    const firstBeatOffset = 0

    it('phrase-4 has base strength 0.3', () => {
      const boundaries = detectPhrases({ bpm: BPM, firstBeatOffset, duration })
      const bar4 = boundaries.find((b) => b.barNumber === 4)
      expect(bar4!.strength).toBeCloseTo(0.3, 5)
    })

    it('phrase-8 has base strength 0.5', () => {
      const boundaries = detectPhrases({ bpm: BPM, firstBeatOffset, duration })
      const bar8 = boundaries.find((b) => b.barNumber === 8)
      expect(bar8!.strength).toBeCloseTo(0.5, 5)
    })

    it('phrase-16 has base strength 0.7', () => {
      const boundaries = detectPhrases({ bpm: BPM, firstBeatOffset, duration })
      const bar16 = boundaries.find((b) => b.barNumber === 16)
      expect(bar16!.strength).toBeCloseTo(0.7, 5)
    })

    it('phrase-32 has base strength 0.9', () => {
      const boundaries = detectPhrases({ bpm: BPM, firstBeatOffset, duration })
      const bar32 = boundaries.find((b) => b.barNumber === 32)
      expect(bar32!.strength).toBeCloseTo(0.9, 5)
    })
  })

  describe('detectPhrases — energy boosting', () => {
    const duration = 70
    const firstBeatOffset = 0

    it('flat energyProfile leaves strength unchanged', () => {
      // Flat profile: all values equal → no energy change → boost = 0
      const flatProfile = new Array(100).fill(0.5)
      const withEnergy = detectPhrases({
        bpm: BPM,
        firstBeatOffset,
        duration,
        energyProfile: flatProfile,
      })
      const withoutEnergy = detectPhrases({
        bpm: BPM,
        firstBeatOffset,
        duration,
      })

      // bar 4 is phrase-4 with base strength 0.3
      const bar4WithEnergy = withEnergy.find((b) => b.barNumber === 4)
      const bar4WithoutEnergy = withoutEnergy.find((b) => b.barNumber === 4)
      expect(bar4WithEnergy!.strength).toBeCloseTo(
        bar4WithoutEnergy!.strength,
        5
      )
    })

    it('sharp energy change at a boundary boosts strength by up to 0.3', () => {
      // Create a profile where there is a dramatic change midway through the duration
      // Bar 4 at BPM=120, firstBeatOffset=0, duration=70 is at time=8s
      // Index in profile: floor((8/70)*100) = floor(11.43) = 11
      // Set values before index 11 to 0, values from index 11 onwards to 1
      const sharpProfile = new Array(100).fill(0)
      for (let i = 11; i < 100; i++) sharpProfile[i] = 1

      const boundaries = detectPhrases({
        bpm: BPM,
        firstBeatOffset,
        duration,
        energyProfile: sharpProfile,
      })
      const bar4 = boundaries.find((b) => b.barNumber === 4)
      // Base strength is 0.3; with a large energy change the boost can be up to 0.3
      expect(bar4!.strength).toBeGreaterThan(0.3)
      expect(bar4!.strength).toBeLessThanOrEqual(0.6)
    })

    it('energy boost is capped at 1.0', () => {
      // phrase-32 has base strength 0.9; even a full 0.3 boost must not exceed 1.0
      const sharpProfile = new Array(100).fill(0)
      for (let i = 50; i < 100; i++) sharpProfile[i] = 1

      const boundaries = detectPhrases({
        bpm: BPM,
        firstBeatOffset,
        duration,
        energyProfile: sharpProfile,
      })
      for (const b of boundaries) {
        expect(b.strength).toBeLessThanOrEqual(1.0)
      }
    })
  })

  describe('detectPhrases — section alignment', () => {
    const duration = 70
    const firstBeatOffset = 0

    it('boosts strength by 0.2 when a section boundary is within 0.5 bars of a phrase', () => {
      // bar 4 at BPM=120 is at time=8s; barLength=2s; 0.5 bars = 1s
      // Place section at 8.5s (within 0.5 bars)
      const sections = [
        {
          id: '1',
          type: 'custom' as const,
          startTime: 8.5,
          endTime: 20,
          confidence: 0.8,
        },
      ]
      const withSections = detectPhrases({
        bpm: BPM,
        firstBeatOffset,
        duration,
        sections,
      })
      const withoutSections = detectPhrases({
        bpm: BPM,
        firstBeatOffset,
        duration,
      })

      const bar4With = withSections.find((b) => b.barNumber === 4)
      const bar4Without = withoutSections.find((b) => b.barNumber === 4)
      expect(bar4With!.strength).toBeCloseTo(bar4Without!.strength + 0.2, 5)
    })

    it('does not boost strength when section boundary is more than 0.5 bars away', () => {
      // bar 4 at time=8s; 0.5 bars = 1s; place section at 10s (2s away, beyond threshold)
      const sections = [
        {
          id: '2',
          type: 'custom' as const,
          startTime: 10,
          endTime: 30,
          confidence: 0.8,
        },
      ]
      const withSections = detectPhrases({
        bpm: BPM,
        firstBeatOffset,
        duration,
        sections,
      })
      const withoutSections = detectPhrases({
        bpm: BPM,
        firstBeatOffset,
        duration,
      })

      const bar4With = withSections.find((b) => b.barNumber === 4)
      const bar4Without = withoutSections.find((b) => b.barNumber === 4)
      expect(bar4With!.strength).toBeCloseTo(bar4Without!.strength, 5)
    })

    it('combined energy + section boost is still capped at 1.0', () => {
      // phrase-32 base=0.9; section +0.2 would give 1.1 without cap
      // Place section exactly at bar 32 (time=64s)
      const sections = [
        {
          id: '3',
          type: 'outro' as const,
          startTime: 64,
          endTime: 70,
          confidence: 0.8,
        },
      ]
      const boundaries = detectPhrases({
        bpm: BPM,
        firstBeatOffset,
        duration,
        sections,
      })
      const bar32 = boundaries.find((b) => b.barNumber === 32)
      expect(bar32!.strength).toBeLessThanOrEqual(1.0)
      // With section alignment on top of 0.9 base, should be exactly 1.0 (capped)
      expect(bar32!.strength).toBeCloseTo(1.0, 5)
    })
  })

  describe('getPhraseScoringForTime', () => {
    it('returns score 0.2 and null alignedPhrase when phrases array is empty', () => {
      const result = getPhraseScoringForTime(10, [], BPM)
      expect(result).toEqual({ score: 0.2, alignedPhrase: null })
    })

    it('returns score 0.2 and null alignedPhrase when bpm <= 0', () => {
      const phrases: PhraseBoundary[] = [
        { time: 0, barNumber: 0, strength: 0.9, type: 'phrase-32' },
      ]
      expect(getPhraseScoringForTime(0, phrases, 0)).toEqual({
        score: 0.2,
        alignedPhrase: null,
      })
      expect(getPhraseScoringForTime(0, phrases, -5)).toEqual({
        score: 0.2,
        alignedPhrase: null,
      })
    })

    it('returns base strength and aligned phrase when time is exactly at a phrase boundary', () => {
      const phrases: PhraseBoundary[] = [
        { time: 8, barNumber: 4, strength: 0.3, type: 'phrase-4' },
      ]
      const result = getPhraseScoringForTime(8, phrases, BPM)
      expect(result.score).toBeCloseTo(0.3, 5)
      expect(result.alignedPhrase).toEqual(phrases[0])
    })

    it('returns base strength and aligned phrase when time is within 0.5 bars of a phrase', () => {
      // barLength=2s; 0.5 bars=1s; phrase at 8s; query at 8.9s (within threshold)
      const phrases: PhraseBoundary[] = [
        { time: 8, barNumber: 4, strength: 0.3, type: 'phrase-4' },
      ]
      const result = getPhraseScoringForTime(8.9, phrases, BPM)
      expect(result.score).toBeCloseTo(0.3, 5)
      expect(result.alignedPhrase).toEqual(phrases[0])
    })

    it('returns scaled score and null alignedPhrase when time is > 0.5 bars but within 4 bars', () => {
      // phrase at 0s; query at 3s (1.5 bars away, outside 0.5 bar threshold, inside 4 bar window)
      const phrases: PhraseBoundary[] = [
        { time: 0, barNumber: 0, strength: 0.9, type: 'phrase-32' },
      ]
      const result = getPhraseScoringForTime(3, phrases, BPM)
      expect(result.alignedPhrase).toBeNull()
      // scaledScore = max(0.1, 0.3 * (1 - min(1, 3/8))) = 0.3 * (1 - 0.375) = 0.3 * 0.625 = 0.1875
      expect(result.score).toBeGreaterThan(0.1)
      expect(result.score).toBeLessThan(0.3)
    })

    it('returns minimum score of 0.1 when time is more than 4 bars from any phrase', () => {
      // barLength=2s; 4 bars=8s; phrase at 0s; query at 100s (50 bars away)
      const phrases: PhraseBoundary[] = [
        { time: 0, barNumber: 0, strength: 0.9, type: 'phrase-32' },
      ]
      const result = getPhraseScoringForTime(100, phrases, BPM)
      expect(result.alignedPhrase).toBeNull()
      // bestDistance=100, maxDistance=8; scaledScore = max(0.1, 0.3 * (1 - 1)) = max(0.1, 0) = 0.1
      expect(result.score).toBeCloseTo(0.1, 5)
    })
  })
})
