import {
  buildFilterGraph,
  buildRenderArgs,
  buildAtempoChain,
  buildTempoFilter,
  buildVolumeFilter,
  computeKeptSegments,
  type TrackInfo,
} from './FilterGraphBuilder'
import type { LoudnormAnalysis } from '@shared/types/mixExport.types'

const mockLoudnorm: LoudnormAnalysis = {
  input_i: -20,
  input_tp: -5,
  input_lra: 8,
  input_thresh: -30,
}

describe('buildFilterGraph', () => {
  it('builds graph for 2 tracks with normalization and crossfade', () => {
    const tracks: TrackInfo[] = [
      { index: 0, loudnorm: mockLoudnorm, crossfadeDuration: 5 },
      { index: 1, loudnorm: mockLoudnorm, crossfadeDuration: 0 },
    ]

    const graph = buildFilterGraph(tracks, true)

    expect(graph).toContain('[0:a]loudnorm=')
    expect(graph).toContain('[1:a]loudnorm=')
    expect(graph).toContain('acrossfade=d=5:c1=tri:c2=tri[out]')
    expect(graph).toContain('measured_I=-20')
    expect(graph).toContain('linear=true')
  })

  it('builds graph for 3 tracks with different crossfades', () => {
    const tracks: TrackInfo[] = [
      { index: 0, loudnorm: mockLoudnorm, crossfadeDuration: 5 },
      { index: 1, loudnorm: mockLoudnorm, crossfadeDuration: 3 },
      { index: 2, loudnorm: mockLoudnorm, crossfadeDuration: 0 },
    ]

    const graph = buildFilterGraph(tracks, true)

    // Should have intermediate label [f0] and final [out]
    expect(graph).toContain('acrossfade=d=5:c1=tri:c2=tri[f0]')
    expect(graph).toContain('acrossfade=d=3:c1=tri:c2=tri[out]')
  })

  it('handles single track — no crossfade', () => {
    const tracks: TrackInfo[] = [
      { index: 0, loudnorm: mockLoudnorm, crossfadeDuration: 0 },
    ]

    const graph = buildFilterGraph(tracks, true)

    expect(graph).toContain('[0:a]loudnorm=')
    expect(graph).toContain('[out]')
    expect(graph).not.toContain('acrossfade')
    expect(graph).not.toContain('concat')
  })

  it('uses concat for zero crossfade between tracks', () => {
    const tracks: TrackInfo[] = [
      { index: 0, loudnorm: mockLoudnorm, crossfadeDuration: 0 },
      { index: 1, loudnorm: mockLoudnorm, crossfadeDuration: 0 },
    ]

    const graph = buildFilterGraph(tracks, true)

    expect(graph).toContain('concat=n=2:v=0:a=1[out]')
    expect(graph).not.toContain('acrossfade')
  })

  it('skips loudnorm when normalization is off', () => {
    const tracks: TrackInfo[] = [
      { index: 0, loudnorm: mockLoudnorm, crossfadeDuration: 5 },
      { index: 1, loudnorm: mockLoudnorm, crossfadeDuration: 0 },
    ]

    const graph = buildFilterGraph(tracks, false)

    expect(graph).not.toContain('loudnorm')
    expect(graph).toContain('acopy')
  })

  it('uses acopy when loudnorm data is undefined', () => {
    const tracks: TrackInfo[] = [
      { index: 0, loudnorm: undefined, crossfadeDuration: 5 },
      { index: 1, loudnorm: undefined, crossfadeDuration: 0 },
    ]

    const graph = buildFilterGraph(tracks, true)

    expect(graph).toContain('acopy')
    expect(graph).not.toContain('loudnorm')
  })

  it('throws for empty track list', () => {
    expect(() => buildFilterGraph([], true)).toThrow('zero tracks')
  })

  it('inserts atrim with trimStart only', () => {
    const tracks: TrackInfo[] = [
      { index: 0, loudnorm: mockLoudnorm, crossfadeDuration: 5, trimStart: 30 },
      { index: 1, loudnorm: mockLoudnorm, crossfadeDuration: 0 },
    ]

    const graph = buildFilterGraph(tracks, true)

    expect(graph).toContain(
      '[0:a]atrim=start=30,asetpts=PTS-STARTPTS,loudnorm='
    )
    expect(graph).toContain('[1:a]loudnorm=')
  })

  it('inserts atrim with trimEnd only', () => {
    const tracks: TrackInfo[] = [
      { index: 0, loudnorm: mockLoudnorm, crossfadeDuration: 5, trimEnd: 420 },
      { index: 1, loudnorm: mockLoudnorm, crossfadeDuration: 0 },
    ]

    const graph = buildFilterGraph(tracks, true)

    expect(graph).toContain('[0:a]atrim=end=420,asetpts=PTS-STARTPTS,loudnorm=')
  })

  it('inserts atrim with both trimStart and trimEnd', () => {
    const tracks: TrackInfo[] = [
      {
        index: 0,
        loudnorm: mockLoudnorm,
        crossfadeDuration: 5,
        trimStart: 30,
        trimEnd: 420,
      },
      { index: 1, loudnorm: mockLoudnorm, crossfadeDuration: 0 },
    ]

    const graph = buildFilterGraph(tracks, true)

    expect(graph).toContain(
      '[0:a]atrim=start=30:end=420,asetpts=PTS-STARTPTS,loudnorm='
    )
  })

  it('inserts atrim before acopy when normalization is off', () => {
    const tracks: TrackInfo[] = [
      { index: 0, crossfadeDuration: 0, trimStart: 10, trimEnd: 200 },
    ]

    const graph = buildFilterGraph(tracks, false)

    expect(graph).toContain(
      '[0:a]atrim=start=10:end=200,asetpts=PTS-STARTPTS,acopy[out]'
    )
  })

  it('handles trim on some tracks but not others', () => {
    const tracks: TrackInfo[] = [
      { index: 0, loudnorm: mockLoudnorm, crossfadeDuration: 5, trimStart: 15 },
      { index: 1, loudnorm: mockLoudnorm, crossfadeDuration: 3 },
      { index: 2, loudnorm: mockLoudnorm, crossfadeDuration: 0, trimEnd: 300 },
    ]

    const graph = buildFilterGraph(tracks, true)

    expect(graph).toContain(
      '[0:a]atrim=start=15,asetpts=PTS-STARTPTS,loudnorm='
    )
    expect(graph).toContain('[1:a]loudnorm=')
    expect(graph).toContain('[2:a]atrim=end=300,asetpts=PTS-STARTPTS,loudnorm=')
  })

  it('uses equal-power curve params when crossfadeCurveType is equal-power', () => {
    const tracks: TrackInfo[] = [
      {
        index: 0,
        loudnorm: mockLoudnorm,
        crossfadeDuration: 5,
        crossfadeCurveType: 'equal-power',
      },
      { index: 1, loudnorm: mockLoudnorm, crossfadeDuration: 0 },
    ]

    const graph = buildFilterGraph(tracks, true)

    expect(graph).toContain('acrossfade=d=5:c1=qsin:c2=qsin[out]')
  })

  it('uses s-curve params when crossfadeCurveType is s-curve', () => {
    const tracks: TrackInfo[] = [
      {
        index: 0,
        loudnorm: mockLoudnorm,
        crossfadeDuration: 3,
        crossfadeCurveType: 's-curve',
      },
      { index: 1, loudnorm: mockLoudnorm, crossfadeDuration: 0 },
    ]

    const graph = buildFilterGraph(tracks, true)

    expect(graph).toContain('acrossfade=d=3:c1=hsin:c2=hsin[out]')
  })

  it('defaults to linear (tri) when crossfadeCurveType is undefined', () => {
    const tracks: TrackInfo[] = [
      { index: 0, loudnorm: mockLoudnorm, crossfadeDuration: 5 },
      { index: 1, loudnorm: mockLoudnorm, crossfadeDuration: 0 },
    ]

    const graph = buildFilterGraph(tracks, true)

    expect(graph).toContain('acrossfade=d=5:c1=tri:c2=tri[out]')
  })

  it('handles mixed curve types across multiple crossfades', () => {
    const tracks: TrackInfo[] = [
      {
        index: 0,
        loudnorm: mockLoudnorm,
        crossfadeDuration: 5,
        crossfadeCurveType: 'equal-power',
      },
      {
        index: 1,
        loudnorm: mockLoudnorm,
        crossfadeDuration: 3,
        crossfadeCurveType: 's-curve',
      },
      { index: 2, loudnorm: mockLoudnorm, crossfadeDuration: 0 },
    ]

    const graph = buildFilterGraph(tracks, true)

    expect(graph).toContain('acrossfade=d=5:c1=qsin:c2=qsin[f0]')
    expect(graph).toContain('acrossfade=d=3:c1=hsin:c2=hsin[out]')
  })

  it('handles 5 tracks correctly', () => {
    const tracks: TrackInfo[] = Array.from({ length: 5 }, (_, i) => ({
      index: i,
      loudnorm: mockLoudnorm,
      crossfadeDuration: i < 4 ? 3 : 0,
    }))

    const graph = buildFilterGraph(tracks, true)

    // Should have 5 loudnorm filters + 4 crossfade filters
    expect(graph.match(/loudnorm=/g)?.length).toBe(5)
    expect(graph.match(/acrossfade/g)?.length).toBe(4)
    expect(graph).toContain('[out]')
  })

  it('inserts atempo filter when tempoAdjustment is set', () => {
    const tracks: TrackInfo[] = [
      {
        index: 0,
        loudnorm: mockLoudnorm,
        crossfadeDuration: 5,
        tempoAdjustment: 1.05,
      },
      { index: 1, loudnorm: mockLoudnorm, crossfadeDuration: 0 },
    ]

    const graph = buildFilterGraph(tracks, true)

    expect(graph).toContain('atempo=1.05,loudnorm=')
    expect(graph).not.toContain('rubberband')
  })

  it('inserts rubberband filter when useRubberband is true', () => {
    const tracks: TrackInfo[] = [
      {
        index: 0,
        loudnorm: mockLoudnorm,
        crossfadeDuration: 5,
        tempoAdjustment: 1.03,
      },
      { index: 1, loudnorm: mockLoudnorm, crossfadeDuration: 0 },
    ]

    const graph = buildFilterGraph(tracks, true, true)

    expect(graph).toContain('rubberband=tempo=1.03,loudnorm=')
    expect(graph).not.toContain('atempo')
  })

  it('skips tempo filter when tempoAdjustment is 1', () => {
    const tracks: TrackInfo[] = [
      {
        index: 0,
        loudnorm: mockLoudnorm,
        crossfadeDuration: 5,
        tempoAdjustment: 1,
      },
      { index: 1, loudnorm: mockLoudnorm, crossfadeDuration: 0 },
    ]

    const graph = buildFilterGraph(tracks, true)

    expect(graph).not.toContain('atempo')
    expect(graph).not.toContain('rubberband')
  })

  it('skips tempo filter when tempoAdjustment is undefined', () => {
    const tracks: TrackInfo[] = [
      { index: 0, loudnorm: mockLoudnorm, crossfadeDuration: 5 },
      { index: 1, loudnorm: mockLoudnorm, crossfadeDuration: 0 },
    ]

    const graph = buildFilterGraph(tracks, true)

    expect(graph).not.toContain('atempo')
    expect(graph).not.toContain('rubberband')
  })

  it('combines trim + tempo + loudnorm in correct order', () => {
    const tracks: TrackInfo[] = [
      {
        index: 0,
        loudnorm: mockLoudnorm,
        crossfadeDuration: 5,
        trimStart: 30,
        trimEnd: 420,
        tempoAdjustment: 0.95,
      },
      { index: 1, loudnorm: mockLoudnorm, crossfadeDuration: 0 },
    ]

    const graph = buildFilterGraph(tracks, true)

    // Order: atrim → asetpts → atempo → loudnorm
    expect(graph).toContain(
      '[0:a]atrim=start=30:end=420,asetpts=PTS-STARTPTS,atempo=0.95,loudnorm='
    )
  })

  it('applies tempo only to tracks that have tempoAdjustment', () => {
    const tracks: TrackInfo[] = [
      {
        index: 0,
        loudnorm: mockLoudnorm,
        crossfadeDuration: 5,
        tempoAdjustment: 1.02,
      },
      { index: 1, loudnorm: mockLoudnorm, crossfadeDuration: 0 },
    ]

    const graph = buildFilterGraph(tracks, true)

    // Track 0 should have atempo
    expect(graph).toContain('atempo=1.02')
    // Track 1 should not have atempo
    const lines = graph.split(';\n')
    const track1Line = lines.find((l) => l.startsWith('[1:a]'))
    expect(track1Line).not.toContain('atempo')
  })
})

