import { v4 as uuid } from 'uuid'
import path from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs'
import { app, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type {
  QueuedTorrent,
  QueuedTorrentProgress,
  TorrentContentFile,
  AddTorrentRequest,
  AddTorrentResponse,
  WebTorrentSettings,
} from '@shared/types/torrent.types'
import type { ConfigService } from './ConfigService'
import type WebTorrentClient from 'webtorrent'
import type { Torrent } from 'webtorrent'

const SETTINGS_KEY = 'webtorrentSettings'
const DOWNLOAD_PATH_PREFIX = 'webtorrent-download-path:'

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
  /** Maps queue entry ID -> active WebTorrent Torrent instance (for reliable progress lookup) */
  private activeTorrents: Map<string, Torrent> = new Map()
  /** Tracks torrents awaiting file selection */
  private torrentsAwaitingSelection: Set<string> = new Set()
  private progressInterval: ReturnType<typeof setInterval> | null = null
  private settings: WebTorrentSettings = {
    maxConcurrentDownloads: 3,
    seedAfterDownload: false,
    maxUploadSpeed: 0,
    maxDownloadSpeed: 0,
  }
  private persistPath: string
  private configService: ConfigService

  constructor(configService: ConfigService) {
    this.configService = configService
    this.persistPath = path.join(app.getPath('userData'), 'webtorrent-queue.json')
    this.loadSettings()
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
    // Check for duplicate in active queue
    for (const [, qt] of this.queue) {
      if (qt.status !== 'error' && qt.status !== 'completed') {
        if (
          (request.magnetUri && qt.magnetUri === request.magnetUri) ||
          (request.torrentFilePath && qt.torrentFilePath === request.torrentFilePath)
        ) {
          return { success: false, error: 'This torrent is already in the queue' }
        }
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
      torrentFilePath: request.torrentFilePath,
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
    this.destroyClientTorrent(qt.id)

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
    this.destroyClientTorrent(id)

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

  /**
   * Apply file selection and start downloading selected files only.
   * Skips files that already exist and have matching size.
   */
  selectFiles(id: string, selectedFileIndices: number[]): { success: boolean; error?: string } {
    const qt = this.queue.get(id)
    if (!qt) return { success: false, error: 'Torrent not found' }

    if (qt.status !== 'awaiting-file-selection') {
      return { success: false, error: 'Torrent is not awaiting file selection' }
    }

    const torrent = this.activeTorrents.get(id)
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
      this.torrentsAwaitingSelection.delete(id)
      this.persistQueue()
      this.broadcastStatusChange(qt)
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
    qt.files = this.mapTorrentFiles(torrent, selectedSet)
    qt.status = 'downloading'
    this.torrentsAwaitingSelection.delete(id)

    this.persistQueue()
    this.broadcastStatusChange(qt)

    const message = skippedFiles.length > 0
      ? `File selection applied: ${filesToDownload.length}/${torrent.files.length} files to download (${skippedFiles.length} already exist)`
      : `File selection applied: ${filesToDownload.length}/${torrent.files.length} files selected for download`

    console.log(`[WebTorrentService] ${message}`)
    return { success: true }
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

      // Store torrent instance for reliable progress lookup
      this.activeTorrents.set(qt.id, torrent)

      // infoHash is available immediately from the magnet URI
      qt.infoHash = torrent.infoHash
      qt.status = 'downloading' // Will change to awaiting-file-selection when metadata loads
      qt.startedAt = new Date().toISOString()
      this.persistQueue()
      this.broadcastStatusChange(qt)

      torrent.on('metadata', () => {
        qt.infoHash = torrent.infoHash
        qt.name = torrent.name || qt.name
        qt.totalSize = torrent.length

        // CRITICAL: Deselect all files immediately to prevent downloading
        // This allows metadata to be fetched while preventing file content downloads
        torrent.files.forEach(file => file.deselect())
        qt.files = this.mapTorrentFiles(torrent)

        // Set status to awaiting file selection (don't pause - files are already deselected)
        qt.status = 'awaiting-file-selection'
        this.torrentsAwaitingSelection.add(qt.id)

        this.persistQueue()
        this.broadcastStatusChange(qt)

        // Broadcast event to renderer to open file selection dialog
        this.broadcastFileSelectionNeeded(qt)

        console.log(`[WebTorrentService] Metadata received, awaiting file selection: ${qt.name} (${qt.totalSize} bytes, ${torrent.files.length} files)`)
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
          this.activeTorrents.delete(qt.id)
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
        this.activeTorrents.delete(qt.id)
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
   * Destroy a WebTorrent instance for a specific queue entry by ID.
   */
  private destroyClientTorrent(id: string): void {
    const torrent = this.activeTorrents.get(id)
    if (torrent) {
      torrent.destroy()
      this.activeTorrents.delete(id)
    }
  }

  /**
   * Map WebTorrent files to our TorrentContentFile type.
   */
  private mapTorrentFiles(torrent: Torrent, selectedIndices?: Set<number>): TorrentContentFile[] {
    return torrent.files.map((f, index) => ({
      path: f.path,
      name: f.name,
      size: f.length,
      downloaded: f.downloaded,
      progress: f.length > 0 ? Math.round((f.downloaded / f.length) * 100) : 0,
      selected: selectedIndices ? selectedIndices.has(index) : true,
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
      const updates: QueuedTorrentProgress[] = []

      for (const [, qt] of this.queue) {
        if (qt.status !== 'downloading' && qt.status !== 'seeding') continue

        // Use the activeTorrents map for reliable lookup (no infoHash matching needed)
        const torrent = this.activeTorrents.get(qt.id)
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
   * Broadcast event to renderer that a torrent needs file selection.
   */
  private broadcastFileSelectionNeeded(qt: QueuedTorrent): void {
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
        // Reset awaiting-file-selection to queued on restart
        if (qt.status === 'awaiting-file-selection') {
          qt.status = 'queued'
          this.torrentsAwaitingSelection.delete(qt.id)
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
  // SETTINGS (persisted via ConfigService)
  // ====================================

  /**
   * Load settings from ConfigService on startup.
   */
  private loadSettings(): void {
    const saved = this.configService.getSetting<WebTorrentSettings>(SETTINGS_KEY)
    if (saved) {
      this.settings = { ...this.settings, ...saved }
      console.log('[WebTorrentService] Loaded persisted settings:', this.settings)
    }
  }

  /**
   * Get current WebTorrent settings.
   */
  getSettings(): WebTorrentSettings {
    return { ...this.settings }
  }

  /**
   * Update WebTorrent settings and persist them.
   */
  updateSettings(newSettings: Partial<WebTorrentSettings>): WebTorrentSettings {
    this.settings = { ...this.settings, ...newSettings }

    // Persist to disk
    this.configService.setSetting(SETTINGS_KEY, this.settings)

    // Apply speed limits to running client
    if (this.client) {
      this.client.throttleDownload(this.settings.maxDownloadSpeed || Number.MAX_SAFE_INTEGER)
      this.client.throttleUpload(this.settings.maxUploadSpeed || Number.MAX_SAFE_INTEGER)
    }

    console.log('[WebTorrentService] Settings updated:', this.settings)
    return { ...this.settings }
  }

  // ====================================
  // PER-PROJECT DOWNLOAD PATH
  // ====================================

  /**
   * Get the saved download path for a project.
   */
  getProjectDownloadPath(projectId: string): string {
    return this.configService.getSetting<string>(`${DOWNLOAD_PATH_PREFIX}${projectId}`) || ''
  }

  /**
   * Save the download path for a project.
   */
  setProjectDownloadPath(projectId: string, downloadPath: string): void {
    this.configService.setSetting(`${DOWNLOAD_PATH_PREFIX}${projectId}`, downloadPath)
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

    this.activeTorrents.clear()

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
