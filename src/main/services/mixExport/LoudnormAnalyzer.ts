import { runFfmpeg } from '../../utils/ffmpegRunner'
import type { LoudnormAnalysis } from '@shared/types/mixExport.types'

/**
 * Run FFmpeg loudnorm first-pass analysis on a single audio file.
 * Returns measured loudness parameters for the second-pass normalization.
 */
export async function analyzeLoudness(filePath: string): Promise<LoudnormAnalysis> {
  const result = await runFfmpeg([
    '-i', filePath,
    '-af', 'loudnorm=I=-14:TP=-1:LRA=11:print_format=json',
    '-f', 'null',
    '-',
  ])

  return parseLoudnormOutput(result.stderr)
}

/**
 * Parse the JSON output block from FFmpeg loudnorm filter stderr.
 * FFmpeg outputs the JSON block in the last ~12 lines of stderr.
 */
export function parseLoudnormOutput(stderr: string): LoudnormAnalysis {
  // Find the JSON block — starts with { and ends with }
  const jsonStart = stderr.lastIndexOf('{')
  const jsonEnd = stderr.lastIndexOf('}')

  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
    throw new Error('Failed to parse loudnorm output: no JSON block found')
  }

  const jsonStr = stderr.slice(jsonStart, jsonEnd + 1)

  try {
    const data = JSON.parse(jsonStr)
    return {
      input_i: parseFloat(data.input_i),
      input_tp: parseFloat(data.input_tp),
      input_lra: parseFloat(data.input_lra),
      input_thresh: parseFloat(data.input_thresh),
    }
  } catch {
    throw new Error(`Failed to parse loudnorm JSON: ${jsonStr.slice(0, 200)}`)
  }
}