describe('buildAtempoChain', () => {
  it('returns empty string for rate 1', () => {
    expect(buildAtempoChain(1)).toBe('')
  })

  it('returns single atempo for rate within 0.5–2.0', () => {
    expect(buildAtempoChain(1.5)).toBe('atempo=1.5')
    expect(buildAtempoChain(0.8)).toBe('atempo=0.8')
  })

  it('chains multiple atempo filters for rate > 2.0', () => {
    const chain = buildAtempoChain(3.0)
    expect(chain).toContain('atempo=2.0')
    expect(chain.split(',').length).toBe(2)
  })

  it('chains multiple atempo filters for rate < 0.5', () => {
    const chain = buildAtempoChain(0.25)
    expect(chain).toContain('atempo=0.5')
    expect(chain.split(',').length).toBe(2)
  })
})

describe('buildTempoFilter', () => {
  it('returns empty string for rate 1', () => {
    expect(buildTempoFilter(1, false)).toBe('')
    expect(buildTempoFilter(1, true)).toBe('')
  })

  it('returns atempo when useRubberband is false', () => {
    expect(buildTempoFilter(1.05, false)).toBe('atempo=1.05')
  })

  it('returns rubberband when useRubberband is true', () => {
    expect(buildTempoFilter(1.05, true)).toBe('rubberband=tempo=1.05')
  })
})

