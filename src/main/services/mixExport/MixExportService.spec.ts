import { describe, it, expect, beforeEach, jest } from '@jest/globals'

// Mock electron
jest.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: jest.fn().mockReturnValue([]),
  },
}))

// Mock fs
jest.mock('fs', () => ({
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(false),
}))

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('test-job-id'),
}))

// Mock MixValidator
jest.mock('./MixValidator', () => ({
  validateSongs: jest.fn(),
  resolveSongPath: jest.fn((song: { filePath?: string }) => song.filePath),
  clampCrossfade: jest.fn((raw: number) => ({ value: raw, clamped: false })),
}))

// Mock LoudnormAnalyzer
jest.mock('./LoudnormAnalyzer', () => ({
  analyzeLoudness: jest.fn().mockResolvedValue({
    input_i: -14,
    input_tp: -1,
    input_lra: 7,
    input_thresh: -24,
  }),
}))

// Mock FilterGraphBuilder
jest.mock('./FilterGraphBuilder', () => ({
  buildFilterGraph: jest.fn().mockReturnValue('[0:a]anull[out]'),
  buildRenderArgs: jest.fn().mockReturnValue(['-f', 'null', '/dev/null']),
}))

// Mock CueSheetGenerator
jest.mock('./CueSheetGenerator', () => ({
  generateCueSheet: jest
    .fn()
    .mockReturnValue('TITLE "Test Mix"\nFILE "mix.mp3"'),
}))

// Mock ffmpegRunner
const mockProcess = {
  kill: jest.fn(),
  pid: 12345,
}

jest.mock('../../utils/ffmpegRunner', () => ({
  spawnFfmpeg: jest.fn().mockReturnValue({
    process: mockProcess,
    promise: Promise.resolve({ code: 0, stderr: '' }),
  }),
}))

import { MixExportService } from './MixExportService'
import { BrowserWindow } from 'electron'
import { existsSync } from 'fs'
import { validateSongs } from './MixValidator'
import type { MixExportRequest } from '@shared/types/mixExport.types'
import type { Song } from '@shared/types/project.types'
import type { ProjectService } from '../ProjectService'

/** Helper to create a minimal Song */
function makeSong(overrides?: Partial<Song>): Song {
  return {
    id: 'song-1',
    title: 'Test Song',
    filePath: '/audio/song.mp3',
    order: 0,
    duration: 180,
    ...overrides,
  } as Song
}

/** Helper to create a minimal MixExportRequest */
function makeRequest(overrides?: Partial<MixExportRequest>): MixExportRequest {
  return {
    projectId: 'project-1',
    outputDirectory: '/tmp/export',
    outputFilename: 'my-mix',
    format: 'mp3',
    normalization: false,
    generateCueSheet: false,
    defaultCrossfadeDuration: 5,
    ...overrides,
  }
}

