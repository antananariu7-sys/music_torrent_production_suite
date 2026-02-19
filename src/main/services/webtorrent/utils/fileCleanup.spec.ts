import { clearPreCreatedDirs, cleanupDeselectedFiles, deleteDownloadedFiles } from './fileCleanup'
import type { QueuedTorrent } from '@shared/types/torrent.types'

jest.mock('fs')
jest.mock('child_process')

import { existsSync, rmSync, readdirSync, statSync } from 'fs'
import { execSync } from 'child_process'

const mockExistsSync = existsSync as jest.Mock
const mockRmSync = rmSync as jest.Mock
const mockReaddirSync = readdirSync as jest.Mock
const mockStatSync = statSync as jest.Mock
const mockExecSync = execSync as jest.Mock

function makeQueuedTorrent(overrides: Partial<QueuedTorrent> = {}): QueuedTorrent {
  return {
    id: 'id1',
    name: 'My Album',
    downloadPath: '/downloads',
    files: [],
    status: 'completed',
    progress: 100,
    magnetUri: 'magnet:?',
    addedAt: '2026-01-01T00:00:00.000Z',
    downloadSpeed: 0,
    uploadSpeed: 0,
    downloaded: 0,
    uploaded: 0,
    totalSize: 0,
    seeders: 0,
    leechers: 0,
    ratio: 0,
    ...overrides,
  } as unknown as QueuedTorrent
}

describe('fileCleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockExecSync.mockImplementation(() => {})
  })

  describe('clearPreCreatedDirs', () => {
    it('does nothing when torrentName is empty', () => {
      clearPreCreatedDirs('/downloads', '')
      expect(mockExistsSync).not.toHaveBeenCalled()
    })

    it('does nothing when downloadPath is empty', () => {
      clearPreCreatedDirs('', 'My Album')
      expect(mockExistsSync).not.toHaveBeenCalled()
    })

    it('does nothing when torrent root does not exist on disk', () => {
      mockExistsSync.mockReturnValue(false)
      clearPreCreatedDirs('/downloads', 'My Album')
      expect(mockRmSync).not.toHaveBeenCalled()
    })

    it('skips deletion when torrent root has existing files', () => {
      // torrentRoot exists
      mockExistsSync.mockReturnValue(true)
      // hasAnyFiles finds a file
      mockReaddirSync.mockReturnValue([
        { isFile: () => true, isDirectory: () => false, name: 'track.mp3' },
      ] as any)

      clearPreCreatedDirs('/downloads', 'My Album')

      expect(mockRmSync).not.toHaveBeenCalled()
    })

    it('deletes torrent root when it exists and is empty', () => {
      mockExistsSync
        .mockReturnValueOnce(true)  // torrentRoot exists
        .mockReturnValue(false)     // after rmSync → forceDeleteDir returns true
      mockReaddirSync.mockReturnValue([]) // no files
      mockRmSync.mockImplementation(() => {})

      clearPreCreatedDirs('/downloads', 'My Album')

      expect(mockRmSync).toHaveBeenCalledWith(
        expect.stringContaining('My Album'),
        { recursive: true, force: true }
      )
    })
  })

  describe('cleanupDeselectedFiles', () => {
    it('does nothing when downloadPath is empty', async () => {
      const qt = makeQueuedTorrent({ downloadPath: '' })
      await cleanupDeselectedFiles(qt)
      expect(mockRmSync).not.toHaveBeenCalled()
    })

    it('does nothing when all files are selected', async () => {
      const qt = makeQueuedTorrent({
        files: [
          { path: 'Album/track1.mp3', name: 'track1.mp3', size: 1000, downloaded: 1000, selected: true },
        ],
      })
      await cleanupDeselectedFiles(qt)
      expect(mockRmSync).not.toHaveBeenCalled()
    })

    it('deletes deselected files that exist on disk', async () => {
      const qt = makeQueuedTorrent({
        files: [
          { path: 'Album/track1.mp3', name: 'track1.mp3', size: 1000, downloaded: 0, selected: false },
          { path: 'Album/track2.mp3', name: 'track2.mp3', size: 2000, downloaded: 2000, selected: true },
        ],
      })
      mockExistsSync.mockReturnValue(true)
      mockRmSync.mockImplementation(() => {})
      mockReaddirSync.mockReturnValue([]) // dirs empty after deletion

      await cleanupDeselectedFiles(qt)

      expect(mockRmSync).toHaveBeenCalledWith(
        expect.stringContaining('track1.mp3'),
        { force: true }
      )
    })

    it('skips deselected files that do not exist on disk', async () => {
      const qt = makeQueuedTorrent({
        files: [
          { path: 'Album/track1.mp3', name: 'track1.mp3', size: 1000, downloaded: 0, selected: false },
        ],
      })
      mockExistsSync.mockReturnValue(false)

      await cleanupDeselectedFiles(qt)

      expect(mockRmSync).not.toHaveBeenCalled()
    })

    it('does not delete directories that are ancestors of selected files', async () => {
      const qt = makeQueuedTorrent({
        downloadPath: '/downloads',
        files: [
          { path: 'Album/CD1/track1.mp3', name: 'track1.mp3', size: 1000, downloaded: 0, selected: false },
          { path: 'Album/CD1/track2.mp3', name: 'track2.mp3', size: 2000, downloaded: 2000, selected: true },
        ],
      })
      mockExistsSync.mockReturnValue(true)
      mockRmSync.mockImplementation(() => {})
      mockReaddirSync.mockReturnValue([])

      await cleanupDeselectedFiles(qt)

      // rmSync should be called only for the deselected file, not for Album/CD1
      const rmCalls: string[] = mockRmSync.mock.calls.map((c: unknown[]) => c[0] as string)
      // Album/CD1 dir is an ancestor of the selected file — must NOT be deleted
      expect(rmCalls.some(p => p.endsWith('CD1') && !p.includes('track'))).toBe(false)
    })
  })

  describe('deleteDownloadedFiles', () => {
    it('deletes root directory when found via torrentRootFolder', () => {
      const qt = makeQueuedTorrent({
        torrentRootFolder: 'My Album',
        files: [],
      })
      mockExistsSync
        .mockReturnValueOnce(true)  // rootDir exists
        .mockReturnValue(false)     // after rmSync, dir is gone
      mockStatSync.mockReturnValue({ isDirectory: () => true })
      mockRmSync.mockImplementation(() => {})

      deleteDownloadedFiles(qt)

      expect(mockRmSync).toHaveBeenCalledWith(
        expect.stringContaining('My Album'),
        { recursive: true, force: true }
      )
    })

    it('falls back to individual file deletion when root dir cannot be found', () => {
      const qt = makeQueuedTorrent({
        name: 'My Album',
        files: [
          { path: 'My Album/track1.mp3', name: 'track1.mp3', size: 1000, downloaded: 1000, selected: true },
        ],
      })
      // existsSync: root dir not a directory, but individual file exists
      mockExistsSync.mockImplementation((p: string) => {
        return p.endsWith('track1.mp3')
      })
      mockStatSync.mockImplementation(() => { throw new Error('not a dir') })
      mockRmSync.mockImplementation(() => {})
      mockReaddirSync.mockReturnValue([])

      deleteDownloadedFiles(qt)

      expect(mockRmSync).toHaveBeenCalledWith(
        expect.stringContaining('track1.mp3'),
        { force: true }
      )
    })

    it('does not throw when download path has no files and no root dir', () => {
      const qt = makeQueuedTorrent({ files: [] })
      mockExistsSync.mockReturnValue(false)

      expect(() => deleteDownloadedFiles(qt)).not.toThrow()
    })
  })
})
