import path from 'path'
import type WebTorrentClient from 'webtorrent'
import type { Torrent } from 'webtorrent'
import type { WebContents } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type { StreamPreviewStartRequest } from '@shared/types/streamPreview.types'

const LOG_TAG = '[StreamPreview]'

/** Supported audio extensions for HTML5 <audio> playback */
const SUPPORTED_EXTENSIONS = new Set(['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac', '.opus'])

/** MIME type mapping for data URLs */
const MIME_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus',
}

/** Buffer sizes for different formats */
const BUFFER_SIZE_COMPRESSED = 2 * 1024 * 1024 // 2 MB — enough for ~60s of MP3/AAC
const BUFFER_SIZE_LOSSLESS = 4 * 1024 * 1024   // 4 MB — FLAC/WAV need more

/** Timeouts */
const METADATA_TIMEOUT_MS = 15_000 // 15 seconds for peer discovery + metadata

/**
 * StreamPreviewService
 *
 * Streams a short audio sample from a torrent for preview playback.
 * Uses its own WebTorrent client instance, separate from the download queue.
 * Only one active preview at a time.
 */
export class StreamPreviewService {
  private client: WebTorrentClient | null = null
  private activeTorrent: Torrent | null = null
  private metadataTimer: ReturnType<typeof setTimeout> | null = null
  private sender: WebContents | null = null

  /**
   * Start a stream preview for a specific file in a torrent.
   * Stops any existing preview first.
   */
  async start(request: StreamPreviewStartRequest, sender: WebContents): Promise<void> {
    const { magnetUri, fileIndex, trackName } = request
    console.log(`${LOG_TAG} Starting preview: "${trackName}" (file ${fileIndex})`)

    // Stop any existing preview
    await this.stop()

    this.sender = sender

    // Validate format from track name extension
    const ext = path.extname(trackName).toLowerCase()
    if (ext && !SUPPORTED_EXTENSIONS.has(ext)) {
      this.pushError(`Preview not available for this format (${ext})`)
      return
    }

    try {
      const client = await this.ensureClient()

      // Push initial buffering state
      this.pushBuffering(0)

      // Add torrent — do NOT save to disk
      const torrent = client.add(magnetUri, { path: '/dev/null' })
      this.activeTorrent = torrent

      // Set up metadata timeout
      this.metadataTimer = setTimeout(() => {
        console.log(`${LOG_TAG} Metadata timeout — no peers found`)
        this.pushError('No peers available — can\'t preview this track')
        this.stop()
      }, METADATA_TIMEOUT_MS)

      // Wait for torrent metadata (file list)
      torrent.on('ready', () => {
        this.clearMetadataTimer()
        this.onTorrentReady(torrent, fileIndex, trackName)
      })

      torrent.on('error', (err: Error) => {
        console.error(`${LOG_TAG} Torrent error:`, err.message)
        this.clearMetadataTimer()
        this.pushError('Preview interrupted')
        this.stop()
      })
    } catch (error) {
      console.error(`${LOG_TAG} Failed to start preview:`, error)
      this.pushError(error instanceof Error ? error.message : 'Failed to start preview')
      await this.stop()
    }
  }

  /**
   * Stop the current preview and clean up resources.
   */
  async stop(): Promise<void> {
    this.clearMetadataTimer()

    if (this.activeTorrent) {
      console.log(`${LOG_TAG} Stopping preview`)
      try {
        await new Promise<void>((resolve) => {
          this.activeTorrent!.destroy({ destroyStore: true }, () => resolve())
        })
      } catch {
        // Ignore errors during cleanup
      }
      this.activeTorrent = null
    }

    this.sender = null
  }

  /**
   * Full cleanup — called on app shutdown.
   */
  async cleanup(): Promise<void> {
    await this.stop()

    if (this.client) {
      await new Promise<void>((resolve) => {
        this.client!.destroy(() => resolve())
      })
      this.client = null
    }
  }

  // ────────────────────────────────────────────
  // Private helpers
  // ────────────────────────────────────────────

  private async ensureClient(): Promise<WebTorrentClient> {
    if (this.client) return this.client

    console.log(`${LOG_TAG} Initializing WebTorrent client...`)
    const WebTorrent = (await import('webtorrent')).default
    this.client = new WebTorrent({ maxConns: 20 })

    this.client.on('error', (err: Error) => {
      console.error(`${LOG_TAG} Client error:`, err.message)
    })

    return this.client
  }

  private onTorrentReady(torrent: Torrent, fileIndex: number, trackName: string): void {
    // Validate file index
    if (fileIndex < 0 || fileIndex >= torrent.files.length) {
      this.pushError('Track not found in torrent')
      this.stop()
      return
    }

    const file = torrent.files[fileIndex]
    console.log(`${LOG_TAG} Torrent ready — file: "${file.name}" (${file.length} bytes)`)

    // Determine extension from actual torrent file name (more reliable than trackName)
    const ext = path.extname(file.name).toLowerCase()
    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      this.pushError(`Preview not available for this format (${ext})`)
      this.stop()
      return
    }

    // Deselect all files, then select only the target file
    for (const f of torrent.files) {
      f.deselect()
    }
    file.select()

    // Determine buffer size based on format
    const isLossless = ext === '.flac' || ext === '.wav'
    const bufferSize = isLossless ? BUFFER_SIZE_LOSSLESS : BUFFER_SIZE_COMPRESSED
    const readEnd = Math.min(bufferSize, file.length) - 1

    // Stream the first chunk
    this.bufferFile(file, readEnd, ext, trackName)
  }

  private bufferFile(
    file: import('webtorrent').TorrentFile,
    readEnd: number,
    ext: string,
    trackName: string,
  ): void {
    const chunks: Buffer[] = []
    let received = 0
    const totalBytes = readEnd + 1

    const stream = file.createReadStream({ start: 0, end: readEnd })

    stream.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
      received += chunk.length
      const progress = Math.min(Math.round((received / totalBytes) * 100), 99)
      this.pushBuffering(progress)
    })

    stream.on('end', () => {
      console.log(`${LOG_TAG} Buffering complete — ${received} bytes`)
      this.pushBuffering(100)

      const buffer = Buffer.concat(chunks)
      const mimeType = MIME_TYPES[ext] || 'audio/mpeg'
      const base64 = buffer.toString('base64')
      const dataUrl = `data:${mimeType};base64,${base64}`

      this.pushReady(dataUrl, trackName)
    })

    stream.on('error', (err: Error) => {
      console.error(`${LOG_TAG} Stream error:`, err.message)
      this.pushError('Preview interrupted')
      this.stop()
    })
  }

  // ────────────────────────────────────────────
  // IPC push helpers
  // ────────────────────────────────────────────

  private pushBuffering(progress: number): void {
    if (this.sender && !this.sender.isDestroyed()) {
      this.sender.send(IPC_CHANNELS.STREAM_PREVIEW_BUFFERING, { progress })
    }
  }

  private pushReady(dataUrl: string, trackName: string): void {
    if (this.sender && !this.sender.isDestroyed()) {
      this.sender.send(IPC_CHANNELS.STREAM_PREVIEW_READY, { dataUrl, trackName })
    }
  }

  private pushError(error: string): void {
    if (this.sender && !this.sender.isDestroyed()) {
      this.sender.send(IPC_CHANNELS.STREAM_PREVIEW_ERROR, { error })
    }
  }

  private clearMetadataTimer(): void {
    if (this.metadataTimer) {
      clearTimeout(this.metadataTimer)
      this.metadataTimer = null
    }
  }
}
