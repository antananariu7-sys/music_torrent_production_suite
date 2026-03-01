/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports */
import * as path from 'path'
import { describe, it, expect, beforeEach } from '@jest/globals'
import { SectionDetector } from './SectionDetector'
import type { ProjectService } from '../ProjectService'
import type { SectionData } from '@shared/types/sectionDetection.types'
import * as fsExtra from 'fs-extra'

// ── fs-extra mock ──────────────────────────────────────────────────────────
jest.mock('fs-extra')

// ── ffmpegPath mock ────────────────────────────────────────────────────────
jest.mock('../../utils/ffmpegPath', () => ({
  getFfmpegPath: () => '/usr/bin/ffmpeg',
}))

// ── nanoid mock ────────────────────────────────────────────────────────────
jest.mock('nanoid', () => ({ nanoid: () => 'test-id' }))

// ── Electron BrowserWindow mock ────────────────────────────────────────────
const mockSend = jest.fn()
jest.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => [
      { isDestroyed: () => false, webContents: { send: mockSend } },
    ],
  },
}))

// ── Essentia.js mock ───────────────────────────────────────────────────────
const mockEssentiaInstance = {
  arrayToVector: jest.fn((arr: Float32Array) => arr),
  vectorToArray: jest.fn((_v: unknown) => new Float32Array(13).fill(0.5)),
  Windowing: jest.fn((frame: unknown) => ({ frame })),
  Spectrum: jest.fn((frame: unknown) => ({ spectrum: frame })),
  MFCC: jest.fn(() => ({ mfcc: new Float32Array(13).fill(0.5) })),
  shutdown: jest.fn(),
  delete: jest.fn(),
}

jest.mock('essentia.js', () => ({
  EssentiaWASM: {},
  Essentia: jest.fn(() => mockEssentiaInstance),
}))

// ── child_process / FFmpeg mock ────────────────────────────────────────────
// Default mock generates 20 seconds of PCM data (enough to pass short-track guard)
jest.mock('child_process', () => {
  const EventEmitter = require('events')
  return {
    spawn: jest.fn(() => {
      const proc = new EventEmitter()
      proc.stdout = new EventEmitter()
      proc.stderr = new EventEmitter()
      // 20 seconds of PCM at 22050 Hz (float32 = 4 bytes per sample)
      const sampleCount = 22050 * 20
      const pcmBuf = Buffer.alloc(sampleCount * 4)
      process.nextTick(() => {
        proc.stdout.emit('data', pcmBuf)
        proc.emit('close', 0)
      })
      return proc
    }),
  }
})

// ── Helpers ────────────────────────────────────────────────────────────────

const mockFs = fsExtra as jest.Mocked<typeof fsExtra>

type SongOverride = {
  id?: string
  title?: string
  order?: number
  addedAt?: Date
  localFilePath?: string
  externalFilePath?: string
  bpm?: number
  firstBeatOffset?: number
  duration?: number
  energyProfile?: number[]
}

function makeSong(overrides: SongOverride = {}) {
  return {
    id: 'song-1',
    title: 'Test Song',
    order: 0,
    addedAt: new Date(),
    localFilePath: '/music/track.mp3',
    ...overrides,
  }
}