describe('buildVolumeFilter', () => {
  it('returns empty string when no gain and no envelope', () => {
    expect(buildVolumeFilter(undefined, undefined, 100)).toBe('')
    expect(buildVolumeFilter(0, undefined, 100)).toBe('')
  })

  it('returns static volume filter for gainDb only', () => {
    const filter = buildVolumeFilter(-6, undefined, 100)
    // -6 dB ≈ 0.501187
    expect(filter).toMatch(/^volume=0\.5\d+$/)
  })

  it('returns volume expression for envelope with 2 points', () => {
    const filter = buildVolumeFilter(
      undefined,
      [
        { time: 0, value: 1.0 },
        { time: 10, value: 0.5 },
      ],
      10
    )
    expect(filter).toContain("volume='")
    expect(filter).toContain('if(lt(t,')
  })

  it('applies envelope even when gainDb is 0 (no static gain)', () => {
    // 0 dB gain → multiplier 1.0 → envelope still applied
    const filter = buildVolumeFilter(
      0,
      [
        { time: 0, value: 1.0 },
        { time: 10, value: 0.5 },
      ],
      10
    )
    // Envelope present with 2+ points → volume expression generated
    expect(filter).toContain("volume='")
    expect(filter).toContain('if(lt(t,')
  })

  it('combines gainDb with envelope', () => {
    const filter = buildVolumeFilter(
      -6,
      [
        { time: 0, value: 1.0 },
        { time: 10, value: 0.5 },
      ],
      10
    )
    expect(filter).toContain("volume='")
    // First value should be ~0.5 (1.0 * dbToLinear(-6))
    expect(filter).toMatch(/0\.50\d+/)
  })

  it('handles 3-point envelope', () => {
    const filter = buildVolumeFilter(
      undefined,
      [
        { time: 0, value: 1.0 },
        { time: 5, value: 0.5 },
        { time: 10, value: 1.0 },
      ],
      10
    )
    expect(filter).toContain("volume='")
    // Should have nested if() expressions
    expect(filter).toContain('if(lt(t,5)')
    expect(filter).toContain('if(lt(t,10)')
  })

  it('inserts volume filter in filter graph', () => {
    const tracks: TrackInfo[] = [
      {
        index: 0,
        loudnorm: mockLoudnorm,
        crossfadeDuration: 0,
        gainDb: -3,
      },
    ]
    const graph = buildFilterGraph(tracks, true)
    expect(graph).toContain('volume=')
    expect(graph).toContain('loudnorm=')
  })

  it('inserts volume filter after tempo and before loudnorm', () => {
    const tracks: TrackInfo[] = [
      {
        index: 0,
        loudnorm: mockLoudnorm,
        crossfadeDuration: 0,
        tempoAdjustment: 1.05,
        gainDb: -3,
      },
    ]
    const graph = buildFilterGraph(tracks, true)
    // Order: atempo → volume → loudnorm
    const parts = graph.split(',')
    const atempoIdx = parts.findIndex((p) => p.includes('atempo'))
    const volumeIdx = parts.findIndex((p) => p.includes('volume'))
    const loudnormIdx = parts.findIndex((p) => p.includes('loudnorm'))
    expect(atempoIdx).toBeLessThan(volumeIdx)
    expect(volumeIdx).toBeLessThan(loudnormIdx)
  })

  it('skips volume filter when gainDb is 0 and no envelope', () => {
    const tracks: TrackInfo[] = [
      {
        index: 0,
        loudnorm: mockLoudnorm,
        crossfadeDuration: 0,
        gainDb: 0,
      },
    ]
    const graph = buildFilterGraph(tracks, true)
    expect(graph).not.toContain('volume=')
  })
})

