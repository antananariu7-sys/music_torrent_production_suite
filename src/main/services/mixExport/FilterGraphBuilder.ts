import type {
  LoudnormAnalysis,
  MixExportMetadata,
} from '@shared/types/mixExport.types'
import type {
  AudioRegion,
  CrossfadeCurveType,
  TempoRegion,
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
  tempoRegion?: TempoRegion // region where tempo applies + ramp-back
  gainDb?: number // static gain offset in dB
  volumeEnvelope?: VolumePoint[] // volume automation breakpoints
  effectiveDuration?: number // duration after trim (needed for volume expression)
  regions?: AudioRegion[] // non-destructive edit regions (removed segments)
  duration?: number // full track duration in seconds
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

/** Number of discrete steps to approximate a tempo ramp in FFmpeg export */
const RAMP_STEPS = 8

/**
 * Build tempo filter segments for a track with a TempoRegion (constant zone + ramp-back).
 * Returns an array of filter graph lines and segment labels for concatenation.
 * The caller provides the source label of the already-trimmed/joined audio.
 *
 * Splits the audio into:
 * 1. Constant-speed portion (startTime → rampStart) at `rate`
 * 2. Ramp portion (rampStart → endTime) approximated by RAMP_STEPS discrete segments
 * 3. Tail portion (endTime → end of track) at rate 1.0 (no tempo change)
 */
export function buildTempoRegionFilters(
  sourceLabel: string,
  outputLabel: string,
  trackIndex: number,
  rate: number,
  tempoRegion: TempoRegion,
  useRubberband: boolean,
  effectiveDuration: number
): string[] {
  if (rate === 1) return []

  const filters: string[] = []
  const segLabels: string[] = []
  const rampStart = tempoRegion.endTime - tempoRegion.rampDuration

  // Segment 1: constant-speed portion (0 → rampStart)
  if (rampStart > 0) {
    const constLabel = `[tc${trackIndex}_const]`
    const tempoFilter = buildTempoFilter(rate, useRubberband)
    filters.push(
      `${sourceLabel}atrim=0:${rampStart},asetpts=PTS-STARTPTS,${tempoFilter}${constLabel}`
    )
    segLabels.push(constLabel)
  }

  // Segment 2: ramp portion — approximate with discrete steps
  if (tempoRegion.rampDuration > 0) {
    const stepDuration = tempoRegion.rampDuration / RAMP_STEPS
    for (let i = 0; i < RAMP_STEPS; i++) {
      const segStart = rampStart + i * stepDuration
      const segEnd = rampStart + (i + 1) * stepDuration
      // Linear interpolation: rate → 1.0
      const frac = (i + 0.5) / RAMP_STEPS
      const stepRate = rate + (1.0 - rate) * frac

      const label = `[tc${trackIndex}_r${i}]`
      const tempoFilter = buildTempoFilter(stepRate, useRubberband)
      filters.push(
        `${sourceLabel}atrim=${segStart}:${segEnd},asetpts=PTS-STARTPTS,${tempoFilter}${label}`
      )
      segLabels.push(label)
    }
  }

  // Segment 3: tail after tempo region (no tempo change)
  if (tempoRegion.endTime < effectiveDuration) {
    const tailLabel = `[tc${trackIndex}_tail]`
    filters.push(
      `${sourceLabel}atrim=${tempoRegion.endTime}:${effectiveDuration},asetpts=PTS-STARTPTS${tailLabel}`
    )
    segLabels.push(tailLabel)
  }

  // Concatenate all segments
  if (segLabels.length > 1) {
    filters.push(
      `${segLabels.join('')}concat=n=${segLabels.length}:v=0:a=1${outputLabel}`
    )
  } else if (segLabels.length === 1) {
    // Single segment — rename label
    const lastFilter = filters[filters.length - 1]
    filters[filters.length - 1] = lastFilter.replace(segLabels[0], outputLabel)
  }

  return filters
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
 * Compute the kept (non-removed) segments of a track given trim boundaries and
 * removed regions. Merges overlapping enabled regions, inverts to kept segments.
 */
export function computeKeptSegments(
  trimStart: number | undefined,
  trimEnd: number | undefined,
  duration: number,
  regions: AudioRegion[] | undefined
): Array<{ start: number; end: number }> {
  const effStart = trimStart ?? 0
  const effEnd = trimEnd ?? duration

  if (!regions || regions.length === 0) {
    return [{ start: effStart, end: effEnd }]
  }

  // Sort and merge overlapping enabled regions
  const enabled = regions
    .filter((r) => r.enabled)
    .sort((a, b) => a.startTime - b.startTime)

  const merged: Array<{ start: number; end: number }> = []
  for (const r of enabled) {
    const last = merged[merged.length - 1]
    if (last && r.startTime <= last.end) {
      last.end = Math.max(last.end, r.endTime)
    } else {
      merged.push({ start: r.startTime, end: r.endTime })
    }
  }

  // Invert: compute kept segments (gaps between removed regions)
  const kept: Array<{ start: number; end: number }> = []
  let cursor = effStart

  for (const region of merged) {
    const rStart = Math.max(region.start, effStart)
    const rEnd = Math.min(region.end, effEnd)
    if (rStart >= rEnd) continue

    if (cursor < rStart) {
      kept.push({ start: cursor, end: rStart })
    }
    cursor = Math.max(cursor, rEnd)
  }

  if (cursor < effEnd) {
    kept.push({ start: cursor, end: effEnd })
  }

  return kept
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

    // Check if this track has regions that need multi-segment handling
    const enabledRegions = track.regions?.filter((r) => r.enabled) ?? []
    const hasRegions = enabledRegions.length > 0 && track.duration != null

    if (hasRegions) {
      // ── Multi-segment: atrim per kept segment → concat → shared chain ──
      const keptSegments = computeKeptSegments(
        track.trimStart,
        track.trimEnd,
        track.duration!,
        track.regions
      )

      if (keptSegments.length === 0) {
        // All audio removed — skip track (use silent placeholder)
        filters.push(
          `${inputLabel}atrim=0:0.001,asetpts=PTS-STARTPTS${outputLabel}`
        )
        trackLabels.push(outputLabel)
        continue
      }

      // Create atrim + asetpts for each kept segment
      const segLabels: string[] = []
      for (let s = 0; s < keptSegments.length; s++) {
        const seg = keptSegments[s]
        const segLabel = `[seg${track.index}_${s}]`
        filters.push(
          `${inputLabel}atrim=start=${seg.start}:end=${seg.end},asetpts=PTS-STARTPTS${segLabel}`
        )
        segLabels.push(segLabel)
      }

      // Determine the source label for the shared chain
      let sourceLabel: string
      if (keptSegments.length > 1) {
        const joinedLabel = `[joined${track.index}]`
        filters.push(
          `${segLabels.join('')}concat=n=${keptSegments.length}:v=0:a=1${joinedLabel}`
        )
        sourceLabel = joinedLabel
      } else {
        sourceLabel = segLabels[0]
      }

      // Build shared chain: tempo → volume → loudnorm/acopy
      const sharedParts: string[] = []

      if (track.tempoAdjustment != null && track.tempoAdjustment !== 1) {
        const tempoFilter = buildTempoFilter(
          track.tempoAdjustment,
          useRubberband
        )
        if (tempoFilter) sharedParts.push(tempoFilter)
      }

      const volumeFilter = buildVolumeFilter(
        track.gainDb,
        track.volumeEnvelope,
        track.effectiveDuration
      )
      if (volumeFilter) sharedParts.push(volumeFilter)

      if (normalization && track.loudnorm) {
        const ln = track.loudnorm
        sharedParts.push(
          `loudnorm=I=-14:TP=-1:LRA=11` +
            `:measured_I=${ln.input_i}:measured_TP=${ln.input_tp}` +
            `:measured_LRA=${ln.input_lra}:measured_thresh=${ln.input_thresh}` +
            `:linear=true`
        )
      } else {
        sharedParts.push('acopy')
      }

      filters.push(`${sourceLabel}${sharedParts.join(',')}${outputLabel}`)
      trackLabels.push(outputLabel)
    } else {
      // ── Standard single-segment processing ──
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
        const tempoFilter = buildTempoFilter(
          track.tempoAdjustment,
          useRubberband
        )
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
