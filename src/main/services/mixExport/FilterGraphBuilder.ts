import type {
  LoudnormAnalysis,
  MixExportMetadata,
} from '@shared/types/mixExport.types'
import type {
  CrossfadeCurveType,
  VolumePoint,
} from '@shared/types/project.types'

export interface TrackInfo {
  index: number
  loudnorm?: LoudnormAnalysis
  crossfadeDuration: number // seconds into next track (0 for last track)
  crossfadeCurveType?: CrossfadeCurveType // curve shape for acrossfade
  trimStart?: number // seconds — trim beginning of track
  trimEnd?: number // seconds — trim end of track
  tempoAdjustment?: number // playback rate multiplier (e.g. 1.015 = +1.5%)
  gainDb?: number // static gain offset in dB
  volumeEnvelope?: VolumePoint[] // volume automation breakpoints
  effectiveDuration?: number // duration after trim (needed for volume expression)
}

/** Map CrossfadeCurveType to FFmpeg acrossfade curve parameters */
function getCurveParam(type: CrossfadeCurveType = 'linear'): string {
  switch (type) {
    case 'linear':
      return 'c1=tri:c2=tri'
    case 'equal-power':
      return 'c1=qsin:c2=qsin'
    case 's-curve':
      return 'c1=hsin:c2=hsin'
  }
}

/**
 * Build an atempo filter chain for a given rate.
 * FFmpeg atempo accepts 0.5–100.0 per instance but practical range is 0.5–2.0.
 * For rates outside 0.5–2.0, chain multiple atempo filters.
 */
export function buildAtempoChain(rate: number): string {
  if (rate === 1) return ''

  const parts: string[] = []
  let remaining = rate

  // Chain atempo filters to keep each within 0.5–2.0 range
  while (remaining < 0.5 || remaining > 2.0) {
    if (remaining < 0.5) {
      parts.push('atempo=0.5')
      remaining /= 0.5
    } else {
      parts.push('atempo=2.0')
      remaining /= 2.0
    }
  }

  parts.push(`atempo=${remaining}`)
  return parts.join(',')
}

/**
 * Build the tempo adjustment filter for a track.
 * Uses rubberband (pitch-preserving) when available, falls back to atempo.
 */
export function buildTempoFilter(rate: number, useRubberband: boolean): string {
  if (rate === 1) return ''

  if (useRubberband) {
    return `rubberband=tempo=${rate}`
  }

  return buildAtempoChain(rate)
}

/** Convert decibels to linear gain (FFmpeg-safe). */
function ffmpegDbToLinear(db: number): number {
  return Math.pow(10, db / 20)
}

/**
 * Build an FFmpeg volume filter for static gain and/or volume envelope.
 *
 * - Static gain only: `volume=<linear>`
 * - Envelope only: `volume='if(lt(t,T1),V0+(V1-V0)*(t-T0)/(T1-T0), ...)'`
 * - Both: envelope values are pre-multiplied by static gain
 *
 * @returns The filter string, or empty string if no volume adjustment needed.
 */
export function buildVolumeFilter(
  gainDb: number | undefined,
  envelope: VolumePoint[] | undefined,
  _effectiveDuration?: number | undefined
): string {
  const hasGain = gainDb != null && gainDb !== 0
  const hasEnvelope = envelope != null && envelope.length >= 2

  if (!hasGain && !hasEnvelope) return ''

  const gainMultiplier = hasGain ? ffmpegDbToLinear(gainDb) : 1

  // Static gain only — simple volume filter
  if (!hasEnvelope) {
    return `volume=${gainMultiplier.toFixed(6)}`
  }

  // Envelope: build piecewise linear expression
  const sorted = [...envelope].sort((a, b) => a.time - b.time)

  // Apply gain multiplier to envelope values
  const points = sorted.map((p) => ({
    time: p.time,
    value: Math.max(0, Math.min(1, p.value)) * gainMultiplier,
  }))

  // Build nested if() expression for piecewise linear interpolation
  // Each segment: v0 + (v1 - v0) * (t - t0) / (t1 - t0)
  const segments: string[] = []

  // Before first point: hold first value
  if (points[0].time > 0) {
    segments.push(`if(lt(t,${points[0].time}),${points[0].value.toFixed(6)}`)
  }

  // Interpolation segments
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i]
    const p1 = points[i + 1]
    const dt = p1.time - p0.time
    const isLast = i === points.length - 2

    if (dt <= 0) continue

    const slope = ((p1.value - p0.value) / dt).toFixed(6)
    const expr = `${p0.value.toFixed(6)}+${slope}*(t-${p0.time})`

    if (isLast) {
      // Last segment also covers "after last point" (holds last value via clamp)
      segments.push(`if(lt(t,${p1.time}),${expr},${p1.value.toFixed(6)})`)
    } else {
      segments.push(`if(lt(t,${p1.time}),${expr}`)
    }
  }

  // Close all nested if()s
  const nestedIfs = segments.join(',')
  const closingParens = ')'.repeat(
    segments.filter((s) => s.startsWith('if(')).length - 1
  )

  const expr = nestedIfs + closingParens
  return `volume='${expr}'`
}

