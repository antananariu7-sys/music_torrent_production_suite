import * as path from 'path'
import * as fs from 'fs-extra'
import type { WaveformData } from '@shared/types/waveform.types'
import type { ProjectService } from '../ProjectService'

/**
 * Binary .peaks file format:
 * [0-3]   Magic: 0x50454B53 ("PEKS")
 * [4-7]   Version: uint32 = 1
 * [8-11]  Peak count (N): uint32
 * [12-15] Flags: uint32 (bit 0 = hasBands)
 * [16..]  Float32Array: peaks[N], then if hasBands: peaksLow[N], peaksMid[N], peaksHigh[N]
 */
export const PEAKS_MAGIC = 0x50454b53
export const PEAKS_VERSION = 1
export const PEAKS_HEADER_SIZE = 16

/**
 * Handles reading and writing waveform cache files in binary .peaks format.
 */
export class WaveformCache {
  constructor(private projectService: ProjectService) {}

  /**
   * Get the cache base path (without extension) for a song's waveform data.
   */
  getCacheBasePath(songId: string): string {
    const project = this.projectService.getActiveProject()
    if (!project) throw new Error('No active project')
    return path.join(project.projectDirectory, 'assets', 'waveforms', songId)
  }

  /**
   * Read cached waveform data from disk.
   * Tries binary .peaks + .meta.json first, falls back to legacy .json.
   */
  async readCache(
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
  async writeCache(basePath: string, data: WaveformData): Promise<void> {
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
      console.log(`[WaveformCache] Deleted waveform cache dir: ${waveformDir}`)
    }
  }
}
