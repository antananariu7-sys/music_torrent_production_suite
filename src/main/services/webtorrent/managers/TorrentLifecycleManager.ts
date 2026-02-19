import path from 'path'
import { readFileSync, existsSync, mkdirSync, statSync } from 'fs'
import type {
  QueuedTorrent,
  WebTorrentSettings,
} from '@shared/types/torrent.types'
import type WebTorrentClient from 'webtorrent'
import type { Torrent } from 'webtorrent'

import { mapCompletedFiles, mapTorrentFiles } from '../utils/torrentHelpers'
import { cleanupDeselectedFiles, clearPreCreatedDirs } from '../utils/fileCleanup'
import type { ProgressBroadcaster } from './ProgressBroadcaster'

export interface TorrentLifecycleDeps {
  queue: Map<string, QueuedTorrent>
  activeTorrents: Map<string, Torrent>
  torrentsAwaitingSelection: Set<string>
  settings: WebTorrentSettings
  broadcaster: ProgressBroadcaster
  persistQueue(): void
}

/**
 * TorrentLifecycleManager
 *
 * Manages the WebTorrent client, torrent startup, metadata/done event
 * handling, and FIFO queue processing with concurrency control.
 */
export class TorrentLifecycleManager {
  private client: WebTorrentClient | null = null
  private deps: TorrentLifecycleDeps

  constructor(deps: TorrentLifecycleDeps) {
    this.deps = deps
  }

  /**
   * Lazily initialize the WebTorrent client.
   * Uses dynamic import() since webtorrent is an ESM package.
   */
  async ensureClient(): Promise<WebTorrentClient> {
    if (this.client) {
      return this.client
    }

    console.log('[WebTorrentService] Initializing WebTorrent client...')

    const WebTorrent = (await import('webtorrent')).default
    this.client = new WebTorrent({
      maxConns: 50,
      uploadLimit: this.deps.settings.maxUploadSpeed || undefined,
      downloadLimit: this.deps.settings.maxDownloadSpeed || undefined,
    })

    this.client.on('error', (err: Error) => {
      console.error('[WebTorrentService] Client error:', err.message)
    })

    this.deps.broadcaster.start()
    console.log('[WebTorrentService] Client initialized successfully')

    return this.client
  }

  /** Get the WebTorrent client (if initialized). */
  getClient(): WebTorrentClient | null {
    return this.client
  }

  /**
   * Process the queue: start torrents up to concurrency limit.
   */
  async processQueue(): Promise<void> {
    const activeCount = [...this.deps.queue.values()]
      .filter(qt => qt.status === 'downloading' || qt.status === 'seeding')
      .length

    const slotsAvailable = this.deps.settings.maxConcurrentDownloads - activeCount
    if (slotsAvailable <= 0) return

    const queued = [...this.deps.queue.values()]
      .filter(qt => qt.status === 'queued')
      .sort((a, b) => a.addedAt.localeCompare(b.addedAt)) // FIFO

    for (let i = 0; i < Math.min(slotsAvailable, queued.length); i++) {
      await this.startTorrent(queued[i])
    }
  }

  /**
   * Start downloading a queued torrent via WebTorrent.
   */
  private async startTorrent(qt: QueuedTorrent): Promise<void> {
    try {
      const client = await this.ensureClient()

      if (!existsSync(qt.downloadPath)) {
        mkdirSync(qt.downloadPath, { recursive: true })
      }

      // Determine torrent source: prefer local .torrent file, fall back to magnet URI
      let torrentSource: string | Buffer = qt.magnetUri
      if (qt.torrentFilePath && existsSync(qt.torrentFilePath)) {
        console.log(`[WebTorrentService] Using local .torrent file: ${qt.torrentFilePath}`)
        torrentSource = readFileSync(qt.torrentFilePath)
      } else if (qt.torrentFilePath) {
        console.log(`[WebTorrentService] .torrent file not found at ${qt.torrentFilePath}, falling back to magnet URI`)
      }

      const torrent = client.add(torrentSource, {
        path: qt.downloadPath,
      })

      // Immediately deselect all files to prevent downloading before selection is applied.
      // For .torrent files: torrent.files is populated synchronously, so this stops any
      // piece requests before the metadata handler runs and applies the correct selection.
      // For magnet links: torrent.files is empty here (no-op); the metadata handler handles it.
      torrent.files.forEach(f => f.deselect())

      this.deps.activeTorrents.set(qt.id, torrent)

      qt.infoHash = torrent.infoHash
      qt.status = 'downloading'
      qt.startedAt = new Date().toISOString()
      this.deps.persistQueue()
      this.deps.broadcaster.broadcastStatusChange(qt)

      torrent.on('metadata', () => {
        this.handleTorrentMetadata(qt, torrent)
      })

      torrent.on('done', () => {
        this.handleTorrentDone(qt, torrent)
      })

      torrent.on('error', (err: Error) => {
        console.error(`[WebTorrentService] Torrent error (${qt.name}):`, err.message)
        qt.status = 'error'
        qt.error = err.message
        qt.downloadSpeed = 0
        qt.uploadSpeed = 0
        this.deps.activeTorrents.delete(qt.id)
        this.deps.persistQueue()
        this.deps.broadcaster.broadcastStatusChange(qt)
        this.processQueue()
      })
    } catch (err) {
      console.error(`[WebTorrentService] Failed to start torrent (${qt.name}):`, err)
      qt.status = 'error'
      qt.error = err instanceof Error ? err.message : 'Failed to start torrent'
      this.deps.persistQueue()
      this.deps.broadcaster.broadcastStatusChange(qt)
    }
  }

