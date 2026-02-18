import { existsSync, readFileSync } from 'fs'
import type { Torrent } from 'webtorrent'
import type { TorrentContentFile } from '@shared/types/torrent.types'

/**
 * Map WebTorrent files to our TorrentContentFile type.
 */
export function mapTorrentFiles(torrent: Torrent, selectedIndices?: Set<number>): TorrentContentFile[] {
  return torrent.files.map((f, index) => {
    const downloaded = Math.max(0, f.downloaded)
    return {
      path: f.path,
      name: f.name,
      size: f.length,
      downloaded,
      progress: f.length > 0 ? Math.round((downloaded / f.length) * 100) : 0,
      selected: selectedIndices ? selectedIndices.has(index) : true,
    }
  })
}

/**
 * Parse a .torrent file and return its file list without starting a download.
 * Uses dynamic import for parse-torrent (ESM package).
 */
export async function parseTorrentFiles(torrentFilePath: string): Promise<TorrentContentFile[]> {
  if (!existsSync(torrentFilePath)) {
    throw new Error(`Torrent file not found: ${torrentFilePath}`)
  }

  const buffer = readFileSync(torrentFilePath)
  const parseTorrentModule = await import('parse-torrent')
  const parseTorrent = parseTorrentModule.default || parseTorrentModule
  const parsed = await parseTorrent(buffer)

  console.log(`[parseTorrentFiles] Parsed: name=${parsed.name}, files=${parsed.files?.length}`)

  const files = parsed.files
  if (!files || files.length === 0) {
    throw new Error(`No files found in .torrent (name: ${parsed.name})`)
  }

  return files.map((f, index) => ({
    path: f.path || '',
    name: f.name || f.path?.split(/[\\/]/).pop() || `file_${index}`,
    size: f.length || 0,
    downloaded: 0,
    progress: 0,
    selected: true,
  }))
}
