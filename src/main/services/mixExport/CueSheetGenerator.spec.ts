import {
  secondsToCueTime,
  computeStartTimes,
  generateCueSheet,
  type CueTrackInfo,
} from './CueSheetGenerator'

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
})
