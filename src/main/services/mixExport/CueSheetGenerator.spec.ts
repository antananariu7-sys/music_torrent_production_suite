import {
  secondsToCueTime,
  computeStartTimes,
  effectiveDuration,
  generateCueSheet,
  type CueTrackInfo,
} from './CueSheetGenerator'
import type { CuePoint } from '@shared/types/waveform.types'

describe('secondsToCueTime', () => {
  it('converts 0 seconds', () => {
    expect(secondsToCueTime(0)).toBe('00:00:00')
  })

  it('converts simple seconds', () => {
    expect(secondsToCueTime(65)).toBe('01:05:00')
  })

  it('converts with frames', () => {
    // 0.5s = 37.5 frames → rounds to 38
    expect(secondsToCueTime(10.5)).toBe('00:10:38')
  })

  it('converts large values', () => {
    // 4 min 35s = 275s
    expect(secondsToCueTime(275)).toBe('04:35:00')
  })

  it('handles fractional seconds at 75fps', () => {
    // 1/75 = 0.01333... → 1 frame
    expect(secondsToCueTime(0.01333)).toBe('00:00:01')
  })

  it('clamps frames to 74 when rounding would produce 75', () => {
    // 0.9967 * 75 = 74.7525 → Math.round = 75 → must clamp to 74
    expect(secondsToCueTime(0.9967)).toBe('00:00:74')
    // Also at an offset: 61.9967s = 1:01:74
    expect(secondsToCueTime(61.9967)).toBe('01:01:74')
  })
})

describe('computeStartTimes', () => {
  it('returns [0] for single track', () => {
    const tracks: CueTrackInfo[] = [
      { title: 'A', duration: 200, crossfadeDuration: 0 },
    ]
    expect(computeStartTimes(tracks)).toEqual([0])
  })

  it('computes start times without crossfade', () => {
    const tracks: CueTrackInfo[] = [
      { title: 'A', duration: 200, crossfadeDuration: 0 },
      { title: 'B', duration: 180, crossfadeDuration: 0 },
      { title: 'C', duration: 150, crossfadeDuration: 0 },
    ]
    expect(computeStartTimes(tracks)).toEqual([0, 200, 380])
  })

  it('subtracts crossfade from start times', () => {
    const tracks: CueTrackInfo[] = [
      { title: 'A', duration: 200, crossfadeDuration: 5 },
      { title: 'B', duration: 180, crossfadeDuration: 3 },
      { title: 'C', duration: 150, crossfadeDuration: 0 },
    ]
    // Track B starts at 200 - 5 = 195
    // Track C starts at 195 + 180 - 3 = 372
    expect(computeStartTimes(tracks)).toEqual([0, 195, 372])
  })

  it('uses effective duration when trim is set', () => {
    const tracks: CueTrackInfo[] = [
      { title: 'A', duration: 300, crossfadeDuration: 5, trimStart: 30, trimEnd: 270 },
      { title: 'B', duration: 200, crossfadeDuration: 0 },
    ]
    // effective duration of A = 270 - 30 = 240
    // B starts at 240 - 5 = 235
    expect(computeStartTimes(tracks)).toEqual([0, 235])
  })

  it('uses trimEnd only for effective duration', () => {
    const tracks: CueTrackInfo[] = [
      { title: 'A', duration: 300, crossfadeDuration: 0, trimEnd: 200 },
      { title: 'B', duration: 180, crossfadeDuration: 0 },
    ]
    // effective duration of A = 200 - 0 = 200
    expect(computeStartTimes(tracks)).toEqual([0, 200])
  })
})

describe('effectiveDuration', () => {
  it('returns raw duration when no trim', () => {
    expect(effectiveDuration({ title: 'A', duration: 300, crossfadeDuration: 0 })).toBe(300)
  })

  it('subtracts trimStart', () => {
    expect(effectiveDuration({ title: 'A', duration: 300, crossfadeDuration: 0, trimStart: 30 })).toBe(270)
  })

  it('uses trimEnd instead of duration', () => {
    expect(effectiveDuration({ title: 'A', duration: 300, crossfadeDuration: 0, trimEnd: 250 })).toBe(250)
  })

  it('uses both trimStart and trimEnd', () => {
    expect(effectiveDuration({ title: 'A', duration: 300, crossfadeDuration: 0, trimStart: 30, trimEnd: 250 })).toBe(220)
  })
})

