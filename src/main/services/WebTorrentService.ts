import { v4 as uuid } from 'uuid'
import path from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { app, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type {
  QueuedTorrent,
  QueuedTorrentProgress,
  QueuedTorrentStatus,
  TorrentContentFile,
  AddTorrentRequest,
  AddTorrentResponse,
  WebTorrentSettings,
} from '@shared/types/torrent.types'
import type WebTorrentClient from 'webtorrent'
import type { Torrent } from 'webtorrent'

/**
 * WebTorrentService
 *
 * Wraps the WebTorrent client to provide a managed download queue with:
 * - Concurrency control (max simultaneous downloads)
 * - Real-time progress broadcasting to renderer windows
 * - Pause/resume/remove operations
 * - Queue persistence across app restarts
 * - Optional seeding after download
 */
export class WebTorrentService {
  private client: WebTorrentClient | null = null
  private queue: Map<string, QueuedTorrent> = new Map()
  private progressInterval: ReturnType<typeof setInterval> | null = null
  private settings: WebTorrentSettings = {
    maxConcurrentDownloads: 3,
    seedAfterDownload: false,
    maxUploadSpeed: 0,
    maxDownloadSpeed: 0,
  }
  private persistPath: string

  constructor() {
    this.persistPath = path.join(app.getPath('userData'), 'webtorrent-queue.json')
    this.loadPersistedQueue()
  }

  // ====================================
  // CLIENT MANAGEMENT
  // ====================================

  /**
   * Lazily initialize the WebTorrent client.
   * Uses dynamic import() since webtorrent is an ESM package.
   */
  private async ensureClient(): Promise<WebTorrentClient> {
    if (this.client) {
      return this.client
    }

    console.log('[WebTorrentService] Initializing WebTorrent client...')

    const WebTorrent = (await import('webtorrent')).default
    this.client = new WebTorrent({
      maxConns: 50,
      uploadLimit: this.settings.maxUploadSpeed || undefined,
      downloadLimit: this.settings.maxDownloadSpeed || undefined,
    })

    this.client.on('error', (err: Error) => {
      console.error('[WebTorrentService] Client error:', err.message)
    })

    this.startProgressBroadcast()
    console.log('[WebTorrentService] Client initialized successfully')

    return this.client
  }

  // ====================================
  // QUEUE OPERATIONS
  // ====================================

  /**
   * Add a torrent to the download queue.
   */
  async add(request: AddTorrentRequest): Promise<AddTorrentResponse> {
    // Check for duplicate magnetUri in active queue
    for (const [, qt] of this.queue) {
      if (qt.magnetUri === request.magnetUri && qt.status !== 'error' && qt.status !== 'completed') {
        return { success: false, error: 'This torrent is already in the queue' }
      }
    }

    const id = uuid()
    const queuedTorrent: QueuedTorrent = {
      id,
      projectId: request.projectId,
      magnetUri: request.magnetUri,
      infoHash: '',
      name: request.name,
      status: 'queued',
      progress: 0,
      downloadSpeed: 0,
      uploadSpeed: 0,
      downloaded: 0,
      uploaded: 0,
      totalSize: 0,
      files: [],
      seeders: 0,
      leechers: 0,
      ratio: 0,
      addedAt: new Date().toISOString(),
      downloadPath: request.downloadPath,
      fromCollectedTorrentId: request.fromCollectedTorrentId,
    }

    this.queue.set(id, queuedTorrent)
    this.persistQueue()
    await this.processQueue()

    console.log(`[WebTorrentService] Added torrent to queue: ${request.name} (${id})`)
    return { success: true, torrent: queuedTorrent }
  }

  /**
   * Pause a downloading/seeding torrent.
   */
  pause(id: string): { success: boolean; error?: string } {
    const qt = this.queue.get(id)
    if (!qt) return { success: false, error: 'Torrent not found' }

    if (qt.status !== 'downloading' && qt.status !== 'seeding') {
      return { success: false, error: `Cannot pause torrent with status: ${qt.status}` }
    }

    // Destroy the WebTorrent instance for this torrent
    this.destroyClientTorrent(qt)

    qt.status = 'paused'
    qt.downloadSpeed = 0
    qt.uploadSpeed = 0
    this.persistQueue()
    this.broadcastStatusChange(qt)
    this.processQueue()

    console.log(`[WebTorrentService] Paused: ${qt.name} (${id})`)
    return { success: true }
  }

  /**
   * Resume a paused or errored torrent.
   */
  resume(id: string): { success: boolean; error?: string } {
    const qt = this.queue.get(id)
    if (!qt) return { success: false, error: 'Torrent not found' }

    if (qt.status !== 'paused' && qt.status !== 'error') {
      return { success: false, error: `Cannot resume torrent with status: ${qt.status}` }
    }

    qt.status = 'queued'
    qt.error = undefined
    qt.downloadSpeed = 0
    qt.uploadSpeed = 0
    this.persistQueue()
    this.broadcastStatusChange(qt)
    this.processQueue()

    console.log(`[WebTorrentService] Resumed: ${qt.name} (${id})`)
    return { success: true }
  }

  /**
   * Remove a torrent from the queue.
   */
  remove(id: string): { success: boolean; error?: string } {
    const qt = this.queue.get(id)
    if (!qt) return { success: false, error: 'Torrent not found' }

    // Destroy WebTorrent instance if active
    this.destroyClientTorrent(qt)

    this.queue.delete(id)
    this.persistQueue()
    this.processQueue()

    console.log(`[WebTorrentService] Removed: ${qt.name} (${id})`)
    return { success: true }
  }

  /**
   * Get all queued torrents.
   */
  getAll(): QueuedTorrent[] {
    return [...this.queue.values()]
  }

  // ====================================
  // QUEUE PROCESSING
  // ====================================

  /**
   * Process the queue: start torrents up to concurrency limit.
   */
  private async processQueue(): Promise<void> {
    const activeCount = [...this.queue.values()]
      .filter(qt => qt.status === 'downloading' || qt.status === 'seeding')
      .length

    const slotsAvailable = this.settings.maxConcurrentDownloads - activeCount
    if (slotsAvailable <= 0) return

    const queued = [...this.queue.values()]
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

      // Ensure download path exists
      if (!existsSync(qt.downloadPath)) {
        mkdirSync(qt.downloadPath, { recursive: true })
      }

      const torrent = client.add(qt.magnetUri, {
        path: qt.downloadPath,
      })

      qt.status = 'downloading'
      qt.startedAt = new Date().toISOString()
      this.persistQueue()
      this.broadcastStatusChange(qt)

      torrent.on('metadata', () => {
        qt.infoHash = torrent.infoHash
        qt.name = torrent.name || qt.name
        qt.totalSize = torrent.length
        qt.files = this.mapTorrentFiles(torrent)
        this.persistQueue()
        this.broadcastStatusChange(qt)
        console.log(`[WebTorrentService] Metadata received: ${qt.name} (${qt.totalSize} bytes)`)
      })

      torrent.on('done', () => {
        qt.status = this.settings.seedAfterDownload ? 'seeding' : 'completed'
        qt.progress = 100
        qt.completedAt = new Date().toISOString()
        qt.files = this.mapTorrentFiles(torrent)
        this.persistQueue()
        this.broadcastStatusChange(qt)

        console.log(`[WebTorrentService] Download complete: ${qt.name}`)

        if (!this.settings.seedAfterDownload) {
          torrent.destroy()
          this.processQueue() // Start next in queue
        }
      })

      torrent.on('error', (err: Error) => {
        console.error(`[WebTorrentService] Torrent error (${qt.name}):`, err.message)
        qt.status = 'error'
        qt.error = err.message
        qt.downloadSpeed = 0
        qt.uploadSpeed = 0
        this.persistQueue()
        this.broadcastStatusChange(qt)
        this.processQueue()
      })
    } catch (err) {
      console.error(`[WebTorrentService] Failed to start torrent (${qt.name}):`, err)
      qt.status = 'error'
      qt.error = err instanceof Error ? err.message : 'Failed to start torrent'
      this.persistQueue()
      this.broadcastStatusChange(qt)
    }
  }

  /**
   * Destroy a WebTorrent instance for a specific queue entry.
   */
  private destroyClientTorrent(qt: QueuedTorrent): void {
    if (!this.client || !qt.infoHash) return

    const torrent = this.client.torrents.find(t => t.infoHash === qt.infoHash)
    if (torrent) {
      torrent.destroy()
    }
  }

  /**
   * Map WebTorrent files to our TorrentContentFile type.
   */
  private mapTorrentFiles(torrent: Torrent): TorrentContentFile[] {
    return torrent.files.map(f => ({
      path: f.path,
      name: f.name,
      size: f.length,
      downloaded: f.downloaded,
      progress: f.length > 0 ? Math.round((f.downloaded / f.length) * 100) : 0,
      selected: true,
    }))
  }

  // ====================================
  // PROGRESS BROADCASTING
  // ====================================

  /**
   * Start periodic progress broadcast to all renderer windows (every 1 second).
   */
  private startProgressBroadcast(): void {
    if (this.progressInterval) return

    this.progressInterval = setInterval(() => {
      if (!this.client) return

      const updates: QueuedTorrentProgress[] = []

      for (const [, qt] of this.queue) {
        if (qt.status !== 'downloading' && qt.status !== 'seeding') continue

        const torrent = this.client.torrents.find(t => t.infoHash === qt.infoHash)
        if (!torrent) continue

        // Update queue entry with live data
        qt.progress = Math.round(torrent.progress * 100)
        qt.downloadSpeed = torrent.downloadSpeed
        qt.uploadSpeed = torrent.uploadSpeed
        qt.downloaded = torrent.downloaded
        qt.uploaded = torrent.uploaded
        qt.totalSize = torrent.length
        qt.seeders = torrent.numPeers
        qt.ratio = torrent.downloaded > 0 ? torrent.uploaded / torrent.downloaded : 0
        qt.files = this.mapTorrentFiles(torrent)

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
   * Broadcast a single torrent status change to all windows.
   */
  private broadcastStatusChange(qt: QueuedTorrent): void {
    this.sendToAllWindows(IPC_CHANNELS.WEBTORRENT_STATUS_CHANGE, qt)
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

  // ====================================
  // PERSISTENCE
  // ====================================

  /**
   * Persist queue state to disk for app restart recovery.
   */
  private persistQueue(): void {
    try {
      const serializable = [...this.queue.values()].map(qt => ({
        ...qt,
        // Reset transient speed values
        downloadSpeed: 0,
        uploadSpeed: 0,
      }))
      writeFileSync(this.persistPath, JSON.stringify(serializable, null, 2))
    } catch (err) {
      console.error('[WebTorrentService] Failed to persist queue:', err)
    }
  }

  /**
   * Load persisted queue on startup.
   */
  private loadPersistedQueue(): void {
    try {
      if (!existsSync(this.persistPath)) return

      const data = JSON.parse(readFileSync(this.persistPath, 'utf-8')) as QueuedTorrent[]

      for (const qt of data) {
        // Restore in-progress entries as 'queued' so they restart
        if (qt.status === 'downloading' || qt.status === 'seeding') {
          qt.status = 'queued'
          qt.downloadSpeed = 0
          qt.uploadSpeed = 0
        }
        this.queue.set(qt.id, qt)
      }

      console.log(`[WebTorrentService] Restored ${this.queue.size} torrents from persisted queue`)
    } catch (err) {
      console.error('[WebTorrentService] Failed to load persisted queue:', err)
    }
  }

  /**
   * Resume persisted downloads. Call after window is ready.
   */
  resumePersistedDownloads(): void {
    const hasQueued = [...this.queue.values()].some(qt => qt.status === 'queued')
    if (hasQueued) {
      console.log('[WebTorrentService] Resuming persisted downloads...')
      this.processQueue()
    }
  }

  // ====================================
  // SETTINGS
  // ====================================

  /**
   * Get current WebTorrent settings.
   */
  getSettings(): WebTorrentSettings {
    return { ...this.settings }
  }

  /**
   * Update WebTorrent settings.
   */
  updateSettings(newSettings: Partial<WebTorrentSettings>): WebTorrentSettings {
    this.settings = { ...this.settings, ...newSettings }

    // Apply speed limits to running client
    if (this.client) {
      this.client.throttleDownload(this.settings.maxDownloadSpeed || Number.MAX_SAFE_INTEGER)
      this.client.throttleUpload(this.settings.maxUploadSpeed || Number.MAX_SAFE_INTEGER)
    }

    console.log('[WebTorrentService] Settings updated:', this.settings)
    return { ...this.settings }
  }

  // ====================================
  // CLEANUP
  // ====================================

  /**
   * Destroy the WebTorrent client and clean up resources.
   */
  async destroy(): Promise<void> {
    if (this.progressInterval) {
      clearInterval(this.progressInterval)
      this.progressInterval = null
    }

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
