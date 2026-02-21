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
      // 10 samples → windowSize=1 → 10 peaks (each sample = its own peak)
      const samples = new Float32Array([
        0.0, 0.2, 0.5, 0.8, 1.0, 0.6, 0.3, 0.1, 0.0, 0.4,
      ])

      const peaks = extractor.downsamplePeaks(samples)

      expect(peaks.length).toBe(10)
      // Global max = 1.0, so peaks are normalized by 1.0
      expect(peaks[0]).toBeCloseTo(0.0)
      expect(peaks[2]).toBeCloseTo(0.5)
      expect(peaks[4]).toBeCloseTo(1.0)
    })

    it('uses absolute values for negative samples', () => {
      const samples = new Float32Array([0.4, -0.8, 0.0, 0.2])

      const peaks = extractor.downsamplePeaks(samples)

      expect(peaks.length).toBe(4)
      // Global max = 0.8
      expect(peaks[0]).toBeCloseTo(0.5) // 0.4 / 0.8
      expect(peaks[1]).toBeCloseTo(1.0) // 0.8 / 0.8
      expect(peaks[3]).toBeCloseTo(0.25) // 0.2 / 0.8
    })

    it('produces ~8000 peaks for large input', () => {
      // 16000 samples/sec * 90 sec = 1,440,000 samples (1.5 min track at 16kHz)
      const samples = new Float32Array(1_440_000)
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin(i * 0.01)
      }

      const peaks = extractor.downsamplePeaks(samples)

      expect(peaks.length).toBeLessThanOrEqual(8000)
      expect(peaks.length).toBeGreaterThan(7900)
      // All peaks should be normalized 0–1
      for (const p of peaks) {
        expect(p).toBeGreaterThanOrEqual(0)
        expect(p).toBeLessThanOrEqual(1)
      }
    })

    it('handles single-sample input', () => {
      const samples = new Float32Array([0.7])
      const peaks = extractor.downsamplePeaks(samples)
      expect(peaks.length).toBe(1)
      expect(peaks[0]).toBeCloseTo(1.0) // normalized
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
    const cachePath = path.join(
      '/projects/test',
      'assets',
      'waveforms',
      'song-abc.json'
    )

    beforeEach(() => {
      mockFs.stat.mockResolvedValue({
        size: 999,
        mtimeMs: 1700000000,
      } as fsExtra.Stats)
    })

    it('returns cached data when hash matches', async () => {
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

      mockFs.pathExists.mockResolvedValue(true as never)
      mockFs.readJson.mockResolvedValue(cachedData as never)

      const result = await extractor.generate(songId, filePath)

      expect(result).toEqual(cachedData)
      // Should not have written anything new
      expect(mockFs.writeJson).not.toHaveBeenCalled()
    })

    it('recomputes when hash mismatches', async () => {
      const staleData: WaveformData = {
        songId,
        peaks: [0.1],
        duration: 60,
        sampleRate: 8000,
        fileHash: 'old-hash',
      }

      mockFs.pathExists.mockResolvedValue(true as never)
      mockFs.readJson.mockResolvedValue(staleData as never)

      // Mock extractPeaks to avoid actual FFmpeg call
      const mockData: WaveformData = {
        songId,
        peaks: [0.5, 1.0],
        duration: 180,
        sampleRate: 8000,
        fileHash,
      }
      jest.spyOn(extractor, 'extractPeaks').mockResolvedValue(mockData)
      mockFs.ensureDir.mockResolvedValue(undefined as never)
      mockFs.writeJson.mockResolvedValue(undefined as never)

      const result = await extractor.generate(songId, filePath)

      expect(result).toEqual(mockData)
      expect(extractor.extractPeaks).toHaveBeenCalledWith(
        songId,
        filePath,
        fileHash
      )
      expect(mockFs.writeJson).toHaveBeenCalledWith(cachePath, mockData)
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
      mockFs.writeJson.mockResolvedValue(undefined as never)

      const result = await extractor.generate(songId, filePath)

      expect(result).toEqual(mockData)
      expect(mockFs.writeJson).toHaveBeenCalled()
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
