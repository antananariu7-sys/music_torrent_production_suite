import { computeEnergyProfile } from '@shared/utils/energyAnalyzer'
import { isCompatible, parseCamelot } from '@shared/utils/camelotWheel'
import {
  detectPhrases,
  getPhraseScoringForTime,
} from '@shared/utils/phraseDetector'
import type { TrackSection } from '@shared/types/sectionDetection.types'

export interface MixPointSuggestion {
  /** Seconds before end of outgoing track where crossfade should start */
  crossfadeDuration: number
  /** Confidence in suggestion (0–1) */
  confidence: number
  /** Human-readable reason */
  reason: string
}

/** Enhanced suggestion with scoring breakdown */
export interface EnhancedMixPointSuggestion extends MixPointSuggestion {
  /** Whether crossfade is aligned to a phrase boundary */
  phraseAligned: boolean
  /** Key compatibility score 0–1 */
  keyScore: number
  /** Energy analysis score 0–1 */
  energyScore: number
  /** Phrase alignment score 0–1 */
  phraseScore: number
  /** Detailed reasoning per factor */
  breakdown: string[]
}

/** Customizable scoring weights */
export interface MixPointWeights {
  energy: number
  phrase: number
  key: number
}

/** Default weights: energy-dominant, phrase secondary, key tertiary */
export const DEFAULT_WEIGHTS: MixPointWeights = {
  energy: 0.5,
  phrase: 0.35,
  key: 0.15,
}

interface TrackInfo {
  duration: number
  peaks: number[]
  energyProfile?: number[]
  bpm?: number
  firstBeatOffset?: number
  trimEnd?: number
  trimStart?: number
}

interface SuggestOptions {
  weights?: MixPointWeights
  outSections?: TrackSection[]
  inSections?: TrackSection[]
  outKey?: string // Camelot notation, e.g. "8B"
  inKey?: string
}

/**
 * Suggest optimal crossfade start and duration by analyzing energy profiles,
 * phrase alignment, and key compatibility.
 *
 * Enhanced Algorithm:
 * 1. Get/compute energy profiles for both tracks
 * 2. Find energy drop/rise points (existing logic)
 * 3. Detect phrase boundaries if BPM available
 * 4. Score crossfade candidates on energy, phrase, and key
 * 5. Return best candidate with scoring breakdown
 */
