import type { TrackSection } from '../types/sectionDetection.types'

export type PhraseType = 'phrase-4' | 'phrase-8' | 'phrase-16' | 'phrase-32'

export interface PhraseBoundary {
  /** Time in seconds */
  time: number
  /** Bar number from the start of the track */
  barNumber: number
  /** Boundary strength 0–1 (higher = better mix point) */
  strength: number
  /** Type based on bar multiple */
  type: PhraseType
}

interface DetectPhrasesOptions {
  bpm: number
  firstBeatOffset: number
  duration: number
  energyProfile?: number[]
  sections?: TrackSection[]
}

/**
 * Detect phrase boundaries from beat grid + energy profile.
 *
 * Algorithm:
 * 1. Compute beat grid from BPM and firstBeatOffset
 * 2. Group into bars (4 beats per bar for 4/4 time)
 * 3. Mark phrase boundaries at bar multiples: every 4, 8, 16, 32 bars
 * 4. Score boundaries by energy change at that point
 * 5. Boost boundaries that align with section boundaries
 */
export function detectPhrases(options: DetectPhrasesOptions): PhraseBoundary[] {
  const { bpm, firstBeatOffset, duration, energyProfile, sections } = options

  if (bpm <= 0 || duration <= 0) return []

  const beatLength = 60 / bpm
  const barLength = beatLength * 4 // 4/4 time
  const totalBars = Math.floor((duration - firstBeatOffset) / barLength)

  if (totalBars <= 0) return []

  const boundaries: PhraseBoundary[] = []

  for (let bar = 0; bar <= totalBars; bar++) {
    const time = firstBeatOffset + bar * barLength
    if (time < 0 || time > duration) continue

    // Determine phrase type by bar multiple
    let type: PhraseType | null = null
    if (bar % 32 === 0) type = 'phrase-32'
    else if (bar % 16 === 0) type = 'phrase-16'
    else if (bar % 8 === 0) type = 'phrase-8'
    else if (bar % 4 === 0) type = 'phrase-4'

    if (!type) continue

    // Base strength from phrase type
    let strength = getPhraseBaseStrength(type)

    // Boost by energy change at this point
    if (energyProfile && energyProfile.length > 0) {
      const energyChange = getEnergyChangeAt(time, duration, energyProfile)
      strength = Math.min(1, strength + energyChange * 0.3)
    }

    // Boost if aligned with a section boundary
    if (sections && sections.length > 0) {
      const sectionAligned = sections.some(
        (s) => Math.abs(s.startTime - time) < barLength * 0.5
      )
      if (sectionAligned) {
        strength = Math.min(1, strength + 0.2)
      }
    }

    boundaries.push({ time, barNumber: bar, strength, type })
  }

  return boundaries
}

/**
 * Base strength by phrase type.
 */
function getPhraseBaseStrength(type: PhraseType): number {
  switch (type) {
    case 'phrase-32':
      return 0.9
    case 'phrase-16':
      return 0.7
    case 'phrase-8':
      return 0.5
    case 'phrase-4':
      return 0.3
  }
}

/**
 * Get the energy change magnitude at a given time.
 * Returns 0–1 where higher means bigger energy change.
 */
function getEnergyChangeAt(
  time: number,
  duration: number,
  energyProfile: number[]
): number {
  const idx = Math.floor((time / duration) * energyProfile.length)
  const windowSize = 3

  // Average energy before and after this point
  let before = 0
  let after = 0
  let countBefore = 0
  let countAfter = 0

  for (let i = Math.max(0, idx - windowSize); i < idx; i++) {
    before += energyProfile[i]
    countBefore++
  }
  for (let i = idx; i < Math.min(energyProfile.length, idx + windowSize); i++) {
    after += energyProfile[i]
    countAfter++
  }

  if (countBefore === 0 || countAfter === 0) return 0

  const avgBefore = before / countBefore
  const avgAfter = after / countAfter

  return Math.abs(avgAfter - avgBefore)
}

/**
 * Get the phrase score for a given crossfade start time.
 * Returns 0–1 based on alignment to the nearest phrase boundary.
 */
export function getPhraseScoringForTime(
  time: number,
  phrases: PhraseBoundary[],
  bpm: number
): { score: number; alignedPhrase: PhraseBoundary | null } {
  if (phrases.length === 0 || bpm <= 0) {
    return { score: 0.2, alignedPhrase: null }
  }

  const barLength = (4 * 60) / bpm
  let bestPhrase: PhraseBoundary | null = null
  let bestDistance = Infinity

  for (const p of phrases) {
    const dist = Math.abs(p.time - time)
    if (dist < bestDistance) {
      bestDistance = dist
      bestPhrase = p
    }
  }

  if (!bestPhrase) return { score: 0.2, alignedPhrase: null }

  // If within half a bar, consider it aligned
  if (bestDistance < barLength * 0.5) {
    return {
      score: getPhraseBaseStrength(bestPhrase.type),
      alignedPhrase: bestPhrase,
    }
  }

  // Otherwise, scale down based on distance
  const maxDistance = barLength * 4 // 4 bars
  const scaledScore = Math.max(
    0.1,
    0.3 * (1 - Math.min(1, bestDistance / maxDistance))
  )
  return { score: scaledScore, alignedPhrase: null }
}
