import * as path from 'path'
import * as fs from 'fs-extra'
import { BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import { getFfmpegPath } from '../../utils/ffmpegPath'
import { IPC_CHANNELS } from '@shared/constants'
import type { WaveformData, WaveformProgressEvent } from '@shared/types/waveform.types'
import type { ProjectService } from '../ProjectService'

/** Number of peaks in the downsampled waveform */
const PEAK_COUNT = 2000

/** Sample rate for waveform extraction (low = fast, sufficient for visual) */
const EXTRACT_SAMPLE_RATE = 8000

/**
 * Extracts audio waveform peaks via FFmpeg and caches them to disk.
 *
 * FFmpeg command: `ffmpeg -i <file> -ac 1 -ar 8000 -f f32le pipe:1`
 * Produces mono float32 PCM at 8kHz, piped to stdout.
 * The raw PCM is downsampled to ~2000 peaks, normalized 0–1.
 *
 * Cache: `<projectDir>/assets/waveforms/<songId>.json`
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
    const cachePath = this.getCachePath(songId)

    // Check disk cache
    const cached = await this.readCache(cachePath, fileHash)
    if (cached) {
      console.log(`[WaveformExtractor] Cache hit for ${songId}`)
      return cached
    }

    console.log(`[WaveformExtractor] Extracting peaks for ${songId}`)
    const waveformData = await this.extractPeaks(songId, filePath, fileHash)

    // Write to disk cache
    await this.writeCache(cachePath, waveformData)

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
        console.warn(`[WaveformExtractor] No file path for song ${song.id}, skipping`)
        continue
      }

      this.broadcastProgress({ songId: song.id, index: i, total: songs.length })

      try {
        const data = await this.generate(song.id, filePath)
        results.push(data)
      } catch (error) {
        console.error(`[WaveformExtractor] Failed to extract ${song.id}:`, error)
      }
    }

    return results
  }

  /**
   * Extract peaks from an audio file via FFmpeg.
   */
  async extractPeaks(songId: string, filePath: string, fileHash: string): Promise<WaveformData> {
    const pcmBuffer = await this.extractPcm(filePath)
    const rawSamples = new Float32Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.byteLength / 4)
    const peaks = this.downsamplePeaks(rawSamples)
    const duration = rawSamples.length / EXTRACT_SAMPLE_RATE

    return {
      songId,
      peaks,
      duration,
      sampleRate: EXTRACT_SAMPLE_RATE,
      fileHash,
    }
  }

  /**
   * Run FFmpeg to extract mono float32 PCM at 8kHz.
   */
  private extractPcm(filePath: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const ffmpegPath = getFfmpegPath()
      const args = [
        '-i', filePath,
        '-ac', '1',
        '-ar', String(EXTRACT_SAMPLE_RATE),
        '-f', 'f32le',
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
   * Downsample raw PCM float32 samples to PEAK_COUNT peaks.
   * Each peak is the max absolute value in its window, normalized 0–1.
   */
  downsamplePeaks(samples: Float32Array): number[] {
    if (samples.length === 0) return []

    const windowSize = Math.max(1, Math.floor(samples.length / PEAK_COUNT))
    const peakCount = Math.min(PEAK_COUNT, Math.ceil(samples.length / windowSize))
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
   * Get the cache file path for a song's waveform data.
   */
  private getCachePath(songId: string): string {
    const project = this.projectService.getActiveProject()
    if (!project) throw new Error('No active project')
    return path.join(project.projectDirectory, 'assets', 'waveforms', `${songId}.json`)
  }

  /**
   * Read cached waveform data from disk. Returns null on miss or hash mismatch.
   */
  private async readCache(cachePath: string, expectedHash: string): Promise<WaveformData | null> {
    try {
      if (!await fs.pathExists(cachePath)) return null
      const data: WaveformData = await fs.readJson(cachePath)
      if (data.fileHash !== expectedHash) return null
      return data
    } catch {
      return null
    }
  }

  /**
   * Write waveform data to disk cache, creating directories as needed.
   */
  private async writeCache(cachePath: string, data: WaveformData): Promise<void> {
    await fs.ensureDir(path.dirname(cachePath))
    await fs.writeJson(cachePath, data)
  }

  /**
   * Resolve the absolute file path for a song.
   */
  private resolveSongPath(song: { localFilePath?: string; externalFilePath?: string }, projectDir: string): string | null {
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

  cleanup(): void {
    // No active processes to kill in current implementation
    // Future: cancel in-flight batch operations
  }
}
