import type { CuePoint } from '@shared/types/waveform.types'

export interface CueTrackInfo {
  title: string
  artist?: string
  duration: number // seconds (raw, before trim)
  crossfadeDuration: number // seconds into next track (0 for last)
  trimStart?: number // seconds — effective start of track
  trimEnd?: number // seconds — effective end of track
  tempoAdjustment?: number // playback rate multiplier (e.g. 1.015)
  cuePoints?: CuePoint[]
}

/**
 * Convert seconds to CUE timestamp format MM:SS:FF (FF = frames at 75fps).
 */
export function secondsToCueTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  const frames = Math.min(74, Math.round((totalSeconds % 1) * 75))

  return (
    String(minutes).padStart(2, '0') +
    ':' +
    String(seconds).padStart(2, '0') +
    ':' +
    String(frames).padStart(2, '0')
  )
}

/** Get the effective (trimmed + tempo-adjusted) duration of a track. */
export function effectiveDuration(track: CueTrackInfo): number {
  let dur = (track.trimEnd ?? track.duration) - (track.trimStart ?? 0)
  // Tempo adjustment changes output duration: faster = shorter, slower = longer
  if (track.tempoAdjustment && track.tempoAdjustment !== 1) {
    dur /= track.tempoAdjustment
  }
  return dur
}

/**
 * Compute start times for each track accounting for crossfade overlaps.
 * Uses effective (trimmed) durations.
 * startTime[0] = 0
 * startTime[i] = startTime[i-1] + effectiveDuration[i-1] - crossfade[i-1]
 */
export function computeStartTimes(tracks: CueTrackInfo[]): number[] {
  const startTimes: number[] = [0]

  for (let i = 1; i < tracks.length; i++) {
    const prev = tracks[i - 1]
    startTimes.push(
      startTimes[i - 1] + effectiveDuration(prev) - prev.crossfadeDuration
    )
  }

  return startTimes
}

/**
 * Generate a .cue sheet string for the given tracks.
 */
export function generateCueSheet(
  tracks: CueTrackInfo[],
  title: string,
  filename: string,
  metadata?: { artist?: string; genre?: string; comment?: string }
): string {
  const startTimes = computeStartTimes(tracks)
  const lines: string[] = []

  lines.push(`PERFORMER "${escapeQuotes(metadata?.artist ?? title)}"`)
  lines.push(`TITLE "${escapeQuotes(title)}"`)
  if (metadata?.genre) lines.push(`REM GENRE "${escapeQuotes(metadata.genre)}"`)
  if (metadata?.comment)
    lines.push(`REM COMMENT "${escapeQuotes(metadata.comment)}"`)
  lines.push(`FILE "${escapeQuotes(filename)}" WAVE`)

  for (let i = 0; i < tracks.length; i++) {
    const trackNum = String(i + 1).padStart(2, '0')
    const track = tracks[i]

    lines.push(`  TRACK ${trackNum} AUDIO`)
    lines.push(`    TITLE "${escapeQuotes(track.title)}"`)
    if (track.artist) {
      lines.push(`    PERFORMER "${escapeQuotes(track.artist)}"`)
    }
    lines.push(`    INDEX 01 ${secondsToCueTime(startTimes[i])}`)

    // Emit marker cue points as additional INDEX entries
    const markers = (track.cuePoints ?? [])
      .filter((cp) => cp.type === 'marker')
      .sort((a, b) => a.timestamp - b.timestamp)

    for (let j = 0; j < markers.length; j++) {
      const cp = markers[j]
      // Cue point timestamp is relative to track start; convert to mix time
      const cpMixTime = startTimes[i] + (cp.timestamp - (track.trimStart ?? 0))
      lines.push(`    REM CUE "${escapeQuotes(cp.label)}"`)
      lines.push(
        `    INDEX ${String(j + 2).padStart(2, '0')} ${secondsToCueTime(cpMixTime)}`
      )
    }
  }

  return lines.join('\n') + '\n'
}

function escapeQuotes(str: string): string {
  return str.replace(/"/g, '\\"')
}
