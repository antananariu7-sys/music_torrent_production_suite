import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { DownloadHistoryManager } from './DownloadHistoryManager'
import type { TorrentFile } from '@shared/types/torrent.types'

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}))

const mockedExistsSync = existsSync as jest.MockedFunction<typeof existsSync>
const mockedReadFileSync = readFileSync as jest.MockedFunction<
  typeof readFileSync
>
const mockedWriteFileSync = writeFileSync as jest.MockedFunction<
  typeof writeFileSync
>

function makeEntry(id: string): TorrentFile {
  return {
    id,
    title: `Torrent ${id}`,
    filePath: `/torrents/${id}.torrent`,
    pageUrl: `https://rutracker.org/forum/viewtopic.php?t=${id}`,
    downloadedAt: new Date('2024-01-15T12:00:00Z'),
  }
}

describe('DownloadHistoryManager', () => {
  let manager: DownloadHistoryManager

  beforeEach(() => {
    jest.clearAllMocks()
    manager = new DownloadHistoryManager('/tmp/torrents')
  })

  describe('addEntry', () => {
    it('should write entry to file', () => {
      mockedExistsSync.mockReturnValue(false)

      manager.addEntry(makeEntry('1'))

      expect(mockedWriteFileSync).toHaveBeenCalled()
      const written = JSON.parse(
        (mockedWriteFileSync.mock.calls[0] as unknown as [string, string])[1]
      )
      expect(written).toHaveLength(1)
      expect(written[0].id).toBe('1')
    })

    it('should add second entry alongside first', () => {
      const existing = JSON.stringify([makeEntry('1')])
      mockedExistsSync.mockReturnValue(true)
      mockedReadFileSync.mockReturnValue(existing as any)

      manager.addEntry(makeEntry('2'))

      expect(mockedWriteFileSync).toHaveBeenCalled()
      const written = JSON.parse(
        (mockedWriteFileSync.mock.calls[0] as unknown as [string, string])[1]
      )
      expect(written).toHaveLength(2)
    })
  })

  describe('getHistory', () => {
    it('should return entries sorted by date', () => {
      const entries = [makeEntry('1'), makeEntry('2')]
      mockedExistsSync.mockReturnValue(true)
      mockedReadFileSync.mockReturnValue(JSON.stringify(entries) as any)

      const history = manager.getHistory()
      expect(history).toHaveLength(2)
    })

    it('should return empty array when file does not exist', () => {
      mockedExistsSync.mockReturnValue(false)

      const history = manager.getHistory()
      expect(history).toHaveLength(0)
    })

    it('should return empty array on corrupted JSON', () => {
      mockedExistsSync.mockReturnValue(true)
      mockedReadFileSync.mockReturnValue('{broken json' as any)

      const history = manager.getHistory()
      expect(history).toHaveLength(0)
    })
  })

  describe('clearHistory', () => {
    it('should clear and write empty array to file', () => {
      manager.clearHistory()

      expect(mockedWriteFileSync).toHaveBeenCalled()
      const written = JSON.parse(
        (mockedWriteFileSync.mock.calls[0] as unknown as [string, string])[1]
      )
      expect(written).toHaveLength(0)
    })
  })

  describe('keepHistory flag', () => {
    it('should not save when keepHistory is false', () => {
      manager.addEntry(makeEntry('1'), undefined, false)
      expect(mockedWriteFileSync).not.toHaveBeenCalled()
    })

    it('should not load when keepHistory is false', () => {
      const history = manager.getHistory(undefined, false)
      expect(mockedReadFileSync).not.toHaveBeenCalled()
      expect(history).toHaveLength(0)
    })
  })
})
