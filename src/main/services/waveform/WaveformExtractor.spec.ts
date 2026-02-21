import * as path from 'path'
import { WaveformExtractor } from './WaveformExtractor'
import type { ProjectService } from '../ProjectService'
import type { WaveformData } from '@shared/types/waveform.types'
import * as fsExtra from 'fs-extra'

jest.mock('fs-extra')
jest.mock('electron', () => ({
  BrowserWindow: { getAllWindows: () => [] },
}))
jest.mock('../../utils/ffmpegPath', () => ({
  getFfmpegPath: () => '/usr/bin/ffmpeg',
}))

const mockFs = fsExtra as jest.Mocked<typeof fsExtra>

function makeProjectService(
  overrides: Partial<ReturnType<ProjectService['getActiveProject']>> = {}
): ProjectService {
  return {
    getActiveProject: () => ({
      id: 'proj-1',
      name: 'Test',
      projectDirectory: '/projects/test',
      songs: [],
      mixMetadata: { tags: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      ...overrides,
    }),
  } as unknown as ProjectService
}

/** Build a valid binary .peaks buffer for testing */
function buildPeaksBuffer(
  peaks: number[],
  peaksLow?: number[],
  peaksMid?: number[],
  peaksHigh?: number[]
): Buffer {
  const hasBands = !!(peaksLow && peaksMid && peaksHigh)
  const arrayCount = hasBands ? 4 : 1
  const headerSize = 16
  const buf = Buffer.alloc(headerSize + peaks.length * 4 * arrayCount)

  buf.writeUInt32LE(0x50454b53, 0) // "PEKS" magic
  buf.writeUInt32LE(1, 4) // version
  buf.writeUInt32LE(peaks.length, 8) // peak count
  buf.writeUInt32LE(hasBands ? 1 : 0, 12) // flags

  const floats = new Float32Array(
    buf.buffer,
    buf.byteOffset + headerSize,
    peaks.length * arrayCount
  )
  for (let i = 0; i < peaks.length; i++) {
    floats[i] = peaks[i]
  }
  if (hasBands) {
    for (let i = 0; i < peaks.length; i++) {
      floats[peaks.length + i] = peaksLow![i]
      floats[peaks.length * 2 + i] = peaksMid![i]
      floats[peaks.length * 3 + i] = peaksHigh![i]
    }
  }
  return buf
}

const waveformDir = path.join('/projects/test', 'assets', 'waveforms')

describe('WaveformExtractor', () => {
  let extractor: WaveformExtractor

  beforeEach(() => {
    jest.clearAllMocks()
    extractor = new WaveformExtractor(makeProjectService())
  })

  describe('downsamplePeaks', () => {
    it('returns empty array for empty input', () => {
      const result = extractor.downsamplePeaks(new Float32Array(0))
      expect(result).toEqual([])
    })

    it('normalizes peaks to 0–1 range', () => {
      const samples = new Float32Array([
        0.0, 0.2, 0.5, 0.8, 1.0, 0.6, 0.3, 0.1, 0.0, 0.4,
      ])

      const peaks = extractor.downsamplePeaks(samples)

      expect(peaks.length).toBe(10)
      expect(peaks[0]).toBeCloseTo(0.0)
      expect(peaks[2]).toBeCloseTo(0.5)
      expect(peaks[4]).toBeCloseTo(1.0)
    })

    it('uses absolute values for negative samples', () => {
      const samples = new Float32Array([0.4, -0.8, 0.0, 0.2])

      const peaks = extractor.downsamplePeaks(samples)

      expect(peaks.length).toBe(4)
      expect(peaks[0]).toBeCloseTo(0.5) // 0.4 / 0.8
      expect(peaks[1]).toBeCloseTo(1.0) // 0.8 / 0.8
      expect(peaks[3]).toBeCloseTo(0.25) // 0.2 / 0.8
    })

    it('produces ~8000 peaks for large input', () => {
      const samples = new Float32Array(1_440_000)
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin(i * 0.01)
      }

      const peaks = extractor.downsamplePeaks(samples)

      expect(peaks.length).toBeLessThanOrEqual(8000)
      expect(peaks.length).toBeGreaterThan(7900)
      for (const p of peaks) {
        expect(p).toBeGreaterThanOrEqual(0)
        expect(p).toBeLessThanOrEqual(1)
      }
    })

    it('handles single-sample input', () => {
      const samples = new Float32Array([0.7])
      const peaks = extractor.downsamplePeaks(samples)
      expect(peaks.length).toBe(1)
      expect(peaks[0]).toBeCloseTo(1.0)
    })

    it('handles all-zero input without division by zero', () => {
      const samples = new Float32Array(4000)
      const peaks = extractor.downsamplePeaks(samples)
      expect(peaks.every((p) => p === 0)).toBe(true)
    })
  })

  describe('computeFileHash', () => {
    it('returns size-mtime string', async () => {
      mockFs.stat.mockResolvedValue({
        size: 12345,
        mtimeMs: 1700000000,
      } as fsExtra.Stats)

      const hash = await extractor.computeFileHash('/some/file.flac')
      expect(hash).toBe('12345-1700000000')
    })

    it('throws if file does not exist', async () => {
      mockFs.stat.mockRejectedValue(new Error('ENOENT'))
      await expect(extractor.computeFileHash('/missing.flac')).rejects.toThrow(
        'ENOENT'
      )
    })
  })

  describe('generate (cache behavior)', () => {
    const songId = 'song-abc'
    const filePath = '/music/track.flac'
    const fileHash = '999-1700000000'

    beforeEach(() => {
      mockFs.stat.mockResolvedValue({
        size: 999,
        mtimeMs: 1700000000,
      } as fsExtra.Stats)
    })

    it('returns cached data from binary .peaks file', async () => {
      const peaks = new Array(8000).fill(0.5)
      const peaksLow = new Array(8000).fill(0.3)
      const peaksMid = new Array(8000).fill(0.2)
      const peaksHigh = new Array(8000).fill(0.1)

      const peaksPath = path.join(waveformDir, 'song-abc.peaks')
      const metaPath = path.join(waveformDir, 'song-abc.meta.json')

      mockFs.pathExists.mockImplementation(((p: string) => {
        if (p === peaksPath || p === metaPath) return Promise.resolve(true)
        return Promise.resolve(false)
      }) as typeof mockFs.pathExists)

      mockFs.readJson.mockResolvedValue({
        songId,
        duration: 180,
        sampleRate: 16000,
        fileHash,
        peakCount: 8000,
        hasBands: true,
      } as never)

      mockFs.readFile.mockResolvedValue(
        buildPeaksBuffer(peaks, peaksLow, peaksMid, peaksHigh) as never
      )

      const result = await extractor.generate(songId, filePath)

      expect(result.songId).toBe(songId)
      expect(result.peaks.length).toBe(8000)
      expect(result.peaksLow!.length).toBe(8000)
      // Should not have re-extracted
      expect(mockFs.writeFile).not.toHaveBeenCalled()
    })

    it('falls back to legacy .json cache when binary not found', async () => {
      const cachedData: WaveformData = {
        songId,
        peaks: new Array(8000).fill(0.5),
        peaksLow: new Array(8000).fill(0.3),
        peaksMid: new Array(8000).fill(0.2),
        peaksHigh: new Array(8000).fill(0.1),
        duration: 180,
        sampleRate: 16000,
        fileHash,
      }

      const jsonPath = path.join(waveformDir, 'song-abc.json')

      mockFs.pathExists.mockImplementation(((p: string) => {
        if (p === jsonPath) return Promise.resolve(true)
        return Promise.resolve(false) // binary files don't exist
      }) as typeof mockFs.pathExists)

      mockFs.readJson.mockResolvedValue(cachedData as never)

      const result = await extractor.generate(songId, filePath)

      expect(result).toEqual(cachedData)
      // Should not re-extract since JSON cache is valid
      expect(mockFs.writeFile).not.toHaveBeenCalled()
    })

    it('recomputes when hash mismatches', async () => {
      // Binary files don't exist, JSON has old hash
      const jsonPath = path.join(waveformDir, 'song-abc.json')

      mockFs.pathExists.mockImplementation(((p: string) => {
        if (p === jsonPath) return Promise.resolve(true)
        return Promise.resolve(false)
      }) as typeof mockFs.pathExists)

      mockFs.readJson.mockResolvedValue({
        songId,
        peaks: [0.1],
        duration: 60,
        sampleRate: 8000,
        fileHash: 'old-hash',
      } as never)

      const mockData: WaveformData = {
        songId,
        peaks: [0.5, 1.0],
        duration: 180,
        sampleRate: 8000,
        fileHash,
      }
      jest.spyOn(extractor, 'extractPeaks').mockResolvedValue(mockData)
      mockFs.ensureDir.mockResolvedValue(undefined as never)
      mockFs.writeFile.mockResolvedValue(undefined as never)
      mockFs.writeJson.mockResolvedValue(undefined as never)

      const result = await extractor.generate(songId, filePath)

      expect(result).toEqual(mockData)
      expect(extractor.extractPeaks).toHaveBeenCalled()
      // Should write binary .peaks + .meta.json
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(waveformDir, 'song-abc.peaks'),
        expect.any(Buffer)
      )
      expect(mockFs.writeJson).toHaveBeenCalledWith(
        path.join(waveformDir, 'song-abc.meta.json'),
        expect.objectContaining({ songId, fileHash })
      )
    })

    it('computes fresh when no cache file exists', async () => {
      mockFs.pathExists.mockResolvedValue(false as never)

      const mockData: WaveformData = {
        songId,
        peaks: [0.3, 0.7],
        duration: 120,
        sampleRate: 8000,
        fileHash,
      }
      jest.spyOn(extractor, 'extractPeaks').mockResolvedValue(mockData)
      mockFs.ensureDir.mockResolvedValue(undefined as never)
      mockFs.writeFile.mockResolvedValue(undefined as never)
      mockFs.writeJson.mockResolvedValue(undefined as never)

      const result = await extractor.generate(songId, filePath)

      expect(result).toEqual(mockData)
      expect(mockFs.writeFile).toHaveBeenCalled()
      expect(mockFs.writeJson).toHaveBeenCalled()
    })

    it('handles corrupted .peaks file gracefully (falls back)', async () => {
      const peaksPath = path.join(waveformDir, 'song-abc.peaks')
      const metaPath = path.join(waveformDir, 'song-abc.meta.json')

      mockFs.pathExists.mockImplementation(((p: string) => {
        if (p === peaksPath || p === metaPath) return Promise.resolve(true)
        return Promise.resolve(false)
      }) as typeof mockFs.pathExists)

      mockFs.readJson.mockResolvedValue({
        songId,
        duration: 180,
        sampleRate: 16000,
        fileHash,
        peakCount: 8000,
        hasBands: true,
      } as never)

      // Corrupted: truncated buffer (only 10 bytes, way smaller than expected)
      mockFs.readFile.mockResolvedValue(Buffer.alloc(10) as never)

      // Should fall back to re-extraction
      const mockData: WaveformData = {
        songId,
        peaks: new Array(8000).fill(0.5),
        peaksLow: new Array(8000).fill(0.3),
        peaksMid: new Array(8000).fill(0.2),
        peaksHigh: new Array(8000).fill(0.1),
        duration: 180,
        sampleRate: 16000,
        fileHash,
      }
      jest.spyOn(extractor, 'extractPeaks').mockResolvedValue(mockData)
      mockFs.ensureDir.mockResolvedValue(undefined as never)
      mockFs.writeFile.mockResolvedValue(undefined as never)
      mockFs.writeJson.mockResolvedValue(undefined as never)

      const result = await extractor.generate(songId, filePath)

      expect(result.peaks.length).toBe(8000)
      expect(extractor.extractPeaks).toHaveBeenCalled()
    })

    it('binary write/read roundtrip preserves peak data', () => {
      // Test that buildPeaksBuffer creates valid data that can be read back
      const peaks = [0.1, 0.5, 0.9, 1.0]
      const peaksLow = [0.3, 0.2, 0.1, 0.0]
      const peaksMid = [0.0, 0.4, 0.6, 0.8]
      const peaksHigh = [0.0, 0.0, 0.3, 0.7]

      const buf = buildPeaksBuffer(peaks, peaksLow, peaksMid, peaksHigh)

      // Verify header
      expect(buf.readUInt32LE(0)).toBe(0x50454b53) // PEKS magic
      expect(buf.readUInt32LE(4)).toBe(1) // version
      expect(buf.readUInt32LE(8)).toBe(4) // peak count
      expect(buf.readUInt32LE(12)).toBe(1) // hasBands flag

      // Verify peaks data
      const headerSize = 16
      const floats = new Float32Array(
        buf.buffer,
        buf.byteOffset + headerSize,
        16
      )
      expect(floats[0]).toBeCloseTo(0.1) // peaks[0]
      expect(floats[3]).toBeCloseTo(1.0) // peaks[3]
      expect(floats[4]).toBeCloseTo(0.3) // peaksLow[0]
      expect(floats[8]).toBeCloseTo(0.0) // peaksMid[0]
      expect(floats[15]).toBeCloseTo(0.7) // peaksHigh[3]
    })

    it('binary buffer without bands has correct size', () => {
      const peaks = [0.5, 1.0, 0.3]
      const buf = buildPeaksBuffer(peaks)

      // Header (16) + 3 peaks * 4 bytes = 28
      expect(buf.length).toBe(16 + 3 * 4)
      expect(buf.readUInt32LE(12)).toBe(0) // no bands flag
    })
  })

  describe('generateBatch', () => {
    it('throws when project is not active', async () => {
      const service = makeProjectService()
      jest.spyOn(service, 'getActiveProject').mockReturnValue(null)
      const ext = new WaveformExtractor(service)

      await expect(ext.generateBatch('wrong-id')).rejects.toThrow('not active')
    })

    it('skips songs without file paths', async () => {
      const service = makeProjectService({
        songs: [
          { id: 's1', title: 'Song 1', order: 0, addedAt: new Date() },
        ] as never,
      })
      const ext = new WaveformExtractor(service)

      const results = await ext.generateBatch('proj-1')
      expect(results).toHaveLength(0)
    })
  })
})