describe('generateCueSheet', () => {
  it('generates valid cue sheet for 3 tracks', () => {
    const tracks: CueTrackInfo[] = [
      { title: 'Song One', artist: 'Artist A', duration: 275, crossfadeDuration: 5 },
      { title: 'Song Two', artist: 'Artist B', duration: 200, crossfadeDuration: 3 },
      { title: 'Song Three', duration: 180, crossfadeDuration: 0 },
    ]

    const cue = generateCueSheet(tracks, 'My Mix', 'output.flac')

    expect(cue).toContain('PERFORMER "My Mix"')
    expect(cue).toContain('TITLE "My Mix"')
    expect(cue).toContain('FILE "output.flac" WAVE')
    expect(cue).toContain('TRACK 01 AUDIO')
    expect(cue).toContain('TITLE "Song One"')
    expect(cue).toContain('PERFORMER "Artist A"')
    expect(cue).toContain('INDEX 01 00:00:00')
    expect(cue).toContain('TRACK 02 AUDIO')
    expect(cue).toContain('TITLE "Song Two"')
    // Track 2 starts at 275 - 5 = 270s = 4:30:00
    expect(cue).toContain('INDEX 01 04:30:00')
    expect(cue).toContain('TRACK 03 AUDIO')
    expect(cue).toContain('TITLE "Song Three"')
    // No PERFORMER for track 3 (no artist)
    expect(cue).not.toContain('PERFORMER "undefined"')
  })

  it('generates valid cue sheet for single track', () => {
    const tracks: CueTrackInfo[] = [
      { title: 'Only Song', artist: 'Solo', duration: 300, crossfadeDuration: 0 },
    ]

    const cue = generateCueSheet(tracks, 'Solo Mix', 'solo.wav')

    expect(cue).toContain('TRACK 01 AUDIO')
    expect(cue).toContain('INDEX 01 00:00:00')
    expect(cue).not.toContain('TRACK 02')
  })

  it('escapes quotes in titles', () => {
    const tracks: CueTrackInfo[] = [
      { title: 'He said "hello"', duration: 100, crossfadeDuration: 0 },
    ]

    const cue = generateCueSheet(tracks, 'Mix "2024"', 'out.flac')

    expect(cue).toContain('TITLE "Mix \\"2024\\""')
    expect(cue).toContain('TITLE "He said \\"hello\\""')
  })

  it('uses metadata.artist for PERFORMER and adds REM fields', () => {
    const tracks: CueTrackInfo[] = [
      { title: 'Track 1', duration: 200, crossfadeDuration: 0 },
    ]

    const cue = generateCueSheet(tracks, 'My Mix', 'out.flac', {
      artist: 'DJ Test',
      genre: 'Electronic',
      comment: 'Live set recording',
    })

    expect(cue).toContain('PERFORMER "DJ Test"')
    expect(cue).toContain('TITLE "My Mix"')
    expect(cue).toContain('REM GENRE "Electronic"')
    expect(cue).toContain('REM COMMENT "Live set recording"')
  })

  it('falls back to title for PERFORMER when metadata.artist is absent', () => {
    const tracks: CueTrackInfo[] = [
      { title: 'Track 1', duration: 200, crossfadeDuration: 0 },
    ]

    const cue = generateCueSheet(tracks, 'My Mix', 'out.flac', { genre: 'Jazz' })

    expect(cue).toContain('PERFORMER "My Mix"')
    expect(cue).toContain('REM GENRE "Jazz"')
    expect(cue).not.toContain('REM COMMENT')
  })

  it('emits marker cue points as INDEX entries', () => {
    const cuePoints: CuePoint[] = [
      { id: '1', timestamp: 60, label: 'drop', type: 'marker' },
      { id: '2', timestamp: 120, label: 'breakdown', type: 'marker' },
      { id: '3', timestamp: 30, label: 'trim start', type: 'trim-start' },
    ]
    const tracks: CueTrackInfo[] = [
      { title: 'Song A', duration: 300, crossfadeDuration: 5, cuePoints },
      { title: 'Song B', duration: 200, crossfadeDuration: 0 },
    ]

    const cue = generateCueSheet(tracks, 'Mix', 'out.flac')

    // Only marker cue points should be emitted (not trim-start)
    expect(cue).toContain('REM CUE "drop"')
    expect(cue).toContain('INDEX 02 01:00:00')  // 60s in mix
    expect(cue).toContain('REM CUE "breakdown"')
    expect(cue).toContain('INDEX 03 02:00:00')  // 120s in mix
    expect(cue).not.toContain('REM CUE "trim start"')
  })

  it('computes cue point mix times relative to track start with trim offset', () => {
    const cuePoints: CuePoint[] = [
      { id: '1', timestamp: 50, label: 'intro end', type: 'marker' },
    ]
    const tracks: CueTrackInfo[] = [
      { title: 'Song A', duration: 300, crossfadeDuration: 5, trimStart: 20 },
      {
        title: 'Song B', duration: 200, crossfadeDuration: 0,
        trimStart: 10, cuePoints,
      },
    ]

    const cue = generateCueSheet(tracks, 'Mix', 'out.flac')

    // Track A effective = 300 - 20 = 280, start at 0
    // Track B starts at 280 - 5 = 275
    // Cue at timestamp=50, trimStart=10: mix time = 275 + (50 - 10) = 315 = 5:15:00
    expect(cue).toContain('REM CUE "intro end"')
    expect(cue).toContain('INDEX 02 05:15:00')
  })

  it('uses effective durations for start time calculation', () => {
    const tracks: CueTrackInfo[] = [
      { title: 'Song A', duration: 300, crossfadeDuration: 5, trimStart: 30, trimEnd: 270 },
      { title: 'Song B', duration: 200, crossfadeDuration: 0 },
    ]

    const cue = generateCueSheet(tracks, 'Mix', 'out.flac')

    // Track A effective = 270 - 30 = 240, minus crossfade 5 = 235
    // Track B INDEX 01 at 235s = 3:55:00
    expect(cue).toContain('INDEX 01 03:55:00')
  })

  it('sorts cue points by timestamp', () => {
    const cuePoints: CuePoint[] = [
      { id: '2', timestamp: 120, label: 'second', type: 'marker' },
      { id: '1', timestamp: 60, label: 'first', type: 'marker' },
    ]
    const tracks: CueTrackInfo[] = [
      { title: 'Song A', duration: 300, crossfadeDuration: 0, cuePoints },
    ]

    const cue = generateCueSheet(tracks, 'Mix', 'out.flac')

    const lines = cue.split('\n')
    const idx02 = lines.findIndex((l) => l.includes('INDEX 02'))
    const idx03 = lines.findIndex((l) => l.includes('INDEX 03'))
    expect(idx02).toBeLessThan(idx03)
    expect(lines[idx02 - 1]).toContain('first')
    expect(lines[idx03 - 1]).toContain('second')
  })
})
