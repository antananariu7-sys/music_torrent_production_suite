import { BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type { QueuedTorrent, QueuedTorrentProgress, WebTorrentSettings } from '@shared/types/torrent.types'
import type { Torrent } from 'webtorrent'
import { mapTorrentFiles, mapCompletedFiles } from '../utils/torrentHelpers'
import { cleanupDeselectedFiles } from '../utils/fileCleanup'

export interface ProgressBroadcasterDeps {
  queue: Map<string, QueuedTorrent>
  activeTorrents: Map<string, Torrent>
  settings: WebTorrentSettings
  persistQueue(): void
  processQueue(): Promise<void>
}

/**
 * ProgressBroadcaster
 *
 * Handles real-time progress broadcasting to renderer windows (1s interval).
 * Also detects partial download completion for file-selected torrents.
 */
export class ProgressBroadcaster {
  private progressInterval: ReturnType<typeof setInterval> | null = null
  private deps: ProgressBroadcasterDeps

  constructor(deps: ProgressBroadcasterDeps) {
    this.deps = deps
  }

  /**
   * Start periodic progress broadcast to all renderer windows (every 1 second).
   */
  start(): void {
    if (this.progressInterval) return

    this.progressInterval = setInterval(() => {
      const updates: QueuedTorrentProgress[] = []

      for (const [, qt] of this.deps.queue) {
        if (qt.status !== 'downloading' && qt.status !== 'seeding') continue

        // Use the activeTorrents map for reliable lookup (no infoHash matching needed)
        const torrent = this.deps.activeTorrents.get(qt.id)
        if (!torrent) continue

        const selectedSet = qt.selectedFileIndices ? new Set(qt.selectedFileIndices) : undefined

        // Update queue entry with live data
        qt.downloadSpeed = torrent.downloadSpeed
        qt.uploadSpeed = torrent.uploadSpeed
        qt.uploaded = torrent.uploaded
        qt.seeders = torrent.numPeers
        qt.files = mapTorrentFiles(torrent, selectedSet)

        // Calculate progress/size based on selected files only
        if (selectedSet && selectedSet.size < torrent.files.length) {
          let selectedSize = 0
          let selectedDownloaded = 0
          torrent.files.forEach((f, index) => {
            if (selectedSet.has(index)) {
              selectedSize += f.length
              selectedDownloaded += Math.max(0, f.downloaded)
            }
          })
          qt.totalSize = selectedSize
          qt.downloaded = selectedDownloaded
          qt.progress = selectedSize > 0 ? Math.round((selectedDownloaded / selectedSize) * 100) : 0

          // All selected files complete — trigger manual completion
          // Always destroy for partial selection (seeding partial content is not meaningful)
          if (qt.progress >= 100) {
            qt.status = 'completed'
            qt.progress = 100
            qt.completedAt = new Date().toISOString()
            qt.downloadSpeed = 0
            qt.uploadSpeed = 0
            qt.files = mapCompletedFiles(torrent, selectedSet!)
            this.deps.activeTorrents.delete(qt.id)
            torrent.destroy()
            this.deps.persistQueue()
            this.broadcastStatusChange(qt)

            console.log(`[WebTorrentService] Selected files complete: ${qt.name}`)
            cleanupDeselectedFiles(qt)
            this.deps.processQueue()
            continue
          }
        } else {
          qt.progress = Math.round(torrent.progress * 100)
          qt.downloaded = torrent.downloaded
          qt.totalSize = torrent.length
        }
        qt.ratio = qt.downloaded > 0 ? qt.uploaded / qt.downloaded : 0

        updates.push({
          id: qt.id,
          status: qt.status,
          progress: qt.progress,
          downloadSpeed: qt.downloadSpeed,
          uploadSpeed: qt.uploadSpeed,
          downloaded: qt.downloaded,
          uploaded: qt.uploaded,
          totalSize: qt.totalSize,
          seeders: qt.seeders,
          leechers: qt.leechers,
          ratio: qt.ratio,
          files: qt.files,
        })
      }

      if (updates.length > 0) {
        this.sendToAllWindows(IPC_CHANNELS.WEBTORRENT_PROGRESS, updates)
      }
    }, 1000)
  }

  /**
   * Stop the progress broadcast interval.
   */
  stop(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval)
      this.progressInterval = null
    }
  }

  /**
   * Broadcast a single torrent status change to all windows.
   */
  broadcastStatusChange(qt: QueuedTorrent): void {
    this.sendToAllWindows(IPC_CHANNELS.WEBTORRENT_STATUS_CHANGE, qt)
  }

  /**
   * Broadcast event to renderer that a torrent needs file selection.
   */
  broadcastFileSelectionNeeded(qt: QueuedTorrent): void {
    this.sendToAllWindows(IPC_CHANNELS.WEBTORRENT_FILE_SELECTION_NEEDED, {
      id: qt.id,
      name: qt.name,
      files: qt.files,
    })
  }

  /**
   * Send a message to all open BrowserWindow instances.
   */
  private sendToAllWindows(channel: string, data: unknown): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, data)
      }
    }
  }
}
