import * as path from 'path'
import * as fs from 'fs-extra'
import { BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import { getFfmpegPath } from '../../utils/ffmpegPath'
import { IPC_CHANNELS } from '@shared/constants'
import type { BpmData, BpmProgressEvent } from '@shared/types/waveform.types'
import type { ProjectService } from '../ProjectService'

/** Sample rate for BPM analysis — higher than waveform for accuracy */
const ANALYSIS_SAMPLE_RATE = 44100

/** Frame size for onset strength computation (in samples) */
const FRAME_SIZE = 1024

/** Hop size between frames (50% overlap) */
const HOP_SIZE = 512

/** BPM search range */
const MIN_BPM = 60
const MAX_BPM = 200

/** Minimum confidence to consider a valid detection */
const MIN_CONFIDENCE = 0.3

/**
 * Detects BPM and first-beat offset per track via onset detection + autocorrelation.
 *
 * Algorithm (Option B — no new dependencies):
 * 1. Extract PCM at 44.1kHz mono via FFmpeg
 * 2. Compute onset strength function (energy envelope with windowed frames)
 * 3. Autocorrelation on onset function → find dominant period → BPM
 * 4. Find first beat via onset peaks → firstBeatOffset
 * 5. Confidence = strength of autocorrelation peak relative to noise floor
 *
 * Cache: `<projectDir>/assets/waveforms/<songId>.bpm.json`
 */
export class BpmDetector {
  constructor(private projectService: ProjectService) {}

  /**
   * Detect BPM for a single song. Returns cached data if available.
   */
  async detect(songId: string, filePath: string): Promise<BpmData> {
    const fileHash = await this.computeFileHash(filePath)
    const cachePath = this.getCachePath(songId)

    // Check disk cache
    const cached = await this.readCache(cachePath, fileHash)
    if (cached) {
      console.log(`[BpmDetector] Cache hit for ${songId}`)
      return cached
    }

    console.log(`[BpmDetector] Detecting BPM for ${songId}`)
    const bpmData = await this.analyzeBpm(songId, filePath, fileHash)

    // Write to disk cache
    await this.writeCache(cachePath, bpmData)

    return bpmData
  }

  /**
   * Detect BPM for all songs in the active project.
   * Emits BPM_PROGRESS per track for UI feedback.
   */
  async detectBatch(projectId: string): Promise<BpmData[]> {
    const project = this.projectService.getActiveProject()
    if (!project || project.id !== projectId) {
      throw new Error(`Project ${projectId} is not active`)
    }

    const songs = project.songs
    const results: BpmData[] = []

    for (let i = 0; i < songs.length; i++) {
      const song = songs[i]
      const filePath = this.resolveSongPath(song, project.projectDirectory)
      if (!filePath) {
        console.warn(`[BpmDetector] No file path for song ${song.id}, skipping`)
        continue
      }

      this.broadcastProgress({ songId: song.id, index: i, total: songs.length })

      try {
        const data = await this.detect(song.id, filePath)
        results.push(data)
      } catch (error) {
        console.error(`[BpmDetector] Failed to detect BPM for ${song.id}:`, error)
      }
    }

    return results
  }

  /**
   * Full BPM analysis pipeline: extract PCM → onset strength → autocorrelation → first beat.
   */
  async analyzeBpm(songId: string, filePath: string, fileHash: string): Promise<BpmData> {
    const pcmBuffer = await this.extractPcm(filePath)
    const samples = new Float32Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.byteLength / 4)

    // Short track guard
    if (samples.length < ANALYSIS_SAMPLE_RATE * 5) {
      console.warn(`[BpmDetector] Track too short for reliable BPM detection: ${songId}`)
      return { songId, bpm: 0, firstBeatOffset: 0, confidence: 0, fileHash }
    }

    const onsets = this.computeOnsetStrength(samples)
    const { bpm, confidence } = this.autocorrelate(onsets)
    const firstBeatOffset = confidence >= MIN_CONFIDENCE
      ? this.findFirstBeat(onsets, bpm)
      : 0

    return {
      songId,
      bpm: confidence >= MIN_CONFIDENCE ? bpm : 0,
      firstBeatOffset,
      confidence,
      fileHash,
    }
  }

  /**
   * Extract PCM at 44.1kHz mono via FFmpeg.
   */
  private extractPcm(filePath: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const ffmpegPath = getFfmpegPath()
      const args = [
        '-i', filePath,
        '-ac', '1',
        '-ar', String(ANALYSIS_SAMPLE_RATE),
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
   * Compute onset strength function using energy envelope.
   * Returns an array of onset strengths, one per frame hop.
   */
  computeOnsetStrength(samples: Float32Array): number[] {
    const numFrames = Math.floor((samples.length - FRAME_SIZE) / HOP_SIZE) + 1
    if (numFrames <= 1) return []

    // Compute energy per frame
    const energies: number[] = new Array(numFrames)
    for (let i = 0; i < numFrames; i++) {
      const start = i * HOP_SIZE
      let energy = 0
      for (let j = start; j < start + FRAME_SIZE && j < samples.length; j++) {
        energy += samples[j] * samples[j]
      }
      energies[i] = energy / FRAME_SIZE
    }

    // Onset = positive energy difference (half-wave rectification)
    const onsets: number[] = new Array(numFrames)
    onsets[0] = 0
    for (let i = 1; i < numFrames; i++) {
      const diff = energies[i] - energies[i - 1]
      onsets[i] = diff > 0 ? diff : 0
    }

    return onsets
  }

  /**
   * Autocorrelation on onset function to find the dominant period (BPM).
   * Returns BPM and confidence (0–1).
   */
  autocorrelate(onsets: number[]): { bpm: number; confidence: number } {
    if (onsets.length < 2) {
      return { bpm: 0, confidence: 0 }
    }

    // Convert BPM range to lag range (in frames)
    const framesPerSecond = ANALYSIS_SAMPLE_RATE / HOP_SIZE
    const minLag = Math.floor((60 / MAX_BPM) * framesPerSecond)
    const maxLag = Math.ceil((60 / MIN_BPM) * framesPerSecond)
    const safeLag = Math.min(maxLag, Math.floor(onsets.length / 2))

    if (minLag >= safeLag) {
      return { bpm: 0, confidence: 0 }
    }

    // Compute autocorrelation for each candidate lag
    let bestLag = minLag
    let bestCorr = -Infinity
    let totalCorr = 0
    let count = 0

    for (let lag = minLag; lag <= safeLag; lag++) {
      let corr = 0
      const n = onsets.length - lag
      for (let i = 0; i < n; i++) {
        corr += onsets[i] * onsets[i + lag]
      }
      corr /= n

      totalCorr += corr
      count++

      if (corr > bestCorr) {
        bestCorr = corr
        bestLag = lag
      }
    }

    const meanCorr = count > 0 ? totalCorr / count : 0
    const confidence = meanCorr > 0 ? Math.min(1, bestCorr / (meanCorr * 3)) : 0

    const bpm = Math.round((60 * framesPerSecond) / bestLag)

    return { bpm, confidence }
  }

  /**
   * Find the offset (in seconds) to the first strong beat.
   * Scans onset peaks near the beginning of the track.
   */
  findFirstBeat(onsets: number[], bpm: number): number {
    if (onsets.length === 0 || bpm <= 0) return 0

    const framesPerSecond = ANALYSIS_SAMPLE_RATE / HOP_SIZE
    const beatPeriodFrames = (60 / bpm) * framesPerSecond

    // Search within the first 2 beat periods for the strongest onset
    const searchEnd = Math.min(Math.ceil(beatPeriodFrames * 2), onsets.length)

    let maxOnset = 0
    let maxIdx = 0

    for (let i = 0; i < searchEnd; i++) {
      if (onsets[i] > maxOnset) {
        maxOnset = onsets[i]
        maxIdx = i
      }
    }

    return maxIdx / framesPerSecond
  }

  /** Compute file hash from size + mtime for cache invalidation. */
  async computeFileHash(filePath: string): Promise<string> {
    const stat = await fs.stat(filePath)
    return `${stat.size}-${stat.mtimeMs}`
  }

  private getCachePath(songId: string): string {
    const project = this.projectService.getActiveProject()
    if (!project) throw new Error('No active project')
    return path.join(project.projectDirectory, 'assets', 'waveforms', `${songId}.bpm.json`)
  }

  private async readCache(cachePath: string, expectedHash: string): Promise<BpmData | null> {
    try {
      if (!await fs.pathExists(cachePath)) return null
      const data: BpmData = await fs.readJson(cachePath)
      if (data.fileHash !== expectedHash) return null
      return data
    } catch {
      return null
    }
  }

  private async writeCache(cachePath: string, data: BpmData): Promise<void> {
    await fs.ensureDir(path.dirname(cachePath))
    await fs.writeJson(cachePath, data)
  }

  private resolveSongPath(song: { localFilePath?: string; externalFilePath?: string }, projectDir: string): string | null {
    if (song.localFilePath) {
      return path.isAbsolute(song.localFilePath)
        ? song.localFilePath
        : path.join(projectDir, song.localFilePath)
    }
    return song.externalFilePath ?? null
  }

  private broadcastProgress(progress: BpmProgressEvent): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.BPM_PROGRESS, progress)
      }
    }
  }

  cleanup(): void {
    // Future: cancel in-flight batch operations
  }
}