/**
 * Build an FFmpeg complex filter graph for mixing tracks with loudness normalization
 * and crossfades.
 *
 * @param tracks - Ordered track info with loudnorm params and crossfade durations
 * @param normalization - Whether to apply EBU R128 loudness normalization
 * @param useRubberband - Whether FFmpeg has rubberband filter available
 * @returns The -filter_complex string value
 */
export function buildFilterGraph(
  tracks: TrackInfo[],
  normalization: boolean,
  useRubberband = false
): string {
  if (tracks.length === 0) {
    throw new Error('Cannot build filter graph with zero tracks')
  }

  const filters: string[] = []

  // Step 1: Per-track processing (loudnorm or passthrough)
  const trackLabels: string[] = []

  for (const track of tracks) {
    const inputLabel = `[${track.index}:a]`
    const outputLabel = `[a${track.index}]`

    // Build per-track filter chain: atrim (optional) → loudnorm or acopy
    const chainParts: string[] = []

    // Trim filter (before normalization)
    if (track.trimStart != null || track.trimEnd != null) {
      let atrim = 'atrim='
      const parts: string[] = []
      if (track.trimStart != null) parts.push(`start=${track.trimStart}`)
      if (track.trimEnd != null) parts.push(`end=${track.trimEnd}`)
      atrim += parts.join(':')
      chainParts.push(atrim, 'asetpts=PTS-STARTPTS')
    }

    // Tempo adjustment (after trim, before normalization)
    if (track.tempoAdjustment != null && track.tempoAdjustment !== 1) {
      const tempoFilter = buildTempoFilter(track.tempoAdjustment, useRubberband)
      if (tempoFilter) chainParts.push(tempoFilter)
    }

    // Volume adjustment (after tempo, before normalization)
    const volumeFilter = buildVolumeFilter(
      track.gainDb,
      track.volumeEnvelope,
      track.effectiveDuration
    )
    if (volumeFilter) chainParts.push(volumeFilter)

    // Normalization or passthrough
    if (normalization && track.loudnorm) {
      const ln = track.loudnorm
      chainParts.push(
        `loudnorm=I=-14:TP=-1:LRA=11` +
          `:measured_I=${ln.input_i}:measured_TP=${ln.input_tp}` +
          `:measured_LRA=${ln.input_lra}:measured_thresh=${ln.input_thresh}` +
          `:linear=true`
      )
    } else {
      chainParts.push('acopy')
    }

    filters.push(`${inputLabel}${chainParts.join(',')}${outputLabel}`)
    trackLabels.push(outputLabel)
  }

  // Step 2: Single track — no crossfade needed
  if (tracks.length === 1) {
    // Rename the single output to [out]
    const lastFilter = filters[filters.length - 1]
    filters[filters.length - 1] = lastFilter.replace(trackLabels[0], '[out]')
    return filters.join(';\n')
  }

  // Step 3: Chain crossfades between consecutive pairs
  let currentLabel = trackLabels[0]

  for (let i = 0; i < tracks.length - 1; i++) {
    const nextLabel = trackLabels[i + 1]
    const crossfade = tracks[i].crossfadeDuration
    const isLast = i === tracks.length - 2
    const outputLabel = isLast ? '[out]' : `[f${i}]`

    if (crossfade > 0) {
      filters.push(
        `${currentLabel}${nextLabel}acrossfade=d=${crossfade}:${getCurveParam(tracks[i].crossfadeCurveType)}${outputLabel}`
      )
    } else {
      // Zero crossfade — concatenate without overlap
      filters.push(
        `${currentLabel}${nextLabel}concat=n=2:v=0:a=1${outputLabel}`
      )
    }

    currentLabel = outputLabel
  }

  return filters.join(';\n')
}

/**
 * Build the full FFmpeg args for the render pass.
 */
export function buildRenderArgs(
  inputFiles: string[],
  filterGraph: string,
  outputPath: string,
  format: 'wav' | 'flac' | 'mp3',
  mp3Bitrate?: number,
  metadata?: MixExportMetadata
): string[] {
  const args: string[] = []

  // Input files
  for (const file of inputFiles) {
    args.push('-i', file)
  }

  // Filter graph
  args.push('-filter_complex', filterGraph)

  // Map the output
  args.push('-map', '[out]')

  // Encoding
  switch (format) {
    case 'wav':
      args.push('-c:a', 'pcm_s24le')
      break
    case 'flac':
      args.push('-c:a', 'flac', '-compression_level', '8')
      break
    case 'mp3':
      args.push('-c:a', 'libmp3lame', '-b:a', `${mp3Bitrate ?? 320}k`)
      break
  }

  // Embed metadata
  if (metadata) {
    if (metadata.title) args.push('-metadata', `title=${metadata.title}`)
    if (metadata.artist) args.push('-metadata', `artist=${metadata.artist}`)
    if (metadata.album) args.push('-metadata', `album=${metadata.album}`)
    if (metadata.genre) args.push('-metadata', `genre=${metadata.genre}`)
    if (metadata.year) args.push('-metadata', `date=${metadata.year}`)
    if (metadata.comment) args.push('-metadata', `comment=${metadata.comment}`)
  }

  // Overwrite output
  args.push('-y', outputPath)

  return args
}