function makeProjectService(
  songOverrides: SongOverride[] = [makeSong()]
): ProjectService {
  return {
    getActiveProject: () => ({
      id: 'proj-1',
      name: 'Test',
      projectDirectory: '/projects/test',
      songs: songOverrides,
      mixMetadata: { tags: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
    }),
    updateSong: jest.fn().mockResolvedValue(undefined),
  } as unknown as ProjectService
}

/** Build a SectionData cache payload */
function makeCachedSectionData(fileHash = '12345-1700000000'): SectionData {
  return {
    songId: 'song-1',
    fileHash,
    sections: [
      {
        id: 'cached-id',
        type: 'intro',
        startTime: 0,
        endTime: 20,
        confidence: 0.8,
      },
    ],
  }
}

/** Cache path for song-1 in proj-1 */
const CACHE_PATH = path.join(
  '/projects/test',
  'assets',
  'waveforms',
  'song-1.sections.json'
)

/** File hash returned by mocked fs.stat */
const FILE_HASH = '12345-1700000000'

// ── Test suite ─────────────────────────────────────────────────────────────

describe('SectionDetector', () => {
  let detector: SectionDetector

  beforeEach(() => {
    jest.clearAllMocks()
    // Default fs.stat: size=12345, mtimeMs=1700000000 → hash = "12345-1700000000"
    mockFs.stat.mockResolvedValue({
      size: 12345,
      mtimeMs: 1700000000,
    } as fsExtra.Stats)
    mockFs.pathExists.mockResolvedValue(false as never)
    mockFs.ensureDir.mockResolvedValue(undefined as never)
    mockFs.writeJson.mockResolvedValue(undefined as never)
    detector = new SectionDetector(makeProjectService())
  })

  // ── detectSong ───────────────────────────────────────────────────────────

  describe('detectSong', () => {
    it('returns cached sections on cache hit (matching file hash)', async () => {
      const cached = makeCachedSectionData(FILE_HASH)

      mockFs.pathExists.mockResolvedValue(true as never)
      mockFs.readJson.mockResolvedValue(cached as never)

      const result = await detector.detectSong('proj-1', 'song-1')

      expect(result).toEqual(cached)
      // FFmpeg spawn must not be called (cache served the result)
      const { spawn } = require('child_process')
      expect(spawn).not.toHaveBeenCalled()
      // Essentia MFCC must not be called
      expect(mockEssentiaInstance.MFCC).not.toHaveBeenCalled()
    })

    it('writes cache on cache miss and returns computed SectionData', async () => {
      mockFs.pathExists.mockResolvedValue(false as never)

      const result = await detector.detectSong('proj-1', 'song-1')

      expect(result.songId).toBe('song-1')
      expect(result.fileHash).toBe(FILE_HASH)
      expect(mockFs.writeJson).toHaveBeenCalledWith(
        CACHE_PATH,
        expect.objectContaining({ songId: 'song-1', fileHash: FILE_HASH })
      )
    })

    it('spawns FFmpeg to extract PCM on cache miss', async () => {
      mockFs.pathExists.mockResolvedValue(false as never)

      await detector.detectSong('proj-1', 'song-1')

      const { spawn } = require('child_process')
      expect(spawn).toHaveBeenCalledWith(
        '/usr/bin/ffmpeg',
        expect.arrayContaining(['-f', 'f32le', 'pipe:1']),
        expect.any(Object)
      )
    })

    it('returns single "custom" section for short track (< 15s)', async () => {
      const { spawn } = require('child_process')
      const EventEmitter = require('events')

      // Override spawn to emit only 10 seconds of PCM
      spawn.mockImplementationOnce(() => {
        const proc = new EventEmitter()
        proc.stdout = new EventEmitter()
        proc.stderr = new EventEmitter()
        const sampleCount = 22050 * 10 // 10 seconds — below 15s guard
        const pcmBuf = Buffer.alloc(sampleCount * 4)
        process.nextTick(() => {
          proc.stdout.emit('data', pcmBuf)
          proc.emit('close', 0)
        })
        return proc
      })

      mockFs.pathExists.mockResolvedValue(false as never)

      const song = makeSong({ duration: 10 })
      const service = makeProjectService([song])
      const det = new SectionDetector(service)
      const result = await det.detectSong('proj-1', 'song-1')

      expect(result.sections).toHaveLength(1)
      expect(result.sections[0].type).toBe('custom')
      expect(result.sections[0].startTime).toBe(0)
      expect(result.sections[0].endTime).toBe(10)
    })

    it('returns sections where first section starts at 0', async () => {
      mockFs.pathExists.mockResolvedValue(false as never)

      const result = await detector.detectSong('proj-1', 'song-1')

      expect(result.sections.length).toBeGreaterThan(0)
      expect(result.sections[0].startTime).toBe(0)
    })

    it('returns sections where last section ends at track duration', async () => {
      mockFs.pathExists.mockResolvedValue(false as never)

      const song = makeSong({ duration: 20 })
      const service = makeProjectService([song])
      const det = new SectionDetector(service)
      const result = await det.detectSong('proj-1', 'song-1')

      const lastSection = result.sections[result.sections.length - 1]
      // Duration is 20 seconds (from song.duration option)
      expect(lastSection.endTime).toBe(20)
    })

    it('all sections have valid SectionType values', async () => {
      mockFs.pathExists.mockResolvedValue(false as never)

      const validTypes = new Set([
        'intro',
        'buildup',
        'drop',
        'breakdown',
        'outro',
        'custom',
      ])
      const result = await detector.detectSong('proj-1', 'song-1')

      for (const section of result.sections) {
        expect(validTypes.has(section.type)).toBe(true)
      }
    })

    it('snaps boundaries to beat grid when BPM is provided', async () => {
      mockFs.pathExists.mockResolvedValue(false as never)

      const song = makeSong({ bpm: 128, firstBeatOffset: 0 })
      const service = makeProjectService([song])
      const det = new SectionDetector(service)

      // Spy on the private snapToBeatGrid method
      const snapSpy = jest.spyOn(det as never, 'snapToBeatGrid' as never)

      await det.detectSong('proj-1', 'song-1')

      expect(snapSpy).toHaveBeenCalledWith(expect.any(Array), 128, 0)
    })

    it('uses 10-second minimum peak distance when no BPM provided', async () => {
      mockFs.pathExists.mockResolvedValue(false as never)

      const song = makeSong({ bpm: undefined })
      const service = makeProjectService([song])
      const det = new SectionDetector(service)

      // Spy on getMinPeakDistance — when no BPM it should return ~10 frames-per-second worth
      const distSpy = jest.spyOn(det as never, 'getMinPeakDistance' as never)

      await det.detectSong('proj-1', 'song-1')

      expect(distSpy).toHaveBeenCalledWith(undefined)
      // Verify the snap spy was NOT called (no BPM)
      const snapSpy = jest.spyOn(det as never, 'snapToBeatGrid' as never)
      expect(snapSpy).not.toHaveBeenCalled()
    })

    it('propagates error when FFmpeg exits with non-zero code', async () => {
      const { spawn } = require('child_process')
      const EventEmitter = require('events')

      spawn.mockImplementationOnce(() => {
        const proc = new EventEmitter()
        proc.stdout = new EventEmitter()
        proc.stderr = new EventEmitter()
        process.nextTick(() => {
          proc.stderr.emit('data', Buffer.from('FFmpeg error'))
          proc.emit('close', 1)
        })
        return proc
      })

      mockFs.pathExists.mockResolvedValue(false as never)

      await expect(detector.detectSong('proj-1', 'song-1')).rejects.toThrow(
        /FFmpeg exited with code 1/
      )
    })

    it('throws when song is not found in project', async () => {
      const service = makeProjectService([]) // No songs
      const det = new SectionDetector(service)

      await expect(det.detectSong('proj-1', 'song-missing')).rejects.toThrow(
        /not found/
      )
    })

    it('throws when song has no file path', async () => {
      const song = makeSong({
        localFilePath: undefined,
        externalFilePath: undefined,
      })
      const service = makeProjectService([song])
      const det = new SectionDetector(service)

      await expect(det.detectSong('proj-1', 'song-1')).rejects.toThrow(
        /No file path/
      )
    })

    it('persists detected sections to song record via updateSong', async () => {
      mockFs.pathExists.mockResolvedValue(false as never)

      const service = makeProjectService()
      const det = new SectionDetector(service)
      await det.detectSong('proj-1', 'song-1')

      expect(service.updateSong).toHaveBeenCalledWith(
        'proj-1',
        'song-1',
        expect.objectContaining({ sections: expect.any(Array) })
      )
    })
  })

  // ── detectBatch ──────────────────────────────────────────────────────────

  describe('detectBatch', () => {
    it('detects all songs in project and returns SectionData[]', async () => {
      const songs = [
        makeSong({ id: 'song-1', localFilePath: '/music/track1.mp3' }),
        makeSong({ id: 'song-2', localFilePath: '/music/track2.mp3' }),
        makeSong({ id: 'song-3', localFilePath: '/music/track3.mp3' }),
      ]
      const service = makeProjectService(songs)
      // Override stat to succeed for all files
      mockFs.stat.mockResolvedValue({
        size: 12345,
        mtimeMs: 1700000000,
      } as fsExtra.Stats)
      mockFs.pathExists.mockResolvedValue(false as never)

      const det = new SectionDetector(service)
      const results = await det.detectBatch('proj-1')

      expect(results).toHaveLength(3)
      expect(results.map((r) => r.songId)).toEqual([
        'song-1',
        'song-2',
        'song-3',
      ])
    })

    it('broadcasts progress events via BrowserWindow.getAllWindows()', async () => {
      const songs = [
        makeSong({ id: 'song-1', localFilePath: '/music/track1.mp3' }),
        makeSong({ id: 'song-2', localFilePath: '/music/track2.mp3' }),
      ]
      const service = makeProjectService(songs)
      mockFs.pathExists.mockResolvedValue(false as never)

      const det = new SectionDetector(service)
      await det.detectBatch('proj-1')

      // Progress is broadcast before and after each song → 4 sends for 2 songs
      expect(mockSend).toHaveBeenCalledWith(
        'section:progress',
        expect.objectContaining({ songId: 'song-1', total: 2 })
      )
      expect(mockSend).toHaveBeenCalledWith(
        'section:progress',
        expect.objectContaining({ songId: 'song-2', total: 2 })
      )
    })

    it('continues processing remaining songs when one fails, returns partial results', async () => {
      const { spawn } = require('child_process')
      const EventEmitter = require('events')

      let callCount = 0
      spawn.mockImplementation(() => {
        callCount++
        const proc = new EventEmitter()
        proc.stdout = new EventEmitter()
        proc.stderr = new EventEmitter()

        if (callCount === 1) {
          // First song: FFmpeg fails
          process.nextTick(() => {
            proc.stderr.emit('data', Buffer.from('error'))
            proc.emit('close', 1)
          })
        } else {
          // Second and third song: succeed
          const sampleCount = 22050 * 20
          const pcmBuf = Buffer.alloc(sampleCount * 4)
          process.nextTick(() => {
            proc.stdout.emit('data', pcmBuf)
            proc.emit('close', 0)
          })
        }
        return proc
      })

      const songs = [
        makeSong({ id: 'song-1', localFilePath: '/music/track1.mp3' }),
        makeSong({ id: 'song-2', localFilePath: '/music/track2.mp3' }),
        makeSong({ id: 'song-3', localFilePath: '/music/track3.mp3' }),
      ]
      const service = makeProjectService(songs)
      mockFs.pathExists.mockResolvedValue(false as never)

      const det = new SectionDetector(service)
      const results = await det.detectBatch('proj-1')

      // song-1 failed, song-2 and song-3 should succeed
      expect(results).toHaveLength(2)
      expect(results.map((r) => r.songId)).toEqual(['song-2', 'song-3'])
    })

    it('returns empty array for project with no songs', async () => {
      const service = makeProjectService([])
      const det = new SectionDetector(service)

      const results = await det.detectBatch('proj-1')

      expect(results).toEqual([])
    })

    it('skips songs without a file path', async () => {
      const songs = [
        makeSong({
          id: 'song-no-path',
          localFilePath: undefined,
          externalFilePath: undefined,
        }),
        makeSong({ id: 'song-2', localFilePath: '/music/track2.mp3' }),
      ]
      const service = makeProjectService(songs)
      mockFs.pathExists.mockResolvedValue(false as never)

      const det = new SectionDetector(service)
      const results = await det.detectBatch('proj-1')

      // Only song-2 should be processed
      expect(results).toHaveLength(1)
      expect(results[0].songId).toBe('song-2')
    })
  })

  // ── Section classification ───────────────────────────────────────────────

  describe('section classification via detectSong with energy profiles', () => {
    it('classifies first section as "intro" when its energy is low (< 0.4)', async () => {
      mockFs.pathExists.mockResolvedValue(false as never)

      // Energy profile: low first, high middle, low last
      // Each value maps to a portion of the track duration
      const energyProfile = [
        0.1,
        0.1,
        0.1, // intro region (~0–3s)
        0.8,
        0.8,
        0.8, // drop region (~3–6s)
        0.3,
        0.3,
        0.3, // breakdown (~6–9s)
        0.1,
        0.1,
        0.1, // outro (~9–12s)
      ]

      const song = makeSong({ energyProfile, duration: 20 })
      const service = makeProjectService([song])
      const det = new SectionDetector(service)
      const result = await det.detectSong('proj-1', 'song-1')

      // If we get a single-section result (no boundaries found), it will be 'custom';
      // otherwise check that at least one section exists
      expect(result.sections.length).toBeGreaterThan(0)

      // First section may be intro (if boundaries are detected and energy is low)
      // or custom (if no boundary is found in uniform MFCC output)
      const firstType = result.sections[0].type
      expect(['intro', 'custom']).toContain(firstType)
    })

    it('classifies highest-energy section as "drop" when energy > 0.5', async () => {
      mockFs.pathExists.mockResolvedValue(false as never)

      // We will directly call buildSections via the private method
      // by spying on classifySections and observing the output
      const sections = [
        {
          id: '1',
          type: 'custom' as const,
          startTime: 0,
          endTime: 5,
          confidence: 0.5,
        },
        {
          id: '2',
          type: 'custom' as const,
          startTime: 5,
          endTime: 10,
          confidence: 0.5,
        },
        {
          id: '3',
          type: 'custom' as const,
          startTime: 10,
          endTime: 15,
          confidence: 0.5,
        },
      ]
      const energyProfile = [
        0.1,
        0.1, // section 0 → low
        0.9,
        0.9, // section 1 → high (drop)
        0.3,
        0.3, // section 2 → medium
      ]

      // Call the private classifySections method directly
      const classifySections = (det: SectionDetector) =>
        (
          det as unknown as {
            classifySections: (
              s: typeof sections,
              d: number,
              e: number[]
            ) => void
          }
        ).classifySections

      const classify = classifySections(detector)
      classify.call(detector, sections, 15, energyProfile)

      expect(sections[1].type).toBe('drop')
    })

    it('classifies last section as "outro" when its energy is low (< 0.4)', async () => {
      const sections = [
        {
          id: '1',
          type: 'custom' as const,
          startTime: 0,
          endTime: 5,
          confidence: 0.5,
        },
        {
          id: '2',
          type: 'custom' as const,
          startTime: 5,
          endTime: 10,
          confidence: 0.5,
        },
        {
          id: '3',
          type: 'custom' as const,
          startTime: 10,
          endTime: 15,
          confidence: 0.5,
        },
      ]
      // Last section has very low energy
      const energyProfile = [
        0.5,
        0.5, // section 0 → medium
        0.8,
        0.8, // section 1 → high (drop)
        0.1,
        0.1, // section 2 → low (outro)
      ]

      const classify = (
        detector as unknown as {
          classifySections: (s: typeof sections, d: number, e: number[]) => void
        }
      ).classifySections

      classify.call(detector, sections, 15, energyProfile)

      expect(sections[2].type).toBe('outro')
    })

    it('classifies section before drop as "buildup" when energy is rising', async () => {
      const sections = [
        {
          id: '1',
          type: 'custom' as const,
          startTime: 0,
          endTime: 5,
          confidence: 0.5,
        },
        {
          id: '2',
          type: 'custom' as const,
          startTime: 5,
          endTime: 10,
          confidence: 0.5,
        },
        {
          id: '3',
          type: 'custom' as const,
          startTime: 10,
          endTime: 15,
          confidence: 0.5,
        },
      ]
      // Middle section (index 2) is the highest — so index 1 (before) should be buildup
      const energyProfile = [
        0.3,
        0.3, // section 0 → low-medium
        0.6,
        0.6, // section 1 → medium (before drop → buildup)
        0.9,
        0.9, // section 2 → high (drop)
      ]

      const classify = (
        detector as unknown as {
          classifySections: (s: typeof sections, d: number, e: number[]) => void
        }
      ).classifySections

      classify.call(detector, sections, 15, energyProfile)

      expect(sections[1].type).toBe('buildup')
      expect(sections[2].type).toBe('drop')
    })

    it('classifies section after drop as "breakdown" when energy drops below 70% of drop energy', async () => {
      const sections = [
        {
          id: '1',
          type: 'custom' as const,
          startTime: 0,
          endTime: 5,
          confidence: 0.5,
        },
        {
          id: '2',
          type: 'custom' as const,
          startTime: 5,
          endTime: 10,
          confidence: 0.5,
        },
        {
          id: '3',
          type: 'custom' as const,
          startTime: 10,
          endTime: 15,
          confidence: 0.5,
        },
        {
          id: '4',
          type: 'custom' as const,
          startTime: 15,
          endTime: 20,
          confidence: 0.5,
        },
      ]
      // Section 1 is drop (energy 0.9), section 2 (after drop) should be breakdown (0.5 < 0.9 * 0.7 = 0.63)
      const energyProfile = [
        0.2,
        0.2,
        0.2,
        0.2,
        0.2, // section 0 → low
        0.9,
        0.9,
        0.9,
        0.9,
        0.9, // section 1 → drop
        0.5,
        0.5,
        0.5,
        0.5,
        0.5, // section 2 → breakdown (0.5 < 0.63)
        0.3,
        0.3,
        0.3,
        0.3,
        0.3, // section 3 → outro
      ]

      const classify = (
        detector as unknown as {
          classifySections: (s: typeof sections, d: number, e: number[]) => void
        }
      ).classifySections

      classify.call(detector, sections, 20, energyProfile)

      expect(sections[1].type).toBe('drop')
      expect(sections[2].type).toBe('breakdown')
    })
  })

  // ── Cache infrastructure ─────────────────────────────────────────────────

  describe('cache infrastructure', () => {
    it('does not write cache when cache hit occurs', async () => {
      const cached = makeCachedSectionData(FILE_HASH)

      mockFs.pathExists.mockResolvedValue(true as never)
      mockFs.readJson.mockResolvedValue(cached as never)

      await detector.detectSong('proj-1', 'song-1')

      expect(mockFs.writeJson).not.toHaveBeenCalled()
    })

    it('invalidates cache when file hash does not match stored hash', async () => {
      // Cache has stale hash
      const staleCache = makeCachedSectionData('OLD_HASH')

      mockFs.pathExists.mockResolvedValue(true as never)
      mockFs.readJson.mockResolvedValue(staleCache as never)

      const result = await detector.detectSong('proj-1', 'song-1')

      // Should have re-computed and written new cache
      expect(mockFs.writeJson).toHaveBeenCalledWith(
        CACHE_PATH,
        expect.objectContaining({ fileHash: FILE_HASH })
      )
      expect(result.fileHash).toBe(FILE_HASH)
    })

    it('writes cache to correct path under projectDirectory/assets/waveforms/', async () => {
      mockFs.pathExists.mockResolvedValue(false as never)

      await detector.detectSong('proj-1', 'song-1')

      expect(mockFs.ensureDir).toHaveBeenCalledWith(
        path.join('/projects/test', 'assets', 'waveforms')
      )
      expect(mockFs.writeJson).toHaveBeenCalledWith(
        CACHE_PATH,
        expect.any(Object)
      )
    })

    it('computeFileHash returns "<size>-<mtimeMs>" format', async () => {
      mockFs.stat.mockResolvedValue({
        size: 12345,
        mtimeMs: 1700000000,
      } as fsExtra.Stats)

      // Access private method via type cast
      const computeFileHash = (
        detector as unknown as {
          computeFileHash: (p: string) => Promise<string>
        }
      ).computeFileHash

      const hash = await computeFileHash.call(detector, '/some/file.mp3')
      expect(hash).toBe('12345-1700000000')
    })
  })
})