export function suggestMixPoint(
  outgoing: TrackInfo,
  incoming: TrackInfo,
  options?: SuggestOptions
): EnhancedMixPointSuggestion {
  const weights = options?.weights ?? DEFAULT_WEIGHTS
  const outEnergy =
    outgoing.energyProfile ?? computeEnergyProfile(outgoing.peaks)
  const inEnergy =
    incoming.energyProfile ?? computeEnergyProfile(incoming.peaks)

  if (outEnergy.length === 0 || inEnergy.length === 0) {
    return {
      crossfadeDuration: 5,
      confidence: 0,
      reason: 'No energy data available — using default',
      phraseAligned: false,
      keyScore: 0,
      energyScore: 0,
      phraseScore: 0,
      breakdown: ['No energy data available'],
    }
  }

  const outDuration = outgoing.trimEnd ?? outgoing.duration
  const inDuration = incoming.duration
  const inStart = incoming.trimStart ?? 0

  // ── Energy analysis (existing logic) ────────────────────────────────────

  const outStartIdx = Math.floor(outEnergy.length * 0.7)
  let outDropIdx = outEnergy.length - 1
  for (let i = outStartIdx; i < outEnergy.length; i++) {
    if (outEnergy[i] < 0.5) {
      outDropIdx = i
      break
    }
  }

  const inEndIdx = Math.floor(inEnergy.length * 0.3)
  let inRiseIdx = 0
  for (let i = 0; i < inEndIdx; i++) {
    if (inEnergy[i] > 0.3) {
      inRiseIdx = i
      break
    }
  }

  const outDropTime = (outDropIdx / outEnergy.length) * outDuration
  const inRiseTime = inStart + (inRiseIdx / inEnergy.length) * inDuration

  let suggestedDuration = outDuration - outDropTime + inRiseTime
  suggestedDuration = Math.max(4, Math.min(16, suggestedDuration))

  // Snap to nearest beat if BPM available
  if (outgoing.bpm && outgoing.bpm > 0) {
    const beatLength = 60 / outgoing.bpm
    const phraseLength = beatLength * 4
    suggestedDuration =
      Math.round(suggestedDuration / phraseLength) * phraseLength
    suggestedDuration = Math.max(4, Math.min(16, suggestedDuration))
  }

  suggestedDuration = Math.round(suggestedDuration * 2) / 2

  // Energy score
  const outDropSharpness =
    outEnergy[outStartIdx] - outEnergy[outEnergy.length - 1]
  const inRiseSharpness = inEnergy[inEndIdx] > 0 ? inEnergy[inEndIdx] : 0
  const energyScore = Math.max(
    0,
    Math.min(1, (outDropSharpness + inRiseSharpness) / 1.5)
  )

  const breakdown: string[] = []
  breakdown.push(
    `Energy: outgoing drops at ${Math.round((outDropIdx / outEnergy.length) * 100)}%, incoming rises at ${Math.round((inRiseIdx / inEnergy.length) * 100)}%`
  )

  // ── Phrase scoring ──────────────────────────────────────────────────────

  let phraseScore = 0.2 // default when no BPM
  let phraseAligned = false

  if (outgoing.bpm && outgoing.bpm > 0) {
    const crossfadeStartTime = outDuration - suggestedDuration
    const outPhrases = detectPhrases({
      bpm: outgoing.bpm,
      firstBeatOffset: outgoing.firstBeatOffset ?? 0,
      duration: outgoing.duration,
      energyProfile: outgoing.energyProfile,
      sections: options?.outSections,
    })

    const phraseResult = getPhraseScoringForTime(
      crossfadeStartTime,
      outPhrases,
      outgoing.bpm
    )
    phraseScore = phraseResult.score
    phraseAligned = phraseResult.alignedPhrase !== null

    if (phraseResult.alignedPhrase) {
      const barsPerPhrase = phraseResult.alignedPhrase.type.replace(
        'phrase-',
        ''
      )
      breakdown.push(
        `Phrase: aligned to ${barsPerPhrase}-bar boundary (bar ${phraseResult.alignedPhrase.barNumber})`
      )
    } else {
      breakdown.push('Phrase: not aligned to a major phrase boundary')
    }
  } else {
    breakdown.push('Phrase: no BPM data — skipped')
  }

  // ── Key scoring ─────────────────────────────────────────────────────────

  let keyScore = 0.5 // neutral when no key data
  const outKey = options?.outKey
  const inKey = options?.inKey

  if (outKey && inKey) {
    const outParsed = parseCamelot(outKey)
    const inParsed = parseCamelot(inKey)

    if (outParsed && inParsed) {
      if (
        outParsed.number === inParsed.number &&
        outParsed.letter === inParsed.letter
      ) {
        keyScore = 1.0
        breakdown.push(`Key: same key (${outKey})`)
      } else if (isCompatible(outKey, inKey)) {
        keyScore = 0.85
        breakdown.push(`Key: compatible (${outKey} → ${inKey})`)
      } else {
        // Compute distance on Camelot wheel
        const numDiff = Math.min(
          Math.abs(outParsed.number - inParsed.number),
          12 - Math.abs(outParsed.number - inParsed.number)
        )
        const letterDiff = outParsed.letter !== inParsed.letter ? 1 : 0
        const distance = numDiff + letterDiff
        keyScore = Math.max(0.1, 1 - distance * 0.15)
        breakdown.push(
          `Key: ${outKey} → ${inKey} (distance: ${distance}, ${keyScore < 0.4 ? 'clash' : 'moderate'})`
        )
      }
    } else {
      breakdown.push('Key: could not parse Camelot keys')
    }
  } else {
    breakdown.push('Key: no key data — using neutral score')
  }

  // ── Overall score ───────────────────────────────────────────────────────

  const overallScore =
    energyScore * weights.energy +
    phraseScore * weights.phrase +
    keyScore * weights.key
  const confidence = Math.max(0, Math.min(1, overallScore))

  let reason = `Energy analysis: outgoing drops at ${Math.round((outDropIdx / outEnergy.length) * 100)}%`
  if (outgoing.bpm) {
    reason += ` — snapped to ${outgoing.bpm} BPM`
    if (phraseAligned) reason += ' (phrase-aligned)'
  }
  if (outKey && inKey) {
    reason += ` | Key: ${outKey} → ${inKey}`
  }

  return {
    crossfadeDuration: suggestedDuration,
    confidence,
    reason,
    phraseAligned,
    keyScore,
    energyScore,
    phraseScore,
    breakdown,
  }
}
