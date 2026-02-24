/**
 * Parse FFmpeg version string from command output.
 *
 * @param output - stdout from `ffmpeg -version`
 * @returns Parsed version string, or null if not found
 */
export function parseFfmpegVersion(output: string): string | null {
  if (!output) return null

  const firstLine = output.split('\n')[0] ?? ''
  const versionMatch = firstLine.match(/ffmpeg version (\S+)/)

  return versionMatch ? versionMatch[1] : null
}
