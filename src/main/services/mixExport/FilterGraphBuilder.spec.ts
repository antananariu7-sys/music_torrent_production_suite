import { buildFilterGraph, buildRenderArgs, type TrackInfo } from './FilterGraphBuilder'
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

    expect(graph).toContain('[0:a]atrim=start=30,asetpts=PTS-STARTPTS,loudnorm=')
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
      { index: 0, loudnorm: mockLoudnorm, crossfadeDuration: 5, trimStart: 30, trimEnd: 420 },
      { index: 1, loudnorm: mockLoudnorm, crossfadeDuration: 0 },
    ]

    const graph = buildFilterGraph(tracks, true)

    expect(graph).toContain('[0:a]atrim=start=30:end=420,asetpts=PTS-STARTPTS,loudnorm=')
  })

  it('inserts atrim before acopy when normalization is off', () => {
    const tracks: TrackInfo[] = [
      { index: 0, crossfadeDuration: 0, trimStart: 10, trimEnd: 200 },
    ]

    const graph = buildFilterGraph(tracks, false)

    expect(graph).toContain('[0:a]atrim=start=10:end=200,asetpts=PTS-STARTPTS,acopy[out]')
  })

  it('handles trim on some tracks but not others', () => {
    const tracks: TrackInfo[] = [
      { index: 0, loudnorm: mockLoudnorm, crossfadeDuration: 5, trimStart: 15 },
      { index: 1, loudnorm: mockLoudnorm, crossfadeDuration: 3 },
      { index: 2, loudnorm: mockLoudnorm, crossfadeDuration: 0, trimEnd: 300 },
    ]

    const graph = buildFilterGraph(tracks, true)

    expect(graph).toContain('[0:a]atrim=start=15,asetpts=PTS-STARTPTS,loudnorm=')
    expect(graph).toContain('[1:a]loudnorm=')
    expect(graph).toContain('[2:a]atrim=end=300,asetpts=PTS-STARTPTS,loudnorm=')
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
})

describe('buildRenderArgs', () => {
  it('builds WAV render args', () => {
    const args = buildRenderArgs(
      ['a.flac', 'b.mp3'],
      '[0:a]acopy[out]',
      '/out/mix.wav',
      'wav',
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
    const args = buildRenderArgs(['a.wav'], 'graph', '/out/mix.flac', 'flac', undefined, {
      title: 'My Mix',
      artist: 'DJ Test',
      album: 'Best Of',
      genre: 'Electronic',
      year: '2026',
      comment: 'A great mix',
    })

    expect(args).toContain('-metadata')
    expect(args).toContain('title=My Mix')
    expect(args).toContain('artist=DJ Test')
    expect(args).toContain('album=Best Of')
    expect(args).toContain('genre=Electronic')
    expect(args).toContain('date=2026')
    expect(args).toContain('comment=A great mix')
  })

  it('includes only populated metadata fields', () => {
    const args = buildRenderArgs(['a.wav'], 'graph', '/out/mix.flac', 'flac', undefined, {
      title: 'My Mix',
      artist: 'DJ Test',
    })

    expect(args).toContain('title=My Mix')
    expect(args).toContain('artist=DJ Test')
    expect(args).not.toContain('album=')
    expect(args).not.toContain('genre=')
    expect(args).not.toContain('date=')
    expect(args).not.toContain('comment=')
  })

  it('omits metadata flags when metadata is undefined', () => {
    const args = buildRenderArgs(['a.wav'], 'graph', '/out/mix.flac', 'flac')
    const metadataIndices = args.reduce<number[]>((acc, a, i) => a === '-metadata' ? [...acc, i] : acc, [])
    expect(metadataIndices).toHaveLength(0)
  })
})