describe('computeKeptSegments', () => {
  it('returns full range when no regions', () => {
    const kept = computeKeptSegments(undefined, undefined, 120, undefined)
    expect(kept).toEqual([{ start: 0, end: 120 }])
  })

  it('returns trimmed range when no regions', () => {
    const kept = computeKeptSegments(10, 100, 120, [])
    expect(kept).toEqual([{ start: 10, end: 100 }])
  })

  it('splits around a single region', () => {
    const kept = computeKeptSegments(0, 120, 120, [
      { id: 'r1', startTime: 30, endTime: 45, enabled: true },
    ])
    expect(kept).toEqual([
      { start: 0, end: 30 },
      { start: 45, end: 120 },
    ])
  })

  it('splits around multiple regions', () => {
    const kept = computeKeptSegments(0, 120, 120, [
      { id: 'r1', startTime: 30, endTime: 45, enabled: true },
      { id: 'r2', startTime: 90, endTime: 100, enabled: true },
    ])
    expect(kept).toEqual([
      { start: 0, end: 30 },
      { start: 45, end: 90 },
      { start: 100, end: 120 },
    ])
  })

  it('merges overlapping regions', () => {
    const kept = computeKeptSegments(0, 120, 120, [
      { id: 'r1', startTime: 30, endTime: 50, enabled: true },
      { id: 'r2', startTime: 40, endTime: 60, enabled: true },
    ])
    expect(kept).toEqual([
      { start: 0, end: 30 },
      { start: 60, end: 120 },
    ])
  })

  it('ignores disabled regions', () => {
    const kept = computeKeptSegments(0, 120, 120, [
      { id: 'r1', startTime: 30, endTime: 45, enabled: false },
    ])
    expect(kept).toEqual([{ start: 0, end: 120 }])
  })

  it('respects trim boundaries', () => {
    const kept = computeKeptSegments(10, 100, 120, [
      { id: 'r1', startTime: 50, endTime: 60, enabled: true },
    ])
    expect(kept).toEqual([
      { start: 10, end: 50 },
      { start: 60, end: 100 },
    ])
  })

  it('handles region at track start', () => {
    const kept = computeKeptSegments(0, 120, 120, [
      { id: 'r1', startTime: 0, endTime: 20, enabled: true },
    ])
    expect(kept).toEqual([{ start: 20, end: 120 }])
  })

  it('handles region at track end', () => {
    const kept = computeKeptSegments(0, 120, 120, [
      { id: 'r1', startTime: 100, endTime: 120, enabled: true },
    ])
    expect(kept).toEqual([{ start: 0, end: 100 }])
  })

  it('returns empty when entire track is removed', () => {
    const kept = computeKeptSegments(0, 120, 120, [
      { id: 'r1', startTime: 0, endTime: 120, enabled: true },
    ])
    expect(kept).toEqual([])
  })
})

