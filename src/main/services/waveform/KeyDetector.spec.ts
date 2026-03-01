/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports */
import * as path from 'path'
import { describe, it, expect, beforeEach } from '@jest/globals'
import * as fsExtra from 'fs-extra'
import type { ProjectService } from '../ProjectService'
import type { KeyData } from '@shared/types/waveform.types'
import { IPC_CHANNELS } from '@shared/constants'

// --- Mock: fs-extra ---
jest.mock('fs-extra')

// --- Mock: ffmpegPath ---
jest.mock('../../utils/ffmpegPath', () => ({
  getFfmpegPath: () => '/usr/bin/ffmpeg',
}))

// --- Mock: electron BrowserWindow ---
const mockSend = jest.fn()
jest.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => [
      { isDestroyed: () => false, webContents: { send: mockSend } },
    ],
  },
}))

// --- Mock: essentia.js ---
const mockEssentiaInstance = {
  version: '0.1.3',
  arrayToVector: jest.fn((arr: Float32Array) => arr),
  KeyExtractor: jest.fn(() => ({ key: 'C', scale: 'major', strength: 0.85 })),
  shutdown: jest.fn(),
  delete: jest.fn(),
}

jest.mock('essentia.js', () => ({
  EssentiaWASM: {},
  Essentia: jest.fn(() => mockEssentiaInstance),
}))

// --- Mock: child_process spawn (emits enough PCM for >= 5 seconds) ---
jest.mock('child_process', () => {
  const EventEmitter = require('events')
  return {
    spawn: jest.fn(() => {
      const proc = new EventEmitter()
      proc.stdout = new EventEmitter()
      proc.stderr = new EventEmitter()
      // Emit PCM data: 6 seconds of float32 mono at 44100 Hz
      const sampleCount = 44100 * 6
      const pcmBuf = Buffer.alloc(sampleCount * 4)
      process.nextTick(() => {
        proc.stdout.emit('data', pcmBuf)
        proc.emit('close', 0)
      })
      return proc
    }),
  }
})

// --- Typed mock references ---
const mockFs = fsExtra as jest.Mocked<typeof fsExtra>
const mockSpawn = require('child_process').spawn as jest.Mock

// --- Helper: ProjectService factory ---
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
    updateSong: jest.fn().mockResolvedValue(undefined),
  } as unknown as ProjectService
}

// Convenience: the cache path used internally for a given song
const cachePathFor = (songId: string) =>
  path.join('/projects/test', 'assets', 'waveforms', `${songId}.key.json`)

// --- Import subject after mocks are registered ---
const { KeyDetector } = require('./KeyDetector') as {
  KeyDetector: new (ps: ProjectService) => import('./KeyDetector').KeyDetector
}

// ---------------------------------------------------------------------------