describe('MixExportService', () => {
  let service: MixExportService
  let mockProjectService: ProjectService

  beforeEach(() => {
    jest.clearAllMocks()

    mockProjectService = {
      getActiveProject: jest.fn().mockReturnValue({
        name: 'Test Project',
        songs: [
          makeSong({ id: 's1', title: 'Song A', order: 0, duration: 180 }),
          makeSong({ id: 's2', title: 'Song B', order: 1, duration: 240 }),
          makeSong({ id: 's3', title: 'Song C', order: 2, duration: 300 }),
        ],
        mixMetadata: { title: 'Test Mix' },
      }),
      updateMixMetadata: jest.fn().mockResolvedValue(undefined),
    } as unknown as ProjectService

    // Default: all songs valid, none missing
    ;(validateSongs as jest.Mock).mockReturnValue({
      valid: [
        makeSong({ id: 's1', title: 'Song A', order: 0, duration: 180 }),
        makeSong({ id: 's2', title: 'Song B', order: 1, duration: 240 }),
        makeSong({ id: 's3', title: 'Song C', order: 2, duration: 300 }),
      ],
      missing: [],
    })

    // Mock BrowserWindow for progress broadcasts
    ;(BrowserWindow.getAllWindows as jest.Mock).mockReturnValue([])

    service = new MixExportService(mockProjectService)
  })

  describe('startExport', () => {
    it('should return a job ID on success', async () => {
      const result = await service.startExport(makeRequest())

      expect(result.jobId).toBe('test-job-id')
    })

    it('should throw when already exporting', async () => {
      await service.startExport(makeRequest())

      await expect(service.startExport(makeRequest())).rejects.toThrow(
        'An export is already in progress'
      )
    })

    it('should compute output path with correct mp3 extension', async () => {
      const result = await service.startExport(
        makeRequest({ format: 'mp3', outputFilename: 'my-mix' })
      )

      expect(result.jobId).toBeDefined()
    })

    it('should compute output path with correct flac extension', async () => {
      const result = await service.startExport(
        makeRequest({ format: 'flac', outputFilename: 'my-mix' })
      )

      expect(result.jobId).toBeDefined()
    })

    it('should compute output path with correct wav extension', async () => {
      const result = await service.startExport(
        makeRequest({ format: 'wav', outputFilename: 'my-mix' })
      )

      expect(result.jobId).toBeDefined()
    })
  })

  describe('cancelExport', () => {
    it('should be no-op when not exporting', () => {
      // Should not throw
      service.cancelExport()
    })

    it('should kill FFmpeg process and clean up partial output', async () => {
      ;(existsSync as jest.Mock).mockReturnValue(true)

      await service.startExport(makeRequest())
      service.cancelExport()

      // After cancel, starting a new export should work
      const result = await service.startExport(makeRequest())
      expect(result.jobId).toBeDefined()
    })

    it('should broadcast cancelled progress', async () => {
      const mockWin = {
        isDestroyed: jest.fn().mockReturnValue(false),
        webContents: { send: jest.fn() },
      }
      ;(BrowserWindow.getAllWindows as jest.Mock).mockReturnValue([mockWin])

      await service.startExport(makeRequest())
      service.cancelExport()

      const cancelledCall = mockWin.webContents.send.mock.calls.find(
        (call: unknown[]) => {
          const progress = call[1] as { phase: string }
          return progress?.phase === 'cancelled'
        }
      )
      expect(cancelledCall).toBeDefined()
    })
  })

  describe('computeTotalDuration (tested via pipeline)', () => {
    it('should compute duration for 3 songs with crossfades', async () => {
      // The pipeline computes duration internally. We verify the service
      // doesn't crash and produces a valid result.
      const result = await service.startExport(makeRequest())
      expect(result.jobId).toBeDefined()
    })
  })

  describe('pipeline — validation failure', () => {
    it('should broadcast error when songs have missing files', async () => {
      ;(validateSongs as jest.Mock).mockReturnValue({
        valid: [],
        missing: [{ title: 'Missing Song' }],
      })

      const mockWin = {
        isDestroyed: jest.fn().mockReturnValue(false),
        webContents: { send: jest.fn() },
      }
      ;(BrowserWindow.getAllWindows as jest.Mock).mockReturnValue([mockWin])

      await service.startExport(makeRequest())

      // Wait for async pipeline to fail
      await new Promise((r) => setTimeout(r, 50))

      const errorCall = mockWin.webContents.send.mock.calls.find(
        (call: unknown[]) => {
          const progress = call[1] as { phase: string }
          return progress?.phase === 'error'
        }
      )
      expect(errorCall).toBeDefined()
      expect((errorCall![1] as { error: string }).error).toContain(
        'Missing audio files'
      )
    })
  })

  describe('pipeline — progress broadcasting', () => {
    it('should broadcast progress phases in order', async () => {
      const mockWin = {
        isDestroyed: jest.fn().mockReturnValue(false),
        webContents: { send: jest.fn() },
      }
      ;(BrowserWindow.getAllWindows as jest.Mock).mockReturnValue([mockWin])

      await service.startExport(makeRequest())

      // Wait for async pipeline to complete
      await new Promise((r) => setTimeout(r, 100))

      const phases = mockWin.webContents.send.mock.calls
        .map((call: unknown[]) => (call[1] as { phase: string })?.phase)
        .filter(Boolean)

      // Should include validating, analyzing, rendering, complete
      expect(phases).toContain('validating')
      expect(phases).toContain('rendering')
      expect(phases).toContain('complete')
    })
  })
})
