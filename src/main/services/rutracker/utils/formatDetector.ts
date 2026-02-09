import type { FileFormat } from '@shared/types/search.types'

/**
 * Detect file format from torrent title
 *
 * @param title - Torrent title
 * @returns Detected file format or undefined
 */
export function detectFileFormat(title: string): FileFormat | undefined {
  const titleLower = title.toLowerCase()

  if (titleLower.includes('flac')) return 'flac'
  if (titleLower.includes('mp3')) return 'mp3'
  if (titleLower.includes('wav')) return 'wav'
  if (titleLower.includes('aac')) return 'aac'
  if (titleLower.includes('ogg')) return 'ogg'
  if (titleLower.includes('alac') || titleLower.includes('apple lossless')) return 'alac'
  if (titleLower.includes('ape') || titleLower.includes('monkey')) return 'ape'

  return undefined
}