describe('buildFilterGraph with regions', () => {
  it('splits track into segments when regions are present', () => {
    const tracks: TrackInfo[] = [
      {
        index: 0,
        crossfadeDuration: 0,
        regions: [{ id: 'r1', startTime: 30, endTime: 45, enabled: true }],
        duration: 120,
      },
    ]
    const graph = buildFilterGraph(tracks, false)
    expect(graph).toContain('atrim=start=0:end=30')
    expect(graph).toContain('atrim=start=45:end=120')
    expect(graph).toContain('concat=n=2:v=0:a=1')
  })

  it('ignores disabled regions in filter graph', () => {
    const tracks: TrackInfo[] = [
      {
        index: 0,
        crossfadeDuration: 0,
        regions: [{ id: 'r1', startTime: 30, endTime: 45, enabled: false }],
        duration: 120,
      },
    ]
    const graph = buildFilterGraph(tracks, false)
    expect(graph).not.toContain('concat')
    expect(graph).not.toContain('seg0')
  })

  it('handles multiple regions creating 3 segments', () => {
    const tracks: TrackInfo[] = [
      {
        index: 0,
        crossfadeDuration: 0,
        regions: [
          { id: 'r1', startTime: 30, endTime: 45, enabled: true },
          { id: 'r2', startTime: 90, endTime: 100, enabled: true },
        ],
        duration: 120,
      },
    ]
    const graph = buildFilterGraph(tracks, false)
    expect(graph).toContain('concat=n=3:v=0:a=1')
  })

  it('applies shared chain (tempo, volume, loudnorm) after concat', () => {
    const tracks: TrackInfo[] = [
      {
        index: 0,
        loudnorm: mockLoudnorm,
        crossfadeDuration: 0,
        tempoAdjustment: 1.05,
        gainDb: -3,
        regions: [{ id: 'r1', startTime: 30, endTime: 45, enabled: true }],
        duration: 120,
      },
    ]
    const graph = buildFilterGraph(tracks, true)
    // After concat, should have tempo → volume → loudnorm
    expect(graph).toContain('atempo=1.05')
    expect(graph).toContain('volume=')
    expect(graph).toContain('loudnorm=')
  })

  it('combines regions with trim boundaries', () => {
    const tracks: TrackInfo[] = [
      {
        index: 0,
        crossfadeDuration: 0,
        trimStart: 10,
        trimEnd: 110,
        regions: [{ id: 'r1', startTime: 50, endTime: 60, enabled: true }],
        duration: 120,
      },
    ]
    const graph = buildFilterGraph(tracks, false)
    expect(graph).toContain('atrim=start=10:end=50')
    expect(graph).toContain('atrim=start=60:end=110')
  })
})

