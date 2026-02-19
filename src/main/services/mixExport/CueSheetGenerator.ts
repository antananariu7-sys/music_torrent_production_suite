export interface CueTrackInfo {
  title: string
  artist?: string
  duration: number    // seconds
  crossfadeDuration: number  // seconds into next track (0 for last)
}

/**
 * Convert seconds to CUE timestamp format MM:SS:FF (FF = frames at 75fps).
 */
export function secondsToCueTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  const frames = Math.round((totalSeconds % 1) * 75)

  return (
    String(minutes).padStart(2, '0') + ':' +
    String(seconds).padStart(2, '0') + ':' +
    String(frames).padStart(2, '0')
  )
}

/**
 * Compute start times for each track accounting for crossfade overlaps.
 * startTime[0] = 0
 * startTime[i] = startTime[i-1] + duration[i-1] - crossfade[i-1]
 */
export function computeStartTimes(tracks: CueTrackInfo[]): number[] {
  const startTimes: number[] = [0]

  for (let i = 1; i < tracks.length; i++) {
    const prev = tracks[i - 1]
    startTimes.push(startTimes[i - 1] + prev.duration - prev.crossfadeDuration)
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
): string {
  const startTimes = computeStartTimes(tracks)
  const lines: string[] = []

  lines.push(`PERFORMER "${escapeQuotes(title)}"`)
  lines.push(`TITLE "${escapeQuotes(title)}"`)
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
  }

  return lines.join('\n') + '\n'
}

function escapeQuotes(str: string): string {
  return str.replace(/"/g, '\\"')
}
