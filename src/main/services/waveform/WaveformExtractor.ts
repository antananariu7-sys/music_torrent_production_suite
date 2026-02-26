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
import { WaveformCache } from './WaveformCache'

/** Number of peaks in the downsampled waveform (high-res for zoom-adaptive LOD) */
const PEAK_COUNT = 8000

/** Sample rate for waveform extraction (16kHz for high-res peaks and high-band fidelity) */
const EXTRACT_SAMPLE_RATE = 16000

/** Sample rate for frequency band extraction (needs >8kHz for high band) */
const FREQ_SAMPLE_RATE = 16000

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
  private cache: WaveformCache

  constructor(private projectService: ProjectService) {
    this.cache = new WaveformCache(projectService)
  }

  /**
   * Generate waveform data for a single song.
   * Returns cached data if available and file hasn't changed.
   */
  async generate(songId: string, filePath: string): Promise<WaveformData> {
    const fileHash = await this.computeFileHash(filePath)
    const cacheBase = this.cache.getCacheBasePath(songId)

    // Check disk cache (invalidate if missing frequency data or low-res peaks)
    const cached = await this.cache.readCache(cacheBase, fileHash)
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
    await this.cache.writeCache(cacheBase, waveformData)

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
    return this.cache.invalidateAllCaches()
  }

  cleanup(): void {
    // No active processes to kill in current implementation
    // Future: cancel in-flight batch operations
  }
}
