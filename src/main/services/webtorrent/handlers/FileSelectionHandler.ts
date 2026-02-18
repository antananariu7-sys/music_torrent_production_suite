import path from 'path'
import { statSync } from 'fs'
import type { QueuedTorrent } from '@shared/types/torrent.types'
import type { Torrent } from 'webtorrent'
import { mapTorrentFiles } from '../utils/torrentHelpers'

export interface FileSelectionDeps {
  queue: Map<string, QueuedTorrent>
  activeTorrents: Map<string, Torrent>
  torrentsAwaitingSelection: Set<string>
  persistQueue(): void
  broadcastStatusChange(qt: QueuedTorrent): void
  processQueue(): Promise<void>
}

/**
 * FileSelectionHandler
 *
 * Handles file selection for partial downloads and downloading additional files.
 */
export class FileSelectionHandler {
  private deps: FileSelectionDeps

  constructor(deps: FileSelectionDeps) {
    this.deps = deps
  }

  /**
   * Apply file selection and start downloading selected files only.
   * Skips files that already exist and have matching size.
   */
  selectFiles(id: string, selectedFileIndices: number[]): { success: boolean; error?: string } {
    const qt = this.deps.queue.get(id)
    if (!qt) return { success: false, error: 'Torrent not found' }

    if (qt.status !== 'awaiting-file-selection') {
      return { success: false, error: 'Torrent is not awaiting file selection' }
    }

    const torrent = this.deps.activeTorrents.get(id)
    if (!torrent) {
      return { success: false, error: 'Active torrent instance not found' }
    }

    if (!qt.downloadPath) {
      return { success: false, error: 'Download path not set' }
    }

    // Check which files already exist with correct size
    const filesToDownload: number[] = []
    const skippedFiles: string[] = []

    for (const index of selectedFileIndices) {
      if (index < 0 || index >= torrent.files.length) continue

      const file = torrent.files[index]
      const fullPath = path.join(qt.downloadPath, file.path)

      try {
        const stats = statSync(fullPath)
        // File exists - check if size matches (indicating it's complete)
        if (stats.size === file.length) {
          skippedFiles.push(file.name)
          console.log(`[WebTorrentService] Skipping existing file: ${file.name} (${stats.size} bytes)`)
          continue
        } else {
          console.log(`[WebTorrentService] File exists but size mismatch (${stats.size} vs ${file.length}), will re-download: ${file.name}`)
          filesToDownload.push(index)
        }
      } catch (err) {
        // File doesn't exist or can't be accessed - download it
        filesToDownload.push(index)
      }
    }

    // If all files already exist, mark as completed
    if (filesToDownload.length === 0 && selectedFileIndices.length > 0) {
      console.log(`[WebTorrentService] All selected files already exist, marking as completed`)
      qt.status = 'completed'
      qt.progress = 100
      this.deps.torrentsAwaitingSelection.delete(id)
      this.deps.persistQueue()
      this.deps.broadcastStatusChange(qt)
      return { success: true }
    }

    // Create a Set for O(1) lookup
    const selectedSet = new Set(selectedFileIndices)

    // Deselect all files first
    torrent.files.forEach(file => file.deselect())

    // Select only files that need to be downloaded
    filesToDownload.forEach(index => {
      torrent.files[index].select()
    })

    // Update our tracking with correct selection state
    qt.selectedFileIndices = selectedFileIndices
    qt.files = mapTorrentFiles(torrent, selectedSet)
    qt.status = 'downloading'
    this.deps.torrentsAwaitingSelection.delete(id)

    this.deps.persistQueue()
    this.deps.broadcastStatusChange(qt)

    const message = skippedFiles.length > 0
      ? `File selection applied: ${filesToDownload.length}/${torrent.files.length} files to download (${skippedFiles.length} already exist)`
      : `File selection applied: ${filesToDownload.length}/${torrent.files.length} files selected for download`

    console.log(`[WebTorrentService] ${message}`)
    return { success: true }
  }

  /**
   * Download additional files for a torrent that already has a partial selection.
   * Works for both active (still downloading) and completed (destroyed) torrents.
   */
  async downloadMoreFiles(id: string, additionalFileIndices: number[]): Promise<{ success: boolean; error?: string }> {
    const qt = this.deps.queue.get(id)
    if (!qt) return { success: false, error: 'Torrent not found' }

    if (!additionalFileIndices.length) return { success: false, error: 'No files specified' }

    // Merge new indices with existing selection
    const existingIndices = new Set(qt.selectedFileIndices || [])
    additionalFileIndices.forEach(i => existingIndices.add(i))
    qt.selectedFileIndices = Array.from(existingIndices).sort((a, b) => a - b)

    const torrent = this.deps.activeTorrents.get(id)

    if (torrent) {
      // Torrent is still active — just select the additional files
      additionalFileIndices.forEach(index => {
        if (index >= 0 && index < torrent.files.length) {
          torrent.files[index].select()
        }
      })

      const selectedSet = new Set(qt.selectedFileIndices)
      qt.files = mapTorrentFiles(torrent, selectedSet)
      qt.status = 'downloading'
      qt.completedAt = undefined
      this.deps.persistQueue()
      this.deps.broadcastStatusChange(qt)

      console.log(`[WebTorrentService] Added ${additionalFileIndices.length} files to active torrent: ${qt.name}`)
      return { success: true }
    }

    // Torrent was destroyed (completed) — restart it
    if (qt.status === 'completed' || qt.status === 'error' || qt.status === 'paused') {
      qt.status = 'queued'
      qt.progress = 0
      qt.completedAt = undefined
      qt.downloadSpeed = 0
      qt.uploadSpeed = 0
      this.deps.persistQueue()
      this.deps.broadcastStatusChange(qt)

      console.log(`[WebTorrentService] Re-queuing torrent with ${additionalFileIndices.length} additional files: ${qt.name}`)
      await this.deps.processQueue()
      return { success: true }
    }

    return { success: false, error: `Cannot add files while torrent is ${qt.status}` }
  }
}
