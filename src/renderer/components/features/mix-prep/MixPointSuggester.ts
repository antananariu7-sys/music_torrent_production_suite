import { computeEnergyProfile } from '@shared/utils/energyAnalyzer'

export interface MixPointSuggestion {
  /** Seconds before end of outgoing track where crossfade should start */
  crossfadeDuration: number
  /** Confidence in suggestion (0–1) */
  confidence: number
  /** Human-readable reason */
  reason: string
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

/**
 * Suggest optimal crossfade start and duration by analyzing energy profiles.
 *
 * Algorithm:
 * 1. Get/compute energy profiles for both tracks
 * 2. Find where outgoing energy is declining (last 30%)
 * 3. Find where incoming energy is rising (first 30%)
 * 4. Crossfade start: where outgoing drops below 0.5 AND incoming rises above 0.3
 * 5. Snap to nearest beat if BPM data available
 * 6. Duration: proportional to overlap zone (4–16s)
 */
export function suggestMixPoint(
  outgoing: TrackInfo,
  incoming: TrackInfo
): MixPointSuggestion {
  const outEnergy =
    outgoing.energyProfile ?? computeEnergyProfile(outgoing.peaks)
  const inEnergy =
    incoming.energyProfile ?? computeEnergyProfile(incoming.peaks)

  if (outEnergy.length === 0 || inEnergy.length === 0) {
    return {
      crossfadeDuration: 5,
      confidence: 0,
      reason: 'No energy data available — using default',
    }
  }

  const outDuration = outgoing.trimEnd ?? outgoing.duration
  const inDuration = incoming.duration
  const inStart = incoming.trimStart ?? 0

  // Analyze outgoing: find energy drop point in last 30%
  const outStartIdx = Math.floor(outEnergy.length * 0.7)
  let outDropIdx = outEnergy.length - 1
  for (let i = outStartIdx; i < outEnergy.length; i++) {
    if (outEnergy[i] < 0.5) {
      outDropIdx = i
      break
    }
  }

  // Analyze incoming: find energy rise point in first 30%
  const inEndIdx = Math.floor(inEnergy.length * 0.3)
  let inRiseIdx = 0
  for (let i = 0; i < inEndIdx; i++) {
    if (inEnergy[i] > 0.3) {
      inRiseIdx = i
      break
    }
  }

  // Convert indices to time
  const outDropTime = (outDropIdx / outEnergy.length) * outDuration
  const inRiseTime = inStart + (inRiseIdx / inEnergy.length) * inDuration

  // The crossfade duration is the gap between the drop and end of outgoing
  let suggestedDuration = outDuration - outDropTime + inRiseTime

  // Clamp to 4–16s range
  suggestedDuration = Math.max(4, Math.min(16, suggestedDuration))

  // Snap to nearest beat if BPM available on outgoing
  if (outgoing.bpm && outgoing.bpm > 0) {
    const beatLength = 60 / outgoing.bpm
    // Snap to nearest 4-beat phrase
    const phraseLength = beatLength * 4
    suggestedDuration =
      Math.round(suggestedDuration / phraseLength) * phraseLength
    // Re-clamp after snapping
    suggestedDuration = Math.max(4, Math.min(16, suggestedDuration))
  }

  // Round to 0.5s
  suggestedDuration = Math.round(suggestedDuration * 2) / 2

  // Compute confidence based on how clean the energy curves are
  const outDropSharpness =
    outEnergy[outStartIdx] - outEnergy[outEnergy.length - 1]
  const inRiseSharpness = inEnergy[inEndIdx] > 0 ? inEnergy[inEndIdx] : 0
  const confidence = Math.min(1, (outDropSharpness + inRiseSharpness) / 1.5)

  let reason = `Energy analysis: outgoing drops at ${Math.round((outDropIdx / outEnergy.length) * 100)}%, incoming rises at ${Math.round((inRiseIdx / inEnergy.length) * 100)}%`
  if (outgoing.bpm) {
    reason += ` — snapped to ${outgoing.bpm} BPM beat grid`
  }

  return {
    crossfadeDuration: suggestedDuration,
    confidence: Math.max(0, Math.min(1, confidence)),
    reason,
  }
}
