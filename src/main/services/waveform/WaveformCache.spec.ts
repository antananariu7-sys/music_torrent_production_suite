import { describe, it, expect, beforeEach } from '@jest/globals'
import * as path from 'path'
import * as fsExtra from 'fs-extra'
import {
  WaveformCache,
  PEAKS_MAGIC,
  PEAKS_VERSION,
  PEAKS_HEADER_SIZE,
} from './WaveformCache'
import type { WaveformData } from '@shared/types/waveform.types'
import type { ProjectService } from '../ProjectService'

jest.mock('fs-extra')
const mockFs = fsExtra as jest.Mocked<typeof fsExtra>

function makeProjectService(overrides = {}): ProjectService {
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

function makeNoProjectService(): ProjectService {
  return {
    getActiveProject: () => null,
  } as unknown as ProjectService
}

function buildPeaksBuffer(
  peaks: number[],
  bands?: { low: number[]; mid: number[]; high: number[] }
): Buffer {
  const hasBands = !!bands
  const peakCount = peaks.length
  const arrayCount = hasBands ? 4 : 1
  const bufSize = PEAKS_HEADER_SIZE + peakCount * 4 * arrayCount
  const buf = Buffer.alloc(bufSize)
  buf.writeUInt32LE(PEAKS_MAGIC, 0)
  buf.writeUInt32LE(PEAKS_VERSION, 4)
  buf.writeUInt32LE(peakCount, 8)
  buf.writeUInt32LE(hasBands ? 1 : 0, 12)
  const floats = new Float32Array(
    buf.buffer,
    buf.byteOffset + PEAKS_HEADER_SIZE,
    peakCount * arrayCount
  )
  for (let i = 0; i < peakCount; i++) floats[i] = peaks[i]
  if (bands) {
    for (let i = 0; i < peakCount; i++) {
      floats[peakCount + i] = bands.low[i]
      floats[peakCount * 2 + i] = bands.mid[i]
      floats[peakCount * 3 + i] = bands.high[i]
    }
  }
  return buf
}

const BASE_PATH = '/projects/test/assets/waveforms/song-abc'
const EXPECTED_HASH = 'abc123hash'

const SAMPLE_META = {
  songId: 'song-abc',
  duration: 180.5,
  sampleRate: 44100,
  fileHash: EXPECTED_HASH,
  peakCount: 3,
  hasBands: false,
}

describe('WaveformCache', () => {
  let cache: WaveformCache

  beforeEach(() => {
    jest.resetAllMocks()
    cache = new WaveformCache(makeProjectService())
  })

  // ---------------------------------------------------------------------------
  // getCacheBasePath
  // ---------------------------------------------------------------------------

  describe('getCacheBasePath', () => {
    it('returns the correct path for a given songId', () => {
      const result = cache.getCacheBasePath('song-abc')
      expect(result).toBe(
        path.join('/projects/test', 'assets', 'waveforms', 'song-abc')
      )
    })

    it('throws when there is no active project', () => {
      const noProjectCache = new WaveformCache(makeNoProjectService())
      expect(() => noProjectCache.getCacheBasePath('song-abc')).toThrow(
        'No active project'
      )
    })
  })

  // ---------------------------------------------------------------------------
  // readCache — binary (.peaks + .meta.json)
  // ---------------------------------------------------------------------------

  describe('readCache — binary format', () => {
    it('deserializes Float32Array peaks correctly from a valid .peaks file', async () => {
      const peaks = [0.1, 0.5, 0.9]
      const buf = buildPeaksBuffer(peaks)

      mockFs.pathExists
        .mockResolvedValueOnce(true as never) // peaksPath
        .mockResolvedValueOnce(true as never) // metaPath
      mockFs.readJson.mockResolvedValueOnce(SAMPLE_META as never)
      mockFs.readFile.mockResolvedValueOnce(buf as never)

      const result = await cache.readCache(BASE_PATH, EXPECTED_HASH)

      expect(result).not.toBeNull()
      expect(result!.peaks).toHaveLength(3)
      // Float32 round-trip precision
      expect(result!.peaks[0]).toBeCloseTo(0.1, 5)
      expect(result!.peaks[1]).toBeCloseTo(0.5, 5)
      expect(result!.peaks[2]).toBeCloseTo(0.9, 5)
    })

    it('returns null when magic bytes are wrong', async () => {
      const peaks = [0.1, 0.5, 0.9]
      const buf = buildPeaksBuffer(peaks)
      // Corrupt magic
      buf.writeUInt32LE(0xdeadbeef, 0)

      mockFs.pathExists
        .mockResolvedValueOnce(true as never)
        .mockResolvedValueOnce(true as never)
      mockFs.readJson.mockResolvedValueOnce(SAMPLE_META as never)
      mockFs.readFile.mockResolvedValueOnce(buf as never)

      // Binary fails; also mock that .json does not exist for fallback
      mockFs.pathExists.mockResolvedValueOnce(false as never)

      const result = await cache.readCache(BASE_PATH, EXPECTED_HASH)
      expect(result).toBeNull()
    })

    it('returns null when version is wrong', async () => {
      const peaks = [0.1, 0.5, 0.9]
      const buf = buildPeaksBuffer(peaks)
      // Corrupt version
      buf.writeUInt32LE(99, 4)

      mockFs.pathExists
        .mockResolvedValueOnce(true as never)
        .mockResolvedValueOnce(true as never)
      mockFs.readJson.mockResolvedValueOnce(SAMPLE_META as never)
      mockFs.readFile.mockResolvedValueOnce(buf as never)

      // Fallback .json also absent
      mockFs.pathExists.mockResolvedValueOnce(false as never)

      const result = await cache.readCache(BASE_PATH, EXPECTED_HASH)
      expect(result).toBeNull()
    })

    it('returns null when hash in meta does not match expectedHash', async () => {
      const peaks = [0.1, 0.5, 0.9]
      const buf = buildPeaksBuffer(peaks)
      const wrongMeta = { ...SAMPLE_META, fileHash: 'wrong-hash' }

      mockFs.pathExists
        .mockResolvedValueOnce(true as never)
        .mockResolvedValueOnce(true as never)
      mockFs.readJson.mockResolvedValueOnce(wrongMeta as never)
      mockFs.readFile.mockResolvedValueOnce(buf as never)

      // Fallback .json also absent
      mockFs.pathExists.mockResolvedValueOnce(false as never)

      const result = await cache.readCache(BASE_PATH, EXPECTED_HASH)
      expect(result).toBeNull()
    })

    it('returns WaveformData when hash matches', async () => {
      const peaks = [0.2, 0.8]
      const meta = { ...SAMPLE_META, peakCount: 2, songId: 'song-abc' }
      const buf = buildPeaksBuffer(peaks)

      mockFs.pathExists
        .mockResolvedValueOnce(true as never)
        .mockResolvedValueOnce(true as never)
      mockFs.readJson.mockResolvedValueOnce(meta as never)
      mockFs.readFile.mockResolvedValueOnce(buf as never)

      const result = await cache.readCache(BASE_PATH, EXPECTED_HASH)

      expect(result).not.toBeNull()
      expect(result!.songId).toBe('song-abc')
      expect(result!.fileHash).toBe(EXPECTED_HASH)
      expect(result!.duration).toBe(180.5)
      expect(result!.sampleRate).toBe(44100)
    })

    it('deserializes band arrays correctly when flag bit 0 is set', async () => {
      const peaks = [0.1, 0.5, 0.9]
      const bands = {
        low: [0.05, 0.25, 0.45],
        mid: [0.15, 0.35, 0.55],
        high: [0.02, 0.12, 0.22],
      }
      const buf = buildPeaksBuffer(peaks, bands)
      const bandMeta = { ...SAMPLE_META, hasBands: true }

      mockFs.pathExists
        .mockResolvedValueOnce(true as never)
        .mockResolvedValueOnce(true as never)
      mockFs.readJson.mockResolvedValueOnce(bandMeta as never)
      mockFs.readFile.mockResolvedValueOnce(buf as never)

      const result = await cache.readCache(BASE_PATH, EXPECTED_HASH)

      expect(result).not.toBeNull()
      expect(result!.peaksLow).toHaveLength(3)
      expect(result!.peaksMid).toHaveLength(3)
      expect(result!.peaksHigh).toHaveLength(3)
      expect(result!.peaksLow![0]).toBeCloseTo(0.05, 5)
      expect(result!.peaksMid![1]).toBeCloseTo(0.35, 5)
      expect(result!.peaksHigh![2]).toBeCloseTo(0.22, 5)
    })
  })

  // ---------------------------------------------------------------------------
  // readCache — JSON fallback
  // ---------------------------------------------------------------------------

  describe('readCache — JSON fallback', () => {
    it('falls back to legacy .json when binary files are not found', async () => {
      const jsonData: WaveformData = {
        songId: 'song-abc',
        peaks: [0.3, 0.7],
        duration: 90,
        sampleRate: 44100,
        fileHash: EXPECTED_HASH,
      }

      // Binary: peaksPath absent → readBinaryCache returns null
      mockFs.pathExists
        .mockResolvedValueOnce(false as never) // peaksPath missing
        // JSON fallback
        .mockResolvedValueOnce(true as never) // jsonPath exists
      mockFs.readJson.mockResolvedValueOnce(jsonData as never)

      const result = await cache.readCache(BASE_PATH, EXPECTED_HASH)

      expect(result).not.toBeNull()
      expect(result!.peaks).toEqual([0.3, 0.7])
      expect(result!.fileHash).toBe(EXPECTED_HASH)
    })

    it('returns null when neither binary nor .json file exists', async () => {
      // Binary: peaksPath absent
      mockFs.pathExists
        .mockResolvedValueOnce(false as never) // peaksPath missing
        .mockResolvedValueOnce(false as never) // jsonPath missing

      const result = await cache.readCache(BASE_PATH, EXPECTED_HASH)
      expect(result).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // writeCache
  // ---------------------------------------------------------------------------

  describe('writeCache', () => {
    beforeEach(() => {
      mockFs.ensureDir.mockResolvedValue(undefined as never)
      mockFs.writeFile.mockResolvedValue(undefined as never)
      mockFs.writeJson.mockResolvedValue(undefined as never)
    })

    it('creates .peaks binary file and .meta.json', async () => {
      const data: WaveformData = {
        songId: 'song-abc',
        peaks: [0.1, 0.5, 0.9],
        duration: 180.5,
        sampleRate: 44100,
        fileHash: EXPECTED_HASH,
      }

      await cache.writeCache(BASE_PATH, data)

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        `${BASE_PATH}.peaks`,
        expect.any(Buffer)
      )
      expect(mockFs.writeJson).toHaveBeenCalledWith(
        `${BASE_PATH}.meta.json`,
        expect.objectContaining({
          songId: 'song-abc',
          duration: 180.5,
          sampleRate: 44100,
          fileHash: EXPECTED_HASH,
          peakCount: 3,
          hasBands: false,
        })
      )
    })

    it('writes correct magic, version, and peak count in .peaks header', async () => {
      const peaks = [0.1, 0.2, 0.3, 0.4]
      const data: WaveformData = {
        songId: 'song-abc',
        peaks,
        duration: 60,
        sampleRate: 44100,
        fileHash: EXPECTED_HASH,
      }

      await cache.writeCache(BASE_PATH, data)

      const writtenBuf: Buffer = mockFs.writeFile.mock.calls[0][1] as Buffer
      expect(writtenBuf.readUInt32LE(0)).toBe(PEAKS_MAGIC)
      expect(writtenBuf.readUInt32LE(4)).toBe(PEAKS_VERSION)
      expect(writtenBuf.readUInt32LE(8)).toBe(4) // peakCount
    })

    it('sets flag bit 0 in header when band arrays are present', async () => {
      const data: WaveformData = {
        songId: 'song-abc',
        peaks: [0.1, 0.5, 0.9],
        peaksLow: [0.05, 0.25, 0.45],
        peaksMid: [0.15, 0.35, 0.55],
        peaksHigh: [0.02, 0.12, 0.22],
        duration: 180.5,
        sampleRate: 44100,
        fileHash: EXPECTED_HASH,
      }

      await cache.writeCache(BASE_PATH, data)

      const writtenBuf: Buffer = mockFs.writeFile.mock.calls[0][1] as Buffer
      const flags = writtenBuf.readUInt32LE(12)
      expect(flags & 1).toBe(1)

      expect(mockFs.writeJson).toHaveBeenCalledWith(
        `${BASE_PATH}.meta.json`,
        expect.objectContaining({ hasBands: true })
      )
    })
  })

  // ---------------------------------------------------------------------------
  // invalidateAllCaches
  // ---------------------------------------------------------------------------

  describe('invalidateAllCaches', () => {
    it('removes the waveform directory when it exists', async () => {
      mockFs.pathExists.mockResolvedValueOnce(true as never)
      mockFs.remove.mockResolvedValueOnce(undefined as never)

      await cache.invalidateAllCaches()

      const expectedDir = path.join('/projects/test', 'assets', 'waveforms')
      expect(mockFs.pathExists).toHaveBeenCalledWith(expectedDir)
      expect(mockFs.remove).toHaveBeenCalledWith(expectedDir)
    })

    it('does not throw when the waveform directory does not exist', async () => {
      mockFs.pathExists.mockResolvedValueOnce(false as never)

      await expect(cache.invalidateAllCaches()).resolves.toBeUndefined()
      expect(mockFs.remove).not.toHaveBeenCalled()
    })

    it('throws when there is no active project', async () => {
      const noProjectCache = new WaveformCache(makeNoProjectService())
      await expect(noProjectCache.invalidateAllCaches()).rejects.toThrow(
        'No active project'
      )
    })
  })
})
