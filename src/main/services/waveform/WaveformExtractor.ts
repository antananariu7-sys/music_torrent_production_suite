import * as path from 'path'
import * as fs from 'fs-extra'
import { BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import { getFfmpegPath } from '../../utils/ffmpegPath'
import { IPC_CHANNELS } from '@shared/constants'
import type {
  WaveformData,
  WaveformProgressEvent,
} from '@shared/types/waveform.types'
import type { ProjectService } from '../ProjectService'

/** Number of peaks in the downsampled waveform (high-res for zoom-adaptive LOD) */
const PEAK_COUNT = 8000

/** Sample rate for waveform extraction (16kHz for high-res peaks and high-band fidelity) */
const EXTRACT_SAMPLE_RATE = 16000

/** Sample rate for frequency band extraction (needs >8kHz for high band) */
const FREQ_SAMPLE_RATE = 16000

/**
 * Binary .peaks file format:
 * [0-3]   Magic: 0x50454B53 ("PEKS")
 * [4-7]   Version: uint32 = 1
 * [8-11]  Peak count (N): uint32
 * [12-15] Flags: uint32 (bit 0 = hasBands)
 * [16..]  Float32Array: peaks[N], then if hasBands: peaksLow[N], peaksMid[N], peaksHigh[N]
 */
const PEAKS_MAGIC = 0x50454b53
const PEAKS_VERSION = 1
const PEAKS_HEADER_SIZE = 16

/**
 * Extracts audio waveform peaks via FFmpeg and caches them to disk.
 *
 * FFmpeg command: `ffmpeg -i <file> -ac 1 -ar 8000 -f f32le pipe:1`
 * Produces mono float32 PCM at 8kHz, piped to stdout.
 * The raw PCM is downsampled to ~2000 peaks, normalized 0–1.
 *
 * Cache: `<projectDir>/assets/waveforms/<songId>.peaks` + `.meta.json` (binary)
 * Falls back to legacy `<songId>.json` for migration.
 * Cache key: `"${stat.size}-${stat.mtimeMs}"` — recomputes if file changes.
 */
export class WaveformExtractor {
  constructor(private projectService: ProjectService) {}

  /**
   * Generate waveform data for a single song.
   * Returns cached data if available and file hasn't changed.
   */
  async generate(songId: string, filePath: string): Promise<WaveformData> {
    const fileHash = await this.computeFileHash(filePath)
    const cacheBase = this.getCacheBasePath(songId)

    // Check disk cache (invalidate if missing frequency data or low-res peaks)
    const cached = await this.readCache(cacheBase, fileHash)
    if (
      cached &&
      cached.peaksLow &&
      cached.peaksMid &&
      cached.peaksHigh &&
      cached.peaks.length >= PEAK_COUNT
    ) {
      console.log(`[WaveformExtractor] Cache hit for ${songId}`)
      return cached
    }
    if (cached) {
      const reason =
        cached.peaks.length < PEAK_COUNT
          ? `low-res peaks (${cached.peaks.length}/${PEAK_COUNT})`
          : 'missing frequency data'
      console.log(
        `[WaveformExtractor] Cache ${reason} for ${songId}, re-extracting`
      )
    }

    console.log(`[WaveformExtractor] Extracting peaks for ${songId}`)
    const waveformData = await this.extractPeaks(songId, filePath, fileHash)

    // Write to disk cache (binary format)
    await this.writeCache(cacheBase, waveformData)

    return waveformData
  }

  /**
   * Generate waveform data for all songs in the active project.
   * Emits WAVEFORM_PROGRESS per track for UI feedback.
   */
  async generateBatch(projectId: string): Promise<WaveformData[]> {
    const project = this.projectService.getActiveProject()
    if (!project || project.id !== projectId) {
      throw new Error(`Project ${projectId} is not active`)
    }

    const songs = project.songs
    const results: WaveformData[] = []

    for (let i = 0; i < songs.length; i++) {
      const song = songs[i]
      const filePath = this.resolveSongPath(song, project.projectDirectory)
      if (!filePath) {
        console.warn(
          `[WaveformExtractor] No file path for song ${song.id}, skipping`
        )
        continue
      }

      this.broadcastProgress({ songId: song.id, index: i, total: songs.length })

      try {
        const data = await this.generate(song.id, filePath)
        results.push(data)
      } catch (error) {
        console.error(
          `[WaveformExtractor] Failed to extract ${song.id}:`,
          error
        )
      }
    }

    return results
  }

  /**
   * Extract peaks from an audio file via FFmpeg.
   * Also extracts 3-band frequency peaks for coloring (optional, non-blocking).
   */
  async extractPeaks(
    songId: string,
    filePath: string,
    fileHash: string
  ): Promise<WaveformData> {
    const pcmBuffer = await this.extractPcm(filePath)
    const rawSamples = new Float32Array(
      pcmBuffer.buffer,
      pcmBuffer.byteOffset,
      pcmBuffer.byteLength / 4
    )
    const peaks = this.downsamplePeaks(rawSamples)
    const duration = rawSamples.length / EXTRACT_SAMPLE_RATE

    const result: WaveformData = {
      songId,
      peaks,
      duration,
      sampleRate: EXTRACT_SAMPLE_RATE,
      fileHash,
    }

    // Extract frequency bands (optional — don't block waveform on failure)
    try {
      const bands = await this.extractFrequencyBands(filePath)
      result.peaksLow = this.downsamplePeaks(bands.low)
      result.peaksMid = this.downsamplePeaks(bands.mid)
      result.peaksHigh = this.downsamplePeaks(bands.high)
    } catch (error) {
      console.warn(
        `[WaveformExtractor] Frequency band extraction failed for ${songId}, using single-color mode:`,
        error
      )
    }

    return result
  }

  /**
   * Run FFmpeg to extract mono float32 PCM at 8kHz.
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
        String(EXTRACT_SAMPLE_RATE),
        '-f',
        'f32le',
        'pipe:1',
      ]

      const proc = spawn(ffmpegPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      const chunks: Buffer[] = []

      proc.stdout!.on('data', (chunk: Buffer) => {
        chunks.push(chunk)
      })

      proc.on('error', (err) => {
        reject(new Error(`FFmpeg spawn error: ${err.message}`))
      })

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`FFmpeg exited with code ${code}`))
          return
        }
        resolve(Buffer.concat(chunks))
      })
    })
  }

  /**
   * Run FFmpeg with filter_complex to extract 3 frequency bands (low/mid/high).
   * Outputs a 3-channel interleaved float32 stream: [low, mid, high] per sample.
   */
  private extractFrequencyBands(
    filePath: string
  ): Promise<{ low: Float32Array; mid: Float32Array; high: Float32Array }> {
    return new Promise((resolve, reject) => {
      const ffmpegPath = getFfmpegPath()
      const args = [
        '-i',
        filePath,
        '-filter_complex',
        '[0:a]lowpass=f=250[low];[0:a]bandpass=f=1000:width_type=o:w=2[mid];[0:a]highpass=f=4000[high];[low][mid][high]amerge=inputs=3',
        '-ar',
        String(FREQ_SAMPLE_RATE),
        '-f',
        'f32le',
        'pipe:1',
      ]

      const proc = spawn(ffmpegPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      const chunks: Buffer[] = []

      proc.stdout!.on('data', (chunk: Buffer) => {
        chunks.push(chunk)
      })

      proc.on('error', (err) => {
        reject(
          new Error(`FFmpeg frequency extraction spawn error: ${err.message}`)
        )
      })

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(
            new Error(`FFmpeg frequency extraction exited with code ${code}`)
          )
          return
        }

        const buffer = Buffer.concat(chunks)
        const interleaved = new Float32Array(
          buffer.buffer,
          buffer.byteOffset,
          buffer.byteLength / 4
        )
        const sampleCount = Math.floor(interleaved.length / 3)

        const low = new Float32Array(sampleCount)
        const mid = new Float32Array(sampleCount)
        const high = new Float32Array(sampleCount)

        for (let i = 0; i < sampleCount; i++) {
          low[i] = interleaved[i * 3]
          mid[i] = interleaved[i * 3 + 1]
          high[i] = interleaved[i * 3 + 2]
        }

        resolve({ low, mid, high })
      })
    })
  }

  /**
   * Downsample raw PCM float32 samples to PEAK_COUNT peaks.
   * Each peak is the max absolute value in its window, normalized 0–1.
   */
  downsamplePeaks(samples: Float32Array): number[] {
    if (samples.length === 0) return []

    const windowSize = Math.max(1, Math.floor(samples.length / PEAK_COUNT))
    const peakCount = Math.min(
      PEAK_COUNT,
      Math.ceil(samples.length / windowSize)
    )
    const peaks: number[] = new Array(peakCount)

    let globalMax = 0

    for (let i = 0; i < peakCount; i++) {
      const start = i * windowSize
      const end = Math.min(start + windowSize, samples.length)
      let max = 0
      for (let j = start; j < end; j++) {
        const abs = Math.abs(samples[j])
        if (abs > max) max = abs
      }
      peaks[i] = max
      if (max > globalMax) globalMax = max
    }

    // Normalize 0–1
    if (globalMax > 0) {
      for (let i = 0; i < peaks.length; i++) {
        peaks[i] = peaks[i] / globalMax
      }
    }

    return peaks
  }

  /**
   * Compute file hash from size + mtime for cache invalidation.
   */
  async computeFileHash(filePath: string): Promise<string> {
    const stat = await fs.stat(filePath)
    return `${stat.size}-${stat.mtimeMs}`
  }

  /**
   * Get the cache base path (without extension) for a song's waveform data.
   */
  private getCacheBasePath(songId: string): string {
    const project = this.projectService.getActiveProject()
    if (!project) throw new Error('No active project')
    return path.join(project.projectDirectory, 'assets', 'waveforms', songId)
  }

  /**
   * Read cached waveform data from disk.
   * Tries binary .peaks + .meta.json first, falls back to legacy .json.
   */
  private async readCache(
    basePath: string,
    expectedHash: string
  ): Promise<WaveformData | null> {
    // Try binary format first
    const binaryResult = await this.readBinaryCache(basePath, expectedHash)
    if (binaryResult) return binaryResult

    // Fall back to legacy JSON
    try {
      const jsonPath = `${basePath}.json`
      if (!(await fs.pathExists(jsonPath))) return null
      const data: WaveformData = await fs.readJson(jsonPath)
      if (data.fileHash !== expectedHash) return null
      return data
    } catch {
      return null
    }
  }

  /**
   * Read binary .peaks + .meta.json cache.
   */
  private async readBinaryCache(
    basePath: string,
    expectedHash: string
  ): Promise<WaveformData | null> {
    try {
      const peaksPath = `${basePath}.peaks`
      const metaPath = `${basePath}.meta.json`
      if (!(await fs.pathExists(peaksPath)) || !(await fs.pathExists(metaPath)))
        return null

      const meta = await fs.readJson(metaPath)
      if (meta.fileHash !== expectedHash) return null

      const buf = await fs.readFile(peaksPath)

      // Validate header
      if (buf.length < PEAKS_HEADER_SIZE) return null
      const magic = buf.readUInt32LE(0)
      if (magic !== PEAKS_MAGIC) return null
      const version = buf.readUInt32LE(4)
      if (version !== PEAKS_VERSION) return null

      const peakCount = buf.readUInt32LE(8)
      const flags = buf.readUInt32LE(12)
      const hasBands = (flags & 1) !== 0
      const arrayCount = hasBands ? 4 : 1
      const expectedSize = PEAKS_HEADER_SIZE + peakCount * 4 * arrayCount
      if (buf.length < expectedSize) return null

      // Read peaks arrays
      const offset = PEAKS_HEADER_SIZE
      const peaks = Array.from(
        new Float32Array(buf.buffer, buf.byteOffset + offset, peakCount)
      )

      const result: WaveformData = {
        songId: meta.songId,
        peaks,
        duration: meta.duration,
        sampleRate: meta.sampleRate,
        fileHash: meta.fileHash,
      }

      if (hasBands) {
        result.peaksLow = Array.from(
          new Float32Array(
            buf.buffer,
            buf.byteOffset + offset + peakCount * 4,
            peakCount
          )
        )
        result.peaksMid = Array.from(
          new Float32Array(
            buf.buffer,
            buf.byteOffset + offset + peakCount * 8,
            peakCount
          )
        )
        result.peaksHigh = Array.from(
          new Float32Array(
            buf.buffer,
            buf.byteOffset + offset + peakCount * 12,
            peakCount
          )
        )
      }

      return result
    } catch {
      return null
    }
  }

  /**
   * Write waveform data to disk as binary .peaks + .meta.json.
   */
  private async writeCache(
    basePath: string,
    data: WaveformData
  ): Promise<void> {
    await fs.ensureDir(path.dirname(basePath))

    const peakCount = data.peaks.length
    const hasBands = !!(data.peaksLow && data.peaksMid && data.peaksHigh)
    const arrayCount = hasBands ? 4 : 1
    const bufSize = PEAKS_HEADER_SIZE + peakCount * 4 * arrayCount
    const buf = Buffer.alloc(bufSize)

    // Header
    buf.writeUInt32LE(PEAKS_MAGIC, 0)
    buf.writeUInt32LE(PEAKS_VERSION, 4)
    buf.writeUInt32LE(peakCount, 8)
    buf.writeUInt32LE(hasBands ? 1 : 0, 12)

    // Peaks data
    const floats = new Float32Array(
      buf.buffer,
      buf.byteOffset + PEAKS_HEADER_SIZE,
      peakCount * arrayCount
    )
    for (let i = 0; i < peakCount; i++) {
      floats[i] = data.peaks[i]
    }
    if (hasBands) {
      for (let i = 0; i < peakCount; i++) {
        floats[peakCount + i] = data.peaksLow![i]
        floats[peakCount * 2 + i] = data.peaksMid![i]
        floats[peakCount * 3 + i] = data.peaksHigh![i]
      }
    }

    // Write binary peaks
    await fs.writeFile(`${basePath}.peaks`, buf)

    // Write metadata JSON
    await fs.writeJson(`${basePath}.meta.json`, {
      songId: data.songId,
      duration: data.duration,
      sampleRate: data.sampleRate,
      fileHash: data.fileHash,
      peakCount,
      hasBands,
    })
  }

  /**
   * Resolve the absolute file path for a song.
   */
  private resolveSongPath(
    song: { localFilePath?: string; externalFilePath?: string },
    projectDir: string
  ): string | null {
    if (song.localFilePath) {
      return path.isAbsolute(song.localFilePath)
        ? song.localFilePath
        : path.join(projectDir, song.localFilePath)
    }
    return song.externalFilePath ?? null
  }

  /**
   * Broadcast progress event to all renderer windows.
   */
  private broadcastProgress(progress: WaveformProgressEvent): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.WAVEFORM_PROGRESS, progress)
      }
    }
  }

  /**
   * Delete all cached waveform files for the active project.
   */
  async invalidateAllCaches(): Promise<void> {
    const project = this.projectService.getActiveProject()
    if (!project) throw new Error('No active project')

    const waveformDir = path.join(
      project.projectDirectory,
      'assets',
      'waveforms'
    )
    if (await fs.pathExists(waveformDir)) {
      await fs.remove(waveformDir)
      console.log(
        `[WaveformExtractor] Deleted waveform cache dir: ${waveformDir}`
      )
    }
  }

  cleanup(): void {
    // No active processes to kill in current implementation
    // Future: cancel in-flight batch operations
  }
}
