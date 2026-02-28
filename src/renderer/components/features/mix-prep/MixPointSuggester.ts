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

/** Scores for an arbitrary crossfade duration */
export interface CrossfadeScores {
  energyScore: number
  phraseScore: number
  keyScore: number
  confidence: number
  phraseAligned: boolean
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

export interface TrackInfo {
  duration: number
  peaks: number[]
  energyProfile?: number[]
  bpm?: number
  firstBeatOffset?: number
  trimEnd?: number
  trimStart?: number
}

export interface SuggestOptions {
  weights?: MixPointWeights
  outSections?: TrackSection[]
  inSections?: TrackSection[]
  outKey?: string // Camelot notation, e.g. "8B"
  inKey?: string
}

// ── Internal helpers ────────────────────────────────────────────────────────

function computeEnergyScore(
  outEnergy: number[],
  inEnergy: number[]
): { energyScore: number; outDropIdx: number; inRiseIdx: number } {
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

  const outDropSharpness =
    outEnergy[outStartIdx] - outEnergy[outEnergy.length - 1]
  const inRiseSharpness = inEnergy[inEndIdx] > 0 ? inEnergy[inEndIdx] : 0
  const energyScore = Math.max(
    0,
    Math.min(1, (outDropSharpness + inRiseSharpness) / 1.5)
  )

  return { energyScore, outDropIdx, inRiseIdx }
}

function computePhraseScore(
  crossfadeStartTime: number,
  outgoing: TrackInfo,
  options?: SuggestOptions
): { phraseScore: number; phraseAligned: boolean; detail: string } {
  if (!outgoing.bpm || outgoing.bpm <= 0) {
    return {
      phraseScore: 0.2,
      phraseAligned: false,
      detail: 'Phrase: no BPM data — skipped',
    }
  }

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

  if (phraseResult.alignedPhrase) {
    const barsPerPhrase = phraseResult.alignedPhrase.type.replace('phrase-', '')
    return {
      phraseScore: phraseResult.score,
      phraseAligned: true,
      detail: `Phrase: aligned to ${barsPerPhrase}-bar boundary (bar ${phraseResult.alignedPhrase.barNumber})`,
    }
  }

  return {
    phraseScore: phraseResult.score,
    phraseAligned: false,
    detail: 'Phrase: not aligned to a major phrase boundary',
  }
}

function computeKeyScore(
  outKey?: string,
  inKey?: string
): { keyScore: number; detail: string } {
  if (!outKey || !inKey) {
    return { keyScore: 0.5, detail: 'Key: no key data — using neutral score' }
  }

  const outParsed = parseCamelot(outKey)
  const inParsed = parseCamelot(inKey)

  if (!outParsed || !inParsed) {
    return { keyScore: 0.5, detail: 'Key: could not parse Camelot keys' }
  }

  if (
    outParsed.number === inParsed.number &&
    outParsed.letter === inParsed.letter
  ) {
    return { keyScore: 1.0, detail: `Key: same key (${outKey})` }
  }

  if (isCompatible(outKey, inKey)) {
    return {
      keyScore: 0.85,
      detail: `Key: compatible (${outKey} → ${inKey})`,
    }
  }

  const numDiff = Math.min(
    Math.abs(outParsed.number - inParsed.number),
    12 - Math.abs(outParsed.number - inParsed.number)
  )
  const letterDiff = outParsed.letter !== inParsed.letter ? 1 : 0
  const distance = numDiff + letterDiff
  const keyScore = Math.max(0.1, 1 - distance * 0.15)
  return {
    keyScore,
    detail: `Key: ${outKey} → ${inKey} (distance: ${distance}, ${keyScore < 0.4 ? 'clash' : 'moderate'})`,
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Score an arbitrary crossfade duration against energy, phrase, and key factors.
 * Lightweight — safe to call on every slider drag event.
 */
export function scoreCrossfadeDuration(
  duration: number,
  outgoing: TrackInfo,
  incoming: TrackInfo,
  options?: SuggestOptions
): CrossfadeScores {
  const weights = options?.weights ?? DEFAULT_WEIGHTS
  const outEnergy =
    outgoing.energyProfile ?? computeEnergyProfile(outgoing.peaks)
  const inEnergy =
    incoming.energyProfile ?? computeEnergyProfile(incoming.peaks)

  if (outEnergy.length === 0 || inEnergy.length === 0) {
    return {
      energyScore: 0,
      phraseScore: 0,
      keyScore: 0,
      confidence: 0,
      phraseAligned: false,
      breakdown: ['No energy data available'],
    }
  }

  const outDuration = outgoing.trimEnd ?? outgoing.duration
  const crossfadeStartTime = outDuration - duration

  const { energyScore, outDropIdx, inRiseIdx } = computeEnergyScore(
    outEnergy,
    inEnergy
  )
  const energyDetail = `Energy: outgoing drops at ${Math.round((outDropIdx / outEnergy.length) * 100)}%, incoming rises at ${Math.round((inRiseIdx / inEnergy.length) * 100)}%`

  const {
    phraseScore,
    phraseAligned,
    detail: phraseDetail,
  } = computePhraseScore(crossfadeStartTime, outgoing, options)

  const { keyScore, detail: keyDetail } = computeKeyScore(
    options?.outKey,
    options?.inKey
  )

  const overallScore =
    energyScore * weights.energy +
    phraseScore * weights.phrase +
    keyScore * weights.key
  const confidence = Math.max(0, Math.min(1, overallScore))

  return {
    energyScore,
    phraseScore,
    keyScore,
    confidence,
    phraseAligned,
    breakdown: [energyDetail, phraseDetail, keyDetail],
  }
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

  // ── Find optimal duration from energy analysis ────────────────────────────

  const { outDropIdx, inRiseIdx } = computeEnergyScore(outEnergy, inEnergy)

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

  // ── Score the suggested duration ──────────────────────────────────────────

  const scores = scoreCrossfadeDuration(
    suggestedDuration,
    outgoing,
    incoming,
    options
  )

  let reason = `Energy analysis: outgoing drops at ${Math.round((outDropIdx / outEnergy.length) * 100)}%`
  if (outgoing.bpm) {
    reason += ` — snapped to ${outgoing.bpm} BPM`
    if (scores.phraseAligned) reason += ' (phrase-aligned)'
  }
  if (options?.outKey && options?.inKey) {
    reason += ` | Key: ${options.outKey} → ${options.inKey}`
  }

  return {
    crossfadeDuration: suggestedDuration,
    confidence: scores.confidence,
    reason,
    phraseAligned: scores.phraseAligned,
    keyScore: scores.keyScore,
    energyScore: scores.energyScore,
    phraseScore: scores.phraseScore,
    breakdown: scores.breakdown,
  }
}
