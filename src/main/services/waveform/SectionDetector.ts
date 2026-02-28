import * as path from 'path'
import * as fs from 'fs-extra'
import { BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import { nanoid } from 'nanoid'
import { getFfmpegPath } from '../../utils/ffmpegPath'
import { IPC_CHANNELS } from '@shared/constants'
import type {
  TrackSection,
  SectionType,
  SectionData,
  SectionProgressEvent,
} from '@shared/types/sectionDetection.types'
import type { ProjectService } from '../ProjectService'

/** Sample rate for MFCC analysis (lower = faster, good enough for section detection) */
const ANALYSIS_SAMPLE_RATE = 22050

/** Frame size for MFCC extraction */
const FRAME_SIZE = 2048

/** Hop size between frames (~93ms at 22050 Hz) */
const HOP_SIZE = FRAME_SIZE

/** Number of MFCC coefficients to keep */
const NUM_MFCC = 13

/** Minimum section length in seconds */
const MIN_SECTION_LENGTH = 8

/** Checkerboard kernel half-width (in frames) */
const KERNEL_HALF_WIDTH = 16

/** Section type colors for UI (not used here, but documented for reference) */
// intro=#6366f1, buildup=#f59e0b, drop=#ef4444, breakdown=#8b5cf6, outro=#06b6d4

/**
 * Detects structural sections in tracks via MFCC-based novelty function.
 *
 * Pipeline:
 * 1. Extract PCM at 22.05kHz mono via FFmpeg
 * 2. Compute MFCC features per frame via Essentia.js WASM
 * 3. Build self-similarity matrix from MFCC frames
 * 4. Compute novelty curve via checkerboard kernel convolution
 * 5. Peak-pick novelty curve for section boundaries
 * 6. Classify sections by energy heuristics
 * 7. Snap boundaries to beat grid if BPM available
 *
 * Cache: `<projectDir>/assets/waveforms/<songId>.sections.json`
 */
export class SectionDetector {
  private essentiaInstance: import('essentia.js').EssentiaInstance | null = null
  private essentiaLoading: Promise<void> | null = null

  constructor(private projectService: ProjectService) {}

  private async ensureEssentia(): Promise<
    import('essentia.js').EssentiaInstance
  > {
    if (this.essentiaInstance) return this.essentiaInstance

    if (!this.essentiaLoading) {
      this.essentiaLoading = (async () => {
        console.log('[SectionDetector] Loading Essentia.js WASM...')
        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
        const { EssentiaWASM, Essentia } = require('essentia.js')
        this.essentiaInstance = new Essentia(EssentiaWASM, false)
        console.log('[SectionDetector] Essentia.js loaded')
      })()
    }

    await this.essentiaLoading
    return this.essentiaInstance!
  }

  /**
   * Detect sections for a single song within a project, persist to song record.
   */
  async detectSong(projectId: string, songId: string): Promise<SectionData> {
    const project = this.projectService.getActiveProject()
    if (!project || project.id !== projectId) {
      throw new Error(`Project ${projectId} is not active`)
    }

    const song = project.songs.find((s) => s.id === songId)
    if (!song) throw new Error(`Song ${songId} not found`)

    const filePath = this.resolveSongPath(song, project.projectDirectory)
    if (!filePath) throw new Error(`No file path for song ${songId}`)

    const data = await this.detect(songId, filePath, {
      bpm: song.bpm,
      firstBeatOffset: song.firstBeatOffset,
      duration: song.duration,
      energyProfile: song.energyProfile,
    })

    // Persist to song record
    await this.projectService.updateSong(projectId, songId, {
      sections: data.sections,
    })

    return data
  }

  /**
   * Detect sections for all songs in the active project.
   */
  async detectBatch(projectId: string): Promise<SectionData[]> {
    const project = this.projectService.getActiveProject()
    if (!project || project.id !== projectId) {
      throw new Error(`Project ${projectId} is not active`)
    }

    const songs = project.songs
    const results: SectionData[] = []

    for (let i = 0; i < songs.length; i++) {
      const song = songs[i]
      const filePath = this.resolveSongPath(song, project.projectDirectory)
      if (!filePath) {
        console.warn(
          `[SectionDetector] No file path for song ${song.id}, skipping`
        )
        continue
      }

      this.broadcastProgress({
        songId: song.id,
        index: i,
        total: songs.length,
      })

      try {
        const data = await this.detect(song.id, filePath, {
          bpm: song.bpm,
          firstBeatOffset: song.firstBeatOffset,
          duration: song.duration,
          energyProfile: song.energyProfile,
        })
        results.push(data)

        // Persist to song record
        await this.projectService.updateSong(projectId, song.id, {
          sections: data.sections,
        })

        this.broadcastProgress({
          songId: song.id,
          index: i + 1,
          total: songs.length,
        })
      } catch (error) {
        console.error(`[SectionDetector] Failed for ${song.id}:`, error)
      }
    }

    return results
  }

  /**
   * Low-level detection with disk caching.
   */
  private async detect(
    songId: string,
    filePath: string,
    options: {
      bpm?: number
      firstBeatOffset?: number
      duration?: number
      energyProfile?: number[]
    }
  ): Promise<SectionData> {
    const fileHash = await this.computeFileHash(filePath)
    const cachePath = this.getCachePath(songId)

    // Check disk cache
    const cached = await this.readCache(cachePath, fileHash)
    if (cached) {
      console.log(`[SectionDetector] Cache hit for ${songId}`)
      return cached
    }

    console.log(`[SectionDetector] Analyzing sections for ${songId}`)
    const sections = await this.analyzeSections(
      songId,
      filePath,
      fileHash,
      options
    )

    const data: SectionData = { songId, sections, fileHash }
    await this.writeCache(cachePath, data)
    return data
  }

  /**
   * Full section analysis pipeline.
   */
  private async analyzeSections(
    songId: string,
    filePath: string,
    _fileHash: string,
    options: {
      bpm?: number
      firstBeatOffset?: number
      duration?: number
      energyProfile?: number[]
    }
  ): Promise<TrackSection[]> {
    const essentia = await this.ensureEssentia()

    // 1. Extract PCM
    const pcmBuffer = await this.extractPcm(filePath)
    const samples = new Float32Array(
      pcmBuffer.buffer,
      pcmBuffer.byteOffset,
      pcmBuffer.byteLength / 4
    )

    const duration = options.duration ?? samples.length / ANALYSIS_SAMPLE_RATE

    // Short track guard (need at least 15 seconds)
    if (samples.length < ANALYSIS_SAMPLE_RATE * 15) {
      console.warn(
        `[SectionDetector] Track too short for section detection: ${songId}`
      )
      return [
        {
          id: nanoid(),
          type: 'custom',
          startTime: 0,
          endTime: duration,
          confidence: 0,
        },
      ]
    }

    // 2. Compute MFCC features per frame
    const mfccFrames = this.computeMfccFrames(essentia, samples)

    if (mfccFrames.length < KERNEL_HALF_WIDTH * 2 + 1) {
      return [
        {
          id: nanoid(),
          type: 'custom',
          startTime: 0,
          endTime: duration,
          confidence: 0,
        },
      ]
    }

    // 3. Compute novelty curve via checkerboard kernel
    const novelty = this.computeNoveltyCurve(mfccFrames)

    // 4. Peak-pick to find section boundaries
    const minPeakDistance = this.getMinPeakDistance(options.bpm)
    const boundaries = this.pickPeaks(novelty, minPeakDistance)

    // 5. Convert frame indices to time
    const secondsPerFrame = HOP_SIZE / ANALYSIS_SAMPLE_RATE
    let boundaryTimes = boundaries.map((b) => ({
      time: b.index * secondsPerFrame,
      prominence: b.prominence,
    }))

    // 6. Snap to beat grid if BPM available
    if (options.bpm && options.bpm > 0) {
      boundaryTimes = this.snapToBeatGrid(
        boundaryTimes,
        options.bpm,
        options.firstBeatOffset ?? 0
      )
    }

    // 7. Build sections from boundaries
    const sections = this.buildSections(
      boundaryTimes,
      duration,
      options.energyProfile
    )

    console.log(
      `[SectionDetector] ${songId}: detected ${sections.length} sections`
    )
    return sections
  }

  /**
   * Compute MFCC features per frame.
   */
  private computeMfccFrames(
    essentia: import('essentia.js').EssentiaInstance,
    samples: Float32Array
  ): number[][] {
    const frames: number[][] = []
    const numFrames = Math.floor((samples.length - FRAME_SIZE) / HOP_SIZE) + 1

    for (let i = 0; i < numFrames; i++) {
      const start = i * HOP_SIZE
      const frame = samples.slice(start, start + FRAME_SIZE)

      try {
        const frameVector = essentia.arrayToVector(frame)
        const windowed = essentia.Windowing(
          frameVector,
          true,
          FRAME_SIZE,
          'hann'
        )
        const spectrum = essentia.Spectrum(windowed.frame, FRAME_SIZE)
        const mfccResult = essentia.MFCC(
          spectrum.spectrum,
          2, // dctType
          ANALYSIS_SAMPLE_RATE / 2, // highFrequencyBound
          FRAME_SIZE / 2 + 1, // inputSize
          0, // liftering
          'dbamp', // logType
          0, // lowFrequencyBound
          'unit_max', // normalize
          40, // numberBands
          NUM_MFCC, // numberCoefficients
          ANALYSIS_SAMPLE_RATE // sampleRate
        )

        const mfccArray = essentia.vectorToArray(mfccResult.mfcc)
        frames.push(Array.from(mfccArray))
      } catch {
        // Skip frames that fail
      }
    }

    return frames
  }

  /**
   * Compute novelty curve using checkerboard kernel convolution
   * along the diagonal of the self-similarity matrix.
   */
  private computeNoveltyCurve(mfccFrames: number[][]): number[] {
    const n = mfccFrames.length
    const novelty = new Array<number>(n).fill(0)

    for (let i = KERNEL_HALF_WIDTH; i < n - KERNEL_HALF_WIDTH; i++) {
      // Checkerboard kernel: compare features before vs after this point
      let withinBefore = 0
      let withinAfter = 0
      let between = 0
      let count = 0

      for (let a = 0; a < KERNEL_HALF_WIDTH; a++) {
        for (let b = 0; b < KERNEL_HALF_WIDTH; b++) {
          const simBefore = this.cosineSimilarity(
            mfccFrames[i - KERNEL_HALF_WIDTH + a],
            mfccFrames[i - KERNEL_HALF_WIDTH + b]
          )
          const simAfter = this.cosineSimilarity(
            mfccFrames[i + a],
            mfccFrames[i + b]
          )
          const simCross = this.cosineSimilarity(
            mfccFrames[i - KERNEL_HALF_WIDTH + a],
            mfccFrames[i + b]
          )
          withinBefore += simBefore
          withinAfter += simAfter
          between += simCross
          count++
        }
      }

      // Novelty = within-cluster similarity minus between-cluster similarity
      if (count > 0) {
        novelty[i] = Math.max(
          0,
          (withinBefore + withinAfter) / (2 * count) - between / count
        )
      }
    }

    // Smooth the novelty curve with a 5-point moving average
    const smoothed = new Array<number>(n).fill(0)
    const halfSmooth = 2
    for (let i = halfSmooth; i < n - halfSmooth; i++) {
      let sum = 0
      for (let j = -halfSmooth; j <= halfSmooth; j++) {
        sum += novelty[i + j]
      }
      smoothed[i] = sum / (2 * halfSmooth + 1)
    }

    return smoothed
  }

  /**
   * Cosine similarity between two MFCC vectors.
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0
    let normA = 0
    let normB = 0
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB)
    return denom > 0 ? dot / denom : 0
  }

  /**
   * Minimum peak distance in frames, based on BPM or a default of 10 seconds.
   */
  private getMinPeakDistance(bpm?: number): number {
    const framesPerSecond = ANALYSIS_SAMPLE_RATE / HOP_SIZE
    if (bpm && bpm > 0) {
      // 8 bars of 4 beats
      const barLength = (4 * 60) / bpm
      return Math.floor(8 * barLength * framesPerSecond)
    }
    // Default: 10 seconds minimum between boundaries
    return Math.floor(10 * framesPerSecond)
  }

  /**
   * Pick peaks from novelty curve with minimum distance constraint.
   */
  private pickPeaks(
    novelty: number[],
    minDistance: number
  ): { index: number; prominence: number }[] {
    const n = novelty.length

    // Compute average novelty (excluding zeros at edges)
    let sum = 0
    let count = 0
    for (let i = KERNEL_HALF_WIDTH; i < n - KERNEL_HALF_WIDTH; i++) {
      sum += novelty[i]
      count++
    }
    const avgNovelty = count > 0 ? sum / count : 0
    const threshold = avgNovelty * 1.2 // Must be at least 20% above average

    // Find local maxima
    const candidates: { index: number; value: number }[] = []
    for (let i = 1; i < n - 1; i++) {
      if (
        novelty[i] > novelty[i - 1] &&
        novelty[i] >= novelty[i + 1] &&
        novelty[i] > threshold
      ) {
        candidates.push({ index: i, value: novelty[i] })
      }
    }

    // Sort by value descending for greedy selection
    candidates.sort((a, b) => b.value - a.value)

    // Greedy selection with minimum distance
    const selected: { index: number; prominence: number }[] = []
    const used = new Set<number>()

    for (const c of candidates) {
      let tooClose = false
      for (const s of selected) {
        if (Math.abs(c.index - s.index) < minDistance) {
          tooClose = true
          break
        }
      }
      if (!tooClose) {
        selected.push({
          index: c.index,
          prominence: avgNovelty > 0 ? c.value / avgNovelty : 1,
        })
        used.add(c.index)
      }
    }

    // Sort by time order
    selected.sort((a, b) => a.index - b.index)
    return selected
  }

  /**
   * Snap boundary times to the nearest beat grid position.
   */
  private snapToBeatGrid(
    boundaries: { time: number; prominence: number }[],
    bpm: number,
    firstBeatOffset: number
  ): { time: number; prominence: number }[] {
    const beatLength = 60 / bpm
    const barLength = beatLength * 4

    return boundaries.map((b) => {
      // Find nearest bar boundary
      const barsFromStart = (b.time - firstBeatOffset) / barLength
      const nearestBar = Math.round(barsFromStart)
      const snappedTime = firstBeatOffset + nearestBar * barLength

      // Only snap if within half a bar
      if (Math.abs(snappedTime - b.time) < barLength / 2) {
        return { time: Math.max(0, snappedTime), prominence: b.prominence }
      }
      return b
    })
  }

  /**
   * Build section objects from boundary times and classify by energy.
   */
  private buildSections(
    boundaries: { time: number; prominence: number }[],
    duration: number,
    energyProfile?: number[]
  ): TrackSection[] {
    // Create segment boundaries (include 0 and duration)
    const times = [
      0,
      ...boundaries.map((b) => b.time).filter((t) => t > 0 && t < duration),
      duration,
    ]

    // Remove duplicates and sort
    const uniqueTimes = [...new Set(times)].sort((a, b) => a - b)

    // Filter out tiny segments
    const filteredTimes: number[] = [uniqueTimes[0]]
    for (let i = 1; i < uniqueTimes.length; i++) {
      if (
        uniqueTimes[i] - filteredTimes[filteredTimes.length - 1] >=
        MIN_SECTION_LENGTH
      ) {
        filteredTimes.push(uniqueTimes[i])
      }
    }
    // Ensure we end at duration
    if (filteredTimes[filteredTimes.length - 1] !== duration) {
      filteredTimes.push(duration)
    }

    // Build sections
    const sections: TrackSection[] = []
    for (let i = 0; i < filteredTimes.length - 1; i++) {
      const startTime = filteredTimes[i]
      const endTime = filteredTimes[i + 1]

      // Get confidence from boundary prominence
      const boundary = boundaries.find((b) => Math.abs(b.time - startTime) < 1)
      const confidence = boundary ? Math.min(1, boundary.prominence / 3) : 0.5

      sections.push({
        id: nanoid(),
        type: 'custom',
        startTime,
        endTime,
        confidence,
      })
    }

    // Classify sections by energy heuristics
    this.classifySections(sections, duration, energyProfile)

    return sections
  }

  /**
   * Classify sections using energy heuristics.
   */
  private classifySections(
    sections: TrackSection[],
    duration: number,
    energyProfile?: number[]
  ): void {
    if (sections.length === 0) return

    // Compute mean energy per section
    const sectionEnergies: number[] = []
    if (energyProfile && energyProfile.length > 0) {
      for (const section of sections) {
        const startIdx = Math.floor(
          (section.startTime / duration) * energyProfile.length
        )
        const endIdx = Math.ceil(
          (section.endTime / duration) * energyProfile.length
        )
        let sum = 0
        let count = 0
        for (
          let i = Math.max(0, startIdx);
          i < Math.min(energyProfile.length, endIdx);
          i++
        ) {
          sum += energyProfile[i]
          count++
        }
        sectionEnergies.push(count > 0 ? sum / count : 0.5)
      }
    } else {
      // Fallback: assume uniform energy
      for (let i = 0; i < sections.length; i++) {
        sectionEnergies.push(0.5)
      }
    }

    // Find highest energy section → drop
    let maxEnergyIdx = 0
    let maxEnergy = 0
    for (let i = 0; i < sectionEnergies.length; i++) {
      if (sectionEnergies[i] > maxEnergy) {
        maxEnergy = sectionEnergies[i]
        maxEnergyIdx = i
      }
    }

    // Classify
    for (let i = 0; i < sections.length; i++) {
      const energy = sectionEnergies[i]
      const isFirst = i === 0
      const isLast = i === sections.length - 1

      let type: SectionType = 'custom'

      if (isFirst && energy < 0.4) {
        type = 'intro'
      } else if (isLast && energy < 0.4) {
        type = 'outro'
      } else if (i === maxEnergyIdx && maxEnergy > 0.5) {
        type = 'drop'
      } else if (
        i === maxEnergyIdx - 1 &&
        maxEnergyIdx > 0 &&
        sectionEnergies[i] < sectionEnergies[maxEnergyIdx]
      ) {
        // Rising energy before drop
        type = 'buildup'
      } else if (
        i === maxEnergyIdx + 1 &&
        maxEnergyIdx < sections.length - 1 &&
        energy < maxEnergy * 0.7
      ) {
        // Energy dip after drop
        type = 'breakdown'
      }

      sections[i].type = type
    }

    // Handle case where first section has high energy (no intro)
    // and there are multiple drop candidates
    if (sections.length >= 3) {
      // If we have a second drop-like section, mark it
      for (let i = 0; i < sections.length; i++) {
        if (
          i !== maxEnergyIdx &&
          sections[i].type === 'custom' &&
          sectionEnergies[i] > 0.6
        ) {
          sections[i].type = 'drop'
          break // Only mark one more
        }
      }
    }
  }

  // ── Shared infrastructure (same patterns as KeyDetector) ──────────────────

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
      `${songId}.sections.json`
    )
  }

  private async readCache(
    cachePath: string,
    expectedHash: string
  ): Promise<SectionData | null> {
    try {
      if (!(await fs.pathExists(cachePath))) return null
      const data: SectionData = await fs.readJson(cachePath)
      if (data.fileHash !== expectedHash) return null
      return data
    } catch {
      return null
    }
  }

  private async writeCache(
    cachePath: string,
    data: SectionData
  ): Promise<void> {
    await fs.ensureDir(path.dirname(cachePath))
    await fs.writeJson(cachePath, data)
  }

  private resolveSongPath(
    song: { localFilePath?: string; externalFilePath?: string },
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

  private broadcastProgress(progress: SectionProgressEvent): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.SECTION_PROGRESS, progress)
      }
    }
  }

  cleanup(): void {
    // Essentia instance is shared — don't clean up here if KeyDetector owns it.
    // In a future refactor, share a single EssentiaManager across detectors.
  }
}