  /**
   * Handle torrent metadata event — apply file selection or await user choice.
   */
  private handleTorrentMetadata(qt: QueuedTorrent, torrent: Torrent): void {
    qt.infoHash = torrent.infoHash
    qt.name = torrent.name || qt.name
    if (torrent.name) qt.torrentRootFolder = torrent.name
    qt.totalSize = torrent.length

    // If files were pre-selected, apply the selection immediately
    if (qt.selectedFileIndices && qt.selectedFileIndices.length > 0) {
      const selectedSet = new Set(qt.selectedFileIndices)

      // Check if all selected files already exist with matching size
      if (qt.downloadPath) {
        const allExist = qt.selectedFileIndices.every(index => {
          if (index < 0 || index >= torrent.files.length) return false
          const file = torrent.files[index]
          const fullPath = path.join(qt.downloadPath, file.path)
          try {
            return statSync(fullPath).size === file.length
          } catch {
            return false
          }
        })

        if (allExist) {
          console.log(`[WebTorrentService] All selected files already exist, marking as completed: ${qt.name}`)
          qt.status = 'completed'
          qt.progress = 100
          qt.completedAt = new Date().toISOString()
          qt.files = mapCompletedFiles(torrent, selectedSet)
          this.deps.activeTorrents.delete(qt.id)
          torrent.destroy()
          this.deps.persistQueue()
          this.deps.broadcaster.broadcastStatusChange(qt)
          cleanupDeselectedFiles(qt)
          this.processQueue()
          return
        }
      }

      // Deselect all first, clear pre-created dirs, then select only chosen files.
      // Clearing while everything is deselected ensures dirs are empty so
      // random-access-file only recreates dirs for selected files via mkdirp.
      torrent.files.forEach(file => file.deselect())
      clearPreCreatedDirs(qt.downloadPath, torrent.name)
      torrent.files.forEach((file, index) => {
        if (selectedSet.has(index)) file.select()
      })
      qt.files = mapTorrentFiles(torrent, selectedSet)
      qt.status = 'downloading'
      this.deps.persistQueue()
      this.deps.broadcaster.broadcastStatusChange(qt)
      console.log(`[WebTorrentService] Metadata received, pre-selected ${selectedSet.size}/${torrent.files.length} files: ${qt.name}`)
      return
    }

    // No pre-selection: deselect all files and wait for user to pick
    torrent.files.forEach(file => file.deselect())
    qt.files = mapTorrentFiles(torrent)

    qt.status = 'awaiting-file-selection'
    this.deps.torrentsAwaitingSelection.add(qt.id)

    this.deps.persistQueue()
    this.deps.broadcaster.broadcastStatusChange(qt)
    this.deps.broadcaster.broadcastFileSelectionNeeded(qt)

    console.log(`[WebTorrentService] Metadata received, awaiting file selection: ${qt.name} (${qt.totalSize} bytes, ${torrent.files.length} files)`)

    // Delete the empty dir tree WebTorrent just created — all files are deselected
    // so no data has been written yet and Windows hasn't locked any handles.
    // random-access-file recreates only selected file dirs via mkdirp when download starts.
    clearPreCreatedDirs(qt.downloadPath, torrent.name)
  }

  /**
   * Handle torrent done event — mark complete or seed.
   */
  private handleTorrentDone(qt: QueuedTorrent, torrent: Torrent): void {
    const selectedSet = qt.selectedFileIndices ? new Set(qt.selectedFileIndices) : undefined
    qt.status = this.deps.settings.seedAfterDownload ? 'seeding' : 'completed'
    qt.progress = 100
    qt.completedAt = new Date().toISOString()
    // Use mapCompletedFiles so all selected files show 100% in the UI.
    // mapTorrentFiles relies on f.downloaded which can lag behind actual
    // completion when the done event fires (in-flight writes not yet counted).
    const completedSet = selectedSet ?? new Set(torrent.files.map((_, i) => i))
    qt.files = mapCompletedFiles(torrent, completedSet)
    this.deps.persistQueue()
    this.deps.broadcaster.broadcastStatusChange(qt)

    console.log(`[WebTorrentService] Download complete: ${qt.name}`)

    if (!this.deps.settings.seedAfterDownload) {
      this.deps.activeTorrents.delete(qt.id)
      torrent.destroy()
      cleanupDeselectedFiles(qt)
      this.processQueue()
    }
  }

  /**
   * Destroy a WebTorrent instance for a specific queue entry by ID.
   */
  destroyClientTorrent(id: string): void {
    const torrent = this.deps.activeTorrents.get(id)
    if (torrent) {
      torrent.destroy()
      this.deps.activeTorrents.delete(id)
    }
  }

  /**
   * Destroy the WebTorrent client and clean up resources.
   */
  async destroyClient(): Promise<void> {
    this.deps.activeTorrents.clear()

    if (this.client) {
      return new Promise<void>((resolve) => {
        this.client!.destroy(() => {
          this.client = null
          console.log('[WebTorrentService] Client destroyed')
          resolve()
        })
      })
    }
  }
}