describe('buildRenderArgs', () => {
  it('builds WAV render args', () => {
    const args = buildRenderArgs(
      ['a.flac', 'b.mp3'],
      '[0:a]acopy[out]',
      '/out/mix.wav',
      'wav'
    )

    expect(args).toContain('-i')
    expect(args).toContain('a.flac')
    expect(args).toContain('b.mp3')
    expect(args).toContain('-filter_complex')
    expect(args).toContain('-map')
    expect(args).toContain('[out]')
    expect(args).toContain('pcm_s24le')
    expect(args).toContain('/out/mix.wav')
    expect(args).toContain('-y')
  })

  it('builds FLAC render args', () => {
    const args = buildRenderArgs(['a.wav'], 'graph', '/out/mix.flac', 'flac')
    expect(args).toContain('flac')
    expect(args).toContain('-compression_level')
    expect(args).toContain('8')
  })

  it('builds MP3 render args with custom bitrate', () => {
    const args = buildRenderArgs(['a.wav'], 'graph', '/out/mix.mp3', 'mp3', 192)
    expect(args).toContain('libmp3lame')
    expect(args).toContain('192k')
  })

  it('defaults MP3 bitrate to 320k', () => {
    const args = buildRenderArgs(['a.wav'], 'graph', '/out/mix.mp3', 'mp3')
    expect(args).toContain('320k')
  })

  it('includes all metadata flags when metadata is provided', () => {
    const args = buildRenderArgs(
      ['a.wav'],
      'graph',
      '/out/mix.flac',
      'flac',
      undefined,
      {
        title: 'My Mix',
        artist: 'DJ Test',
        album: 'Best Of',
        genre: 'Electronic',
        year: '2026',
        comment: 'A great mix',
      }
    )

    expect(args).toContain('-metadata')
    expect(args).toContain('title=My Mix')
    expect(args).toContain('artist=DJ Test')
    expect(args).toContain('album=Best Of')
    expect(args).toContain('genre=Electronic')
    expect(args).toContain('date=2026')
    expect(args).toContain('comment=A great mix')
  })

  it('includes only populated metadata fields', () => {
    const args = buildRenderArgs(
      ['a.wav'],
      'graph',
      '/out/mix.flac',
      'flac',
      undefined,
      {
        title: 'My Mix',
        artist: 'DJ Test',
      }
    )

    expect(args).toContain('title=My Mix')
    expect(args).toContain('artist=DJ Test')
    expect(args).not.toContain('album=')
    expect(args).not.toContain('genre=')
    expect(args).not.toContain('date=')
    expect(args).not.toContain('comment=')
  })

  it('omits metadata flags when metadata is undefined', () => {
    const args = buildRenderArgs(['a.wav'], 'graph', '/out/mix.flac', 'flac')
    const metadataIndices = args.reduce<number[]>(
      (acc, a, i) => (a === '-metadata' ? [...acc, i] : acc),
      []
    )
    expect(metadataIndices).toHaveLength(0)
  })
})
