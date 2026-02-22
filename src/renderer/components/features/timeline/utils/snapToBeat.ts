/**
 * Snaps a timestamp to the nearest beat boundary given BPM and first beat offset.
 */
export function snapToNearestBeat(
  timestamp: number,
  bpm: number,
  firstBeatOffset: number
): number {
  const beatInterval = 60 / bpm
  const beatIndex = Math.round((timestamp - firstBeatOffset) / beatInterval)
  return firstBeatOffset + beatIndex * beatInterval
}
