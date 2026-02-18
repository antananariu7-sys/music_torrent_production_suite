import { v4 as uuid } from 'uuid'
import path from 'path'
import { app } from 'electron'
import type {
  QueuedTorrent,
  TorrentContentFile,
  AddTorrentRequest,
  AddTorrentResponse,
  WebTorrentSettings,
} from '@shared/types/torrent.types'
import type { ConfigService } from '../ConfigService'
import type { Torrent } from 'webtorrent'

import { parseTorrentFiles as parseTorrentFilesUtil } from './utils/torrentHelpers'
import { deleteDownloadedFiles } from './utils/fileCleanup'
import { persistQueue as persistQueueUtil, loadPersistedQueue } from './utils/torrentPersistence'
import { ProgressBroadcaster } from './managers/ProgressBroadcaster'
import { TorrentLifecycleManager } from './managers/TorrentLifecycleManager'
import { FileSelectionHandler } from './handlers/FileSelectionHandler'

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
  private queue: Map<string, QueuedTorrent> = new Map()
  private activeTorrents: Map<string, Torrent> = new Map()
  private torrentsAwaitingSelection: Set<string> = new Set()
  private settings: WebTorrentSettings = {
    maxConcurrentDownloads: 3,
    seedAfterDownload: false,
    maxUploadSpeed: 0,
    maxDownloadSpeed: 0,
  }
  private persistPath: string
  private configService: ConfigService
  private broadcaster: ProgressBroadcaster
  private lifecycle: TorrentLifecycleManager
  private fileSelectionHandler: FileSelectionHandler

  constructor(configService: ConfigService) {
    this.configService = configService
    this.persistPath = path.join(app.getPath('userData'), 'webtorrent-queue.json')
    this.loadSettings()

    // Initialize sub-modules with shared state
    this.broadcaster = new ProgressBroadcaster({
      queue: this.queue,
      activeTorrents: this.activeTorrents,
      settings: this.settings,
      persistQueue: () => this.persistQueue(),
      processQueue: () => this.lifecycle.processQueue(),
    })

    this.lifecycle = new TorrentLifecycleManager({
      queue: this.queue,
      activeTorrents: this.activeTorrents,
      torrentsAwaitingSelection: this.torrentsAwaitingSelection,
      settings: this.settings,
      broadcaster: this.broadcaster,
      persistQueue: () => this.persistQueue(),
    })

    this.fileSelectionHandler = new FileSelectionHandler({
      queue: this.queue,
      activeTorrents: this.activeTorrents,
      torrentsAwaitingSelection: this.torrentsAwaitingSelection,
      persistQueue: () => this.persistQueue(),
      broadcastStatusChange: (qt) => this.broadcaster.broadcastStatusChange(qt),
      processQueue: () => this.lifecycle.processQueue(),
    })

    // Load persisted queue after sub-modules are ready
    const persisted = loadPersistedQueue(this.persistPath)
    for (const qt of persisted) {
      this.queue.set(qt.id, qt)
    }
  }

  // ====================================
  // TORRENT FILE PARSING
  // ====================================

  async parseTorrentFiles(torrentFilePath: string): Promise<TorrentContentFile[]> {
    return parseTorrentFilesUtil(torrentFilePath)
  }

  // ====================================
  // QUEUE OPERATIONS
  // ====================================

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
      selectedFileIndices: request.selectedFileIndices,
    }

    this.queue.set(id, queuedTorrent)
    this.persistQueue()
    await this.lifecycle.processQueue()

    console.log(`[WebTorrentService] Added torrent to queue: ${request.name} (${id})`)
    return { success: true, torrent: queuedTorrent }
  }

  pause(id: string): { success: boolean; error?: string } {
    const qt = this.queue.get(id)
    if (!qt) return { success: false, error: 'Torrent not found' }

    if (qt.status !== 'downloading' && qt.status !== 'seeding') {
      return { success: false, error: `Cannot pause torrent with status: ${qt.status}` }
    }

    this.lifecycle.destroyClientTorrent(qt.id)

    qt.status = 'paused'
    qt.downloadSpeed = 0
    qt.uploadSpeed = 0
    this.persistQueue()
    this.broadcaster.broadcastStatusChange(qt)
    this.lifecycle.processQueue()

    console.log(`[WebTorrentService] Paused: ${qt.name} (${id})`)
    return { success: true }
  }

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
    this.broadcaster.broadcastStatusChange(qt)
    this.lifecycle.processQueue()

    console.log(`[WebTorrentService] Resumed: ${qt.name} (${id})`)
    return { success: true }
  }

  remove(id: string, deleteFiles = false): { success: boolean; error?: string } {
    const qt = this.queue.get(id)
    if (!qt) return { success: false, error: 'Torrent not found' }

    this.lifecycle.destroyClientTorrent(id)

    console.log(`[WebTorrentService] remove() called: id=${id} deleteFiles=${deleteFiles} downloadPath="${qt.downloadPath}" filesCount=${qt.files.length}`)
    if (deleteFiles && qt.downloadPath && qt.files.length > 0) {
      deleteDownloadedFiles(qt)
    } else if (deleteFiles) {
      console.log(`[WebTorrentService] remove() deleteFiles=true but skipped: downloadPath="${qt.downloadPath}" files.length=${qt.files.length}`)
    }

    this.queue.delete(id)
    this.persistQueue()
    this.lifecycle.processQueue()

    console.log(`[WebTorrentService] Removed: ${qt.name} (${id})${deleteFiles ? ' (files deleted)' : ''}`)
    return { success: true }
  }

  getAll(): QueuedTorrent[] {
    return [...this.queue.values()]
  }

  selectFiles(id: string, selectedFileIndices: number[]): { success: boolean; error?: string } {
    return this.fileSelectionHandler.selectFiles(id, selectedFileIndices)
  }

  async downloadMoreFiles(id: string, additionalFileIndices: number[]): Promise<{ success: boolean; error?: string }> {
    return this.fileSelectionHandler.downloadMoreFiles(id, additionalFileIndices)
  }

  // ====================================
  // PERSISTENCE
  // ====================================

  private persistQueue(): void {
    persistQueueUtil(this.queue, this.persistPath)
  }

  resumePersistedDownloads(): void {
    const hasQueued = [...this.queue.values()].some(qt => qt.status === 'queued')
    if (hasQueued) {
      console.log('[WebTorrentService] Resuming persisted downloads...')
      this.lifecycle.processQueue()
    }
  }

  // ====================================
  // SETTINGS
  // ====================================

  private loadSettings(): void {
    const saved = this.configService.getSetting<WebTorrentSettings>(SETTINGS_KEY)
    if (saved) {
      this.settings = { ...this.settings, ...saved }
      console.log('[WebTorrentService] Loaded persisted settings:', this.settings)
    }
  }

  getSettings(): WebTorrentSettings {
    return { ...this.settings }
  }

  updateSettings(newSettings: Partial<WebTorrentSettings>): WebTorrentSettings {
    this.settings = { ...this.settings, ...newSettings }
    this.configService.setSetting(SETTINGS_KEY, this.settings)

    const client = this.lifecycle.getClient()
    if (client) {
      client.throttleDownload(this.settings.maxDownloadSpeed || Number.MAX_SAFE_INTEGER)
      client.throttleUpload(this.settings.maxUploadSpeed || Number.MAX_SAFE_INTEGER)
    }

    console.log('[WebTorrentService] Settings updated:', this.settings)
    return { ...this.settings }
  }

  // ====================================
  // PER-PROJECT DOWNLOAD PATH
  // ====================================

  getProjectDownloadPath(projectId: string): string {
    return this.configService.getSetting<string>(`${DOWNLOAD_PATH_PREFIX}${projectId}`) || ''
  }

  setProjectDownloadPath(projectId: string, downloadPath: string): void {
    this.configService.setSetting(`${DOWNLOAD_PATH_PREFIX}${projectId}`, downloadPath)
  }

  // ====================================
  // CLEANUP
  // ====================================

  async destroy(): Promise<void> {
    this.broadcaster.stop()
    await this.lifecycle.destroyClient()
  }
}
