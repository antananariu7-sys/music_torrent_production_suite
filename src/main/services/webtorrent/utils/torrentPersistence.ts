import { readFileSync, writeFileSync, existsSync } from 'fs'
import type { QueuedTorrent } from '@shared/types/torrent.types'

/**
 * Persist queue state to disk for app restart recovery.
 */
export function persistQueue(queue: Map<string, QueuedTorrent>, persistPath: string): void {
  try {
    const serializable = [...queue.values()].map(qt => ({
      ...qt,
      // Reset transient speed values
      downloadSpeed: 0,
      uploadSpeed: 0,
    }))
    writeFileSync(persistPath, JSON.stringify(serializable, null, 2))
  } catch (err) {
    console.error('[WebTorrentService] Failed to persist queue:', err)
  }
}

/**
 * Load persisted queue from disk on startup.
 * Restores in-progress and awaiting entries as 'queued' so they restart.
 */
export function loadPersistedQueue(persistPath: string): QueuedTorrent[] {
  try {
    if (!existsSync(persistPath)) return []

    const data = JSON.parse(readFileSync(persistPath, 'utf-8')) as QueuedTorrent[]

    for (const qt of data) {
      // Restore in-progress entries as 'queued' so they restart
      if (qt.status === 'downloading' || qt.status === 'seeding') {
        qt.status = 'queued'
        qt.downloadSpeed = 0
        qt.uploadSpeed = 0
      }
      // Reset awaiting-file-selection to queued on restart
      if (qt.status === 'awaiting-file-selection') {
        qt.status = 'queued'
      }
    }

    console.log(`[WebTorrentService] Restored ${data.length} torrents from persisted queue`)
    return data
  } catch (err) {
    console.error('[WebTorrentService] Failed to load persisted queue:', err)
    return []
  }
}
