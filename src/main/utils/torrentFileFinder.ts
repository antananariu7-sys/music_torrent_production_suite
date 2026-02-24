import path from 'path'

/**
 * Find a local .torrent file for a given torrent ID.
 * Checks two naming conventions:
 *   - Legacy: `{torrentId}.torrent`
 *   - Human-readable suffix: `*[{torrentId}].torrent`
 *
 * Prefers suffix format when both exist.
 *
 * @param dir - Directory to search in
 * @param torrentId - The torrent ID to look for
 * @param files - List of filenames in the directory
 * @returns Full path if found, null otherwise
 */
export function findLocalTorrentFile(
  dir: string,
  torrentId: string,
  files: string[]
): string | null {
  // Check suffix format first (preferred): *[{torrentId}].torrent
  const suffix = `[${torrentId}].torrent`
  const suffixMatch = files.find((f) => f.endsWith(suffix))
  if (suffixMatch) {
    return path.join(dir, suffixMatch)
  }

  // Fallback to legacy format: {torrentId}.torrent
  const legacyName = `${torrentId}.torrent`
  if (files.includes(legacyName)) {
    return path.join(dir, legacyName)
  }

  return null
}
