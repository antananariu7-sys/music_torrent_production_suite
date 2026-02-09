/**
 * Check if a file is an audio file based on extension
 */
export function isAudioFile(filePath: string): boolean {
  const audioExtensions = [
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
  ]

  const ext = filePath.toLowerCase().slice(filePath.lastIndexOf('.'))
  return audioExtensions.includes(ext)
}

/**
 * Extract filename from path
 */
export function getFileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath
}
