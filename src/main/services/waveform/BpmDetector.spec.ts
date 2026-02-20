import * as path from 'path'
import { BpmDetector } from './BpmDetector'
import type { ProjectService } from '../ProjectService'
import type { BpmData } from '@shared/types/waveform.types'
import * as fsExtra from 'fs-extra'

jest.mock('fs-extra')
jest.mock('electron', () => ({
  BrowserWindow: { getAllWindows: () => [] },
}))
jest.mock('../../utils/ffmpegPath', () => ({
  getFfmpegPath: () => '/usr/bin/ffmpeg',
}))

const mockFs = fsExtra as jest.Mocked<typeof fsExtra>

function makeProjectService(overrides: Partial<ReturnType<ProjectService['getActiveProject']>> = {}): ProjectService {
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

describe('BpmDetector', () => {
  let detector: BpmDetector

  beforeEach(() => {
    jest.clearAllMocks()
    detector = new BpmDetector(makeProjectService())
  })

  describe('computeOnsetStrength', () => {
    it('returns empty array for very short input', () => {
      const samples = new Float32Array(100) // less than FRAME_SIZE
      const onsets = detector.computeOnsetStrength(samples)
      expect(onsets).toEqual([])
    })

    it('first onset is always zero', () => {
      const samples = new Float32Array(4096)
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin(i * 0.1)
      }
      const onsets = detector.computeOnsetStrength(samples)
      expect(onsets[0]).toBe(0)
    })

    it('detects energy increase as positive onset', () => {
      // Create samples: silence then loud signal
      const samples = new Float32Array(4096)
      // First 2048 samples: silence
      // Next 2048 samples: loud
      for (let i = 2048; i < 4096; i++) {
        samples[i] = 0.9
      }

      const onsets = detector.computeOnsetStrength(samples)
      expect(onsets.length).toBeGreaterThan(0)

      // Find the onset near the transition point
      const transitionFrame = Math.floor(2048 / 512) // HOP_SIZE = 512
      const hasPositiveOnset = onsets.slice(transitionFrame - 1, transitionFrame + 2)
        .some(v => v > 0)
      expect(hasPositiveOnset).toBe(true)
    })

    it('suppresses energy decrease (half-wave rectification)', () => {
      // Create samples: loud then silence
      const samples = new Float32Array(4096)
      for (let i = 0; i < 2048; i++) {
        samples[i] = 0.9
      }

      const onsets = detector.computeOnsetStrength(samples)
      // After the loud-to-silent transition, onsets should be 0 (negative diff rectified)
      const transitionFrame = Math.floor(2048 / 512)
      for (let i = transitionFrame + 1; i < onsets.length; i++) {
        expect(onsets[i]).toBe(0)
      }
    })
  })

  describe('autocorrelate', () => {
    it('returns zero confidence for empty input', () => {
      const result = detector.autocorrelate([])
      expect(result.confidence).toBe(0)
      expect(result.bpm).toBe(0)
    })

    it('returns zero confidence for single-element input', () => {
      const result = detector.autocorrelate([1.0])
      expect(result.confidence).toBe(0)
    })

    it('detects periodic signal', () => {
      // Create a periodic onset signal at 120 BPM
      // framesPerSecond = 44100 / 512 ≈ 86.13
      // At 120 BPM, beat period = 0.5s → ~43 frames
      const framesPerSecond = 44100 / 512
      const beatPeriodFrames = Math.round(0.5 * framesPerSecond)
      const totalFrames = beatPeriodFrames * 20 // 20 beats worth

      const onsets = new Array(totalFrames).fill(0)
      for (let i = 0; i < totalFrames; i += beatPeriodFrames) {
        onsets[i] = 1.0
        // Add slight energy around beat for realism
        if (i + 1 < totalFrames) onsets[i + 1] = 0.3
      }

      const result = detector.autocorrelate(onsets)

      // Should detect BPM near 120 (allow ±5 BPM tolerance)
      expect(result.bpm).toBeGreaterThanOrEqual(115)
      expect(result.bpm).toBeLessThanOrEqual(125)
      expect(result.confidence).toBeGreaterThan(0)
    })

    it('returns low confidence for random noise', () => {
      const onsets = new Array(1000)
      for (let i = 0; i < onsets.length; i++) {
        onsets[i] = Math.random() * 0.1
      }

      const result = detector.autocorrelate(onsets)
      // Random noise should have low confidence
      expect(result.confidence).toBeLessThan(0.8)
    })
  })

  describe('findFirstBeat', () => {
    it('returns 0 for empty onsets', () => {
      expect(detector.findFirstBeat([], 120)).toBe(0)
    })

    it('returns 0 for zero BPM', () => {
      expect(detector.findFirstBeat([0.5, 1.0, 0.2], 0)).toBe(0)
    })

    it('finds the strongest onset within first 2 beats', () => {
      const framesPerSecond = 44100 / 512
      // At 120 BPM, beat period ≈ 43 frames, search window = 2 beats ≈ 86 frames
      const onsets = new Array(200).fill(0)
      // Strongest onset at frame 20
      onsets[20] = 1.0
      onsets[10] = 0.3

      const offset = detector.findFirstBeat(onsets, 120)
      const expectedOffset = 20 / framesPerSecond

      expect(offset).toBeCloseTo(expectedOffset, 2)
    })
  })

  describe('analyzeBpm', () => {
    it('returns zero BPM for very short track', async () => {
      // Less than 5 seconds at 44.1kHz → too short
      const shortPcm = Buffer.alloc(44100 * 3 * 4) // 3 seconds of float32
      jest.spyOn(detector as never, 'extractPcm' as never)
        .mockResolvedValue(shortPcm as never)

      const result = await detector.analyzeBpm('test-song', '/test.mp3', 'hash-1')

      expect(result.bpm).toBe(0)
      expect(result.confidence).toBe(0)
      expect(result.songId).toBe('test-song')
    })
  })

  describe('computeFileHash', () => {
    it('returns size-mtime string', async () => {
      mockFs.stat.mockResolvedValue({ size: 54321, mtimeMs: 1700000000 } as fsExtra.Stats)

      const hash = await detector.computeFileHash('/some/file.mp3')
      expect(hash).toBe('54321-1700000000')
    })
  })

  describe('detect (cache behavior)', () => {
    const songId = 'song-xyz'
    const filePath = '/music/track.mp3'
    const fileHash = '888-1700000000'
    const cachePath = path.join('/projects/test', 'assets', 'waveforms', 'song-xyz.bpm.json')

    beforeEach(() => {
      mockFs.stat.mockResolvedValue({ size: 888, mtimeMs: 1700000000 } as fsExtra.Stats)
    })

    it('returns cached data when hash matches', async () => {
      const cachedData: BpmData = {
        songId,
        bpm: 128,
        firstBeatOffset: 0.12,
        confidence: 0.85,
        fileHash,
      }

      mockFs.pathExists.mockResolvedValue(true as never)
      mockFs.readJson.mockResolvedValue(cachedData as never)

      const result = await detector.detect(songId, filePath)

      expect(result).toEqual(cachedData)
      expect(mockFs.writeJson).not.toHaveBeenCalled()
    })

    it('recomputes when hash mismatches', async () => {
      const staleData: BpmData = {
        songId,
        bpm: 100,
        firstBeatOffset: 0.5,
        confidence: 0.7,
        fileHash: 'old-hash',
      }

      mockFs.pathExists.mockResolvedValue(true as never)
      mockFs.readJson.mockResolvedValue(staleData as never)

      const mockResult: BpmData = {
        songId,
        bpm: 128,
        firstBeatOffset: 0.12,
        confidence: 0.85,
        fileHash,
      }
      jest.spyOn(detector, 'analyzeBpm').mockResolvedValue(mockResult)
      mockFs.ensureDir.mockResolvedValue(undefined as never)
      mockFs.writeJson.mockResolvedValue(undefined as never)

      const result = await detector.detect(songId, filePath)

      expect(result).toEqual(mockResult)
      expect(detector.analyzeBpm).toHaveBeenCalledWith(songId, filePath, fileHash)
      expect(mockFs.writeJson).toHaveBeenCalledWith(cachePath, mockResult)
    })
  })

  describe('detectBatch', () => {
    it('throws when project is not active', async () => {
      const service = makeProjectService()
      jest.spyOn(service, 'getActiveProject').mockReturnValue(null)
      const det = new BpmDetector(service)

      await expect(det.detectBatch('wrong-id')).rejects.toThrow('not active')
    })

    it('skips songs without file paths', async () => {
      const service = makeProjectService({
        songs: [
          { id: 's1', title: 'Song 1', order: 0, addedAt: new Date() },
        ] as never,
      })
      const det = new BpmDetector(service)

      const results = await det.detectBatch('proj-1')
      expect(results).toHaveLength(0)
    })
  })
})
