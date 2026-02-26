import * as path from 'path'
import * as fs from 'fs-extra'
import { BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import { getFfmpegPath } from '../../utils/ffmpegPath'
import { IPC_CHANNELS } from '@shared/constants'
import { toCamelot } from '@shared/utils/camelotWheel'
import type { KeyData, KeyProgressEvent } from '@shared/types/waveform.types'
import type { ProjectService } from '../ProjectService'

/** Sample rate for key analysis */
const ANALYSIS_SAMPLE_RATE = 44100

/** Minimum confidence to consider a valid detection */
const MIN_CONFIDENCE = 0.2

/**
 * Detects musical key per track via Essentia.js WASM KeyExtractor.
 *
 * Pipeline:
 * 1. Extract PCM at 44.1kHz mono via FFmpeg
 * 2. Load Essentia.js WASM module (lazy, once)
 * 3. Run KeyExtractor → { key, scale, strength }
 * 4. Convert to Camelot notation
 * 5. Cache to disk
 *
 * Cache: `<projectDir>/assets/waveforms/<songId>.key.json`
 */
export class KeyDetector {
  private essentiaInstance: import('essentia.js').EssentiaInstance | null = null
  private essentiaLoading: Promise<void> | null = null

  constructor(private projectService: ProjectService) {}

  /**
   * Lazy-load the Essentia.js WASM module.
   */
  private async ensureEssentia(): Promise<
    import('essentia.js').EssentiaInstance
  > {
    if (this.essentiaInstance) return this.essentiaInstance

    if (!this.essentiaLoading) {
      this.essentiaLoading = (async () => {
        console.log('[KeyDetector] Loading Essentia.js WASM...')
        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
        const { EssentiaWASM, Essentia } = require('essentia.js')
        // EssentiaWASM is the already-resolved WASM module (not a factory)
        this.essentiaInstance = new Essentia(EssentiaWASM, false)
        console.log(
          `[KeyDetector] Essentia.js loaded, version: ${this.essentiaInstance!.version}`
        )
      })()
    }

    await this.essentiaLoading
    return this.essentiaInstance!
  }

  /**
   * Detect key for a single song. Returns cached data if available.
   */
  async detect(songId: string, filePath: string): Promise<KeyData> {
    const fileHash = await this.computeFileHash(filePath)
    const cachePath = this.getCachePath(songId)

    // Check disk cache
    const cached = await this.readCache(cachePath, fileHash)
    if (cached) {
      console.log(`[KeyDetector] Cache hit for ${songId}`)
      return cached
    }

    console.log(`[KeyDetector] Detecting key for ${songId}`)
    const keyData = await this.analyzeKey(songId, filePath, fileHash)

    // Write to disk cache
    await this.writeCache(cachePath, keyData)

    return keyData
  }

  /**
   * Detect key for a single song within a project, persist to song record.
   * Forces re-detection by clearing the cache first.
   */
  async detectSong(projectId: string, songId: string): Promise<KeyData> {
    const project = this.projectService.getActiveProject()
    if (!project || project.id !== projectId) {
      throw new Error(`Project ${projectId} is not active`)
    }

    const song = project.songs.find((s) => s.id === songId)
    if (!song) throw new Error(`Song ${songId} not found`)

    const filePath = this.resolveSongPath(song, project.projectDirectory)
    if (!filePath) throw new Error(`No file path for song ${songId}`)

    // Clear cache to force re-detection
    const cachePath = this.getCachePath(songId)
    await fs.remove(cachePath)

    const data = await this.detect(songId, filePath)

    // Persist to song record
    if (data.confidence >= MIN_CONFIDENCE) {
      await this.projectService.updateSong(projectId, songId, {
        musicalKey: data.key,
        musicalKeyConfidence: data.confidence,
      })
    }

    return data
  }

  /**
   * Detect key for all songs in the active project.
   * Emits KEY_PROGRESS per track for UI feedback.
   */
  async detectBatch(projectId: string): Promise<KeyData[]> {
    const project = this.projectService.getActiveProject()
    if (!project || project.id !== projectId) {
      throw new Error(`Project ${projectId} is not active`)
    }

    const songs = project.songs
    const results: KeyData[] = []

    for (let i = 0; i < songs.length; i++) {
      const song = songs[i]
      const filePath = this.resolveSongPath(song, project.projectDirectory)
      if (!filePath) {
        console.warn(`[KeyDetector] No file path for song ${song.id}, skipping`)
        continue
      }

      this.broadcastProgress({ songId: song.id, index: i, total: songs.length })

      try {
        const data = await this.detect(song.id, filePath)
        results.push(data)

        // Persist key to song record
        if (data.confidence >= MIN_CONFIDENCE) {
          await this.projectService.updateSong(projectId, song.id, {
            musicalKey: data.key,
            musicalKeyConfidence: data.confidence,
          })
        }

        // Broadcast progress with detected key
        this.broadcastProgress({
          songId: song.id,
          index: i,
          total: songs.length,
          key: data.key || undefined,
        })
      } catch (error) {
        console.error(
          `[KeyDetector] Failed to detect key for ${song.id}:`,
          error
        )
      }
    }

    return results
  }

  /**
   * Full key analysis pipeline: extract PCM → Essentia KeyExtractor → Camelot.
   */
  private async analyzeKey(
    songId: string,
    filePath: string,
    fileHash: string
  ): Promise<KeyData> {
    const essentia = await this.ensureEssentia()

    const pcmBuffer = await this.extractPcm(filePath)
    const samples = new Float32Array(
      pcmBuffer.buffer,
      pcmBuffer.byteOffset,
      pcmBuffer.byteLength / 4
    )

    // Short track guard (need at least 5 seconds)
    if (samples.length < ANALYSIS_SAMPLE_RATE * 5) {
      console.warn(`[KeyDetector] Track too short for key detection: ${songId}`)
      return { songId, key: '', originalKey: '', confidence: 0, fileHash }
    }

    try {
      // Convert Float32Array to Essentia vector
      const audioVector = essentia.arrayToVector(samples)

      // Run KeyExtractor
      const result = essentia.KeyExtractor(
        audioVector,
        true, // averageDetuningCorrection
        4096, // frameSize
        4096, // hopSize
        12, // hpcpSize
        3500, // maxFrequency
        60, // maximumSpectralPeaks
        25, // minFrequency
        0.2, // pcpThreshold
        'bgate', // profileType (Noland & Sandler "Bgate" profile)
        ANALYSIS_SAMPLE_RATE
      )

      const originalKey = `${result.key} ${result.scale}` // e.g. "C major"
      const camelot = toCamelot(originalKey) ?? ''
      const confidence = result.strength

      console.log(
        `[KeyDetector] ${songId}: ${originalKey} → ${camelot} (confidence: ${confidence.toFixed(2)})`
      )

      return {
        songId,
        key: confidence >= MIN_CONFIDENCE ? camelot : '',
        originalKey: confidence >= MIN_CONFIDENCE ? originalKey : '',
        confidence,
        fileHash,
      }
    } catch (error) {
      console.error(
        `[KeyDetector] Essentia KeyExtractor failed for ${songId}:`,
        error
      )
      return { songId, key: '', originalKey: '', confidence: 0, fileHash }
    }
  }

  /**
   * Extract PCM at 44.1kHz mono via FFmpeg.
   */
  private extractPcm(filePath: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const ffmpegPath = getFfmpegPath()
      const args = [
        '-i',
        filePath,
        '-ac',
        '1',
        '-ar',
        String(ANALYSIS_SAMPLE_RATE),
        '-f',
        'f32le',
        'pipe:1',
      ]

      const proc = spawn(ffmpegPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      const chunks: Buffer[] = []
      const stderrChunks: Buffer[] = []

      proc.stdout!.on('data', (chunk: Buffer) => chunks.push(chunk))
      proc.stderr!.on('data', (chunk: Buffer) => stderrChunks.push(chunk))

      proc.on('error', (err) => {
        reject(new Error(`FFmpeg spawn error: ${err.message}`))
      })

      proc.on('close', (code) => {
        if (code !== 0) {
          const stderr = Buffer.concat(stderrChunks).toString().slice(-500)
          reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`))
          return
        }
        resolve(Buffer.concat(chunks))
      })
    })
  }

  /** Compute file hash from size + mtime for cache invalidation. */
  private async computeFileHash(filePath: string): Promise<string> {
    const stat = await fs.stat(filePath)
    return `${stat.size}-${stat.mtimeMs}`
  }

  private getCachePath(songId: string): string {
    const project = this.projectService.getActiveProject()
    if (!project) throw new Error('No active project')
    return path.join(
      project.projectDirectory,
      'assets',
      'waveforms',
      `${songId}.key.json`
    )
  }

  private async readCache(
    cachePath: string,
    expectedHash: string
  ): Promise<KeyData | null> {
    try {
      if (!(await fs.pathExists(cachePath))) return null
      const data: KeyData = await fs.readJson(cachePath)
      if (data.fileHash !== expectedHash) return null
      return data
    } catch {
      return null
    }
  }

  private async writeCache(cachePath: string, data: KeyData): Promise<void> {
    await fs.ensureDir(path.dirname(cachePath))
    await fs.writeJson(cachePath, data)
  }

  private resolveSongPath(
    song: { id?: string; localFilePath?: string; externalFilePath?: string },
    projectDir: string
  ): string | null {
    if (song.localFilePath) {
      return path.isAbsolute(song.localFilePath)
        ? song.localFilePath
        : path.join(projectDir, song.localFilePath)
    }
    if (song.externalFilePath) return song.externalFilePath
    return null
  }

  private broadcastProgress(progress: KeyProgressEvent): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.KEY_PROGRESS, progress)
      }
    }
  }

  cleanup(): void {
    if (this.essentiaInstance) {
      try {
        this.essentiaInstance.shutdown()
        this.essentiaInstance.delete()
      } catch {
        // Ignore shutdown errors
      }
      this.essentiaInstance = null
      this.essentiaLoading = null
    }
  }
}
