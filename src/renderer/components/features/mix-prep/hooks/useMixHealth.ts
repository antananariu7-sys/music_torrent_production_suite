import { useMemo } from 'react'
import { getCompatibilityLabel } from '@shared/utils/camelotWheel'
import type { Song } from '@shared/types/project.types'

export interface TransitionScore {
  index: number
  outgoing: Song
  incoming: Song
  bpmDelta: number
  bpmScore: number
  keyCompatible: boolean | null
  keyLabel: string
  keyScore: number
  bitrateScore: number
  overallScore: number
  grade: 'good' | 'warning' | 'poor'
}

export interface MixHealth {
  totalDuration: number
  trackCount: number
  transitions: TransitionScore[]
  overallScore: number
  overallGrade: 'good' | 'warning' | 'poor'
  issues: string[]
  keyPath: string[]
  energyCurve: number[]
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function toGrade(score: number): 'good' | 'warning' | 'poor' {
  if (score >= 0.7) return 'good'
  if (score >= 0.4) return 'warning'
  return 'poor'
}

function computeTransitionScore(
  outgoing: Song,
  incoming: Song,
  index: number
): TransitionScore {
  // BPM score: 0 delta = 1.0, ≥5 delta = 0.0
  const bpmDelta =
    outgoing.bpm != null && incoming.bpm != null
      ? Math.abs(incoming.bpm - outgoing.bpm)
      : 0
  const bpmScore =
    outgoing.bpm != null && incoming.bpm != null
      ? 1 - clamp(bpmDelta / 5, 0, 1)
      : 0.5

  // Key score: compatible = 1.0, incompatible = 0.3, unknown = 0.5
  const keyResult = getCompatibilityLabel(
    outgoing.musicalKey,
    incoming.musicalKey
  )
  const keyCompatible = keyResult.compatible
  const keyLabel = keyResult.label
  const keyScore =
    keyCompatible === true ? 1.0 : keyCompatible === false ? 0.3 : 0.5

  // Bitrate score: same format & <64k difference = 1.0, else 0.5
  const formatMatch =
    outgoing.format && incoming.format
      ? outgoing.format.toLowerCase() === incoming.format.toLowerCase()
      : true
  const bitrateDelta =
    outgoing.bitrate != null && incoming.bitrate != null
      ? Math.abs(outgoing.bitrate - incoming.bitrate)
      : 0
  const bitrateScore = formatMatch && bitrateDelta <= 64 ? 1.0 : 0.5

  // Weighted composite
  const overallScore = bpmScore * 0.4 + keyScore * 0.35 + bitrateScore * 0.25

  return {
    index,
    outgoing,
    incoming,
    bpmDelta,
    bpmScore,
    keyCompatible,
    keyLabel,
    keyScore,
    bitrateScore,
    overallScore,
    grade: toGrade(overallScore),
  }
}

export function useMixHealth(songs: Song[]): MixHealth {
  return useMemo(() => {
    const trackCount = songs.length

    if (trackCount === 0) {
      return {
        totalDuration: 0,
        trackCount: 0,
        transitions: [],
        overallScore: 0,
        overallGrade: 'poor' as const,
        issues: [],
        keyPath: [],
        energyCurve: [],
      }
    }

    // Total duration
    const totalDuration = songs.reduce((sum, s) => sum + (s.duration ?? 0), 0)

    // Key path
    const keyPath = songs.map((s) => s.musicalKey ?? '?')

    // Energy curve: concatenate energy profiles
    const energyCurve: number[] = []
    for (const song of songs) {
      if (song.energyProfile && song.energyProfile.length > 0) {
        energyCurve.push(...song.energyProfile)
      } else {
        // Flat line at 0.5 for songs without energy data
        const points = 20
        for (let i = 0; i < points; i++) energyCurve.push(0.5)
      }
    }

    // Transition scores
    const transitions: TransitionScore[] = []
    const issues: string[] = []

    for (let i = 0; i < songs.length - 1; i++) {
      const score = computeTransitionScore(songs[i], songs[i + 1], i)
      transitions.push(score)

      // Collect issues
      if (score.bpmDelta > 3) {
        issues.push(
          `Large BPM jump at transition ${i + 1}→${i + 2} (${score.bpmDelta.toFixed(1)} BPM)`
        )
      }
      if (score.keyCompatible === false) {
        issues.push(`Key clash at transition ${i + 1}→${i + 2}`)
      }
      if (score.bitrateScore < 1.0) {
        issues.push(`Bitrate/format mismatch at transition ${i + 1}→${i + 2}`)
      }
    }

    // Overall score: average of transition scores
    const overallScore =
      transitions.length > 0
        ? transitions.reduce((sum, t) => sum + t.overallScore, 0) /
          transitions.length
        : 1.0

    return {
      totalDuration,
      trackCount,
      transitions,
      overallScore,
      overallGrade: toGrade(overallScore),
      issues,
      keyPath,
      energyCurve,
    }
  }, [songs])
}
