import path from 'path'

const AUDIO_EXTENSIONS = new Set([
  '.mp3',
  '.flac',
  '.wav',
  '.m4a',
  '.aac',
  '.ogg',
  '.opus',
  '.wma',
  '.aiff',
  '.ape',
  '.alac',
])

/**
 * Find new audio files in a folder that are not already in the known song paths.
 * Compares using normalized paths (forward slashes, lowercase).
 *
 * @param folderFiles - File names present in the audio folder
 * @param knownSongPaths - Full paths of songs already in the project
 * @param audioDir - The audio directory path (used to construct full paths)
 * @returns Array of new audio file names
 */
export function findNewAudioFiles(
  folderFiles: string[],
  knownSongPaths: string[],
  audioDir: string
): string[] {
  const existingPaths = new Set(
    knownSongPaths
      .filter(Boolean)
      .map((p) => p.toLowerCase().replace(/\\/g, '/'))
  )

  return folderFiles.filter((f) => {
    const ext = path.extname(f).toLowerCase()
    if (!AUDIO_EXTENSIONS.has(ext)) return false

    const fullPath = path.join(audioDir, f).replace(/\\/g, '/')
    return !existingPaths.has(fullPath.toLowerCase())
  })
}