describe('KeyDetector', () => {
  let detector: import('./KeyDetector').KeyDetector

  beforeEach(() => {
    jest.clearAllMocks()
    // Reset essentia mock state between tests
    mockEssentiaInstance.KeyExtractor.mockReturnValue({
      key: 'C',
      scale: 'major',
      strength: 0.85,
    })
    mockEssentiaInstance.arrayToVector.mockImplementation(
      (arr: Float32Array) => arr
    )
    detector = new KeyDetector(makeProjectService())

    // Default fs.stat → valid hash
    mockFs.stat.mockResolvedValue({
      size: 12345,
      mtimeMs: 1700000000,
    } as fsExtra.Stats)

    // Default fs.ensureDir / writeJson → no-op
    mockFs.ensureDir.mockResolvedValue(undefined as never)
    mockFs.writeJson.mockResolvedValue(undefined as never)
    mockFs.remove.mockResolvedValue(undefined as never)
  })

  // -------------------------------------------------------------------------
  // detect() — cache hit
  // -------------------------------------------------------------------------
  describe('detect()', () => {
    it('returns cached result without spawning FFmpeg on cache hit', async () => {
      const expectedHash = '12345-1700000000'
      const cachedData: KeyData = {
        songId: 'song-1',
        key: '8B',
        originalKey: 'C major',
        confidence: 0.85,
        fileHash: expectedHash,
      }

      mockFs.pathExists.mockResolvedValue(true as never)
      mockFs.readJson.mockResolvedValue(cachedData as never)

      const result = await detector.detect('song-1', '/music/track.flac')

      expect(result).toEqual(cachedData)
      expect(mockSpawn).not.toHaveBeenCalled()
    })

    it('spawns FFmpeg and runs Essentia KeyExtractor on cache miss', async () => {
      mockFs.pathExists.mockResolvedValue(false as never)

      const result = await detector.detect('song-2', '/music/track.flac')

      expect(mockSpawn).toHaveBeenCalledWith(
        '/usr/bin/ffmpeg',
        expect.arrayContaining(['-f', 'f32le', 'pipe:1']),
        expect.any(Object)
      )
      expect(mockEssentiaInstance.KeyExtractor).toHaveBeenCalled()
      expect(result.songId).toBe('song-2')
      // With C major and strength 0.85 → Camelot '8B'
      expect(result.key).toBe('8B')
      expect(result.originalKey).toBe('C major')
      expect(result.confidence).toBeCloseTo(0.85)
      expect(result.fileHash).toBe('12345-1700000000')
    })

    it('writes cache to disk after a cache miss', async () => {
      mockFs.pathExists.mockResolvedValue(false as never)

      await detector.detect('song-3', '/music/track.flac')

      expect(mockFs.ensureDir).toHaveBeenCalled()
      expect(mockFs.writeJson).toHaveBeenCalledWith(
        cachePathFor('song-3'),
        expect.objectContaining({ songId: 'song-3', key: '8B' })
      )
    })

    it('returns empty key data when PCM is too short (< 5 seconds)', async () => {
      mockFs.pathExists.mockResolvedValue(false as never)

      // Override spawn to emit only 3 seconds of PCM
      mockSpawn.mockImplementationOnce(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const EventEmitter = require('events')
        const proc = new EventEmitter()
        proc.stdout = new EventEmitter()
        proc.stderr = new EventEmitter()
        const sampleCount = 44100 * 3 // 3 seconds — below threshold
        const pcmBuf = Buffer.alloc(sampleCount * 4)
        process.nextTick(() => {
          proc.stdout.emit('data', pcmBuf)
          proc.emit('close', 0)
        })
        return proc
      })

      const result = await detector.detect('song-short', '/music/short.flac')

      expect(result.key).toBe('')
      expect(result.originalKey).toBe('')
      expect(result.confidence).toBe(0)
      expect(mockEssentiaInstance.KeyExtractor).not.toHaveBeenCalled()
    })

    it('returns empty key data when Essentia KeyExtractor throws', async () => {
      mockFs.pathExists.mockResolvedValue(false as never)
      mockEssentiaInstance.KeyExtractor.mockImplementationOnce(() => {
        throw new Error('WASM crash')
      })

      const result = await detector.detect('song-err', '/music/err.flac')

      expect(result.key).toBe('')
      expect(result.originalKey).toBe('')
      expect(result.confidence).toBe(0)
      expect(result.songId).toBe('song-err')
    })

    it('returns empty key string when confidence < 0.2', async () => {
      mockFs.pathExists.mockResolvedValue(false as never)
      mockEssentiaInstance.KeyExtractor.mockReturnValueOnce({
        key: 'C',
        scale: 'major',
        strength: 0.15, // below MIN_CONFIDENCE
      })

      const result = await detector.detect('song-low', '/music/low.flac')

      expect(result.key).toBe('')
      expect(result.originalKey).toBe('')
      expect(result.confidence).toBeCloseTo(0.15)
    })

    it('returns Camelot notation when confidence >= 0.2', async () => {
      mockFs.pathExists.mockResolvedValue(false as never)
      mockEssentiaInstance.KeyExtractor.mockReturnValueOnce({
        key: 'C',
        scale: 'major',
        strength: 0.85,
      })

      const result = await detector.detect('song-camelot', '/music/track.flac')

      // toCamelot('C major') = '8B'
      expect(result.key).toBe('8B')
      expect(result.originalKey).toBe('C major')
    })

    it('does not use stale cache when file hash mismatches', async () => {
      const staleData: KeyData = {
        songId: 'song-stale',
        key: '5A',
        originalKey: 'D minor',
        confidence: 0.9,
        fileHash: 'old-hash-999',
      }
      mockFs.pathExists.mockResolvedValue(true as never)
      mockFs.readJson.mockResolvedValue(staleData as never)

      // fs.stat returns a different hash from the cached one
      mockFs.stat.mockResolvedValue({
        size: 99999,
        mtimeMs: 1700000001,
      } as fsExtra.Stats)

      const result = await detector.detect('song-stale', '/music/stale.flac')

      // Should re-run analysis, not return stale data
      expect(mockSpawn).toHaveBeenCalled()
      expect(result.fileHash).toBe('99999-1700000001')
    })
  })

  // -------------------------------------------------------------------------
  // detectSong()
  // -------------------------------------------------------------------------
  describe('detectSong()', () => {
    it('detects key and calls updateSong when confidence >= 0.2', async () => {
      const ps = makeProjectService({
        songs: [
          {
            id: 'song-A',
            title: 'Track A',
            localFilePath: 'tracks/a.flac',
            order: 0,
            addedAt: new Date(),
          },
        ] as never,
      })
      const det = new KeyDetector(ps)
      mockFs.pathExists.mockResolvedValue(false as never)
      mockEssentiaInstance.KeyExtractor.mockReturnValueOnce({
        key: 'C',
        scale: 'major',
        strength: 0.85,
      })

      const result = await det.detectSong('proj-1', 'song-A')

      expect(result.key).toBe('8B')
      expect(ps.updateSong).toHaveBeenCalledWith('proj-1', 'song-A', {
        musicalKey: '8B',
        musicalKeyConfidence: expect.closeTo(0.85, 2),
      })
    })

    it('does not call updateSong when confidence < 0.2', async () => {
      const ps = makeProjectService({
        songs: [
          {
            id: 'song-B',
            title: 'Track B',
            localFilePath: 'tracks/b.flac',
            order: 0,
            addedAt: new Date(),
          },
        ] as never,
      })
      const det = new KeyDetector(ps)
      mockFs.pathExists.mockResolvedValue(false as never)
      mockEssentiaInstance.KeyExtractor.mockReturnValueOnce({
        key: 'G',
        scale: 'major',
        strength: 0.1, // below threshold
      })

      await det.detectSong('proj-1', 'song-B')

      expect(ps.updateSong).not.toHaveBeenCalled()
    })

    it('throws when song is not found in the project', async () => {
      const ps = makeProjectService({ songs: [] as never })
      const det = new KeyDetector(ps)

      await expect(det.detectSong('proj-1', 'missing-song')).rejects.toThrow(
        'missing-song'
      )
    })

    it('throws when song has no file path', async () => {
      const ps = makeProjectService({
        songs: [
          {
            id: 'song-nopath',
            title: 'No Path',
            // no localFilePath, no externalFilePath
            order: 0,
            addedAt: new Date(),
          },
        ] as never,
      })
      const det = new KeyDetector(ps)

      await expect(det.detectSong('proj-1', 'song-nopath')).rejects.toThrow(
        'No file path for song song-nopath'
      )
    })

    it('clears cache before re-detecting', async () => {
      const ps = makeProjectService({
        songs: [
          {
            id: 'song-C',
            title: 'Track C',
            localFilePath: 'tracks/c.flac',
            order: 0,
            addedAt: new Date(),
          },
        ] as never,
      })
      const det = new KeyDetector(ps)
      mockFs.pathExists.mockResolvedValue(false as never)

      await det.detectSong('proj-1', 'song-C')

      expect(mockFs.remove).toHaveBeenCalledWith(cachePathFor('song-C'))
    })
  })

  // -------------------------------------------------------------------------
  // detectBatch()
  // -------------------------------------------------------------------------
  describe('detectBatch()', () => {
    it('detects all 3 songs and returns results array', async () => {
      const ps = makeProjectService({
        songs: [
          {
            id: 's1',
            title: 'Song 1',
            localFilePath: 'tracks/1.flac',
            order: 0,
            addedAt: new Date(),
          },
          {
            id: 's2',
            title: 'Song 2',
            localFilePath: 'tracks/2.flac',
            order: 1,
            addedAt: new Date(),
          },
          {
            id: 's3',
            title: 'Song 3',
            localFilePath: 'tracks/3.flac',
            order: 2,
            addedAt: new Date(),
          },
        ] as never,
      })
      const det = new KeyDetector(ps)
      mockFs.pathExists.mockResolvedValue(false as never)

      const results = await det.detectBatch('proj-1')

      expect(results).toHaveLength(3)
      expect(results.map((r) => r.songId)).toEqual(['s1', 's2', 's3'])
    })

    it('returns empty array when project has no songs', async () => {
      const ps = makeProjectService({ songs: [] as never })
      const det = new KeyDetector(ps)

      const results = await det.detectBatch('proj-1')

      expect(results).toEqual([])
    })

    it('continues with remaining songs when one fails', async () => {
      const ps = makeProjectService({
        songs: [
          {
            id: 'fail-song',
            title: 'Fail',
            localFilePath: 'tracks/fail.flac',
            order: 0,
            addedAt: new Date(),
          },
          {
            id: 'ok-song',
            title: 'OK',
            localFilePath: 'tracks/ok.flac',
            order: 1,
            addedAt: new Date(),
          },
        ] as never,
      })
      const det = new KeyDetector(ps)
      mockFs.pathExists.mockResolvedValue(false as never)

      // First spawn call fails, second succeeds
      mockSpawn
        .mockImplementationOnce(() => {
          const EventEmitter = require('events')
          const proc = new EventEmitter()
          proc.stdout = new EventEmitter()
          proc.stderr = new EventEmitter()
          process.nextTick(() => {
            proc.stderr.emit('data', Buffer.from('error'))
            proc.emit('close', 1) // non-zero exit code → reject
          })
          return proc
        })
        .mockImplementationOnce(() => {
          const EventEmitter = require('events')
          const proc = new EventEmitter()
          proc.stdout = new EventEmitter()
          proc.stderr = new EventEmitter()
          const sampleCount = 44100 * 6
          const pcmBuf = Buffer.alloc(sampleCount * 4)
          process.nextTick(() => {
            proc.stdout.emit('data', pcmBuf)
            proc.emit('close', 0)
          })
          return proc
        })

      const results = await det.detectBatch('proj-1')

      // Only the successful song is in results
      expect(results).toHaveLength(1)
      expect(results[0].songId).toBe('ok-song')
    })

    it('broadcasts KEY_PROGRESS events to all windows per song', async () => {
      const ps = makeProjectService({
        songs: [
          {
            id: 'p1',
            title: 'P1',
            localFilePath: 'tracks/p1.flac',
            order: 0,
            addedAt: new Date(),
          },
          {
            id: 'p2',
            title: 'P2',
            localFilePath: 'tracks/p2.flac',
            order: 1,
            addedAt: new Date(),
          },
        ] as never,
      })
      const det = new KeyDetector(ps)
      mockFs.pathExists.mockResolvedValue(false as never)

      await det.detectBatch('proj-1')

      // Each song emits at least 2 progress events: before + after detection
      const progressCalls = mockSend.mock.calls.filter(
        (c) => c[0] === IPC_CHANNELS.KEY_PROGRESS
      )
      expect(progressCalls.length).toBeGreaterThanOrEqual(2)

      // First progress event: index 0, total 2
      expect(progressCalls[0][1]).toMatchObject({
        songId: 'p1',
        index: 0,
        total: 2,
      })
    })

    it('skips songs without a file path and does not include them in results', async () => {
      const ps = makeProjectService({
        songs: [
          {
            id: 'no-path',
            title: 'No Path',
            // no localFilePath / externalFilePath
            order: 0,
            addedAt: new Date(),
          },
          {
            id: 'has-path',
            title: 'Has Path',
            localFilePath: 'tracks/has.flac',
            order: 1,
            addedAt: new Date(),
          },
        ] as never,
      })
      const det = new KeyDetector(ps)
      mockFs.pathExists.mockResolvedValue(false as never)

      const results = await det.detectBatch('proj-1')

      expect(results).toHaveLength(1)
      expect(results[0].songId).toBe('has-path')
    })

    it('persists key to song record via updateSong when confidence >= 0.2', async () => {
      const ps = makeProjectService({
        songs: [
          {
            id: 'persist-song',
            title: 'Persist',
            localFilePath: 'tracks/p.flac',
            order: 0,
            addedAt: new Date(),
          },
        ] as never,
      })
      const det = new KeyDetector(ps)
      mockFs.pathExists.mockResolvedValue(false as never)
      mockEssentiaInstance.KeyExtractor.mockReturnValue({
        key: 'C',
        scale: 'major',
        strength: 0.85,
      })

      await det.detectBatch('proj-1')

      expect(ps.updateSong).toHaveBeenCalledWith('proj-1', 'persist-song', {
        musicalKey: '8B',
        musicalKeyConfidence: expect.closeTo(0.85, 2),
      })
    })

    it('broadcasts final progress event with key field after detection', async () => {
      const ps = makeProjectService({
        songs: [
          {
            id: 'key-progress-song',
            title: 'Key Progress',
            localFilePath: 'tracks/kp.flac',
            order: 0,
            addedAt: new Date(),
          },
        ] as never,
      })
      const det = new KeyDetector(ps)
      mockFs.pathExists.mockResolvedValue(false as never)
      mockEssentiaInstance.KeyExtractor.mockReturnValue({
        key: 'C',
        scale: 'major',
        strength: 0.85,
      })

      await det.detectBatch('proj-1')

      const progressCalls = mockSend.mock.calls.filter(
        (c) => c[0] === IPC_CHANNELS.KEY_PROGRESS
      )
      // The second progress call (after detection) should have key='8B'
      const postDetectionEvent = progressCalls.find(
        (c) => c[1].key !== undefined
      )
      expect(postDetectionEvent).toBeDefined()
      expect(postDetectionEvent![1]).toMatchObject({
        songId: 'key-progress-song',
        key: '8B',
      })
    })
  })
})
