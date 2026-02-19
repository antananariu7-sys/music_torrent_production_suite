import type { LoudnormAnalysis } from '@shared/types/mixExport.types'

export interface TrackInfo {
  index: number
  loudnorm?: LoudnormAnalysis
  crossfadeDuration: number  // seconds into next track (0 for last track)
}

/**
 * Build an FFmpeg complex filter graph for mixing tracks with loudness normalization
 * and crossfades.
 *
 * @param tracks - Ordered track info with loudnorm params and crossfade durations
 * @param normalization - Whether to apply EBU R128 loudness normalization
 * @returns The -filter_complex string value
 */
export function buildFilterGraph(tracks: TrackInfo[], normalization: boolean): string {
  if (tracks.length === 0) {
    throw new Error('Cannot build filter graph with zero tracks')
  }

  const filters: string[] = []

  // Step 1: Per-track processing (loudnorm or passthrough)
  const trackLabels: string[] = []

  for (const track of tracks) {
    const inputLabel = `[${track.index}:a]`
    const outputLabel = `[a${track.index}]`

    if (normalization && track.loudnorm) {
      const ln = track.loudnorm
      filters.push(
        `${inputLabel}loudnorm=I=-14:TP=-1:LRA=11` +
        `:measured_I=${ln.input_i}:measured_TP=${ln.input_tp}` +
        `:measured_LRA=${ln.input_lra}:measured_thresh=${ln.input_thresh}` +
        `:linear=true${outputLabel}`
      )
    } else {
      // Passthrough — just relabel
      filters.push(`${inputLabel}acopy${outputLabel}`)
    }

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
        `${currentLabel}${nextLabel}acrossfade=d=${crossfade}:c1=tri:c2=tri${outputLabel}`
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

  // Overwrite output
  args.push('-y', outputPath)

  return args
}
